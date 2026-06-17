import type { NormalizedTransaction, RecurringPaymentCandidate } from "./types";

export const DEFAULT_RECURRING_PAYMENT_OPTIONS = {
  minOccurrences: 3,
  maxAmountVarianceDollars: 2,
  maxAmountVarianceRatio: 0.1,
  dayOfMonthToleranceDays: 6,
  maxSkippedMonths: 1,
} as const;

export type RecurringPaymentOptions = Partial<typeof DEFAULT_RECURRING_PAYMENT_OPTIONS>;

interface MerchantSeries {
  merchant: string;
  transactions: NormalizedTransaction[];
}

function parseDateParts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function monthDistance(fromDate: string, toDate: string): number {
  const from = parseDateParts(fromDate);
  const to = parseDateParts(toDate);
  return (to.year - from.year) * 12 + (to.month - from.month);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function allowedAmountVariance(amount: number, options: typeof DEFAULT_RECURRING_PAYMENT_OPTIONS): number {
  return Math.max(
    options.maxAmountVarianceDollars,
    roundMoney(amount * options.maxAmountVarianceRatio)
  );
}

function uniqueMonthlyTransactions(transactions: NormalizedTransaction[]): NormalizedTransaction[] {
  const byMonth = new Map<string, NormalizedTransaction>();
  for (const transaction of transactions) {
    const current = byMonth.get(monthKey(transaction.date));
    if (!current || transaction.date > current.date) {
      byMonth.set(monthKey(transaction.date), transaction);
    }
  }
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function groupByMerchant(transactions: NormalizedTransaction[]): MerchantSeries[] {
  const groups = new Map<string, NormalizedTransaction[]>();
  for (const transaction of transactions) {
    if (transaction.type !== "debit") continue;
    const transactionsForMerchant = groups.get(transaction.merchant) ?? [];
    transactionsForMerchant.push(transaction);
    groups.set(transaction.merchant, transactionsForMerchant);
  }

  return [...groups.entries()].map(([merchant, merchantTransactions]) => ({
    merchant,
    transactions: uniqueMonthlyTransactions(merchantTransactions),
  }));
}

function findSimilarAmountOccurrences(
  transactions: NormalizedTransaction[],
  options: typeof DEFAULT_RECURRING_PAYMENT_OPTIONS
): NormalizedTransaction[] {
  if (transactions.length < options.minOccurrences) return [];

  const representativeAmount = median(transactions.map((transaction) => transaction.amount));
  const allowedVariance = allowedAmountVariance(representativeAmount, options);
  return transactions.filter(
    (transaction) => Math.abs(transaction.amount - representativeAmount) <= allowedVariance
  );
}

function assessTiming(
  occurrences: NormalizedTransaction[],
  options: typeof DEFAULT_RECURRING_PAYMENT_OPTIONS
): { regularIntervals: number; skippedIntervals: number; irregularIntervals: number } {
  let regularIntervals = 0;
  let skippedIntervals = 0;
  let irregularIntervals = 0;
  const maxMonthGap = options.maxSkippedMonths + 1;

  for (let index = 1; index < occurrences.length; index += 1) {
    const previous = occurrences[index - 1];
    const current = occurrences[index];
    const monthGap = monthDistance(previous.date, current.date);
    const previousDay = parseDateParts(previous.date).day;
    const currentDay = parseDateParts(current.date).day;
    const dayDelta = Math.abs(currentDay - previousDay);

    if (
      monthGap >= 1 &&
      monthGap <= maxMonthGap &&
      dayDelta <= options.dayOfMonthToleranceDays
    ) {
      regularIntervals += 1;
      if (monthGap > 1) skippedIntervals += monthGap - 1;
    } else {
      irregularIntervals += 1;
    }
  }

  return { regularIntervals, skippedIntervals, irregularIntervals };
}

export function detectRecurringPaymentCandidates(
  transactions: NormalizedTransaction[],
  recurringOptions: RecurringPaymentOptions = {}
): RecurringPaymentCandidate[] {
  const options = { ...DEFAULT_RECURRING_PAYMENT_OPTIONS, ...recurringOptions };
  const candidates: RecurringPaymentCandidate[] = [];

  for (const series of groupByMerchant(transactions)) {
    const similarOccurrences = findSimilarAmountOccurrences(series.transactions, options);
    const occurrenceCount = similarOccurrences.length;
    if (occurrenceCount < options.minOccurrences) continue;

    const representativeAmount = roundMoney(
      median(similarOccurrences.map((transaction) => transaction.amount))
    );
    const amountTolerance = allowedAmountVariance(representativeAmount, options);
    const { regularIntervals, skippedIntervals, irregularIntervals } = assessTiming(
      similarOccurrences,
      options
    );
    const intervalCount = Math.max(occurrenceCount - 1, 0);
    const regularEnough = regularIntervals >= Math.ceil(intervalCount / 2);

    let confidence: RecurringPaymentCandidate["confidence"] = "low";
    if (irregularIntervals === 0 && skippedIntervals === 0) {
      confidence = "high";
    } else if (irregularIntervals <= 1 && regularEnough) {
      confidence = "medium";
    }

    const rationaleParts = [
      `${occurrenceCount} similar debit charges across ${occurrenceCount} months`,
      `representative amount $${representativeAmount.toFixed(2)}`,
      `amount tolerance +/-$${amountTolerance.toFixed(2)}`,
      `date tolerance +/-${options.dayOfMonthToleranceDays} days`,
    ];
    if (skippedIntervals > 0) {
      rationaleParts.push(`${skippedIntervals} skipped month${skippedIntervals === 1 ? "" : "s"}`);
    }
    if (irregularIntervals > 0) {
      rationaleParts.push(`${irregularIntervals} irregular interval${irregularIntervals === 1 ? "" : "s"}`);
    }

    candidates.push({
      normalizedMerchant: series.merchant,
      representativeAmount,
      occurrenceCount,
      confidence,
      rationale: rationaleParts.join("; "),
      firstDate: similarOccurrences[0].date,
      lastDate: similarOccurrences[similarOccurrences.length - 1].date,
    });
  }

  return candidates.sort((a, b) => {
    const confidenceRank = { high: 0, medium: 1, low: 2 };
    return (
      confidenceRank[a.confidence] - confidenceRank[b.confidence] ||
      b.occurrenceCount - a.occurrenceCount ||
      b.representativeAmount - a.representativeAmount ||
      a.normalizedMerchant.localeCompare(b.normalizedMerchant)
    );
  });
}
