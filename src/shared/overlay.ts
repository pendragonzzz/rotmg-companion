import type { Character } from './types';
import { EMPTY_GAME_STATE, type GameState } from './location';

/** Which HUD pieces the user wants visible (the "pick what you want" toggles). */
export interface OverlayWidgets {
  header: boolean; // class sprite + level + maxed
  target: boolean; // biome/beacon to head to + dungeon to enter
  beacons: boolean; // list of beacons to farm (across the character's goals)
  goals: boolean; // the next-goals list
  setToFarm: boolean; // recommended ST set
  locations: boolean; // 📍 where-to-farm tags on goals
  currentDungeon: boolean; // info card for the dungeon you're running (drops + strategy)
  liveToasts: boolean; // flash live RealmEye changes (pot maxed, gear equipped…) on the HUD
  location: boolean; // 📍 where you are (detected from the game's log, or picked)
}

/** What the current-dungeon card shows. */
export interface OverlayDungeonCard {
  strategy: boolean; // the guide-sourced mechanic tip
  pots: boolean; // stat pots it drops (regular + greater)
  exalt: boolean; // exalt stat, if any
  drops: boolean; // UT/ST drops
  classDropsOnly: boolean; // only drops the active character's class can use
  keyItems: boolean; // runes / incantations
  bossLoot: boolean; // which enemy here drops gear your class can use
}

/** Customizable global hotkeys (Electron accelerator strings). */
export interface OverlayHotkeys {
  toggle: string;
  peek: string;
  picker: string; // open the location quick-pick menu
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
  /** Briefly show the HUD when live sync spots a change, even if it's hidden. */
  peekOnChange: boolean;
  /** Dungeon id for the "current dungeon" info card ('' = none). */
  currentDungeon: string;
  /** Favorite dungeon ids (shown first in the quick-pick menu). */
  favorites: string[];
  /** App theme, mirrored so the HUD matches the main window. */
  theme: string;
  /** Work out the current location from the game's own log file (read-only, local). */
  detectFromLog: boolean;
  /** Only show the HUD while the game is running (Windows). */
  followGame: boolean;
  /** Hide the HUD while another window is in front of the game (Windows, beta). */
  hideWhenUnfocused: boolean;
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
  /** Transient: the latest live-sync change for the active character, shown for a few seconds. */
  toast: OverlayToast | null;
  /** Is the game running / focused, and where is the player (log or manual pick). */
  game: GameState;
}

export interface OverlayToast {
  title: string;
  detail?: string;
  /** Extra events in the same sync, summarized as "+N more". */
  more: number;
  at: number;
}

/** How long a live toast stays on the HUD. */
export const OVERLAY_TOAST_MS = 8000;

export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  enabled: false,
  corner: 'top-right',
  opacity: 0.92,
  scale: 1,
  compact: false,
  maxGoals: 3,
  peekSeconds: 5,
  peekOnChange: false,
  currentDungeon: '',
  favorites: [],
  theme: 'realm',
  detectFromLog: true,
  followGame: true,
  hideWhenUnfocused: false,
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
    liveToasts: true,
    location: true,
  },
  dungeonCard: {
    strategy: true,
    pots: true,
    exalt: true,
    drops: true,
    classDropsOnly: true,
    keyItems: false,
    bossLoot: true,
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
  { key: 'picker', label: 'Open location quick-pick' },
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
      widgets: { header: false, target: true, beacons: false, goals: true, setToFarm: false, locations: true, currentDungeon: false, liveToasts: true, location: true },
    },
  },
  {
    id: 'standard',
    label: 'Standard',
    hint: 'Header, target, goals and the dungeon card.',
    apply: {
      compact: false,
      maxGoals: 3,
      widgets: { header: true, target: true, beacons: false, goals: true, setToFarm: false, locations: true, currentDungeon: true, liveToasts: true, location: true },
    },
  },
  {
    id: 'full',
    label: 'Everything',
    hint: 'Every widget, 5 goals, full dungeon card.',
    apply: {
      compact: false,
      maxGoals: 5,
      widgets: { header: true, target: true, beacons: true, goals: true, setToFarm: true, locations: true, currentDungeon: true, liveToasts: true, location: true },
      dungeonCard: { strategy: true, pots: true, exalt: true, drops: true, classDropsOnly: true, keyItems: true, bossLoot: true },
    },
  },
];

/** Initial overlay state (before the main process has pushed anything). */
export const EMPTY_OVERLAY_STATE: OverlayState = {
  settings: DEFAULT_OVERLAY_SETTINGS,
  character: null,
  peek: false,
  picker: false,
  toast: null,
  game: EMPTY_GAME_STATE,
};
