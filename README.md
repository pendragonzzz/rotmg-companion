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

Then type a **public** RealmEye username and hit Load.

## Features

- **Per-character goals** — stat maxing (with the biome/beacon to farm), gear upgrades, and exaltations.
- **Beacons & biomes** — the 2025 Realm Rework: which tier-colored beacon to head to for what you need.
- **Dungeon readiness + guide-sourced tips** — when you're ready, and the key mechanic ("don't hit the Puppet
  Master clones", etc.).
- **ST set browser** — filter by class & difficulty; see pieces, stats, where to farm, and set bonuses.
- **Game overlay** — transparent, click-through HUD (hotkey `Ctrl+Shift+O`) showing the active character's
  next goals, beacons to farm, recommended set, and a current-dungeon card with drops + strategy. Fully
  customizable on the **Overlay** tab (layout, opacity, which widgets, rebindable hotkeys, a dungeon quick-pick).

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

See **`CONTEXT.md`** for the full architecture and **`META-2025.md`** for the meta/intel research the data is
built from. In short: `src/shared` (isomorphic logic + curated/generated JSON data), `src/main` (Electron main
+ overlay window + IPC), `src/preload`, `src/renderer` (React UI + overlay). `scripts/refresh-data.ts` is the
token-free weekly RealmEye scraper.

## License

MIT
