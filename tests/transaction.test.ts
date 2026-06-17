import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import Papa from "papaparse";
import {
  CREDIT_FALLBACK_CATEGORY,
  DEBIT_FALLBACK_CATEGORY,
  categorizeTransaction,
} from "../lib/categorize";
import { parseCsvUpload } from "../lib/csvImport";
import { computeSummary, normalizeRows } from "../lib/parser";
import {
  DEFAULT_RECURRING_PAYMENT_OPTIONS,
  detectRecurringPaymentCandidates,
} from "../lib/recurring";
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

test("computes an empty spending summary for empty input", () => {
  const summary = computeSummary([]);

  assert.equal(summary.totalSpending, 0);
  assert.equal(summary.totalIncome, 0);
  assert.equal(summary.netCashFlow, 0);
  assert.deepEqual(summary.byCategory, {});
  assert.deepEqual(summary.monthlyTrend, []);
  assert.deepEqual(summary.monthlySummaries, []);
});

test("computes monthly summaries across months, categories, credits, and boundaries", () => {
  const transactions = [
    validTransaction({
      id: "txn-jan-rent",
      date: "2026-01-01",
      description: "January Rent",
      merchant: "JANUARY RENT",
      amount: 1200,
      category: "Rent & Housing",
      type: "debit",
    }),
    validTransaction({
      id: "txn-jan-grocery",
      date: "2026-01-31",
      description: "January Market",
      merchant: "JANUARY MARKET",
      amount: 45.25,
      category: "Groceries",
      type: "debit",
    }),
    validTransaction({
      id: "txn-jan-payroll",
      date: "2026-01-15",
      description: "January Payroll",
      merchant: "JANUARY PAYROLL",
      amount: 2500,
      category: "Income",
      type: "credit",
    }),
    validTransaction({
      id: "txn-feb-uncategorized",
      date: "2026-02-01",
      description: "Mystery Vendor",
      merchant: "MYSTERY VENDOR",
      amount: 30,
      type: "debit",
      category: undefined,
    }),
    validTransaction({
      id: "txn-feb-refund",
      date: "2026-02-28",
      description: "Refund Counter",
      merchant: "REFUND COUNTER",
      amount: 10,
      category: "Income",
      type: "credit",
    }),
  ];

  const summary = computeSummary(transactions);

  assert.deepEqual(summary.monthlySummaries, [
    {
      month: "2026-01",
      totalSpending: 1245.25,
      totalCredits: 2500,
      netAmount: 1254.75,
      byCategory: {
        "Rent & Housing": 1200,
        Groceries: 45.25,
      },
    },
    {
      month: "2026-02",
      totalSpending: 30,
      totalCredits: 10,
      netAmount: -20,
      byCategory: {
        Unknown: 30,
      },
    },
  ]);
  assert.deepEqual(summary.monthlyTrend, [
    { month: "2026-01", spending: 1245.25, income: 2500 },
    { month: "2026-02", spending: 30, income: 10 },
  ]);
});

test("detects recurring merchant candidates across regular monthly charges", () => {
  const transactions = [
    validTransaction({
      id: "stream-jan",
      date: "2026-01-05",
      description: "Streambox",
      merchant: "STREAMBOX",
      amount: 12.99,
    }),
    validTransaction({
      id: "stream-feb",
      date: "2026-02-05",
      description: "Streambox",
      merchant: "STREAMBOX",
      amount: 12.99,
    }),
    validTransaction({
      id: "stream-mar",
      date: "2026-03-06",
      description: "Streambox",
      merchant: "STREAMBOX",
      amount: 12.99,
    }),
    validTransaction({
      id: "one-time",
      date: "2026-03-10",
      description: "Gadget Shop",
      merchant: "GADGET SHOP",
      amount: 199,
    }),
  ];

  const candidates = detectRecurringPaymentCandidates(transactions);

  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0], {
    normalizedMerchant: "STREAMBOX",
    representativeAmount: 12.99,
    occurrenceCount: 3,
    confidence: "high",
    rationale:
      "3 similar debit charges across 3 months; representative amount $12.99; amount tolerance +/-$2.00; date tolerance +/-6 days",
    firstDate: "2026-01-05",
    lastDate: "2026-03-06",
  });
});

test("recurring detector accepts configured amount variation", () => {
  const transactions = [
    validTransaction({
      id: "storage-jan",
      date: "2026-01-12",
      merchant: "CLOUD STORAGE",
      amount: 20,
    }),
    validTransaction({
      id: "storage-feb",
      date: "2026-02-12",
      merchant: "CLOUD STORAGE",
      amount: 21.5,
    }),
    validTransaction({
      id: "storage-mar",
      date: "2026-03-13",
      merchant: "CLOUD STORAGE",
      amount: 19.75,
    }),
  ];

  const candidates = detectRecurringPaymentCandidates(transactions, {
    maxAmountVarianceDollars: 2,
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].normalizedMerchant, "CLOUD STORAGE");
  assert.equal(candidates[0].representativeAmount, 20);
  assert.equal(candidates[0].occurrenceCount, 3);
  assert.equal(candidates[0].confidence, "high");
});

test("recurring detector marks skipped months as medium confidence candidates", () => {
  const transactions = [
    validTransaction({
      id: "news-jan",
      date: "2026-01-08",
      merchant: "DAILY NEWS",
      amount: 9.99,
    }),
    validTransaction({
      id: "news-mar",
      date: "2026-03-08",
      merchant: "DAILY NEWS",
      amount: 9.99,
    }),
    validTransaction({
      id: "news-apr",
      date: "2026-04-09",
      merchant: "DAILY NEWS",
      amount: 9.99,
    }),
  ];

  const candidates = detectRecurringPaymentCandidates(transactions);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].confidence, "medium");
  assert.match(candidates[0].rationale, /1 skipped month/);
});

test("irregular repeated purchases are not high-confidence candidates", () => {
  const transactions = [
    validTransaction({
      id: "hobby-jan",
      date: "2026-01-03",
      merchant: "HOBBY SUPPLY",
      amount: 40,
    }),
    validTransaction({
      id: "hobby-feb",
      date: "2026-02-24",
      merchant: "HOBBY SUPPLY",
      amount: 41,
    }),
    validTransaction({
      id: "hobby-apr",
      date: "2026-04-11",
      merchant: "HOBBY SUPPLY",
      amount: 39.5,
    }),
  ];

  const candidates = detectRecurringPaymentCandidates(transactions);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].confidence, "low");
  assert.match(candidates[0].rationale, /irregular interval/);
});

test("credits and refunds do not create recurring candidates", () => {
  const transactions = [
    validTransaction({
      id: "refund-jan",
      date: "2026-01-15",
      merchant: "REFUND COUNTER",
      amount: 15,
      type: "credit",
    }),
    validTransaction({
      id: "refund-feb",
      date: "2026-02-15",
      merchant: "REFUND COUNTER",
      amount: 15,
      type: "credit",
    }),
    validTransaction({
      id: "refund-mar",
      date: "2026-03-15",
      merchant: "REFUND COUNTER",
      amount: 15,
      type: "credit",
    }),
  ];

  assert.deepEqual(detectRecurringPaymentCandidates(transactions), []);
});

test("insufficient history does not create recurring candidates", () => {
  const transactions = [
    validTransaction({
      id: "music-jan",
      date: "2026-01-01",
      merchant: "MUSIC APP",
      amount: 10.99,
    }),
    validTransaction({
      id: "music-feb",
      date: "2026-02-01",
      merchant: "MUSIC APP",
      amount: 10.99,
    }),
  ];

  const candidates = detectRecurringPaymentCandidates(transactions);

  assert.equal(DEFAULT_RECURRING_PAYMENT_OPTIONS.minOccurrences, 3);
  assert.deepEqual(candidates, []);
});

test("spending summaries include recurring candidates instead of category-only matches", () => {
  const transactions = [
    validTransaction({
      id: "membership-jan",
      date: "2026-01-02",
      merchant: "FIT CLUB",
      amount: 35,
      category: "Subscriptions",
      isRecurring: true,
    }),
    validTransaction({
      id: "membership-feb",
      date: "2026-02-02",
      merchant: "FIT CLUB",
      amount: 35,
      category: "Subscriptions",
      isRecurring: true,
    }),
    validTransaction({
      id: "single-subscription-keyword",
      date: "2026-02-20",
      merchant: "ONE TIME SOFTWARE",
      amount: 99,
      category: "Subscriptions",
      isRecurring: true,
    }),
    validTransaction({
      id: "membership-mar",
      date: "2026-03-02",
      merchant: "FIT CLUB",
      amount: 35,
      category: "Subscriptions",
      isRecurring: true,
    }),
  ];

  const summary = computeSummary(transactions);

  assert.deepEqual(
    summary.subscriptions.map((candidate) => candidate.normalizedMerchant),
    ["FIT CLUB"]
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

test("categorization rules match normalized merchant text and descriptions", () => {
  const category = categorizeTransaction(
    {
      description: "POS #4271 Northside Books",
      merchant: "NORTHSIDE BOOKS",
      type: "debit",
    },
    [
      {
        id: "local-bookshop",
        category: "Shopping",
        transactionType: "debit",
        matchers: [
          { field: "merchant", operator: "equals", value: "northside books" },
          { field: "description", operator: "contains", value: "#4271" },
        ],
      },
    ]
  );

  assert.equal(category, "Shopping");
});

test("categorization normalizes case and whitespace for string operators", () => {
  const category = categorizeTransaction(
    {
      description: "  Monthly   Subscription  ",
      merchant: "ACME SERVICES",
      type: "debit",
    },
    [
      {
        id: "subscription-prefix",
        category: "Subscriptions",
        matchers: [
          {
            field: "description",
            operator: "startsWith",
            value: "monthly subscription",
          },
        ],
      },
    ]
  );

  assert.equal(category, "Subscriptions");
});

test("categorization uses deterministic first-match precedence", () => {
  const rules = [
    {
      id: "amazon-prime-subscription",
      category: "Subscriptions" as const,
      matchers: [
        { field: "description" as const, operator: "contains" as const, value: "amazon" },
      ],
    },
    {
      id: "amazon-shopping",
      category: "Shopping" as const,
      matchers: [
        { field: "merchant" as const, operator: "contains" as const, value: "amazon" },
      ],
    },
  ];

  assert.equal(
    categorizeTransaction(
      {
        description: "Amazon Prime Renewal",
        merchant: "AMAZON",
        type: "debit",
      },
      rules
    ),
    "Subscriptions"
  );
});

test("categorization falls back for unmatched debits and credits", () => {
  assert.equal(
    categorizeTransaction({
      description: "Unlisted Corner Store",
      merchant: "UNLISTED CORNER STORE",
      type: "debit",
    }),
    DEBIT_FALLBACK_CATEGORY
  );
  assert.equal(
    categorizeTransaction({
      description: "Miscellaneous Reversal",
      merchant: "MISCELLANEOUS REVERSAL",
      type: "credit",
    }),
    CREDIT_FALLBACK_CATEGORY
  );
});

test("normalization keeps original descriptions unchanged when categorizing", () => {
  const transactions = normalizeRows(
    [
      {
        Date: "06/14/2026",
        Description: "  sTaRbUcKs Store #1234  ",
        Amount: "-5.25",
      },
      {
        Date: "06/15/2026",
        Description: "Unmatched Vendor",
        Amount: "-10.00",
      },
    ],
    { fileName: "checking.csv" }
  );

  assert.equal(transactions[0].description, "sTaRbUcKs Store #1234");
  assert.equal(transactions[0].category, "Food & Dining");
  assert.equal(transactions[1].description, "Unmatched Vendor");
  assert.equal(transactions[1].category, "Unknown");
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
