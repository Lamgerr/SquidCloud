/** Shared nano-grain + frosted-glass tokens: preview dock, minimized card stack, command palette. */
export const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/** Drop a <span className="sq-grain" /> as the last child of any glass surface. */
export const GRAIN_CSS = `
.pv-grain, .sq-grain { position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background-image: ${GRAIN_BG}; background-size: 160px 160px; opacity: .14; mix-blend-mode: overlay; }`;

/** Command palette surface: denser (less see-through), heavily frosted, hairline highlight instead of a border. */
export const GLASS_CSS = `
.sq-glass { position: relative; isolation: isolate; overflow: hidden; border-radius: 20px;
  background: linear-gradient(180deg, rgba(36,37,33,.84), rgba(16,17,14,.9));
  -webkit-backdrop-filter: blur(44px) saturate(180%); backdrop-filter: blur(44px) saturate(180%);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.14), inset 0 0 0 1px rgba(232,231,225,.05),
    0 44px 90px -32px rgba(0,0,0,.85), 0 10px 28px -14px rgba(0,0,0,.6); }
.sq-glass .sq-grain { opacity: .16; z-index: 0; }
.sq-glass > *:not(.sq-grain) { position: relative; z-index: 1; }`;
