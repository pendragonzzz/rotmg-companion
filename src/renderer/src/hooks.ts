import { useCallback, useEffect, useState } from 'react';

// ---- themes ----
export const THEMES = [
  { value: 'realm', label: 'Realm · Gold' },
  { value: 'crimson', label: 'Oryx · Crimson' },
  { value: 'void', label: 'The Void · Purple' },
  { value: 'abyss', label: 'Abyss · Teal' },
  { value: 'daylight', label: 'Daylight · Light' },
];

const THEME_KEY = 'rotmg-theme';

export function useTheme(): [string, (t: string) => void] {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) ?? 'realm');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);
  return [theme, setTheme];
}

// ---- recent player searches ----
const RECENT_KEY = 'rotmg-recent-players';
const RECENT_MAX = 8;

export interface RecentApi {
  recent: string[];
  add(name: string): void;
  remove(name: string): void;
}

export function useRecentPlayers(): RecentApi {
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
      return Array.isArray(v) ? (v as string[]) : [];
    } catch {
      return [];
    }
  });

  const add = useCallback((name: string) => {
    const n = name.trim();
    if (!n) return;
    setRecent((prev) => {
      const next = [n, ...prev.filter((p) => p.toLowerCase() !== n.toLowerCase())].slice(0, RECENT_MAX);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const remove = useCallback((name: string) => {
    setRecent((prev) => {
      const next = prev.filter((p) => p.toLowerCase() !== name.toLowerCase());
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { recent, add, remove };
}

// ---- declined quests (per class) ----
const DECLINED_KEY = 'rotmg-declined';
type DeclinedStore = Record<string, string[]>;
const EMPTY: string[] = [];

function loadDeclined(): DeclinedStore {
  try {
    return JSON.parse(localStorage.getItem(DECLINED_KEY) ?? '{}') as DeclinedStore;
  } catch {
    return {};
  }
}

export interface DeclinedApi {
  listFor(className: string): string[];
  decline(className: string, id: string): void;
  restore(className: string, id: string): void;
}

export function useDeclined(): DeclinedApi {
  const [store, setStore] = useState<DeclinedStore>(loadDeclined);

  const persist = useCallback((next: DeclinedStore) => {
    setStore(next);
    localStorage.setItem(DECLINED_KEY, JSON.stringify(next));
  }, []);

  const listFor = useCallback((cls: string) => store[cls.toLowerCase()] ?? EMPTY, [store]);

  const decline = useCallback(
    (cls: string, id: string) => {
      const k = cls.toLowerCase();
      const set = new Set(store[k] ?? []);
      set.add(id);
      persist({ ...store, [k]: [...set] });
    },
    [store, persist],
  );

  const restore = useCallback(
    (cls: string, id: string) => {
      const k = cls.toLowerCase();
      const set = new Set(store[k] ?? []);
      set.delete(id);
      persist({ ...store, [k]: [...set] });
    },
    [store, persist],
  );

  return { listFor, decline, restore };
}
