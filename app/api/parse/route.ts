import { NextRequest, NextResponse } from "next/server";
import { parseCsvUpload } from "@/lib/csvImport";
import { CsvImportError } from "@/lib/parser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const data = parseCsvUpload({
      fileName: file.name,
      size: file.size,
      text,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof CsvImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Unable to import CSV. Check the file format and try again." },
      { status: 400 }
    );
  }
}
