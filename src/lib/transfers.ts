// Inter-account transfer detection. A transfer is money moving between the
// household's own accounts (Capitec current ↔ notice-savings, Capitec ↔
// Discovery credit card, credit card ↔ Discovery savings, forex moves). These
// must NOT count as income or expenses — the real expense is the purchase on
// whichever account it lands on, counted once; the movement that funds it is
// neutral. Balances (net worth / reconciliation) still include transfers,
// because a transfer genuinely changes each account's balance.
//
// Detection runs on the statement's description text. The patterns are drawn
// from the real Capitec and Discovery exports:
//   Capitec current → notice:    "Banking App Transfer to Nuwe Foon/Nuwe Kar"
//   Notice ← Capitec current:    "Banking App Transfer Received from Main Account"
//   Card ← Capitec (repayment):  "CAPITEC   CREDIT"
//   Discovery savings ← Capitec: "CAPITEC   SAVINGS"
//   Card/savings forex moves:    "1 EUR = 18.90… ZAR"  (Type: FX Transfer)
//   Card → Discovery savings:    "Savings" / "Credit to Savings" / notice payout
//   Ring loan repayments:        "CAPITEC   RING"

// The Capitec side of a Discovery card repayment — "Banking App External
// Payment: Discovery Credit Car" — is deliberately NOT here.
//
// It is only a transfer if the card's own statement is imported, because then
// the purchases it funded are counted on that side. The Discovery statement is
// not imported and is not going to be: the card was used for fuel and Vodacom
// airtime, settled from Capitec, so the repayment line IS the only record of
// that spending. Flagging it would delete roughly R8k a month of real spend
// from every dashboard and show it as an improvement.
//
// It was matched here once, which is why the ~36 repayments already in the
// table are is_transfer = false: they were imported before this module
// existed. Re-adding the pattern would split identical rows by import date —
// history counted as spend, everything new excluded.
//
// If the Discovery statement is ever imported, restore
// `/discovery\s+credit\s+car/i` below AND backfill those rows, together. The
// card-side patterns further down ("CAPITEC   CREDIT" and friends) are the
// mirror of it and stay: they can only ever appear on a Discovery export, so
// they are dormant until that day.
const TRANSFER_PATTERNS: RegExp[] = [
  // Capitec → any savings plan. Anchored on "Banking App Transfer to", which
  // is the wording Capitec reserves for moving money between your OWN
  // accounts; paying someone else reads "Banking App External Payment" or
  // "Payment to". Matching the structure rather than the plan names means a
  // new savings pot is caught the first time it appears, instead of quietly
  // counting as spending until someone notices and adds it here.
  /banking\s+app\s+transfer\s+to\s+/i,
  // Belt and braces for the household's "Nuwe <thing>" naming, in case the
  // same move ever arrives without the Banking App prefix.
  /\btransfer\s+to\s+nuwe\s+/i,
  /transfer\s+received\s+from\s+main\s+account/i, // notice-savings ← Capitec
  /capitec\s+credit\b/i, // card ← Capitec repayment
  /capitec\s+savings\b/i, // Discovery savings ← Capitec deposit
  /capitec\s+ring\b/i, // ring-loan repayment
  /\bEUR\b.*\bZAR\b/i, // forex conversion (FX Transfer)
  /notice\s+savings\s+account\s+payout/i, // notice-savings payout
  /credit\s+to\s+savings/i, // card → savings sweep
  /^\s*savings\s*$/i, // bare "Savings" transfer row (Discovery)
];

/** True when a statement line is an inter-account transfer rather than real
 *  spend or income. Case-insensitive; matches on the description text. */
export function isTransferDescription(description: string | null | undefined): boolean {
  if (!description) return false;
  return TRANSFER_PATTERNS.some((p) => p.test(description));
}
