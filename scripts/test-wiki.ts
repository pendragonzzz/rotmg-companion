import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseDungeonDrops, parseItemPage, parseSetIndex, parseSetPage } from '../src/shared/realmeye-wiki';

const here = dirname(fileURLToPath(import.meta.url));
const fx = join(here, '..', 'fixtures');

console.log('=== DUNGEON: the-nest → Drops of Interest ===');
const drops = parseDungeonDrops(readFileSync(join(fx, 'wiki-the-nest.html'), 'utf-8'));
console.log(`${drops.length} items parsed`);
for (const d of drops.slice(0, 12)) {
  console.log(`  ${d.name} <${d.slug}>  ← ${d.dropsFrom.slice(0, 2).join(', ')}`);
}

console.log('\n=== ITEM: hivemaster-helm (ability) ===');
console.log(parseItemPage(readFileSync(join(fx, 'wiki-hivemaster-helm.html'), 'utf-8')));

console.log('\n=== ITEM: demon-blade (weapon) ===');
console.log(parseItemPage(readFileSync(join(fx, 'wiki-demon-blade.html'), 'utf-8')));

console.log('\n=== SET INDEX: /wiki/set-tier-items (current sets only) ===');
const idx = parseSetIndex(readFileSync(join(fx, 'set-index.html'), 'utf-8'));
console.log(`${idx.length} current sets across classes`);
for (const e of idx.slice(0, 8)) console.log(`  [${e.className}/${e.generation}] ${e.name} <${e.slug}>`);

console.log('\n=== SET PAGE: twilight-archmage-set ===');
console.log(parseSetPage(readFileSync(join(fx, 'set-twilight.html'), 'utf-8'), 'twilight-archmage-set'));

console.log('\n=== ITEM: corruption-tether (ST member) ===');
const ct = parseItemPage(readFileSync(join(fx, 'item-corruption-tether.html'), 'utf-8'), 'corruption-tether');
console.log({ name: ct.name, tier: ct.tier, tierType: ct.tierType, generation: ct.generation, dungeon: ct.dungeon, set: ct.set, stats: ct.statBonuses });

// ---- per-enemy drop tables (The Nest) ----
import assert from 'node:assert/strict';
import { buildEnemyTables } from '../src/shared/dropTables';
// Tiers as the refresh resolves them (player-universe / item pages); unknown → null.
const KNOWN_UT = new Set(['hivemaster-helm', 'hivemind-mace', 'queen-s-stinger', 'combcutter-kunai', 'swarmlord-s-sigil', 'apiary-armor', 'honey-circlet', 'nectar-crossfire', 'honeytomb-snare', 'beekeeper-s-flamethrower']);
const tables = buildEnemyTables(drops, (slug) => (KNOWN_UT.has(slug) ? 'UT' : null));
console.log('\n=== DROP TABLES: the-nest (rare loot per enemy) ===');
for (const t of tables) {
  console.log(`  ${t.name}${t.variants ? ` (${t.variants.length} colours)` : ''}: ${t.loot.map((l) => `${l.kind === 'gear' ? `[${l.tier}] ` : ''}${l.name}`).join(', ')}`);
}
const queen = tables.find((t) => t.name === 'Killer Bee Queen')!;
assert.ok(tables[0] === queen, 'the boss leads the drop tables');
assert.ok(queen.loot.some((l) => l.name === 'Greater Potion of Life' && l.kind === 'greater' && l.stat === 'hp'), 'Queen drops Greater Life');
assert.ok(queen.loot.some((l) => l.name === 'Sword Rune' && l.kind === 'key'), 'Queen drops the Sword Rune');
assert.ok(!queen.loot.some((l) => /Mark of|Pet Skin/.test(l.name)), 'junk (marks, pet skins) filtered');
const soldiers = tables.find((t) => t.name === 'Soldier Bee')!;
assert.ok(soldiers?.variants?.length === 3, 'Blue/Red/Yellow Soldier Bees folded into one row');
assert.ok(!tables.some((t) => /Killer Bee$/.test(t.name) && !/Queen/.test(t.name)), 'Royal-Jelly-only minions dropped (no rare loot)');
assert.ok(tables.some((t) => t.name === 'The Beekeeper' && t.loot.some((l) => l.name === "Beekeeper's Flamethrower")), 'Beekeeper has its own table');
console.log(`✓ drop-table checks passed (${tables.length} enemies with rare loot)`);

// ---- item kind (slot learning in the refresh) ----
const kindOf = (f: string, slug: string) => parseItemPage(readFileSync(join(fx, f), 'utf-8'), slug).itemType;
assert.equal(kindOf('wiki-demon-blade.html', 'demon-blade'), 'Swords', 'Demon Blade is a Sword');
assert.equal(kindOf('wiki-hivemaster-helm.html', 'hivemaster-helm'), 'Helms', 'Hivemaster Helm is a Helm');
assert.equal(kindOf('item-corruption-tether.html', 'corruption-tether'), 'Staves', 'Corruption Tether is a Staff (not its set)');

// ---- RealmEye player tooltips without tiers → filled in from the game data ----
import { parsePlayer, withKnownTiers } from '../src/shared/realmeye';
import { knownItemTiers } from '../src/shared/dropTables';
const playerHtml = readFileSync(join(fx, 'player-active.html'), 'utf-8');
const tagged = parsePlayer(playerHtml);
const blank = parsePlayer(playerHtml.replace(/(<span class="item[^"]*" title=")[^"]*"/g, '$1"'));
const taggedUT = tagged.characters.flatMap((c) => c.equipment).filter((e) => e.tier === 'UT' || e.tier === 'ST');
assert.ok(taggedUT.length > 10 && blank.characters.flatMap((c) => c.equipment).every((e) => !e.tier), 'blank tooltips → no tiers (the RealmEye change)');
const dataDir = join(here, '..', 'src', 'shared', 'data');
const tiers = knownItemTiers(
  JSON.parse(readFileSync(join(dataDir, 'dungeon-drops.json'), 'utf-8')),
  JSON.parse(readFileSync(join(dataDir, 'sets.json'), 'utf-8')),
);
const filled = withKnownTiers(blank, tiers).characters.flatMap((c) => c.equipment);
const restored = filled.filter((e) => e.tier === 'UT' || e.tier === 'ST').length;
assert.ok(restored >= taggedUT.length * 0.6, `known UT/STs restored (${restored}/${taggedUT.length})`);
assert.ok(filled.every((e) => !e.tier || tiers.get(e.slug) === e.tier), 'only tiers the data knows are filled in');
assert.ok(withKnownTiers(tagged, new Map()).characters[0]!.equipment[0]!.tier === tagged.characters[0]!.equipment[0]!.tier, 'tiers RealmEye did send are kept');
console.log(`✓ item-kind + tier fill-in checks passed (${restored}/${taggedUT.length} UT/ST restored from data)`);
