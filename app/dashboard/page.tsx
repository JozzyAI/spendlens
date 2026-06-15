"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { NormalizedTransaction } from "@/lib/types";
import SummaryCards from "@/components/SummaryCards";
import { CategoryPieChart, MonthlyBarChart } from "@/components/SpendingCharts";
import MerchantRanking from "@/components/MerchantRanking";
import SubscriptionList from "@/components/SubscriptionList";
import TransactionTable from "@/components/TransactionTable";
import ChatBox from "@/components/ChatBox";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

interface SummaryData {
  totalSpending: number;
  totalIncome: number;
  netCashFlow: number;
  byCategory: Record<string, number>;
  topMerchants: { merchant: string; total: number }[];
  topTransactions: NormalizedTransaction[];
  subscriptions: NormalizedTransaction[];
  monthlyTrend: { month: string; spending: number; income: number }[];
}

interface ParsedData {
  transactions: NormalizedTransaction[];
  summary: SummaryData;
}

function subscribeToStorage() {
  return () => {};
}

let cachedRaw: string | null = null;
let cachedData: ParsedData | null = null;

function getStoredData(): ParsedData | null {
  const stored = sessionStorage.getItem("spendlens_data");
  if (stored !== cachedRaw) {
    cachedRaw = stored;
    try {
      cachedData = stored ? (JSON.parse(stored) as ParsedData) : null;
    } catch {
      sessionStorage.removeItem("spendlens_data");
      cachedRaw = null;
      cachedData = null;
    }
  }
  return cachedData;
}

function getServerData(): ParsedData | null {
  return null;
}

export default function DashboardPage() {
  const router = useRouter();
  const data = useSyncExternalStore(subscribeToStorage, getStoredData, getServerData);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "chat">("overview");

  useEffect(() => {
    if (!data) {
      router.push("/");
    }
  }, [data, router]);

  useEffect(() => {
    if (!data) {
      return;
    }

    let cancelled = false;

    async function fetchAISummary() {
      setLoadingAI(true);
      try {
        const res = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactions: data!.transactions,
            summary: data!.summary,
          }),
        });
        const d = (await res.json()) as { summary?: string; error?: string };
        if (!res.ok) throw new Error(d.error || "Summary request failed");
        if (!cancelled) setAiSummary(d.summary || "No summary was generated.");
      } catch {
        if (!cancelled) setAiSummary("Unable to generate AI summary at this time.");
      } finally {
        if (!cancelled) setLoadingAI(false);
      }
    }

    fetchAISummary();
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const { summary, transactions } = data;
  const topCategory = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  const pieData = Object.entries(summary.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  const summaryForChat = {
    totalSpending: summary.totalSpending,
    totalIncome: summary.totalIncome,
    netCashFlow: summary.netCashFlow,
    byCategory: summary.byCategory,
    topMerchants: summary.topMerchants,
    subscriptionCount: summary.subscriptions.length,
    subscriptionTotal: summary.subscriptions.reduce((s, t) => s + t.amount, 0),
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Nav */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">S</span>
              </div>
              <span className="font-bold text-gray-900">SpendLens</span>
            </div>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["overview", "transactions", "chat"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400">{transactions.length} transactions</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {activeTab === "overview" && (
          <>
            <SummaryCards
              totalSpending={summary.totalSpending}
              totalIncome={summary.totalIncome}
              netCashFlow={summary.netCashFlow}
              topCategory={topCategory}
            />

            {/* AI Summary */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-semibold">AI Spending Analysis</h3>
              </div>
              {loadingAI ? (
                <div className="flex items-center gap-2 text-indigo-200">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Generating insights...</span>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-indigo-50">{aiSummary}</p>
              )}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CategoryPieChart data={pieData} />
              <MonthlyBarChart data={summary.monthlyTrend} />
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MerchantRanking merchants={summary.topMerchants} />
              <SubscriptionList subscriptions={summary.subscriptions} />
            </div>

            {/* Top Transactions */}
            <div className="bg-white border rounded-xl p-4">
              <h3 className="font-semibold text-gray-700 mb-3">Largest Transactions</h3>
              <div className="divide-y">
                {summary.topTransactions.slice(0, 10).map((t) => (
                  <div key={t.id} className="flex justify-between items-center py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-gray-800">{t.merchant}</p>
                      <p className="text-xs text-gray-400">{t.date} · {t.category ?? "Unknown"}</p>
                    </div>
                    <span className="font-bold text-gray-900">${t.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === "transactions" && (
          <TransactionTable transactions={transactions} />
        )}

        {activeTab === "chat" && (
          <ChatBox transactions={transactions} summary={summaryForChat as Record<string, unknown>} />
        )}
      </div>
    </main>
  );
}
