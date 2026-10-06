import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_OVERLAY_SETTINGS, type OverlaySettings, type OverlayState } from '../../shared/overlay';
import { EMPTY_GAME_STATE, type GameState } from '../../shared/location';
import type { PageId } from './pages';

// ---- themes ----
export const THEMES = [
  { value: 'realm', label: 'Realm · Gold', swatch: ['#0b0d12', '#161a24', '#f5b342'] },
  { value: 'crimson', label: 'Oryx · Crimson', swatch: ['#120c0e', '#1d1316', '#ef4444'] },
  { value: 'void', label: 'The Void · Purple', swatch: ['#0d0b16', '#181428', '#a855f7'] },
  { value: 'abyss', label: 'Abyss · Teal', swatch: ['#08110f', '#111d1b', '#2dd4bf'] },
  { value: 'sprite', label: 'Sprite Forest · Green', swatch: ['#0a110b', '#121c14', '#84cc16'] },
  { value: 'midnight', label: 'Midnight · Blue', swatch: ['#05070c', '#0d1220', '#60a5fa'] },
  { value: 'daylight', label: 'Daylight · Light', swatch: ['#eef1f6', '#ffffff', '#c8861a'] },
  { value: 'contrast', label: 'High contrast', swatch: ['#000000', '#0a0a0a', '#ffd400'] },
];

// ---- app preferences (one localStorage record) ----
export type Density = 'comfortable' | 'compact';

export interface Prefs {
  theme: string;
  density: Density;
  /** Re-load the last player on startup. */
  autoLoad: boolean;
  lastPlayer: string;
  /** 'last' = reopen whichever page was open last. */
  startPage: PageId | 'last';
  lastPage: PageId;
  sidebarCollapsed: boolean;
}

const PREFS_KEY = 'rotmg-prefs';
const DEFAULT_PREFS: Prefs = {
  theme: 'realm',
  density: 'comfortable',
  autoLoad: true,
  lastPlayer: '',
  startPage: 'last',
  lastPage: 'characters',
  sidebarCollapsed: false,
};

function loadPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>;
    // Carry the theme over from the pre-0.2 'rotmg-theme' key; on a true first launch,
    // follow the OS light/dark setting until the user picks a theme.
    const legacyTheme = localStorage.getItem('rotmg-theme');
    const osTheme = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'daylight' : 'realm';
    return { ...DEFAULT_PREFS, theme: legacyTheme ?? osTheme, ...saved };
  } catch {
    return DEFAULT_PREFS;
  }
}

export interface PrefsApi {
  prefs: Prefs;
  set: (patch: Partial<Prefs>) => void;
  reset: () => void;
}

export function usePrefs(): PrefsApi {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable — prefs just won't persist */
    }
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    root.dataset.density = prefs.density;
  }, [prefs]);

  const set = useCallback((patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch })), []);
  const reset = useCallback(() => setPrefs({ ...DEFAULT_PREFS, lastPlayer: '' }), []);
  return { prefs, set, reset };
}

// ---- recent player searches ----
const RECENT_KEY = 'rotmg-recent-players';
const RECENT_MAX = 8;

export interface RecentApi {
  recent: string[];
  add(name: string): void;
  remove(name: string): void;
  clear(): void;
}

function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* non-fatal */
  }
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
      saveRecent(next);
      return next;
    });
  }, []);

  const remove = useCallback((name: string) => {
    setRecent((prev) => {
      const next = prev.filter((p) => p.toLowerCase() !== name.toLowerCase());
      saveRecent(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    saveRecent([]);
    setRecent([]);
  }, []);

  return { recent, add, remove, clear };
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
  store: DeclinedStore;
  listFor(className: string): string[];
  decline(className: string, id: string): void;
  restore(className: string, id: string): void;
  clearClass(className: string): void;
  clearAll(): void;
}

export function useDeclined(): DeclinedApi {
  const [store, setStore] = useState<DeclinedStore>(loadDeclined);

  const persist = useCallback((next: DeclinedStore) => {
    setStore(next);
    try {
      localStorage.setItem(DECLINED_KEY, JSON.stringify(next));
    } catch {
      /* non-fatal */
    }
  }, []);

  const listFor = useCallback((cls: string) => store[cls.toLowerCase()] ?? EMPTY, [store]);

  const decline = useCallback(
    (cls: string, id: string) => {
      const k = cls.toLowerCase();
      persist({ ...store, [k]: [...new Set([...(store[k] ?? []), id])] });
    },
    [store, persist],
  );

  const restore = useCallback(
    (cls: string, id: string) => {
      const k = cls.toLowerCase();
      persist({ ...store, [k]: (store[k] ?? []).filter((x) => x !== id) });
    },
    [store, persist],
  );

  const clearClass = useCallback(
    (cls: string) => {
      const next = { ...store };
      delete next[cls.toLowerCase()];
      persist(next);
    },
    [store, persist],
  );

  const clearAll = useCallback(() => persist({}), [persist]);

  return { store, listFor, decline, restore, clearClass, clearAll };
}

// ---- live overlay state (settings pushed from the main process) ----
export interface OverlayApi {
  settings: OverlaySettings;
  patch: (p: Partial<OverlaySettings>) => void;
  /** Game running / focused / location (from the main process's game watcher). */
  game: GameState;
}

export function useOverlaySettings(): OverlayApi {
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_OVERLAY_SETTINGS);
  const [game, setGame] = useState<GameState>(EMPTY_GAME_STATE);

  useEffect(() => {
    const take = (s: OverlayState) => {
      setSettings(s.settings);
      if (s.game) setGame(s.game);
    };
    window.api.overlay
      .getState()
      .then(take)
      .catch(() => {});
    return window.api.overlay.onState(take);
  }, []);

  const patch = useCallback((p: Partial<OverlaySettings>) => {
    window.api.overlay.setSettings(p).catch(() => {});
  }, []);

  return { settings, patch, game };
}

// ---- small time helper ----
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
