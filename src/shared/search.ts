/**
 * Ctrl+K search: one ranked list across pages, actions, characters, places, dungeons,
 * items ("where does X drop?") and ST sets. Pure, so the ranking is unit-tested.
 */
import type { EnemyDropTable } from './dropTables';

export type SearchKind = 'action' | 'page' | 'character' | 'place' | 'dungeon' | 'item' | 'set';

export interface SearchEntry {
  /** Unique across the list. */
  id: string;
  kind: SearchKind;
  title: string;
  /** Second line ("Septavius the Ghost God · Undead Lair"). */
  sub?: string;
  /** Extra searchable text not shown (aliases, class names…). */
  keywords?: string;
  /** "UT" / "ST" for items. */
  tier?: string;
  /** What to open: a page id, dungeon id, set class, action id… (interpreted by the UI). */
  ref: string;
}

const KIND_WEIGHT: Record<SearchKind, number> = { action: 3, page: 4, character: 4, place: 3, dungeon: 3, item: 2, set: 1 };

/** 0 = no match. Every query word must appear; title-start and word-start hits rank higher. */
export function scoreEntry(e: SearchEntry, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return KIND_WEIGHT[e.kind];
  const title = e.title.toLowerCase();
  const hay = `${title} ${(e.sub ?? '').toLowerCase()} ${(e.keywords ?? '').toLowerCase()}`;
  const words = title.split(/[^a-z0-9']+/);
  let score = KIND_WEIGHT[e.kind];
  for (const t of q.split(/\s+/)) {
    if (!hay.includes(t)) return 0;
    if (words.some((w) => w.startsWith(t))) score += 6;
    else if (title.includes(t)) score += 3;
    else score += 1;
  }
  if (title.startsWith(q)) score += 12;
  if (title === q) score += 20;
  return score;
}

export function searchEntries(entries: SearchEntry[], query: string, limit = 40): SearchEntry[] {
  return entries
    .map((e) => ({ e, s: scoreEntry(e, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.title.length - b.e.title.length || a.e.title.localeCompare(b.e.title))
    .slice(0, limit)
    .map((x) => x.e);
}

/**
 * Items → where they drop, from the scraped drop tables: per-enemy loot first ("Septavius
 * the Ghost God · Undead Lair"), else the dungeon's gear list. Regular stat pots are left
 * out (the Potions page answers those); Greater pots, keys and UT/ST gear are in.
 */
export function itemEntries(
  drops: Record<string, { gear?: { slug: string; name: string; tier: string }[]; enemies?: EnemyDropTable[] }>,
  dungeonName: (id: string) => string,
): SearchEntry[] {
  const items = new Map<string, { name: string; tier?: string; sources: { dungeonId: string; enemy?: string }[] }>();
  const add = (name: string, tier: string | undefined, dungeonId: string, enemy?: string) => {
    const it = items.get(name) ?? { name, tier, sources: [] };
    it.tier ??= tier;
    if (!it.sources.some((s) => s.dungeonId === dungeonId && (s.enemy === enemy || !enemy))) {
      // An enemy-level source replaces a bare dungeon-level one for the same dungeon.
      it.sources = it.sources.filter((s) => !(s.dungeonId === dungeonId && !s.enemy && enemy));
      it.sources.push({ dungeonId, enemy });
    }
    items.set(name, it);
  };
  for (const [dungeonId, d] of Object.entries(drops)) {
    for (const e of d.enemies ?? []) {
      for (const l of e.loot) {
        if (l.kind === 'potion' || l.kind === 'other') continue;
        add(l.name, l.tier, dungeonId, e.sharedBy?.[0] ?? e.name);
      }
    }
    for (const g of d.gear ?? []) add(g.name, g.tier, dungeonId);
  }
  return [...items.values()].map((it) => {
    const where = it.sources.slice(0, 2).map((s) => (s.enemy ? `${s.enemy} · ${dungeonName(s.dungeonId)}` : dungeonName(s.dungeonId)));
    const more = it.sources.length - where.length;
    return {
      id: `item:${it.name}`,
      kind: 'item' as const,
      title: it.name,
      sub: `${where.join('  ·  ')}${more > 0 ? `  +${more} more` : ''}`,
      keywords: it.sources.map((s) => `${s.enemy ?? ''} ${dungeonName(s.dungeonId)}`).join(' '),
      tier: it.tier,
      ref: it.sources[0]!.dungeonId,
    };
  });
}
