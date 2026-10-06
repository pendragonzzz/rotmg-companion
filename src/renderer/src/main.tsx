import React from 'react';
import { createRoot } from 'react-dom/client';
import { installGameData } from './gameData';
import './styles/index.css';

const isOverlay = window.location.hash.replace('#', '') === 'overlay';
if (isOverlay) document.body.classList.add('overlay-mode');

/**
 * Boot: adopt downloaded game data (if the main process has a newer valid bundle)
 * BEFORE the app modules load, so their data-derived caches use it. The app itself is
 * imported dynamically for exactly that reason.
 */
async function boot() {
  try {
    const bundle = await window.api.data.get();
    if (bundle) installGameData(bundle);
  } catch {
    /* fall back to the bundled data */
  }
  const root = createRoot(document.getElementById('root')!);
  if (isOverlay) {
    const { OverlayApp } = await import('./OverlayApp');
    root.render(
      <React.StrictMode>
        <OverlayApp />
      </React.StrictMode>,
    );
  } else {
    const { App } = await import('./App');
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  }
}

void boot();
