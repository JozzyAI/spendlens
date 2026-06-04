import { categorizeByRules, extractMerchantName, type Category } from "./rules";
import { NormalizedTransaction } from "../parsers/csv-parser";

export interface CategorizedTransaction extends NormalizedTransaction {
  category: Category;
  cleanedMerchant: string;
  isRecurring: boolean;
  confidenceScore: number;
}

export function categorizeTransactions(transactions: NormalizedTransaction[]): CategorizedTransaction[] {
  return transactions.map((tx) => {
    const result = categorizeByRules(tx.rawDescription);

    const category: Category = result?.category ?? "Unknown";
    const cleanedMerchant = result?.merchant ?? extractMerchantName(tx.rawDescription);
    const confidenceScore = result ? 1.0 : 0.5;

    return {
      ...tx,
      cleanedMerchant,
      category,
      isRecurring: false,
      confidenceScore,
    };
  });
}

export function detectRecurring(transactions: CategorizedTransaction[]): CategorizedTransaction[] {
  // Group by merchant and find those that appear monthly (approximately every 28-35 days)
  const byMerchant = new Map<string, CategorizedTransaction[]>();

  for (const tx of transactions) {
    if (tx.transactionType !== "debit") continue;
    const key = tx.cleanedMerchant.toLowerCase();
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push(tx);
  }

  const recurringMerchants = new Set<string>();

  for (const [merchant, txs] of byMerchant) {
    if (txs.length >= 2) {
      // Check if amounts are similar (within 10%)
      const amounts = txs.map((t) => t.amount);
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const allSimilar = amounts.every((a) => Math.abs(a - avgAmount) / avgAmount < 0.15);

      if (allSimilar) {
        recurringMerchants.add(merchant);
      }
    }
  }

  return transactions.map((tx) => ({
    ...tx,
    isRecurring: recurringMerchants.has(tx.cleanedMerchant.toLowerCase()) && tx.transactionType === "debit",
  }));
}

export type { Category };
