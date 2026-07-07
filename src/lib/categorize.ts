// Keyword auto-categorisation for SA merchants. Edit freely — first match wins.
// Applies to CSV, PDF, and paste imports; the review screen can override.

interface Rule {
  match: RegExp;
  category: string;
}

export const RULES: Rule[] = [
  // income
  { match: /salar|salaris|wages|loon\b/i, category: 'Salary' },
  { match: /interest received|refund|cashback|cash back/i, category: 'Other Income' },
  // groceries
  { match: /checkers|shoprite|pick n pay|pnp|woolworths|woolies|spar\b|food lover|boxer|usave|ok foods/i, category: 'Groceries' },
  // fuel
  { match: /engen|sasol|shell|bp\b|total\s?energies|caltex|astron|fuel|petrol|garage/i, category: 'Fuel' },
  // bond / home loan repayment
  { match: /bond|home loan|h loan|huislening/i, category: 'Bond' },
  // housing
  { match: /rent\b|rental|levy|levies|body co/i, category: 'Housing' },
  // utilities
  { match: /eskom|city of|municipal|prepaid elec|electricity|water and lights|rates\b/i, category: 'Utilities' },
  // phone & internet
  { match: /vodacom|mtn\b|telkom|cell c|rain\b|afrihost|webafrica|fibre|hm connect/i, category: 'Phone & Internet' },
  // subscriptions
  { match: /netflix|spotify|youtube|dstv|dsv?tv|showmax|disney|apple\.com|icloud|amazon prime|google one|claude|openai|xbox|playstation/i, category: 'Subscriptions' },
  // eating out
  { match: /nando|kfc|mcdonald|mcd\b|steers|wimpy|spur\b|debonairs|roman'?s|pizza|burger king|starbucks|vida|mugg\s?&?\s?bean|ocean basket|uber\s?eats|mr d food/i, category: 'Eating Out' },
  // transport
  { match: /uber(?!\s?eats)|bolt\b|gautrain|toll|sanral|e-?toll|parking|tap n go/i, category: 'Transport' },
  // medical
  { match: /clicks|dis-?chem|pharmac|doctor|dr\s|hospital|pathcare|lancet|medirite|4d scan/i, category: 'Medical' },
  // credit card repayments before the insurer names ("Discovery Credit Car")
  { match: /credit car/i, category: 'Uncategorised' },
  // insurance (incl. Afrikaans "versekering" and local insurers)
  { match: /discovery|momentum|sanlam|old mutual|outsurance|santam|miway|king price|1life|liberty|versek|dotsure|naked ins|cap legacy|shackleton/i, category: 'Insurance' },
  // baby
  { match: /baby city|babies|toys r us|purity|pampers|huggies/i, category: 'Baby' },
  // clothing
  { match: /mr price|mrp\b|edgars|foschini|truworths|ackermans|pep\b|pepco|h&m|zara|cotton on/i, category: 'Clothing' },
  // entertainment
  { match: /ster-?kinekor|nu metro|computicket|ticketpro|steam|epic games/i, category: 'Entertainment' },
  // shopping
  { match: /takealot|makro|game\b|builders|leroy|west pack|clicks baby|amazon|temu|shein/i, category: 'Shopping' },
  // groceries (butcheries)
  { match: /slaghuis|butcher/i, category: 'Groceries' },
  // entertainment (padel etc.)
  { match: /playtomic|padel/i, category: 'Entertainment' },
  // bank fees (incl. Afrikaans "diensfooi")
  { match: /fee\b|fees\b|monthly acc|admin charge|service charge|sms notif|diensfooi|maandelikse diens|fooi\b/i, category: 'Bank Fees' },
  // savings & investments (incl. Afrikaans "belegging"/"spaar")
  { match: /easy equities|easyequities|satrix|allan gray|coronation|10x\b|savings|fixed dep|notice dep|tyme.*save|belegging|spaar\b/i, category: 'Savings & Investments' },
];

/** Some bank exports (Capitec CSV) ship their own category column. Translate
 *  the ones that map cleanly onto our set; anything else falls back to the
 *  keyword rules. */
const BANK_CATEGORY_MAP: Record<string, string> = {
  groceries: 'Groceries',
  takeaways: 'Eating Out',
  restaurants: 'Eating Out',
  fuel: 'Fuel',
  fees: 'Bank Fees',
  'life insurance': 'Insurance',
  'home insurance': 'Insurance',
  'funeral cover': 'Insurance',
  internet: 'Phone & Internet',
  salary: 'Salary',
  'digital subscriptions': 'Subscriptions',
  movies: 'Entertainment',
  'software/games': 'Entertainment',
  'sport & hobbies': 'Entertainment',
  holiday: 'Entertainment',
  'online store': 'Shopping',
  'books/stationery': 'Shopping',
  'clothing & shoes': 'Clothing',
  pharmacy: 'Medical',
  'doctors & therapists': 'Medical',
  parking: 'Transport',
  tolls: 'Transport',
  'vehicle maintenance': 'Transport',
  interest: 'Other Income',
  refunds: 'Other Income',
  'other income': 'Other Income',
};

export function categorizeWithHint(description: string, bankCategory?: string): string {
  if (bankCategory) {
    const mapped = BANK_CATEGORY_MAP[bankCategory.trim().toLowerCase()];
    if (mapped) return mapped;
  }
  return categorize(description);
}

export function categorize(description: string): string {
  for (const rule of RULES) {
    if (rule.match.test(description)) return rule.category;
  }
  return 'Uncategorised';
}
