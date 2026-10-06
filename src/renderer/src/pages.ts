import type { IconName } from './components/Icon';

export type PageId =
  | 'characters'
  | 'potions'
  | 'gear'
  | 'dungeons'
  | 'sets'
  | 'meta'
  | 'pets'
  | 'overlay'
  | 'settings';

export interface PageDef {
  id: PageId;
  label: string;
  icon: IconName;
  group: 'Plan' | 'Browse' | 'App';
  /** One-line description shown under the page title. */
  blurb: string;
  /** Needs a loaded character to be useful. */
  needsCharacter?: boolean;
}

/** Sidebar order — also the Ctrl+1…9 shortcut order. */
export const PAGES: PageDef[] = [
  { id: 'characters', label: 'Characters', icon: 'user', group: 'Plan', blurb: 'Your roster and each character’s next goals' },
  { id: 'potions', label: 'Potions', icon: 'flask', group: 'Plan', blurb: 'What to drink next and where to farm it', needsCharacter: true },
  { id: 'gear', label: 'Gear', icon: 'att', group: 'Plan', blurb: 'Best-in-slot by what you can run today', needsCharacter: true },
  { id: 'dungeons', label: 'Dungeons', icon: 'castle', group: 'Plan', blurb: 'Every dungeon: drops, pots, exalts, strategy' },
  { id: 'sets', label: 'Sets', icon: 'sets', group: 'Browse', blurb: 'Set-Tier gear by class and difficulty' },
  { id: 'meta', label: 'Meta', icon: 'exalt', group: 'Browse', blurb: 'The current realm meta at a glance' },
  { id: 'pets', label: 'Pets', icon: 'paw', group: 'Browse', blurb: 'Which abilities to chase, feeding and fusing' },
  { id: 'overlay', label: 'Overlay', icon: 'layout', group: 'App', blurb: 'The click-through in-game HUD' },
  { id: 'settings', label: 'Settings', icon: 'cog', group: 'App', blurb: 'Themes, startup, shortcuts and your data' },
];

export const pageDef = (id: PageId) => PAGES.find((p) => p.id === id)!;

/** Cross-page navigation handed to every page (e.g. a pot source → its dungeon page). */
export interface Nav {
  go(page: PageId): void;
  openDungeon(id: string): void;
  browseSets(className?: string): void;
}
