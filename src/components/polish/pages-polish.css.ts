/**
 * Shared consistency layer for AccountSettings and DeveloperAPI.
 * It does NOT flatten the pages — the glass depth (inset highlight, rim,
 * lifted shadow) is kept. It only aligns tokens, type, focus and motion to
 * the same vocabulary used by EnterpriseSidebar and the auth stage.
 * Appended last in each page's <style> so it wins over legacy rules.
 */
export const PAGES_POLISH = `
/* ── one palette: the dashboard's green-tinted near-black ───────── */
.tv-root, .dv-root {
  background: var(--sa-bg, #090b0a) !important;
  background-image: none !important;
  color: var(--sa-text, #e8e7e1) !important;
  font-family: var(--sa-f, -apple-system, system-ui, sans-serif) !important;
  -webkit-font-smoothing: antialiased;
}

/* Neutralize accidental white surfaces, but keep legitimate glass. */
.tv-root :is([class*="bg-white"], [class*="bg-card"]),
.dv-root :is([class*="bg-white"], [class*="bg-card"]) {
  background: var(--sa-bg-3, #141816) !important;
}

/* Green is for status only, never for primary actions. */
.tv-root :is([class*="bg-emerald"], [class*="bg-green"], [class*="text-emerald"], [class*="text-green"]),
.dv-root :is([class*="bg-emerald"], [class*="bg-green"], [class*="text-emerald"], [class*="text-green"]) {
  background: rgba(232,231,225,.08) !important;
  color: var(--sa-text, #e8e7e1) !important;
  border-color: var(--sa-line, #1f2221) !important;
}

/* ── inputs: a single hairline, brightening on focus ────────────── */
.tv-input, .dv-ep, .dv-inline input, .dv-form input {
  border: 0 !important;
  border-bottom: 1px solid var(--sa-line, #1f2221) !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: var(--sa-text, #e8e7e1) !important;
}
.tv-input:focus, .dv-ep:focus, .dv-inline input:focus, .dv-form input:focus {
  border-bottom-color: var(--sa-text, #e8e7e1) !important;
  outline: none !important;
}

/* ── glass docks: EnterpriseSidebar depth recipe ────────────────── */
.tv-dock, .dv-dock {
  background: linear-gradient(180deg, var(--sa-bg-4, #1b201d), var(--sa-bg-2, #0e1110)) !important;
  border: 1px solid var(--sa-line, #1f2221) !important;
  box-shadow: inset 0 1px 0 rgba(232,231,225,.08),
              0 24px 54px -18px rgba(0,0,0,.85) !important;
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  backdrop-filter: blur(24px) saturate(150%);
}
.tv-dock-thumb, .dv-dock-thumb, .dv-doc-thumb {
  background: linear-gradient(180deg, var(--sa-bg-4, #1b201d), var(--sa-bg-3, #141816)) !important;
  border: 1px solid rgba(232,231,225,.1) !important;
  box-shadow: inset 0 1px 0 rgba(232,231,225,.08),
              0 6px 18px -6px rgba(0,0,0,.55) !important;
}
.tv-dock-item, .dv-dock-btn { color: var(--sa-mute, #8d8f89) !important; }
.tv-dock-item:hover, .dv-dock-btn:hover,
.tv-dock-item[aria-selected="true"], .dv-dock-btn[aria-selected="true"] {
  color: var(--sa-text, #e8e7e1) !important;
}

/* ── one type scale, one focus treatment ────────────────────────── */
.tv-root h1, .dv-root h1, .tv-title {
  font-weight: 300 !important;
  letter-spacing: -.035em !important;
  line-height: 1.05 !important;
  color: var(--sa-text, #e8e7e1) !important;
}
.tv-root :is(button, a, [role="tab"]):focus-visible,
.dv-root :is(button, a, [role="tab"]):focus-visible {
  outline: 1px solid var(--sa-accent, #e8e7e1) !important;
  outline-offset: 2px !important;
}
.tv-root :is(button, a), .dv-root :is(button, a) {
  transition-duration: .18s !important;
}

/* ── one authored entrance, no stacked motion ───────────────────── */
.tv-dock-wrap, .dv-dock-wrap { animation: sq-tab-in .18s cubic-bezier(.16,1,.3,1) both !important; }
@media (prefers-reduced-motion: reduce) {
  .tv-dock-wrap, .dv-dock-wrap { animation: none !important; }
}

/* The global ambient wash is viewport-fixed; on long settings pages it ends
   at 100vh and leaves a horizontal seam. Settings paint their own wash. */
html.sq-app-root:has(.tv-root) body::before,
html.sq-app-root:has(.dv-root) body::before { display: none !important; }
html.sq-app-root .sa:has(.tv-root), html.sq-app-root .sa:has(.dv-root) {
  background: var(--sa-bg, #090b0a) !important;
}
/* No enclosing rectangle around the settings rail, at any width. */
html.sq-app-root .tv-rail {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}
`;
