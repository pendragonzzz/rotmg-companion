import type { PlayerProfile } from '../shared/types';
import type { ClassMaxTable } from '../shared/engine';
import {
  DEFAULT_LIVE_SETTINGS,
  LIVE_FEED_MAX,
  LIVE_MIN_INTERVAL_SEC,
  diffProfiles,
  type LiveEvent,
  type LiveSettings,
  type LiveState,
} from '../shared/live';

export interface LiveSyncDeps {
  fetch: (name: string, force: boolean) => Promise<PlayerProfile | null>;
  classMax: ClassMaxTable;
  /** Called whenever the state changes; `events` are the NEW events from this sync (if any). */
  onState: (state: LiveState, events: LiveEvent[], prev: PlayerProfile | null) => void;
  saveSettings: (s: LiveSettings) => void;
}

/** Most failures we back off for: interval × 2^n, capped at 8×. */
const MAX_BACKOFF = 3;

/**
 * Background RealmEye poller. Runs in the main process so it keeps going while the
 * window is minimized behind the game (renderer timers get throttled; these don't).
 */
export class LiveSync {
  private state: LiveState;
  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<void> | null = null;
  private failures = 0;

  constructor(
    private deps: LiveSyncDeps,
    settings: Partial<LiveSettings> = {},
  ) {
    this.state = {
      settings: { ...DEFAULT_LIVE_SETTINGS, ...settings },
      status: 'idle',
      player: '',
      profile: null,
      syncedAt: null,
      lastChanged: null,
      error: null,
      feed: [],
    };
  }

  getState(): LiveState {
    return this.state;
  }

  configure(patch: Partial<LiveSettings>): LiveState {
    const s = { ...this.state.settings, ...patch };
    s.intervalSec = Math.max(LIVE_MIN_INTERVAL_SEC, Math.round(s.intervalSec || DEFAULT_LIVE_SETTINGS.intervalSec));
    this.state = { ...this.state, settings: s, status: this.idleStatus(s) };
    this.deps.saveSettings(s);
    this.failures = 0;
    this.schedule();
    this.emit([]);
    return this.state;
  }

  /** Load (or switch to) a player. Same player → treated as a sync, so changes are diffed. */
  async load(name: string, force: boolean): Promise<{ ok: true; profile: PlayerProfile | null } | { ok: false; error: string }> {
    const player = name.trim();
    const same = player.toLowerCase() === this.state.player.toLowerCase();
    if (!same) {
      this.clearTimer();
      this.state = { ...this.state, player, profile: null, syncedAt: null, lastChanged: null, error: null, feed: [] };
    }
    try {
      const prev = this.state.profile;
      const profile = await this.deps.fetch(player, force);
      const events = profile ? this.apply(profile) : [];
      if (!profile) this.state = { ...this.state, status: 'error', error: `No RealmEye player named "${player}".` };
      this.failures = 0;
      this.schedule();
      this.emit(events, prev);
      return { ok: true, profile };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.state = { ...this.state, status: 'error', error };
      this.emit([]);
      return { ok: false, error };
    }
  }

  /** Check RealmEye right now (the refresh button / F5). */
  async syncNow(): Promise<LiveState> {
    await this.sync();
    this.schedule();
    return this.state;
  }

  clearFeed(): LiveState {
    this.state = { ...this.state, feed: [] };
    this.emit([]);
    return this.state;
  }

  stop(): void {
    this.clearTimer();
  }

  // ---- internals ----

  private idleStatus(s = this.state.settings): LiveState['status'] {
    if (!s.enabled) return 'paused';
    if (this.state.error) return 'error';
    return this.state.profile ? 'ok' : 'idle';
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule() {
    this.clearTimer();
    const { settings, player } = this.state;
    if (!settings.enabled || !player) return;
    const backoff = 2 ** Math.min(MAX_BACKOFF, this.failures);
    this.timer = setTimeout(() => {
      void this.sync().finally(() => this.schedule());
    }, settings.intervalSec * 1000 * backoff);
  }

  private sync(): Promise<void> {
    if (!this.state.player) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    this.state = { ...this.state, status: 'syncing' };
    this.emit([]);
    this.inFlight = (async () => {
      const player = this.state.player;
      try {
        const profile = await this.deps.fetch(player, true);
        if (player !== this.state.player) return; // switched players mid-flight
        if (!profile) throw new Error(`No RealmEye player named "${player}".`);
        const prev = this.state.profile;
        const events = this.apply(profile);
        this.failures = 0;
        this.emit(events, prev);
      } catch (err) {
        this.failures++;
        this.state = {
          ...this.state,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        };
        this.emit([]);
      } finally {
        this.inFlight = null;
      }
    })();
    return this.inFlight;
  }

  /** Adopt a fresh snapshot; returns the events it produced vs the previous one. */
  private apply(profile: PlayerProfile): LiveEvent[] {
    const now = Date.now();
    const prev = this.state.profile;
    const events = prev ? diffProfiles(prev, profile, this.deps.classMax, now) : [];
    this.state = {
      ...this.state,
      profile,
      syncedAt: now,
      lastChanged: events.length ? now : this.state.lastChanged,
      error: null,
      status: this.state.settings.enabled ? 'ok' : 'paused',
      feed: events.length ? [...events, ...this.state.feed].slice(0, LIVE_FEED_MAX) : this.state.feed,
    };
    return events;
  }

  private emit(events: LiveEvent[], prev: PlayerProfile | null = null) {
    this.deps.onState(this.state, events, prev);
  }
}
