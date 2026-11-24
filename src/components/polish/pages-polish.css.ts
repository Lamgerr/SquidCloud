/**
 * tvOS-grade polish for Auth, AccountSettings and DeveloperAPI.
 * Scoped overrides only — no color changes to document content, no white tints.
 * Uses the shared sa-* tokens and the floating-dock language.
 */
export const PAGES_POLISH = `
/* ---- Liquid glass surface used by all three pages ---- */
.au-card, .st-df, .dv-col > .sa-panel, .dv-bar, .st-panel,
.sa-panel, .st-glass, .dv-glass {
  background: linear-gradient(180deg, rgba(30,31,28,.72), rgba(14,15,13,.82)) !important;
  border: 1px solid rgba(232,231,225,.10) !important;
  -webkit-backdrop-filter: blur(28px) saturate(150%); backdrop-filter: blur(28px) saturate(150%);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.09), 0 24px 60px -28px rgba(0,0,0,.85) !important;
  border-radius: 24px !important;
}

/* ---- Floating grouped dock for button clusters ---- */
.au .sa-btn, .st-df .sa-btn, .dv-bar .sa-btn {
  border-radius: 999px !important;
  transition: transform .45s cubic-bezier(.34,1.4,.64,1), background .2s, box-shadow .2s !important;
}
.au .sa-btn:hover, .st-df .sa-btn:hover, .dv-bar .sa-btn:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 12px 24px -14px rgba(0,0,0,.8);
}
.au .sa-btn:active, .st-df .sa-btn:active, .dv-bar .sa-btn:active {
  transform: scale(.96, .9);
}

/* ---- Inputs: calm, rounded, no white ---- */
.au .sa-input, .st-df .sa-input, .dv-col .sa-input,
.st-df input, .dv-col input, .au input {
  border-radius: 14px !important;
  background: rgba(232,231,225,.04) !important;
  border: 1px solid rgba(232,231,225,.1) !important;
  transition: border-color .2s, box-shadow .3s, transform .3s cubic-bezier(.34,1.4,.64,1) !important;
}
.au .sa-input:focus, .st-df .sa-input:focus, .dv-col .sa-input:focus,
.st-df input:focus, .dv-col input:focus, .au input:focus {
  border-color: rgba(232,231,225,.28) !important;
  box-shadow: 0 0 0 3px rgba(232,231,225,.05) !important;
  outline: none;
}

/* ---- Section headings: quiet, spaced, tvOS-like ---- */
.au-h, .st-df h1, .st-df h2, .dv-bar h1, .dv-bar h2 {
  letter-spacing: -.03em !important;
  font-weight: 300 !important;
}
.au-eyebrow, .st-df .sa-label, .dv-bar .sa-label {
  letter-spacing: .14em !important;
  font-size: 10px !important;
  opacity: .7 !important;
}

/* ---- Panels enter with a gentle spring ---- */
.au-main, .st-df, .dv-split {
  animation: pg-rise .55s cubic-bezier(.22,1,.36,1) both;
}
@keyframes pg-rise { from { opacity: 0; transform: translateY(14px) scale(.99); } to { opacity: 1; transform: none; } }

/* ---- Grain veil on the auth side panel ---- */
.au-side::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .12;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ---- No white pills anywhere in these pages ---- */
.au .sa-btn[data-variant="default"], .st-df .sa-btn[data-variant="default"], .dv-bar .sa-btn[data-variant="default"] {
  background: rgba(232,231,225,.14) !important; color: #e8e7e1 !important;
  border: 1px solid rgba(232,231,225,.12) !important;
}

@media (prefers-reduced-motion: reduce) {
  .au-main, .st-df, .dv-split { animation: none !important; }
  .au .sa-btn, .st-df .sa-btn, .dv-bar .sa-btn { transition-duration: .01ms !important; }
}
`;
