import * as cheerio from 'cheerio';
import { STAT_KEYS, type StatKey } from './types';

const ONEQUIP_LABEL: Record<string, StatKey> = {
  HP: 'hp', LIFE: 'hp', MP: 'mp', MANA: 'mp',
  ATT: 'att', ATTACK: 'att', DEF: 'def', DEFENSE: 'def',
  SPD: 'spd', SPEED: 'spd', DEX: 'dex', DEXTERITY: 'dex',
  VIT: 'vit', VITALITY: 'vit', WIS: 'wis', WISDOM: 'wis',
};

/** An item as listed in a dungeon's "Drops of Interest" table. */
export interface DungeonDrop {
  slug: string;
  name: string;
  dropsFrom: string[];
}

/** Parse a RealmEye dungeon wiki page (/wiki/<dungeon>) → its notable item drops. */
export function parseDungeonDrops(html: string): DungeonDrop[] {
  const $ = cheerio.load(html);
  // The "Drops of Interest" heading id/level varies by page: #interest (h2) on
  // some, #drops (h3) on others. Grab every drop table until the next heading.
  const anchor = $('#interest, #drops').first();
  if (!anchor.length) return [];
  const region = anchor.nextUntil('h1, h2, h3');
  const tables = region.find('table').add(region.filter('table'));

  const drops: DungeonDrop[] = [];
  const seen = new Set<string>();

  tables.find('tr').each((_, tr) => {
    const tds = $(tr).children('td');
    if (tds.length < 1) return;

    // The "drops from" enemies are shared by every item in this row.
    const dropsFrom: string[] = [];
    tds
      .eq(1)
      .find('a')
      .each((_, a) => {
        const t = $(a).text().trim();
        if (t) dropsFrom.push(t);
      });

    // An item cell can hold MULTIPLE item anchors (e.g. Dex + Def pots together).
    // Emit one drop per anchor — skip category links like /wiki/marks#... .
    tds
      .eq(0)
      .find('a')
      .each((_, a) => {
        const $a = $(a);
        const img = $a.find('img');
        const href = $a.attr('href') ?? '';
        if (!img.length || !href.startsWith('/wiki/') || href.includes('#')) return;
        const slug = href.replace('/wiki/', '');
        const name = img.attr('title') ?? $a.text().trim();
        // Dedupe by slug+name (the "stat-increase-potions" slug fronts several pots).
        const key = `${slug}|${name}`;
        if (!slug || seen.has(key)) return;
        seen.add(key);
        drops.push({ slug, name, dropsFrom });
      });
  });

  return drops;
}

export type TierType = 'UT' | 'ST' | 'T';

/** Key facts parsed from a RealmEye item wiki page (/wiki/<item>). */
export interface ItemInfo {
  slug: string;
  name: string;
  /** Raw tier label, e.g. "UT", "ST", "T13". */
  tier: string | null;
  tierType: TierType | null;
  /** Source dungeon name from the Tier cell image, e.g. "The Nest". null for ST/plain tiered items. */
  dungeon: string | null;
  /** ST generation (e.g. "1st Generation") — the Tier-cell image for ST items shows this, not a dungeon. */
  generation: string | null;
  /** The ST set this item belongs to, if any (parsed from the page content, not the nav sidebar). */
  set: { slug: string; name: string } | null;
  dropsFrom: string[];
  soulbound: boolean;
  /** RealmEye's weapon Power Level (damage metric); null for non-weapons. */
  powerLevel: number | null;
  feedPower: number | null;
  /** On-Equip stat bonuses, e.g. { def: 6, spd: 6 }. */
  statBonuses: Partial<Record<StatKey, number>>;
  /** Weapon damage, e.g. { min: 150, max: 175, total: 325 }. */
  damage: { min: number; max: number; total: number } | null;
  shots: number | null;
  /** Free-text "Effect(s)" blurb from the wiki, cleaned of markup. */
  effect: string | null;
  /** Item kind from the page's "all items of this kind" table, e.g. "Swords", "Helms", "Staves". */
  itemType: string | null;
}

function parseOnEquip(text: string): Partial<Record<StatKey, number>> {
  const out: Partial<Record<StatKey, number>> = {};
  for (const m of text.matchAll(/([+-]?\d+)\s*([A-Za-z]+)/g)) {
    const key = ONEQUIP_LABEL[m[2]!.toUpperCase()];
    if (key) out[key] = (out[key] ?? 0) + parseInt(m[1]!, 10);
  }
  return out;
}

function thRowValue($: cheerio.CheerioAPI, label: string): cheerio.Cheerio<any> | null {
  let cell: cheerio.Cheerio<any> | null = null;
  $('th').each((_, th) => {
    if (!cell && $(th).text().trim() === label) cell = $(th).nextAll().first();
  });
  return cell;
}

export function parseItemPage(html: string, slugFallback = ''): ItemInfo {
  const $ = cheerio.load(html);

  const canonical = $('link[rel=canonical]').attr('href') ?? '';
  const slug = canonical.replace('/wiki/', '') || slugFallback;
  const titlePart = $('title').text().split('|')[0]?.trim() ?? '';
  const name = $('h1').first().text().trim() || titlePart || slug;

  let tier: string | null = null;
  let tierType: TierType | null = null;
  let dungeon: string | null = null;
  let generation: string | null = null;
  const tierCell = thRowValue($, 'Tier');
  if (tierCell) {
    const txt = tierCell.text().trim();
    tier = txt.split(/\s+/)[0] || null;
    const cls = tierCell.attr('class') ?? '';
    tierType = cls.includes('ut') ? 'UT' : cls.includes('st') ? 'ST' : 'T';
    const imgTitle = tierCell.find('img').attr('title') ?? null;
    // For UT items this image is the source dungeon; for ST items it's the set generation.
    if (tierType === 'ST') generation = imgTitle;
    else dungeon = imgTitle;
  }

  // ST set membership — scope to the page content (.wiki-page), NOT the nav sidebar
  // which links every set in the game. The first content "-set" link is this item's set.
  let set: { slug: string; name: string } | null = null;
  $('.wiki-page a').each((_, a) => {
    if (set) return;
    const href = $(a).attr('href') ?? '';
    if (!/^\/wiki\/[a-z0-9-]+-set$/.test(href) || href.endsWith('/set-tier-items')) return;
    const s = href.replace('/wiki/', '');
    if (s.startsWith('legacy-')) return;
    set = { slug: s, name: $(a).text().trim() || s };
  });

  const dropsFrom: string[] = [];
  const dropsCell = thRowValue($, 'Drops From');
  if (dropsCell) {
    dropsCell.find('a').each((_, a) => {
      const t = $(a).text().trim();
      if (t) dropsFrom.push(t);
    });
  }

  const soulbound = /title="Soulbound"/.test(html);

  const intRow = (label: string): number | null => {
    const cell = thRowValue($, label);
    if (!cell) return null;
    const m = cell.text().replace(/,/g, '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  };
  const powerLevel = intRow('Power Level');
  const feedPower = intRow('Feed Power');
  const shots = intRow('Shots');

  const onEquip = thRowValue($, 'On Equip');
  const statBonuses = onEquip ? parseOnEquip(onEquip.text()) : {};

  let damage: ItemInfo['damage'] = null;
  const dmgCell = thRowValue($, 'Damage');
  if (dmgCell) {
    const txt = dmgCell.text();
    const range = txt.match(/(\d+)\s*[–-]\s*(\d+)/);
    const total = txt.match(/total:\s*([\d.]+)/);
    if (range) {
      damage = {
        min: parseInt(range[1]!, 10),
        max: parseInt(range[2]!, 10),
        total: total ? Math.round(parseFloat(total[1]!)) : parseInt(range[2]!, 10),
      };
    }
  }

  const effectCell = thRowValue($, 'Effect(s)') ?? thRowValue($, 'Effect');
  const effect = effectCell ? effectCell.text().replace(/\s+/g, ' ').trim() || null : null;

  // Item kind: the centred header of the table that lists every item of this kind, where this
  // item appears in bold ("<strong>UT. Demon Blade</strong>" under "Swords"). Set tables share
  // the layout — skip those.
  let itemType: string | null = null;
  const norm = (t: string) => t.replace(/^[A-Z]{1,2}\d*\.\s*/, '').replace(/[’‘]/g, "'").trim().toLowerCase();
  const me = norm(name);
  $('th > a').each((_, a) => {
    if (itemType) return;
    const href = $(a).attr('href') ?? '';
    if (!/^\/wiki\/[a-z0-9-]+$/.test(href) || href.endsWith('-set')) return;
    const bold = $(a).closest('table').find('strong');
    if (bold.filter((_, el) => norm($(el).text()) === me).length) itemType = $(a).text().trim() || null;
  });

  return {
    slug, name, tier, tierType, dungeon, generation, set, dropsFrom, soulbound,
    powerLevel, feedPower, statBonuses, damage, shots, effect, itemType,
  };
}

// ---------------------------------------------------------------------------
// Set-Tier (ST) sets: the /wiki/set-tier-items index grid + individual set pages
// ---------------------------------------------------------------------------

export interface SetIndexEntry {
  slug: string;
  name: string;
  className: string;
  /** Column the set sits under: "1st Generation", "Reskin", etc. */
  generation: string;
}

/** Generation columns we treat as currently farmable (Legacy + Vanity are skipped). */
const CURRENT_SET_COLUMNS = new Set(['1st Generation', '2nd Generation', '3rd Generation', 'Reskin']);

/** Locate the set-tier-items grid table (header has both "Class" and "1st Generation"). */
function findSetGrid($: cheerio.CheerioAPI): cheerio.Cheerio<any> | null {
  let grid: cheerio.Cheerio<any> | null = null;
  $('table').each((_, t) => {
    if (grid) return;
    const labels = $(t).find('thead th').map((_, th) => $(th).text().trim()).get();
    if (labels.includes('Class') && labels.includes('1st Generation')) grid = $(t);
  });
  return grid;
}

/** Parse the class column of /wiki/set-tier-items → class name + icon image URL. */
export function parseClassIcons(html: string): { name: string; url: string }[] {
  const $ = cheerio.load(html);
  const grid = findSetGrid($);
  if (!grid) return [];
  const out: { name: string; url: string }[] = [];
  const seen = new Set<string>();
  grid.find('tbody tr').each((_, tr) => {
    const cell = $(tr).children('td').eq(0);
    const img = cell.find('img').first();
    const name = img.attr('title') ?? cell.text().trim();
    const url = img.attr('src') ?? '';
    if (name && url && !seen.has(name)) {
      seen.add(name);
      out.push({ name, url });
    }
  });
  return out;
}

/** Parse /wiki/set-tier-items → current ST sets (class + generation), skipping Legacy/Vanity. */
export function parseSetIndex(html: string): SetIndexEntry[] {
  const $ = cheerio.load(html);
  const grid = findSetGrid($);
  if (!grid) return [];

  const labels = grid.find('thead th').map((_, th) => $(th).text().trim()).get();
  const out: SetIndexEntry[] = [];
  (grid as cheerio.Cheerio<any>).find('tbody tr').each((_, tr) => {
    const tds = $(tr).children('td');
    if (!tds.length) return;
    const className = tds.eq(0).find('img').attr('title') ?? tds.eq(0).text().trim();
    if (!className) return;
    tds.each((ci, td) => {
      if (ci === 0 || !CURRENT_SET_COLUMNS.has(labels[ci] ?? '')) return;
      $(td)
        .find('a')
        .each((_, a) => {
          const href = $(a).attr('href') ?? '';
          if (!href.startsWith('/wiki/') || !href.endsWith('-set')) return;
          const slug = href.replace('/wiki/', '');
          if (slug.startsWith('legacy-')) return;
          out.push({ slug, name: $(a).find('img').attr('title') ?? $(a).text().trim(), className, generation: labels[ci]! });
        });
    });
  });
  return out;
}

export interface SetMemberRef { slug: string; name: string }
export interface SetPageInfo {
  name: string;
  className: string | null;
  generation: string | null;
  /** Member items in slot order (weapon, ability, armor, ring). */
  members: SetMemberRef[];
  /** Raw "+15 HP, +3 DEF…" bonus text per threshold. */
  bonuses: { two: string | null; three: string | null; four: string | null };
  /** Boss / chest names the set drops from (the no-image links in "Drops From"). */
  sources: string[];
}

/** Parse an individual ST set page (/wiki/<name>-set). */
export function parseSetPage(html: string, slugFallback = ''): SetPageInfo {
  const $ = cheerio.load(html);
  const name = $('h1').first().text().trim() || slugFallback;

  const classCell = thRowValue($, 'Class');
  const className = classCell ? classCell.find('a').first().text().trim() || classCell.text().trim() || null : null;
  const genCell = thRowValue($, 'Set Generation');
  const generation = genCell ? (genCell.find('img').attr('title') ?? (genCell.text().trim() || null)) : null;

  const members: SetMemberRef[] = [];
  const seen = new Set<string>();
  const pushMember = (href: string, name: string) => {
    if (!href.startsWith('/wiki/')) return;
    const slug = href.replace('/wiki/', '');
    if (!slug || slug.endsWith('-set') || seen.has(slug)) return;
    seen.add(slug);
    members.push({ slug, name });
  };

  // Primary member source: the per-piece blocks (one .col-md-6 each, in slot order).
  // These exist even when "Drops From" is "TBA" (newer sets), where the parenthetical
  // member images are absent.
  $('.col-md-6 a').each((_, a) => {
    const $a = $(a);
    const img = $a.find('img');
    if (img.length) pushMember($a.attr('href') ?? '', img.attr('title') ?? $a.text().trim());
  });

  // Sources (and a member fallback) come from the "Drops From" cell: image-bearing
  // links are member pieces, plain links are the bosses/chests that drop them.
  const sources: string[] = [];
  const dropsCell = thRowValue($, 'Drops From');
  if (dropsCell) {
    dropsCell.find('a').each((_, a) => {
      const $a = $(a);
      const img = $a.find('img');
      if (img.length) {
        if (members.length === 0) pushMember($a.attr('href') ?? '', img.attr('title') ?? $a.text().trim());
      } else {
        const t = $a.text().trim();
        if (t) sources.push(t);
      }
    });
  }

  const bonusText = (label: string): string | null => {
    const c = thRowValue($, label);
    return c ? c.text().replace(/\s+/g, ' ').trim() || null : null;
  };

  return {
    name, className, generation, members,
    bonuses: { two: bonusText('2nd Piece Bonus'), three: bonusText('3rd Piece Bonus'), four: bonusText('4th Piece Bonus') },
    sources,
  };
}
