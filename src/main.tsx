
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

// Self-heal from stale-deployment module failures. After a new production deploy, a tab
// that was already open can still reference chunk hashes that have since been purged from
// the server, which makes lazy imports (e.g. the Monaco code editor) throw
// "Failed to load dynamically imported module". Reloading once with a cache-bust lets the
// page fetch the current, healthy bundle instead of stranding the user on a dead tab.
const MODULE_LOAD_FAIL = /Failed to (load|fetch) dynamically imported module|Importing a module script failed|Failed to fetch.*module/i;

function tryRecoverModuleLoad(message: string): boolean {
  if (!MODULE_LOAD_FAIL.test(message)) return false;
  const KEY = 'sc_module_recover';
  try {
    if (sessionStorage.getItem(KEY)) return false; // already attempted this session; don't loop
    sessionStorage.setItem(KEY, '1');
  } catch {
    // ignore storage errors (private mode etc.)
  }
  const url = new URL(window.location.href);
  url.searchParams.set('cache_bust', Date.now().toString());
  window.location.href = url.toString();
  return true;
}

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

// Browser extensions inject scripts into the page and can throw their own errors
// (e.g. `chrome-extension://.../executors/*.js`). Those must never be reported as
// app startup failures — ignore them unless the app's own code is also implicated.
const EXTENSION_URL = /(chrome-extension|moz-extension|safari-extension|edge-extension):\/\//i;

function isExtensionNoise(detail: string, filename?: string): boolean {
  if (filename && EXTENSION_URL.test(filename)) return true;
  if (!EXTENSION_URL.test(detail)) return false;
  try {
    // Genuine app errors reference the app's own origin in the stack.
    return !detail.includes(window.location.origin);
  } catch {
    return true;
  }
}

window.addEventListener('error', (event) => {
  if (!event.message) return;
  // Firefox false-positive: dynamic import failures can fire on the main script tag.
  // If the app is already running, resource errors without a real script error are
  // likely false-positives from Firefox's buggy event attribution.
  if (!event.error && /Failed to (load|fetch) resource/i.test(event.message)) return;
  const detail = (event.error && (event.error.stack || event.error.message)) || event.message;
  if (isExtensionNoise(String(detail), event.filename)) return;
  console.error('[fatal]', detail);
  if (tryRecoverModuleLoad(String(detail))) return;
  showFatalOverlay(String(detail));
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const detail = (reason && (reason.stack || reason.message)) || String(reason);
  if (isExtensionNoise(String(detail))) return;
  console.error('[fatal]', detail);
  if (tryRecoverModuleLoad(String(detail))) return; // stale-deploy recovery: reload once
  showFatalOverlay(String(detail));
});

// Initialize the root and render the application
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
