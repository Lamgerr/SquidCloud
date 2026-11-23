# What happened while you were away

## Done
- **Reverted the Folio PDF experiment.** The instant preview modal is back on the project's original `OptimizedPDFViewer`. The unused `FolioPdfViewer.tsx` was removed and the standard doc note reverted.
- The unrelated improvements from that commit were **kept**: calmer dock/player springs, no glossy rim, and the plain-CSS corner anchoring that fixed the dock being invisible on wide screens.
- Committed `184cef53`. Deployed — **READY** at `https://cloudbliss-storage-cwsn0pve4-sqc.vercel.app`.

## In progress
- Nothing actively being edited. Awaiting your feedback.

## Blocked / needs a decision
- No local `tsc` here; Vercel's cloud build passed and is the verification authority.

## Queued next
- Don't retry the Folio port unless you ask. Otherwise, any further UX tuning.
