import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "spendlens.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      row_count INTEGER DEFAULT 0,
      uploaded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      date TEXT NOT NULL,
      raw_description TEXT NOT NULL,
      cleaned_merchant TEXT,
      amount REAL NOT NULL,
      transaction_type TEXT NOT NULL CHECK(transaction_type IN ('debit','credit')),
      category TEXT DEFAULT 'Unknown',
      subcategory TEXT,
      is_recurring INTEGER DEFAULT 0,
      confidence_score REAL DEFAULT 1.0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (file_id) REFERENCES uploaded_files(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS monthly_summaries (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      month TEXT NOT NULL,
      total_income REAL DEFAULT 0,
      total_spending REAL DEFAULT 0,
      net_cashflow REAL DEFAULT 0,
      top_categories_json TEXT,
      top_merchants_json TEXT,
      ai_summary TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (file_id) REFERENCES uploaded_files(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_file_id ON transactions(file_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_monthly_file ON monthly_summaries(file_id);
  `);
}
