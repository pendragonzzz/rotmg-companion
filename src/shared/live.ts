/**
 * Live sync — pure diffing of two RealmEye snapshots of the same player.
 *
 * The app never reads the game client (DECA ToS). "Live" means: poll the player's
 * public RealmEye page, compare it with the previous snapshot, and turn the
 * differences into events (pots drunk, stats maxed, gear swapped, …) so every
 * plan re-computes. RealmEye has no character id, so characters are matched by
 * class + skin + equipment, with fame/level that can only go up.
 */
import { STAT_KEYS, type Character, type PlayerProfile, type StatKey } from './types';
import type { ClassMaxTable } from './engine';
import { POT_LABEL, STAT_LABEL } from './labels';

/** Unique-ish within a snapshot (distinguishes same-class characters). Changes as fame/level grow. */
export const charKey = (c: Character) => `${c.classId}-${c.className}-${c.level}-${c.fame}`;

export type LiveEventKind = 'maxed' | 'gear' | 'level' | 'pots' | 'new' | 'gone' | 'exalts';

export interface LiveEvent {
  id: string;
  at: number;
  kind: LiveEventKind;
  /** Key of the character as it is NOW (or as it was, for 'gone'); '' for account-wide events. */
  charKey: string;
  className: string;
  title: string;
  detail?: string;
}

/** Most important first — used to pick the overlay toast. */
export const EVENT_PRIORITY: Record<LiveEventKind, number> = {
  maxed: 0,
  gear: 1,
  level: 2,
  exalts: 3,
  pots: 4,
  new: 5,
  gone: 6,
};

export interface LiveSettings {
  /** Poll RealmEye in the background. */
  enabled: boolean;
  /** Seconds between checks (≥ 60 — RealmEye asks scrapers to be polite). */
  intervalSec: number;
}

export const DEFAULT_LIVE_SETTINGS: LiveSettings = { enabled: true, intervalSec: 180 };
export const LIVE_MIN_INTERVAL_SEC = 60;
export const LIVE_INTERVALS = [60, 180, 300, 600];

export type LiveStatus = 'idle' | 'syncing' | 'ok' | 'error' | 'paused';

/** Everything the renderer needs about the live feed (pushed on every change). */
export interface LiveState {
  settings: LiveSettings;
  status: LiveStatus;
  /** Player being tracked ('' = none loaded). */
  player: string;
  profile: PlayerProfile | null;
  /** When `profile` was last fetched successfully. */
  syncedAt: number | null;
  /** When a sync last found a difference. */
  lastChanged: number | null;
  error: string | null;
  /** Newest first, capped. */
  feed: LiveEvent[];
}

export const LIVE_FEED_MAX = 60;

// ---------------------------------------------------------------------------
// Character matching
// ---------------------------------------------------------------------------

export interface CharacterMatch {
  pairs: [prev: Character, next: Character][];
  added: Character[];
  removed: Character[];
}

/**
 * Pair each previous character with its current self. A living character never
 * loses levels or fame, keeps its class, usually keeps its skin, and mostly keeps
 * its gear — score every candidate pair on that and take the best pairs greedily.
 */
export function matchCharacters(prev: Character[], next: Character[]): CharacterMatch {
  const cands: { i: number; j: number; score: number }[] = [];
  prev.forEach((p, i) =>
    next.forEach((n, j) => {
      if (p.classId !== n.classId || p.className !== n.className) return;
      if (n.fame < p.fame || n.level < p.level || n.maxedCount < p.maxedCount) return;
      let score = 0;
      if (charKey(p) === charKey(n)) score += 10;
      if (p.skin != null && p.skin === n.skin) score += 4;
      const pSlugs = new Set(p.equipment.map((e) => e.slug));
      score += n.equipment.filter((e) => pSlugs.has(e.slug)).length;
      if (p.petId != null && p.petId === n.petId) score += 1;
      // Prefer the smallest fame jump between otherwise-equal candidates.
      score -= Math.min(3, Math.log10(1 + (n.fame - p.fame)) / 2);
      cands.push({ i, j, score });
    }),
  );
  cands.sort((a, b) => b.score - a.score);

  const usedP = new Set<number>();
  const usedN = new Set<number>();
  const pairs: CharacterMatch['pairs'] = [];
  for (const c of cands) {
    if (usedP.has(c.i) || usedN.has(c.j)) continue;
    usedP.add(c.i);
    usedN.add(c.j);
    pairs.push([prev[c.i]!, next[c.j]!]);
  }
  return {
    pairs,
    added: next.filter((_, j) => !usedN.has(j)),
    removed: prev.filter((_, i) => !usedP.has(i)),
  };
}

/** Where did this (previous-snapshot) character end up in the new snapshot? */
export function carryCharacter(c: Character, prev: Character[], next: Character[]): Character | null {
  const k = charKey(c);
  const exact = next.find((n) => charKey(n) === k);
  if (exact) return exact;
  return matchCharacters(prev, next).pairs.find(([p]) => charKey(p) === k)?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// Diffing
// ---------------------------------------------------------------------------

const SLOT_LABEL: Record<string, string> = { weapon: 'Weapon', ability: 'Ability', armor: 'Armor', ring: 'Ring' };
const fmt = (stat: StatKey, n: number) => `+${n} ${STAT_LABEL[stat]}`;

/** Turn two snapshots of the same player into human-readable events. */
export function diffProfiles(
  prev: PlayerProfile,
  next: PlayerProfile,
  classMax: ClassMaxTable,
  now = Date.now(),
): LiveEvent[] {
  const out: Omit<LiveEvent, 'id' | 'at'>[] = [];
  const { pairs, added, removed } = matchCharacters(prev.characters, next.characters);

  for (const [p, n] of pairs) {
    const cls = n.className;
    const key = charKey(n);
    const max = classMax[cls.toLowerCase()];

    if (n.level > p.level) {
      out.push({
        kind: 'level',
        charKey: key,
        className: cls,
        title: n.level >= 20 ? `${cls} hit level 20` : `${cls} reached level ${n.level}`,
        detail: n.level >= 20 ? 'Leveling done — time to drink pots.' : undefined,
      });
    }

    const potGains: string[] = [];
    for (const s of STAT_KEYS) {
      const before = p.baseStats[s];
      const after = n.baseStats[s];
      if (after <= before) continue;
      const cap = max?.[s];
      if (cap != null && before >= cap) continue; // already maxed → an exalt/bonus, not a pot
      if (cap != null && after >= cap) {
        out.push({
          kind: 'maxed',
          charKey: key,
          className: cls,
          title: `${cls}: ${POT_LABEL[s]} maxed!`,
          detail: `${after}/${cap} · now ${n.statsMaxed}`,
        });
      } else {
        potGains.push(fmt(s, after - before));
      }
    }
    if (potGains.length) {
      out.push({ kind: 'pots', charKey: key, className: cls, title: `${cls} drank pots`, detail: potGains.join(', ') });
    }
    if (!max && n.maxedCount > p.maxedCount) {
      out.push({ kind: 'maxed', charKey: key, className: cls, title: `${cls} is now ${n.statsMaxed}` });
    }

    const prevBySlot = new Map(p.equipment.map((e) => [e.slot, e]));
    for (const e of n.equipment) {
      if (!(e.slot in SLOT_LABEL)) continue; // ignore the backpack slot
      const old = prevBySlot.get(e.slot);
      if (old?.slug === e.slug) continue;
      out.push({
        kind: 'gear',
        charKey: key,
        className: cls,
        title: `${cls} equipped ${e.name}${e.tier ? ` (${e.tier})` : ''}`,
        detail: `${SLOT_LABEL[e.slot]}: ${old ? old.name : 'empty'} → ${e.name}`,
      });
    }
  }

  for (const n of added) {
    out.push({ kind: 'new', charKey: charKey(n), className: n.className, title: `New ${n.className} (Lv ${n.level})` });
  }
  for (const p of removed) {
    out.push({
      kind: 'gone',
      charKey: charKey(p),
      className: p.className,
      title: `${p.className} left your roster`,
      detail: `${p.statsMaxed}, Lv ${p.level}, ${p.fame.toLocaleString()} fame — died or was deleted.`,
    });
  }

  const ex0 = prev.summary.exaltations;
  const ex1 = next.summary.exaltations;
  if (ex0 != null && ex1 != null && ex1 > ex0) {
    const d = ex1 - ex0;
    out.push({
      kind: 'exalts',
      charKey: '',
      className: '',
      title: `+${d} exaltation${d > 1 ? 's' : ''}`,
      detail: `Account total: ${ex1.toLocaleString()}`,
    });
  }

  return out
    .sort((a, b) => EVENT_PRIORITY[a.kind] - EVENT_PRIORITY[b.kind])
    .map((e, i) => ({ ...e, id: `${now}-${i}`, at: now }));
}
