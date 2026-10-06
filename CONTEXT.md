# RotMG Companion — Context Sheet

> Authoritative project context for resuming work. Source of truth; keep this updated.
> Path: `C:\Users\jaden\Desktop\⚙️ Scripts\rotmg-companion`
> Companion: **`META.md`** — the living grind/meta "street smarts" intel (biomes, beacons, exaltations,
> greater-pot dungeons, 2026 season timeline, when-to-stop) that the curated data files are built from.
> Sourced, not hand-guessed. Last full re-research: **2026-10**.

## What it is
A **Realm of the Mad God Exalt new-player companion** (desktop app). You import a player from
RealmEye and, per character, it shows a prioritized **goal/quest list**: which stats to max and
where to farm the pots, which UT/ST gear to chase, and which dungeons you're ready for.

**Hard rule:** informational only. It must NEVER read the game client's memory or automate input —
that's a ToS violation / ban. All data comes from public RealmEye pages + bundled static data.
(Consequence: the game overlay cannot auto-detect your character — you pick the active one manually.)
"Real-time" therefore means **live sync from RealmEye**: the main process re-reads the player's public RealmEye page
every 1–10 min (default 3), diffs it against the last snapshot, and every plan + the overlay re-computes. It sees what
RealmEye shows publicly (characters, levels, fame, base stats, 4 equipped items, pet, exaltations) — not inventory or
vault — and only as fast as RealmEye itself updates.

## Stack & how to run
- **Electron + React + TypeScript + cheerio**, bundled by **electron-vite**. (No Rust → Tauri was rejected.)
- Dev: `npm run dev` (electron-vite, renderer HMR). Build: `npm run build`. Typecheck: `npm run typecheck`.
- Headless tests: `npm run test:planner` (82 asserts on potion/gear/route/dungeon plans), `npm run test:live` (28 asserts:
  snapshot matching/diffing + the LiveSync poller), `npm run test:data` (14: game-data hot-update vs a fake GitHub),
  `npm run test:cleanup` (12: Desktop-tidy rules), `npm run test:readiness`, `npm run test:wiki` (parsers + per-enemy tables).
- Shipping: tag `v*` → `release.yml` builds the NSIS installer + portable, publishes the Release, attaches `scripts/install.ps1`.
  Installed apps auto-update (electron-updater, launch + every 6 h, install on quit).
- One-click: the **installed app** (NSIS desktop + Start-menu shortcut with the icon). The old dev launcher
  `RotMG Companion.bat` on the Desktop is retired — v0.2.0's first launch moves it to the Recycle Bin (Desktop tidy).
- Data refresh: **`npm run refresh`** — token-free Node scraper. **CI runs it weekly** (`refresh-data.yml`, Mon 06:17 UTC +
  on scraper changes) and commits the data; installed apps hot-load it from `main` (see "Self-updating game data").
  `npm run data:bump` publishes hand edits to curated JSON the same way.

## File map (source; ignore `scripts/.cache/`)
```
src/shared/            # isomorphic — used by BOTH main and renderer
  types.ts             # STAT_KEYS, SLOT_NAMES, Character, Stats, EquippedItem, PlayerProfile
  labels.ts            # STAT_LABEL, POT_LABEL
  realmeye.ts          # parsePlayer(html) + fetchPlayer(name) (player pages)
  realmeye-wiki.ts     # parseDungeonDrops + parseItemPage (now also set membership + ST generation) + parseSetIndex + parseSetPage
  engine.ts            # PURE logic: evaluateReadiness, buildGoals, potsToMax, potionSources (now carry dungeon id) + biomesForStat, exaltDungeonsForStat, isStatFarmObsolete, setsForClass, recommendSetFor; Biome/Exaltation/STSet types
  planner.ts           # PURE planners behind the v0.2 pages: potionPlan (pots/greaters per stat, bestNow, nextUnlock), farmRoute (Adept-then-Veteran biome set-cover), exaltPlan, gearPlan (equipped vs best-now vs BiS, set progress), dungeonInfo, verdictMap
  live.ts              # LIVE SYNC (pure): charKey, matchCharacters (no RealmEye char id → class + skin + gear, fame/level only go up),
                       # carryCharacter, diffProfiles → LiveEvents (maxed/gear/level/exalts/pots/new/gone), LiveSettings/LiveState
  dropTables.ts        # PER-ENEMY LOOT: buildEnemyTables(drops, tierOf) inverts "Drops of Interest" (dropsFrom) into
                       # EnemyDropTable[] {name, variants?, loot[] {slug,name,kind,tier,stat}}; drops junk (marks/skins/eggs/
                       # tarot/dyes), folds colour variants anywhere in the name (Soldier Bees, Adolescent Blue/Red/Yellow
                       # Beehemoth), merges different enemies with identical loot (`sharedBy`: O3 Minister/Judge/Ambassador),
                       # sorts enemies by rare-loot score; knownItemTiers(drops, sets) → slug→UT/ST for withKnownTiers
  gameDataBundle.ts    # SELF-UPDATING DATA contract: DATA_SCHEMA, DATA_FILES (10 JSONs), DataManifest/DataBundle/DataStatus,
                       # DATA_BASE_URL (raw.githubusercontent …/main/src/shared/data), validateBundle (sanity floors), validateManifest
  overlay.ts           # OverlaySettings (+ peekSeconds, peekOnChange, theme, dungeonCard, widgets.liveToasts) / OverlayState (+ toast) types, DEFAULT_OVERLAY_SETTINGS, mergeOverlaySettings (1-level deep), OVERLAY_PRESETS, HOTKEY_ACTIONS
  data/
    dungeons.json          # CURATED: dungeon ladder (id,name,category,tier,recommendedMaxed,minHp,note + biome,greaterPots,exaltStats,obsoleteAtMaxed). note = guide-sourced mechanic/strategy tip (shown in overlay current-dungeon card)
    biomes.json            # CURATED (2025 Realm Rework): biome -> {tier,guardian,statPots,dungeons,ut,encounters} — see META.md
    exaltation.json        # CURATED+VERIFIED: dungeon -> {stats,efficiency,note} + milestones (the post-8/8 grind)
    stat-priority.json     # CURATED: per-class stat maxing order (HP/MP last)
    pot-routing.json       # CURATED+VERIFIED: stat -> [{dungeonId, guaranteed}] (dungeon track; biome track lives in biomes.json)
    class-max-stats.json   # GENERATED by refresh: per-class max stats (19 classes)
    dungeon-drops.json     # GENERATED by refresh: {[dungeonId]:{potions,greaterPotions,gear[],other[],enemies[]}}
    data-manifest.json     # {schema, revision, updated, files} — revision++ on every data change (refresh / data:bump)
    sets.json              # GENERATED by refresh: ST sets[] {slug,name,className,generation,difficulty,sources,bonuses,members[]}
    pets.json              # CURATED: pet rarity/ability caps + ability tier list + feeding/fusing tips (verified vs RealmEye)
    meta.json              # CURATED: "state of the realm" for the Meta tab — season timeline, grind rules, corrections (asOf)
    gear-goals.json        # ORPHANED (superseded by dungeon-drops gear); safe to delete
src/main/index.ts      # Electron main: MAIN window + OVERLAY window (transparent/frameless/always-on-top/click-through);
                       # single-instance lock; window size/position memory (window-state.json); ipcMain 'player:get'(name, force),
                       # 'app:openExternal' (allow-list: realmeye.com + this repo), 'overlay:*'; global hotkeys; persists overlay-settings.json
src/main/gameDataUpdater.ts # GameDataUpdater: loadInstalled (userData/game-data if newer + valid) / check (manifest → files →
                       # validate → staging dir swap → pending) / apply; main: IPC data:{get,status,check,apply} + 'data:status',
                       # checks 15 s after launch then every 6 h (packaged only); apply reloads both windows
src/main/cleanupRules.ts # PURE Desktop-tidy rules: findOldCopies (old .bat launchers, older versioned portable/setup .exe,
                       # dead/old shortcuts; never folders/symlinks/the running exe) + staleInstallers (updater cache)
src/main/cleanup.ts    # tidyOldCopies(force): win32 + packaged, once per version (userData/cleanup.json) → shell.trashItem
                       # (Recycle Bin, top-level Desktop files only) + prunes applied installers in %LOCALAPPDATA%\rotmg-companion-updater
src/main/liveSync.ts   # LiveSync: background RealmEye poller (interval, error backoff ×2ⁿ ≤8, in-flight dedupe, feed cap 60); main wires
                       # IPC live:{getState,load,syncNow,configure,clearFeed} + push 'live:state', persists live-settings.json,
                       # carries the overlay character across syncs and flashes OverlayState.toast (optional peek-on-change)
src/preload/index.ts   # contextBridge -> window.api.{getPlayer(name,force), openExternal, app.{cleanupReport,tidyNow},
                       # data.{get,status,check,apply,onStatus}, live.{…}, overlay.{getState,setSettings,setCharacter,toggle,setPicker,onState}}
src/renderer/
  index.html           # single entry; #overlay hash selects the overlay root (no 2nd build entry needed)
  src/main.tsx         # boot(): window.api.data.get() → installGameData (downloaded bundle, if any) → dynamic import App / OverlayApp
                       # (<OverlayApp/> when location.hash === '#overlay', + body.overlay-mode)
  src/App.tsx          # SHELL: Sidebar + top bar (search, refresh, CharacterSwitcher) + page router; owns the profile, the ONE
                       # active character (drives every page + the overlay), startup auto-load, Ctrl+1–9 / "/" / F5 shortcuts
  src/pages.ts         # PAGES registry (id/label/icon/group/blurb/needsCharacter) + Nav (go/openDungeon/browseSets)
  src/gameData.ts      # every bundled JSON imported + typed ONCE (exports are `let`); installGameData(bundle) swaps in downloaded
                       # data before the UI loads; plannerData, goalCtx, dungeonById, effectiveTier, wiki URLs, dataManifest/dataSource
  src/hooks.ts         # usePrefs (theme/density/autoLoad/lastPlayer/startPage/lastPage/sidebar → 'rotmg-prefs'), THEMES (8, incl. contrast; first launch follows prefers-color-scheme),
                       # useRecentPlayers, useDeclined (+clearClass/clearAll), useOverlaySettings, useNow/timeAgo
  src/OverlayApp.tsx   # overlay-window root: subscribes to overlay:state, applies the synced theme, renders OverlayHud / DungeonPicker
  src/activeChar.ts    # charKey + remembered active character (pickActive/rememberActive)
  src/classIcons.ts    # import.meta.glob loader for bundled class sprites (assets/classes/*.png); monogram fallback
  src/beacons.ts       # shared BEACON colors by biome tier + beaconForBiome(slug) + biomeName(slug)
  src/styles/          # tokens.css (vars + 7 themes + density) · base.css (component kit) · shell.css · characters.css · pages.css · overlay.css · live.css (index.css imports all)
  components/ui.tsx              # shared kit: Panel, StatTile, Switch, ToggleRow, Segmented, EmptyState, TierBadge, StatusPill, BeaconTag, StatChip, ClassSprite, Bar, DungeonLink
  components/Sidebar.tsx         # grouped nav (Plan/Browse/App), live badges (pots left, gear upgrades), collapse
  components/CharacterSwitcher.tsx # top-bar active-character picker (sprites, n/8, level)
  components/CharactersPage.tsx  # roster tiles + sort/filter toolbar + CharacterCards; Welcome screen when no player
  components/CharacterCard.tsx   # card + actions (Set active / Potions / Gear) + GoalRow quest log + stats/gear/readiness (chips open Dungeons)
  components/PotionsPage.tsx     # potion planner: tiles, class-ordered stat rows (bar, pots / Greaters, best-now, biome), per-stat sources, farm route; 8/8 → exalt list
  components/GearPage.tsx        # gear planner: 4 slot cards (equipped / best now + delta / endgame BiS / all options), set progress, recommended set
  components/DungeonsPage.tsx    # encyclopedia: filterable list (category, exalt, greater, ready, favorites, stat) + detail (readiness, strategy, pots, exalt, biome, key items, drops)
                                 # + DropTables / EnemyCard: per-enemy loot ("Rare loot" / "Everything"; ★ = gear your class can use)
  components/Notices.tsx         # bottom-left notices: "Fresh game intel downloaded → Apply now", "Moved N old copies off your Desktop"
  components/SettingsPage.tsx    # themes (swatch cards), density, sidebar, startup, overlay, shortcuts, your data (recents/declined/reset),
                                 # game data & updates (revision/source, check now, apply, tidy Desktop + last report), about
  components/NeedCharacter.tsx   # empty state for character-driven pages
  components/Live.tsx            # LiveBadge (top-bar ● Live + popover), Toasts (bottom-right), ActivityFeed (Characters page), LiveSettingsPanel
  components/SetsPage.tsx        # ST set browser: search + class + difficulty filters; per-set members/stats/where/bonuses
  components/OverlayPage.tsx     # "Overlay" tab: status, presets, 3×3 position grid + sliders, widgets, dungeon-card options, peek + hotkeys, sticky live preview
  components/OverlayHud.tsx      # the HUD (overlay window + preview): header/target/beacons/goals/set + rich dungeon card (readiness, exalt, pots, class drops, key items, strategy)
  components/DungeonPicker.tsx   # in-game quick-pick: ↑/↓/Enter/Esc, readiness dots, exalt tags, ★ favorites, "For your goals", clear
  components/PetsPage.tsx, MetaPage.tsx (exalt pills open Dungeons), Icon.tsx (IconName-typed SVG set), Dropdown.tsx, ErrorBoundary.tsx
scripts/
  refresh-data.ts      # THE data pipeline (see below). `npm run refresh`
  test-live.ts         # headless: simulated play session between two snapshots + the LiveSync poller. `npm run test:live`
  test-planner.ts      # headless: potion/gear/route/dungeon plans for fixture chars + a synthetic 2/8 beginner, with asserts. `npm run test:planner`
  test-readiness.ts    # headless: prints goals/readiness for a fixture. `npm run test:readiness`
  test-wiki.ts         # headless: tests wiki parsers + per-enemy drop tables. `npm run test:wiki`
  test-data-update.ts  # headless: GameDataUpdater vs a fake GitHub (same rev, newer, broken, newer schema, offline). `npm run test:data`
  test-cleanup.ts      # headless: Desktop-tidy rules (what is / isn't an old copy). `npm run test:cleanup`
  bump-data.ts         # validate the bundle, revision+1, today's date (`npm run data:bump`; refresh calls bumpManifest)
  install.ps1          # one-line installer attached to every Release (latest setup.exe → SHA-256 check → /S → launch)
  parse-fixture.ts, gen-class-maxes.ts (orphaned), count-live.ts
fixtures/              # saved RealmEye pages for offline parser tests
```

## Data pipeline (`scripts/refresh-data.ts`) — token-free, cached, weekly
- Pure Node, **zero Claude tokens**. Disk-caches every fetched page to `scripts/.cache/` (7-day TTL); `npm run refresh -- --force` ignores cache. Polite UA, 1.2s gap between network calls, retries on empty body.
- **Sources (all RealmEye):**
  1. ~20 player pages → **item universe** (slug→slot/classes/tier from equipped gear) + **class max stats** (8/8 base stats == class max).
  2. Each dungeon's wiki page (`/wiki/<slug>`) → **Drops of Interest** → potions (regular vs `Greater`) + gear slugs.
  3. Each gear item's wiki page → **score** + **summary** + **effect synopsis** (cached as `item-<slug>`).
  4. **ST sets:** `set-tier-items` index grid (skip Legacy/Vanity columns) → each `<name>-set` page
     (`parseSetPage`: members via the `.col-md-6` blocks — robust to "Drops From: TBA"; class, generation,
     2/3/4-pc bonuses, boss/chest sources) → each member's item page for stats/score. Difficulty + member
     "where to farm" come from reverse-mapping member slugs to the tracked dungeons' drops (`slugToDungeons`).
- **Outputs:** `class-max-stats.json`, `dungeon-drops.json`, `sets.json` (~80 current sets; the ~50 event/reskin
  sets have no tracked dungeon → difficulty "Other", with boss/chest `sources` as the fallback "where").
- **Per-enemy drop tables:** each drop's `dropsFrom` is inverted per enemy (`buildEnemyTables`); tiers come from the item
  universe or the item page. Stored as `dungeon-drops.json[id].enemies`.
- **Gear classification (2026-10 fix):** RealmEye **player tooltips are now blank** (no "UT"/"ST", no name), so the player
  sample only gives slot + classes. Tier comes from each item's wiki page; slot + classes from the player sample → last
  run's `dungeon-drops.json` → `sets.json` rosters → **learned item kinds** (`parseItemPage().itemType`, e.g. "Swords":
  the table on the page that lists the item in bold). Gear `classes` = every class seen using that kind, not just
  the sampled wearer. The scraper logs the kinds it learned and any UT/ST of an unknown kind.
- **Safety:** every fetch has a 30 s timeout; before writing, the bundle is checked with `validateBundle` — a broken
  scrape exits 1 and writes nothing. Only changed files are written, then `bumpManifest` bumps the revision.
- **Self-updating game data:** apps fetch `data-manifest.json` from `main` (15 s after launch, then every 6 h); a higher
  revision with the same `schema` → download all `DATA_FILES` → validate → stage in `userData/game-data` → "Apply now"
  (reload) or next launch. A newer `schema` waits for an app release. ⚠ Only live once the data is on **`main`**.
- **WIKI_SLUG overrides** (id ≠ slug): `davy-jones-locker→davy-jones-s-locker`, `oryx-sanctuary→oryx-s-sanctuary`, `puppet-masters-theatre→puppet-master-s-theatre`. (RealmEye apostrophe-s → `-s-`.)

## Key domain logic & decisions
- **Stat priority:** HP (Life) & MP (Mana) are **LAST** (their pots only drop in dangerous/endgame dungeons). Per-class order in `stat-priority.json` (healers WIS-first, melee ATT-first…). Default `[def,vit,att,dex,spd,wis,hp,mp]`.
- **Level-20 gate:** below level 20 the ONLY goal is "Reach Level 20"; stat goals suppressed.
- **Readiness** gates on **maxedCount** vs `recommendedMaxed` (NOT HP — HP was too strict): gap≤0 ready, ==1 risky, ≥2 notReady. Result: 8/8 ready for all; 7/8 only Void/O3 risky. `recommendedMaxed` is lenient.
- **Potion routing is CURATED** in `pot-routing.json` (verified vs guides, NOT the flaky scrape). Guaranteed early sources: **DEX→Sprite World, SPD→Snake Pit, WIS→Undead Lair, VIT→Abyss, DEF→Toxic Sewers, ATT→Puppet Master's Theatre**. LIFE→**Woodland Labyrinth** (tier 3)/Tomb/Shaitan/Mountain Temple…, Moonlight Village = guaranteed Greater Life; MANA→**Ocean Trench / Crawling Depths** (tier 3)/Cnidarian/Wetlands… — Life & Mana are mid-game now (re-routed 2026-10 from the scraped drop tables; Ocean Trench is Mana, NOT Life). `potionSources()` prefers curated, sorts guaranteed-first then easiest-first.
- **Gear scoring** (in refresh): weapons = RealmEye **Power Level**; armor/rings = weighted stat-bonus sum; **abilities = stat sum + effect-keyword score** (`effectScore()`: invulnerable 35, exposed/armor-break 22, berserk 18, set-bonus 16, paralyze/curse/heal ~12…) so effect-only abilities don't rank at 0.
- **Goals** (`buildGoals`): kinds `level|stat|gear|unlock`, each with stable `id` (`stat:def`, `gear:<slug>`, `unlock:<dungeonId>`, `level`). Gear goals pick the **highest-scored item per slot** and carry `alternatives` (full ranked UT/ST list for the slot's dropdown). Stat goals carry `sources` (pot dropdown). **Decline (✕)** persists per class in localStorage and excludes the id so the next-best surfaces.
- **2025 Realm Rework meta (data + UI wired):** dungeons carry `biome`/`greaterPots`/`exaltStats`/
  `obsoleteAtMaxed`. **`biomes.json`** = open-world pot-farming track (Adept biomes drop the 6 stat pots,
  Veteran biomes add Life/Mana — so Life/Mana are **mid-game now**, not endgame-only). **`exaltation.json`** =
  the post-8/8 grind (dungeon→stat, 5/10/15/20/25 milestones = permanent per-class +1…+5).
  - **Goals (`buildGoals`):** an 8/8 character now gets **`exalt` goals** (`exaltGoals`, efficiency-sorted
    `EXALT` rows w/ note synopsis) instead of an empty list; stat goals carry a **`biome` hint** (🌿 "Farm the
    X biome") via `biomesForStat`. Decline id is `exalt:<dungeonId>`.
  - **Readiness:** verdicts carry **`obsolete`** (`isStatFarmObsolete`) — the UI strikes-through those "Ready
    now" chips (diminishing returns; farm greaters/biomes instead).
  - GREATER-pot badge also honors the curated `greaterPots` flag (works before the first refresh).
  - Engine helpers exposed for the overlay too: `biomesForStat`/`exaltDungeonsForStat`/`isStatFarmObsolete`.
- **ST set browser (Sets tab):** `App.tsx` now has a Characters/Sets nav toggle. **`SetsPage`** filters all
  current sets by **class** + **difficulty** (the source dungeon's category; event/reskin sets bucket to
  "Other"), each card showing the 4 pieces (slot/stats/where-to-farm), boss/chest sources, and 2/3/4-pc
  bonuses. **CharacterCard** integration: a `★ Farm <set>` recommended-set row (`recommendSetFor`: the
  richest-bonus reachable set for the class) + a "Browse all <class> sets" link, both jumping to the filtered
  Sets tab via an `onBrowseSets(className)` callback threaded App→ProfileView→CharacterCard.

## Critical gotchas / conventions
- **PowerShell cwd drifts** between calls and the project folder has an emoji+space. ALWAYS resolve it: `$proj = (Get-Item "$env:USERPROFILE\Desktop\*Scripts\rotmg-companion").FullName` and use absolute paths. (A `$PWD\rotmg-companion\...` style path silently doubled to `rotmg-companion\rotmg-companion` and looked like RealmEye "throttling" — it wasn't.)
- **RealmEye does NOT throttle us.** Pages are fully server-rendered HTML; plain GET + cheerio works. Use a descriptive UA.
- **Preload builds to `index.mjs`** (package is `type: module`); main references `../preload/index.mjs`.
- **`parseDungeonDrops` must emit one drop per item anchor** — a single drops cell can hold multiple items (e.g. Sprite World's Dex+Def pots together); keeping only the last silently dropped data.
- **Player `data-stats`** = `[[curr8],[bonus8],classId,level,maxedMask]`, stats `[hp,mp,att,def,spd,dex,vit,wis]`. **base = curr − bonus**; for 8/8, base == class max.
- **Equipped-item tiers:** because of the blank tooltips, main fills tiers in with `withKnownTiers(profile,
  knownItemTiers(drops, sets))` (ST set pieces + dungeon gear + per-enemy loot) before the profile reaches the UI or
  LiveSync. Otherwise the planner would treat equipped UTs as plain gear.
- **Network calls always time out** (`AbortSignal.timeout`: RealmEye 20 s, data updater / scraper 30 s) — a stalled request
  used to hang the load + live sync forever. Load errors show as a strip under the top bar on every page.
- **Desktop tidy must stay narrow:** only recognised top-level Desktop *files* (regex in `cleanupRules.ts`), always to the
  Recycle Bin, never folders/symlinks/the running exe, never outside Desktop + the app's own updater cache.
- Shared imports are **extensionless** (works under tsx + electron-vite esbuild).
- Number cells like account fame read "74945 (7745th)" → parse FIRST integer only.

## Current state (works, verified by typecheck + build + headless tests + Playwright screenshots of every page)
RealmEye import (all chars, sorted, error-isolated) · goals panel (level/stat/gear/unlock) · verified pot routing w/ GUARANTEED+GREATER badges · maxed-count readiness · gear ranking incl. abilities · UT/ST + pot expandable dropdowns · decline/restore · 5 themes + custom Dropdown · sharper edges · weekly auto-refresh scheduled · 2025→2026 meta (biomes/exalts/obsolescence, re-verified 2026-10) wired into goals · ST set browser tab + per-character recommended-set · icon system + game class sprites · **transparent click-through game overlay + Overlay customization tab (hotkey Ctrl+Shift+O)** · Pets tab · **Meta tab (2026-10 meta: grind order, exalt map, season timeline)**.

## Open items / next
- **v0.2 polish ideas:** per-character exalt counts (if RealmEye exposes them) to weight exalt goals; drag-to-place
  overlay; tray icon; item sprites.
- **Meta re-research (2026-10) follow-ups** (see `META.md` §10): Neo Wormhole exalt colours, Druid stat
  priority, a few portal biomes; run `npm run refresh` to scrape the 3 new dungeons (ice-citadel, deadwater-docks,
  puppet-masters-encore).
- **Verify ⚠ data:** per-biome UT drops (`biomes.json` `ut:null`) are still unfilled. Add biome wiki pages to
  the scraper so biome/UT data is auto-patchable like the rest. (Dungeon slugs are now all resolved — refresh
  covers 42/42; `crawling-depths`→`the-crawling-depths` added to WIKI_SLUG.)
- **Exalt goals polish:** they currently list efficient dungeons generically; could later weight by which
  exalts the player is *closest* to a milestone on (needs RealmEye per-class exalt counts, if scrapable).
- **Game overlay — BUILT** (was the #1 unbuilt feature). 2nd transparent/frameless/always-on-top/click-through
  BrowserWindow (`setIgnoreMouseEvents(true,{forward:true})`, `setAlwaysOnTop(true,'screen-saver')`), reusing the
  renderer via `#overlay` hash; global hotkey `Ctrl+Shift+O`; settings persisted to `overlay-settings.json`.
  **ToS:** the app can't read the game, so the active character is a **manual picker** on the Overlay page (not
  auto-detected) — pushed over IPC; the overlay computes that character's goals with the same engine.
  - **Done since:** biome/beacon **target widget** (target biome + tier-colored beacon dot + dungeon to enter;
    pulsing); **8 anchor positions** (4 corners + 4 edge-centers); **auto-select** active char on profile load
    (`activeChar.ts` `pickActive`: remembered key → remembered class → top char; `rememberActive` persists);
    **current-dungeon card** (manual `settings.currentDungeon` picker → that dungeon's strategy note + top UT/ST
    drops); **peek hotkey** `Ctrl+Shift+P` (momentary 5s show via transient `OverlayState.peek`).
  - **Customizable hotkeys:** `OverlaySettings.hotkeys` {toggle, peek, picker}; rebindable in the Overlay tab
    (`HotkeyInput` captures a keydown → Electron accelerator); main `registerHotkeys()` re-registers on change.
  - **Dungeon quick-pick menu** (`DungeonPicker`): the chosen UX for setting "current dungeon" without alt-tab.
    Hotkey opens it OVER the game; main `setPicker(true)` makes the overlay window interactive (`setIgnoreMouseEvents(false)`
    + `setFocusable(true)` + focus) so the search box can type; close reverts to click-through. Search + ★ favorites
    (`settings.favorites`, persisted), Enter picks top, Esc/backdrop closes.
  - **AUTO-DETECT the dungeon is NOT possible** (user asked): would require reading game memory / packets /
    screen-CV — all banned or against the no-read-the-client rule. The quick-pick menu is the compliant answer.
  - **User feedback (what NOT to add):** no pots-to-max / stat bars / exalt tracker / set tracker (all in-game);
    readiness too heavy; no beacon legend.
  - **Overlay next steps / polish:** layout **presets** (deferred); boss-mechanic notes; verify transparent-window
    + picker focus/return behavior on the user's setup. NOTE: on-screen highlighting of beacons/portals is also
    impossible (same ToS + procedural realm) — the target widget's beacon-color hint is the substitute.
- **Dropdown visibility** — user reported not seeing the expandable lists; code is correct & builds, so likely a stale running app (needs full relaunch). If persists: make the affordance more obvious (full-width "Show sources" bar vs small caret).
- Ability effect keywords: extend for niche effects scoring 0 (pure damage-nova, portal-summons).
- Manual character entry (for new accounts not on RealmEye). · Item icons (bundle datamined sprites). · electron-builder packaging.

## User profile / working style
- Experienced RotMG player; does NOT know exact gear drops → **everything must be RealmEye/guide-sourced & auto-patchable, never hand-guessed**. Keep tunable data in editable JSON.
- Tests each build and gives feedback; iterate. Cares about **token cost** (hence the token-free weekly scraper). Wants the app to feel **polished/professional** (themes, sharp edges, dropdowns) and **information-rich** (surface wiki intel).
- Verified the curated pot routing matches their game knowledge.

## Changelog (condensed)
1. Proved RealmEye player pages are scrapable + built `parsePlayer`/`fetchPlayer`.
2. Scaffolded Electron+React app; readiness engine + first dungeon/class-max data.
3. Goals panel front-and-center; trimmed readiness; richer theme; collapsible details.
4. Token-free cached `refresh-data.ts`; real RealmEye gear+potion drops; HP/MP-last priority + per-class table + level-20 gate; char sort + error boundary + count.
5. Pot dropdown (difficulty-sorted + GREATER); gear ranking via Power Level/stats.
6. Gear synopsis (effect blurb); decline-a-quest (persist + next-best); themes + custom Dropdown + sharper edges.
7. Recalibrated readiness to maxed-count; fixed multi-item-cell parser bug; researched + curated verified pot routing (guaranteed sources) + GUARANTEED badge; added Puppet Master's Theatre.
8. UT/ST option dropdowns (ranked alternatives per slot); ability effect-keyword scoring.
9. **2025 meta overhaul (data model):** researched the current grind (Realm Rework biomes/beacons,
   exaltations, greater-pot dungeons, when-to-stop) into `META-2025.md` (now `META.md`) from 2025+ sources; added
   `biomes.json` + `exaltation.json`; added 9 modern dungeons + `biome`/`greaterPots`/`exaltStats`/
   `obsoleteAtMaxed` fields to `dungeons.json`; corrected Life/Mana routing to mid-game; engine types +
   helpers (`biomesForStat`/`exaltDungeonsForStat`/`isStatFarmObsolete`); GREATER badge off curated flag.
   Verified: typecheck + build + headless readiness (ladder 30→42 dungeons).
10. **2025 meta wired into UI + refreshed:** 8/8 chars now get efficiency-sorted `exalt` goals; stat goals
    show a 🌿 biome-to-farm hint; obsolete "Ready now" dungeons are struck through. Ran `npm run refresh`
    (fixed `crawling-depths` slug) → live drops for all 42 dungeons incl. the 9 new ones. typecheck+build pass.
11. **ST set browser:** new parsers (`parseSetIndex`/`parseSetPage` + item-page set membership/generation),
    scraper now emits `sets.json` (80 current sets, Legacy/Vanity skipped). New **Sets tab** (class +
    difficulty filters) and **CharacterCard** recommended-set row + class link. Member extraction uses the
    `.col-md-6` blocks (handles "Drops From: TBA"). Verified: test:wiki, refresh (0 sets missing pieces),
    typecheck, build (47 modules), test:readiness (per-class recs). Fixtures added: set-index/set-twilight/item-corruption-tether.
12. **UI overhaul:** fixed ST→UT badge (RealmEye player tooltips call ST pieces "UT" — now overridden via the
    sets.json roster); made the "Not yet" readiness block expandable; added an inline-SVG icon system
    (`Icon`/`StatIcon`: 8 stat glyphs + UI icons) used in the stat grid + HUD; bundled 19 **game class sprites**
    (downloaded by refresh, pixel-rendered) in card/set headers w/ monogram fallback; refreshed the top HUD,
    stat grid, and spacing.
13. **Game overlay + Overlay tab:** transparent click-through always-on-top HUD window (renderer reused via
    `#overlay`), global hotkey, IPC state (settings + active character) persisted in main. New `OverlayPage`
    (active-char picker, widget toggles, position/opacity/scale/maxGoals, live preview) and `OverlayHud`
    (shared compact HUD computing the character's goals). typecheck + build pass (72 modules).
14. **Overlay v2:** biome/beacon **target widget** (tier-colored pulsing beacon dot + dungeon to enter);
    **8 anchor positions** (corners + edge-centers); **auto-select** active character on profile load (remembered
    by class across sessions, `activeChar.ts`); **current-dungeon info card** (strategy + top UT/ST drops, picked
    on the Overlay tab); **peek hotkey** `Ctrl+Shift+P`. Per user feedback, deliberately left in-game-redundant
    widgets (pots/stat-bars/exalt/readiness) out. typecheck + build pass (73 modules).
15. **Customizable hotkeys + dungeon quick-pick:** hotkeys moved into `settings.hotkeys` (toggle/peek/picker),
    rebindable in the Overlay tab (`HotkeyInput`). New `DungeonPicker` command-palette (search + ★ favorites)
    opened over the game via a hotkey that makes the overlay window momentarily interactive. Replaced the
    rejected "cycle through 42 dungeons" idea. Auto-detecting the dungeon confirmed impossible under ToS.
    typecheck + build pass (74 modules).
16. **Beacons in goals + auto-favorite goal dungeons:** goal rows (stat/exalt/unlock) now show the biome +
    tier-colored **beacon dot** to farm at (shared `beacons.ts`). New engine `goalDungeonIds(goals,dungeons)`
    (dungeon ids from goal id suffixes + pot-source names + `where`); the quick-pick now pins a **"For your
    goals"** group computed from the active character. Verified via test:readiness. (75 modules.)
17. **Overlay "Beacons to farm" widget:** lists the distinct beacons across the active character's goals
    (tier-colored dot + biome + stat pots it gives), toggleable. Also filled in **gear-goal biomes** (the last
    goal kind that lacked one), so beacon coverage is complete across goal types. typecheck + build pass.
18. **Guide-sourced dungeon notes:** rewrote all 42 `note` fields into concise, mechanic-focused strategy tips
    from RealmEye dungeon guides (e.g. Puppet Master "don't kill the clones — they paralyze + spawn puppets";
    Cnidarian "only the gold one is vulnerable"; O3 "Celestial phase — rotate the gaps, don't panic-run").
    Fixed a stale Toxic Sewers note (sludge=Sick + green slow-star, not the old "DS Gorgon"). These notes are
    what the overlay's current-dungeon card shows. typecheck + build pass.
19. **Packaging + GitHub shipping (v0.1.0 beta):** added `electron-builder.yml` (NSIS installer + portable exe,
    GitHub publish), `dist`/`dist:win`/`pack` scripts, `.github/workflows/{release,ci}.yml` (tag `v*` → builds
    + attaches installers to a Release), modernized README (download/build/release), `git init` + initial commit
    on `main`. NOTE: local `electron-builder` fails extracting winCodeSign symlinks without Windows **Developer
    Mode** (issue #6158) — CI runners build fine, so releases come from Actions, not local. `gh` CLI not
    installed → user creates the GitHub repo + pushes manually (replace `YOUR_USERNAME` in package.json repo URL).
20. **Verified user's `RotMG_Complete_Dungeon_Guide_Sheet.xlsx`** and folded the accurate wins into dungeon
    notes: Tomb "kill Bes→Nut→Geb one at a time (don't AoE)", Parasite "drag barrels into Nightmare Colony",
    Mad Lab "herd Horrific Creation into blue beams", Manor "break mirrors for Holy Water", Forbidden Jungle
    "destroy Mixcoatl's totems", Crawling Depths "pop egg sacks", Toxic Sewers boss name (Gulpord). Rejected the
    sheet's errors (Hive mislabeled Tier-1, Ocean Trench "answer the prompt" fabrication, dubious boss names,
    speculative trading tab). Pet/status-effect tabs are accurate but not yet surfaced in UI (future).
21. **v0.1.1 (shipped):** fixed overlay lifecycle — `mainWin` 'closed' now destroys `overlayWin` so the
    process fully exits (the hidden always-on-top window was keeping it alive). Added **recent player searches**
    (`useRecentPlayers` in hooks.ts, localStorage `rotmg-recent-players`): `<datalist>` autocomplete on the
    search box + clickable recent chips (with remove) on the home screen. Released via the gh/Actions pipeline.
22. **v0.1.2 (shipped):** **app icon** (`build/icon.ico` crossed-swords, generated via Pillow; electron-builder
    auto-embeds it). **Auto-update** via `electron-updater` (prod dep) — `app.isPackaged` -> `checkForUpdatesAndNotify()`
    in main; reads the GitHub `publish` config (app-update.yml). Auto-update works v0.1.2 -> forward (NSIS installer
    only, not portable). CI/release workflows bumped to Node 24.
23. **Version badge + Pets page:** app version shown in the header (`__APP_VERSION__` define in
    electron.vite.config, injected from package.json; declared in env.d.ts). New **Pets** tab (`PetsPage` +
    curated `pets.json`): rarity ability caps (Common 30 → Divine 100; 2nd ability @ Uncommon, 3rd @ Legendary),
    ability tier list (Heal/MHeal S, Electric A, Decoy B, Attack F), feeding + fusing tips — verified vs RealmEye
    pet guides; dropped the source sheet's bogus fame/gold feed costs. On `main`, not yet released.
24. **Meta re-research (2026-10) + Meta tab:** re-researched the whole meta through Season 31 into `META.md`
    (renamed from `META-2025.md`). **Fixed wrong data:** Ice Cave had the Ice *Citadel*'s SPD exalt (added
    `ice-citadel`, Runic Tundra); The Void is Mana-only (no Def); The Shatters is ATT ×2 per run (no Life/Mana);
    Ocean Trench drops Mana not Life, Manor drops ATT not WIS; Crystal Cavern is entered from Fungal Cavern (not
    Easter). Added `deadwater-docks` + `puppet-masters-encore` (WIKI_SLUG), biome `encounters`, Alien Reactors /
    Realm Legions notes; rebuilt `pot-routing.json` from the scraped RealmEye drop tables (mid-game Life/Mana).
    Level goal now says Rookie biomes. New **Meta** tab (`MetaPage` + `meta.json`): grind-in-order rules,
    exaltation map, 2026 season timeline, corrections. typecheck + test:readiness + test:wiki + build pass (79 modules).
25. **v0.2.0 top-down rebuild (QoL · potions · gear · dungeons · overlay):** new **shell** — grouped sidebar (live badges:
    pots left, gear upgrades; collapsible), top bar with player search + F5 refresh + **one global active character**
    (CharacterSwitcher) that drives every page and the overlay; startup auto-load of the last player; remembered page;
    Ctrl+1–9 / "/" / F5 shortcuts; single-instance lock; remembered window size; safe "open on RealmEye" links.
    New pure **`planner.ts`** (+ `test:planner`, 82 asserts): potionPlan / farmRoute (Adept biomes for the 6, then
    Veteran for Life/Mana — fixed a bug that sent a 2/8 into a Veteran biome first) / exaltPlan / gearPlan / dungeonInfo.
    New pages: **Potions** (class-ordered stat rows, pots vs Greaters, best source you can run now or the next unlock,
    biome route), **Gear** (equipped vs best-now vs endgame BiS with score deltas, all options, set progress),
    **Dungeons** (filterable encyclopedia + detail: readiness, strategy, pots, exalt, biome, runes, class drops,
    favorite / show-on-overlay), **Settings** (7 themes incl. new Sprite Forest + Midnight, density, startup, shortcuts,
    data management, about). **Overlay:** presets, 3×3 position grid, configurable peek, HUD follows the app theme,
    richer dungeon card (readiness, exalt, pots, class-usable drops, key items), quick-pick arrow-key nav + clear.
    CSS split into `styles/` layers; shared `gameData.ts` + `ui.tsx` kit. typecheck + build (91 modules) + all tests pass.
26. **Live sync ("real-time" character + item intel, ToS-safe):** the app now keeps the loaded player in sync with
    RealmEye in the background — main-process `LiveSync` polls every 1/3/5/10 min (default 3, ≥60s, backoff on errors),
    `shared/live.ts` diffs snapshots (matching characters without an id via class + skin + gear, fame/level monotonic)
    into events: stat maxed, gear equipped, level up, pots drunk, exaltations, new / dead characters. Every page
    re-plans instantly (e.g. Samurai hits 8/8 → its goals flip to exalts); the active character is carried across
    syncs even though its key changes with fame. UI: top-bar ● Live badge + popover (toggle, interval, check now),
    toast stack, Characters-page activity feed (click → make active), Settings panel, HUD change toasts + optional
    peek-on-change. Refresh/F5 = check now. Parser now reads RealmEye `data-skin`. Still never reads the game client.
    Verified: test:live (28) + test:planner (82) + typecheck + build + Playwright simulated-sync run (0 errors).
27. **Per-enemy drop tables · self-updating game data · Desktop tidy · v0.2.0 release:** Dungeons → *Drop tables*: which
    boss / mini-boss drops each UT/ST, Greater pot and key (`dropTables.ts`, scraped from RealmEye "Drops of Interest";
    junk filtered, colour variants folded; ★ = your class). Game data now **updates itself**: `data-manifest.json`
    revision + `GameDataUpdater` pulling from `main`, validated + staged, "Apply now" notice; weekly CI
    `refresh-data.yml` commits fresh scrapes (refuses broken ones). **Desktop tidy:** first launch of each version
    recycles old launchers / versioned exes / dead shortcuts and prunes applied installers (`cleanupRules.ts` +
    `cleanup.ts`, Settings → Tidy). Auto-update now also re-checks every 6 h. **Fixes:** network timeouts everywhere
    (a stalled RealmEye request hung loading); load errors visible on every page. **RealmEye changed:** player tooltips
    are blank now — the scraper takes tiers from item pages and learns slot/classes per item kind (CI's first scrape
    found 0 gear and the validator refused to publish it); the app fills equipped tiers back in from the game data. New **High contrast** theme; first
    launch follows OS light/dark. `install.ps1` one-liner attached to releases. Verified: typecheck + test:planner (82) +
    test:live (28) + test:data (14) + test:cleanup (12) + test:wiki + build (97 modules) + a real Electron smoke run
    (both windows, IPC, failed-load path, second-instance exit, window-state save; 0 errors).
