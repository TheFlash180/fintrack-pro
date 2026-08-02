import { describe, expect, it } from 'vitest';
import { isTransferDescription } from '../transfers';

describe('isTransferDescription', () => {
  it('flags Capitec → notice-savings moves', () => {
    expect(isTransferDescription('Banking App Transfer to Nuwe Foon: Transfer')).toBe(true);
    expect(isTransferDescription('Banking App Transfer to Nuwe Kar: Transfer')).toBe(true);
    expect(isTransferDescription('Banking App Transfer Received from Main Account: Transfer')).toBe(true);
  });

  it('does NOT flag the Capitec side of a Discovery card repayment', () => {
    // The card's own statement is not imported, so this line is the only
    // record of what the card bought (fuel and Vodacom airtime). Calling it a
    // transfer would drop that spending out of the totals entirely — and would
    // treat it differently from the repayments already in the table, which
    // predate this module and are stored as spend. See transfers.ts.
    expect(isTransferDescription('Banking App External Payment: Discovery Credit Car'))
      .toBe(false);
  });

  it('flags Discovery card / savings transfers', () => {
    expect(isTransferDescription('CAPITEC   CREDIT')).toBe(true); // repayment received on card
    expect(isTransferDescription('CAPITEC   SAVINGS')).toBe(true); // deposit into savings
    expect(isTransferDescription('CAPITEC   RING AFBETAAL')).toBe(true);
    expect(isTransferDescription('1 EUR = 18.9037442759 ZAR')).toBe(true); // forex move
    expect(isTransferDescription('Notice savings account payout')).toBe(true);
    expect(isTransferDescription('Savings')).toBe(true);
    expect(isTransferDescription('Credit to Savings')).toBe(true);
  });

  it('catches a savings pot it has never seen before', () => {
    // The rule is anchored on Capitec's "Banking App Transfer to" wording
    // rather than on the pot names, so a new plan is caught the first time it
    // appears instead of quietly counting as spending until someone notices.
    expect(isTransferDescription('Banking App Transfer to Nuwe Huis: Transfer')).toBe(true);
    expect(isTransferDescription('Banking App Transfer to Vakansie: Transfer')).toBe(true);
    expect(isTransferDescription('Banking App Transfer to Emergency Fund')).toBe(true);
  });

  it('does not treat an incoming payment as a transfer just for saying "transfer"', () => {
    // A real R550 received from a person. A naive /transfer/ rule would strip
    // this out of income — it is the counter-example the pattern is shaped by.
    expect(isTransferDescription('Payment Received: Absa Bank Reinardt Transfer 3249102665'))
      .toBe(false);
  });

  it('does not treat paying someone else as an internal transfer', () => {
    expect(isTransferDescription('Banking App External Payment: Maria Domestic')).toBe(false);
    expect(isTransferDescription('Banking App External Payment: Pastor Wayne Church')).toBe(false);
  });

  it('does NOT flag real spend or income', () => {
    expect(isTransferDescription('Engen Waverley (Card 9775)')).toBe(false);
    expect(isTransferDescription('VODACOM 0488057208 I9022876')).toBe(false); // airtime = real spend
    expect(isTransferDescription('Recurring Immediate Payment: Kar Versekering')).toBe(false); // car insurance, not Nuwe Kar
    expect(isTransferDescription('Interest Received')).toBe(false);
    expect(isTransferDescription('Interest Earned at 7.20%')).toBe(false);
    expect(isTransferDescription('Payment Received: Salary Salary 3252959216')).toBe(false);
    expect(isTransferDescription('Monthly Account fee')).toBe(false);
    expect(isTransferDescription('')).toBe(false);
    expect(isTransferDescription(null)).toBe(false);
  });
});
