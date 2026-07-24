import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
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
  'Salary', 'Other Income', 'Transfer', 'Uncategorised',
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

function cacheLocally(dash: DashKey, settings: DashSettings) {
  const all = loadFromStorage();
  all[dash] = settings;
  saveToStorage(all);
}

/** Categories the app assigns on its own, so they must always be selectable
 *  even if a saved settings row predates them (the stored list replaces the
 *  defaults wholesale, so a new default would otherwise never reach anyone). */
const REQUIRED_CATEGORIES = ['Transfer', 'Uncategorised'];

export function withRequired(categories: string[]): string[] {
  const missing = REQUIRED_CATEGORIES.filter((c) => !categories.includes(c));
  return missing.length === 0 ? categories : [...categories, ...missing];
}

export function getDefaults(): DashSettings {
  return { categories: [...DEFAULT_CATEGORIES], fixedCategories: [...DEFAULT_FIXED] };
}

/** Settings live in the fintrack_settings table so every device and both
 *  users see the same category lists; localStorage is only a cache so the
 *  dashboard renders instantly (and still works offline). */
export function useSettings(dash: DashKey) {
  const [settings, setSettings] = useState<DashSettings>(() => {
    const all = loadFromStorage();
    const s = all[dash] ?? getDefaults();
    return { ...s, categories: withRequired(s.categories) };
  });
  const [syncError, setSyncError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const all = loadFromStorage();
    const cached = all[dash] ?? getDefaults();
    setSettings({ ...cached, categories: withRequired(cached.categories) });
    void supabase
      .from('fintrack_settings')
      .select('categories, fixed_categories')
      .eq('dash_key', dash)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const remote: DashSettings = {
          categories: withRequired(data.categories as string[]),
          fixedCategories: data.fixed_categories as string[],
        };
        cacheLocally(dash, remote);
        setSettings(remote);
      });
    return () => {
      cancelled = true;
    };
  }, [dash]);

  const update = useCallback((patch: Partial<DashSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      cacheLocally(dash, next);
      // Surface a failed sync instead of silently drifting: the local cache
      // has already advanced, so the user must know other devices won't see
      // this change until a later edit succeeds.
      void supabase.from('fintrack_settings').upsert({
        dash_key: dash,
        categories: next.categories,
        fixed_categories: next.fixedCategories,
        updated_at: new Date().toISOString(),
      }).then(({ error }) => setSyncError(Boolean(error)));
      return next;
    });
  }, [dash]);

  return { settings, update, syncError };
}
