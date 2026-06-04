/**
 * Build the per-class MAX stats table.
 *
 * For an 8/8 character, base stats (current - equipment bonus) == that class's
 * max stats, so we can derive an authoritative table from real characters
 * instead of guessing. We seed from saved fixtures (offline) and then top up
 * from a few top players live (polite, rate-limited) to cover every class.
 *
 * Output: src/shared/data/class-max-stats.json  (committed; the app reads this).
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePlayer, fetchPlayer } from '../src/shared/realmeye';
import { STAT_KEYS, type Stats, type Character } from '../src/shared/types';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', 'fixtures');
const outDir = join(here, '..', 'src', 'shared', 'data');
const outFile = join(outDir, 'class-max-stats.json');

// Top players (high exaltations) tend to own many classes at 8/8.
const TOP_PLAYERS = [
  'SamRiddelI', 'pax', 'WigDr', 'PopePiusX', 'Horlandius',
  'Jadragonson', 'Murder', 'Spoder', 'Uberer', 'mrow',
  'Barrenb', 'fluffy', 'Haebin', 'ArasakaTower', 'NPC',
];

const table: Record<string, Stats> = {};

function absorb(chars: Character[]): void {
  for (const c of chars) {
    if (c.maxedCount !== 8) continue;
    const key = c.className.toLowerCase();
    const existing = table[key];
    if (!existing) table[key] = { ...c.baseStats };
    else for (const s of STAT_KEYS) existing[s] = Math.max(existing[s], c.baseStats[s]);
  }
}

// 1) Seed from saved fixtures (offline).
for (const file of readdirSync(fixturesDir)) {
  if (!file.endsWith('.html')) continue;
  absorb(parsePlayer(readFileSync(join(fixturesDir, file), 'utf-8')).characters);
}

// 2) Top up from live top players.
for (const name of TOP_PLAYERS) {
  try {
    const profile = await fetchPlayer(name);
    if (profile) {
      absorb(profile.characters);
      process.stdout.write(`  fetched ${name} (${Object.keys(table).length} classes so far)\n`);
    }
  } catch (err) {
    process.stdout.write(`  skipped ${name}: ${err instanceof Error ? err.message : err}\n`);
  }
}

const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');

const classes = Object.keys(sorted);
console.log(`\nWrote ${classes.length} classes -> ${outFile}`);
console.log(classes.join(', '));
