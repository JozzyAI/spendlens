import { parse } from "csv-parse/sync";

export interface NormalizedTransaction {
  id: string;
  date: string;
  rawDescription: string;
  cleanedMerchant: string | null;
  amount: number;
  transactionType: "debit" | "credit";
  balance?: number;
}

interface RawRow {
  [key: string]: string;
}

// Column name aliases for different bank CSV formats
const DATE_ALIASES = ["date", "transaction date", "posting date", "trans date", "posted date", "value date"];
const DESC_ALIASES = ["description", "memo", "transaction description", "details", "payee", "merchant name", "narrative", "particulars"];
const AMOUNT_ALIASES = ["amount", "transaction amount", "debit/credit", "value"];
const DEBIT_ALIASES = ["debit", "debit amount", "withdrawal", "withdrawal amount", "out", "charge"];
const CREDIT_ALIASES = ["credit", "credit amount", "deposit", "deposit amount", "in", "payment"];
const BALANCE_ALIASES = ["balance", "running balance", "account balance"];

function findCol(headers: string[], aliases: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lower.findIndex((h) => h === alias || h.includes(alias));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function parseAmount(val: string): number {
  if (!val || val.trim() === "") return 0;
  const cleaned = val.replace(/[$,\s]/g, "").replace(/[()]/g, (m) => (m === "(" ? "-" : ""));
  return parseFloat(cleaned) || 0;
}

function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  // Try ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  // Try MM/DD/YYYY or MM-DD-YYYY
  const mdy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (mdy) {
    const year = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    return `${year}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }
  // Fallback: return as-is
  return trimmed;
}

export function parseCSV(content: string): NormalizedTransaction[] {
  const rows: RawRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  });

  if (rows.length === 0) throw new Error("CSV file is empty");

  const headers = Object.keys(rows[0]);
  const dateCol = findCol(headers, DATE_ALIASES);
  const descCol = findCol(headers, DESC_ALIASES);
  const amountCol = findCol(headers, AMOUNT_ALIASES);
  const debitCol = findCol(headers, DEBIT_ALIASES);
  const creditCol = findCol(headers, CREDIT_ALIASES);
  const balanceCol = findCol(headers, BALANCE_ALIASES);

  if (!dateCol || !descCol) {
    throw new Error(
      `Could not identify required columns. Found: ${headers.join(", ")}. Need date and description columns.`
    );
  }

  const transactions: NormalizedTransaction[] = [];
  let idCounter = 0;

  for (const row of rows) {
    const rawDate = row[dateCol] || "";
    const rawDesc = row[descCol] || "";

    if (!rawDate.trim() || !rawDesc.trim()) continue;

    let amount = 0;
    let type: "debit" | "credit" = "debit";

    if (amountCol) {
      amount = parseAmount(row[amountCol]);
      if (amount < 0) {
        type = "debit";
        amount = Math.abs(amount);
      } else {
        // Many banks: positive = credit, negative = debit. But some banks do opposite.
        // Default: positive = credit unless it's a statement with only debits
        type = "credit";
      }
    } else if (debitCol || creditCol) {
      const debitAmt = debitCol ? parseAmount(row[debitCol]) : 0;
      const creditAmt = creditCol ? parseAmount(row[creditCol]) : 0;
      if (debitAmt > 0) {
        amount = debitAmt;
        type = "debit";
      } else if (creditAmt > 0) {
        amount = creditAmt;
        type = "credit";
      }
    }

    if (amount === 0) continue;

    const balance = balanceCol ? parseAmount(row[balanceCol]) : undefined;

    transactions.push({
      id: `t_${++idCounter}`,
      date: normalizeDate(rawDate),
      rawDescription: rawDesc,
      cleanedMerchant: null,
      amount,
      transactionType: type,
      balance,
    });
  }

  return transactions;
}
