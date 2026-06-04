import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { normalizeRows, computeSummary } from "@/lib/parser";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const text = await file.text();
  const { data, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (errors.length > 0 && data.length === 0) {
    return NextResponse.json({ error: "Failed to parse CSV" }, { status: 400 });
  }

  const transactions = normalizeRows(data);
  const summary = computeSummary(transactions);

  return NextResponse.json({ transactions, summary });
}
