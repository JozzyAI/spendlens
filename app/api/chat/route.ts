import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { NormalizedTransaction } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { question, transactions, summary } = body as {
    question: string;
    transactions: NormalizedTransaction[];
    summary: Record<string, unknown>;
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      answer:
        "AI Q&A requires ANTHROPIC_API_KEY. Add it to your .env.local file to enable this feature.",
    });
  }

  const txnSample = transactions
    .slice(0, 100)
    .map(
      (t) =>
        `${t.date} | ${t.merchant} | ${t.type === "debit" ? "-" : "+"}$${t.amount.toFixed(2)} | ${t.category}`
    )
    .join("\n");

  const systemPrompt = `You are a personal finance assistant analyzing a user's bank statement data.
Answer questions about their spending clearly and helpfully.
Be specific with numbers when possible. Keep answers concise (2-4 sentences unless more detail is requested).

Summary: ${JSON.stringify(summary, null, 2)}

Transaction sample (first 100):
${txnSample}`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: "user", content: question }],
  });

  const answer = message.content[0].type === "text" ? message.content[0].text : "Unable to answer.";
  return NextResponse.json({ answer });
}
