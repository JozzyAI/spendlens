import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { normalizeRows, computeSummary } from "@/lib/parser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ error: "Only CSV files are supported" }, { status: 415 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "CSV files must be 5 MB or smaller" }, { status: 413 });
    }

    const text = await file.text();
    const { data, errors, meta } = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    if (errors.length > 0 && data.length === 0) {
      return NextResponse.json({ error: "Failed to parse CSV" }, { status: 400 });
    }
    if (!meta.fields?.length) {
      return NextResponse.json({ error: "CSV must include a header row" }, { status: 400 });
    }

    const transactions = normalizeRows(data);
    if (transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions found. Include date, description, and amount columns." },
        { status: 400 }
      );
    }
    const summary = computeSummary(transactions);

    return NextResponse.json({ transactions, summary });
  } catch {
    return NextResponse.json({ error: "Unable to read the uploaded CSV" }, { status: 400 });
  }
}
