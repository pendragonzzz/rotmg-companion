/**
 * test-location.ts — location detection from the game's own log (no game, no network).
 * Run: `npm run test:location`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPlaceIndex,
  compilePatterns,
  learnTemplate,
  lookupPlace,
  matchLine,
  redactLine,
  type LocationData,
} from '../src/shared/location';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = <T>(f: string) => JSON.parse(readFileSync(join(root, 'src/shared/data', f), 'utf-8')) as T;
const data = read<LocationData>('locations.json');
const dungeons = read<{ id: string; name: string }[]>('dungeons.json');
const index = buildPlaceIndex(data, dungeons);
const shipped = compilePatterns(data.linePatterns);

let n = 0;
const eq = (a: unknown, b: unknown, m: string) => {
  assert.equal(a, b, m);
  n++;
};
const at = (line: string, learned: RegExp[] = []) => matchLine(line, index, shipped, learned)?.id ?? null;

// ---- the place index ----
eq(lookupPlace('O3', index)?.id, 'oryx-sanctuary', 'alias O3');
eq(lookupPlace("Oryx's Sanctuary", index)?.id, 'oryx-sanctuary', 'dungeon name without the "(O3)" suffix');
eq(lookupPlace('OryxSanctuary', index)?.id, 'oryx-sanctuary', 'CamelCase identifier');
eq(lookupPlace('Marble Colossus', index)?.id, 'lost-halls', 'second half of "Lost Halls / Marble Colossus"');
eq(lookupPlace('UndeadLair', index)?.id, 'undead-lair', 'no spaces');
eq(lookupPlace('Nest', index)?.id, 'the-nest', 'leading "The" optional');
eq(lookupPlace('Nexus (USWest)', index)?.id, 'nexus', 'trailing server noise');
eq(lookupPlace('Vault', index)?.kind, 'vault', 'vault is a place');
eq(lookupPlace('Banana Stand', index), null, 'unknown text → no place');
eq(index.places.filter((p) => p.kind === 'dungeon').length, dungeons.length, 'every dungeon is a place');

// ---- shipped patterns ----
eq(at('Loading map: Undead Lair'), 'undead-lair', 'loading map: X');
eq(at('[Game] Entering Nexus'), 'nexus', 'entering X');
eq(at('[World] map = "Lost Halls" (id 12)'), 'lost-halls', 'map = "X"');
eq(at('Teleporting to Vault...'), 'vault', 'teleporting to X');
// Log noise must not invent a location.
eq(at('Initialize engine version: 2021.3.45f1'), null, 'engine banner');
eq(at("Mono path[0] = 'C:/Program Files/RotMG Exalt/RotMG Exalt_Data/Managed'"), null, 'mono path');
eq(at('Loading asset bundle textures_42 (3.2 MB)'), null, 'asset bundle');
eq(at('UnloadTime: 1.23 ms'), null, 'unload time');
eq(compilePatterns(['(unclosed', 'ok(?<name>x)']).length, 1, 'a broken pattern in the data is skipped');

// ---- learning from a manual pick ----
const recent = [
  '[12:01:02] [Net] Hello sent',
  '[12:01:05] [MapController] now in UndeadLair (seed 99812)',
  '[12:01:06] [Audio] music changed',
];
eq(at(recent[1]!), null, 'an unknown log format is not detected by the shipped patterns');
const tpl = learnTemplate(recent, index.byId.get('undead-lair')!, index);
assert.ok(tpl, 'learned a template from the line naming the picked place');
n++;
const learned = [new RegExp(tpl!.source, 'i')];
eq(at('[12:30:09] [MapController] now in Nexus (seed 1)', learned), 'nexus', 'learned template detects the Nexus');
eq(at('[13:02:44] [MapController] now in The Nest (seed 5)', learned), 'the-nest', '…and other dungeons');
eq(at('[13:02:45] [MapController] now in Narnia (seed 5)', learned), null, '…but only known places');
eq(learnTemplate(['UndeadLair'], index.byId.get('undead-lair')!, index), null, 'a bare name is too vague to learn from');
eq(learnTemplate(['[Audio] music changed'], index.byId.get('undead-lair')!, index), null, 'no line names the place → nothing learned');

// ---- redaction for the diagnostics panel ----
const red = redactLine('user jaden@example.com at C:\\Users\\Jaden\\AppData 10.0.0.5:2050 tok=AbCdEfGhIjKlMnOpQrStUvWxYz123');
assert.ok(!/jaden@|\\Jaden\\|10\.0\.0\.5|AbCdEfGh/.test(red), `redacted: ${red}`);
n++;

console.log(`✓ ${n} location checks passed`);
