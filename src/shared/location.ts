/**
 * Where is the player right now? (Nexus, a realm, a dungeon, the vault…)
 *
 * ToS-safe by construction: the only input is the text log the game itself writes to disk
 * (Unity's Player.log) plus the player's own manual picks. Nothing here touches the game
 * process, its memory or its network traffic.
 *
 * Two ways a log line becomes a location:
 *   1. Shipped patterns (locations.json → `linePatterns`, hot-updatable with the game data).
 *   2. Templates learned on this PC: when the player picks a place by hand, a recent log line
 *      that names it becomes a template ("Loading map: {name}") — so detection calibrates
 *      itself to whatever the game actually logs, without anyone knowing the format upfront.
 * Either way the captured text must resolve to a KNOWN place, so stray log noise can't
 * invent locations.
 */

export type PlaceKind = 'nexus' | 'realm' | 'dungeon' | 'vault' | 'hub';

export interface Place {
  id: string;
  kind: PlaceKind;
  name: string;
  /** For dungeons: the dungeons.json id. */
  dungeonId?: string;
  /** Every name the place goes by (display name first). */
  names: string[];
}

/** locations.json */
export interface LocationData {
  asOf: string;
  /** Non-dungeon places. Dungeons come from dungeons.json. */
  places: { id: string; kind: Exclude<PlaceKind, 'dungeon'>; name: string; aliases?: string[] }[];
  /** Extra names for dungeons, by dungeons.json id ("O3", "Lost Halls"…). */
  dungeonAliases: Record<string, string[]>;
  /** Regex sources with a `(?<name>…)` group; tried against every new log line. */
  linePatterns: string[];
  /** Game executables, for "is the game running?" (Windows process list). */
  processNames: string[];
  /** Folders under %USERPROFILE%\AppData\LocalLow that may hold the game's Player.log. */
  logDirs: string[];
}

export type LocationSource = 'log' | 'manual';

export interface Location {
  placeId: string;
  kind: PlaceKind;
  name: string;
  dungeonId?: string;
  source: LocationSource;
  at: number;
}

/** A template learned from this PC's own log. */
export interface LearnedTemplate {
  /** Regex source, anchored, with a `(?<name>…)` group. */
  source: string;
  /** The (redacted) line it was learned from, for the diagnostics panel. */
  example: string;
  learnedAt: number;
  hits: number;
}

/** Lowercase, drop a leading "the", possessive 's and anything that isn't a letter/digit. */
export function normPlace(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^the\s+/, '')
    .replace(/'s\b/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export interface PlaceIndex {
  places: Place[];
  byId: Map<string, Place>;
  /** normPlace(name) → place */
  byName: Map<string, Place>;
}

export function buildPlaceIndex(data: LocationData, dungeons: { id: string; name: string }[]): PlaceIndex {
  const places: Place[] = [];
  for (const p of data.places) places.push({ id: p.id, kind: p.kind, name: p.name, names: [p.name, ...(p.aliases ?? [])] });
  for (const d of dungeons) {
    // "Lost Halls / Marble Colossus", "Oryx's Sanctuary (O3)" → each part is a name too.
    const parts = d.name.split(/\s*\/\s*|\s*\(|\)\s*/).map((s) => s.trim()).filter(Boolean);
    const names = [...new Set([parts[0] ?? d.name, d.name, ...parts, ...(data.dungeonAliases[d.id] ?? [])])];
    places.push({ id: d.id, kind: 'dungeon', name: parts[0] ?? d.name, dungeonId: d.id, names });
  }
  const byName = new Map<string, Place>();
  for (const p of places) {
    for (const n of p.names) {
      const k = normPlace(n);
      if (k.length >= 2 && !byName.has(k)) byName.set(k, p);
    }
  }
  return { places, byId: new Map(places.map((p) => [p.id, p])), byName };
}

/** Resolve free text (a captured name) to a known place. */
export function lookupPlace(text: string, index: PlaceIndex): Place | null {
  const k = normPlace(text);
  if (!k) return null;
  const exact = index.byName.get(k);
  if (exact) return exact;
  // "Realm of the Mad God - Medusa", "Nexus (USWest)": try the leading words.
  const words = text.split(/[^A-Za-z0-9'’]+/).filter(Boolean);
  for (let n = Math.min(words.length - 1, 5); n >= 1; n--) {
    const hit = index.byName.get(normPlace(words.slice(0, n).join(' ')));
    if (hit) return hit;
  }
  return null;
}

/** Compile regex sources, silently skipping any that don't compile. */
export function compilePatterns(sources: string[]): RegExp[] {
  const out: RegExp[] = [];
  for (const s of sources) {
    try {
      out.push(new RegExp(s, 'i'));
    } catch {
      /* a bad pattern in the data must never break detection */
    }
  }
  return out;
}

/**
 * A log line → the place it says the player is in, or null. Learned templates are tried
 * first (they're specific to this PC's log), then the shipped patterns.
 */
export function matchLine(line: string, index: PlaceIndex, patterns: RegExp[], learned: RegExp[] = []): Place | null {
  for (const re of [...learned, ...patterns]) {
    const m = re.exec(line);
    const name = m?.groups?.name;
    if (!name) continue;
    const place = lookupPlace(name, index);
    if (place) return place;
  }
  return null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Escape literal text, generalising digit runs (timestamps, ids, ports) to \d+. */
const literal = (s: string) =>
  s
    .split(/(\d+)/)
    .map((part, i) => (i % 2 ? '\\d+' : escapeRe(part)))
    .join('');

/** Strip things that shouldn't leave the diagnostics panel: emails, tokens, IPs, user paths. */
export function redactLine(line: string): string {
  return line
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/\b(\d{1,3}\.){3}\d{1,3}(:\d+)?\b/g, '<ip>')
    .replace(/([A-Za-z]:\\Users\\)[^\\\s]+/gi, '$1<you>')
    .replace(/(\/(?:home|Users)\/)[^/\s]+/g, '$1<you>')
    .replace(/\b[A-Za-z0-9_\-+/=]{24,}\b/g, '<token>');
}

/**
 * Learn a template from recent log lines after the player picked `place` by hand: the most
 * recent line that names it becomes `^prefix(?<name>.+?)suffix$` (digits generalised). Lines
 * that are little more than the name are ignored — too vague to trust.
 */
export function learnTemplate(lines: string[], place: Place, index: PlaceIndex): LearnedTemplate | null {
  const names = [...place.names].sort((a, b) => b.length - a.length);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!.replace(/\r$/, '');
    for (const n of names) {
      for (const variant of [n, n.replace(/\s+/g, ''), n.replace(/[’']/g, '')]) {
        if (variant.length < 3) continue;
        const at = line.toLowerCase().indexOf(variant.toLowerCase());
        if (at < 0) continue;
        const prefix = line.slice(0, at);
        const suffix = line.slice(at + variant.length);
        // Need real context around the name, not just punctuation/numbers.
        if ((prefix + suffix).replace(/[^A-Za-z]/g, '').length < 4) continue;
        const source = `^${literal(prefix)}(?<name>.+?)${literal(suffix)}$`;
        let re: RegExp;
        try {
          re = new RegExp(source, 'i');
        } catch {
          continue;
        }
        // It must re-read this very line as this very place.
        if (matchLine(line, index, [], [re])?.id !== place.id) continue;
        return { source, example: redactLine(line).slice(0, 200), learnedAt: Date.now(), hits: 0 };
      }
    }
  }
  return null;
}

/** What the main process knows about the game right now (pushed to both windows). */
export interface GameState {
  /** Detection runs on Windows only (process list + LocalLow log path). */
  supported: boolean;
  /** The game process is running (or its log is being written to). */
  running: boolean;
  /** The game has been detected on this PC at least once — until then "follow the game" can't hide the HUD. */
  seenGame: boolean;
  /** The game is the active window; null = not tracked. */
  focused: boolean | null;
  /** The Player.log being read, if found. */
  logPath: string | null;
  /** Last time the log grew. */
  logActiveAt: number | null;
  location: Location | null;
  /** Templates learned on this PC (diagnostics + "forget"). */
  learned: { source: string; example: string; hits: number }[];
  /** Last few log lines, redacted (diagnostics). */
  recent: string[];
}

export const EMPTY_GAME_STATE: GameState = {
  supported: false,
  running: false,
  seenGame: false,
  focused: null,
  logPath: null,
  logActiveAt: null,
  location: null,
  learned: [],
  recent: [],
};
