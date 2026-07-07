import { useCallback, useEffect, useState } from 'react';
import type { DashKey } from './types';

export interface DashSettings {
  categories: string[];
  fixedCategories: string[];
}

const DEFAULT_CATEGORIES = [
  'Groceries', 'Fuel', 'Housing', 'Bond', 'Utilities', 'Phone & Internet',
  'Subscriptions', 'Eating Out', 'Transport', 'Medical', 'Insurance',
  'Credit Card', 'Domestic', 'Baby', 'Clothing', 'Entertainment', 'Hobbies',
  'Holiday', 'Personal Care', 'Shopping', 'Bank Fees', 'Savings & Investments',
  'Salary', 'Other Income', 'Uncategorised',
];

const DEFAULT_FIXED = [
  'Housing', 'Bond', 'Insurance', 'Phone & Internet', 'Subscriptions',
  'Domestic', 'Utilities', 'Credit Card', 'Bank Fees',
];

const STORAGE_KEY = 'fintrack_settings';

function loadFromStorage(): Record<string, DashSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(all: Record<string, DashSettings>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getDefaults(): DashSettings {
  return { categories: [...DEFAULT_CATEGORIES], fixedCategories: [...DEFAULT_FIXED] };
}

export function useSettings(dash: DashKey) {
  const [settings, setSettings] = useState<DashSettings>(() => {
    const all = loadFromStorage();
    return all[dash] ?? getDefaults();
  });

  useEffect(() => {
    const all = loadFromStorage();
    setSettings(all[dash] ?? getDefaults());
  }, [dash]);

  const update = useCallback((patch: Partial<DashSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      const all = loadFromStorage();
      all[dash] = next;
      saveToStorage(all);
      return next;
    });
  }, [dash]);

  return { settings, update };
}
