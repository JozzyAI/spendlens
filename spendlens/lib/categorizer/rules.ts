export type Category =
  | "Food & Dining"
  | "Groceries"
  | "Rent & Housing"
  | "Transportation"
  | "Shopping"
  | "Subscriptions"
  | "Travel"
  | "Health & Medical"
  | "Utilities"
  | "Income"
  | "Transfer"
  | "Entertainment"
  | "Education"
  | "Personal Care"
  | "Unknown";

interface Rule {
  pattern: RegExp;
  category: Category;
  merchant?: string;
}

export const CATEGORY_RULES: Rule[] = [
  // Income
  { pattern: /\b(payroll|salary|direct dep|direct deposit|ach credit|employer|paycheck)\b/i, category: "Income" },
  { pattern: /\b(refund|reimbursement|cashback|cash back)\b/i, category: "Income" },
  { pattern: /\b(interest paid|interest earned|dividend)\b/i, category: "Income" },
  { pattern: /\b(zelle in|venmo credit|paypal credit)\b/i, category: "Income" },

  // Transfer
  { pattern: /\b(transfer|wire|zelle|venmo|paypal|cash app|chime|sofi)\b/i, category: "Transfer" },
  { pattern: /\b(atm withdrawal|atm cash|withdrawal)\b/i, category: "Transfer" },

  // Groceries
  { pattern: /\b(wholefds|whole foods|trader joe|trader joes|sprouts|safeway|kroger|publix|wegmans|aldi|costco|sams club|sam's club|bj's wholesale|bjs|food lion|stop & shop|stop and shop|harris teeter|meijer|h-e-b|heb|market basket|shoprite|giant food|vons|ralphs|fred meyer|albertsons|piggly wiggly|winn dixie|winn-dixie|stater bros|lucky stores|save mart|price chopper)\b/i, category: "Groceries" },
  { pattern: /\b(fresh market|earth fare|natural grocers|lucky's market)\b/i, category: "Groceries" },

  // Food & Dining
  { pattern: /\b(starbucks|dunkin|dunkin donuts|mcdonald|mcdonalds|chipotle|subway|dominos|domino's|pizza hut|kfc|taco bell|wendy's|wendys|burger king|chick-fil-a|chickfila|five guys|popeyes|sonic|arby's|arbys|panera|panda express|in-n-out|shake shack|sweetgreen|cava|wingstop|zaxbys|raising canes|culvers|whataburger|del taco|jack in the box|carl's jr)\b/i, category: "Food & Dining" },
  { pattern: /\b(doordash|uber eats|ubereats|grubhub|instacart delivery|seamless|postmates|gopuff)\b/i, category: "Food & Dining" },
  { pattern: /\b(restaurant|cafe|coffee|bakery|sushi|pizza|burger|grill|bistro|diner|eatery|bar & grill|bbq|ramen|pho|thai|chinese|italian|mexican|steakhouse|seafood|wings|bagel)\b/i, category: "Food & Dining" },
  { pattern: /\b(tst\*|sq \*|squarup)\b/i, category: "Food & Dining" },

  // Transportation
  { pattern: /\b(uber|lyft|taxi|cab|ride)\b/i, category: "Transportation" },
  { pattern: /\b(shell|chevron|exxon|mobil|bp |sunoco|marathon|valero|citgo|speedway|wawa|quicktrip|qt |casey's|pilot travel|loves travel|circle k gas|racetrac|kwik trip|kwiktrip|murphy usa|racetrack|gate petroleum)\b/i, category: "Transportation" },
  { pattern: /\b(gas station|fuel|gasoline)\b/i, category: "Transportation" },
  { pattern: /\b(parking|meter|park plus|parkwhiz|spothero|parkmobile|lazerparking)\b/i, category: "Transportation" },
  { pattern: /\b(metro|subway fare|transit|mta|bart|caltrain|amtrak|greyhound|megabus|flixbus)\b/i, category: "Transportation" },
  { pattern: /\b(car wash|auto repair|jiffy lube|firestone|pep boys|autozone|advance auto|napa auto|o'reilly auto|oreilly)\b/i, category: "Transportation" },
  { pattern: /\b(geico|progressive insurance|state farm|allstate|aaa)\b/i, category: "Transportation" },

  // Subscriptions
  { pattern: /\b(netflix|hulu|disney\+|disneyplus|hbo|max |peacock|paramount\+|paramountplus|apple tv\+|appletv|espn\+|crunchyroll|fubo|sling|youtube premium)\b/i, category: "Subscriptions" },
  { pattern: /\b(spotify|apple music|tidal|pandora|amazon music|sirius xm|siriusxm)\b/i, category: "Subscriptions" },
  { pattern: /\b(amazon prime|amazon web services|aws|microsoft 365|office 365|microsoft subscription|google one|icloud|dropbox|box\.com)\b/i, category: "Subscriptions" },
  { pattern: /\b(adobe|canva|figma|notion|slack|zoom|atlassian|github|digitalocean|heroku|cloudflare)\b/i, category: "Subscriptions" },
  { pattern: /\b(planet fitness|la fitness|gold's gym|anytime fitness|equinox|24 hour fitness|crunch fitness|ymca|peloton)\b/i, category: "Subscriptions" },
  { pattern: /\b(duolingo|coursera|udemy|linkedin learning|masterclass|skillshare)\b/i, category: "Subscriptions" },
  { pattern: /\b(nyt|new york times|washington post|wsj|wall street journal|medium\.com|substack)\b/i, category: "Subscriptions" },

  // Travel
  { pattern: /\b(airline|air canada|delta|united airlines|american airlines|southwest|jetblue|spirit airlines|frontier|alaska airlines|lufthansa|british airways|virgin)\b/i, category: "Travel" },
  { pattern: /\b(airbnb|vrbo|booking\.com|hotels\.com|expedia|marriott|hilton|hyatt|ihg|wyndham|choice hotels|radisson|best western|holiday inn|sheraton|westin|ritz carlton)\b/i, category: "Travel" },
  { pattern: /\b(hotel|motel|resort|inn |suites)\b/i, category: "Travel" },
  { pattern: /\b(tsa precheck|global entry|nexus|clear travel)\b/i, category: "Travel" },

  // Health & Medical
  { pattern: /\b(cvs|walgreens|rite aid|duane reade|health mart)\b/i, category: "Health & Medical" },
  { pattern: /\b(hospital|clinic|doctor|physician|dentist|orthodontist|optometrist|ophthalmologist|chiropractor|dermatologist|urgent care|emergency room|pharmacy|rx |prescription)\b/i, category: "Health & Medical" },
  { pattern: /\b(health insurance|blue cross|aetna|cigna|humana|united health|kaiser|anthem|bcbs)\b/i, category: "Health & Medical" },

  // Utilities
  { pattern: /\b(electric|electricity|gas bill|water bill|sewer|utilities|pge|pg&e|con ed|coned|duke energy|southern company|dominion energy|xcel energy|national grid|consumers energy|we energies|dte energy)\b/i, category: "Utilities" },
  { pattern: /\b(internet|broadband|comcast|xfinity|att|verizon fios|spectrum|cox cable|charter|dish network|directv|t-mobile home|optimum)\b/i, category: "Utilities" },
  { pattern: /\b(phone bill|wireless|verizon wireless|at&t wireless|sprint|boost mobile|metro pcs|metropcs|cricket wireless|visible|mint mobile)\b/i, category: "Utilities" },
  { pattern: /\b(trash|waste management|garbage|recycling pickup)\b/i, category: "Utilities" },

  // Rent & Housing
  { pattern: /\b(rent|lease payment|mortgage|hoa|homeowners association|property tax|renters insurance|home insurance)\b/i, category: "Rent & Housing" },
  { pattern: /\b(home depot|lowe's|lowes|ace hardware|true value|menards|ikea|wayfair|bed bath|williams sonoma|pottery barn|restoration hardware|rh |west elm)\b/i, category: "Rent & Housing" },

  // Entertainment
  { pattern: /\b(amc theaters|regal cinemas|cinemark|alamo drafthouse|fandango|atom tickets)\b/i, category: "Entertainment" },
  { pattern: /\b(ticketmaster|stubhub|vivid seats|seat geek|eventbrite|live nation)\b/i, category: "Entertainment" },
  { pattern: /\b(bowling|arcade|topgolf|dave & buster|dave and busters|escape room|mini golf)\b/i, category: "Entertainment" },
  { pattern: /\b(twitch|steam|xbox|playstation|nintendo|apple arcade|google play|app store games)\b/i, category: "Entertainment" },
  { pattern: /\b(museum|zoo|aquarium|national park|theme park|six flags|universal studios|disney park|seaworld)\b/i, category: "Entertainment" },

  // Education
  { pattern: /\b(tuition|student loan|college|university|school fee|textbook|campus store|bookstore)\b/i, category: "Education" },

  // Personal Care
  { pattern: /\b(salon|hair|barbershop|barber|nail salon|spa |massage|waxing|ulta|sephora)\b/i, category: "Personal Care" },

  // Shopping (catch-all)
  { pattern: /\b(amazon|target|walmart|bestbuy|best buy|costco|sams club|nordstrom|macys|macy's|tj maxx|tjmaxx|marshalls|ross stores|gap|old navy|banana republic|h&m|zara|uniqlo|forever 21|forever21|urban outfitters|anthropologie|free people|j\.crew|jcrew|american eagle|ae |hollister|express stores|victoria's secret|vs pink|calvin klein|ralph lauren|tommy hilfiger|columbia sportswear|north face|patagonia|rei outdoor|dick's sporting|dicks sporting|academy sports|bass pro|cabela's|chewy|petco|petsmart|wayfair|overstock|newegg|b&h photo|adorama|apple store|samsung|microsoft store|staples|office depot|office max|dollar tree|dollar general|family dollar|five below|tuesday morning|at home stores|world market|pier 1|crate and barrel)\b/i, category: "Shopping" },
];

export function categorizeByRules(description: string): { category: Category; merchant: string } | null {
  const desc = description.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(desc)) {
      return {
        category: rule.category,
        merchant: rule.merchant || extractMerchantName(description),
      };
    }
  }

  return null;
}

export function extractMerchantName(rawDescription: string): string {
  let cleaned = rawDescription;

  // Remove common noise patterns
  cleaned = cleaned.replace(/\b\d{4,}\b/g, ""); // long numbers (card numbers, refs)
  cleaned = cleaned.replace(/\d{2}\/\d{2}(?:\/\d{2,4})?/g, ""); // dates
  cleaned = cleaned.replace(/\b(ach|pos|pmt|pymt|debit|credit|purchase|payment|recurring|online|www\.|http)/gi, "");
  cleaned = cleaned.replace(/\b[A-Z]{2}\b(?=\s|$)/g, ""); // state abbreviations at end
  cleaned = cleaned.replace(/\*+/g, " "); // asterisks
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  cleaned = cleaned.replace(/^[^a-zA-Z]+/, ""); // leading non-alpha chars

  // Take first meaningful words (up to 3)
  const words = cleaned.split(/\s+/).slice(0, 3);
  return words.join(" ").trim() || rawDescription.slice(0, 30).trim();
}
