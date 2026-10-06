/** How the app lives on the desktop (tray, Windows startup). Stored in userData/desktop-settings.json. */
export interface DesktopSettings {
  /** Closing the window keeps the app (and the overlay) running in the tray. */
  closeToTray: boolean;
  /** Launch when Windows starts. */
  startWithWindows: boolean;
  /** When started with Windows, stay in the tray instead of opening the window. */
  startHidden: boolean;
}

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  closeToTray: false,
  startWithWindows: false,
  startHidden: true,
};
