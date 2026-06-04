import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { parseCSV } from "@/lib/parsers/csv-parser";
import { categorizeTransactions, detectRecurring } from "@/lib/categorizer";
import { getDb } from "@/lib/db/schema";

export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ error: "Only CSV files are supported" }, { status: 400 });
    }

    const content = await file.text();
    const parsed = parseCSV(content);

    if (parsed.length === 0) {
      return NextResponse.json({ error: "No valid transactions found in CSV" }, { status: 400 });
    }

    const categorized = detectRecurring(categorizeTransactions(parsed));

    const db = getDb();
    const fileId = uuidv4();

    const insertFile = db.prepare(
      "INSERT INTO uploaded_files (id, filename, original_name, row_count) VALUES (?, ?, ?, ?)"
    );
    const insertTx = db.prepare(
      `INSERT INTO transactions (id, file_id, date, raw_description, cleaned_merchant, amount, transaction_type, category, subcategory, is_recurring, confidence_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertMany = db.transaction((fileId: string, txs: typeof categorized) => {
      insertFile.run(fileId, file.name, file.name, txs.length);
      for (const tx of txs) {
        insertTx.run(
          uuidv4(),
          fileId,
          tx.date,
          tx.rawDescription,
          tx.cleanedMerchant,
          tx.amount,
          tx.transactionType,
          tx.category,
          null,
          tx.isRecurring ? 1 : 0,
          tx.confidenceScore
        );
      }
    });

    insertMany(fileId, categorized);

    return NextResponse.json({
      fileId,
      rowCount: categorized.length,
      filename: file.name,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
