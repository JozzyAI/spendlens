import Papa from "papaparse";
import {
  CsvImportError,
  computeSummary,
  normalizeRows,
  resolveCsvColumns,
} from "./parser";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

interface CsvUploadInput {
  fileName: string;
  size: number;
  text: string;
  accountId?: string;
}

function csvParseErrorMessage(error: Papa.ParseError): string {
  const rowNumber = typeof error.row === "number" ? error.row + 2 : undefined;
  const location = rowNumber ? `CSV row ${rowNumber}` : "CSV";

  if (error.code === "TooFewFields") {
    return `${location}: row has fewer fields than the header.`;
  }
  if (error.code === "TooManyFields") {
    return `${location}: row has more fields than the header.`;
  }
  if (error.code === "UndetectableDelimiter") {
    return "CSV delimiter could not be detected. Use a comma-delimited CSV file.";
  }

  return `${location}: malformed CSV data.`;
}

export function parseCsvUpload(input: CsvUploadInput) {
  if (!input.fileName.toLowerCase().endsWith(".csv")) {
    throw new CsvImportError("Only CSV files are supported.", 415);
  }
  if (input.size === 0 || input.text.trim().length === 0) {
    throw new CsvImportError("CSV file is empty.");
  }
  if (input.size > MAX_CSV_BYTES) {
    throw new CsvImportError("CSV files must be 5 MB or smaller.", 413);
  }

  const parsed = Papa.parse<Record<string, string>>(input.text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    throw new CsvImportError(csvParseErrorMessage(parsed.errors[0]));
  }

  const columns = resolveCsvColumns(parsed.meta.fields);
  if (parsed.data.length === 0) {
    throw new CsvImportError("CSV must include at least one transaction row.");
  }

  const transactions = normalizeRows(
    parsed.data,
    { fileName: input.fileName, accountId: input.accountId },
    columns
  );

  if (transactions.length === 0) {
    throw new CsvImportError("CSV must include at least one transaction row.");
  }

  return {
    transactions,
    summary: computeSummary(transactions),
  };
}
