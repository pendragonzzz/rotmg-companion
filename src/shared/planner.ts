/**
 * Planner — pure, UI-free logic behind the Potions, Gear and Dungeons pages.
 * Builds on engine.ts (readiness, pot routing, biomes, exalts, sets) and is
 * exercised headless by scripts/test-planner.ts.
 */
import { STAT_KEYS, type Character, type StatKey } from './types';
import {
  MAIN_STATS,
  POT_INCREMENT,
  biomesForStat,
  evaluateReadiness,
  isStatFarmObsolete,
  potionSources,
  recommendSetFor,
  setsForClass,
  statOrderFor,
  type BiomeData,
  type BiomeTier,
  type ClassMaxTable,
  type DungeonDropTable,
  type DungeonGate,
  type ExaltDungeon,
  type ExaltEfficiency,
  type ExaltationData,
  type GearDropItem,
  type PotRouting,
  type PotSource,
  type ReadinessStatus,
  type SetMember,
  type SetTable,
  type STSet,
  type StatPriority,
} from './engine';
import type { EnemyDropTable } from './dropTables';

/** A Greater potion is worth two regular ones (+2 stat, +10 Life/Mana). */
export const GREATER_MULTIPLIER = 2;

/** Everything the planner reads — the bundled game data, passed as one object. */
export interface PlannerData {
  dungeons: DungeonGate[];
  classMax: ClassMaxTable;
  drops: DungeonDropTable;
  routing: PotRouting;
  biomes: BiomeData;
  exaltation: ExaltationData;
  statPriority: StatPriority;
  sets: SetTable;
}

export type SourceStatus = ReadinessStatus | 'unknown';

const STATUS_RANK: Record<SourceStatus, number> = { ready: 0, risky: 1, notReady: 2, unknown: 3 };

/** dungeon id → readiness for this character. */
export function verdictMap(character: Character, data: PlannerData): Map<string, ReadinessStatus> {
  const r = evaluateReadiness(character, data.dungeons, data.classMax, data.statPriority);
  return new Map(r.verdicts.map((v) => [v.id, v.status]));
}

// ---------------------------------------------------------------------------
// Potion maxing
// ---------------------------------------------------------------------------

export interface PotSourceStatus extends PotSource {
  status: SourceStatus;
  /** Past this dungeon's "stop farming here" point for the character. */
  obsolete: boolean;
  /** The dungeon's recommended n/8 (readiness gate). */
  needs: number;
}

export interface StatPlan {
  stat: StatKey;
  /** Position in the class's maxing order (0 = do first). */
  rank: number;
  base: number;
  max: number;
  remaining: number;
  /** Regular potions still needed. */
  pots: number;
  /** Greater potions needed if you only drank Greaters. */
  greaters: number;
  maxed: boolean;
  sources: PotSourceStatus[];
  /** Best dungeon to farm this stat right now (reachable, not obsolete). */
  bestNow: PotSourceStatus | null;
  /** When nothing is reachable yet: the source that unlocks soonest. */
  nextUnlock: PotSourceStatus | null;
  /** Biomes whose open-world enemies drop it (adept first). */
  biomes: { id: string; tier: BiomeTier }[];
}

export interface FarmStop {
  biome: string;
  tier: BiomeTier;
  /** Unmaxed stats this biome's enemies drop. */
  covers: StatKey[];
  /** Dungeon portals in the biome that also drop one of those stats. */
  dungeons: string[];
}

export interface PotionPlan {
  hasClassMax: boolean;
  /** All 8 stats in the class's maxing order. */
  stats: StatPlan[];
  /** Unmaxed stats only, in order. */
  todo: StatPlan[];
  mainPots: number;
  lifePots: number;
  manaPots: number;
  /** Total Greaters if every remaining stat were filled with Greaters. */
  greaterTotal: number;
  /** Fewest biomes that cover every unmaxed stat. */
  route: FarmStop[];
}

export function potionPlan(character: Character, data: PlannerData, verdicts = verdictMap(character, data)): PotionPlan {
  const max = data.classMax[character.className.toLowerCase()];
  const order = statOrderFor(character.className, data.statPriority);
  const byId = new Map(data.dungeons.map((d) => [d.id, d]));

  const stats: StatPlan[] = order.map((stat, rank) => {
    const base = character.baseStats[stat];
    const cap = max?.[stat] ?? base;
    const remaining = Math.max(0, cap - base);
    const inc = POT_INCREMENT[stat];
    const sources: PotSourceStatus[] = potionSources(stat, data.dungeons, data.routing, data.drops).map((s) => {
      const gate = byId.get(s.id);
      return {
        ...s,
        status: verdicts.get(s.id) ?? 'unknown',
        obsolete: gate ? isStatFarmObsolete(gate, character.maxedCount) : false,
        needs: gate?.recommendedMaxed ?? 0,
      };
    });
    const bestNow =
      sources.find((s) => s.status === 'ready' && !s.obsolete) ??
      sources.find((s) => s.status === 'ready') ??
      sources.find((s) => s.status === 'risky') ??
      null;
    const nextUnlock = bestNow
      ? null
      : [...sources].sort((a, b) => a.needs - b.needs || a.tier - b.tier)[0] ?? null;
    return {
      stat,
      rank,
      base,
      max: cap,
      remaining,
      pots: Math.ceil(remaining / inc),
      greaters: Math.ceil(remaining / (inc * GREATER_MULTIPLIER)),
      maxed: !!max && remaining === 0,
      sources,
      bestNow,
      nextUnlock,
      biomes: biomesForStat(stat, data.biomes).map((b) => ({ id: b.id, tier: b.tier })),
    };
  });

  const todo = max ? stats.filter((s) => !s.maxed) : [];
  const sum = (pred: (s: StatPlan) => boolean) => todo.filter(pred).reduce((n, s) => n + s.pots, 0);
  return {
    hasClassMax: !!max,
    stats,
    todo,
    mainPots: sum((s) => MAIN_STATS.includes(s.stat)),
    lifePots: sum((s) => s.stat === 'hp'),
    manaPots: sum((s) => s.stat === 'mp'),
    greaterTotal: todo.reduce((n, s) => n + s.greaters, 0),
    route: farmRoute(
      todo.map((s) => s.stat),
      data,
    ),
  };
}

/**
 * Greedy set-cover over the biomes, in two passes that follow the progression:
 * Adept biomes cover the 6 main stats first, then Veteran biomes cover Life/Mana
 * (and anything Adept can't). Each pass picks the biome covering the most stats.
 */
export function farmRoute(needed: StatKey[], data: PlannerData): FarmStop[] {
  const left = new Set(needed);
  const route: FarmStop[] = [];
  coverWith('adept', MAIN_STATS, left, route, data);
  coverWith('veteran', STAT_KEYS, left, route, data);
  return route;
}

function coverWith(
  tier: BiomeTier,
  eligible: readonly StatKey[],
  left: Set<StatKey>,
  route: FarmStop[],
  data: PlannerData,
): void {
  const candidates = Object.entries(data.biomes.biomes).filter(([, b]) => b.tier === tier && b.statPots.length > 0);
  const dropsStat = (dungeonId: string, stat: StatKey) =>
    (data.routing[stat] ?? []).some((r) => r.dungeonId === dungeonId) ||
    (data.drops[dungeonId]?.potions ?? []).includes(stat) ||
    (data.drops[dungeonId]?.greaterPotions ?? []).includes(stat);

  for (;;) {
    let best: { id: string; tier: BiomeTier; covers: StatKey[] } | null = null;
    for (const [id, b] of candidates) {
      if (route.some((r) => r.biome === id)) continue;
      const covers = STAT_KEYS.filter((s) => left.has(s) && eligible.includes(s) && b.statPots.includes(s));
      // Most stats wins; ties go alphabetically so the route agrees with biomesForStat's pick.
      const better =
        !best || covers.length > best.covers.length || (covers.length === best.covers.length && id < best.id);
      if (covers.length && better) best = { id, tier: b.tier, covers };
    }
    if (!best) return; // this tier can't cover anything else
    const biome = data.biomes.biomes[best.id]!;
    route.push({
      biome: best.id,
      tier: best.tier,
      covers: best.covers,
      dungeons: biome.dungeons.filter((d) => best!.covers.some((s) => dropsStat(d, s))),
    });
    for (const s of best.covers) left.delete(s);
  }
}

// ---------------------------------------------------------------------------
// Exaltations (8/8)
// ---------------------------------------------------------------------------

export interface ExaltChoice extends ExaltDungeon {
  id: string;
  name: string;
  status: SourceStatus;
}

/** Exalt dungeons, most grindable first, annotated with the character's readiness. */
export function exaltPlan(character: Character, data: PlannerData, verdicts = verdictMap(character, data)): ExaltChoice[] {
  const effRank: Record<ExaltEfficiency, number> = { high: 0, moderate: 1, low: 2 };
  const byId = new Map(data.dungeons.map((d) => [d.id, d]));
  return Object.entries(data.exaltation.dungeons)
    .map(([id, ex]) => ({ ...ex, id, name: byId.get(id)?.name ?? id, status: verdicts.get(id) ?? ('unknown' as const) }))
    .sort(
      (a, b) =>
        effRank[a.efficiency] - effRank[b.efficiency] ||
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        a.name.localeCompare(b.name),
    );
}

// ---------------------------------------------------------------------------
// Gear maxing
// ---------------------------------------------------------------------------

export type GearSlot = 'weapon' | 'ability' | 'armor' | 'ring';
export const GEAR_SLOTS: GearSlot[] = ['weapon', 'ability', 'armor', 'ring'];

export interface GearChoice {
  slug: string;
  name: string;
  tier: string;
  score: number;
  summary?: string;
  description?: string;
  dungeonId: string;
  dungeon: string;
  biome?: string;
  status: SourceStatus;
}

export interface EquippedInfo {
  slug: string;
  name: string;
  tier: string | null;
  /** Power score, when the item is in a tracked drop table or ST set. */
  score: number | null;
  /** Already a UT/ST piece. */
  specialized: boolean;
}

export interface SlotPlan {
  slot: GearSlot;
  equipped: EquippedInfo | null;
  /** Every class-usable UT/ST for the slot, strongest first. */
  options: GearChoice[];
  /** Strongest option the character can farm now (ready, else risky). */
  bestNow: GearChoice | null;
  /** Strongest option overall (endgame best-in-slot among tracked drops). */
  bis: GearChoice | null;
  isBis: boolean;
  upgradeNow: boolean;
  /** bestNow score − equipped score (when both are known). */
  delta: number | null;
}

export interface SetProgress {
  set: STSet;
  owned: SetMember[];
  missing: SetMember[];
}

export interface GearPlan {
  slots: SlotPlan[];
  specialized: number;
  upgradesNow: number;
  /** Class sets with at least one piece equipped, most complete first. */
  setProgress: SetProgress[];
  recommended: STSet | null;
}

export function gearPlan(character: Character, data: PlannerData, verdicts = verdictMap(character, data)): GearPlan {
  const cls = character.className.toLowerCase();
  const byId = new Map(data.dungeons.map((d) => [d.id, d]));
  const setSlugs = new Set(data.sets.flatMap((s) => s.members.map((m) => m.slug)));

  // Known scores for any item slug (drop tables + ST set rosters).
  const scoreOf = new Map<string, number>();
  for (const d of Object.values(data.drops)) for (const g of d.gear) if (g.score != null) scoreOf.set(g.slug, Math.max(g.score, scoreOf.get(g.slug) ?? 0));
  for (const s of data.sets) for (const m of s.members) if (m.score != null && !scoreOf.has(m.slug)) scoreOf.set(m.slug, m.score);

  // Collect class-usable options per slot, deduped by slug (keep the most reachable source).
  const bySlot = new Map<string, Map<string, GearChoice>>();
  for (const [dungeonId, drop] of Object.entries(data.drops)) {
    const status: SourceStatus = verdicts.get(dungeonId) ?? 'unknown';
    for (const g of drop.gear) {
      if (!g.classes.some((c) => c.toLowerCase() === cls)) continue;
      const slotMap = bySlot.get(g.slot) ?? new Map<string, GearChoice>();
      const prev = slotMap.get(g.slug);
      if (!prev || STATUS_RANK[status] < STATUS_RANK[prev.status]) {
        slotMap.set(g.slug, {
          slug: g.slug,
          name: g.name,
          tier: setSlugs.has(g.slug) ? 'ST' : g.tier,
          score: g.score ?? 0,
          summary: g.summary,
          description: g.description,
          dungeonId,
          dungeon: byId.get(dungeonId)?.name ?? dungeonId,
          biome: byId.get(dungeonId)?.biome,
          status,
        });
      }
      bySlot.set(g.slot, slotMap);
    }
  }

  const equippedBySlot = new Map(character.equipment.map((e) => [e.slot, e]));
  const slots: SlotPlan[] = GEAR_SLOTS.map((slot) => {
    const e = equippedBySlot.get(slot);
    const tier = e ? (setSlugs.has(e.slug) ? 'ST' : e.tier) : null;
    const equipped: EquippedInfo | null = e
      ? { slug: e.slug, name: e.name, tier, score: scoreOf.get(e.slug) ?? null, specialized: tier === 'UT' || tier === 'ST' }
      : null;
    const options = [...(bySlot.get(slot)?.values() ?? [])].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const bestNow = options.find((o) => o.status === 'ready') ?? options.find((o) => o.status === 'risky') ?? null;
    const bis = options[0] ?? null;
    const delta = bestNow && equipped?.score != null ? bestNow.score - equipped.score : null;
    const upgradeNow =
      !!bestNow &&
      bestNow.slug !== equipped?.slug &&
      (!equipped?.specialized || (delta != null && delta > 0));
    return { slot, equipped, options, bestNow, bis, isBis: !!bis && bis.slug === equipped?.slug, upgradeNow, delta };
  });

  const equippedSlugs = new Set(character.equipment.map((e) => e.slug));
  const setProgress = setsForClass(data.sets, character.className)
    .map((set) => ({
      set,
      owned: set.members.filter((m) => equippedSlugs.has(m.slug)),
      missing: set.members.filter((m) => !equippedSlugs.has(m.slug)),
    }))
    .filter((p) => p.owned.length > 0)
    .sort((a, b) => b.owned.length - a.owned.length || a.set.name.localeCompare(b.set.name));

  return {
    slots,
    specialized: slots.filter((s) => s.equipped?.specialized).length,
    upgradesNow: slots.filter((s) => s.upgradeNow).length,
    setProgress,
    recommended: recommendSetFor(character, data.sets, verdicts),
  };
}

// ---------------------------------------------------------------------------
// Dungeon details
// ---------------------------------------------------------------------------

export interface DungeonInfo {
  gate: DungeonGate;
  hasDropData: boolean;
  /** Regular stat potions it drops. */
  potions: StatKey[];
  /** Greater stat potions it drops. */
  greater: StatKey[];
  /** Pots the boss reliably drops (curated). */
  guaranteed: StatKey[];
  exalt: ExaltDungeon | null;
  biome: { id: string; tier: BiomeTier; guardian: string | null; encounters: string[]; statPots: StatKey[] } | null;
  /** UT/ST drops, slot order then strongest first. */
  gear: GearDropItem[];
  /** Progression items: O3 runes, Wine Cellar incantations, vials, keys. */
  keyItems: string[];
  /** Which enemy drops what (rare loot only); empty until the data has been refreshed. */
  enemies: EnemyDropTable[];
}

const SLOT_ORDER: Record<string, number> = { weapon: 0, ability: 1, armor: 2, ring: 3 };
const KEY_ITEM_RE = /\bRune$|Incantation|^Vial of|\bKey$/;

export function dungeonInfo(id: string, data: PlannerData): DungeonInfo | null {
  const gate = data.dungeons.find((d) => d.id === id);
  if (!gate) return null;
  const drop = data.drops[id];
  const routed = (stat: StatKey) => (data.routing[stat] ?? []).find((r) => r.dungeonId === id);
  const potions = STAT_KEYS.filter((s) => (drop?.potions ?? []).includes(s) || !!routed(s));
  const greater = STAT_KEYS.filter(
    (s) => (drop?.greaterPotions ?? []).includes(s) || (!!gate.greaterPots && MAIN_STATS.includes(s)),
  );
  const b = gate.biome ? data.biomes.biomes[gate.biome] : undefined;
  return {
    gate,
    hasDropData: !!drop && (drop.gear.length > 0 || drop.potions.length > 0 || drop.other.length > 0),
    potions: potions.filter((s) => !greater.includes(s) || (drop?.potions ?? []).includes(s)),
    greater,
    guaranteed: STAT_KEYS.filter((s) => !!routed(s)?.guaranteed),
    exalt: data.exaltation.dungeons[id] ?? null,
    biome:
      gate.biome && b
        ? { id: gate.biome, tier: b.tier, guardian: b.guardian, encounters: b.encounters ?? [], statPots: b.statPots }
        : null,
    gear: [...(drop?.gear ?? [])].sort(
      (x, y) => (SLOT_ORDER[x.slot] ?? 9) - (SLOT_ORDER[y.slot] ?? 9) || (y.score ?? 0) - (x.score ?? 0),
    ),
    keyItems: [...new Set((drop?.other ?? []).map((o) => o.name).filter((n) => n && KEY_ITEM_RE.test(n)))],
    enemies: drop?.enemies ?? [],
  };
}
