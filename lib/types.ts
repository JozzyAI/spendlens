export type TransactionType = "debit" | "credit";

export type Category =
  | "Food & Dining"
  | "Groceries"
  | "Rent & Housing"
  | "Transportation"
  | "Shopping"
  | "Subscriptions"
  | "Travel"
  | "Health"
  | "Utilities"
  | "Cash & Transfers"
  | "Income"
  | "Unknown";

export interface NormalizedTransaction {
  id: string;
  date: string;
  description: string;
  merchant: string;
  amount: number;
  type: TransactionType;
  category?: Category;
  isRecurring: boolean;
  source: TransactionSource;
  duplicateKey: string;
}

export interface TransactionSource {
  kind: "csv";
  fileName: string;
  rowNumber: number;
  accountId?: string;
}

export interface SpendingSummary {
  totalSpending: number;
  totalIncome: number;
  netCashFlow: number;
  byCategory: Record<string, number>;
  topMerchants: { merchant: string; total: number }[];
  topTransactions: NormalizedTransaction[];
  subscriptions: NormalizedTransaction[];
  monthlyTrend: { month: string; spending: number; income: number }[];
  monthlySummaries: MonthlySpendingSummary[];
  aiSummary?: string;
}

export interface MonthlySpendingSummary {
  month: string;
  totalSpending: number;
  totalCredits: number;
  netAmount: number;
  byCategory: Record<string, number>;
}
