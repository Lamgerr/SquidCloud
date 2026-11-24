# What happened while you were away

## Done
- **EPUB reader redesigned to match the PDF viewer.** Same dense neutral glass, same grouped floating docks, same springy buttons:
  - Top: contents/bookmarks/search dock, title + page dock, and font size / settings / annotate / fullscreen / bookmark dock.
  - Bottom: prev / scrubbable progress rail / next dock.
  - Floating sidebar island for TOC, bookmarks and search; glass popover for theme, typeface and line spacing.
  - EPUB-specific features and all reading logic are unchanged. The PDF branch now renders the PDF viewer alone so no docks overlap.
- Updated `docs/UI-UX-STANDARD.md`. Committed `cd8189d3`. Deployed — **READY** at `https://cloudbliss-storage-8r1varhp8-sqc.vercel.app`.

## In progress
- Nothing actively being edited. Awaiting your visual verification.

## Blocked / needs a decision
- No local `tsc` here; Vercel's cloud build passed and is the verification authority.

## Queued next
- Any tuning of the EPUB docks, island or reading surface after you look at it.
