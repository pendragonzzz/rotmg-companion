/**
 * The bundled game data, imported and typed once. Every page reads from here so the
 * JSON casts (and lookup maps) live in one place.
 */
import type {
  BiomeData,
  ClassMaxTable,
  DungeonDropTable,
  DungeonGate,
  ExaltationData,
  GoalContext,
  PotRouting,
  SetTable,
  StatPriority,
} from '../../shared/engine';
import type { PlannerData } from '../../shared/planner';
import dungeonsData from '../../shared/data/dungeons.json';
import classMaxData from '../../shared/data/class-max-stats.json';
import dungeonDropsData from '../../shared/data/dungeon-drops.json';
import statPriorityData from '../../shared/data/stat-priority.json';
import potRoutingData from '../../shared/data/pot-routing.json';
import biomesData from '../../shared/data/biomes.json';
import exaltationData from '../../shared/data/exaltation.json';
import setsData from '../../shared/data/sets.json';
import metaData from '../../shared/data/meta.json';

export const dungeons = dungeonsData as DungeonGate[];
export const classMax = classMaxData as ClassMaxTable;
export const dungeonDrops = dungeonDropsData as DungeonDropTable;
export const statPriority = statPriorityData as StatPriority;
export const potRouting = potRoutingData as unknown as PotRouting;
export const biomes = biomesData as unknown as BiomeData;
export const exaltation = exaltationData as unknown as ExaltationData;
export const sets = setsData as unknown as SetTable;

export interface SeasonEntry {
  season: string;
  name: string;
  date: string;
  highlights: string[];
}
export interface MetaDigest {
  asOf: string;
  current: string;
  timeline: SeasonEntry[];
  rules: string[];
  corrections: string[];
}
export const meta = metaData as unknown as MetaDigest;

export const dungeonById = new Map(dungeons.map((d) => [d.id, d]));
export const dungeonName = (id: string) => dungeonById.get(id)?.name ?? id;

/** Context for engine.buildGoals. */
export const goalCtx: GoalContext = { dungeonDrops, statPriority, potRouting, biomes, exaltation };

/** Everything the planner needs, in one object. */
export const plannerData: PlannerData = {
  dungeons,
  classMax,
  drops: dungeonDrops,
  routing: potRouting,
  biomes,
  exaltation,
  statPriority,
  sets,
};

/** RealmEye's player tooltips label ST pieces "UT" — the set roster is the reliable signal. */
const stSlugs = new Set(sets.flatMap((s) => s.members.map((m) => m.slug)));
export const effectiveTier = (slug: string, tier: string | null) => (stSlugs.has(slug) ? 'ST' : tier);

/** CSS modifier for a tier badge. */
export const tierClass = (tier: string | null | undefined) => (tier === 'UT' ? 'ut' : tier === 'ST' ? 'st' : 't');

export const realmeyeWiki = (slug: string) => `https://www.realmeye.com/wiki/${slug}`;
/** Our dungeon ids that differ from RealmEye's wiki slug (mirrors scripts/refresh-data.ts). */
const WIKI_SLUG: Record<string, string> = {
  'davy-jones-locker': 'davy-jones-s-locker',
  'oryx-sanctuary': 'oryx-s-sanctuary',
  'puppet-masters-theatre': 'puppet-master-s-theatre',
  'puppet-masters-encore': 'puppet-master-s-encore',
  'crawling-depths': 'the-crawling-depths',
};
export const dungeonWikiUrl = (id: string) => realmeyeWiki(WIKI_SLUG[id] ?? id);
