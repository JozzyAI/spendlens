"use client";

import { useState } from "react";
import type { NormalizedTransaction, Category } from "@/lib/types";

const CATEGORY_COLORS: Record<Category, string> = {
  "Food & Dining": "bg-orange-100 text-orange-700",
  "Groceries": "bg-green-100 text-green-700",
  "Rent & Housing": "bg-blue-100 text-blue-700",
  "Transportation": "bg-yellow-100 text-yellow-700",
  "Shopping": "bg-pink-100 text-pink-700",
  "Subscriptions": "bg-purple-100 text-purple-700",
  "Travel": "bg-cyan-100 text-cyan-700",
  "Health": "bg-red-100 text-red-700",
  "Utilities": "bg-gray-100 text-gray-700",
  "Cash & Transfers": "bg-slate-100 text-slate-700",
  "Income": "bg-emerald-100 text-emerald-700",
  "Unknown": "bg-gray-100 text-gray-500",
};

interface Props {
  transactions: NormalizedTransaction[];
}

const PAGE_SIZE = 25;

export default function TransactionTable({ transactions }: Props) {
  const [filter, setFilter] = useState<Category | "All">("All");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  const categories = ["All", ...Array.from(new Set(transactions.map((t) => t.category)))] as (Category | "All")[];

  const filtered = transactions.filter((t) => {
    const matchCat = filter === "All" || t.category === filter;
    const matchSearch =
      !search ||
      t.merchant.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="Search merchants..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="border rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value as Category | "All"); setPage(0); }}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b">
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4">Merchant</th>
              <th className="pb-2 pr-4">Category</th>
              <th className="pb-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paginated.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">{t.date}</td>
                <td className="py-2 pr-4 font-medium text-gray-700 max-w-[180px] truncate" title={t.description}>
                  {t.merchant}
                </td>
                <td className="py-2 pr-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[t.category]}`}>
                    {t.category}
                  </span>
                </td>
                <td className={`py-2 text-right font-medium ${t.type === "credit" ? "text-green-600" : "text-gray-800"}`}>
                  {t.type === "credit" ? "+" : "-"}${t.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
          <span>{filtered.length} transactions</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
            >
              &larr;
            </button>
            <span className="px-2 py-1">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
            >
              &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
