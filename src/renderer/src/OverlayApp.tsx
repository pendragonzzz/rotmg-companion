import { useEffect, useState } from 'react';
import { OverlayHud } from './components/OverlayHud';
import { DungeonPicker } from './components/DungeonPicker';
import { DEFAULT_OVERLAY_SETTINGS, type OverlayState } from '../../shared/overlay';

/** Root rendered in the transparent, click-through overlay window. */
export function OverlayApp() {
  const [state, setState] = useState<OverlayState>({
    settings: DEFAULT_OVERLAY_SETTINGS,
    character: null,
    peek: false,
    picker: false,
    toast: null,
  });

  useEffect(() => {
    window.api.overlay.getState().then(setState).catch(() => {});
    return window.api.overlay.onState(setState);
  }, []);

  // Match the main window's theme (pushed through the overlay settings).
  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);

  const visible = state.settings.enabled || state.peek;
  if (!visible && !state.picker) return null;

  return (
    <>
      {visible && (
        <div className={`ov-root corner-${state.settings.corner}`}>
          <OverlayHud character={state.character} settings={state.settings} toast={state.toast} />
        </div>
      )}
      {state.picker && (
        <DungeonPicker
          settings={state.settings}
          character={state.character}
          onClose={() => window.api.overlay.setPicker(false).catch(() => {})}
        />
      )}
    </>
  );
}
