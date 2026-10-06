/**
 * bump-data.ts — publish a new game-data revision so installed apps pull it.
 * Run after hand-editing curated data: `npm run data:bump`. (refresh-data.ts bumps
 * automatically when a scrape changes the data.) Validates the bundle first.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DATA_FILES, DATA_SCHEMA, validateBundle, type DataFile, type DataManifest } from '../src/shared/gameDataBundle';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shared', 'data');

export function bumpManifest(reason: string): DataManifest {
  const files = Object.fromEntries(DATA_FILES.map((f) => [f, JSON.parse(readFileSync(join(dataDir, f), 'utf-8'))])) as Record<DataFile, unknown>;
  const problem = validateBundle(files);
  if (problem) throw new Error(`Refusing to publish invalid data: ${problem}`);
  const path = join(dataDir, 'data-manifest.json');
  const prev = JSON.parse(readFileSync(path, 'utf-8')) as DataManifest;
  const next: DataManifest = {
    schema: DATA_SCHEMA,
    revision: prev.revision + 1,
    updated: new Date().toISOString().slice(0, 10),
    files: [...DATA_FILES],
  };
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
  console.log(`data-manifest: revision ${prev.revision} → ${next.revision} (${reason})`);
  return next;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  bumpManifest(process.argv.slice(2).join(' ') || 'manual bump');
}
