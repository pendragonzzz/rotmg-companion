# RotMG Companion

A **Realm of the Mad God Exalt** new-player companion (desktop). Import a player from RealmEye and,
per character, get a prioritized plan: which stats to max and where, which **beacons/biomes** to farm,
which **dungeons** you're ready for (with guide-sourced strategy tips), which **ST sets** to chase, and the
post-8/8 **exaltation** grind — plus a click-through **in-game overlay** HUD.

> **Informational companion only.** It never reads or automates the game client — all data comes from public
> RealmEye pages + bundled static data. (That's also why the overlay can't auto-detect your dungeon/character;
> you pick them.) Anything that reads/automates the Exalt client violates DECA's ToS and gets accounts banned.

## Download & install (players)

Grab the latest from the [**Releases**](../../releases) page:

- **`RotMG-Companion-x.y.z-setup.exe`** — installer (Start-menu + desktop shortcut, uninstaller).
- **`RotMG-Companion-x.y.z-portable.exe`** — single file, just double-click, no install.

The app isn't code-signed, so Windows SmartScreen may warn on first run — click **More info → Run anyway**.

The **installer auto-updates**: once you're on v0.1.2+, new releases download in the background and install on quit.

Then type a **public** RealmEye username and hit Load.

## Features

- **One active character, every page** — pick it in the top-right switcher; Potions, Gear, Dungeons and the
  overlay all plan for it. Your last player reloads on launch.
- **Potions** — pots left per stat in your class's maxing order, the best dungeon you can run *now* (or what
  unlocks next), Greater-pot math, and the fewest-biomes **farm route** with beacon colors.
- **Gear** — equipped vs best-you-can-farm-now vs endgame best-in-slot for every slot, with score deltas and
  ST set progress.
- **Dungeons** — a searchable encyclopedia: readiness for your character, the key mechanic, pots (regular /
  Greater / guaranteed), exalts, biome + beacon, O3 runes, and UT/ST drops for your class.
- **Characters** — your roster with each character's quest log (stats, exalts, gear, unlocks, sets).
- **Meta, Sets, Pets** — the current realm meta, every ST set, and pet ability priorities.
- **Game overlay** — transparent, click-through HUD (`Ctrl+Shift+O`) with your next goal, beacons, and a
  current-dungeon card; presets, 3×3 positioning, rebindable hotkeys, and an in-game quick-pick (`Ctrl+Shift+D`).
- **Settings** — 7 themes, compact density, startup behavior, keyboard shortcuts (`Ctrl+1–9`, `/`, `F5`), and
  your data.

## Run from source (dev)

```powershell
npm install
npm run dev        # launch the desktop app (electron-vite, HMR)
```

The bundled game data (dungeons, sets, class maxes, sprites) is committed, so the app runs without any
network/data step. To refresh that data from RealmEye later: `npm run refresh` (token-free scraper).

## Build a launchable locally

```powershell
npm run dist:win   # → dist/RotMG-Companion-x.y.z-setup.exe  +  -portable.exe
```

> Local Windows builds need **Developer Mode** ON (Settings → Privacy & security → For developers) so
> electron-builder can extract its toolchain (symlinks). If you'd rather not, just let CI build it ↓.

## Releasing (recommended — no local build)

Push a version tag and GitHub Actions builds the Windows installer + portable and attaches them to a Release:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

(See `.github/workflows/release.yml`. CI also typechecks + builds every push via `ci.yml`.)

## Project layout

See **`CONTEXT.md`** for the full architecture and **`META.md`** for the meta/intel research the data is
built from. In short: `src/shared` (isomorphic logic + curated/generated JSON data), `src/main` (Electron main
+ overlay window + IPC), `src/preload`, `src/renderer` (React UI + overlay). `scripts/refresh-data.ts` is the
token-free weekly RealmEye scraper.

## License

MIT
