/**
 * Shared polish: every page speaks the same language as the Dashboard Files
 * tab — one near-black tier from the sa-* tokens, rounded-full controls, no
 * stacked borders, subtle foreground hovers, and the sq-tab-enter motion.
 * Appended last in each page's <style> so it overrides legacy boxy rules.
 */
export const PAGES_POLISH = `
/* ── one tier: the same tokens the Files tab uses ─────────────── */
.au-stage, .tv-root, .dv-root {
  background: var(--sa-bg, #0c0d09) !important;
  color: var(--sa-text, #e8e7e1) !important;
  font-family: var(--sa-f, -apple-system, system-ui, sans-serif) !important;
  -webkit-font-smoothing: antialiased;
}

/* No white surfaces or tints anywhere. */
.au-stage :is([class*="bg-card"], [class*="bg-white"], [class*="bg-background/95"]),
.tv-root :is([class*="bg-card"], [class*="bg-white"], [class*="bg-background/95"]),
.dv-root :is([class*="bg-card"], [class*="bg-white"], [class*="bg-background/95"]) {
  background: var(--sa-bg-2, rgba(24,26,23,.7)) !important;
}

/* ── no boxes: strip borders/shadows, keep one hairline where needed ── */
.au-stage *, .tv-root *, .dv-root * { box-shadow: none !important; }
.au-vessel, .au-status-box, .tv-metrics, .tv-grid-2, .dv-form, .dv-col, .dv-docs,
.tv-root [class*="rounded-2xl"], .tv-root [class*="rounded-3xl"] {
  border: 0 !important; background: transparent !important;
}

/* Inputs: bare underline, like the Files tab's inline fields. */
.au-field, .tv-input, .dv-ep, .dv-inline input, .dv-form input {
  border: 0 !important; border-bottom: 1px solid var(--sa-line, rgba(232,231,225,.1)) !important;
  border-radius: 0 !important; background: transparent !important;
  padding: 12px 2px !important; color: var(--sa-text, #e8e7e1) !important;
}
.au-field:focus-within, .tv-input:focus, .dv-ep:focus, .dv-form input:focus {
  border-bottom-color: var(--sa-rim, rgba(232,231,225,.2)) !important; outline: none !important;
}

/* ── floating dock controls: rounded-full with the Files-tab hover ──── */
.au-top-dock, .tv-hud, .dv-dock {
  display: flex !important; align-items: center !important; gap: 6px !important;
  padding: 5px !important; border: 1px solid var(--sa-line, rgba(232,231,225,.1)) !important;
  border-radius: 999px !important; background: var(--sa-bg-2, rgba(24,26,23,.7)) !important;
  -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);
}
.au-top-pill, .tv-pill-btn, .dv-dock-btn {
  border: 0 !important; background: transparent !important; border-radius: 999px !important;
  color: var(--sa-mute, rgba(232,231,225,.55)) !important; cursor: pointer;
  transition: background .15s ease, color .15s ease, transform .12s ease !important;
}
.au-top-pill:hover, .tv-pill-btn:hover, .dv-dock-btn:hover {
  background: rgba(232,231,225,.07) !important; color: var(--sa-text, #e8e7e1) !important;
}
.au-top-pill:active, .tv-pill-btn:active, .dv-dock-btn:active { transform: scale(.97) !important; }
.au-top-sep { width: 1px !important; height: 18px !important; background: var(--sa-line, rgba(232,231,225,.1)) !important; }

/* ── one leading element ───────────────────────────────────────── */
.au-head-minimal, .tv-root h1, .dv-root h1 {
  font-size: clamp(28px, 5vw, 44px) !important; font-weight: 300 !important;
  letter-spacing: -.035em !important; line-height: 1.05 !important;
  color: var(--sa-text, #e8e7e1) !important;
}

/* segmented control — one floating pill */
.au-seg { border: 0 !important; border-radius: 999px !important; background: rgba(232,231,225,.05) !important; padding: 4px !important; }
.au-seg-thumb { border-radius: 999px !important; background: rgba(232,231,225,.12) !important; }
.au-seg-btn { color: var(--sa-mute, rgba(232,231,225,.55)) !important; }
.au-seg-btn[data-on="true"] { color: var(--sa-text, #e8e7e1) !important; }

/* primary buttons — neutral, never green */
.au-form button[type="submit"], .tv-root .lead, .dv-root .lead,
[class*="mfa"] button[type="submit"] {
  background: rgba(232,231,225,.1) !important; color: var(--sa-text, #e8e7e1) !important;
  border: 0 !important; border-radius: 999px !important;
}
.au-form button[type="submit"]:hover, [class*="mfa"] button[type="submit"]:hover {
  background: rgba(232,231,225,.16) !important;
}
[class*="bg-emerald"], [class*="bg-green"], [class*="text-emerald"], [class*="text-green"] {
  background: rgba(232,231,225,.1) !important; color: var(--sa-text, #e8e7e1) !important;
}

/* ── Files-tab motion: one authored entrance, nothing more ─────── */
.au-vessel, .tv-dock-wrap, .dv-dock-wrap { animation: sq-tab-in .18s cubic-bezier(.16,1,.3,1) both !important; }
@media (prefers-reduced-motion: reduce) {
  .au-vessel, .tv-dock-wrap, .dv-dock-wrap { animation: none !important; }
}

/* breathing room: one calm column, never a cramped box */
.au-stage { align-content: center !important; }
.au-vessel { width: min(420px, 92vw) !important; margin: 0 auto !important; }
.au-form { gap: 14px !important; margin-top: 26px !important; }
.au-oauth { gap: 8px !important; margin-top: 18px !important; }
.au-legal { margin-top: 24px !important; }
`;
