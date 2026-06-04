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
