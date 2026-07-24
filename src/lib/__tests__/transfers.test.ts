import { describe, expect, it } from 'vitest';
import { isTransferDescription } from '../transfers';

describe('isTransferDescription', () => {
  it('flags Capitec → card / notice-savings moves', () => {
    expect(isTransferDescription('Banking App External Payment: Discovery Credit Car')).toBe(true);
    expect(isTransferDescription('Banking App Transfer to Nuwe Foon: Transfer')).toBe(true);
    expect(isTransferDescription('Banking App Transfer to Nuwe Kar: Transfer')).toBe(true);
    expect(isTransferDescription('Banking App Transfer Received from Main Account: Transfer')).toBe(true);
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
