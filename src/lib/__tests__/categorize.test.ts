import { describe, expect, it } from 'vitest';
import { categorize, categorizeWithHint } from '../categorize';

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

  it('recognises real statement merchants (Capitec/FNB)', () => {
    expect(categorize('Checkers Sb079461 (Card 4481)')).toBe('Groceries');
    expect(categorize('PnP Crp Douglasdale')).toBe('Groceries');
    expect(categorize('Big Five Slaghuis Kenmare')).toBe('Groceries');
    expect(categorize('Sasol Lyttleton Manor')).toBe('Fuel');
    expect(categorize('Interne Debiet Order FNB H Loan 00003000020038539')).toBe('Bond');
    expect(categorize('Eft Debit Order Hm Connect')).toBe('Phone & Internet');
    expect(categorize('DebiCheck Old Mutual0000Ecfe61')).toBe('Insurance');
    expect(categorize('Gereeld Bet Na Kar Versekkering Anjo Versekkering')).toBe('Insurance');
    expect(categorize('Eft Debit Order Cap Legacy400868397 Netcash')).toBe('Insurance');
    expect(categorize('Recurring Card Purchase: Netflix Amsterdam')).toBe('Subscriptions');
    expect(categorize('Banking App External Payment: Discovery Credit Car')).toBe('Credit Card');
    expect(categorize('#Maandelike Diens Fooi')).toBe('Bank Fees');
    expect(categorize('Betaaling Na Belegging Spaar')).toBe('Savings & Investments');
  });

  it('categorises new lifestyle categories', () => {
    expect(categorize('Banking App External Payment: Inyati Sands Body Co')).toBe('Housing');
    expect(categorize('Family Barber S 223560 Centurion')).toBe('Personal Care');
    expect(categorize('Online Purchase: Playtomic Madrid')).toBe('Hobbies');
    expect(categorize('Epic Karting Muldersdrift')).toBe('Hobbies');
    expect(categorize('Banking App External Payment: Nita Vakansie')).toBe('Holiday');
    expect(categorize('Online Purchase: Www.capago.eu Gif Sur Yvett')).toBe('Holiday');
    expect(categorize('Banking App External Payment: Iexchange')).toBe('Holiday');
    expect(categorize('Banking App Immediate Payment: Georgina')).toBe('Domestic');
    expect(categorize('Banking App External Payment: Maria Domestic')).toBe('Domestic');
    expect(categorize('Movies@monte Fourways')).toBe('Entertainment');
  });
});

describe('categorizeWithHint', () => {
  it('trusts a mapped bank-provided category over keyword matching', () => {
    expect(categorizeWithHint('PnP Crp Douglasdale', 'Groceries')).toBe('Groceries');
    expect(categorizeWithHint('Payment Received: Salary Salary 3125913287', 'Salary')).toBe('Salary');
    expect(categorizeWithHint('Debit Order Fee', 'Fees')).toBe('Bank Fees');
  });

  it('maps bank categories to new FinTrack categories', () => {
    expect(categorizeWithHint('Playtomic Madrid', 'Sport & Hobbies')).toBe('Hobbies');
    expect(categorizeWithHint('Booking.com Trip', 'Holiday')).toBe('Holiday');
    expect(categorizeWithHint('Family Barber', 'Personal Care')).toBe('Personal Care');
    expect(categorizeWithHint('Discovery Credit Car', 'Credit Card Payments')).toBe('Credit Card');
  });

  it('falls back to keyword rules when the bank category has no mapping', () => {
    expect(categorizeWithHint('Banking App Transfer to Nuwe Foon: Transfer', 'Transfer')).toBe(
      'Uncategorised',
    );
  });

  it('falls back to keyword rules when no hint is given', () => {
    expect(categorizeWithHint('Purchase Checkers Sandton')).toBe('Groceries');
  });
});
