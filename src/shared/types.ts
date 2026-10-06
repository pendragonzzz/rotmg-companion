/** Canonical RotMG stat order, as used in item modifiers and RealmEye's data-stats. */
export const STAT_KEYS = ['hp', 'mp', 'att', 'def', 'spd', 'dex', 'vit', 'wis'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export type Stats = Record<StatKey, number>;

/** RotMG equipment slot order on RealmEye: weapon, ability, armor, ring, backpack. */
export const SLOT_NAMES = ['weapon', 'ability', 'armor', 'ring', 'backpack'] as const;
export type SlotName = (typeof SLOT_NAMES)[number];

export interface EquippedItem {
  /** Slot inferred by position (weapon/ability/armor/ring/backpack). */
  slot: SlotName | `slot${number}`;
  /** RealmEye wiki slug, e.g. "dirk-of-cronus" — the stable identity. */
  slug: string;
  /** Display name, e.g. "Dirk of Cronus". */
  name: string;
  /** Tier tag parsed from the tooltip: "UT", "ST", "T7", or null. */
  tier: string | null;
  /** Full tooltip text (rarity, name, and every stat modifier). */
  tooltip: string;
}

export interface Character {
  /** RealmEye/RotMG class object id (e.g. 768 = Rogue). */
  classId: number;
  /** Skin id from RealmEye (helps tell same-class characters apart — RealmEye has no character id). */
  skin?: number;
  className: string;
  level: number;
  fame: number;
  /** Current stats including equipment bonuses. */
  stats: Stats;
  /** Stats from the bare character (current minus equipment bonuses) — the true progression measure. */
  baseStats: Stats;
  /** How many of the 8 stats are maxed (0–8). */
  maxedCount: number;
  /** RealmEye's "n/8" label. */
  statsMaxed: string;
  equipment: EquippedItem[];
  /** Pet's item id, if shown. */
  petId: number | null;
}

export interface PlayerProfile {
  name: string;
  /** True when the profile exists but characters are hidden. */
  isPrivate: boolean;
  characters: Character[];
  /** Lightweight account summary parsed from the side table. */
  summary: {
    accountFame?: number;
    fame?: number;
    exaltations?: number;
    rank?: number;
    guild?: string;
    created?: string;
    lastSeen?: string;
  };
}
