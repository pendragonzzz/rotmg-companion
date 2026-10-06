/**
 * test-cleanup.ts — the desktop-cleanup rules must only ever pick OLD copies of this app.
 * Run: `npm run test:cleanup`.
 */
import assert from 'node:assert/strict';
import { findOldCopies, staleInstallers, versionLt, type DesktopEntry } from '../src/main/cleanupRules';

const D = 'C:\\Users\\jaden\\Desktop';
const EXE = 'C:\\Users\\jaden\\AppData\\Local\\Programs\\rotmg-companion\\RotMG Companion.exe';
const f = (name: string, extra: Partial<DesktopEntry> = {}): DesktopEntry => ({ name, path: `${D}\\${name}`, isFile: true, ...extra });

const desktop: DesktopEntry[] = [
  f('RotMG Companion.bat'), // old dev launcher → trash
  f('Launch RotMG Companion.bat'), // old dev launcher → trash
  f('RotMG-Companion-0.1.3-portable.exe'), // older build → trash
  f('RotMG-Companion-0.1.2-setup.exe'), // older installer → trash
  f('RotMG-Companion-0.2.0-setup.exe'), // current version installer → keep
  f('RotMG-Companion-0.3.0-portable.exe'), // newer build → keep
  f('RotMG Companion.lnk', { target: EXE, targetExists: true }), // installer's shortcut → keep
  f('RotMG Companion (old).lnk', { target: `${D}\\RotMG Companion.bat`, targetExists: true }), // → trash
  f('RotMG Companion - Shortcut.lnk', { target: 'C:\\gone\\RotMG Companion.exe', targetExists: false }), // broken → trash
  f('Other Game.lnk', { target: 'C:\\Games\\other.exe', targetExists: true }), // not ours → keep
  f('rotmg notes.txt'), // not ours → keep
  { name: 'RotMG Companion.bat', path: `${D}\\folder`, isFile: false }, // a folder → never
  f('RotMG Companion.lnk.bak'), // unrecognised → keep
];

const picked = findOldCopies(desktop, { currentVersion: '0.2.0', keepPaths: [EXE] });
for (const c of picked) console.log(`  trash: ${c.name.padEnd(36)} (${c.reason})`);
const names = new Set(picked.map((c) => c.name));

let n = 0;
const ok = (c: unknown, m: string) => {
  assert.ok(c, m);
  n++;
};
ok(names.has('RotMG Companion.bat') && names.has('Launch RotMG Companion.bat'), 'old .bat launchers picked');
ok(names.has('RotMG-Companion-0.1.3-portable.exe') && names.has('RotMG-Companion-0.1.2-setup.exe'), 'older builds picked');
ok(!names.has('RotMG-Companion-0.2.0-setup.exe') && !names.has('RotMG-Companion-0.3.0-portable.exe'), 'current/newer builds kept');
ok(!names.has('RotMG Companion.lnk'), "installer's shortcut to the running app kept");
ok(names.has('RotMG Companion (old).lnk') && names.has('RotMG Companion - Shortcut.lnk'), 'stale shortcuts picked');
ok(!names.has('Other Game.lnk') && !names.has('rotmg notes.txt') && !names.has('RotMG Companion.lnk.bak'), 'unrelated files kept');
ok(picked.every((c) => c.path !== `${D}\\folder`), 'folders never picked');
ok(picked.length === 6, `exactly 6 picked (got ${picked.length})`);

// The running portable exe is never trashed, even if it's an "old" name.
const portable = `${D}\\RotMG-Companion-0.1.3-portable.exe`;
ok(findOldCopies([f('RotMG-Companion-0.1.3-portable.exe')], { currentVersion: '0.2.0', keepPaths: [portable] }).length === 0, 'running portable kept');
// Case-insensitive + forward slashes.
ok(findOldCopies([f('rotmg companion.BAT')], { currentVersion: '0.2.0', keepPaths: [] }).length === 1, 'case-insensitive');

ok(versionLt('0.1.3', '0.2.0') && !versionLt('0.2.0', '0.2.0') && !versionLt('0.10.0', '0.9.9'), 'semver compare');
ok(
  JSON.stringify(staleInstallers(['RotMG-Companion-0.1.3-setup.exe', 'RotMG-Companion-0.2.0-setup.exe', 'RotMG-Companion-0.3.0-setup.exe', 'update-info.json'], '0.2.0')) ===
    JSON.stringify(['RotMG-Companion-0.1.3-setup.exe', 'RotMG-Companion-0.2.0-setup.exe']),
  'applied installers pruned, pending newer one kept',
);

console.log(`\n✓ ${n} cleanup checks passed`);
