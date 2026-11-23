# What happened while you were away

## Done
- **Fixed the HUD flash/glitch.** When you tapped a playing video, `onTouchDown` immediately revealed the chrome, and the follow-up tap handler then read the *already-flipped* visibility state — so it scheduled a hide 300ms later. The HUD flashed and vanished; touching the HUD itself skipped that path, which is why it only stabilized then. The handler now captures visibility *before* the state change and acts on that, with no delayed hide. Double-tap seeking and mouse click/double-click are unchanged.
- Committed `0a409c46`. Deployed — **READY** at `https://cloudbliss-storage-rnu7haho2-sqc.vercel.app`.

## In progress
- Nothing actively being edited. Awaiting confirmation on your device.

## Blocked / needs a decision
- No local `tsc` here; Vercel's cloud build passed and is the verification authority.

## Queued next
- Any further player / preview UX tuning.
