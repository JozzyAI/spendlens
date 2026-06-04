import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { NormalizedTransaction } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ summary: generateFallbackSummary() });
  }

  const body = await req.json();
  const { transactions, summary } = body as {
    transactions: NormalizedTransaction[];
    summary: {
      totalSpending: number;
      totalIncome: number;
      netCashFlow: number;
      byCategory: Record<string, number>;
      topMerchants: { merchant: string; total: number }[];
      subscriptions: NormalizedTransaction[];
    };
  };

  const topCategories = Object.entries(summary.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amt]) => `${cat}: $${amt.toFixed(2)}`)
    .join(", ");

  const topMerchants = summary.topMerchants
    .slice(0, 5)
    .map((m) => `${m.merchant}: $${m.total.toFixed(2)}`)
    .join(", ");

  const subTotal = summary.subscriptions.reduce((s, t) => s + t.amount, 0);
  const subCount = summary.subscriptions.length;

  const prompt = `You are a personal finance analyst. Based on this spending data, write a concise, friendly, insightful 3-4 paragraph summary in English.

Data:
- Total spending: $${summary.totalSpending.toFixed(2)}
- Total income: $${summary.totalIncome.toFixed(2)}
- Net cash flow: $${summary.netCashFlow.toFixed(2)}
- Top categories: ${topCategories}
- Top merchants: ${topMerchants}
- Recurring subscriptions: ${subCount} totaling $${subTotal.toFixed(2)}/month

Total transactions analyzed: ${transactions.length}

Write specific, actionable insights. Mention specific numbers. Point out any concerning patterns or good habits. Suggest 1-2 concrete ways to save money. Be encouraging but honest.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  return NextResponse.json({ summary: text });
}

function generateFallbackSummary(): string {
  return "Upload your bank statement and configure your ANTHROPIC_API_KEY to get AI-powered spending insights.";
}
