import { STAT_KEYS, SLOT_NAMES, type StatKey, type Stats, type Character } from './types';
import { POT_LABEL, STAT_LABEL } from './labels';

/** How much one regular potion raises each stat. */
export const POT_INCREMENT: Record<StatKey, number> = {
  hp: 5, mp: 5, att: 1, def: 1, spd: 1, dex: 1, vit: 1, wis: 1,
};

/**
 * Default order to chase stats. HP (Life) and MP (Mana) are LAST: their pots
 * drop in the most dangerous dungeons, so a new player maxes everything obtainable
 * from safer content first. Per-class overrides live in data/stat-priority.json.
 */
export const DEFAULT_STAT_PRIORITY: StatKey[] = ['def', 'vit', 'att', 'dex', 'spd', 'wis', 'hp', 'mp'];

/** You stat-max at level 20 (max level), which comes BEFORE pot farming. */
export const MAX_LEVEL = 20;

export type StatPriority = { default: StatKey[] } & Partial<Record<string, StatKey[]>>;

export function statOrderFor(className: string, sp?: StatPriority): StatKey[] {
  if (!sp) return DEFAULT_STAT_PRIORITY;
  return sp[className.toLowerCase()] ?? sp.default ?? DEFAULT_STAT_PRIORITY;
}

export type DungeonCategory = 'starter' | 'low' | 'mid' | 'high' | 'endgame';
export type ReadinessStatus = 'ready' | 'risky' | 'notReady';

export interface DungeonGate {
  id: string;
  name: string;
  category: DungeonCategory;
  tier: number;
  recommendedMaxed: number;
  minHp: number;
  potions?: StatKey[];
  /** Realm Rework: biome id whose portal spawns this dungeon (see biomes.json). */
  biome?: string;
  /** Drops GREATER potions of the 6 main stats (Kogbold/Fungal/Crystal…). */
  greaterPots?: boolean;
  /** Stat exaltations this dungeon grants on completion (see exaltation.json). */
  exaltStats?: StatKey[];
  /** "Stop grinding" signal: once maxedCount >= this, farming here for stats is a waste. */
  obsoleteAtMaxed?: number;
  note: string;
}

/** The 6 maxable stat pots (Life/Mana excluded) — used for the GREATER-pot flag. */
export const MAIN_STATS: StatKey[] = ['att', 'def', 'spd', 'dex', 'vit', 'wis'];

export interface PotNeed {
  stat: StatKey;
  have: number;
  max: number;
  potsNeeded: number;
}

export interface DungeonVerdict {
  id: string;
  name: string;
  category: DungeonCategory;
  tier: number;
  status: ReadinessStatus;
  reasons: string[];
  /** Diminishing returns: ready, but no longer worth farming for stats. */
  obsolete?: boolean;
  note: string;
}

export interface ReadinessReport {
  className: string;
  statsMaxed: string;
  pots: PotNeed[];
  verdicts: DungeonVerdict[];
  counts: Record<ReadinessStatus, number>;
}

export type ClassMaxTable = Record<string, Stats>;

// ---- generated drop data (data/dungeon-drops.json, built by `npm run refresh`) ----
export interface GearDropItem {
  slug: string;
  name: string;
  tier: string;
  slot: string;
  classes: string[];
  /** Power score (weapon Power Level or weighted stat sum); higher = stronger. */
  score?: number;
  /** Readable stat line, e.g. "150–175 dmg ×2" or "+6 DEF, +6 SPD". */
  summary?: string;
  powerLevel?: number;
  /** What the item does (wiki "Effect(s)" blurb). */
  description?: string;
}
export interface DungeonDropData {
  potions: StatKey[];
  greaterPotions?: StatKey[];
  gear: GearDropItem[];
  other: { slug: string; name: string }[];
}
export type DungeonDropTable = Record<string, DungeonDropData>;

/** One place to farm a given potion. */
export interface PotSource {
  name: string;
  /** Dungeon difficulty tier 1–5 (sorted easiest first). */
  tier: number;
  /** Whether this dungeon drops the GREATER potion (more per drop). */
  greater: boolean;
  /** Whether the boss reliably drops this pot (curated, research-backed). */
  guaranteed: boolean;
}

/** Curated stat → dungeon routing (data/pot-routing.json). */
export type PotRouting = Partial<Record<StatKey, { dungeonId: string; guaranteed?: boolean }[]>>;

/**
 * Where to farm a stat's potion, sorted guaranteed-first then easiest-first.
 * Prefers the curated routing (verified against guides); falls back to scraped drops.
 */
export function potionSources(
  stat: StatKey,
  dungeons: DungeonGate[],
  routing?: PotRouting,
  drops?: DungeonDropTable,
): PotSource[] {
  const byId = new Map(dungeons.map((d) => [d.id, d]));
  // GREATER if the scraped drops say so, OR the dungeon is curated as a greater-pot
  // dungeon and this is one of the 6 main stats (works before the first data refresh).
  const greaterAt = (id: string) =>
    (drops?.[id]?.greaterPotions ?? []).includes(stat) ||
    (!!byId.get(id)?.greaterPots && MAIN_STATS.includes(stat));

  let out: PotSource[] = (routing?.[stat] ?? []).map((r) => {
    const d = byId.get(r.dungeonId);
    return { name: d?.name ?? r.dungeonId, tier: d?.tier ?? 9, greater: greaterAt(r.dungeonId), guaranteed: !!r.guaranteed };
  });

  if (out.length === 0 && drops) {
    out = dungeons
      .filter((d) => (drops[d.id]?.potions ?? []).includes(stat) || greaterAt(d.id))
      .map((d) => ({ name: d.name, tier: d.tier, greater: greaterAt(d.id), guaranteed: false }));
  }

  return out.sort(
    (a, b) => Number(b.guaranteed) - Number(a.guaranteed) || a.tier - b.tier || a.name.localeCompare(b.name),
  );
}

/** Stats still short of class max, ordered by the (class-specific) priority. */
export function potsToMax(
  baseStats: Stats,
  classMax: Stats | undefined,
  order: StatKey[] = DEFAULT_STAT_PRIORITY,
): PotNeed[] {
  if (!classMax) return [];
  const needs: PotNeed[] = [];
  for (const stat of order) {
    const remaining = Math.max(0, classMax[stat] - baseStats[stat]);
    if (remaining > 0) {
      needs.push({ stat, have: baseStats[stat], max: classMax[stat], potsNeeded: Math.ceil(remaining / POT_INCREMENT[stat]) });
    }
  }
  return needs;
}

function gateStatus(character: Character, d: DungeonGate): { status: ReadinessStatus; reasons: string[] } {
  // Readiness keys off how many stats are maxed — the real RotMG progression
  // signal. (HP alone is misleading: it's the last stat people max.)
  const gap = d.recommendedMaxed - character.maxedCount;
  if (gap <= 0) {
    return { status: 'ready', reasons: [`${character.statsMaxed} meets the ${d.recommendedMaxed}/8 recommendation`] };
  }
  if (gap === 1) {
    return { status: 'risky', reasons: [`${character.statsMaxed} maxed — ${d.recommendedMaxed}/8 recommended`] };
  }
  return { status: 'notReady', reasons: [`Recommended ${d.recommendedMaxed}/8 (you're at ${character.statsMaxed})`] };
}

export function evaluateReadiness(
  character: Character,
  dungeons: DungeonGate[],
  classMax: ClassMaxTable,
  statPriority?: StatPriority,
): ReadinessReport {
  const max = classMax[character.className.toLowerCase()];
  const pots = potsToMax(character.baseStats, max, statOrderFor(character.className, statPriority));

  const verdicts: DungeonVerdict[] = dungeons.map((d) => {
    const { status, reasons } = gateStatus(character, d);
    const obsolete = isStatFarmObsolete(d, character.maxedCount);
    return { id: d.id, name: d.name, category: d.category, tier: d.tier, status, reasons, obsolete, note: d.note };
  });

  const counts: Record<ReadinessStatus, number> = { ready: 0, risky: 0, notReady: 0 };
  for (const v of verdicts) counts[v.status]++;
  return { className: character.className, statsMaxed: character.statsMaxed, pots, verdicts, counts };
}

/** Dungeons that drop a given stat's potion (uses generated drop data, falls back to gates). */
export function potionDungeons(
  stat: StatKey,
  dungeons: DungeonGate[],
  drops?: DungeonDropTable,
): string[] {
  return dungeons
    .filter((d) => (drops?.[d.id]?.potions ?? d.potions ?? []).includes(stat))
    .map((d) => d.name);
}

// ---------------------------------------------------------------------------
// Goals ("quest log")
// ---------------------------------------------------------------------------

export type GoalKind = 'level' | 'stat' | 'unlock' | 'gear' | 'exalt';

export interface Goal {
  /** Stable id for dismiss/restore, e.g. "gear:ghastly-drape", "stat:def". */
  id: string;
  kind: GoalKind;
  tag: string;
  title: string;
  detail: string;
  where: string;
  priority: number;
  /** Power score (gear goals) — used to pick the best item per slot. */
  score?: number;
  /** Full pot-source list (stat goals) for the expandable dropdown. */
  sources?: PotSource[];
  /** What a gear item does (wiki effect blurb). */
  synopsis?: string;
  /** Ranked alternative UT/ST options for this slot (gear goals) for the dropdown. */
  alternatives?: GearOption[];
  /** Biome id to farm for this stat's pot (stat goals) — the open-world track. */
  biome?: string;
}

/** One ranked gear option for a slot's UT/ST dropdown. */
export interface GearOption {
  slug: string;
  name: string;
  tier: string;
  score: number;
  summary?: string;
  description?: string;
  dungeon: string;
  biome?: string;
}

export interface GoalContext {
  dungeonDrops?: DungeonDropTable;
  statPriority?: StatPriority;
  /** Curated stat-potion routing (verified). */
  potRouting?: PotRouting;
  /** Realm Rework biome data (open-world pot-farming track). */
  biomes?: BiomeData;
  /** Exaltation data (post-8/8 grind). */
  exaltation?: ExaltationData;
  /** Goal ids the user has declined for this character's class. */
  declined?: ReadonlySet<string>;
}

function statGoals(character: Character, dungeons: DungeonGate[], classMax: ClassMaxTable, ctx: GoalContext): Goal[] {
  const order = statOrderFor(character.className, ctx.statPriority);
  const pots = potsToMax(character.baseStats, classMax[character.className.toLowerCase()], order)
    .filter((p) => !ctx.declined?.has(`stat:${p.stat}`));
  return pots.slice(0, 3).map((p, i) => {
    const sources = potionSources(p.stat, dungeons, ctx.potRouting, ctx.dungeonDrops);
    const biome = ctx.biomes ? biomesForStat(p.stat, ctx.biomes)[0]?.id : undefined;
    return {
      id: `stat:${p.stat}`,
      kind: 'stat' as const,
      tag: STAT_LABEL[p.stat],
      title: `Max ${POT_LABEL[p.stat]}`,
      detail: `${p.potsNeeded} ${POT_LABEL[p.stat]} pots · ${p.have}/${p.max}`,
      where: sources.slice(0, 3).map((s) => s.name).join(', ') || 'various dungeons',
      priority: 4 + i,
      sources,
      biome,
    };
  });
}

/**
 * Post-8/8 endgame: the exaltation grind. Surfaces the most efficient exalt
 * dungeons the character can reach (most grindable first), since a maxed
 * character has no stat goals left.
 */
function exaltGoals(
  character: Character,
  dungeons: DungeonGate[],
  verdictById: Map<string, ReadinessStatus>,
  ctx: GoalContext,
): Goal[] {
  if (!ctx.exaltation || character.maxedCount < 8) return [];
  const byId = new Map(dungeons.map((d) => [d.id, d]));
  const effRank: Record<ExaltEfficiency, number> = { high: 0, moderate: 1, low: 2 };
  const entries = Object.entries(ctx.exaltation.dungeons)
    .filter(([id]) => verdictById.get(id) !== 'notReady')
    .filter(([id]) => !ctx.declined?.has(`exalt:${id}`))
    .sort(
      (a, b) =>
        effRank[a[1].efficiency] - effRank[b[1].efficiency] ||
        (byId.get(a[0])?.tier ?? 5) - (byId.get(b[0])?.tier ?? 5),
    );
  return entries.slice(0, 4).map(([id, ex], i) => {
    const d = byId.get(id);
    const stats = ex.stats.map((s) => STAT_LABEL[s]).join('/');
    return {
      id: `exalt:${id}`,
      kind: 'exalt' as const,
      tag: 'EXALT',
      title: `Exalt at ${d?.name ?? id}`,
      detail: `+${stats} · permanent, per-class · ${ex.efficiency} efficiency`,
      where: d?.name ?? id,
      priority: 5 + i,
      synopsis: ex.note,
      biome: d?.biome,
    };
  });
}

/** Gear upgrades from real RealmEye drop data: a class-usable UT/ST for a slot you haven't specialized. */
function gearGoals(
  character: Character,
  dungeons: DungeonGate[],
  verdictById: Map<string, ReadinessStatus>,
  ctx: GoalContext,
): Goal[] {
  if (!ctx.dungeonDrops) return [];
  const cls = character.className.toLowerCase();
  const equipped = new Map(character.equipment.map((e) => [e.slot, e]));
  const dungeonName = new Map(dungeons.map((d) => [d.id, d.name]));
  const dungeonBiome = new Map(dungeons.map((d) => [d.id, d.biome]));

  // Gather every reachable, class-usable UT/ST per slot (dedupe by slug, keep best instance).
  const bySlot = new Map<string, Map<string, GearOption>>();
  for (const [dungeonId, data] of Object.entries(ctx.dungeonDrops)) {
    const status = verdictById.get(dungeonId);
    if (status === 'notReady' || status === undefined) continue; // only reachable content
    for (const item of data.gear) {
      if (!item.classes.map((c) => c.toLowerCase()).includes(cls)) continue;
      const cur = equipped.get(item.slot as never);
      if (cur && (cur.tier === 'UT' || cur.tier === 'ST')) continue; // already specialized
      const slotMap = bySlot.get(item.slot) ?? new Map<string, GearOption>();
      const opt: GearOption = {
        slug: item.slug,
        name: item.name,
        tier: item.tier,
        score: item.score ?? 0,
        summary: item.summary,
        description: item.description,
        dungeon: dungeonName.get(dungeonId) ?? dungeonId,
        biome: dungeonBiome.get(dungeonId),
      };
      const prev = slotMap.get(item.slug);
      if (!prev || opt.score > prev.score) slotMap.set(item.slug, opt);
      bySlot.set(item.slot, slotMap);
    }
  }

  const goals: Goal[] = [];
  for (const [slot, slotMap] of bySlot) {
    const options = [...slotMap.values()].sort((a, b) => b.score - a.score);
    // Headline = best option the user hasn't declined; rest stay in the dropdown.
    const headline = options.find((o) => !ctx.declined?.has(`gear:${o.slug}`));
    if (!headline) continue;
    const slotIdx = SLOT_NAMES.indexOf(slot as never);
    goals.push({
      id: `gear:${headline.slug}`,
      kind: 'gear',
      tag: slot.toUpperCase(),
      title: `Get ${headline.name}`,
      detail: headline.summary ? `${headline.tier} · ${headline.summary}` : `${headline.tier} upgrade for your ${slot}`,
      where: headline.dungeon,
      priority: 9 + (slotIdx < 0 ? 4 : slotIdx),
      score: headline.score,
      synopsis: headline.description,
      alternatives: options,
      biome: headline.biome,
    });
  }
  return goals;
}

function unlockGoal(character: Character, dungeons: DungeonGate[], declined?: ReadonlySet<string>): Goal[] {
  const locked = dungeons
    .map((d) => ({ d, gap: d.recommendedMaxed - character.maxedCount }))
    .filter((x) => x.gap > 0 && !declined?.has(`unlock:${x.d.id}`))
    .sort((a, b) => a.gap - b.gap || a.d.tier - b.d.tier);
  if (!locked.length) return [];
  const x = locked[0]!;
  return [
    {
      id: `unlock:${x.d.id}`,
      kind: 'unlock',
      tag: 'UNLOCK',
      title: `Unlock ${x.d.name}`,
      detail: `Max ${x.gap} more stat${x.gap > 1 ? 's' : ''} to be ready`,
      where: '',
      priority: 14,
      biome: x.d.biome,
    },
  ];
}

/** Dungeon ids the character's goals point at (for the overlay's auto-favorites). Priority order. */
export function goalDungeonIds(goals: Goal[], dungeons: DungeonGate[]): string[] {
  const nameToId = new Map(dungeons.map((d) => [d.name, d.id]));
  const ids: string[] = [];
  const add = (id?: string) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  for (const g of goals) {
    if (g.kind === 'exalt' || g.kind === 'unlock') add(g.id.split(':')[1]);
    for (const s of g.sources ?? []) add(nameToId.get(s.name));
    if (g.where) for (const nm of g.where.split(',')) add(nameToId.get(nm.trim()));
  }
  return ids;
}

export function buildGoals(
  character: Character,
  dungeons: DungeonGate[],
  classMax: ClassMaxTable,
  ctx: GoalContext = {},
  limit = 6,
): Goal[] {
  // Below max level, leveling beats potting — that's the whole game plan.
  if (character.level < MAX_LEVEL) {
    const verdictById = new Map<string, ReadinessStatus>();
    const goals: Goal[] = [
      {
        id: 'level',
        kind: 'level',
        tag: 'LEVEL',
        title: `Reach Level ${MAX_LEVEL}`,
        detail: `Currently Lv ${character.level} — level to max in the Rookie biomes / easy dungeons before farming stat pots.`,
        where: 'Rookie biomes, Pirate Cave, Forest Maze',
        priority: 0,
      },
      ...gearGoals(character, dungeons, verdictById, ctx),
    ];
    return goals.sort((a, b) => a.priority - b.priority).slice(0, limit);
  }

  const verdictById = new Map(
    evaluateReadiness(character, dungeons, classMax, ctx.statPriority).verdicts.map((v) => [v.id, v.status]),
  );
  return [
    ...statGoals(character, dungeons, classMax, ctx),
    ...exaltGoals(character, dungeons, verdictById, ctx),
    ...gearGoals(character, dungeons, verdictById, ctx),
    ...unlockGoal(character, dungeons, ctx.declined),
  ]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Realm Rework: biomes (data/biomes.json) — the open-world pot-farming track
// ---------------------------------------------------------------------------

export type BiomeTier = 'rookie' | 'adept' | 'veteran' | 'seasonal';

export interface Biome {
  tier: BiomeTier;
  /** Beacon Guardian to kill to activate the beacon (null = active by default). */
  guardian: string | null;
  /** Stat pots this biome's open-world enemies drop. */
  statPots: StatKey[];
  /** Dungeon ids whose portals spawn in this biome. */
  dungeons: string[];
  /** Biome UT the guardian can rarely drop (null = not yet verified). */
  ut: string | null;
  /** Notable named encounters in this biome (not exhaustive). */
  encounters?: string[];
  note?: string;
}

export interface BiomeData {
  tiers?: Record<string, string>;
  biomes: Record<string, Biome>;
}

/** Biomes whose enemies drop a given stat pot, easiest (adept) tier first. */
export function biomesForStat(
  stat: StatKey,
  data: BiomeData,
): { id: string; tier: BiomeTier; guardian: string | null }[] {
  const rank: Record<BiomeTier, number> = { adept: 0, veteran: 1, rookie: 2, seasonal: 3 };
  return Object.entries(data.biomes)
    .filter(([, b]) => b.statPots.includes(stat))
    .map(([id, b]) => ({ id, tier: b.tier, guardian: b.guardian }))
    .sort((a, b) => rank[a.tier] - rank[b.tier] || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// Exaltations (data/exaltation.json) — the post-8/8 endgame grind
// ---------------------------------------------------------------------------

export type ExaltEfficiency = 'high' | 'moderate' | 'low';

export interface ExaltDungeon {
  stats: StatKey[];
  efficiency: ExaltEfficiency;
  note?: string;
}

export interface ExaltationData {
  milestones?: Record<string, number>;
  lifeManaMultiplier?: number;
  dungeons: Record<string, ExaltDungeon>;
}

/** Exalt dungeons that grant a given stat, most efficient (grindable) first. */
export function exaltDungeonsForStat(
  stat: StatKey,
  data: ExaltationData,
): { id: string; efficiency: ExaltEfficiency; note?: string }[] {
  const rank: Record<ExaltEfficiency, number> = { high: 0, moderate: 1, low: 2 };
  return Object.entries(data.dungeons)
    .filter(([, d]) => d.stats.includes(stat))
    .map(([id, d]) => ({ id, efficiency: d.efficiency, note: d.note }))
    .sort((a, b) => rank[a.efficiency] - rank[b.efficiency] || a.id.localeCompare(b.id));
}

/**
 * "Stop grinding this" signal: true when the character has progressed past the
 * point where farming this dungeon for STATS is worthwhile (diminishing returns).
 */
export function isStatFarmObsolete(d: DungeonGate, maxedCount: number): boolean {
  return d.obsoleteAtMaxed != null && maxedCount >= d.obsoleteAtMaxed;
}

// ---------------------------------------------------------------------------
// Set-Tier (ST) sets (data/sets.json) — the set browser + per-character recs
// ---------------------------------------------------------------------------

export interface SetBonus {
  /** Raw "+15 HP, +3 DEF…" text from RealmEye. */
  text: string;
  stats: Partial<Record<StatKey, number>>;
}

export interface SetMember {
  slug: string;
  name: string;
  /** weapon | ability | armor | ring (by slot order on the set page). */
  slot: string;
  score?: number;
  summary?: string;
  stats: Partial<Record<StatKey, number>>;
  description?: string;
  /** A tracked dungeon that drops this piece, if known. */
  dungeonId: string | null;
}

export interface STSet {
  slug: string;
  name: string;
  className: string;
  /** "1st Generation" | "2nd Generation" | "3rd Generation" | "Reskin". */
  generation: string;
  /** Tracked dungeons that drop pieces of this set. */
  sourceDungeonIds: string[];
  /** Difficulty = the hardest source dungeon's tier/category (null if untracked). */
  difficultyTier: number | null;
  difficultyCategory: DungeonCategory | null;
  /** Boss / chest names the set drops from — fallback "where" when no tracked dungeon. */
  sources: string[];
  bonuses: { two: SetBonus | null; three: SetBonus | null; four: SetBonus | null };
  members: SetMember[];
}

export type SetTable = STSet[];

export function setsForClass(sets: SetTable, className: string): STSet[] {
  const cls = className.toLowerCase();
  return sets.filter((s) => s.className.toLowerCase() === cls);
}

/** Rough "reward" measure: the cumulative magnitude of a set's 2/3/4-piece bonuses. */
export function setBonusMagnitude(set: STSet): number {
  let sum = 0;
  for (const b of [set.bonuses.two, set.bonuses.three, set.bonuses.four]) {
    if (b) for (const v of Object.values(b.stats)) sum += Math.abs(v ?? 0);
  }
  return sum;
}

/**
 * Best ST set for a character to farm: their class, reachable (a source dungeon
 * is ready/risky — not notReady), richest bonus first, then easiest. null if none.
 */
export function recommendSetFor(
  character: Character,
  sets: SetTable,
  verdictById: Map<string, ReadinessStatus>,
): STSet | null {
  const candidates = setsForClass(sets, character.className).filter(
    (s) => s.sourceDungeonIds.length > 0 && s.sourceDungeonIds.some((id) => verdictById.get(id) !== 'notReady'),
  );
  if (!candidates.length) return null;
  return candidates.sort(
    (a, b) => setBonusMagnitude(b) - setBonusMagnitude(a) || (a.difficultyTier ?? 9) - (b.difficultyTier ?? 9),
  )[0]!;
}

export { STAT_KEYS };
