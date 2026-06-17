import type { MonthlySpendingSummary, NormalizedTransaction } from "./types";
import { categorizeTransaction, cleanMerchant, isLikelyRecurring } from "./categorize";
import {
  createDuplicateKey,
  formatTransactionValidationError,
  normalizedTransactionSchema,
  transactionTypeForAmountColumn,
} from "./transaction";

interface RawRow {
  [key: string]: string;
}

export class CsvImportError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "CsvImportError";
  }
}

const DATE_COLUMNS = [
  "date",
  "transaction date",
  "posted date",
  "trans date",
  "posting date",
];
const DESCRIPTION_COLUMNS = [
  "description",
  "transaction description",
  "memo",
  "name",
  "merchant",
  "payee",
];
const AMOUNT_COLUMNS = ["amount", "transaction amount", "charge amount"];
const DEBIT_COLUMNS = ["debit", "debit amount", "withdrawal", "withdrawals"];
const CREDIT_COLUMNS = ["credit", "credit amount", "deposit", "deposits"];

interface CsvColumnMapping {
  dateCol: string;
  descCol: string;
  amountCol?: string;
  debitCol?: string;
  creditCol?: string;
}

function findColumn(fields: string[], candidates: string[]): string | undefined {
  for (const c of candidates) {
    const match = fields.find((k) => k.toLowerCase().trim() === c.toLowerCase());
    if (match) return match;
  }
  return undefined;
}

function describeCandidates(candidates: string[]): string {
  return candidates.map((candidate) => `"${candidate}"`).join(", ");
}

export function resolveCsvColumns(fields: string[] | undefined): CsvColumnMapping {
  const normalizedFields = fields?.map((field) => field.trim()).filter(Boolean) ?? [];
  if (normalizedFields.length === 0) {
    throw new CsvImportError("CSV must include a header row.");
  }

  const dateCol = findColumn(normalizedFields, DATE_COLUMNS);
  const descCol = findColumn(normalizedFields, DESCRIPTION_COLUMNS);
  const amountCol = findColumn(normalizedFields, AMOUNT_COLUMNS);
  const debitCol = findColumn(normalizedFields, DEBIT_COLUMNS);
  const creditCol = findColumn(normalizedFields, CREDIT_COLUMNS);

  const missing: string[] = [];
  if (!dateCol) missing.push(`date (${describeCandidates(DATE_COLUMNS)})`);
  if (!descCol) {
    missing.push(`description (${describeCandidates(DESCRIPTION_COLUMNS)})`);
  }
  if (!amountCol && !debitCol && !creditCol) {
    missing.push(
      `amount (${describeCandidates([
        ...AMOUNT_COLUMNS,
        ...DEBIT_COLUMNS,
        ...CREDIT_COLUMNS,
      ])})`
    );
  }

  if (missing.length > 0) {
    throw new CsvImportError(`CSV is missing required column(s): ${missing.join("; ")}.`);
  }

  if (!dateCol || !descCol) {
    throw new CsvImportError("CSV is missing required column(s).");
  }

  return { dateCol, descCol, amountCol, debitCol, creditCol };
}

function parseAmount(raw: string | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const trimmed = raw.trim();
  const negative = /^\(.*\)$/.test(trimmed) || /-$/.test(trimmed);
  const amount = Number(trimmed.replace(/[()$,\s]/g, "").replace(/-$/, ""));
  if (!Number.isFinite(amount)) return undefined;
  return negative ? -Math.abs(amount) : amount;
}

function parseDate(raw: string | undefined): string {
  if (!raw) return "";
  const value = raw.trim();
  const isoMatch = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const usMatch = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  if (usMatch) {
    const [, month, day, rawYear] = usMatch;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return value;
}

let idCounter = 0;
function uid(): string {
  return `txn-${Date.now()}-${idCounter++}`;
}

export interface CsvSourceOptions {
  fileName: string;
  accountId?: string;
}

export function normalizeRows(
  rows: RawRow[],
  sourceOptions: CsvSourceOptions,
  columns?: CsvColumnMapping
): NormalizedTransaction[] {
  if (!rows.length) return [];

  const { dateCol, descCol, amountCol, debitCol, creditCol } =
    columns ?? resolveCsvColumns(Object.keys(rows[0]));

  return rows.map((row, index): NormalizedTransaction => {
    const rawDesc = row[descCol] || "";
    const merchant = cleanMerchant(rawDesc);

    let amount = 0;
    let type: "debit" | "credit" = "debit";

    if (amountCol) {
      const raw = parseAmount(row[amountCol]);
      if (raw === undefined) {
        throw new CsvImportError(
          `CSV row ${index + 2}: amount: must be a supported monetary value.`
        );
      } else if (raw < 0) {
        amount = Math.abs(raw);
        type = "debit";
      } else {
        amount = raw;
        type = transactionTypeForAmountColumn(raw, rawDesc);
      }
    } else if (debitCol || creditCol) {
      const rawDebit = debitCol ? row[debitCol] : undefined;
      const rawCredit = creditCol ? row[creditCol] : undefined;
      const debit = Math.abs(parseAmount(rawDebit) ?? 0);
      const credit = Math.abs(parseAmount(rawCredit) ?? 0);
      if (rawDebit?.trim() && debit === 0) {
        throw new CsvImportError(
          `CSV row ${index + 2}: debit: must be a supported monetary value.`
        );
      }
      if (rawCredit?.trim() && credit === 0) {
        throw new CsvImportError(
          `CSV row ${index + 2}: credit: must be a supported monetary value.`
        );
      }
      if (debit > 0 && credit > 0) {
        throw new CsvImportError(
          `CSV row ${index + 2}: provide either a debit or credit amount, not both.`
        );
      }
      if (debit > 0) {
        amount = debit;
        type = "debit";
      } else {
        amount = credit;
        type = "credit";
      }
    }

    const category = categorizeTransaction({
      description: rawDesc,
      merchant,
      type,
    });

    const transaction = {
      id: uid(),
      date: parseDate(dateCol ? row[dateCol] : undefined),
      description: rawDesc.trim(),
      merchant,
      amount,
      type,
      category,
      isRecurring: isLikelyRecurring(rawDesc, category),
      source: {
        kind: "csv" as const,
        fileName: sourceOptions.fileName,
        rowNumber: index + 2,
        accountId: sourceOptions.accountId,
      },
      duplicateKey: "",
    };
    transaction.duplicateKey = createDuplicateKey(transaction);
    const result = normalizedTransactionSchema.safeParse(transaction);
    if (!result.success) {
      throw new CsvImportError(
        `CSV row ${index + 2}: ${formatTransactionValidationError(result.error)}`
      );
    }
    return result.data;
  });
}

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function addMoney(current: number, amount: number): number {
  return roundMoney(current + amount);
}

export function computeSummary(txns: NormalizedTransaction[]) {
  const spending = txns.filter((t) => t.type === "debit");
  const income = txns.filter((t) => t.type === "credit");

  const totalSpending = spending.reduce((s, t) => addMoney(s, t.amount), 0);
  const totalIncome = income.reduce((s, t) => addMoney(s, t.amount), 0);

  const byCategory: Record<string, number> = {};
  for (const t of spending) {
    const category = t.category ?? "Unknown";
    byCategory[category] = addMoney(byCategory[category] || 0, t.amount);
  }

  const merchantMap: Record<string, number> = {};
  for (const t of spending) {
    merchantMap[t.merchant] = addMoney(merchantMap[t.merchant] || 0, t.amount);
  }
  const topMerchants = Object.entries(merchantMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([merchant, total]) => ({ merchant, total }));

  const topTransactions = [...spending].sort((a, b) => b.amount - a.amount).slice(0, 10);
  const subscriptions = Object.values(
    txns
      .filter((t) => t.isRecurring && t.type === "debit")
      .reduce<Record<string, NormalizedTransaction>>((unique, transaction) => {
        const current = unique[transaction.merchant];
        if (!current || transaction.date > current.date) {
          unique[transaction.merchant] = transaction;
        }
        return unique;
      }, {})
  );

  const monthMap: Record<string, MonthlySpendingSummary> = {};
  for (const t of txns) {
    const month = t.date.slice(0, 7);
    monthMap[month] ??= {
      month,
      totalSpending: 0,
      totalCredits: 0,
      netAmount: 0,
      byCategory: {},
    };

    const monthlySummary = monthMap[month];
    if (t.type === "debit") {
      const category = t.category ?? "Unknown";
      monthlySummary.totalSpending = addMoney(monthlySummary.totalSpending, t.amount);
      monthlySummary.byCategory[category] = addMoney(
        monthlySummary.byCategory[category] || 0,
        t.amount
      );
    } else {
      monthlySummary.totalCredits = addMoney(monthlySummary.totalCredits, t.amount);
    }
    monthlySummary.netAmount = roundMoney(
      monthlySummary.totalCredits - monthlySummary.totalSpending
    );
  }
  const monthlySummaries = Object.values(monthMap).sort((a, b) =>
    a.month.localeCompare(b.month)
  );
  const monthlyTrend = monthlySummaries.map((summary) => ({
    month: summary.month,
    spending: summary.totalSpending,
    income: summary.totalCredits,
  }));

  return {
    totalSpending,
    totalIncome,
    netCashFlow: roundMoney(totalIncome - totalSpending),
    byCategory,
    topMerchants,
    topTransactions,
    subscriptions,
    monthlyTrend,
    monthlySummaries,
  };
}
