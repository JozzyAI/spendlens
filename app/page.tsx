"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Zap, Shield, MessageSquare } from "lucide-react";

export default function HomePage() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function processFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file. PDF support coming soon.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse", { method: "POST", body: form });
      if (!res.ok) throw new Error("Parse failed");
      const data = await res.json();
      sessionStorage.setItem("spendlens_data", JSON.stringify(data));
      router.push("/dashboard");
    } catch {
      setError("Failed to parse the file. Please ensure it is a valid bank statement CSV.");
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  async function loadDemo() {
    const demoCSV = `Date,Description,Amount
2026-05-01,STARBUCKS STORE #4823,-6.75
2026-05-02,AMAZON.COM*MT4X9R3N1,-89.99
2026-05-03,WHOLEFDS MKT #10123,-124.38
2026-05-04,NETFLIX.COM,-15.49
2026-05-05,CHEVRON #92837,-58.20
2026-05-06,DOORDASH*CHIPOTLE,-22.47
2026-05-07,DIRECT DEPOSIT PAYROLL,3200.00
2026-05-08,SPOTIFY USA,-9.99
2026-05-09,TARGET STORE #0823,-67.43
2026-05-10,UBER *TRIP,-14.32
2026-05-11,WALGREENS #4821,-18.45
2026-05-12,COSTCO WHSE #0234,-187.62
2026-05-13,APPLE.COM/BILL,-2.99
2026-05-14,DELTA AIR LINES,-342.00
2026-05-15,PANERA BREAD #3812,-13.87
2026-05-16,CVS PHARMACY #8823,-23.50
2026-05-17,SHELL OIL 12345678,-55.10
2026-05-18,HOME DEPOT #0284,-89.75
2026-05-19,MCDONALD'S #9283,-8.23
2026-05-20,HULU LLC,-17.99
2026-05-21,VENMO PAYMENT,-150.00
2026-05-22,BEST BUY #0423,-349.99
2026-05-23,TRADER JOE'S #234,-93.21
2026-05-24,LYFT *RIDE,-12.80
2026-05-25,AT&T BILL PAY,-85.00
2026-05-26,AMAZON PRIME,-14.99
2026-05-27,CHIPOTLE #0923,-11.45
2026-05-28,NORDSTROM #0234,-214.80
2026-05-29,GRUBHUB*DELIVERY,-28.90
2026-05-30,ZELLE TRANSFER,-200.00`;
    const blob = new Blob([demoCSV], { type: "text/csv" });
    const file = new File([blob], "demo-statement.csv");
    await processFile(file);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-xl font-bold">S</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">SpendLens</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Understand your spending instantly.
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Upload your bank statement CSV. Get AI-powered spending analysis, category breakdown, and personalized insights — no bank login required.
          </p>
        </div>

        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            dragging
              ? "border-indigo-400 bg-indigo-50"
              : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={onFileChange}
            className="hidden"
          />
          <Upload className={`w-12 h-12 mx-auto mb-4 ${dragging ? "text-indigo-500" : "text-gray-400"}`} />
          {loading ? (
            <div>
              <p className="text-lg font-semibold text-indigo-600 mb-1">Analyzing your statement...</p>
              <p className="text-sm text-gray-400">This takes just a moment</p>
            </div>
          ) : (
            <div>
              <p className="text-lg font-semibold text-gray-700 mb-1">
                Drop your CSV here, or click to browse
              </p>
              <p className="text-sm text-gray-400">
                Supports Chase, Bank of America, Amex, Citi, Wells Fargo, and more
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center mt-3">{error}</p>
        )}

        <div className="text-center mt-4">
          <button
            onClick={loadDemo}
            className="text-sm text-indigo-600 underline hover:text-indigo-800"
          >
            Try with demo data &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          {[
            {
              icon: <Zap className="w-6 h-6 text-indigo-500" />,
              title: "Instant Analysis",
              desc: "Upload your CSV and get a complete spending breakdown in seconds.",
            },
            {
              icon: <MessageSquare className="w-6 h-6 text-indigo-500" />,
              title: "AI Insights",
              desc: "Chat with your data. Ask anything about your spending habits.",
            },
            {
              icon: <Shield className="w-6 h-6 text-indigo-500" />,
              title: "Privacy First",
              desc: "No bank login required. Your data stays in your browser session.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-white border rounded-xl p-6">
              <div className="mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-800 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-12">
          <FileText className="w-3 h-3 inline mr-1" />
          Data processed locally. CSV files are not stored on our servers.
        </p>
      </div>
    </main>
  );
}
