import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { PlayerProfile, Character } from '../shared/types';
import type { OverlaySettings, OverlayState } from '../shared/overlay';
import type { LiveSettings, LiveState } from '../shared/live';
import type { DataBundle, DataStatus } from '../shared/gameDataBundle';
import type { CleanupReport } from '../main/cleanupRules';
import type { DesktopSettings } from '../shared/desktop';

export type GetPlayerResult =
  | { ok: true; profile: PlayerProfile | null }
  | { ok: false; error: string };

const api = {
  getPlayer: (name: string, force = false): Promise<GetPlayerResult> => ipcRenderer.invoke('player:get', name, force),
  /** Open a RealmEye / project link in the user's browser (main allow-lists the URL). */
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('app:openExternal', url),
  /** App housekeeping: the one-time Desktop tidy-up after an update. */
  app: {
    cleanupReport: (): Promise<CleanupReport> => ipcRenderer.invoke('app:cleanupReport'),
    tidyNow: (): Promise<CleanupReport> => ipcRenderer.invoke('app:tidyNow'),
    /** Tray + Windows startup preferences. */
    getDesktop: (): Promise<DesktopSettings> => ipcRenderer.invoke('app:getDesktop'),
    setDesktop: (patch: Partial<DesktopSettings>): Promise<DesktopSettings> => ipcRenderer.invoke('app:setDesktop', patch),
  },
  /** Self-updating game data (drop tables, meta, sets…) pulled from the repo. */
  data: {
    /** The downloaded bundle in use, or null → use the bundled JSON. */
    get: (): Promise<DataBundle | null> => ipcRenderer.invoke('data:get'),
    status: (): Promise<DataStatus> => ipcRenderer.invoke('data:status'),
    check: (): Promise<DataStatus> => ipcRenderer.invoke('data:check'),
    apply: (): Promise<boolean> => ipcRenderer.invoke('data:apply'),
    onStatus: (cb: (s: DataStatus) => void): (() => void) => {
      const h = (_e: IpcRendererEvent, s: DataStatus) => cb(s);
      ipcRenderer.on('data:status', h);
      return () => ipcRenderer.removeListener('data:status', h);
    },
  },
  /** Live sync: background RealmEye polling + change feed (main process owns the timer). */
  live: {
    getState: (): Promise<LiveState> => ipcRenderer.invoke('live:getState'),
    load: (name: string, force = false): Promise<GetPlayerResult> => ipcRenderer.invoke('live:load', name, force),
    syncNow: (): Promise<LiveState> => ipcRenderer.invoke('live:syncNow'),
    configure: (patch: Partial<LiveSettings>): Promise<LiveState> => ipcRenderer.invoke('live:configure', patch),
    clearFeed: (): Promise<LiveState> => ipcRenderer.invoke('live:clearFeed'),
    onState: (cb: (s: LiveState) => void): (() => void) => {
      const h = (_e: IpcRendererEvent, s: LiveState) => cb(s);
      ipcRenderer.on('live:state', h);
      return () => ipcRenderer.removeListener('live:state', h);
    },
  },
  overlay: {
    getState: (): Promise<OverlayState> => ipcRenderer.invoke('overlay:getState'),
    setSettings: (s: Partial<OverlaySettings>): Promise<OverlaySettings> =>
      ipcRenderer.invoke('overlay:setSettings', s),
    setCharacter: (c: Character | null): Promise<boolean> => ipcRenderer.invoke('overlay:setCharacter', c),
    toggle: (): Promise<boolean> => ipcRenderer.invoke('overlay:toggle'),
    setPicker: (open: boolean): Promise<boolean> => ipcRenderer.invoke('overlay:setPicker', open),
    /** Set where you are (place id from locations/dungeons, or null to clear). */
    setLocation: (placeId: string | null): Promise<{ learned: boolean }> => ipcRenderer.invoke('overlay:setLocation', placeId),
    /** Forget the log formats learned on this PC. */
    forgetLearned: (): Promise<boolean> => ipcRenderer.invoke('overlay:forgetLearned'),
    /** Subscribe to pushed state (settings/character changes, hotkey toggles). Returns an unsubscribe. */
    onState: (cb: (s: OverlayState) => void): (() => void) => {
      const h = (_e: IpcRendererEvent, s: OverlayState) => cb(s);
      ipcRenderer.on('overlay:state', h);
      return () => ipcRenderer.removeListener('overlay:state', h);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
