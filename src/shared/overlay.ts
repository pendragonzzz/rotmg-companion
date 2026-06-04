import type { Character } from './types';

/** Which HUD pieces the user wants visible (the "pick what you want" toggles). */
export interface OverlayWidgets {
  header: boolean; // class sprite + level + maxed
  target: boolean; // biome/beacon to head to + dungeon to enter
  beacons: boolean; // list of beacons to farm (across the character's goals)
  goals: boolean; // the next-goals list
  setToFarm: boolean; // recommended ST set
  locations: boolean; // 📍 where-to-farm tags on goals
  currentDungeon: boolean; // info card for the dungeon you're running (drops + strategy)
}

/** Where the HUD anchors: 4 corners + 4 edge-centers. */
/** Customizable global hotkeys (Electron accelerator strings). */
export interface OverlayHotkeys {
  toggle: string;
  peek: string;
  picker: string; // open the dungeon quick-pick menu
}

export type OverlayCorner =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'left-center'
  | 'right-center'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface OverlaySettings {
  /** Whether the overlay window is shown. */
  enabled: boolean;
  corner: OverlayCorner;
  /** Window opacity 0.3–1. */
  opacity: number;
  /** HUD scale 0.8–1.5. */
  scale: number;
  /** Compact = hide goal sub-details, show titles only. */
  compact: boolean;
  /** Max goals to list (1–6). */
  maxGoals: number;
  /** Dungeon id for the "current dungeon" info card ('' = none). */
  currentDungeon: string;
  /** Favorite dungeon ids (shown first in the quick-pick menu). */
  favorites: string[];
  hotkeys: OverlayHotkeys;
  widgets: OverlayWidgets;
}

/** Full state pushed to the overlay window: settings + the chosen character. */
export interface OverlayState {
  settings: OverlaySettings;
  /** The active character (full object so the overlay computes goals itself). */
  character: Character | null;
  /** Transient: the overlay is being momentarily "peeked" via hotkey. */
  peek: boolean;
  /** Transient: the dungeon quick-pick menu is open (overlay becomes interactive). */
  picker: boolean;
}

export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  enabled: false,
  corner: 'top-right',
  opacity: 0.92,
  scale: 1,
  compact: false,
  maxGoals: 3,
  currentDungeon: '',
  favorites: [],
  hotkeys: {
    toggle: 'CommandOrControl+Shift+O',
    peek: 'CommandOrControl+Shift+P',
    picker: 'CommandOrControl+Shift+D',
  },
  widgets: {
    header: true,
    target: true,
    beacons: true,
    goals: true,
    setToFarm: true,
    locations: true,
    currentDungeon: true,
  },
};

/** Labels for the rebindable hotkey actions (UI order). */
export const HOTKEY_ACTIONS: { key: keyof OverlayHotkeys; label: string }[] = [
  { key: 'toggle', label: 'Show / hide overlay' },
  { key: 'peek', label: 'Peek (momentary)' },
  { key: 'picker', label: 'Open dungeon quick-pick' },
];

/** How long a peek stays visible (ms). */
export const OVERLAY_PEEK_MS = 5000;
