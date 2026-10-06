/**
 * refresh-data.ts — the automated, TOKEN-FREE data updater.
 *
 * Run: `npm run refresh`  (optionally `-- --force` to ignore the disk cache).
 * Uses NO AI/Claude tokens — it is plain Node: fetch RealmEye HTML + parse it.
 * Schedule it weekly (Windows Task Scheduler) to keep up with balance patches.
 *
 * Sources, all from RealmEye:
 *   - Player pages  → item universe (slug → slot, classes, tier) + class max stats
 *   - Dungeon wiki  → drops of interest (gear + potions) per dungeon
 *
 * Outputs (committed, read by the app):
 *   - src/shared/data/class-max-stats.json
 *   - src/shared/data/dungeon-drops.json   { [dungeonId]: { potions, gear[], other[] } }
 *
 * Disk cache in scripts/.cache keeps weekly re-runs cheap (only refetch stale).
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePlayer } from '../src/shared/realmeye';
import {
  parseDungeonDrops,
  parseItemPage,
  parseSetIndex,
  parseSetPage,
  parseClassIcons,
  type DungeonDrop,
  type ItemInfo,
} from '../src/shared/realmeye-wiki';
import { STAT_KEYS, SLOT_NAMES, type Stats, type StatKey } from '../src/shared/types';
import { JUNK_RE, KEY_RE, buildEnemyTables, type EnemyDropTable } from '../src/shared/dropTables';
import { DATA_FILES, validateBundle, type DataFile } from '../src/shared/gameDataBundle';
import { bumpManifest } from './bump-data';

const STAT_WEIGHT: Record<StatKey, number> = {
  def: 2, att: 2, dex: 1.5, vit: 1, spd: 1, wis: 1, hp: 0.25, mp: 0.2,
};
const STAT_ABBR: Record<StatKey, string> = {
  hp: 'HP', mp: 'MP', att: 'ATT', def: 'DEF', spd: 'SPD', dex: 'DEX', vit: 'VIT', wis: 'WIS',
};

// Effect keywords that make an ability valuable even with no stat bonuses.
// (Abilities are mostly about their effect, not raw stats.)
const EFFECT_POINTS: [RegExp, number][] = [
  [/invulnerab|invincib/, 35],
  [/exposed|armor ?break|armored\b/, 22], // lowers enemy DEF — huge DPS
  [/berserk/, 18],
  [/damaging/, 16],
  [/with full set|set ?bonus|set:/, 16],
  [/inspire/, 14],
  [/paralyz/, 13],
  [/curse/, 12],
  [/heal/, 12],
  [/decoy|stasis/, 10],
  [/slowed|\bslow\b/, 9],
  [/speedy/, 8],
  [/daze|confus|silence|sick\b/, 8],
  [/penetrat|pierce|pass through|ignore.*defense/, 8],
  [/bleeding|wound/, 8],
];

function effectScore(effect: string | null): number {
  if (!effect) return 0;
  const e = effect.toLowerCase();
  let s = 0;
  for (const [re, pts] of EFFECT_POINTS) if (re.test(e)) s += pts;
  return s;
}

/** A comparable power score + readable stat summary, used to rank gear in a slot. */
function scoreItem(slot: string, info: ItemInfo): { score: number; summary: string } {
  if (slot === 'weapon' && info.damage) {
    const summary = `${info.damage.min}–${info.damage.max} dmg${info.shots && info.shots > 1 ? ` ×${info.shots}` : ''}`;
    return { score: info.powerLevel ?? info.damage.total, summary };
  }
  const parts: string[] = [];
  let score = 0;
  for (const k of STAT_KEYS) {
    const v = info.statBonuses[k];
    if (v) { score += v * STAT_WEIGHT[k]; parts.push(`${v > 0 ? '+' : ''}${v} ${STAT_ABBR[k]}`); }
  }
  // Abilities are effect-driven — credit the effect so they don't rank at zero.
  if (slot === 'ability') score += effectScore(info.effect);
  return { score: Math.round(score), summary: parts.join(', ') || (info.soulbound ? 'effect item' : '') };
}

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dataDir = join(root, 'src', 'shared', 'data');
const cacheDir = join(here, '.cache');
const force = process.argv.includes('--force');

const UA = 'RotMG-Companion/0.1 (community new-player guide; non-commercial)';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const NET_GAP_MS = 1200;

// Sampled to build the item universe (slot/class/tier) + class maxes.
const PLAYERS = [
  'SamRiddelI', 'pax', 'WigDr', 'PopePiusX', 'Horlandius', 'Jadragonson',
  'Murder', 'Spoder', 'Uberer', 'mrow', 'Barrenb', 'fluffy', 'Haebin',
  'ArasakaTower', 'NPC', 'Oli', 'Michael', 'hm', 'su', 'Toastrz',
];

// Our dungeon id → RealmEye wiki slug, only where they differ from the id.
const WIKI_SLUG: Record<string, string> = {
  'davy-jones-locker': 'davy-jones-s-locker',
  'oryx-sanctuary': 'oryx-s-sanctuary',
  'puppet-masters-theatre': 'puppet-master-s-theatre',
  'puppet-masters-encore': 'puppet-master-s-encore',
  'crawling-depths': 'the-crawling-depths',
};

const POTION_RE = /^(Greater )?Potion of (Life|Mana|Attack|Defense|Speed|Dexterity|Vitality|Wisdom)$/;
const POTION_STAT: Record<string, StatKey> = {
  Life: 'hp', Mana: 'mp', Attack: 'att', Defense: 'def',
  Speed: 'spd', Dexterity: 'dex', Vitality: 'vit', Wisdom: 'wis',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastNet = 0;

async function fetchCached(url: string, key: string): Promise<string | null> {
  const file = join(cacheDir, `${key}.html`);
  if (!force && existsSync(file) && Date.now() - statSync(file).mtimeMs < CACHE_TTL_MS) {
    return readFileSync(file, 'utf-8');
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = lastNet + NET_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastNet = Date.now();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
      if (res.status === 404) return null;
      const html = await res.text();
      if (res.ok && html.length > 500) {
        mkdirSync(cacheDir, { recursive: true });
        writeFileSync(file, html, 'utf-8');
        return html;
      }
    } catch {
      /* retry */
    }
    await sleep(1500 * (attempt + 1));
  }
  return existsSync(file) ? readFileSync(file, 'utf-8') : null;
}

// ---- item universe + class maxes (from players) ----
interface UniItem {
  name: string;
  slotCounts: Record<string, number>;
  classes: Set<string>;
  tier: string | null;
}
const universe = new Map<string, UniItem>();
const tooltipSample: string[] = [];
const classMax: Record<string, Stats> = {};

function bestSlot(u: UniItem): string {
  return Object.entries(u.slotCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
}

console.log(`Sampling ${PLAYERS.length} players for item universe + class maxes...`);
for (const name of PLAYERS) {
  const html = await fetchCached(`https://www.realmeye.com/player/${encodeURIComponent(name)}`, `player-${name}`);
  if (!html) { console.log(`  ! ${name} unavailable`); continue; }
  const profile = parsePlayer(html, name);
  for (const c of profile.characters) {
    if (c.maxedCount === 8) {
      const key = c.className.toLowerCase();
      if (!classMax[key]) classMax[key] = { ...c.baseStats };
      else for (const s of STAT_KEYS) classMax[key]![s] = Math.max(classMax[key]![s], c.baseStats[s]);
    }
    for (const it of c.equipment) {
      if (it.slot === 'backpack') continue;
      if (tooltipSample.length < 3) tooltipSample.push(`${it.slug}: ${JSON.stringify(it.tooltip.slice(0, 120))}`);
      let u = universe.get(it.slug);
      if (!u) { u = { name: it.name, slotCounts: {}, classes: new Set(), tier: it.tier }; universe.set(it.slug, u); }
      u.slotCounts[it.slot] = (u.slotCounts[it.slot] ?? 0) + 1;
      u.classes.add(c.className);
      if (it.tier && (it.tier === 'UT' || it.tier === 'ST')) u.tier = it.tier;
    }
  }
}
const tieredInUniverse = [...universe.values()].filter((u) => u.tier === 'UT' || u.tier === 'ST').length;
console.log(`  ${Object.keys(classMax).length} classes, ${universe.size} unique items in universe (${tieredInUniverse} tagged UT/ST)`);
if (universe.size && !tieredInUniverse) {
  // RealmEye's item tooltips changed shape — tiers will come from the item wiki pages instead.
  console.log(`  ! no UT/ST tags in player tooltips; falling back to item pages. Sample: ${tooltipSample.join(' | ')}`);
}

// Slot + classes for gear the sampled players don't happen to wear: last run's drops + the ST sets.
const knownPlacement = new Map<string, { slot: string; classes: string[] }>();
try {
  const prevDrops = JSON.parse(readFileSync(join(dataDir, 'dungeon-drops.json'), 'utf-8')) as Record<
    string,
    { gear?: { slug: string; slot: string; classes: string[] }[] }
  >;
  for (const d of Object.values(prevDrops)) for (const g of d.gear ?? []) knownPlacement.set(g.slug, { slot: g.slot, classes: g.classes });
  const prevSets = JSON.parse(readFileSync(join(dataDir, 'sets.json'), 'utf-8')) as {
    className: string;
    members: { slug: string; slot: string }[];
  }[];
  for (const s of prevSets)
    for (const m of s.members) if (!knownPlacement.has(m.slug)) knownPlacement.set(m.slug, { slot: m.slot, classes: [s.className] });
} catch {
  /* first run — the player universe is all we have */
}

function placementOf(slug: string): { slot: string; classes: string[] } | null {
  const u = universe.get(slug);
  if (u) return { slot: bestSlot(u), classes: [...u.classes].sort() };
  return knownPlacement.get(slug) ?? null;
}

// ---- dungeon drops (from wiki) ----
interface GearDrop {
  slug: string; name: string; tier: string; slot: string; classes: string[];
  score?: number; summary?: string; powerLevel?: number; description?: string;
}
interface DungeonDropData {
  potions: StatKey[];
  greaterPotions: StatKey[];
  gear: GearDrop[];
  other: { slug: string; name: string }[];
  /** Per-enemy rare-loot tables (boss / minibosses / notable enemies). */
  enemies: EnemyDropTable[];
}

// Item facts for drop tables: tier + kind ("Swords", "Helms") from each item's (cached) wiki
// page. The player sample only covers what those players wear, and RealmEye's player tooltips
// no longer carry the tier, so the item page is the source of truth.
const itemTier = new Map<string, string | null>();
const itemKind = new Map<string, string | null>();
async function resolveItem(slug: string, name: string): Promise<string | null> {
  if (itemTier.has(slug)) return itemTier.get(slug)!;
  const u = universe.get(slug);
  let tier: string | null = u?.tier === 'UT' || u?.tier === 'ST' ? u.tier : null;
  let kind: string | null = null;
  if (!POTION_RE.test(name) && !JUNK_RE.test(name) && !KEY_RE.test(name)) {
    const html = await fetchCached(`https://www.realmeye.com/wiki/${slug}`, `item-${slug}`);
    if (html) {
      const info = parseItemPage(html, slug);
      tier ??= info.tierType === 'UT' || info.tierType === 'ST' ? info.tierType : info.tier;
      kind = info.itemType;
    }
  }
  itemTier.set(slug, tier);
  itemKind.set(slug, kind);
  return tier;
}

const dungeons = JSON.parse(readFileSync(join(dataDir, 'dungeons.json'), 'utf-8')) as {
  id: string;
  name: string;
  tier: number;
  category: string;
}[];
const dungeonDrops: Record<string, DungeonDropData> = {};
const failed: string[] = [];
const rawDrops = new Map<string, DungeonDrop[]>();

console.log(`\nReading ${dungeons.length} dungeon wiki pages...`);
for (const d of dungeons) {
  const slug = WIKI_SLUG[d.id] ?? d.id;
  const html = await fetchCached(`https://www.realmeye.com/wiki/${slug}`, `dungeon-${d.id}`);
  if (!html) { failed.push(`${d.id} (${slug})`); continue; }
  const drops = parseDungeonDrops(html);
  for (const drop of drops) await resolveItem(drop.slug, drop.name);
  rawDrops.set(d.id, drops);
}

// Learn each item kind's slot + classes from the gear we can already place (player sample, last
// run, ST rosters). Every item of a kind fits the same classes, so a UT nobody in the sample
// wears (Bramble Bow, Spirit Staff…) still lands in the right slot, and a sword is offered to
// every sword class — not just the ones a sampled player happened to be.
const kindPlacement = new Map<string, { slots: Record<string, number>; classes: Set<string> }>();
for (const [slug, kind] of itemKind) {
  const own = kind ? placementOf(slug) : null;
  if (!kind || !own) continue;
  const k = kindPlacement.get(kind) ?? { slots: {}, classes: new Set<string>() };
  k.slots[own.slot] = (k.slots[own.slot] ?? 0) + 1;
  for (const c of own.classes) k.classes.add(c);
  kindPlacement.set(kind, k);
}
console.log(`  learned ${kindPlacement.size} item kinds: ${[...kindPlacement.keys()].sort().join(', ')}`);

function placeGear(slug: string): { slot: string; classes: string[] } | null {
  const own = placementOf(slug);
  const kind = itemKind.get(slug);
  const k = kind ? kindPlacement.get(kind) : undefined;
  if (!own && !k) return null;
  const slot = own?.slot ?? Object.entries(k!.slots).sort((a, b) => b[1] - a[1])[0]![0];
  return { slot, classes: [...new Set([...(own?.classes ?? []), ...(k?.classes ?? [])])].sort() };
}

const unplaced = new Set<string>();
for (const d of dungeons) {
  const drops = rawDrops.get(d.id);
  if (!drops) continue;
  const potions = new Set<StatKey>();
  const greaterPotions = new Set<StatKey>();
  const gear: GearDrop[] = [];
  const other: { slug: string; name: string }[] = [];

  for (const drop of drops) {
    const potMatch = drop.name.match(POTION_RE);
    if (potMatch) {
      const stat = POTION_STAT[potMatch[2]!]!;
      (potMatch[1] ? greaterPotions : potions).add(stat);
      continue;
    }
    const tier = itemTier.get(drop.slug) ?? null;
    const place = tier === 'UT' || tier === 'ST' ? placeGear(drop.slug) : null;
    if (place) {
      gear.push({ slug: drop.slug, name: drop.name, tier: tier!, slot: place.slot, classes: place.classes });
    } else {
      if (tier === 'UT' || tier === 'ST') unplaced.add(drop.name);
      other.push({ slug: drop.slug, name: drop.name });
    }
  }
  const enemies = buildEnemyTables(drops, (slug) => itemTier.get(slug) ?? null);
  dungeonDrops[d.id] = { potions: [...potions], greaterPotions: [...greaterPotions], gear, other, enemies };
  console.log(`  ${d.id}: ${gear.length} gear, ${potions.size}+${greaterPotions.size} pot types, ${enemies.length} enemy drop tables`);
}

if (unplaced.size) {
  console.log(`  (${unplaced.size} UT/ST drops of an unknown kind — shown in enemy tables only: ${[...unplaced].slice(0, 8).join(', ')}${unplaced.size > 8 ? '…' : ''})`);
}

// ---- enrich gear with stats/score from item pages (cached, so weekly re-runs are cheap) ----
const gearBySlug = new Map<string, GearDrop[]>();
for (const data of Object.values(dungeonDrops)) {
  for (const g of data.gear) {
    const list = gearBySlug.get(g.slug) ?? [];
    list.push(g);
    gearBySlug.set(g.slug, list);
  }
}
console.log(`\nScoring ${gearBySlug.size} unique gear items from item pages...`);
for (const [slug, entries] of gearBySlug) {
  const html = await fetchCached(`https://www.realmeye.com/wiki/${slug}`, `item-${slug}`);
  if (!html) continue;
  const info = parseItemPage(html, slug);
  const { score, summary } = scoreItem(entries[0]!.slot, info);
  const description = info.effect ? info.effect.slice(0, 260) : undefined;
  for (const e of entries) {
    e.score = score;
    if (summary) e.summary = summary;
    if (info.powerLevel != null) e.powerLevel = info.powerLevel;
    if (description) e.description = description;
  }
}
// Rank gear within each dungeon (best first).
for (const data of Object.values(dungeonDrops)) {
  data.gear.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

// ---- ST sets (set-tier-items index → each set page → member item pages) ----
const SET_SLOTS = ['weapon', 'ability', 'armor', 'ring'] as const;
const STAT_FROM_ABBR: Record<string, StatKey> = {
  HP: 'hp', MP: 'mp', ATT: 'att', DEF: 'def', SPD: 'spd', DEX: 'dex', VIT: 'vit', WIS: 'wis',
};
function parseStatLine(text: string | null): Partial<Record<StatKey, number>> {
  const out: Partial<Record<StatKey, number>> = {};
  if (!text) return out;
  for (const m of text.matchAll(/([+-]?\d+)\s*([A-Za-z]+)/g)) {
    const k = STAT_FROM_ABBR[m[2]!.toUpperCase()];
    if (k) out[k] = (out[k] ?? 0) + parseInt(m[1]!, 10);
  }
  return out;
}

// Reverse index: item slug → the tracked dungeon(s) that drop it (for "where to farm" + difficulty).
const slugToDungeons = new Map<string, string[]>();
const addSrc = (slug: string, dId: string) => {
  const arr = slugToDungeons.get(slug);
  if (arr) { if (!arr.includes(dId)) arr.push(dId); } else slugToDungeons.set(slug, [dId]);
};
for (const [dId, data] of Object.entries(dungeonDrops)) {
  for (const g of data.gear) addSrc(g.slug, dId);
  for (const o of data.other) addSrc(o.slug, dId);
}
const dungeonMeta = new Map(dungeons.map((d) => [d.id, d]));

interface SetBonusOut { text: string; stats: Partial<Record<StatKey, number>> }
interface SetMemberOut {
  slug: string; name: string; slot: string;
  score?: number; summary?: string; stats: Partial<Record<StatKey, number>>;
  description?: string; dungeonId: string | null;
}
interface STSetOut {
  slug: string; name: string; className: string; generation: string;
  sourceDungeonIds: string[]; difficultyTier: number | null; difficultyCategory: string | null;
  /** Boss / chest names the set drops from (fallback "where" for untracked sets). */
  sources: string[];
  bonuses: { two: SetBonusOut | null; three: SetBonusOut | null; four: SetBonusOut | null };
  members: SetMemberOut[];
}

const setIndexHtml = await fetchCached('https://www.realmeye.com/wiki/set-tier-items', 'set-index');
const setEntries = setIndexHtml ? parseSetIndex(setIndexHtml) : [];
console.log(`\nReading ${setEntries.length} ST set pages (+ member item pages)...`);
const sets: STSetOut[] = [];
for (const entry of setEntries) {
  const html = await fetchCached(`https://www.realmeye.com/wiki/${entry.slug}`, `set-${entry.slug}`);
  if (!html) { console.log(`  ! ${entry.slug} unavailable`); continue; }
  const page = parseSetPage(html, entry.slug);

  const members: SetMemberOut[] = [];
  for (let i = 0; i < page.members.length && i < SET_SLOTS.length; i++) {
    const m = page.members[i]!;
    const slot = SET_SLOTS[i]!;
    const ih = await fetchCached(`https://www.realmeye.com/wiki/${m.slug}`, `item-${m.slug}`);
    const out: SetMemberOut = { slug: m.slug, name: m.name, slot, stats: {}, dungeonId: slugToDungeons.get(m.slug)?.[0] ?? null };
    if (ih) {
      const info = parseItemPage(ih, m.slug);
      const { score, summary } = scoreItem(slot, info);
      out.score = score;
      if (summary) out.summary = summary;
      out.stats = info.statBonuses;
      if (info.effect) out.description = info.effect.slice(0, 260);
    }
    members.push(out);
  }

  const sourceDungeonIds = [...new Set(members.flatMap((m) => (m.dungeonId ? [m.dungeonId] : [])))];
  let difficultyTier: number | null = null;
  let difficultyCategory: string | null = null;
  for (const id of sourceDungeonIds) {
    const meta = dungeonMeta.get(id);
    if (meta && (difficultyTier === null || meta.tier > difficultyTier)) {
      difficultyTier = meta.tier;
      difficultyCategory = meta.category;
    }
  }
  const bonus = (t: string | null): SetBonusOut | null => (t ? { text: t, stats: parseStatLine(t) } : null);
  sets.push({
    slug: entry.slug,
    name: page.name || entry.name,
    className: entry.className || page.className || 'Unknown',
    generation: entry.generation || page.generation || '',
    sourceDungeonIds, difficultyTier, difficultyCategory,
    sources: [...new Set(page.sources)],
    bonuses: { two: bonus(page.bonuses.two), three: bonus(page.bonuses.three), four: bonus(page.bonuses.four) },
    members,
  });
  console.log(`  ${entry.slug}: ${members.length} pieces, src=${sourceDungeonIds.join(',') || '—'}`);
}
sets.sort(
  (a, b) =>
    a.className.localeCompare(b.className) ||
    (a.difficultyTier ?? 0) - (b.difficultyTier ?? 0) ||
    a.name.localeCompare(b.name),
);

// ---- class icons (bundled game sprites for the UI; downloaded once, rarely change) ----
if (setIndexHtml) {
  const classIcons = parseClassIcons(setIndexHtml);
  const iconsDir = join(root, 'src', 'renderer', 'src', 'assets', 'classes');
  mkdirSync(iconsDir, { recursive: true });
  let got = 0;
  for (const ci of classIcons) {
    const file = join(iconsDir, `${ci.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`);
    if (existsSync(file)) { got++; continue; }
    const url = ci.url.startsWith('http') ? ci.url : `https://www.realmeye.com${ci.url}`;
    const wait = lastNet + NET_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastNet = Date.now();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
      if (res.ok) { writeFileSync(file, Buffer.from(await res.arrayBuffer())); got++; }
    } catch { /* skip a missing icon */ }
  }
  console.log(`Class icons: ${got}/${classIcons.length} in assets/classes`);
}

// ---- write outputs (only if the scrape looks healthy — installed apps pull this data) ----
mkdirSync(dataDir, { recursive: true });
const sortedClasses = Object.fromEntries(Object.entries(classMax).sort(([a], [b]) => a.localeCompare(b)));
const outputs: Partial<Record<DataFile, string>> = {
  'class-max-stats.json': JSON.stringify(sortedClasses, null, 2) + '\n',
  'dungeon-drops.json': JSON.stringify(dungeonDrops, null, 2) + '\n',
  'sets.json': JSON.stringify(sets, null, 2) + '\n',
};
const readData = (f: DataFile) => (existsSync(join(dataDir, f)) ? readFileSync(join(dataDir, f), 'utf-8') : '');
const candidate = Object.fromEntries(DATA_FILES.map((f) => [f, JSON.parse(outputs[f] ?? (readData(f) || 'null'))]));
const problem = validateBundle(candidate);
if (problem) {
  console.error(`\n✗ Scrape looks broken — NOT writing data (${problem}). RealmEye blocked or changed?`);
  process.exit(1);
}
const changed = (Object.keys(outputs) as DataFile[]).filter((f) => readData(f) !== outputs[f]);
for (const f of changed) writeFileSync(join(dataDir, f), outputs[f]!);
if (changed.length) bumpManifest(`RealmEye refresh: ${changed.join(', ')}`);
else console.log('\nData unchanged — manifest revision kept.');

console.log(`\nWrote class-max-stats.json (${Object.keys(sortedClasses).length} classes)`);
console.log(`Wrote dungeon-drops.json (${Object.keys(dungeonDrops).length} dungeons)`);
console.log(`Wrote sets.json (${sets.length} sets)`);
if (failed.length) console.log(`\n⚠ dungeon pages not found (fix WIKI_SLUG): ${failed.join(', ')}`);
const cached = existsSync(cacheDir) ? readdirSync(cacheDir).length : 0;
console.log(`Cache: ${cached} pages in scripts/.cache (re-runs reuse these for ${CACHE_TTL_MS / 86400000} days)`);
