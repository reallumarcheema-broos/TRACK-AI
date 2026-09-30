import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initInstall } from './pwa/install';
import './styles.css';

// Catch the browser's install offer before React renders the "Install on Android" button.
initInstall();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support for the installed app (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
