/// <reference types="vite/client" />
import type { Api } from '../../preload/index';

declare global {
  interface Window {
    api: Api;
  }
  /** Injected at build time from package.json (electron.vite.config define). */
  const __APP_VERSION__: string;
}

export {};
