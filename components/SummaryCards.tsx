"use client";

import { TrendingUp, TrendingDown, DollarSign, ArrowUpDown } from "lucide-react";

interface Props {
  totalSpending: number;
  totalIncome: number;
  netCashFlow: number;
  topCategory: string;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function SummaryCards({ totalSpending, totalIncome, netCashFlow, topCategory }: Props) {
  const cards = [
    {
      label: "Total Spending",
      value: fmt(totalSpending),
      icon: <TrendingDown className="w-5 h-5 text-red-500" />,
      color: "border-red-200 bg-red-50",
    },
    {
      label: "Total Income",
      value: fmt(totalIncome),
      icon: <TrendingUp className="w-5 h-5 text-green-500" />,
      color: "border-green-200 bg-green-50",
    },
    {
      label: "Net Cash Flow",
      value: fmt(netCashFlow),
      icon: <ArrowUpDown className={`w-5 h-5 ${netCashFlow >= 0 ? "text-green-500" : "text-red-500"}`} />,
      color: netCashFlow >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50",
    },
    {
      label: "Top Category",
      value: topCategory,
      icon: <DollarSign className="w-5 h-5 text-blue-500" />,
      color: "border-blue-200 bg-blue-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className={`border rounded-xl p-4 ${c.color}`}>
          <div className="flex items-center gap-2 mb-1">
            {c.icon}
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{c.label}</span>
          </div>
          <p className="text-xl font-bold text-gray-800 truncate">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
