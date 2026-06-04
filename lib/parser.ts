import type { NormalizedTransaction } from "./types";
import { categorize, cleanMerchant, isLikelyRecurring } from "./categorize";

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

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/[$,\s]/g, "")) || 0;
}

function parseDate(raw: string | undefined): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const d = new Date(raw.trim());
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return raw.trim();
}

let idCounter = 0;
function uid(): string {
  return `txn-${Date.now()}-${idCounter++}`;
}

export function normalizeRows(rows: RawRow[]): NormalizedTransaction[] {
  if (!rows.length) return [];

  const sample = rows[0];

  const dateCol = findColumn(sample, ["date", "transaction date", "posted date", "trans date", "posting date"]);
  const descCol = findColumn(sample, ["description", "transaction description", "memo", "name", "merchant", "payee"]);
  const amountCol = findColumn(sample, ["amount", "transaction amount", "debit amount", "credit amount", "charge amount"]);
  const debitCol = findColumn(sample, ["debit", "debit amount", "withdrawal", "withdrawals"]);
  const creditCol = findColumn(sample, ["credit", "credit amount", "deposit", "deposits"]);

  return rows
    .filter((row) => {
      const rawDesc = descCol ? row[descCol] : "";
      return rawDesc && rawDesc.trim().length > 0;
    })
    .map((row): NormalizedTransaction => {
      const rawDesc = descCol ? (row[descCol] || "") : Object.values(row).find((v) => v && v.length > 3) || "";
      const merchant = cleanMerchant(rawDesc);
      const category = categorize(rawDesc);

      let amount = 0;
      let type: "debit" | "credit" = "debit";

      if (amountCol) {
        const raw = parseAmount(row[amountCol]);
        if (raw < 0) {
          amount = Math.abs(raw);
          type = "debit";
        } else {
          amount = raw;
          const cat = categorize(rawDesc);
          type = cat === "Income" ? "credit" : "debit";
        }
      } else if (debitCol || creditCol) {
        const debit = debitCol ? parseAmount(row[debitCol]) : 0;
        const credit = creditCol ? parseAmount(row[creditCol]) : 0;
        if (debit > 0) {
          amount = debit;
          type = "debit";
        } else {
          amount = credit;
          type = "credit";
        }
      }

      if (category === "Income") type = "credit";

      return {
        id: uid(),
        date: parseDate(dateCol ? row[dateCol] : undefined),
        description: rawDesc.trim(),
        merchant,
        amount,
        type,
        category: type === "credit" && category === "Unknown" ? "Income" : category,
        isRecurring: isLikelyRecurring(rawDesc, category),
      };
    })
    .filter((t) => t.amount > 0);
}

export function computeSummary(txns: NormalizedTransaction[]) {
  const spending = txns.filter((t) => t.type === "debit");
  const income = txns.filter((t) => t.type === "credit");

  const totalSpending = spending.reduce((s, t) => s + t.amount, 0);
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);

  const byCategory: Record<string, number> = {};
  for (const t of spending) {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
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
  const subscriptions = txns.filter((t) => t.isRecurring && t.type === "debit");

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
