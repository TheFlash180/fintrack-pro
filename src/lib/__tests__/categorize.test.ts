import { describe, expect, it } from 'vitest';
import { categorize } from '../categorize';

describe('categorize', () => {
  it('maps SA merchants to categories', () => {
    expect(categorize('Purchase Checkers Sandton')).toBe('Groceries');
    expect(categorize('POS Purchase Woolworths Fourways')).toBe('Groceries');
    expect(categorize('Purchase ENGEN Rivonia')).toBe('Fuel');
    expect(categorize('Debit Order Netflix.com')).toBe('Subscriptions');
    expect(categorize('Vodacom Airtime')).toBe('Phone & Internet');
    expect(categorize('Salary Payment Employer XYZ')).toBe('Salary');
    expect(categorize('Monthly Account Admin Fee')).toBe('Bank Fees');
    expect(categorize('Internet Pmt To Baby City')).toBe('Baby');
  });

  it('distinguishes Uber rides from Uber Eats', () => {
    expect(categorize('UBER TRIP JOHANNESBURG')).toBe('Transport');
    expect(categorize('UBER EATS ORDER')).toBe('Eating Out');
  });

  it('falls back to Uncategorised', () => {
    expect(categorize('Mystery Merchant 42')).toBe('Uncategorised');
  });
});
