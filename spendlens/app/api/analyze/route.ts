import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/schema";
import Anthropic from "@anthropic-ai/sdk";

interface Transaction {
  id: string;
  file_id: string;
  date: string;
  raw_description: string;
  cleaned_merchant: string;
  amount: number;
  transaction_type: string;
  category: string;
  is_recurring: number;
  confidence_score: number;
}

interface CategorySummary {
  category: string;
  total: number;
  count: number;
}

interface MerchantSummary {
  merchant: string;
  total: number;
  count: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  }

  const db = getDb();

  const transactions = db
    .prepare("SELECT * FROM transactions WHERE file_id = ? ORDER BY date ASC")
    .all(fileId) as Transaction[];

  if (transactions.length === 0) {
    return NextResponse.json({ error: "No transactions found" }, { status: 404 });
  }

  const debits = transactions.filter((t) => t.transaction_type === "debit");
  const credits = transactions.filter((t) => t.transaction_type === "credit");

  const totalSpending = debits.reduce((s, t) => s + t.amount, 0);
  const totalIncome = credits.reduce((s, t) => s + t.amount, 0);
  const netCashflow = totalIncome - totalSpending;

  // Category breakdown
  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const tx of debits) {
    const c = categoryMap.get(tx.category) ?? { total: 0, count: 0 };
    c.total += tx.amount;
    c.count += 1;
    categoryMap.set(tx.category, c);
  }
  const topCategories: CategorySummary[] = Array.from(categoryMap.entries())
    .map(([category, { total, count }]) => ({ category, total, count }))
    .sort((a, b) => b.total - a.total);

  // Merchant breakdown
  const merchantMap = new Map<string, { total: number; count: number }>();
  for (const tx of debits) {
    const m = merchantMap.get(tx.cleaned_merchant) ?? { total: 0, count: 0 };
    m.total += tx.amount;
    m.count += 1;
    merchantMap.set(tx.cleaned_merchant, m);
  }
  const topMerchants: MerchantSummary[] = Array.from(merchantMap.entries())
    .map(([merchant, { total, count }]) => ({ merchant, total, count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Recurring subscriptions
  const recurring = debits.filter((t) => t.is_recurring);
  const uniqueRecurring = new Map<string, number>();
  for (const tx of recurring) {
    const existing = uniqueRecurring.get(tx.cleaned_merchant) ?? 0;
    uniqueRecurring.set(tx.cleaned_merchant, Math.max(existing, tx.amount));
  }
  const subscriptionTotal = Array.from(uniqueRecurring.values()).reduce((s, v) => s + v, 0);

  // Top 10 largest transactions
  const top10 = [...debits].sort((a, b) => b.amount - a.amount).slice(0, 10);

  // Monthly breakdown
  const monthlyMap = new Map<string, { spending: number; income: number }>();
  for (const tx of transactions) {
    const month = tx.date.slice(0, 7);
    const m = monthlyMap.get(month) ?? { spending: 0, income: 0 };
    if (tx.transaction_type === "debit") m.spending += tx.amount;
    else m.income += tx.amount;
    monthlyMap.set(month, m);
  }
  const monthlyData = Array.from(monthlyMap.entries())
    .map(([month, { spending, income }]) => ({ month, spending, income }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Generate AI summary
  let aiSummary = "";
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const summaryData = {
        totalSpending,
        totalIncome,
        netCashflow,
        topCategories: topCategories.slice(0, 5),
        topMerchants: topMerchants.slice(0, 5),
        recurringSubscriptions: Array.from(uniqueRecurring.entries()).map(([name, amount]) => ({ name, amount })),
        subscriptionTotal,
        transactionCount: transactions.length,
        dateRange: {
          from: transactions[0]?.date,
          to: transactions[transactions.length - 1]?.date,
        },
      };

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: `You are a personal finance analyst. Analyze this spending data and provide a concise, actionable summary in 3-5 bullet points. Be specific with numbers. Data:\n${JSON.stringify(summaryData, null, 2)}`,
          },
        ],
      });

      aiSummary = response.content[0].type === "text" ? response.content[0].text : "";
    } catch {
      aiSummary = "";
    }
  }

  // Store summary
  const { v4: uuidv4 } = await import("uuid");
  const summaryId = uuidv4();
  db.prepare(
    `INSERT OR REPLACE INTO monthly_summaries (id, file_id, month, total_income, total_spending, net_cashflow, top_categories_json, top_merchants_json, ai_summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    summaryId,
    fileId,
    monthlyData[monthlyData.length - 1]?.month ?? "all",
    totalIncome,
    totalSpending,
    netCashflow,
    JSON.stringify(topCategories),
    JSON.stringify(topMerchants),
    aiSummary
  );

  return NextResponse.json({
    totalSpending,
    totalIncome,
    netCashflow,
    transactionCount: transactions.length,
    topCategories,
    topMerchants,
    top10Transactions: top10,
    recurringSubscriptions: Array.from(uniqueRecurring.entries()).map(([name, amount]) => ({ name, amount })),
    subscriptionTotal,
    monthlyData,
    aiSummary,
    dateRange: {
      from: transactions[0]?.date,
      to: transactions[transactions.length - 1]?.date,
    },
  });
}
