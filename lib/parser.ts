import type { NormalizedTransaction } from "./types";
import { categorize, cleanMerchant, isLikelyRecurring } from "./categorize";
import {
  createDuplicateKey,
  formatTransactionValidationError,
  normalizedTransactionSchema,
  transactionTypeForAmountColumn,
} from "./transaction";

interface RawRow {
  [key: string]: string;
}

function findColumn(row: RawRow, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const match = keys.find((k) => k.toLowerCase().trim() === c.toLowerCase());
    if (match) return match;
  }
  return undefined;
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
  sourceOptions: CsvSourceOptions
): NormalizedTransaction[] {
  if (!rows.length) return [];

  const sample = rows[0];

  const dateCol = findColumn(sample, [
    "date",
    "transaction date",
    "posted date",
    "trans date",
    "posting date",
  ]);
  const descCol = findColumn(sample, [
    "description",
    "transaction description",
    "memo",
    "name",
    "merchant",
    "payee",
  ]);
  const amountCol = findColumn(sample, [
    "amount",
    "transaction amount",
    "charge amount",
  ]);
  const debitCol = findColumn(sample, ["debit", "debit amount", "withdrawal", "withdrawals"]);
  const creditCol = findColumn(sample, ["credit", "credit amount", "deposit", "deposits"]);

  return rows.map((row, index): NormalizedTransaction => {
    const rawDesc = descCol ? row[descCol] || "" : "";
    const merchant = cleanMerchant(rawDesc);
    const category = categorize(rawDesc);

    let amount = 0;
    let type: "debit" | "credit" = "debit";

    if (amountCol) {
      const raw = parseAmount(row[amountCol]);
      if (raw === undefined) {
        amount = 0;
      } else if (raw < 0) {
        amount = Math.abs(raw);
        type = "debit";
      } else {
        amount = raw;
        type = transactionTypeForAmountColumn(raw, rawDesc);
      }
    } else if (debitCol || creditCol) {
      const debit = debitCol ? Math.abs(parseAmount(row[debitCol]) ?? 0) : 0;
      const credit = creditCol ? Math.abs(parseAmount(row[creditCol]) ?? 0) : 0;
      if (debit > 0) {
        amount = debit;
        type = "debit";
      } else {
        amount = credit;
        type = "credit";
      }
    }

    if (category === "Income") type = "credit";

    const transaction = {
      id: uid(),
      date: parseDate(dateCol ? row[dateCol] : undefined),
      description: rawDesc.trim(),
      merchant,
      amount,
      type,
      category:
        type === "credit" && category === "Unknown"
          ? ("Income" as const)
          : category === "Unknown"
            ? undefined
            : category,
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
      throw new Error(
        `CSV row ${index + 2}: ${formatTransactionValidationError(result.error)}`
      );
    }
    return result.data;
  });
}

export function computeSummary(txns: NormalizedTransaction[]) {
  const spending = txns.filter((t) => t.type === "debit");
  const income = txns.filter((t) => t.type === "credit");

  const totalSpending = spending.reduce((s, t) => s + t.amount, 0);
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);

  const byCategory: Record<string, number> = {};
  for (const t of spending) {
    const category = t.category ?? "Unknown";
    byCategory[category] = (byCategory[category] || 0) + t.amount;
  }

  const merchantMap: Record<string, number> = {};
  for (const t of spending) {
    merchantMap[t.merchant] = (merchantMap[t.merchant] || 0) + t.amount;
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

  const monthMap: Record<string, { spending: number; income: number }> = {};
  for (const t of txns) {
    const month = t.date.slice(0, 7);
    if (!monthMap[month]) monthMap[month] = { spending: 0, income: 0 };
    if (t.type === "debit") monthMap[month].spending += t.amount;
    else monthMap[month].income += t.amount;
  }
  const monthlyTrend = Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, ...v }));

  return {
    totalSpending,
    totalIncome,
    netCashFlow: totalIncome - totalSpending,
    byCategory,
    topMerchants,
    topTransactions,
    subscriptions,
    monthlyTrend,
  };
}
