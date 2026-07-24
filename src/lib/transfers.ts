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
//   Capitec current → card:      "Banking App External Payment: Discovery Credit Car"
//   Capitec current → notice:    "Banking App Transfer to Nuwe Foon/Nuwe Kar"
//   Notice ← Capitec current:    "Banking App Transfer Received from Main Account"
//   Card ← Capitec (repayment):  "CAPITEC   CREDIT"
//   Discovery savings ← Capitec: "CAPITEC   SAVINGS"
//   Card/savings forex moves:    "1 EUR = 18.90… ZAR"  (Type: FX Transfer)
//   Card → Discovery savings:    "Savings" / "Credit to Savings" / notice payout
//   Ring loan repayments:        "CAPITEC   RING"

const TRANSFER_PATTERNS: RegExp[] = [
  /discovery\s+credit\s+car/i, // Capitec side of a card repayment
  /transfer\s+to\s+nuwe\s+(foon|kar)/i, // Capitec → notice-savings
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
