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
  // housing
  { match: /bond|home loan|rent\b|rental|levy|levies|body corporate/i, category: 'Housing' },
  // utilities
  { match: /eskom|city of|municipal|prepaid elec|electricity|water and lights|rates\b/i, category: 'Utilities' },
  // phone & internet
  { match: /vodacom|mtn\b|telkom|cell c|rain\b|afrihost|webafrica|fibre/i, category: 'Phone & Internet' },
  // subscriptions
  { match: /netflix|spotify|youtube|dstv|dsv?tv|showmax|disney|apple\.com|icloud|amazon prime|google one|claude|openai|xbox|playstation/i, category: 'Subscriptions' },
  // eating out
  { match: /nando|kfc|mcdonald|mcd\b|steers|wimpy|spur\b|debonairs|roman'?s|pizza|burger king|starbucks|vida|mugg\s?&?\s?bean|ocean basket|uber\s?eats|mr d food/i, category: 'Eating Out' },
  // transport
  { match: /uber(?!\s?eats)|bolt\b|gautrain|toll|sanral|e-?toll|parking/i, category: 'Transport' },
  // medical
  { match: /clicks|dis-?chem|pharmac|doctor|dr\s|hospital|pathcare|lancet|medirite/i, category: 'Medical' },
  // insurance
  { match: /discovery|momentum|sanlam|old mutual|outsurance|santam|miway|king price|1life|liberty/i, category: 'Insurance' },
  // baby
  { match: /baby city|babies|toys r us|purity|pampers|huggies/i, category: 'Baby' },
  // clothing
  { match: /mr price|mrp\b|edgars|foschini|truworths|ackermans|pep\b|pepco|h&m|zara|cotton on/i, category: 'Clothing' },
  // entertainment
  { match: /ster-?kinekor|nu metro|computicket|ticketpro|steam|epic games/i, category: 'Entertainment' },
  // shopping
  { match: /takealot|makro|game\b|builders|leroy|west pack|clicks baby|amazon|temu|shein/i, category: 'Shopping' },
  // bank fees
  { match: /fee\b|fees\b|monthly acc|admin charge|service charge|sms notif/i, category: 'Bank Fees' },
  // savings & investments
  { match: /easy equities|easyequities|satrix|allan gray|coronation|10x\b|savings|fixed dep|notice dep|tyme.*save/i, category: 'Savings & Investments' },
];

export function categorize(description: string): string {
  for (const rule of RULES) {
    if (rule.match.test(description)) return rule.category;
  }
  return 'Uncategorised';
}
