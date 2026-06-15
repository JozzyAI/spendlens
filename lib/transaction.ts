import { z } from "zod";
import type { NormalizedTransaction, TransactionType } from "./types";

const CATEGORY_VALUES = [
  "Food & Dining",
  "Groceries",
  "Rent & Housing",
  "Transportation",
  "Shopping",
  "Subscriptions",
  "Travel",
  "Health",
  "Utilities",
  "Cash & Transfers",
  "Income",
  "Unknown",
] as const;

const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must use YYYY-MM-DD format")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }, "must be a valid calendar date");

const moneySchema = z
  .number()
  .finite("must be a finite number")
  .positive("must be greater than zero")
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
    "must have no more than two decimal places"
  );

const transactionSchemaBase = z.object({
  id: z.string().trim().min(1, "is required"),
  date: calendarDateSchema,
  description: z.string().trim().min(1, "is required"),
  merchant: z.string().trim().min(1, "is required"),
  amount: moneySchema,
  type: z.enum(["debit", "credit"]),
  category: z.enum(CATEGORY_VALUES).optional(),
  isRecurring: z.boolean(),
  source: z.object({
    kind: z.literal("csv"),
    fileName: z.string().trim().min(1, "is required"),
    rowNumber: z.number().int().min(2, "must identify a CSV data row"),
    accountId: z.string().trim().min(1, "cannot be blank").optional(),
  }),
  duplicateKey: z.string().min(1, "is required"),
});

export const normalizedTransactionSchema = transactionSchemaBase.superRefine(
  (transaction, context) => {
    const expectedKey = createDuplicateKey(transaction);
    if (transaction.duplicateKey !== expectedKey) {
      context.addIssue({
        code: "custom",
        path: ["duplicateKey"],
        message: "must match the transaction duplicate identity fields",
      });
    }
  }
);

type DuplicateIdentity = Pick<
  NormalizedTransaction,
  "date" | "description" | "amount" | "type"
> & {
  source: Pick<NormalizedTransaction["source"], "accountId">;
};

export function createDuplicateKey(transaction: DuplicateIdentity): string {
  const normalizedDescription = transaction.description
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return JSON.stringify([
    transaction.date,
    normalizedDescription,
    transaction.amount.toFixed(2),
    transaction.type,
    transaction.source.accountId ?? null,
  ]);
}

export function validateNormalizedTransaction(input: unknown): NormalizedTransaction {
  return normalizedTransactionSchema.parse(input);
}

export function formatTransactionValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "transaction"}: ${issue.message}`)
    .join("; ");
}

export function transactionTypeForAmountColumn(
  amount: number,
  description: string
): TransactionType {
  if (amount < 0) return "debit";
  return /\b(payroll|direct dep|salary|paycheck|deposit)\b/i.test(description)
    ? "credit"
    : "debit";
}
