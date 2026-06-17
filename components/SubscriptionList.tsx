"use client";

import { RefreshCw } from "lucide-react";
import type { RecurringPaymentCandidate } from "@/lib/types";

interface Props {
  subscriptions: RecurringPaymentCandidate[];
}

export default function SubscriptionList({ subscriptions }: Props) {
  if (!subscriptions.length) return null;

  const total = subscriptions.reduce(
    (sum, candidate) => sum + candidate.representativeAmount,
    0
  );

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-indigo-500" />
          Recurring Candidates
        </h3>
        <span className="text-sm font-bold text-indigo-600">${total.toFixed(2)}/mo</span>
      </div>
      <div className="divide-y">
        {subscriptions.map((sub) => (
          <div key={sub.normalizedMerchant} className="py-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gray-700 font-medium truncate">{sub.normalizedMerchant}</span>
              <span className="shrink-0 text-gray-500">
                ${sub.representativeAmount.toFixed(2)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-xs text-gray-400">
              <span className="truncate">
                {sub.occurrenceCount} charges · {sub.confidence} confidence
              </span>
              <span className="shrink-0">
                {sub.firstDate.slice(0, 7)} to {sub.lastDate.slice(0, 7)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
