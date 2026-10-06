import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { OverlayApp } from './OverlayApp';
import './styles/index.css';

const isOverlay = window.location.hash.replace('#', '') === 'overlay';
if (isOverlay) document.body.classList.add('overlay-mode');

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isOverlay ? <OverlayApp /> : <App />}</React.StrictMode>,
);
