"use client";

interface Props {
  merchants: { merchant: string; total: number }[];
}

export default function MerchantRanking({ merchants }: Props) {
  if (!merchants.length) return null;
  const max = merchants[0].total;

  return (
    <div className="bg-white border rounded-xl p-4">
      <h3 className="font-semibold text-gray-700 mb-3">Top Merchants</h3>
      <div className="space-y-2">
        {merchants.slice(0, 10).map((m, i) => (
          <div key={m.merchant} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-0.5">
                <span className="font-medium text-gray-700 truncate max-w-[60%]">{m.merchant}</span>
                <span className="text-gray-500">${m.total.toFixed(0)}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-400 rounded-full"
                  style={{ width: `${(m.total / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
