import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import Papa from "papaparse";
import { parseCsvUpload } from "../lib/csvImport";
import { normalizeRows } from "../lib/parser";
import {
  createDuplicateKey,
  normalizedTransactionSchema,
  validateNormalizedTransaction,
} from "../lib/transaction";
import type { NormalizedTransaction } from "../lib/types";

function parseCsvFixture(fileName: string): Record<string, string>[] {
  const csv = readFileSync(
    join(process.cwd(), "tests", "fixtures", "csv", fileName),
    "utf8"
  );
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  assert.deepEqual(result.errors, []);
  return result.data;
}

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

test("reports a missing CSV description as a required-field error", () => {
  assert.throws(
    () =>
      normalizeRows(
        [{ Date: "06/15/2026", Amount: "5.25" }],
        { fileName: "checking.csv" }
      ),
    /CSV is missing required column\(s\): description/
  );
});

test("reports a missing CSV amount as a required-field error", () => {
  assert.throws(
    () =>
      normalizeRows(
        [{ Date: "06/15/2026", Description: "Coffee Shop" }],
        { fileName: "checking.csv" }
      ),
    /CSV is missing required column\(s\): amount/
  );
});

test("parses a valid CSV upload into transactions and summary", () => {
  const result = parseCsvUpload({
    fileName: "checking.csv",
    size: 74,
    text: "Date,Description,Amount\n2026-06-01,Coffee Shop,-5.25\n2026-06-02,Payroll,100.00",
  });

  assert.deepEqual(
    result.transactions.map(({ date, description, amount, type }) => ({
      date,
      description,
      amount,
      type,
    })),
    [
      {
        date: "2026-06-01",
        description: "Coffee Shop",
        amount: 5.25,
        type: "debit",
      },
      {
        date: "2026-06-02",
        description: "Payroll",
        amount: 100,
        type: "credit",
      },
    ]
  );
  assert.equal(result.summary.totalSpending, 5.25);
  assert.equal(result.summary.totalIncome, 100);
});

test("parses quoted CSV fields with commas", () => {
  const result = parseCsvUpload({
    fileName: "quoted.csv",
    size: 62,
    text: 'Date,Description,Amount\n2026-06-05,"Synthetic Cafe, Downtown",-18.75',
  });

  assert.equal(result.transactions[0].description, "Synthetic Cafe, Downtown");
  assert.equal(result.transactions[0].merchant, "SYNTHETIC CAFE, DOWNTOWN");
  assert.equal(result.transactions[0].amount, 18.75);
});

test("rejects CSV uploads with missing required columns before rows", () => {
  assert.throws(
    () =>
      parseCsvUpload({
        fileName: "missing-columns.csv",
        size: 43,
        text: "Description,Amount\nCoffee Shop,-5.25",
      }),
    /CSV is missing required column\(s\): date/
  );
});

test("rejects malformed CSV rows with actionable row errors", () => {
  assert.throws(
    () =>
      parseCsvUpload({
        fileName: "bad-row.csv",
        size: 65,
        text: "Date,Description,Amount\n2026-06-01,Coffee Shop,-5.25,extra",
      }),
    /CSV row 2: row has more fields than the header/
  );
});

test("rejects malformed transaction row values with row numbers", () => {
  assert.throws(
    () =>
      parseCsvUpload({
        fileName: "bad-amount.csv",
        size: 57,
        text: "Date,Description,Amount\n2026-06-01,Coffee Shop,not-money",
      }),
    /CSV row 2: amount: must be a supported monetary value/
  );
});

test("rejects empty CSV uploads", () => {
  assert.throws(
    () =>
      parseCsvUpload({
        fileName: "empty.csv",
        size: 0,
        text: "",
      }),
    /CSV file is empty/
  );
});

test("rejects non-CSV uploads", () => {
  assert.throws(
    () =>
      parseCsvUpload({
        fileName: "statement.txt",
        size: 40,
        text: "Date,Description,Amount\n2026-06-01,Coffee,-5.25",
      }),
    /Only CSV files are supported/
  );
});

test("sample standard transaction fixture normalizes supported MVP CSV shape", () => {
  const transactions = normalizeRows(
    parseCsvFixture("standard-valid-transactions.csv"),
    { fileName: "standard-valid-transactions.csv" }
  );

  assert.deepEqual(
    transactions.map(({ date, type, amount }) => ({ date, type, amount })),
    [
      { date: "2026-06-01", type: "debit", amount: 42.19 },
      { date: "2026-06-02", type: "credit", amount: 2500 },
      { date: "2026-06-03", type: "debit", amount: 12.99 },
      { date: "2026-06-04", type: "debit", amount: 88.4 },
    ]
  );
});

test("sample edge-case fixture covers quoted merchants and debit-credit columns", () => {
  const transactions = normalizeRows(
    parseCsvFixture("edge-case-transactions.csv"),
    { fileName: "edge-case-transactions.csv" }
  );

  assert.deepEqual(
    transactions.map(({ date, merchant, type, amount }) => ({
      date,
      merchant,
      type,
      amount,
    })),
    [
      {
        date: "2026-06-05",
        merchant: "SYNTHETIC CAFE, DOWNTOWN",
        type: "debit",
        amount: 18.75,
      },
      {
        date: "2026-06-06",
        merchant: "FICTIONAL MARKET, STALL 12",
        type: "debit",
        amount: 64.2,
      },
      {
        date: "2026-06-07",
        merchant: "SYNTHETIC REFUND COUNTER",
        type: "credit",
        amount: 15,
      },
      {
        date: "2026-06-08",
        merchant: "SYNTHETIC DIRECT DEPOSIT",
        type: "credit",
        amount: 125.5,
      },
    ]
  );
});

test("sample malformed fixture raises parser validation errors", () => {
  assert.throws(
    () =>
      normalizeRows(parseCsvFixture("malformed-missing-required-fields.csv"), {
        fileName: "malformed-missing-required-fields.csv",
      }),
    /CSV row 3: date: must use YYYY-MM-DD format; date: must be a valid calendar date; description: is required; merchant: is required/
  );
});
