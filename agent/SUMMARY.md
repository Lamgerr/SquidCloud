# What happened while you were away

## Done
- **Instant preview modal** — replaced with your newest file (`EnhancedInstantPreviewModal.tsx-new`, 15:27). The dock now reuses the dashboard dock's own `DOCK_CSS` / `Icons` so it looks and sits identically (two 52px faces, 10px gap, 20px from the corner), with a new `edge` mode that parks it right-centre for encrypted video so it avoids the player controls. Jelly physics, magnetism, 2s throw into the wall all retained.
- **Command palette scope card** — the card that opens below the search (files / commands / AI) now has real translucency + nano grain. Root cause: the AI `background` shorthand was wiping the grain layers from `.spot-glass`. Fixed with explicit translucent frosted body + a grain veil on the clip.
- **AI** — added a **live context strip** (pulsing dot, current file / type / folder / selection) and the answer now **streams word-by-word in an animated blue gradient** with a glowing caret while loading.
- Updated `docs/UI-UX-STANDARD.md`. Committed `84371f49`. Deployed — **READY** at `https://cloudbliss-storage-ock0qowz2-sqc.vercel.app`.

## In progress
- Nothing actively being edited. Awaiting your visual verification.

## Blocked / needs a decision
- No local `tsc` here; Vercel's cloud build passed and is the verification authority.

## Queued next
- Tune the blue gradient intensity / caret, or the dock's edge placement, from screenshots if the feel is off.
