import * as cheerio from 'cheerio';
import {
  STAT_KEYS,
  SLOT_NAMES,
  type Stats,
  type StatKey,
  type EquippedItem,
  type Character,
  type PlayerProfile,
} from './types';

/**
 * RealmEye's owner asks scrapers to identify themselves with a descriptive
 * User-Agent (and to rate-limit) rather than spoofing a browser. We honor that.
 */
const USER_AGENT = 'RotMG-Companion/0.1 (community new-player guide; non-commercial)';
const BASE = 'https://www.realmeye.com';

const RARITIES = new Set([
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Legendary',
  'Divine',
  'Mythical',
]);

function toStats(arr: unknown): Stats {
  const a = Array.isArray(arr) ? (arr as number[]) : [];
  const s = {} as Stats;
  STAT_KEYS.forEach((k: StatKey, i) => {
    s[k] = typeof a[i] === 'number' ? a[i]! : 0;
  });
  return s;
}

function parseItem(slug: string, tooltip: string, index: number): EquippedItem {
  const firstLine = (tooltip.split('\n')[0] ?? '').trim();
  const tierMatch = firstLine.match(/\b(UT|ST|T\d+)$/);
  const tier = tierMatch ? tierMatch[1]! : null;

  let name = firstLine.replace(/\b(UT|ST|T\d+)$/, '').trim();
  const firstWord = name.split(' ')[0];
  if (firstWord && RARITIES.has(firstWord)) {
    name = name.slice(firstWord.length).trim();
  }
  if (!name) name = slugToName(slug);

  const slot = index < SLOT_NAMES.length ? SLOT_NAMES[index]! : (`slot${index}` as const);
  return { slot, slug, name, tier, tooltip: tooltip.trim() };
}

function slugToName(slug: string): string {
  const small = new Set(['of', 'the', 'and', 'a', 'to']);
  return slug
    .split('-')
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function intOf(text: string | undefined): number {
  if (!text) return 0;
  // Grab the FIRST integer only — RealmEye cells like "74945 (7745th)" carry a
  // trailing global-rank ordinal we must not merge into the value.
  const m = text.replace(/,/g, '').match(/-?\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

/** Pure parser: turn a RealmEye player-page HTML string into a structured profile. */
export function parsePlayer(html: string, name = ''): PlayerProfile {
  const $ = cheerio.load(html);

  if (!name) name = $('h1 .entity-name').first().text().trim();

  const summary: PlayerProfile['summary'] = {};
  $('table.summary tr').each((_, tr) => {
    const tds = $(tr).children('td');
    const label = tds.eq(0).text().trim().toLowerCase();
    const valueText = tds.eq(1).text().trim();
    switch (label) {
      case 'account fame':
        summary.accountFame = intOf(valueText);
        break;
      case 'fame':
        summary.fame = intOf(valueText);
        break;
      case 'exaltations':
        summary.exaltations = intOf(valueText);
        break;
      case 'rank':
        summary.rank = intOf(valueText);
        break;
      case 'guild':
        summary.guild = valueText || undefined;
        break;
      case 'created':
        summary.created = valueText || undefined;
        break;
      case 'last seen':
        summary.lastSeen = valueText || undefined;
        break;
    }
  });

  const characters: Character[] = [];
  $('a.character').each((_, anchor) => {
    const $row = $(anchor).closest('tr');
    const tds = $row.children('td');
    if (tds.length < 8) return;

    const petId = (() => {
      const v = tds.eq(0).find('span.pet').attr('data-item');
      return v ? intOf(v) : null;
    })();

    const classId = intOf($(anchor).attr('data-class'));
    const skinAttr = $(anchor).attr('data-skin');
    const skin = skinAttr ? intOf(skinAttr) : undefined;
    const className = tds.eq(2).text().trim();
    const level = intOf(tds.eq(3).text());
    const fame = intOf(tds.eq(4).text());

    const equipment: EquippedItem[] = [];
    tds
      .eq(6)
      .find('span.item-wrapper')
      .each((i, wrap) => {
        const href = $(wrap).find('a').attr('href') ?? '';
        const slug = href.replace('/wiki/', '').replace(/\/$/, '');
        const tooltip = $(wrap).find('span.item').attr('title') ?? '';
        if (slug) equipment.push(parseItem(slug, tooltip, i));
      });

    const $stats = tds.eq(7).find('span.player-stats');
    const statsMaxed = $stats.text().trim() || '0/8';
    let stats = toStats([]);
    let baseStats = toStats([]);
    try {
      const raw = $stats.attr('data-stats');
      if (raw) {
        const parsed = JSON.parse(raw) as unknown[];
        const current = parsed[0];
        const bonus = parsed[1];
        stats = toStats(current);
        const b = toStats(bonus);
        baseStats = {} as Stats;
        STAT_KEYS.forEach((k) => (baseStats[k] = stats[k] - b[k]));
      }
    } catch {
      /* fall back to zeroed stats */
    }
    const maxedCount = intOf(statsMaxed.split('/')[0]);

    characters.push({
      classId,
      skin,
      className,
      level,
      fame,
      stats,
      baseStats,
      maxedCount,
      statsMaxed,
      equipment,
      petId,
    });
  });

  // RealmEye's wording for hidden characters varies ("…set their characters to private",
  // "Characters are hidden"); only consulted when no character rows were found.
  const isPrivate =
    characters.length === 0 &&
    (/set (their|his|her) (profile|characters) to private/i.test(html) ||
      /characters?[^<]{0,40}\b(are|is) (hidden|private)\b/i.test(html) ||
      /\b(hidden|private) characters?\b/i.test(html));

  return { name, isPrivate, characters, summary };
}

let lastFetch = 0;
const cache = new Map<string, { profile: PlayerProfile; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_GAP_MS = 1000;
/** A stalled request must never hang the app (or live sync, which waits on it). */
const FETCH_TIMEOUT_MS = 20_000;

async function politeDelay(): Promise<void> {
  const wait = lastFetch + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetch = Date.now();
}

/**
 * Fill in item tiers the player page left blank (RealmEye's item tooltips can be empty) from
 * the game data's known UT/STs. The planner relies on these to tell a UT from plain gear.
 */
export function withKnownTiers(profile: PlayerProfile, tiers: ReadonlyMap<string, string>): PlayerProfile {
  return {
    ...profile,
    characters: profile.characters.map((c) => ({
      ...c,
      equipment: c.equipment.map((e) => (e.tier || !tiers.has(e.slug) ? e : { ...e, tier: tiers.get(e.slug)! })),
    })),
  };
}

/**
 * Fetch and parse a player's RealmEye profile.
 * Returns null if the player does not exist (404). `force` skips the 5-minute cache.
 */
export async function fetchPlayer(name: string, force = false): Promise<PlayerProfile | null> {
  const key = name.trim().toLowerCase();
  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.profile;

  await politeDelay();
  const url = `${BASE}/player/${encodeURIComponent(name.trim())}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new Error(timedOut ? `RealmEye didn't respond within ${FETCH_TIMEOUT_MS / 1000}s — will retry.` : `Couldn't reach RealmEye (${err instanceof Error ? err.message : String(err)}).`);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`RealmEye returned ${res.status} for ${name}`);

  const html = await res.text();
  const profile = parsePlayer(html, name.trim());
  cache.set(key, { profile, ts: Date.now() });
  return profile;
}
