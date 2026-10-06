/**
 * Self-updating game data. The app ships with bundled JSON; a newer copy can be
 * pulled from this repo's default branch (data-manifest.json → revision) without a
 * reinstall. Everything here is pure so the scraper, the main process and the
 * tests share one definition of "a valid data bundle".
 */

/** Bump only when the SHAPE of the data changes incompatibly — apps ignore other schemas. */
export const DATA_SCHEMA = 1;

/** Every hot-updatable data file (all under src/shared/data/). */
export const DATA_FILES = [
  'dungeons.json',
  'dungeon-drops.json',
  'class-max-stats.json',
  'stat-priority.json',
  'pot-routing.json',
  'biomes.json',
  'exaltation.json',
  'sets.json',
  'meta.json',
  'pets.json',
  'locations.json',
] as const;
export type DataFile = (typeof DATA_FILES)[number];

export interface DataManifest {
  schema: number;
  /** Monotonic — the app takes any revision higher than what it has. */
  revision: number;
  /** ISO date of the last data change (display only). */
  updated: string;
  files: readonly string[];
}

export interface DataBundle {
  manifest: DataManifest;
  files: Record<DataFile, unknown>;
}

/** Where apps look for newer data: the repo's default branch (public). */
export const DATA_BASE_URL = 'https://raw.githubusercontent.com/pendragonzzz/rotmg-companion/main/src/shared/data';

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/**
 * Sanity-check a bundle before trusting it (a broken scrape must never reach users).
 * Returns null when valid, else the first problem found.
 */
export function validateBundle(files: Partial<Record<DataFile, unknown>>): string | null {
  for (const f of DATA_FILES) if (files[f] === undefined) return `missing ${f}`;

  const dungeons = files['dungeons.json'];
  if (!Array.isArray(dungeons) || dungeons.length < 30) return 'dungeons.json: expected ≥ 30 dungeons';
  for (const d of dungeons) {
    if (!isObj(d) || typeof d.id !== 'string' || typeof d.name !== 'string' || typeof d.tier !== 'number' || typeof d.recommendedMaxed !== 'number')
      return 'dungeons.json: malformed dungeon';
  }

  const drops = files['dungeon-drops.json'];
  if (!isObj(drops) || Object.keys(drops).length < 30) return 'dungeon-drops.json: expected ≥ 30 dungeons';
  let gear = 0;
  for (const v of Object.values(drops)) {
    if (!isObj(v) || !Array.isArray(v.gear) || !Array.isArray(v.potions) || !Array.isArray(v.other)) return 'dungeon-drops.json: malformed entry';
    gear += v.gear.length;
  }
  if (gear < 50) return `dungeon-drops.json: only ${gear} gear drops (scrape likely failed)`;

  const classMax = files['class-max-stats.json'];
  if (!isObj(classMax) || Object.keys(classMax).length < 15) return 'class-max-stats.json: expected ≥ 15 classes';
  for (const s of Object.values(classMax)) if (!isObj(s) || typeof s.def !== 'number' || typeof s.hp !== 'number') return 'class-max-stats.json: malformed stats';

  const sets = files['sets.json'];
  if (!Array.isArray(sets) || sets.length < 40) return 'sets.json: expected ≥ 40 sets';

  const ex = files['exaltation.json'];
  if (!isObj(ex) || !isObj(ex.dungeons)) return 'exaltation.json: malformed';
  const biomes = files['biomes.json'];
  if (!isObj(biomes) || !isObj(biomes.biomes)) return 'biomes.json: malformed';
  if (!isObj(files['pot-routing.json'])) return 'pot-routing.json: malformed';
  if (!isObj(files['stat-priority.json'])) return 'stat-priority.json: malformed';
  const meta = files['meta.json'];
  if (!isObj(meta) || !Array.isArray(meta.timeline)) return 'meta.json: malformed';
  const pets = files['pets.json'];
  if (!isObj(pets) || !Array.isArray(pets.rarities)) return 'pets.json: malformed';
  const loc = files['locations.json'];
  if (!isObj(loc) || !Array.isArray(loc.places) || !Array.isArray(loc.linePatterns) || !Array.isArray(loc.processNames))
    return 'locations.json: malformed';
  return null;
}

export function validateManifest(m: unknown): m is DataManifest {
  return isObj(m) && typeof m.schema === 'number' && typeof m.revision === 'number' && typeof m.updated === 'string' && Array.isArray(m.files);
}

/** Status the app shows (Settings → About, update banner). */
export interface DataStatus {
  bundledRevision: number;
  /** Revision currently in use by the windows. */
  activeRevision: number;
  activeUpdated: string;
  source: 'bundled' | 'downloaded';
  /** A newer revision has been downloaded and is waiting for "Apply". */
  pending: { revision: number; updated: string } | null;
  lastCheck: number | null;
  error: string | null;
}
