import type { Category } from "./types";

const RULES: [RegExp, Category][] = [
  // Income
  [/\b(payroll|direct dep|salary|paycheck|zelle from|venmo from|transfer from)\b/i, "Income"],
  // Subscriptions
  [/\b(netflix|hulu|spotify|apple\.com\/bill|amazon prime|disney\+|hbo|paramount|peacock|youtube premium|audible|pandora|adobe|microsoft 365|google one|dropbox|icloud)\b/i, "Subscriptions"],
  // Groceries
  [/\b(wholefds|whole foods|trader joe|kroger|safeway|costco|sam's club|aldi|publix|wegmans|meijer|heb|stop & shop|giant|food lion|sprouts)\b/i, "Groceries"],
  // Food & Dining
  [/\b(starbucks|mcdonald|chipotle|chick-fil|subway|domino|pizza hut|taco bell|wendy|burger king|doordash|grubhub|uber eats|postmates|instacart|panera|dunkin|panda express|olive garden|applebee|ihop|denny|cheesecake factory|outback|red lobster|cinco de mayo|tst\*|sq \*)\b/i, "Food & Dining"],
  // Transportation
  [/\b(uber|lyft|shell|chevron|exxon|bp|marathon|valero|sunoco|texaco|citgo|speedway|wawa|kwik trip|casey's|metro|mta|bart|caltrain|amtrak|delta air|united air|american air|southwest|jetblue|frontier)\b/i, "Transportation"],
  // Health
  [/\b(cvs|walgreens|rite aid|urgent care|medical|pharmacy|dental|vision|dr\.|hospital|clinic|health|optum|cigna|anthem|kaiser|quest diagnostics)\b/i, "Health"],
  // Travel
  [/\b(hotel|marriott|hilton|hyatt|airbnb|expedia|booking\.com|vrbo|hertz|avis|enterprise|national car|sheraton|westin|renaissance)\b/i, "Travel"],
  // Utilities
  [/\b(electric|gas bill|water bill|at&t|verizon|t-mobile|comcast|xfinity|spectrum|internet|utility|pge|con ed|duke energy|national grid)\b/i, "Utilities"],
  // Rent & Housing
  [/\b(rent|lease|mortgage|hoa|property mgmt|real estate|home depot|lowe's|ace hardware|ikea)\b/i, "Rent & Housing"],
  // Shopping
  [/\b(amazon|walmart|target|best buy|ebay|etsy|nordstrom|macy's|gap|old navy|h&m|zara|shein|wish|wayfair|overstock|chewy|petco|petsmart)\b/i, "Shopping"],
  // Cash & Transfers
  [/\b(atm|withdrawal|zelle|venmo|paypal|cash app|wire transfer|ach transfer)\b/i, "Cash & Transfers"],
];

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
  const desc = description.toLowerCase();
  for (const [pattern, category] of RULES) {
    if (pattern.test(desc)) return category;
  }
  return "Unknown";
}

const RECURRING_PATTERNS = [
  /netflix|spotify|hulu|apple\.com\/bill|amazon prime|disney\+|hbo|youtube premium|audible|pandora|adobe|microsoft 365|google one|dropbox|icloud|gym|membership|subscription/i,
];

export function isLikelyRecurring(description: string, category: Category): boolean {
  if (category === "Subscriptions") return true;
  return RECURRING_PATTERNS.some((p) => p.test(description));
}
