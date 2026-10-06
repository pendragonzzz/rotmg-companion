/**
 * Per-enemy drop tables. RealmEye's "Drops of Interest" lists each item with the
 * enemies that drop it; we invert that into enemy → loot, keep only enemies with
 * rare loot (UT/ST, potions, Greater potions, key items), and fold colour variants
 * ("Blue/Red/Yellow Soldier Bee") with identical loot into one row.
 */
import type { StatKey } from './types';
import type { DungeonDrop } from './realmeye-wiki';

export type LootKind = 'gear' | 'greater' | 'potion' | 'key' | 'other';

export interface LootItem {
  slug: string;
  name: string;
  kind: LootKind;
  /** "UT" / "ST" / "T12"… when known. */
  tier?: string;
  /** For potions. */
  stat?: StatKey;
}

export interface EnemyDropTable {
  /** Display name ("Soldier Bee" for a folded colour group). */
  name: string;
  /** The original names when colour variants were folded together. */
  variants?: string[];
  /** Different enemies with exactly this loot (O3's Minister / Judge / Ambassador), `name` first. */
  sharedBy?: string[];
  loot: LootItem[];
}

/** Cosmetics and filler — not loot anyone farms for. */
export const JUNK_RE = /^Mark of\b|Skin\b|Skin Unlocker|\bEggs?$|Cloths$|Tarot|Card Pack|Dye$|Emote/i;
/** Progression / crafting items worth calling out. */
export const KEY_RE = /\bRune$|Incantation|^Vial of|\bKey$|Shard$|Essence$|Blueprint/i;

const POTION_RE = /^(Greater )?Potion of (Life|Mana|Attack|Defense|Speed|Dexterity|Vitality|Wisdom)$/;
const POTION_STAT: Record<string, StatKey> = {
  Life: 'hp', Mana: 'mp', Attack: 'att', Defense: 'def', Speed: 'spd', Dexterity: 'dex', Vitality: 'vit', Wisdom: 'wis',
};
// A colour word anywhere in an enemy name ("Blue Soldier Bee", "Adolescent Blue Beehemoth").
const COLOR_RE = /\b(Blue|Red|Yellow|Green|Purple|White|Black|Orange|Pink|Gold|Golden|Silver|Brown|Gray|Grey)\s+/;

const KIND_RANK: Record<LootKind, number> = { gear: 0, greater: 1, potion: 2, key: 3, other: 4 };
const tierRank = (t?: string) => (t === 'UT' ? 0 : t === 'ST' ? 1 : 2);

/** Classify one drop; null = junk (skip). `tierOf` resolves an item slug's tier when known. */
export function classifyLoot(drop: Pick<DungeonDrop, 'slug' | 'name'>, tierOf: (slug: string) => string | null): LootItem | null {
  const pot = drop.name.match(POTION_RE);
  if (pot) return { slug: drop.slug, name: drop.name, kind: pot[1] ? 'greater' : 'potion', stat: POTION_STAT[pot[2]!] };
  if (JUNK_RE.test(drop.name)) return null;
  if (KEY_RE.test(drop.name)) return { slug: drop.slug, name: drop.name, kind: 'key' };
  const tier = tierOf(drop.slug) ?? undefined;
  if (tier === 'UT' || tier === 'ST') return { slug: drop.slug, name: drop.name, kind: 'gear', tier };
  return { slug: drop.slug, name: drop.name, kind: 'other', ...(tier ? { tier } : {}) };
}

export const isRare = (l: LootItem) => l.kind !== 'other';

/** Invert a dungeon's drops into per-enemy tables (rare-loot enemies only, richest first). */
export function buildEnemyTables(drops: DungeonDrop[], tierOf: (slug: string) => string | null): EnemyDropTable[] {
  const order: string[] = [];
  const byEnemy = new Map<string, Map<string, LootItem>>();
  for (const d of drops) {
    const item = classifyLoot(d, tierOf);
    if (!item) continue;
    for (const enemy of d.dropsFrom) {
      if (!byEnemy.has(enemy)) {
        byEnemy.set(enemy, new Map());
        order.push(enemy);
      }
      byEnemy.get(enemy)!.set(`${item.slug}|${item.name}`, item);
    }
  }

  const sortLoot = (loot: LootItem[]) =>
    loot.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name));
  // A colour variant's own-colour items ("Blue Soldier Bee" → "Blue Beehemoth Armor") compare colour-free.
  const strip = (name: string, color: string | null) => (color && name.startsWith(`${color} `) ? name.slice(color.length + 1) : name);
  const sig = (loot: LootItem[], color: string | null) => loot.map((l) => strip(l.name, color)).sort().join(';');

  // Fold colour variants that share a base name AND (colour-free) identical loot.
  const groups = new Map<string, { names: string[]; colors: string[]; loot: LootItem[] }>();
  for (const enemy of order) {
    const loot = sortLoot([...byEnemy.get(enemy)!.values()]);
    if (!loot.some(isRare)) continue;
    const color = enemy.match(COLOR_RE)?.[1] ?? null;
    const base = enemy.replace(COLOR_RE, '');
    const key = `${base}#${sig(loot, color)}`;
    const g = groups.get(key);
    if (g) {
      g.names.push(enemy);
      if (color) g.colors.push(color);
    } else groups.set(key, { names: [enemy], colors: color ? [color] : [], loot });
  }

  const tables: (EnemyDropTable & { first: number })[] = [...groups.values()].map((g) => {
    if (g.names.length === 1) return { name: g.names[0]!, loot: g.loot, first: order.indexOf(g.names[0]!) };
    // Folded: "Blue Beehemoth Armor" → "Blue/Red/Yellow Beehemoth Armor".
    const c0 = g.colors[0] ?? null;
    const loot = g.loot.map((l) => {
      const bare = strip(l.name, c0);
      return bare === l.name ? l : { ...l, name: `${g.colors.join('/')} ${bare}` };
    });
    return { name: g.names[0]!.replace(COLOR_RE, ''), variants: g.names, loot: sortLoot(loot), first: order.indexOf(g.names[0]!) };
  });
  // Different enemies with exactly the same loot share one card.
  const merged = new Map<string, EnemyDropTable & { first: number }>();
  for (const t of tables) {
    const key = t.loot.map((l) => `${l.kind}:${l.name}`).sort().join(';');
    const m = merged.get(key);
    if (!m) merged.set(key, t);
    else {
      m.sharedBy = [...(m.sharedBy ?? [m.name]), t.name];
      m.first = Math.min(m.first, t.first);
    }
  }

  const score = (t: EnemyDropTable) =>
    t.loot.reduce((n, l) => n + (l.kind === 'gear' ? 3 : l.kind === 'greater' ? 2 : isRare(l) ? 1 : 0), 0);
  return [...merged.values()]
    .sort((a, b) => score(b) - score(a) || a.first - b.first)
    .map(({ first: _first, ...t }) => t);
}

/**
 * slug → "UT" / "ST" for every item the game data knows: ST set pieces, dungeon gear and
 * per-enemy loot. RealmEye's player pages stopped tagging equipped items with their tier,
 * so the app fills it back in from here (see `withKnownTiers`).
 */
export function knownItemTiers(
  drops: Record<string, { gear?: { slug: string; tier: string }[]; enemies?: EnemyDropTable[] }>,
  sets: { members: { slug: string }[] }[],
): Map<string, string> {
  const tiers = new Map<string, string>();
  const add = (slug: string, tier: string | undefined) => {
    if ((tier === 'UT' || tier === 'ST') && !tiers.has(slug)) tiers.set(slug, tier);
  };
  for (const s of sets) for (const m of s.members) add(m.slug, 'ST');
  for (const d of Object.values(drops)) {
    for (const g of d.gear ?? []) add(g.slug, g.tier);
    for (const e of d.enemies ?? []) for (const l of e.loot) add(l.slug, l.tier);
  }
  return tiers;
}
