import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePlayer } from '../src/shared/realmeye';
import {
  evaluateReadiness,
  buildGoals,
  goalDungeonIds,
  recommendSetFor,
  type DungeonGate,
  type ClassMaxTable,
  type DungeonDropTable,
  type StatPriority,
  type PotRouting,
  type BiomeData,
  type ExaltationData,
  type SetTable,
} from '../src/shared/engine';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf-8'));

const dungeons = read('src/shared/data/dungeons.json') as DungeonGate[];
const classMax = read('src/shared/data/class-max-stats.json') as ClassMaxTable;
const dungeonDrops = read('src/shared/data/dungeon-drops.json') as DungeonDropTable;
const statPriority = read('src/shared/data/stat-priority.json') as StatPriority;
const potRouting = read('src/shared/data/pot-routing.json') as unknown as PotRouting;
const biomes = read('src/shared/data/biomes.json') as unknown as BiomeData;
const exaltation = read('src/shared/data/exaltation.json') as unknown as ExaltationData;
const sets = read('src/shared/data/sets.json') as unknown as SetTable;
const ctx = { dungeonDrops, statPriority, potRouting, biomes, exaltation };

const html = readFileSync(join(root, 'fixtures/player-active.html'), 'utf-8');
const characters = parsePlayer(html).characters;

for (const c of characters.slice(0, 4)) {
  const r = evaluateReadiness(c, dungeons, classMax, statPriority);
  console.log(`\n===== ${r.className}  (${r.statsMaxed} maxed, Lv ${c.level}, HP ${c.stats.hp}) =====`);
  console.log(`ready ${r.counts.ready} · risky ${r.counts.risky} · not ${r.counts.notReady}`);
  const verdictById = new Map(r.verdicts.map((v) => [v.id, v.status]));
  const rec = recommendSetFor(c, sets, verdictById);
  if (rec) console.log(`  ★ Set to farm: ${rec.name} [${rec.difficultyCategory ?? 'other'}] — ${rec.bonuses.four?.text ?? ''}`);
  const goals = buildGoals(c, dungeons, classMax, ctx);
  for (const g of goals) {
    console.log(`  [${g.tag}] ${g.title} — ${g.detail}${g.where ? '  📍 ' + g.where : ''}${g.biome ? '  🌿 ' + g.biome : ''}`);
  }
  console.log(`  ⭐ auto-favorite dungeons: ${goalDungeonIds(goals, dungeons).join(', ') || '(none)'}`);
}
