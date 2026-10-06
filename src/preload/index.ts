import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { PlayerProfile, Character } from '../shared/types';
import type { OverlaySettings, OverlayState } from '../shared/overlay';
import type { LiveSettings, LiveState } from '../shared/live';

export type GetPlayerResult =
  | { ok: true; profile: PlayerProfile | null }
  | { ok: false; error: string };

const api = {
  getPlayer: (name: string, force = false): Promise<GetPlayerResult> => ipcRenderer.invoke('player:get', name, force),
  /** Open a RealmEye / project link in the user's browser (main allow-lists the URL). */
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('app:openExternal', url),
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
