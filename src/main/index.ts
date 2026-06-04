import { app, BrowserWindow, ipcMain, globalShortcut, screen } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchPlayer } from '../shared/realmeye';
import type { Character } from '../shared/types';
import {
  DEFAULT_OVERLAY_SETTINGS,
  OVERLAY_PEEK_MS,
  type OverlaySettings,
  type OverlayState,
} from '../shared/overlay';

let mainWin: BrowserWindow | null = null;
let overlayWin: BrowserWindow | null = null;
let peekTimer: NodeJS.Timeout | null = null;
const overlayState: OverlayState = {
  settings: { ...DEFAULT_OVERLAY_SETTINGS },
  character: null,
  peek: false,
  picker: false,
};

const settingsFile = () => join(app.getPath('userData'), 'overlay-settings.json');

function loadSettings(): void {
  try {
    const raw = readFileSync(settingsFile(), 'utf-8');
    overlayState.settings = { ...DEFAULT_OVERLAY_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* first run — keep defaults */
  }
}
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
function peekOverlay(): void {
  if (peekTimer) clearTimeout(peekTimer);
  overlayState.peek = true;
  applyOverlay();
  broadcastOverlay();
  peekTimer = setTimeout(() => {
    overlayState.peek = false;
    applyOverlay();
    broadcastOverlay();
  }, OVERLAY_PEEK_MS);
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
  mainWin = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b0d12',
    title: 'RotMG Companion',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
    },
  });
  rendererTarget(mainWin);
  mainWin.on('closed', () => {
    mainWin = null;
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

app.whenReady().then(() => {
  loadSettings();

  // RealmEye fetch happens in the main process: no CORS, one place for the polite UA / rate-limit.
  ipcMain.handle('player:get', async (_event, name: string) => {
    try {
      const profile = await fetchPlayer(name);
      return { ok: true as const, profile };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ---- overlay IPC ----
  ipcMain.handle('overlay:getState', () => overlayState);
  ipcMain.handle('overlay:setSettings', (_e, partial: Partial<OverlaySettings>) => {
    overlayState.settings = { ...overlayState.settings, ...partial };
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createOverlayWindow();
      applyOverlay();
    }
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
