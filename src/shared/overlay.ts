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

/** What the current-dungeon card shows. */
export interface OverlayDungeonCard {
  strategy: boolean; // the guide-sourced mechanic tip
  pots: boolean; // stat pots it drops (regular + greater)
  exalt: boolean; // exalt stat, if any
  drops: boolean; // UT/ST drops
  classDropsOnly: boolean; // only drops the active character's class can use
  keyItems: boolean; // runes / incantations
}

/** Customizable global hotkeys (Electron accelerator strings). */
export interface OverlayHotkeys {
  toggle: string;
  peek: string;
  picker: string; // open the dungeon quick-pick menu
}

/** Where the HUD anchors: 4 corners + 4 edge-centers. */
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
  /** How long a peek stays up, in seconds. */
  peekSeconds: number;
  /** Dungeon id for the "current dungeon" info card ('' = none). */
  currentDungeon: string;
  /** Favorite dungeon ids (shown first in the quick-pick menu). */
  favorites: string[];
  /** App theme, mirrored so the HUD matches the main window. */
  theme: string;
  hotkeys: OverlayHotkeys;
  widgets: OverlayWidgets;
  dungeonCard: OverlayDungeonCard;
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
  peekSeconds: 5,
  currentDungeon: '',
  favorites: [],
  theme: 'realm',
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
  dungeonCard: {
    strategy: true,
    pots: true,
    exalt: true,
    drops: true,
    classDropsOnly: true,
    keyItems: false,
  },
};

/**
 * Merge a partial update into settings, one level deep for the nested groups — so a
 * settings file saved by an older version still picks up new widget/card defaults.
 */
export function mergeOverlaySettings(base: OverlaySettings, patch: Partial<OverlaySettings>): OverlaySettings {
  return {
    ...base,
    ...patch,
    hotkeys: { ...base.hotkeys, ...patch.hotkeys },
    widgets: { ...base.widgets, ...patch.widgets },
    dungeonCard: { ...base.dungeonCard, ...patch.dungeonCard },
  };
}

/** Labels for the rebindable hotkey actions (UI order). */
export const HOTKEY_ACTIONS: { key: keyof OverlayHotkeys; label: string }[] = [
  { key: 'toggle', label: 'Show / hide overlay' },
  { key: 'peek', label: 'Peek (momentary)' },
  { key: 'picker', label: 'Open dungeon quick-pick' },
];

/** One-click layouts for the HUD. */
export const OVERLAY_PRESETS: { id: string; label: string; hint: string; apply: Partial<OverlaySettings> }[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    hint: 'Where to go + your next goal. Nothing else.',
    apply: {
      compact: true,
      maxGoals: 1,
      widgets: { header: false, target: true, beacons: false, goals: true, setToFarm: false, locations: true, currentDungeon: false },
    },
  },
  {
    id: 'standard',
    label: 'Standard',
    hint: 'Header, target, goals and the dungeon card.',
    apply: {
      compact: false,
      maxGoals: 3,
      widgets: { header: true, target: true, beacons: false, goals: true, setToFarm: false, locations: true, currentDungeon: true },
    },
  },
  {
    id: 'full',
    label: 'Everything',
    hint: 'Every widget, 5 goals, full dungeon card.',
    apply: {
      compact: false,
      maxGoals: 5,
      widgets: { header: true, target: true, beacons: true, goals: true, setToFarm: true, locations: true, currentDungeon: true },
      dungeonCard: { strategy: true, pots: true, exalt: true, drops: true, classDropsOnly: true, keyItems: true },
    },
  },
];
