import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { NormalizedTransaction, SpendingSummary } from "@/lib/types";

interface SummaryRequest {
  transactions: NormalizedTransaction[];
  summary: SpendingSummary;
}

export async function POST(req: NextRequest) {
  let body: SummaryRequest;
  try {
    body = (await req.json()) as SummaryRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid spending data" }, { status: 400 });
  }

  const { transactions, summary } = body;
  if (!Array.isArray(transactions) || !summary || !summary.byCategory) {
    return NextResponse.json({ error: "Invalid spending data" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ summary: generateFallbackSummary(transactions, summary) });
  }

  const topCategories = Object.entries(summary.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amt]) => `${cat}: $${amt.toFixed(2)}`)
    .join(", ");

  const topMerchants = summary.topMerchants
    .slice(0, 5)
    .map((m) => `${m.merchant}: $${m.total.toFixed(2)}`)
    .join(", ");

  const subTotal = summary.subscriptions.reduce((s, t) => s + t.representativeAmount, 0);
  const subCount = summary.subscriptions.length;

  const prompt = `You are a personal finance analyst. Based on this spending data, write a concise, friendly, insightful 3-4 paragraph summary in English.

Data:
- Total spending: $${summary.totalSpending.toFixed(2)}
- Total income: $${summary.totalIncome.toFixed(2)}
- Net cash flow: $${summary.netCashFlow.toFixed(2)}
- Top categories: ${topCategories}
- Top merchants: ${topMerchants}
- Recurring candidates: ${subCount} totaling $${subTotal.toFixed(2)}/month

Total transactions analyzed: ${transactions.length}

Write specific, actionable insights. Mention specific numbers. Point out any concerning patterns or good habits. Suggest 1-2 concrete ways to save money. Be encouraging but honest.`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0]?.type === "text" ? message.content[0].text : "";
    return NextResponse.json({
      summary: text || generateFallbackSummary(transactions, summary),
    });
  } catch {
    return NextResponse.json({ summary: generateFallbackSummary(transactions, summary) });
  }
}

function generateFallbackSummary(
  transactions: NormalizedTransaction[],
  summary: SpendingSummary
): string {
  const topCategory = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])[0];
  const topMerchant = summary.topMerchants[0];
  const subscriptionTotal = summary.subscriptions.reduce(
    (sum, candidate) => sum + candidate.representativeAmount,
    0
  );
  const cashFlow = summary.netCashFlow >= 0
    ? `You kept $${summary.netCashFlow.toFixed(2)} after spending.`
    : `Spending exceeded income by $${Math.abs(summary.netCashFlow).toFixed(2)}.`;

  const details = [
    `Across ${transactions.length} transactions, you spent $${summary.totalSpending.toFixed(2)} and received $${summary.totalIncome.toFixed(2)} in income.`,
    cashFlow,
  ];

  if (topCategory) {
    details.push(`${topCategory[0]} was your largest category at $${topCategory[1].toFixed(2)}.`);
  }
  if (topMerchant) {
    details.push(`Your top merchant was ${topMerchant.merchant} at $${topMerchant.total.toFixed(2)}.`);
  }
  if (summary.subscriptions.length > 0) {
    details.push(`Recurring payment candidates total about $${subscriptionTotal.toFixed(2)} per month.`);
  }

  return details.join(" ");
}
