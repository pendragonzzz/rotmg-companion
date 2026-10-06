/**
 * Which files on the Desktop are OLD copies of this app — pure rules, no Electron, so
 * they're unit-tested (scripts/test-cleanup.ts). The caller only ever passes top-level
 * Desktop entries and moves matches to the Recycle Bin (reversible), never deletes.
 *
 * Old copies we recognise:
 *  - the pre-installer dev launcher ("RotMG Companion.bat" / "Launch RotMG Companion.bat")
 *  - downloaded builds of an OLDER version ("RotMG-Companion-0.1.3-portable.exe", "-setup.exe")
 *  - shortcuts named "RotMG Companion…" that point at one of those, or at nothing at all
 * Kept: the running app, the installer's own shortcut, any build of this or a newer version,
 * and anything we don't positively recognise.
 */

export interface CleanupReport {
  version: string;
  at: number;
  /** False when skipped (not an installed Windows build, or already ran for this version). */
  ran: boolean;
  /** Moved to the Recycle Bin. */
  removed: { name: string; reason: string }[];
  /** Applied installers pruned from the updater cache. */
  prunedInstallers: number;
  errors: string[];
}

export interface DesktopEntry {
  name: string;
  /** Absolute path. */
  path: string;
  /** Regular file (not a folder / symlink). */
  isFile: boolean;
  /** For .lnk files: the shortcut's target path, if readable. */
  target?: string | null;
  /** For .lnk files: whether that target still exists. */
  targetExists?: boolean;
}

export interface CleanupCandidate {
  path: string;
  name: string;
  reason: string;
}

export const LAUNCHER_RE = /^(launch )?rotmg[ -]companion( launcher)?\.(bat|cmd)$/i;
export const BUILD_RE = /^rotmg[ -]companion[ -](\d+\.\d+\.\d+)[ -](portable|setup)\.exe$/i;
export const SHORTCUT_RE = /^rotmg[ -]companion\b.*\.lnk$/i;

/** a < b for "x.y.z" versions. */
export function versionLt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0;
  }
  return false;
}

const base = (p: string) => p.split(/[\\/]/).pop() ?? p;
const norm = (p: string) => p.replace(/\//g, '\\').toLowerCase();

export function findOldCopies(
  entries: DesktopEntry[],
  opts: { currentVersion: string; keepPaths: string[] },
): CleanupCandidate[] {
  const keep = new Set(opts.keepPaths.filter(Boolean).map(norm));
  const isOldBuild = (name: string) => {
    const m = name.match(BUILD_RE);
    return !!m && versionLt(m[1]!, opts.currentVersion);
  };
  const out: CleanupCandidate[] = [];
  for (const e of entries) {
    if (!e.isFile || keep.has(norm(e.path))) continue;
    if (LAUNCHER_RE.test(e.name)) {
      out.push({ path: e.path, name: e.name, reason: 'old launcher (from before the installer)' });
    } else if (isOldBuild(e.name)) {
      out.push({ path: e.path, name: e.name, reason: `old v${e.name.match(BUILD_RE)![1]} download` });
    } else if (SHORTCUT_RE.test(e.name)) {
      const t = e.target ?? null;
      if (t && keep.has(norm(t))) continue; // the installer's shortcut to the running app
      if (!t || e.targetExists === false) {
        out.push({ path: e.path, name: e.name, reason: 'shortcut to an app that no longer exists' });
      } else if (LAUNCHER_RE.test(base(t)) || isOldBuild(base(t))) {
        out.push({ path: e.path, name: e.name, reason: 'shortcut to an old copy' });
      }
    }
  }
  return out;
}

/** Applied installers in electron-updater's pending folder (safe to prune once we're running a version ≥ theirs). */
export function staleInstallers(fileNames: string[], currentVersion: string): string[] {
  return fileNames.filter((n) => {
    const m = n.match(BUILD_RE);
    return !!m && !versionLt(currentVersion, m[1]!);
  });
}
