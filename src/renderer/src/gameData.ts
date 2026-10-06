/**
 * The game data, imported and typed once. Every page reads from here so the JSON
 * casts (and lookup maps) live in one place. The bundled JSON is the default; a newer
 * downloaded bundle replaces it via installGameData() BEFORE the app modules load
 * (see main.tsx), so every page sees one consistent dataset.
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
import petsData from '../../shared/data/pets.json';
import locationsData from '../../shared/data/locations.json';
import manifestData from '../../shared/data/data-manifest.json';
import type { DataBundle, DataManifest } from '../../shared/gameDataBundle';
import { buildPlaceIndex, type LocationData, type PlaceIndex } from '../../shared/location';

export let dungeons = dungeonsData as DungeonGate[];
export let classMax = classMaxData as ClassMaxTable;
export let dungeonDrops = dungeonDropsData as DungeonDropTable;
export let statPriority = statPriorityData as StatPriority;
export let potRouting = potRoutingData as unknown as PotRouting;
export let biomes = biomesData as unknown as BiomeData;
export let exaltation = exaltationData as unknown as ExaltationData;
export let sets = setsData as unknown as SetTable;
export let pets: unknown = petsData;
export let locations = locationsData as unknown as LocationData;
/** Which data the app is running on (Settings → About). */
export let dataManifest = manifestData as DataManifest;
export let dataSource: 'bundled' | 'downloaded' = 'bundled';

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
export let meta = metaData as unknown as MetaDigest;

export let dungeonById = new Map(dungeons.map((d) => [d.id, d]));
export const dungeonName = (id: string) => dungeonById.get(id)?.name ?? id;
/** Nexus / Vault / Realm / hubs + every dungeon, for the location picker and detection. */
export let placeIndex: PlaceIndex = buildPlaceIndex(locations, dungeons);

/** Context for engine.buildGoals. */
export let goalCtx: GoalContext = { dungeonDrops, statPriority, potRouting, biomes, exaltation };

/** Everything the planner needs, in one object. */
export let plannerData: PlannerData = {
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
let stSlugs = new Set(sets.flatMap((s) => s.members.map((m) => m.slug)));

/**
 * Switch to a downloaded data bundle. Call once, before importing App/OverlayApp —
 * module-level caches in the pages are computed from these values at import time.
 */
export function installGameData(bundle: DataBundle): void {
  const f = bundle.files;
  dungeons = f['dungeons.json'] as DungeonGate[];
  classMax = f['class-max-stats.json'] as ClassMaxTable;
  dungeonDrops = f['dungeon-drops.json'] as DungeonDropTable;
  statPriority = f['stat-priority.json'] as StatPriority;
  potRouting = f['pot-routing.json'] as PotRouting;
  biomes = f['biomes.json'] as BiomeData;
  exaltation = f['exaltation.json'] as ExaltationData;
  sets = f['sets.json'] as SetTable;
  meta = f['meta.json'] as MetaDigest;
  pets = f['pets.json'];
  locations = (f['locations.json'] as LocationData | undefined) ?? locations;
  dataManifest = bundle.manifest;
  dataSource = 'downloaded';
  dungeonById = new Map(dungeons.map((d) => [d.id, d]));
  placeIndex = buildPlaceIndex(locations, dungeons);
  goalCtx = { dungeonDrops, statPriority, potRouting, biomes, exaltation };
  plannerData = { dungeons, classMax, drops: dungeonDrops, routing: potRouting, biomes, exaltation, statPriority, sets };
  stSlugs = new Set(sets.flatMap((s) => s.members.map((m) => m.slug)));
}
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
