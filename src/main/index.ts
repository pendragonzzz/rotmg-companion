import { app, BrowserWindow, ipcMain, globalShortcut, screen, shell } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import electronUpdater from 'electron-updater';
import { fetchPlayer } from '../shared/realmeye';
import { LiveSync } from './liveSync';
import { carryCharacter, charKey, type LiveEvent, type LiveSettings, type LiveState } from '../shared/live';
import type { ClassMaxTable } from '../shared/engine';
import classMaxData from '../shared/data/class-max-stats.json';
import bundledManifest from '../shared/data/data-manifest.json';
import { GameDataUpdater } from './gameDataUpdater';
import { tidyOldCopies, type CleanupReport } from './cleanup';
import type { DataManifest, DataStatus } from '../shared/gameDataBundle';

const { autoUpdater } = electronUpdater;
import type { Character, PlayerProfile } from '../shared/types';
import {
  DEFAULT_OVERLAY_SETTINGS,
  OVERLAY_TOAST_MS,
  mergeOverlaySettings,
  type OverlaySettings,
  type OverlayState,
} from '../shared/overlay';

let mainWin: BrowserWindow | null = null;
let overlayWin: BrowserWindow | null = null;
let peekTimer: NodeJS.Timeout | null = null;
let toastTimer: NodeJS.Timeout | null = null;
const overlayState: OverlayState = {
  settings: { ...DEFAULT_OVERLAY_SETTINGS },
  character: null,
  peek: false,
  picker: false,
  toast: null,
};

const settingsFile = () => join(app.getPath('userData'), 'overlay-settings.json');
const windowStateFile = () => join(app.getPath('userData'), 'window-state.json');
const liveSettingsFile = () => join(app.getPath('userData'), 'live-settings.json');

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
    overlayState.settings = mergeOverlaySettings(DEFAULT_OVERLAY_SETTINGS, JSON.parse(raw));
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

function applyOverlay(): void {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  if (overlayState.settings.enabled || overlayState.peek) overlayWin.showInactive();
  else overlayWin.hide();
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
let gameData: GameDataUpdater | null = null;
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
    overlayState.settings.enabled = !overlayState.settings.enabled;
    saveSettings();
    applyOverlay();
    broadcastOverlay();
  });
  bind(hotkeys.peek, peekOverlay);
  bind(hotkeys.picker, () => setPicker(!overlayState.picker));
}

function createMainWindow(): void {
  const ws = loadWindowState();
  mainWin = new BrowserWindow({
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
  if (ws.maximized) mainWin.maximize();
  rendererTarget(mainWin);
  mainWin.on('close', () => mainWin && saveWindowState(mainWin));
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
  app.on('second-instance', () => {
    if (!mainWin) return;
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.show();
    mainWin.focus();
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
      fetch: fetchPlayer,
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
      const profile = await fetchPlayer(name, !!force);
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
    applyOverlay();
    if (partial.hotkeys) registerHotkeys();
    broadcastOverlay();
    return overlayState.settings;
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
    overlayState.settings.enabled = !overlayState.settings.enabled;
    saveSettings();
    applyOverlay();
    broadcastOverlay();
    return overlayState.settings.enabled;
  });

  createMainWindow();
  createOverlayWindow();
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
