import type { Category, TransactionType } from "./types";

export type CategorizationMatchField = "description" | "merchant";
export type CategorizationMatchOperator =
  | "contains"
  | "equals"
  | "startsWith"
  | "regex";

export interface CategorizationMatcher {
  field: CategorizationMatchField;
  operator: CategorizationMatchOperator;
  value: string | RegExp;
  caseSensitive?: boolean;
}

export interface CategorizationRule {
  id: string;
  category: Category;
  matchers: CategorizationMatcher[];
  transactionType?: TransactionType;
}

export interface CategorizationInput {
  description: string;
  merchant: string;
  type: TransactionType;
}

export const DEBIT_FALLBACK_CATEGORY: Category = "Unknown";
export const CREDIT_FALLBACK_CATEGORY: Category = "Income";

export const DEFAULT_CATEGORIZATION_RULES: CategorizationRule[] = [
  {
    id: "income-deposits",
    category: "Income",
    transactionType: "credit",
    matchers: [
      {
        field: "description",
        operator: "regex",
        value: /\b(payroll|direct dep|salary|paycheck|zelle from|venmo from|transfer from)\b/i,
      },
    ],
  },
  {
    id: "subscriptions",
    category: "Subscriptions",
    transactionType: "debit",
    matchers: [
      {
        field: "description",
        operator: "regex",
        value:
          /\b(netflix|hulu|spotify|apple\.com\/bill|amazon prime|disney\+|hbo|paramount|peacock|youtube premium|audible|pandora|adobe|microsoft 365|google one|dropbox|icloud|planet fitness|la fitness|anytime fitness|equinox|peloton|duolingo|coursera|udemy)\b/i,
      },
    ],
  },
  {
    id: "groceries",
    category: "Groceries",
    transactionType: "debit",
    matchers: [
      {
        field: "merchant",
        operator: "regex",
        value:
          /\b(wholefds|whole foods|trader joe(?:s|'s)?|kroger|safeway|costco|sam's club|sams club|aldi|publix|wegmans|meijer|heb|stop & shop|giant|food lion|sprouts|harris teeter|price chopper|shoprite|albertsons|vons|ralphs|fred meyer|market basket)\b/i,
      },
    ],
  },
  {
    id: "restaurant-processors",
    category: "Food & Dining",
    transactionType: "debit",
    matchers: [
      { field: "description", operator: "regex", value: /tst\*|sq \*/i },
    ],
  },
  {
    id: "restaurants",
    category: "Food & Dining",
    transactionType: "debit",
    matchers: [
      {
        field: "merchant",
        operator: "regex",
        value:
          /\b(starbucks|mcdonald|chipotle|chick-fil|subway|domino|pizza hut|taco bell|wendy|burger king|doordash|grubhub|uber eats|postmates|instacart|panera|dunkin|panda express|olive garden|applebee|ihop|denny|cheesecake factory|outback|red lobster|five guys|shake shack|sweetgreen|wingstop|raising cane|popeyes|arby|jack in the box|del taco|in-n-out|whataburger)\b/i,
      },
    ],
  },
  {
    id: "travel",
    category: "Travel",
    transactionType: "debit",
    matchers: [
      {
        field: "description",
        operator: "regex",
        value:
          /\b(hotel|marriott|hilton|hyatt|airbnb|expedia|booking\.com|vrbo|hertz|avis|enterprise|national car|sheraton|westin|renaissance|motel|resort|inn\b|suites|delta air|united air|american air|southwest air|jetblue|frontier air|alaska air|spirit air|lufthansa|british air|air canada)\b/i,
      },
    ],
  },
  {
    id: "transportation",
    category: "Transportation",
    transactionType: "debit",
    matchers: [
      {
        field: "merchant",
        operator: "regex",
        value:
          /\b(uber|lyft|shell|chevron|exxon|bp\b|marathon|valero|sunoco|texaco|citgo|speedway|wawa|kwik trip|casey's|metro\b|mta\b|bart\b|caltrain|amtrak|parking|gas station|fuel)\b/i,
      },
    ],
  },
  {
    id: "health",
    category: "Health",
    transactionType: "debit",
    matchers: [
      {
        field: "merchant",
        operator: "regex",
        value:
          /\b(cvs|walgreens|rite aid|urgent care|medical|pharmacy|dental|vision|dr\.|hospital|clinic|health|optum|cigna|anthem|kaiser|quest diagnostics|blue cross|aetna|humana)\b/i,
      },
    ],
  },
  {
    id: "utilities",
    category: "Utilities",
    transactionType: "debit",
    matchers: [
      {
        field: "description",
        operator: "regex",
        value:
          /\b(electric|gas bill|water bill|at&t|verizon|t-mobile|comcast|xfinity|spectrum|internet|utility|pge|con ed|duke energy|national grid|trash|waste management|garbage)\b/i,
      },
    ],
  },
  {
    id: "rent-housing",
    category: "Rent & Housing",
    transactionType: "debit",
    matchers: [
      {
        field: "merchant",
        operator: "regex",
        value:
          /\b(rent|lease|mortgage|hoa|property mgmt|real estate|home depot|lowe's|lowes|ace hardware|ikea|wayfair|bed bath)\b/i,
      },
    ],
  },
  {
    id: "shopping",
    category: "Shopping",
    transactionType: "debit",
    matchers: [
      {
        field: "merchant",
        operator: "regex",
        value:
          /\b(amazon|walmart|target|bestbuy|best buy|ebay|etsy|nordstrom|macy's|gap|old navy|h&m|zara|shein|wish|overstock|chewy|petco|petsmart|tj maxx|tjmaxx|marshalls|ross|five below|dollar tree|dollar general)\b/i,
      },
    ],
  },
  {
    id: "cash-transfers",
    category: "Cash & Transfers",
    matchers: [
      {
        field: "description",
        operator: "regex",
        value: /\b(atm|withdrawal|zelle|venmo|paypal|cash app|wire transfer|ach transfer|cashapp)\b/i,
      },
    ],
  },
];

function normalizeForMatch(value: string, caseSensitive = false): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return caseSensitive ? normalized : normalized.toLowerCase();
}

function matcherMatches(input: CategorizationInput, matcher: CategorizationMatcher): boolean {
  const rawTarget = input[matcher.field];
  const target = normalizeForMatch(rawTarget, matcher.caseSensitive);

  if (matcher.operator === "regex") {
    const pattern =
      matcher.value instanceof RegExp
        ? matcher.value
        : new RegExp(matcher.value, matcher.caseSensitive ? undefined : "i");
    return pattern.test(rawTarget);
  }

  const value = normalizeForMatch(String(matcher.value), matcher.caseSensitive);

  if (matcher.operator === "contains") return target.includes(value);
  if (matcher.operator === "equals") return target === value;
  return target.startsWith(value);
}

export function categorizeTransaction(
  input: CategorizationInput,
  rules: readonly CategorizationRule[] = DEFAULT_CATEGORIZATION_RULES
): Category {
  for (const rule of rules) {
    if (rule.transactionType && rule.transactionType !== input.type) continue;
    if (rule.matchers.every((matcher) => matcherMatches(input, matcher))) {
      return rule.category;
    }
  }

  return input.type === "credit" ? CREDIT_FALLBACK_CATEGORY : DEBIT_FALLBACK_CATEGORY;
}

export function cleanMerchant(raw: string): string {
  return raw
    .replace(/\s+#\d+.*$/i, "")
    .replace(/\s+\d{4,}.*$/i, "")
    .replace(/^(TST\*|SQ \*|POS |DEBIT |CHECK |ACH |APL\*)/i, "")
    .replace(/\s+(LLC|INC|CORP|LTD|CO)\b.*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toUpperCase();
}

export function categorize(description: string): Category {
  return categorizeTransaction({
    description,
    merchant: cleanMerchant(description),
    type: "debit",
  });
}

const RECURRING_PATTERNS = [
  /netflix|spotify|hulu|apple\.com\/bill|amazon prime|disney\+|hbo|youtube premium|audible|pandora|adobe|microsoft 365|google one|dropbox|icloud|gym|membership|subscription/i,
];

export function isLikelyRecurring(description: string, category: Category): boolean {
  if (category === "Subscriptions") return true;
  return RECURRING_PATTERNS.some((p) => p.test(description));
}
