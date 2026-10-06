/** test-search.ts — Ctrl+K ranking + "where does it drop" item index. Run: `npm run test:search`. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { itemEntries, searchEntries, type SearchEntry } from '../src/shared/search';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = <T>(f: string) => JSON.parse(readFileSync(join(root, 'src/shared/data', f), 'utf-8')) as T;
const dungeons = read<{ id: string; name: string }[]>('dungeons.json');
const name = (id: string) => dungeons.find((d) => d.id === id)?.name ?? id;
const items = itemEntries(read('dungeon-drops.json'), name);
let n = 0;
const ok = (c: unknown, m: string) => {
  assert.ok(c, m);
  n++;
};

const sword = items.find((i) => i.title === 'Spectral Sword');
ok(sword && /Undead Lair/.test(sword.sub ?? '') && sword.ref === 'undead-lair', `Spectral Sword → Undead Lair (${sword?.sub})`);
ok(sword?.tier === 'UT', 'tier carried');
ok(!items.some((i) => /^Potion of /.test(i.title)), 'regular stat pots left out');
ok(items.some((i) => i.title === 'Greater Potion of Life'), 'Greater pots in');
ok(items.length > 300, `big index (${items.length} items)`);

const all: SearchEntry[] = [
  { id: 'page:gear', kind: 'page', title: 'Gear', ref: 'gear' },
  { id: 'dungeon:undead-lair', kind: 'dungeon', title: 'Undead Lair', ref: 'undead-lair' },
  { id: 'place:nexus', kind: 'place', title: 'Nexus', ref: 'nexus' },
  ...items,
];
ok(searchEntries(all, 'spectral sw')[0]?.title === 'Spectral Sword', 'multi-word prefix finds the item first');
ok(searchEntries(all, 'undead')[0]?.kind === 'dungeon', 'the dungeon outranks items that drop there');
ok(searchEntries(all, 'septavius').some((e) => e.kind === 'item'), 'search by boss name finds its loot');
ok(searchEntries(all, 'gear')[0]?.id === 'page:gear', 'exact page title first');
ok(searchEntries(all, 'zzzz qqq').length === 0, 'no match → empty');
ok(searchEntries(all, '').length > 0, 'empty query → launcher list');
console.log(`✓ ${n} search checks passed`);
