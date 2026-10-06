import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DATA_BASE_URL,
  DATA_FILES,
  DATA_SCHEMA,
  validateBundle,
  validateManifest,
  type DataBundle,
  type DataFile,
  type DataManifest,
  type DataStatus,
} from '../shared/gameDataBundle';

/**
 * Pulls newer game data (drop tables, meta, sets…) from the repo without a reinstall.
 * Downloads land in userData/game-data/ only after validation; the windows switch to
 * them on "Apply" (a reload) or on the next launch.
 */
export class GameDataUpdater {
  private active: DataBundle | null = null;
  private pending: DataBundle | null = null;
  private lastCheck: number | null = null;
  private error: string | null = null;
  private checking: Promise<DataStatus> | null = null;

  constructor(
    private dir: string,
    private bundled: DataManifest,
    private onStatus: (s: DataStatus) => void,
    private fetchFn: typeof fetch = fetch,
  ) {}

  /** Adopt a previously downloaded bundle if it's valid and newer than the one we shipped with. */
  loadInstalled(): void {
    try {
      const manifest = JSON.parse(readFileSync(join(this.dir, 'data-manifest.json'), 'utf-8')) as unknown;
      if (!validateManifest(manifest) || manifest.schema !== DATA_SCHEMA || manifest.revision <= this.bundled.revision) return;
      const files = Object.fromEntries(DATA_FILES.map((f) => [f, JSON.parse(readFileSync(join(this.dir, f), 'utf-8'))])) as Record<DataFile, unknown>;
      if (validateBundle(files)) return;
      this.active = { manifest, files };
    } catch {
      /* nothing installed (or unreadable) — use the bundled data */
    }
  }

  /** The bundle the windows should use, or null for the bundled data. */
  get(): DataBundle | null {
    return this.active;
  }

  status(): DataStatus {
    const m = this.active?.manifest ?? this.bundled;
    return {
      bundledRevision: this.bundled.revision,
      activeRevision: m.revision,
      activeUpdated: m.updated,
      source: this.active ? 'downloaded' : 'bundled',
      pending: this.pending ? { revision: this.pending.manifest.revision, updated: this.pending.manifest.updated } : null,
      lastCheck: this.lastCheck,
      error: this.error,
    };
  }

  /** Switch to the downloaded bundle (the caller reloads the windows). */
  apply(): boolean {
    if (!this.pending) return false;
    this.active = this.pending;
    this.pending = null;
    this.onStatus(this.status());
    return true;
  }

  check(): Promise<DataStatus> {
    if (!this.checking) this.checking = this.doCheck().finally(() => (this.checking = null));
    return this.checking;
  }

  private async getJson(file: string): Promise<unknown> {
    const res = await this.fetchFn(`${DATA_BASE_URL}/${file}?t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    return res.json();
  }

  private async doCheck(): Promise<DataStatus> {
    this.lastCheck = Date.now();
    try {
      const manifest = await this.getJson('data-manifest.json');
      if (!validateManifest(manifest)) throw new Error('remote manifest is malformed');
      if (manifest.schema !== DATA_SCHEMA) {
        this.error = 'Newer game data needs an app update (it will arrive with the next release).';
        return this.done();
      }
      const have = Math.max(this.bundled.revision, this.active?.manifest.revision ?? 0, this.pending?.manifest.revision ?? 0);
      if (manifest.revision <= have) {
        this.error = null;
        return this.done();
      }
      const files = {} as Record<DataFile, unknown>;
      for (const f of DATA_FILES) files[f] = await this.getJson(f);
      const problem = validateBundle(files);
      if (problem) throw new Error(`downloaded data failed validation (${problem})`);

      // Write to a staging folder, then swap it in — never leave a half-written bundle.
      const staging = `${this.dir}-new`;
      rmSync(staging, { recursive: true, force: true });
      mkdirSync(staging, { recursive: true });
      for (const f of DATA_FILES) writeFileSync(join(staging, f), JSON.stringify(files[f]));
      writeFileSync(join(staging, 'data-manifest.json'), JSON.stringify(manifest, null, 2));
      if (existsSync(this.dir)) rmSync(this.dir, { recursive: true, force: true });
      renameSync(staging, this.dir);

      this.pending = { manifest, files };
      this.error = null;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
    return this.done();
  }

  private done(): DataStatus {
    const s = this.status();
    this.onStatus(s);
    return s;
  }
}
