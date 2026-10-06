import { app, shell } from 'electron';
import { existsSync, lstatSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { findOldCopies, staleInstallers, type CleanupReport, type DesktopEntry } from './cleanupRules';

export type { CleanupReport };

const markerFile = () => join(app.getPath('userData'), 'cleanup.json');

/**
 * Tidy old copies of the app off the Desktop (→ Recycle Bin) and prune installers the
 * updater already applied. Runs once per installed version; `force` re-runs it from Settings.
 * Only top-level Desktop files are ever considered, and only ones findOldCopies recognises.
 */
export async function tidyOldCopies(force = false): Promise<CleanupReport> {
  const version = app.getVersion();
  const report: CleanupReport = { version, at: Date.now(), ran: false, removed: [], prunedInstallers: 0, errors: [] };
  if (process.platform !== 'win32' || !app.isPackaged) return report;
  if (!force) {
    try {
      if ((JSON.parse(readFileSync(markerFile(), 'utf-8')) as { version?: string }).version === version) return report;
    } catch {
      /* first run of this version */
    }
  }
  report.ran = true;

  // 1) Old copies on the Desktop → Recycle Bin.
  try {
    const desktop = resolve(app.getPath('desktop'));
    const entries: DesktopEntry[] = readdirSync(desktop).map((name) => {
      const path = join(desktop, name);
      let isFile = false;
      try {
        isFile = lstatSync(path).isFile(); // lstat: symlinks are never followed or touched
      } catch {
        /* vanished */
      }
      const e: DesktopEntry = { name, path, isFile };
      if (isFile && name.toLowerCase().endsWith('.lnk')) {
        try {
          const target = shell.readShortcutLink(path).target;
          e.target = target || null;
          e.targetExists = !!target && existsSync(target);
        } catch {
          e.target = null;
          e.targetExists = false;
        }
      }
      return e;
    });
    const keepPaths = [process.execPath, process.env.PORTABLE_EXECUTABLE_FILE ?? ''];
    for (const c of findOldCopies(entries, { currentVersion: version, keepPaths })) {
      const p = resolve(c.path);
      if (dirname(p).toLowerCase() !== desktop.toLowerCase()) continue; // top-level Desktop only, ever
      try {
        await shell.trashItem(p);
        report.removed.push({ name: c.name, reason: c.reason });
      } catch (err) {
        report.errors.push(`${c.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    report.errors.push(`desktop: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2) Installers the updater already applied (it keeps them around by default).
  try {
    const local = process.env.LOCALAPPDATA;
    if (local) {
      let dirName = 'rotmg-companion-updater';
      try {
        const yml = readFileSync(join(process.resourcesPath, 'app-update.yml'), 'utf-8');
        dirName = yml.match(/updaterCacheDirName:\s*["']?([\w.-]+)/)?.[1] ?? dirName;
      } catch {
        /* default name */
      }
      const pending = resolve(local, dirName, 'pending');
      if (pending.startsWith(resolve(local) + sep) && existsSync(pending)) {
        const stale = staleInstallers(readdirSync(pending), version);
        for (const f of stale) rmSync(join(pending, f), { force: true });
        // No installer left → its bookkeeping file is stale too.
        if (stale.length && !readdirSync(pending).some((f) => f.endsWith('.exe'))) {
          rmSync(join(pending, 'update-info.json'), { force: true });
        }
        report.prunedInstallers = stale.length;
      }
    }
  } catch (err) {
    report.errors.push(`updater cache: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    writeFileSync(markerFile(), JSON.stringify({ version, at: report.at, removed: report.removed }));
  } catch {
    /* non-fatal */
  }
  return report;
}
