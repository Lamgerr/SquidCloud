
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './pwaInstall.ts';
import { squidguard } from './services/squidguard-shield';
import { ErrorBoundary } from './components/ErrorBoundary';

const isDev = import.meta.env.DEV;

if (import.meta.env.PROD) {
  console.log = () => {};
  console.debug = () => {};
}

squidguard.configure({
  frictionOnDevtools: true,
  consoleWarnings: true,
  tokenProtection: true,
});

// Disable pinch-zoom only
document.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}, { passive: false });

// Register the service worker for PWA support
registerServiceWorker()
  .then(() => {
    if (isDev) {
      console.log('Service Worker registered successfully');
    }
  })
  .catch(error => {
    console.error('Service Worker registration failed:', error);
  });

// Surface fatal errors instead of a silent blank page (critical for the native/APK build,
// where a single thrown error in a deep component otherwise unmounts the whole tree).
function showFatalOverlay(message: string) {
  if (document.getElementById('fatal-error-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'fatal-error-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;background:#0f172a;color:#e2e8f0;' +
    'font:13px/1.5 ui-monospace,monospace;padding:24px;overflow:auto;white-space:pre-wrap;word-break:break-word;';
  overlay.textContent =
    'SquidCloud failed to start.\n\n' + message + '\n\nPlease report this message to the developer.';
  document.body.appendChild(overlay);
}

window.addEventListener('error', (event) => {
  // Ignore resource load failures (e.g. a broken <img>/<script>); only surface script errors.
  if (!event.message) return;
  const detail = (event.error && (event.error.stack || event.error.message)) || event.message;
  console.error('[fatal]', detail);
  showFatalOverlay(String(detail));
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const detail = (reason && (reason.stack || reason.message)) || String(reason);
  console.error('[fatal]', detail);
  showFatalOverlay(String(detail));
});

// Initialize the root and render the application
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
