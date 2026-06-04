import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("fileId");
  const category = searchParams.get("category");
  const type = searchParams.get("type");

  if (!fileId) {
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  }

  const db = getDb();

  let query = "SELECT * FROM transactions WHERE file_id = ?";
  const params: (string | number)[] = [fileId];

  if (category) {
    query += " AND category = ?";
    params.push(category);
  }
  if (type) {
    query += " AND transaction_type = ?";
    params.push(type);
  }

  query += " ORDER BY date DESC";

  const rows = db.prepare(query).all(...params);
  return NextResponse.json({ transactions: rows });
}
