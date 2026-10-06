/**
 * test-planner.ts — headless checks for src/shared/planner.ts.
 * Run: `npm run test:planner`. Prints each plan and asserts the invariants the UI relies on.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePlayer } from '../src/shared/realmeye';
import { POT_INCREMENT, type BiomeData, type ExaltationData, type PotRouting, type SetTable } from '../src/shared/engine';
import { GREATER_MULTIPLIER, dungeonInfo, exaltPlan, gearPlan, potionPlan, type PlannerData } from '../src/shared/planner';
import type { Character } from '../src/shared/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf-8'));

const data: PlannerData = {
  dungeons: read('src/shared/data/dungeons.json'),
  classMax: read('src/shared/data/class-max-stats.json'),
  drops: read('src/shared/data/dungeon-drops.json'),
  routing: read('src/shared/data/pot-routing.json') as PotRouting,
  biomes: read('src/shared/data/biomes.json') as BiomeData,
  exaltation: read('src/shared/data/exaltation.json') as ExaltationData,
  statPriority: read('src/shared/data/stat-priority.json'),
  sets: read('src/shared/data/sets.json') as SetTable,
};

const fixture = parsePlayer(readFileSync(join(root, 'fixtures/player-active.html'), 'utf-8')).characters;

// A fresh level-20 Wizard (2/8, tiered gear) to exercise the early game.
const wizMax = data.classMax['wizard']!;
const beginner: Character = {
  classId: 782,
  className: 'Wizard',
  level: 20,
  fame: 900,
  stats: { ...wizMax, hp: 600, mp: 300, att: 50, def: 0, spd: 40, dex: wizMax.dex, vit: 40, wis: wizMax.wis },
  baseStats: { ...wizMax, hp: 600, mp: 300, att: 50, def: 0, spd: 40, dex: wizMax.dex, vit: 40, wis: wizMax.wis },
  maxedCount: 2,
  statsMaxed: '2/8',
  equipment: [
    { slot: 'weapon', slug: 'staff-of-the-cosmic-whole', name: 'Staff of the Cosmic Whole', tier: 'T12', tooltip: '' },
    { slot: 'ability', slug: 'magic-nova-spell', name: 'Magic Nova Spell', tier: 'T5', tooltip: '' },
    { slot: 'armor', slug: 'robe-of-the-elder-warlock', name: 'Robe of the Elder Warlock', tier: 'T11', tooltip: '' },
    { slot: 'ring', slug: 'ring-of-exalted-dexterity', name: 'Ring of Exalted Dexterity', tier: 'T5', tooltip: '' },
  ],
  petId: null,
};

let checks = 0;
const ok = (cond: unknown, msg: string) => {
  assert.ok(cond, msg);
  checks++;
};

for (const c of [beginner, fixture[0]!, fixture[2]!, fixture.find((x) => x.className === 'Knight')!]) {
  const pot = potionPlan(c, data);
  console.log(`\n===== ${c.className} ${c.statsMaxed} =====`);
  console.log(`  pots: ${pot.mainPots} main · ${pot.lifePots} life · ${pot.manaPots} mana · or ${pot.greaterTotal} greaters`);
  for (const s of pot.todo) {
    console.log(
      `  #${s.rank + 1} ${s.stat.toUpperCase()} ${s.base}/${s.max} → ${s.pots} pots (${s.greaters} greater)` +
        `  best now: ${s.bestNow ? `${s.bestNow.name} [${s.bestNow.status}]` : `— (unlocks: ${s.nextUnlock?.name} @${s.nextUnlock?.needs}/8)`}  biome: ${s.biomes[0]?.id ?? '—'}`,
    );
    ok(s.pots === Math.ceil(s.remaining / POT_INCREMENT[s.stat]), `${s.stat} pot math`);
    ok(s.greaters === Math.ceil(s.remaining / (POT_INCREMENT[s.stat] * GREATER_MULTIPLIER)), `${s.stat} greater math`);
    ok(s.sources.every((x) => typeof x.id === 'string' && x.id.length > 0), `${s.stat} sources carry ids`);
  }
  console.log(`  route: ${pot.route.map((r) => `${r.biome}[${r.covers.join('/')}]`).join(' → ') || '(maxed)'}`);
  const covered = new Set(pot.route.flatMap((r) => r.covers));
  ok(pot.todo.every((s) => covered.has(s.stat)), `${c.className}: farm route covers every unmaxed stat`);
  ok(pot.todo.length === 8 - c.maxedCount || !pot.hasClassMax, `${c.className}: todo count matches n/8`);
  const firstVet = pot.route.findIndex((r) => r.tier === 'veteran');
  ok(firstVet === -1 || pot.route.slice(firstVet).every((r) => r.tier === 'veteran'), `${c.className}: adept stops before veteran`);
  ok(pot.todo.every((s) => s.bestNow || s.nextUnlock), `${c.className}: every unmaxed stat has a source or an unlock hint`);

  const gear = gearPlan(c, data);
  console.log(`  gear: ${gear.specialized}/4 UT/ST · ${gear.upgradesNow} upgrades now`);
  for (const s of gear.slots) {
    console.log(
      `   ${s.slot.padEnd(7)} ${s.equipped ? `${s.equipped.tier ?? '—'} ${s.equipped.name}${s.equipped.score != null ? ` (${s.equipped.score})` : ''}` : '(empty)'}` +
        `  → now: ${s.bestNow ? `${s.bestNow.name} ${s.bestNow.score}` : '—'}  BiS: ${s.bis?.name ?? '—'}${s.upgradeNow ? '  ⬆' : ''}${s.isBis ? '  ★BiS' : ''}`,
    );
    ok(s.options.every((o, i) => i === 0 || s.options[i - 1]!.score >= o.score), `${s.slot} options sorted`);
    ok(!s.bestNow || s.bestNow.status === 'ready' || s.bestNow.status === 'risky', `${s.slot} bestNow reachable`);
  }
  for (const p of gear.setProgress) console.log(`   set ${p.set.name}: ${p.owned.length}/${p.set.members.length}`);
  if (gear.recommended) console.log(`   ★ recommended: ${gear.recommended.name}`);

  if (c.maxedCount === 8) {
    const ex = exaltPlan(c, data);
    console.log(`  exalts: ${ex.slice(0, 4).map((e) => `${e.name}(${e.stats.join('/')},${e.efficiency})`).join(', ')}`);
    ok(ex[0]!.efficiency === 'high', 'exalt plan leads with a high-efficiency dungeon');
  }
}

// Beginner specifics: Wizard is DEF/VIT-poor → those must be on the route, and gear must have upgrades.
const bPlan = potionPlan(beginner, data);
ok(bPlan.todo.some((s) => s.stat === 'def'), 'beginner needs DEF');
ok(bPlan.todo.find((s) => s.stat === 'def')!.bestNow?.id === 'toxic-sewers', 'beginner DEF → Toxic Sewers (guaranteed, ready)');
ok(gearPlan(beginner, data).upgradesNow > 0, 'beginner has gear upgrades available');

// Dungeon details.
const lh = dungeonInfo('lost-halls', data)!;
console.log(`\nLost Halls: pots ${lh.potions.join(',')} · exalt ${lh.exalt?.stats.join(',')} · key items ${lh.keyItems.join(', ')}`);
ok(lh.exalt?.stats.includes('def'), 'Lost Halls → DEF exalt');
ok(lh.keyItems.includes('Helmet Rune'), 'Lost Halls drops the Helmet Rune');
const kog = dungeonInfo('kogbold-steamworks', data)!;
ok(kog.greater.length === 6, 'Kogbold: 6 greater pots (curated flag)');
const sw = dungeonInfo('sprite-world', data)!;
ok(sw.guaranteed.includes('dex'), 'Sprite World guarantees DEX');
ok(dungeonInfo('ice-citadel', data)!.exalt?.stats[0] === 'spd', 'Ice Citadel → SPD exalt');
// A dungeon the scraper hasn't reached yet still gets its curated info (data-independent).
const { ['ice-citadel']: _unscraped, ...dropsWithoutIc } = data.drops;
const icBare = dungeonInfo('ice-citadel', { ...data, drops: dropsWithoutIc })!;
ok(!icBare.hasDropData && icBare.exalt?.stats[0] === 'spd', 'unscraped dungeon → curated info, no drop data');
ok(dungeonInfo('nope', data) === null, 'unknown dungeon → null');

console.log(`\n✓ ${checks} planner checks passed`);
