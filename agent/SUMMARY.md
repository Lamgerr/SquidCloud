# What happened while you were away

## Done
- **White tint removed** — the player's glass HUD had a white gradient, a `brightness(1.06)` boost, a white inner rim and a pointer-following white spotlight. All replaced with neutral dock glass + the shared nano-grain texture. Slider fill/thumb, button hovers, pills and the old sage/green audio orb were neutralized too.
- **Full options menu** — the `»` menu now always exposes **Quality**, **Audio Track**, **Subtitles**, and **Speed** with current values shown. Added a Quality page (detects the stream's real resolution, passes a `?q=` preference, keeps your playback position). Subtitles now genuinely work: load a `.srt`/`.vtt` file and it becomes a real text track. Audio offers Default + native tracks.
- **Touch controls rewritten** — replaced the fragile click/timer model with real pointer gestures: horizontal swipe to scrub, vertical swipe on the left half for brightness / right half for volume, pinch to zoom, tap for UI, double-tap for ±10s or play/pause. Mouse click/double-click still work. Controls are excluded from gestures.
- **Keyboard** — added `c` captions, `i` stats, `p` PiP, `[`/`]` speed, `0-9` jump to position, `Home`/`End`, plus the existing space/K/J/L/M/F/arrows.
- **Audio** — NOW PLAYING indicator with a live pulse, neutral ambient orb, always-visible HUD, and gesture support.
- Committed `73b42a1c`. Deployed — **READY** at `https://cloudbliss-storage-gabhk45hb-sqc.vercel.app`.

## In progress
- Nothing actively being edited. Awaiting your verification on a real touch device.

## Blocked / needs a decision
- No local `tsc` here; Vercel's cloud build passed and is the verification authority.
- **Quality caveat**: the service worker serves a single progressive stream (no renditions), so a lower quality setting is an honest preference/param hook — it does not transcode. The menu shows the real detected source resolution.

## Queued next
- Tune gesture thresholds (14px start, seek multiplier, volume/brightness slopes), HUD sizing, or grain intensity from screenshots.
