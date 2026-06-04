import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/schema";
import Anthropic from "@anthropic-ai/sdk";

interface Transaction {
  date: string;
  cleaned_merchant: string;
  amount: number;
  transaction_type: string;
  category: string;
  is_recurring: number;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { fileId, message, history } = body as {
    fileId: string;
    message: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!fileId || !message) {
    return NextResponse.json({ error: "fileId and message required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI chat requires ANTHROPIC_API_KEY environment variable" },
      { status: 503 }
    );
  }

  const db = getDb();
  const transactions = db
    .prepare("SELECT * FROM transactions WHERE file_id = ? ORDER BY date ASC")
    .all(fileId) as Transaction[];

  if (transactions.length === 0) {
    return NextResponse.json({ error: "No transactions found for this file" }, { status: 404 });
  }

  // Build context summary
  const debits = transactions.filter((t) => t.transaction_type === "debit");
  const credits = transactions.filter((t) => t.transaction_type === "credit");
  const totalSpending = debits.reduce((s, t) => s + t.amount, 0);
  const totalIncome = credits.reduce((s, t) => s + t.amount, 0);

  const categoryMap = new Map<string, number>();
  for (const tx of debits) {
    categoryMap.set(tx.category, (categoryMap.get(tx.category) ?? 0) + tx.amount);
  }
  const categoryBreakdown = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `${cat}: $${amt.toFixed(2)}`)
    .join(", ");

  const recurringTx = transactions.filter((t) => t.is_recurring && t.transaction_type === "debit");
  const recurringNames = [...new Set(recurringTx.map((t) => t.cleaned_merchant))].join(", ");

  const dateRange = `${transactions[0].date} to ${transactions[transactions.length - 1].date}`;

  const systemPrompt = `You are a helpful personal finance analyst. You have access to the user's bank statement data.

Summary:
- Date range: ${dateRange}
- Total transactions: ${transactions.length}
- Total spending: $${totalSpending.toFixed(2)}
- Total income: $${totalIncome.toFixed(2)}
- Net cashflow: $${(totalIncome - totalSpending).toFixed(2)}
- Category breakdown: ${categoryBreakdown}
- Recurring subscriptions: ${recurringNames || "None detected"}

Top 20 largest expenses:
${debits
  .sort((a, b) => b.amount - a.amount)
  .slice(0, 20)
  .map((t) => `- ${t.date}: ${t.cleaned_merchant} (${t.category}) $${t.amount.toFixed(2)}`)
  .join("\n")}

Answer the user's questions about their spending. Be specific, use actual numbers from their data. Give actionable advice. Keep responses concise (under 200 words unless detail is requested).`;

  const client = new Anthropic({ apiKey });

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...(history ?? []),
    { role: "user", content: message },
  ];

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: systemPrompt,
    messages,
  });

  const reply = response.content[0].type === "text" ? response.content[0].text : "";

  return NextResponse.json({ reply });
}
