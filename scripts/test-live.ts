/**
 * test-live.ts — headless checks for src/shared/live.ts (snapshot matching + diffing).
 * Run: `npm run test:live`. Simulates a play session between two RealmEye snapshots.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePlayer } from '../src/shared/realmeye';
import { carryCharacter, charKey, diffProfiles, matchCharacters } from '../src/shared/live';
import type { ClassMaxTable } from '../src/shared/engine';
import type { Character, PlayerProfile } from '../src/shared/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const classMax = JSON.parse(readFileSync(join(root, 'src/shared/data/class-max-stats.json'), 'utf-8')) as ClassMaxTable;
const prev = parsePlayer(readFileSync(join(root, 'fixtures/player-active.html'), 'utf-8'));
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

let checks = 0;
const ok = (cond: unknown, msg: string) => {
  assert.ok(cond, msg);
  checks++;
};

ok(prev.characters.every((c) => typeof c.skin === 'number'), 'parser reads data-skin for every character');

// 0) Identical snapshot (even reordered) → no events.
const shuffled = clone(prev);
shuffled.characters.reverse();
ok(diffProfiles(prev, shuffled, classMax).length === 0, 'reordered identical snapshot → no events');

// 1) A play session.
const next: PlayerProfile = clone(prev);
const byClass = (p: PlayerProfile, cls: string) => p.characters.find((c) => c.className === cls)!;

const sam = byClass(next, 'Samurai'); // 7/8, Mana 252/300 → drink to max
sam.baseStats.mp = classMax['samurai']!.mp;
sam.stats.mp += 48;
sam.maxedCount = 8;
sam.statsMaxed = '8/8';
sam.fame += 5000;

const priest = byClass(next, 'Priest'); // 7/8 → drinks 3 ATT, swaps weapon
priest.baseStats.att += 3;
priest.stats.att += 3;
priest.equipment[0] = { slot: 'weapon', slug: 'wand-of-the-bulwark', name: 'Wand of the Bulwark', tier: 'UT', tooltip: '' };
priest.fame += 1200;

const archer = byClass(next, 'Archer'); // fame only → no event
archer.fame += 300;

next.characters = next.characters.filter((c) => c.className !== 'Warrior'); // died
const fresh: Character = {
  ...clone(byClass(prev, 'Paladin')),
  skin: 0,
  level: 1,
  fame: 0,
  maxedCount: 0,
  statsMaxed: '0/8',
  equipment: [],
};
next.characters.push(fresh); // brand-new Paladin
next.summary.exaltations = (prev.summary.exaltations ?? 0) + 2;
next.characters.reverse(); // RealmEye order shouldn't matter

const events = diffProfiles(prev, next, classMax, 1000);
for (const e of events) console.log(`  [${e.kind}] ${e.title}${e.detail ? ` — ${e.detail}` : ''}`);
const kinds = (k: string) => events.filter((e) => e.kind === k);

ok(kinds('maxed').length === 1 && kinds('maxed')[0]!.title.includes('Samurai') && kinds('maxed')[0]!.title.includes('Mana'), 'Samurai Mana maxed');
ok(kinds('pots').length === 1 && kinds('pots')[0]!.detail === '+3 ATT', 'Priest drank +3 ATT');
ok(kinds('gear').length === 1 && kinds('gear')[0]!.title.includes('Wand of the Bulwark'), 'Priest weapon swap');
ok(kinds('gone').length === 1 && kinds('gone')[0]!.className === 'Warrior', 'Warrior gone');
ok(kinds('new').length === 1 && kinds('new')[0]!.className === 'Paladin', 'new Paladin (old Paladin still matched)');
ok(kinds('exalts').length === 1 && kinds('exalts')[0]!.title === '+2 exaltations', '+2 exaltations');
ok(!events.some((e) => e.title.includes('Archer')), 'fame-only change is silent');
ok(events[0]!.kind === 'maxed', 'events sorted by importance');
ok(new Set(events.map((e) => e.id)).size === events.length, 'event ids unique');

// 2) Carry the active character across snapshots (its key changes with fame).
const activePrev = byClass(prev, 'Priest');
const carried = carryCharacter(activePrev, prev.characters, next.characters)!;
ok(carried && carried.className === 'Priest' && charKey(carried) !== charKey(activePrev), 'active Priest carried to its new key');
ok(carryCharacter(byClass(prev, 'Warrior'), prev.characters, next.characters) === null, 'dead character carries to null');

// 3) Two same-class characters: each keeps its identity.
const knightA = clone(byClass(prev, 'Knight'));
const knightB: Character = { ...clone(knightA), skin: 12345, fame: 50, level: 12, maxedCount: 0, statsMaxed: '0/8', equipment: [] };
const twinsPrev = [knightA, knightB];
const twinsNext = clone(twinsPrev).reverse();
twinsNext[0]!.fame += 40; // the low one (B) gains fame
twinsNext[0]!.level = 13;
twinsNext[1]!.fame += 900; // A gains fame
const m = matchCharacters(twinsPrev, twinsNext);
ok(m.pairs.length === 2 && !m.added.length && !m.removed.length, 'twin Knights both matched');
ok(m.pairs.every(([p, n]) => p.skin === n.skin), 'twins matched to themselves (by skin)');

// 4) A character can't lose fame → treated as a different character.
const lost = clone(prev);
byClass(lost, 'Rogue').fame -= 1;
const lostEv = diffProfiles(prev, lost, classMax);
ok(lostEv.some((e) => e.kind === 'gone') && lostEv.some((e) => e.kind === 'new'), 'fame drop = different character');

// 5) The main-process poller (no Electron needed — it only takes a fetch function).
const { LiveSync } = await import('../src/main/liveSync');
const snapshots: (PlayerProfile | Error | null)[] = [prev, next, new Error('RealmEye returned 503'), next];
let fetches = 0;
const states: string[] = [];
const emitted: number[] = [];
const sync = new LiveSync(
  {
    fetch: async () => {
      const s = snapshots[Math.min(fetches++, snapshots.length - 1)]!;
      if (s instanceof Error) throw s;
      return s;
    },
    classMax: () => classMax,
    onState: (s, events) => {
      states.push(s.status);
      emitted.push(events.length);
    },
    saveSettings: () => {},
  },
  { intervalSec: 5 },
);
ok(sync.getState().settings.intervalSec === 5, 'constructor keeps given settings');
ok(sync.configure({ intervalSec: 5 }).settings.intervalSec === 60, 'interval clamped to ≥ 60s');
const r = await sync.load('SamRiddelI', false);
ok(r.ok && sync.getState().profile === prev && sync.getState().feed.length === 0, 'first load: no events');
const [a1, a2] = await Promise.all([sync.syncNow(), sync.syncNow()]);
ok(fetches === 2 && a1 === a2, 'concurrent syncNow calls share one fetch');
ok(sync.getState().feed.length === events.length && emitted.includes(events.length), 'second snapshot → events emitted + fed');
ok(sync.getState().lastChanged != null, 'lastChanged stamped');
await sync.syncNow();
ok(sync.getState().status === 'error' && /503/.test(sync.getState().error ?? ''), 'fetch error → error status');
await sync.syncNow();
ok(sync.getState().status === 'ok' && sync.getState().error === null, 'recovers on next success');
ok(sync.getState().feed.length === events.length, 'identical re-sync adds no events');
ok(sync.configure({ enabled: false }).status === 'paused', 'disable → paused');
await sync.load('SomeoneElse', false);
ok(sync.getState().player === 'SomeoneElse' && sync.getState().feed.length === 0, 'switching players resets the feed');
ok(states.includes('syncing'), 'syncing status is broadcast');
sync.stop();

console.log(`\n✓ ${checks} live-sync checks passed`);
