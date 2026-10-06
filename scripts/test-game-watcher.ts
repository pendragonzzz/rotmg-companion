/**
 * test-game-watcher.ts — the main-process game watcher against a fake game session:
 * a Player.log we append to, a process list we control, and a fake clock.
 * Run: `npm run test:watcher`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameWatcher } from '../src/main/gameWatcher';
import { buildPlaceIndex, type GameState, type LearnedTemplate, type LocationData } from '../src/shared/location';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = <T>(f: string) => JSON.parse(readFileSync(join(root, 'src/shared/data', f), 'utf-8')) as T;
const data = read<LocationData>('locations.json');
const index = buildPlaceIndex(data, read('dungeons.json'));

// ---- the fake world ----
let clock = 1_000_000;
let log: string | null = null;
let mtime = 0;
let procs: string[] = [];
let saved: LearnedTemplate[] = [];
let seenMarked = false;
const states: GameState[] = [];
const LOG = 'C:/Users/me/AppData/LocalLow/DECA Live Operations GmbH/RotMG Exalt/Player.log';
const write = (text: string) => {
  log = (log ?? '') + text;
  mtime = clock;
};

const w = new GameWatcher(
  {
    supported: true,
    listProcesses: async () => procs,
    findLogs: () => (log === null ? [] : [LOG]),
    stat: () => (log === null ? null : { size: Buffer.byteLength(log), mtimeMs: mtime }),
    read: (_p, start, len) => Buffer.from(log ?? '').subarray(start, start + len).toString('utf-8'),
    data: () => data,
    index: () => index,
    loadLearned: () => saved,
    saveLearned: (t) => (saved = t.map((x) => ({ ...x }))),
    markSeen: () => (seenMarked = true),
    onChange: (s) => states.push(s),
    now: () => clock,
  },
  { detectFromLog: true },
);
const s = () => w.getState();
const step = (ms = 1000) => {
  clock += ms;
  w.tick();
};
let n = 0;
const ok = (c: unknown, m: string) => {
  assert.ok(c, m);
  n++;
};

// 1) Nothing yet.
w.tick();
ok(!s().running && s().logPath === null && s().location === null, 'no game, no log → idle');
ok(!s().seenGame, 'never seen the game → following it cannot hide the HUD yet');
procs = ['explorer.exe', 'RotMG Exalt.exe'];
await w.pollProcesses();
ok(s().running, 'game process seen → running');
ok(s().seenGame && seenMarked, 'first detection remembered (HUD may now follow the game)');

// 2) Attaching to a log from an earlier session doesn't claim a stale location.
log = 'Initialize engine version: 2021.3\nLoading map: Nexus\n';
mtime = clock - 3_600_000;
procs = [];
await w.pollProcesses();
w.tick();
ok(s().logPath === LOG && s().location === null, 'old log attached, stale location ignored');

// 3) The game writes as you play.
procs = ['RotMG Exalt.exe'];
await w.pollProcesses();
write('[Net] connected\nLoading map: Undead Lair\n');
step();
ok(s().location?.placeId === 'undead-lair' && s().location?.source === 'log', 'Loading map: X → detected from the log');
ok(s().location?.dungeonId === 'undead-lair', 'dungeon id carried for the dungeon card');

// 4) A line the shipped patterns don't know → no change… until the player picks once.
write('[12:00:01] [MapController] now in Nexus (seed 3)\n');
step();
ok(s().location?.placeId === 'undead-lair', 'unknown log format → no guess');
const r = w.setManual(index.byId.get('nexus')!);
ok(s().location?.placeId === 'nexus' && s().location?.source === 'manual', 'manual pick wins');
ok(r.learned && saved.length === 1 && s().learned.length === 1, 'learned how this log names places');

// 5) Next time it's automatic.
write('[12:04:10] [MapController] now in The Nest (seed 7)\n');
step();
ok(s().location?.placeId === 'the-nest' && s().location?.source === 'log', 'learned template detects the next dungeon');
ok(saved[0]!.hits === 1, 'template hit counted + saved');

// 6) Lines split across reads are joined.
write('[12:09:00] [MapController] now in Lost ');
step();
ok(s().location?.placeId === 'the-nest', 'half a line → wait');
write('Halls (seed 9)\n');
step();
ok(s().location?.placeId === 'lost-halls', 'completed line → detected');

// 7) The game restarts and rewrites its log → back to "unknown" until it says otherwise.
log = '';
write('Initialize engine version: 2021.3\n');
step();
ok(s().location === null, 'log rewritten (game restarted) → location cleared');
write('[12:20:00] [MapController] now in Nexus (seed 1)\n');
step();
ok(s().location?.placeId === 'nexus', 'detects again in the new session');

// 8) Game closes: process gone and the log goes quiet.
procs = [];
clock += 120_000;
await w.pollProcesses();
ok(!s().running && s().location === null, 'game closed → not running, location cleared');

// 9) Diagnostics are redacted; forgetting works; turning detection off stops it.
write('login ok for someone@example.com from C:\\Users\\Someone\\x\n');
step();
ok(s().recent.every((l) => !/someone@|\\Someone\\/.test(l)), 'diagnostic lines are redacted');
w.forgetLearned();
ok(s().learned.length === 0 && saved.length === 0, 'forget learned templates');
w.configure({ detectFromLog: false });
write('Loading map: Vault\n');
step();
ok(s().location?.placeId !== 'vault', 'detection off → log ignored');
ok(states.length > 0, 'state pushed to the app');

console.log(`✓ ${n} game-watcher checks passed`);
