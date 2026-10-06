/**
 * test-data-update.ts — the self-updating game data path, end to end, with a fake
 * "GitHub" (no network, no Electron). Run: `npm run test:data`.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameDataUpdater } from '../src/main/gameDataUpdater';
import { DATA_FILES, type DataManifest, type DataStatus } from '../src/shared/gameDataBundle';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f: string) => JSON.parse(readFileSync(join(root, 'src/shared/data', f), 'utf-8'));
const bundled = read('data-manifest.json') as DataManifest;
const files = Object.fromEntries(DATA_FILES.map((f) => [f, read(f)]));

/** A fake raw.githubusercontent.com serving `remote` files. */
function fakeFetch(remote: Record<string, unknown>, fail = false): typeof fetch {
  return (async (url: string | URL) => {
    if (fail) throw new Error('offline');
    const name = String(url).split('/').pop()!.split('?')[0]!;
    if (!(name in remote)) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(remote[name]), { status: 200 });
  }) as typeof fetch;
}

let n = 0;
const ok = (c: unknown, m: string) => {
  assert.ok(c, m);
  n++;
};
const dir = join(mkdtempSync(join(tmpdir(), 'rotmg-data-')), 'game-data');
const statuses: DataStatus[] = [];

// 1) Remote has the same revision → nothing to do.
let u = new GameDataUpdater(dir, bundled, (s) => statuses.push(s), fakeFetch({ ...files, 'data-manifest.json': bundled }));
let s = await u.check();
ok(!s.pending && !s.error && s.source === 'bundled', 'same revision → up to date');

// 2) A newer, valid revision → downloaded, staged, pending until apply().
const nextManifest = { ...bundled, revision: bundled.revision + 1, updated: '2026-10-13' };
const nextFiles = { ...files, 'meta.json': { ...files['meta.json'], asOf: '2026-10-13' } };
u = new GameDataUpdater(dir, bundled, (s2) => statuses.push(s2), fakeFetch({ ...nextFiles, 'data-manifest.json': nextManifest }));
s = await u.check();
ok(s.pending?.revision === nextManifest.revision, 'newer revision → pending');
ok(u.get() === null, 'not used until applied');
ok(existsSync(join(dir, 'data-manifest.json')) && !existsSync(`${dir}-new`), 'written to disk, staging folder swapped away');
ok(u.apply() && u.get()?.manifest.revision === nextManifest.revision && u.status().source === 'downloaded', 'apply → in use');
ok((u.get()!.files['meta.json'] as { asOf: string }).asOf === '2026-10-13', 'downloaded content is what the app reads');

// 3) Next launch: a fresh updater adopts the installed bundle without any network.
const relaunch = new GameDataUpdater(dir, bundled, () => {}, fakeFetch({}, true));
relaunch.loadInstalled();
ok(relaunch.get()?.manifest.revision === nextManifest.revision, 'relaunch adopts the downloaded data');

// 4) A broken scrape is refused and the good data stays.
const broken = { ...files, 'dungeon-drops.json': {}, 'data-manifest.json': { ...bundled, revision: bundled.revision + 2 } };
const u2 = new GameDataUpdater(dir, bundled, () => {}, fakeFetch(broken));
u2.loadInstalled();
s = await u2.check();
ok(!s.pending && /validation/.test(s.error ?? ''), 'invalid remote data rejected');
ok(JSON.parse(readFileSync(join(dir, 'data-manifest.json'), 'utf-8')).revision === nextManifest.revision, 'installed data untouched');

// 5) Data for a newer app schema is ignored (needs an app update), and offline is non-fatal.
const future = new GameDataUpdater(dir, bundled, () => {}, fakeFetch({ ...files, 'data-manifest.json': { ...bundled, schema: 99, revision: 99 } }));
s = await future.check();
ok(!s.pending && /app update/.test(s.error ?? ''), 'newer schema → wait for an app update');
s = await new GameDataUpdater(dir, bundled, () => {}, fakeFetch({}, true)).check();
ok(s.error === 'offline' && !s.pending, 'offline → error status, nothing changes');

// 6) An older bundle on disk is ignored in favour of newer bundled data.
const stale = new GameDataUpdater(dir, { ...bundled, revision: 50 }, () => {});
stale.loadInstalled();
ok(stale.get() === null, 'bundled data newer than the download → bundled wins');
ok(statuses.length > 0, 'status pushed to the app');

rmSync(dirname(dir), { recursive: true, force: true });
console.log(`✓ ${n} data-update checks passed`);
