import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRows } from "../lib/parser";
import {
  createDuplicateKey,
  normalizedTransactionSchema,
  validateNormalizedTransaction,
} from "../lib/transaction";
import type { NormalizedTransaction } from "../lib/types";

function validTransaction(
  overrides: Partial<NormalizedTransaction> = {}
): NormalizedTransaction {
  const transaction: NormalizedTransaction = {
    id: "txn-1",
    date: "2026-06-15",
    description: "Neighborhood Market",
    merchant: "NEIGHBORHOOD MARKET",
    amount: 42.19,
    type: "debit",
    isRecurring: false,
    source: {
      kind: "csv",
      fileName: "checking.csv",
      rowNumber: 2,
    },
    duplicateKey: "",
    ...overrides,
  };
  transaction.duplicateKey = createDuplicateKey(transaction);
  return transaction;
}

test("validates a transaction with all required fields", () => {
  const transaction = validTransaction();

  assert.deepEqual(validateNormalizedTransaction(transaction), transaction);
});

test("accepts optional category and source account identity", () => {
  const transaction = validTransaction({
    category: "Groceries",
    source: {
      kind: "csv",
      fileName: "checking.csv",
      rowNumber: 8,
      accountId: "checking-1234",
    },
  });

  assert.equal(validateNormalizedTransaction(transaction).category, "Groceries");
  assert.match(transaction.duplicateKey, /checking-1234/);
});

test("duplicate identity ignores CSV provenance but includes account identity", () => {
  const original = validTransaction();
  const copiedStatement = validTransaction({
    source: {
      kind: "csv",
      fileName: "checking-copy.csv",
      rowNumber: 99,
    },
  });
  const otherAccount = validTransaction({
    source: {
      kind: "csv",
      fileName: "checking.csv",
      rowNumber: 2,
      accountId: "savings-9876",
    },
  });

  assert.equal(original.duplicateKey, copiedStatement.duplicateKey);
  assert.notEqual(original.duplicateKey, otherAccount.duplicateKey);
});

test("reports clear errors for invalid required values", () => {
  const result = normalizedTransactionSchema.safeParse(
    validTransaction({
      date: "2026-02-30",
      description: " ",
      amount: 0,
    })
  );

  assert.equal(result.success, false);
  if (result.success) return;

  const errors = result.error.flatten().fieldErrors;
  assert.match(errors.date?.join(" ") ?? "", /valid calendar date/);
  assert.match(errors.description?.join(" ") ?? "", /required/);
  assert.match(errors.amount?.join(" ") ?? "", /greater than zero/);
});

test("rejects monetary amounts with more than two decimal places", () => {
  const result = normalizedTransactionSchema.safeParse(
    validTransaction({ amount: 12.345 })
  );

  assert.equal(result.success, false);
  if (result.success) return;
  assert.match(
    result.error.flatten().fieldErrors.amount?.join(" ") ?? "",
    /two decimal places/
  );
});

test("rejects signed normalized amounts because type carries debit or credit", () => {
  const result = normalizedTransactionSchema.safeParse(
    validTransaction({ amount: -12.34, type: "debit" })
  );

  assert.equal(result.success, false);
  if (result.success) return;
  assert.match(
    result.error.flatten().fieldErrors.amount?.join(" ") ?? "",
    /greater than zero/
  );
});

test("normalizes debit and credit CSV rows with source metadata", () => {
  const transactions = normalizeRows(
    [
      {
        Date: "06/14/2026",
        Description: "Coffee Shop",
        Debit: "5.25",
        Credit: "",
      },
      {
        Date: "06/15/2026",
        Description: "Payroll Deposit",
        Debit: "",
        Credit: "1500.00",
      },
    ],
    { fileName: "checking.csv", accountId: "checking-1234" }
  );

  assert.equal(transactions[0].type, "debit");
  assert.equal(transactions[0].amount, 5.25);
  assert.equal(transactions[0].source.rowNumber, 2);
  assert.equal(transactions[1].type, "credit");
  assert.equal(transactions[1].amount, 1500);
  assert.equal(transactions[1].source.rowNumber, 3);
});

test("normalizes paired debit amount and credit amount columns", () => {
  const transactions = normalizeRows(
    [
      {
        Date: "06/14/2026",
        Description: "Coffee Shop",
        "Debit Amount": "5.25",
        "Credit Amount": "",
      },
      {
        Date: "06/15/2026",
        Description: "Refund",
        "Debit Amount": "",
        "Credit Amount": "10.00",
      },
    ],
    { fileName: "checking.csv" }
  );

  assert.deepEqual(
    transactions.map(({ amount, type }) => ({ amount, type })),
    [
      { amount: 5.25, type: "debit" },
      { amount: 10, type: "credit" },
    ]
  );
});

test("rejects invalid CSV dates instead of inventing a date", () => {
  assert.throws(
    () =>
      normalizeRows(
        [{ Date: "", Description: "Coffee Shop", Amount: "5.25" }],
        { fileName: "checking.csv" }
      ),
    /CSV row 2: date:/
  );
});
