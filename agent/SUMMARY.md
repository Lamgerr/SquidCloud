# What happened while you were away

## Done
- **Instant preview modal** — all on-screen chrome removed. There is now a single floating dock (bottom-right) with just **minimize + close**, grainy + translucent + springy. On open it is visible for **2s**, then springs/submerges into the corner leaving a peek; hover the corner or drag the dock to pull it back out.
- **Minimized preview tabs** — replaced the old fanned circles with a **deck of glassy, grain-textured picking cards**. Tight fan when idle; hover fans them apart with spring physics and reveals each card's type glyph, name and close. Drag a card out to dismiss it, click to restore. Quiet hide-all / close-all pill on hover, small restore badge when hidden.
- **Command palette** — denser, more-opaque frosted glass with a two-frequency **nano-texture grain** (mid fractal + fine high-frequency), hairline rim and deep shadow. Reads premium and translucent, not a thin see-through sheet.
- Updated `docs/UI-UX-STANDARD.md`. Committed as `79ae2745`. Deployed to Vercel — **READY** at `https://cloudbliss-storage-qzb1fg0lk-sqc.vercel.app`.

## In progress
- Nothing actively being edited. Awaiting your visual verification.

## Blocked / needs a decision
- Local `npx tsc --noEmit` is unavailable here; Vercel's cloud build is the verification authority.
- Old AI-created files made before the key-vault fix can still display base64 gibberish (new files use the fixed vault path).
- The gibberish seen in `911_essay.md` is one of those pre-fix files, not a preview-renderer bug.

## Queued next
- If the submerge peek is too small/large or the spring feels off, send a screenshot and tune `x/y` submerge % + spring stiffness in `EnhancedInstantPreviewModal.tsx`.
- If the card deck feels cramped or the grain too strong, tune `pvs-card` height / grain opacity in `PreviewTabStack.tsx` and the NANO layer slopes in `CommandPalette.tsx`.
