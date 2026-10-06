import {
  compilePatterns,
  learnTemplate,
  matchLine,
  redactLine,
  type GameState,
  type LearnedTemplate,
  type Location,
  type LocationData,
  type Place,
  type PlaceIndex,
} from '../shared/location';

/**
 * Watches for the game WITHOUT touching it: the OS process list says whether it's running,
 * and the log file the game itself writes (Player.log) says where the player is. Read-only;
 * no memory reads, no packet capture, no input — nothing DECA's ToS forbids.
 * Electron-free (fs/process access is injected) so it runs under the headless tests.
 */
export interface GameWatcherDeps {
  supported: boolean;
  /** Image names of running processes. */
  listProcesses(): Promise<string[]>;
  /** Candidate Player.log paths, newest first. */
  findLogs(): string[];
  stat(path: string): { size: number; mtimeMs: number } | null;
  /** Read `length` bytes from `start` as UTF-8. */
  read(path: string, start: number, length: number): string;
  data(): LocationData;
  index(): PlaceIndex;
  loadLearned(): LearnedTemplate[];
  saveLearned(t: LearnedTemplate[]): void;
  /** The game was detected on this PC in an earlier session. */
  seenBefore?: boolean;
  /** First detection ever — persist it. */
  markSeen?(): void;
  onChange(state: GameState): void;
  now?(): number;
}

export interface GameWatchSettings {
  detectFromLog: boolean;
}

/** Bytes re-read from the end of the log when attaching (finds the current location). */
const BOOTSTRAP_BYTES = 64 * 1024;
/** Most we read per tick — a huge jump means a fresh/rotated log; only the tail matters. */
const MAX_READ = 256 * 1024;
/** The log counts as "the game is running" if it grew this recently. */
const LOG_ACTIVE_MS = 90_000;
const RECENT_LINES = 200;
const MAX_LEARNED = 8;
/** Diagnostics-only updates (new log lines, no location change) are pushed at most this often. */
const DIAG_EVERY_MS = 5000;

export class GameWatcher {
  private state: GameState;
  private settings: GameWatchSettings;
  private offset = 0;
  private carry = '';
  private recent: { line: string; at: number }[] = [];
  private learned: LearnedTemplate[];
  private learnedRe: RegExp[] = [];
  private patterns: RegExp[] = [];
  private patternSrc: string[] | null = null;
  private processSeen = false;
  private timers: NodeJS.Timeout[] = [];
  private lastDiagEmit = 0;

  constructor(private deps: GameWatcherDeps, settings: GameWatchSettings) {
    this.settings = { ...settings };
    this.learned = deps.loadLearned().slice(0, MAX_LEARNED);
    this.compileLearned();
    this.state = {
      supported: deps.supported,
      running: false,
      seenGame: !!deps.seenBefore,
      focused: null,
      logPath: null,
      logActiveAt: null,
      location: null,
      learned: [],
      recent: [],
    };
    this.refreshDiagnostics();
  }

  private now() {
    return this.deps.now?.() ?? Date.now();
  }

  getState(): GameState {
    return this.state;
  }

  start(): void {
    if (!this.deps.supported) return;
    void this.pollProcesses();
    this.tick();
    this.timers.push(setInterval(() => void this.pollProcesses(), 5000));
    this.timers.push(setInterval(() => this.tick(), 1000));
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  configure(patch: Partial<GameWatchSettings>): void {
    this.settings = { ...this.settings, ...patch };
    if (!this.settings.detectFromLog && this.state.location?.source === 'log') this.set({ location: null });
  }

  /** From the (optional) foreground-window watcher. */
  setFocused(focused: boolean | null): void {
    if (focused !== this.state.focused) this.set({ focused });
  }

  async pollProcesses(): Promise<void> {
    let names: string[] = [];
    try {
      names = await this.deps.listProcesses();
    } catch {
      /* tasklist unavailable — fall back to log activity */
    }
    const want = new Set(this.deps.data().processNames.map((p) => p.toLowerCase()));
    this.processSeen = names.some((n) => want.has(n.toLowerCase()));
    this.updateRunning();
  }

  private updateRunning(): void {
    const logActive = this.state.logActiveAt != null && this.now() - this.state.logActiveAt < LOG_ACTIVE_MS;
    const running = this.processSeen || logActive;
    if (running && !this.state.seenGame) {
      this.state = { ...this.state, seenGame: true };
      this.deps.markSeen?.();
    }
    if (running !== this.state.running) {
      // Game closed → wherever we thought the player was no longer applies.
      this.set(running ? { running } : { running, location: null, focused: this.state.focused === null ? null : false });
    }
  }

  /** One read step of the log (every second). */
  tick(): void {
    if (!this.settings.detectFromLog) return this.updateRunning();
    const path = this.deps.findLogs()[0] ?? null;
    if (!path) {
      if (this.state.logPath) this.set({ logPath: null });
      return this.updateRunning();
    }
    const st = this.deps.stat(path);
    if (!st) return this.updateRunning();

    let fresh = false;
    if (path !== this.state.logPath) {
      // New log: start near the end so the current location is found without replaying history.
      this.offset = Math.max(0, st.size - BOOTSTRAP_BYTES);
      this.carry = '';
      fresh = true;
      this.set({ logPath: path });
    } else if (st.size < this.offset) {
      // The game restarted and rewrote its log: a new session starts at the menu.
      this.offset = 0;
      this.carry = '';
      if (this.state.location?.source === 'log') this.set({ location: null });
    }

    if (st.size > this.offset) {
      const start = Math.max(this.offset, st.size - MAX_READ);
      const text = this.carry + this.deps.read(path, start, st.size - start);
      this.offset = st.size;
      const lines = text.split('\n');
      this.carry = lines.pop() ?? '';
      this.state = { ...this.state, logActiveAt: st.mtimeMs };
      // A just-attached log only counts if the game is actually writing it now.
      const current = !fresh || this.now() - st.mtimeMs < LOG_ACTIVE_MS;
      this.ingest(lines, current);
    }
    this.updateRunning();
  }

  private ingest(lines: string[], current: boolean): void {
    const at = this.now();
    this.ensurePatterns();
    const index = this.deps.index();
    let found: Place | null = null;
    let hitTemplate = -1;
    for (const raw of lines) {
      const line = raw.replace(/\r$/, '');
      if (!line.trim()) continue;
      this.recent.push({ line, at });
      // Learned templates first (they describe this PC's log), then the shipped patterns.
      for (let i = 0; i < this.learnedRe.length; i++) {
        const p = matchLine(line, index, [], [this.learnedRe[i]!]);
        if (p) {
          found = p;
          hitTemplate = i;
          break;
        }
      }
      if (hitTemplate < 0) {
        const p = matchLine(line, index, this.patterns);
        if (p) found = p;
      }
    }
    if (this.recent.length > RECENT_LINES) this.recent = this.recent.slice(-RECENT_LINES);
    if (hitTemplate >= 0) {
      this.learned[hitTemplate]!.hits++;
      this.deps.saveLearned(this.learned);
    }
    this.refreshDiagnostics();
    if (found && current && found.id !== this.state.location?.placeId) {
      this.set({ location: toLocation(found, 'log', at) });
    } else if (at - this.lastDiagEmit > DIAG_EVERY_MS) {
      // Nothing changed for the HUD — refresh the diagnostics panel now and then.
      this.emit();
    }
  }

  /**
   * The player picked a place by hand (quick-pick). Use it, and learn how this PC's log
   * names places from the lines written just before — so next time it's automatic.
   */
  setManual(place: Place | null): { learned: boolean } {
    const at = this.now();
    let learned = false;
    if (place && this.settings.detectFromLog) {
      const window = this.recent.filter((r) => at - r.at < 120_000).map((r) => r.line);
      const tpl = learnTemplate(window, place, this.deps.index());
      if (tpl && !this.learned.some((t) => t.source === tpl.source)) {
        this.learned = [tpl, ...this.learned].slice(0, MAX_LEARNED);
        this.compileLearned();
        this.deps.saveLearned(this.learned);
        learned = true;
      }
    }
    this.refreshDiagnostics();
    this.set({ location: place ? toLocation(place, 'manual', at) : null });
    return { learned };
  }

  forgetLearned(): void {
    this.learned = [];
    this.compileLearned();
    this.deps.saveLearned([]);
    this.refreshDiagnostics();
    this.emit();
  }

  private compileLearned(): void {
    this.learnedRe = compilePatterns(this.learned.map((t) => t.source));
    // Keep the two lists aligned if a stored template no longer compiles.
    if (this.learnedRe.length !== this.learned.length) {
      this.learned = this.learned.filter((t) => compilePatterns([t.source]).length === 1);
    }
  }

  private ensurePatterns(): void {
    const src = this.deps.data().linePatterns;
    if (src !== this.patternSrc) {
      this.patternSrc = src;
      this.patterns = compilePatterns(src);
    }
  }

  private refreshDiagnostics(): void {
    this.state = {
      ...this.state,
      learned: this.learned.map(({ source, example, hits }) => ({ source, example, hits })),
      recent: this.recent.slice(-12).map((r) => redactLine(r.line).slice(0, 240)),
    };
  }

  private set(patch: Partial<GameState>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private emit(): void {
    this.lastDiagEmit = this.now();
    this.deps.onChange(this.state);
  }
}

function toLocation(p: Place, source: Location['source'], at: number): Location {
  return { placeId: p.id, kind: p.kind, name: p.name, ...(p.dungeonId ? { dungeonId: p.dungeonId } : {}), source, at };
}
