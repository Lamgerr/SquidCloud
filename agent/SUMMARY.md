# What happened while you were away

## Done
- **PDF viewer replaced with a Folio-based engine.** Folio (`owenpkent/folio`, MIT) is a Tauri desktop app rather than an npm library, so I ported its portable page architecture into `src/components/FolioPdfViewer.tsx`: measured page boxes, canvas painting only near the viewport, a separate selectable text layer, fit/zoom/rotation, page tracking and lazy thumbnails. The chrome is rebuilt as **two floating grouped option docks** (page/zoom on top, view tools below) in neutral SquidCloud glass with short eased transitions — no gloss, no spring wobble. The instant preview modal now uses it for PDFs; the old viewer remains for DeepReadReader.
- **Motion calmed.** Preview dock and video player springs now use higher damping and no overshoot; stretch/press amounts were reduced and the glossy conic rim on the preview dock was removed.
- **Wide-screen dock fixed.** Its corner position was being written by animated inline values; it's now anchored with plain CSS, so it stays visible at any zoom level.
- Committed `8a681899`. Deployed — **READY** at `https://cloudbliss-storage-jnl6j8zsx-sqc.vercel.app`.

## In progress
- Nothing actively being edited. Awaiting your visual verification.

## Blocked / needs a decision
- No local `tsc` here; Vercel's cloud build passed and is the verification authority.
- Folio's editor extras (annotations, signatures, OCR, Tauri integrations) were deliberately not ported — only its page engine and viewer behaviour.

## Queued next
- Any tuning of the PDF docks, page rendering, or motion after you look at it.
