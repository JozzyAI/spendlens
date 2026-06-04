import type { Category } from "./types";

const RULES: [RegExp, Category][] = [
  // Income
  [/\b(payroll|direct dep|salary|paycheck|zelle from|venmo from|transfer from)\b/i, "Income"],
  // Subscriptions
  [/\b(netflix|hulu|spotify|apple\.com\/bill|amazon prime|disney\+|hbo|paramount|peacock|youtube premium|audible|pandora|adobe|microsoft 365|google one|dropbox|icloud|planet fitness|la fitness|anytime fitness|equinox|peloton|duolingo|coursera|udemy)\b/i, "Subscriptions"],
  // Groceries
  [/\b(wholefds|whole foods|trader joe(?:s|'s)?|kroger|safeway|costco|sam's club|sams club|aldi|publix|wegmans|meijer|heb|stop & shop|giant|food lion|sprouts|harris teeter|price chopper|shoprite|albertsons|vons|ralphs|fred meyer|market basket)\b/i, "Groceries"],
  // Food & Dining (tst* and sq * have no trailing word char so handled separately)
  [/tst\*/i, "Food & Dining"],
  [/sq \*/i, "Food & Dining"],
  [/\b(starbucks|mcdonald|chipotle|chick-fil|subway|domino|pizza hut|taco bell|wendy|burger king|doordash|grubhub|uber eats|postmates|instacart|panera|dunkin|panda express|olive garden|applebee|ihop|denny|cheesecake factory|outback|red lobster|five guys|shake shack|sweetgreen|wingstop|raising cane|popeyes|arby|jack in the box|del taco|in-n-out|whataburger)\b/i, "Food & Dining"],
  // Travel (checked before Transportation to catch airlines in Travel)
  [/\b(hotel|marriott|hilton|hyatt|airbnb|expedia|booking\.com|vrbo|hertz|avis|enterprise|national car|sheraton|westin|renaissance|motel|resort|inn\b|suites|delta air|united air|american air|southwest air|jetblue|frontier air|alaska air|spirit air|lufthansa|british air|air canada)\b/i, "Travel"],
  // Transportation (ground transport and gas)
  [/\b(uber|lyft|shell|chevron|exxon|bp\b|marathon|valero|sunoco|texaco|citgo|speedway|wawa|kwik trip|casey's|metro\b|mta\b|bart\b|caltrain|amtrak|parking|gas station|fuel)\b/i, "Transportation"],
  // Health
  [/\b(cvs|walgreens|rite aid|urgent care|medical|pharmacy|dental|vision|dr\.|hospital|clinic|health|optum|cigna|anthem|kaiser|quest diagnostics|blue cross|aetna|humana)\b/i, "Health"],
  // Utilities
  [/\b(electric|gas bill|water bill|at&t|verizon|t-mobile|comcast|xfinity|spectrum|internet|utility|pge|con ed|duke energy|national grid|trash|waste management|garbage)\b/i, "Utilities"],
  // Rent & Housing
  [/\b(rent|lease|mortgage|hoa|property mgmt|real estate|home depot|lowe's|lowes|ace hardware|ikea|wayfair|bed bath)\b/i, "Rent & Housing"],
  // Shopping
  [/\b(amazon|walmart|target|bestbuy|best buy|ebay|etsy|nordstrom|macy's|gap|old navy|h&m|zara|shein|wish|overstock|chewy|petco|petsmart|tj maxx|tjmaxx|marshalls|ross|five below|dollar tree|dollar general)\b/i, "Shopping"],
  // Cash & Transfers
  [/\b(atm|withdrawal|zelle|venmo|paypal|cash app|wire transfer|ach transfer|cashapp)\b/i, "Cash & Transfers"],
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
