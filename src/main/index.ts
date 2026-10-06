import { app, BrowserWindow, ipcMain, globalShortcut, Menu, nativeImage, screen, shell, Tray } from 'electron';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import electronUpdater from 'electron-updater';
import { fetchPlayer, withKnownTiers } from '../shared/realmeye';
import { knownItemTiers } from '../shared/dropTables';
import { LiveSync } from './liveSync';
import { carryCharacter, charKey, type LiveEvent, type LiveSettings, type LiveState } from '../shared/live';
import type { ClassMaxTable } from '../shared/engine';
import classMaxData from '../shared/data/class-max-stats.json';
import bundledManifest from '../shared/data/data-manifest.json';
import bundledDrops from '../shared/data/dungeon-drops.json';
import bundledSets from '../shared/data/sets.json';
import bundledLocations from '../shared/data/locations.json';
import bundledDungeons from '../shared/data/dungeons.json';
import { buildPlaceIndex, type LearnedTemplate, type LocationData, type PlaceIndex } from '../shared/location';
import { GameWatcher } from './gameWatcher';
import { FocusWatcher } from './focusWatcher';
import { GameDataUpdater } from './gameDataUpdater';
import { tidyOldCopies, type CleanupReport } from './cleanup';
import type { DataManifest, DataStatus } from '../shared/gameDataBundle';
import { DEFAULT_DESKTOP_SETTINGS, type DesktopSettings } from '../shared/desktop';

const { autoUpdater } = electronUpdater;
import type { Character, PlayerProfile } from '../shared/types';
import {
  EMPTY_OVERLAY_STATE,
  OVERLAY_TOAST_MS,
  mergeOverlaySettings,
  type OverlaySettings,
  type OverlayState,
} from '../shared/overlay';

let gameData: GameDataUpdater | null = null;

// RealmEye's player tooltips can come back without the item tier; fill UT/ST back in from the
// game data in use (downloaded bundle or the one we shipped), rebuilt when that changes.
let tierCache: { source: unknown; tiers: Map<string, string> } | null = null;
function itemTiers(): Map<string, string> {
  const bundle = gameData?.get() ?? null;
  if (!tierCache || tierCache.source !== bundle) {
    const drops = (bundle?.files['dungeon-drops.json'] ?? bundledDrops) as Parameters<typeof knownItemTiers>[0];
    const sets = (bundle?.files['sets.json'] ?? bundledSets) as Parameters<typeof knownItemTiers>[1];
    tierCache = { source: bundle, tiers: knownItemTiers(drops, sets) };
  }
  return tierCache.tiers;
}
async function fetchPlayerWithTiers(name: string, force: boolean): Promise<PlayerProfile | null> {
  const profile = await fetchPlayer(name, force);
  return profile && withKnownTiers(profile, itemTiers());
}

let mainWin: BrowserWindow | null = null;
let overlayWin: BrowserWindow | null = null;
let peekTimer: NodeJS.Timeout | null = null;
let toastTimer: NodeJS.Timeout | null = null;
const overlayState: OverlayState = { ...EMPTY_OVERLAY_STATE, settings: { ...EMPTY_OVERLAY_STATE.settings } };

const settingsFile = () => join(app.getPath('userData'), 'overlay-settings.json');
const windowStateFile = () => join(app.getPath('userData'), 'window-state.json');
const liveSettingsFile = () => join(app.getPath('userData'), 'live-settings.json');
const desktopSettingsFile = () => join(app.getPath('userData'), 'desktop-settings.json');

// ---- tray + Windows startup ----
let desktop: DesktopSettings = { ...DEFAULT_DESKTOP_SETTINGS };
let tray: Tray | null = null;
/** Set when the user really means to quit (tray → Quit, updater) so close-to-tray lets go. */
let quitting = false;
/** Launched by Windows at sign-in with "start hidden" → stay in the tray. */
const launchedHidden = process.argv.includes('--hidden');

function showMain(): void {
  if (!mainWin || mainWin.isDestroyed()) return createMainWindow();
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
}

function toggleOverlayEnabled(): void {
  overlayState.settings.enabled = !overlayState.settings.enabled;
  saveSettings();
  applyOverlay();
  broadcastOverlay();
}

function refreshTray(): void {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open RotMG Companion', click: showMain },
      { type: 'separator' },
      { label: 'Overlay', type: 'checkbox', checked: overlayState.settings.enabled, click: toggleOverlayEnabled },
      { label: 'Pick where I am…', click: () => setPicker(true) },
      { label: 'Check RealmEye now', click: () => void live?.syncNow() },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
}

async function createTray(): Promise<void> {
  try {
    // The exe's own (embedded) icon, so the tray matches the desktop shortcut.
    let icon = nativeImage.createEmpty();
    try {
      icon = await app.getFileIcon(process.execPath, { size: 'small' });
    } catch {
      /* keep empty */
    }
    tray = new Tray(icon);
    tray.setToolTip('RotMG Companion');
    tray.on('click', showMain);
    refreshTray();
  } catch {
    tray = null; // no tray on this desktop — closing still quits as usual
  }
}

function applyDesktop(): void {
  // Only packaged builds register with Windows startup (dev would register electron.exe).
  if (app.isPackaged && process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: desktop.startWithWindows,
      args: desktop.startWithWindows && desktop.startHidden ? ['--hidden'] : [],
    });
  }
}

function readJson<T>(file: string): Partial<T> {
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as Partial<T>;
  } catch {
    return {};
  }
}

function loadSettings(): void {
  try {
    const raw = readFileSync(settingsFile(), 'utf-8');
    overlayState.settings = mergeOverlaySettings(EMPTY_OVERLAY_STATE.settings, JSON.parse(raw));
  } catch {
    /* first run — keep defaults */
  }
}

// ---- main-window size/position memory ----
interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
}
function loadWindowState(): WindowState {
  const fallback: WindowState = { width: 1280, height: 860, maximized: false };
  try {
    const s = JSON.parse(readFileSync(windowStateFile(), 'utf-8')) as WindowState;
    // Only restore a position that is still on a connected display.
    const onScreen =
      s.x != null &&
      s.y != null &&
      screen.getAllDisplays().some(({ workArea: a }) => s.x! >= a.x - 50 && s.y! >= a.y - 50 && s.x! < a.x + a.width && s.y! < a.y + a.height);
    return { ...fallback, ...s, ...(onScreen ? {} : { x: undefined, y: undefined }) };
  } catch {
    return fallback;
  }
}
function saveWindowState(win: BrowserWindow): void {
  try {
    const b = win.getNormalBounds();
    const s: WindowState = { x: b.x, y: b.y, width: b.width, height: b.height, maximized: win.isMaximized() };
    writeFileSync(windowStateFile(), JSON.stringify(s));
  } catch {
    /* non-fatal */
  }
}

/** Links the renderer may open in the user's browser (everything else is refused). */
const EXTERNAL_ALLOW = [/^https:\/\/(www\.)?realmeye\.com\//, /^https:\/\/github\.com\/pendragonzzz\/rotmg-companion/];

function saveSettings(): void {
  try {
    writeFileSync(settingsFile(), JSON.stringify(overlayState.settings, null, 2));
  } catch {
    /* non-fatal */
  }
}

function rendererTarget(win: BrowserWindow, hash = ''): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) win.loadURL(hash ? `${devUrl}#${hash}` : devUrl);
  else win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined);
}

function broadcastOverlay(): void {
  for (const w of [overlayWin, mainWin]) {
    if (w && !w.isDestroyed()) w.webContents.send('overlay:state', overlayState);
  }
}

/**
 * The HUD shows when it's switched on AND (if "follow the game" is on) the game is running
 * AND (if "hide when unfocused" is on) the game is in front. Peek and the picker always show.
 */
function overlayVisible(): boolean {
  const { settings: s, game: g } = overlayState;
  // Until the game has been seen on this PC (exe name / log location unknown), never hide for it.
  const gameGate = !s.followGame || !g.supported || !g.seenGame || g.running;
  const focusGate = !s.hideWhenUnfocused || !g.running || g.focused !== false;
  return (s.enabled && gameGate && focusGate) || overlayState.peek || overlayState.picker;
}

function applyOverlay(): void {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  if (overlayVisible()) overlayWin.showInactive();
  else overlayWin.hide();
}

// ---- game detection: process list + the game's own Player.log (read-only) ----
let watcher: GameWatcher | null = null;
let focus: FocusWatcher | null = null;

function activeLocations(): LocationData {
  return (gameData?.get()?.files['locations.json'] as LocationData | undefined) ?? (bundledLocations as unknown as LocationData);
}
let placeCache: { source: unknown; index: PlaceIndex } | null = null;
function placeIndex(): PlaceIndex {
  const bundle = gameData?.get() ?? null;
  if (!placeCache || placeCache.source !== bundle) {
    const dungeons = (bundle?.files['dungeons.json'] ?? bundledDungeons) as { id: string; name: string }[];
    placeCache = { source: bundle, index: buildPlaceIndex(activeLocations(), dungeons) };
  }
  return placeCache.index;
}

/** %USERPROFILE%\AppData\LocalLow\DECA…\…\Player.log candidates, newest first (re-scanned every 15 s). */
let logScan: { at: number; files: string[] } | null = null;
function findGameLogs(): string[] {
  if (logScan && Date.now() - logScan.at < 15_000) return logScan.files;
  logScan = { at: Date.now(), files: scanGameLogs() };
  return logScan.files;
}
function scanGameLogs(): string[] {
  const lowLow = join(app.getPath('home'), 'AppData', 'LocalLow');
  const found = new Set<string>();
  for (const d of activeLocations().logDirs) found.add(join(lowLow, d, 'Player.log'));
  try {
    for (const company of readdirSync(lowLow).filter((n) => /^deca/i.test(n))) {
      found.add(join(lowLow, company, 'Player.log'));
      for (const game of readdirSync(join(lowLow, company))) found.add(join(lowLow, company, game, 'Player.log'));
    }
  } catch {
    /* no LocalLow (not Windows / game never run) */
  }
  return [...found]
    .filter((f) => existsSync(f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

function readSlice(file: string, start: number, length: number): string {
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(length);
    const n = readSync(fd, buf, 0, length, start);
    return buf.subarray(0, n).toString('utf-8');
  } finally {
    closeSync(fd);
  }
}

function runningProcesses(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    execFile('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, out) => {
      if (err) return reject(err);
      resolve(out.split(/\r?\n/).map((l) => l.match(/^"([^"]+)"/)?.[1] ?? '').filter(Boolean));
    });
  });
}

const learnedFile = () => join(app.getPath('userData'), 'learned-locations.json');
const gameSeenFile = () => join(app.getPath('userData'), 'game-seen.json');

function startGameWatch(): void {
  watcher = new GameWatcher(
    {
      supported: process.platform === 'win32',
      listProcesses: runningProcesses,
      findLogs: findGameLogs,
      stat: (f) => {
        try {
          const st = statSync(f);
          return { size: st.size, mtimeMs: st.mtimeMs };
        } catch {
          return null;
        }
      },
      read: readSlice,
      data: activeLocations,
      index: placeIndex,
      loadLearned: () => {
        const v = readJson<{ templates: LearnedTemplate[] }>(learnedFile()).templates;
        return Array.isArray(v) ? v : [];
      },
      saveLearned: (templates) => {
        try {
          writeFileSync(learnedFile(), JSON.stringify({ templates }, null, 2));
        } catch {
          /* non-fatal */
        }
      },
      seenBefore: existsSync(gameSeenFile()),
      markSeen: () => {
        try {
          writeFileSync(gameSeenFile(), JSON.stringify({ at: new Date().toISOString() }));
        } catch {
          /* non-fatal */
        }
      },
      onChange: (g) => {
        overlayState.game = g;
        applyOverlay();
        broadcastOverlay();
      },
    },
    { detectFromLog: overlayState.settings.detectFromLog },
  );
  overlayState.game = watcher.getState();
  watcher.start();
  focus = new FocusWatcher((name) => {
    if (name === null) return watcher?.setFocused(null);
    const games = activeLocations().processNames.map((p) => p.toLowerCase().replace(/\.exe$/, ''));
    watcher?.setFocused(games.includes(name.toLowerCase()));
  });
  if (overlayState.settings.hideWhenUnfocused) focus.start();
}

/** Briefly show the overlay (a quick glance), then revert to the enabled state. */
function peekOverlay(ms = Math.max(1, overlayState.settings.peekSeconds) * 1000): void {
  if (peekTimer) clearTimeout(peekTimer);
  overlayState.peek = true;
  applyOverlay();
  broadcastOverlay();
  peekTimer = setTimeout(() => {
    overlayState.peek = false;
    applyOverlay();
    broadcastOverlay();
  }, ms);
}

// ---- live sync: background RealmEye polling ----
let live: LiveSync | null = null;
let cleanup: Promise<CleanupReport> | null = null;
const APP_UPDATE_EVERY_MS = 6 * 60 * 60 * 1000;
const DATA_CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * A live sync finished. Push the new state to the app, keep the overlay on the same
 * character (its key changes as fame grows), and flash its changes on the HUD.
 */
function onLiveState(state: LiveState, events: LiveEvent[], prev: PlayerProfile | null): void {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('live:state', state);
  if (!state.profile || !prev) return;

  const cur = overlayState.character;
  if (cur) overlayState.character = carryCharacter(cur, prev.characters, state.profile.characters) ?? cur;
  const key = overlayState.character ? charKey(overlayState.character) : null;
  const mine = events.filter((e) => e.charKey === '' || e.charKey === key);
  if (!mine.length) return broadcastOverlay();

  const top = mine[0]!;
  overlayState.toast = { title: top.title, detail: top.detail, more: mine.length - 1, at: Date.now() };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    overlayState.toast = null;
    broadcastOverlay();
  }, OVERLAY_TOAST_MS);
  if (overlayState.settings.peekOnChange && !overlayState.settings.enabled && overlayState.settings.widgets.liveToasts) {
    peekOverlay(OVERLAY_TOAST_MS);
  } else {
    broadcastOverlay();
  }
}

/**
 * Open/close the dungeon quick-pick menu. While open the overlay becomes interactive
 * (clickable + focusable so the search box can type); on close it reverts to click-through.
 */
function setPicker(open: boolean): void {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  overlayState.picker = open;
  if (open) {
    overlayWin.setIgnoreMouseEvents(false);
    overlayWin.setFocusable(true);
    overlayWin.show();
    overlayWin.focus();
  } else {
    overlayWin.setIgnoreMouseEvents(true, { forward: true });
    overlayWin.setFocusable(false);
    applyOverlay(); // hide again if the overlay isn't otherwise visible
  }
  broadcastOverlay();
}

/** (Re)register the customizable global hotkeys from settings. Invalid combos are skipped. */
function registerHotkeys(): void {
  globalShortcut.unregisterAll();
  refreshTray();
  const { hotkeys } = overlayState.settings;
  const bind = (accel: string, fn: () => void) => {
    if (!accel) return;
    try {
      globalShortcut.register(accel, fn);
    } catch {
      /* invalid / reserved accelerator — skip */
    }
  };
  bind(hotkeys.toggle, () => {
    toggleOverlayEnabled();
    refreshTray();
  });
  bind(hotkeys.peek, peekOverlay);
  bind(hotkeys.picker, () => setPicker(!overlayState.picker));
}

function createMainWindow(show = true): void {
  const ws = loadWindowState();
  mainWin = new BrowserWindow({
    show,
    x: ws.x,
    y: ws.y,
    width: ws.width,
    height: ws.height,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0b0d12',
    title: 'RotMG Companion',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
    },
  });
  if (ws.maximized && show) mainWin.maximize();
  // No stock File/Edit/View menu bar — the app has its own UI. Keep page zoom on Ctrl +/−/0.
  if (process.platform !== 'darwin') {
    mainWin.removeMenu();
    mainWin.webContents.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return;
      const wc = mainWin?.webContents;
      if (!wc) return;
      if (input.key === '=' || input.key === '+') wc.setZoomLevel(Math.min(wc.getZoomLevel() + 0.5, 3));
      else if (input.key === '-') wc.setZoomLevel(Math.max(wc.getZoomLevel() - 0.5, -3));
      else if (input.key === '0') wc.setZoomLevel(0);
      else return;
      e.preventDefault();
    });
  }
  rendererTarget(mainWin);
  mainWin.on('close', (e) => {
    if (mainWin) saveWindowState(mainWin);
    // Close-to-tray: keep running (overlay, live sync, game detection) until Quit.
    if (desktop.closeToTray && tray && !quitting) {
      e.preventDefault();
      mainWin?.hide();
    }
  });
  mainWin.on('closed', () => {
    mainWin = null;
    // The overlay is a hidden/always-on-top helper window with no taskbar entry, so it
    // would keep the process alive after the main window closes — tear it down too.
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.destroy();
  });
}

/** Frameless, transparent, always-on-top, click-through HUD covering the work area. */
function createOverlayWindow(): void {
  const { workArea } = screen.getPrimaryDisplay();
  overlayWin = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    show: false,
    fullscreenable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
    },
  });
  // Stay above other windows (incl. borderless-windowed games) and never grab clicks.
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  rendererTarget(overlayWin, 'overlay');
  overlayWin.on('closed', () => {
    overlayWin = null;
  });
}

// One copy at a time: a second launch would double-register the hotkeys and stack a
// second overlay. Instead, focus the window that's already open.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showMain());
  app.on('before-quit', () => {
    quitting = true;
  });
}

app.whenReady().then(() => {
  if (!gotLock) return; // a second launch only hands focus to the first one
  loadSettings();

  // Game data that updates itself: newest valid download wins over the bundled JSON.
  gameData = new GameDataUpdater(
    join(app.getPath('userData'), 'game-data'),
    bundledManifest as DataManifest,
    (s: DataStatus) => {
      if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('data:status', s);
    },
  );
  gameData.loadInstalled();
  ipcMain.handle('data:get', () => gameData!.get());
  ipcMain.handle('data:status', () => gameData!.status());
  ipcMain.handle('data:check', () => gameData!.check());
  ipcMain.handle('data:apply', () => {
    if (!gameData!.apply()) return false;
    // Reload both windows so every module re-reads the new data at startup.
    for (const w of [mainWin, overlayWin]) if (w && !w.isDestroyed()) w.webContents.reload();
    return true;
  });
  if (app.isPackaged) {
    // Installed builds check shortly after launch, then every few hours.
    setTimeout(() => void gameData!.check(), 15_000);
    setInterval(() => void gameData!.check(), DATA_CHECK_EVERY_MS);
  }

  live = new LiveSync(
    {
      fetch: fetchPlayerWithTiers,
      classMax: () => (gameData?.get()?.files['class-max-stats.json'] as ClassMaxTable | undefined) ?? (classMaxData as ClassMaxTable),
      onState: onLiveState,
      saveSettings: (s) => {
        try {
          writeFileSync(liveSettingsFile(), JSON.stringify(s));
        } catch {
          /* non-fatal */
        }
      },
    },
    readJson<LiveSettings>(liveSettingsFile()),
  );
  ipcMain.handle('live:getState', () => live!.getState());
  ipcMain.handle('live:load', (_e, name: string, force?: boolean) => live!.load(String(name ?? ''), !!force));
  ipcMain.handle('live:syncNow', () => live!.syncNow());
  ipcMain.handle('live:configure', (_e, patch: Partial<LiveSettings>) => live!.configure(patch ?? {}));
  ipcMain.handle('live:clearFeed', () => live!.clearFeed());

  // RealmEye fetch happens in the main process: no CORS, one place for the polite UA / rate-limit.
  ipcMain.handle('player:get', async (_event, name: string, force?: boolean) => {
    try {
      const profile = await fetchPlayerWithTiers(name, !!force);
      return { ok: true as const, profile };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('app:openExternal', (_e, url: string) => {
    if (typeof url !== 'string' || !EXTERNAL_ALLOW.some((re) => re.test(url))) return false;
    void shell.openExternal(url);
    return true;
  });

  // ---- overlay IPC ----
  ipcMain.handle('overlay:getState', () => overlayState);
  ipcMain.handle('overlay:setSettings', (_e, partial: Partial<OverlaySettings>) => {
    overlayState.settings = mergeOverlaySettings(overlayState.settings, partial);
    saveSettings();
    if (partial.hotkeys) registerHotkeys();
    if (partial.detectFromLog !== undefined) watcher?.configure({ detectFromLog: partial.detectFromLog });
    if (partial.hideWhenUnfocused !== undefined) {
      if (partial.hideWhenUnfocused) focus?.start();
      else focus?.stop();
    }
    applyOverlay();
    broadcastOverlay();
    if (partial.enabled !== undefined) refreshTray();
    return overlayState.settings;
  });
  // Location: a manual pick (quick-pick / app). Teaches the log watcher too.
  ipcMain.handle('overlay:setLocation', (_e, placeId: string | null) => {
    const place = placeId ? (placeIndex().byId.get(placeId) ?? null) : null;
    const res = watcher?.setManual(place) ?? { learned: false };
    overlayState.settings.currentDungeon = place?.dungeonId ?? '';
    saveSettings();
    broadcastOverlay();
    return res;
  });
  ipcMain.handle('overlay:forgetLearned', () => {
    watcher?.forgetLearned();
    return true;
  });
  ipcMain.handle('overlay:setPicker', (_e, open: boolean) => {
    setPicker(open);
    return overlayState.picker;
  });
  ipcMain.handle('overlay:setCharacter', (_e, character: Character | null) => {
    overlayState.character = character;
    broadcastOverlay();
    return true;
  });
  ipcMain.handle('overlay:toggle', () => {
    toggleOverlayEnabled();
    refreshTray();
    return overlayState.settings.enabled;
  });

  desktop = { ...DEFAULT_DESKTOP_SETTINGS, ...readJson<DesktopSettings>(desktopSettingsFile()) };
  ipcMain.handle('app:getDesktop', () => desktop);
  ipcMain.handle('app:setDesktop', (_e, patch: Partial<DesktopSettings>) => {
    desktop = { ...desktop, ...patch };
    try {
      writeFileSync(desktopSettingsFile(), JSON.stringify(desktop, null, 2));
    } catch {
      /* non-fatal */
    }
    applyDesktop();
    return desktop;
  });
  applyDesktop();
  void createTray();

  // Started by Windows with "start hidden": live in the tray until opened.
  createMainWindow(!(launchedHidden && desktop.closeToTray));
  createOverlayWindow();
  startGameWatch();
  applyOverlay();
  registerHotkeys();

  // Auto-update from GitHub Releases (packaged builds only). Downloads a newer version
  // in the background and installs it on quit; checks again every few hours since the
  // app stays open for days. Errors (offline etc.) are non-fatal.
  if (app.isPackaged) {
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('error', () => {});
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    setInterval(() => void autoUpdater.checkForUpdates().catch(() => {}), APP_UPDATE_EVERY_MS);
  }

  // First launch of a new version: move old copies off the Desktop (Recycle Bin) and prune
  // installers the updater already applied. Once per version; Settings can re-run it.
  cleanup = tidyOldCopies().catch((err) => ({
    version: app.getVersion(),
    at: Date.now(),
    ran: false,
    removed: [],
    prunedInstallers: 0,
    errors: [String(err)],
  }));
  ipcMain.handle('app:cleanupReport', () => cleanup);
  ipcMain.handle('app:tidyNow', () => (cleanup = tidyOldCopies(true)));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createOverlayWindow();
      applyOverlay();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  live?.stop();
  watcher?.stop();
  focus?.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
