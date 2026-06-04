"use client";

import type { NormalizedTransaction } from "@/lib/types";
import { RefreshCw } from "lucide-react";

interface Props {
  subscriptions: NormalizedTransaction[];
}

export default function SubscriptionList({ subscriptions }: Props) {
  if (!subscriptions.length) return null;
  const total = subscriptions.reduce((s, t) => s + t.amount, 0);

  const unique = Object.values(
    subscriptions.reduce(
      (acc, t) => {
        if (!acc[t.merchant]) acc[t.merchant] = { ...t };
        return acc;
      },
      {} as Record<string, NormalizedTransaction>
    )
  );

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-indigo-500" />
          Recurring Subscriptions
        </h3>
        <span className="text-sm font-bold text-indigo-600">${total.toFixed(2)}/mo</span>
      </div>
      <div className="divide-y">
        {unique.map((sub) => (
          <div key={sub.id} className="flex justify-between py-2 text-sm">
            <span className="text-gray-700 font-medium truncate max-w-[70%]">{sub.merchant}</span>
            <span className="text-gray-500">${sub.amount.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
