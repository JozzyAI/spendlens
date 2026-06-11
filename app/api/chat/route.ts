import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { NormalizedTransaction } from "@/lib/types";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid question or spending data" }, { status: 400 });
  }

  const { question, transactions, summary } = body as {
    question: string;
    transactions: NormalizedTransaction[];
    summary: Record<string, unknown>;
  };
  if (
    typeof question !== "string" ||
    !question.trim() ||
    question.length > 500 ||
    !Array.isArray(transactions) ||
    !summary
  ) {
    return NextResponse.json({ error: "Invalid question or spending data" }, { status: 400 });
  }

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

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    });

    const answer = message.content[0]?.type === "text" ? message.content[0].text : "Unable to answer.";
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json(
      { answer: "The AI service is unavailable right now. Please try again shortly." },
      { status: 503 }
    );
  }
}
