## 2026-11-23 - Fix HUD flash on tap (interactive query)
- Report: while playing, tapping the video makes the HUD glitch/flash until the HUD itself is touched.
- Root cause: `onTouchDown` calls wakeControls() (sets controlsVisible=true) immediately; then the delayed tap handler in `onTouchUp` read `uiRef.current` — already true — and scheduled `setControlsVisible(false)` 300ms later. So the chrome appeared then disappeared. Touching the HUD has `data-cbp-ui`, so onTouchDown returns early and no hide is scheduled — hence "stable once I tap the HUD".
- Fix: `uiAtDown` ref captures the pre-tap visibility on pointer-down; the tap branch uses it to choose hide-vs-show immediately with no timer. Double-tap zone seek and mouse click/dblclick behaviour preserved.
- Committed 0a409c46; `vercel --prod --yes` READY.
- Next: await confirmation on device.

## 2026-11-23 - Remove player grain + center spinner (interactive query)
- Screenshot Screenshot_20261123-172814.jpg showed the HUD drowned in heavy static-noise grain and the buffering spinner off-center and partly hidden behind the HUD.
- Grain root cause: I had interpolated GRAIN_BG (an SVG with fully opaque noise) directly into .cbp-glass background-image with no opacity control. Removed the import and the layer entirely; clean neutral frosted gradient restored.
- Spinner root cause: Framer Motion animates `scale` via an inline `transform`, which overrides the CSS `transform: translate(-50%,-50%)` used for centering. Fixed by passing x:'-50%', y:'-50%' in initial/animate/exit for .cbp-wait; applied the same fix to .cbp-gesture and the mobile .cbp-center transport (same latent bug), and removed the now-redundant CSS transforms.
- Committed 2d523c4c; `vercel --prod --yes` READY.
- Next: await visual confirmation.

## 2026-11-23 - Remove NOW PLAYING label (interactive query)
- Human said the NOW PLAYING label + live pulse added in the previous player pass was unnecessary and should go.
- Removed the `.cbp-now` div from the audio meta JSX (title + type/size meta remain), the `.cbp-now*` CSS rules and the `@keyframes cbp-live` block.
- Verified zero leftover references and brace/paren/template balance; committed 37fd0cb0; `vercel --prod --yes` READY.
- Next: await further design feedback.

## 2026-11-23 - cbVideoPlayer fixes from screenshot review (interactive query)
- Screenshot Screenshot_20261123-165534.jpg showed the new glass HUD but with a visible white sheen. Root causes: .cbp-glass white gradient overlay, `backdrop-filter: ... brightness(1.06)`, white inset rim, and a pointer-following white radial ::before. Replaced all with neutral dock glass + GRAIN_BG nano grain; neutralized slider fill/thumb, button hovers, pills, tips and the sage/green audio orb (user had explicitly rejected green accents earlier).
- Options menu had speed/audio/subs but rows were conditionally hidden and there was no quality. Rebuilt root menu to always show Quality / Audio Track / Subtitles / Speed with icons + current values. Added quality page with source resolution detected from videoWidth/Height (qualityOf helper), passed ?q= to the virtual-stream URL, and preserved playback position via a resumeAt ref so switching quality doesn't restart. Note: SW serves one progressive stream (no renditions) - quality is an honest preference hook, displayed as such.
- Subtitles now actually work without native tracks: hidden file input parses .srt/.vtt into VTTCue objects added to a real addTextTrack('subtitles') track, which our cuechange listener renders. Audio page always shows Default plus native tracks.
- Input rewrite: old touch model relied on React click/doubleclick with a 300ms timer and no swipes. New pointer-based system on the root: first finger records start; movement >14px chooses seek (horizontal) / brightness (left half) / volume (right half); second finger triggers pinch zoom. Tap = UI toggle, double-tap = zone seek (±10s) or play/pause; mouse click/dblclick kept but guarded to mouse only. Added data-cbp-ui guards on HUD/menu/center so gestures don't fire on controls, and touch-action:none on root. Keyboard expanded with c/i/p/[/]/0-9/Home/End.
- Audio: NOW PLAYING eyebrow with live pulse, neutral orb, always-on HUD (ui is true for isAudio).
- Verified brace/paren/template balance; committed 73b42a1c; `vercel --prod --yes` READY.
- Next: human verification on a real touch device; tune gesture thresholds / HUD sizing if needed.

## 2026-11-23 - Integrate new cbVideoPlayer (interactive query)
- Newest download: `cbVideoPlayer.tsx` (16:30, 986 lines vs old 897). Replaced src/components/cbVideoPlayer.tsx verbatim.
- New player is self-contained: only imports framer-motion, @/lib/utils, @/lib/videoStreamer. Uses StreamDecryptorService.initListener + seedFileMeta (both verified present). Streaming/decryption logic carried over.
- Props interface byte-identical to old (file/poster/autoPlay/className/shareId), so the three call sites needed zero edits: EnhancedInstantPreviewModal, MobilePreviewModal, StreamingVideoDemo. The extra props at the latter two (src/muted/onDownload/useStreaming/etc.) were already there pre-change - not a regression; tsconfig has strictNullChecks/noUnusedLocals off.
- Design: QuickTime-style floating glass HUD centred on desktop, mobile controls over the picture, spring driven (JELLY/POP/SOFT), liquid scrubber thumb stretches with pointer velocity, menus pop from anchor, audio files get an ambient artwork stage.
- Verified brace/paren/template balance; committed e26b5f1b; `vercel --prod --yes` READY.
- Next: human visual verification of the HUD; tune sizing/scrubber feel if needed.

## 2026-11-23 - New dock file + palette scope-card/AI polish (interactive query)
- Newest download was `EnhancedInstantPreviewModal.tsx-new` (15:27) — copied into src/components/EnhancedInstantPreviewModal.tsx. Its key change: dock now imports DOCK_CSS + Icons from the repo's FloatingDock.tsx so the preview dock reuses the exact dashboard dock faces (.sq-face/.sq-round/.sq-hit/.sq-orb-slot), with a new `side` prop ('corner' | 'edge'); edge mode parks the dock right-centre for CBVideoPlayer so it avoids the player controls. Verified Icons.X and all CSS classes exist before integrating.
- CommandPalette scope card: root cause of "no translucent/grain" was `.spot-panel[data-ai="true"] { background: linear-gradient(...) }` — the `background` shorthand overrode `.spot-glass` background-image/color and killed the grain. Replaced with background-color + background-image preserving both NANO layers, added `.spot-panel.spot-glass` translucent frosted body (rgba(16,17,18,.86), blur 46px saturate 1.5) and a grain veil on `.spot-clip::before`. Fixed z-index so content stays above the veil without breaking the 0fr→1fr grid animation.
- AI: added `.spot-ctx` live context strip (pulsing dot, current file/type/folder/selection) to the ask view; answer now carries data-streaming while loading and uses a sliding blue gradient with background-clip:text + a glowing `.spot-caret`, keyframes spot-stream-blue / spot-live / spot-caret.
- Verified brace/paren/backtick balance; committed 84371f49; `vercel --prod --yes` READY.
- Next: human visual verification; tune blue gradient intensity or dock edge placement if needed.

## 2026-11-23 - Integrate user-authored preview files (interactive query)
- Found new files in /storage/emulated/0/Download (the `~/storage/shared` symlink resolves to /storage/emulated/0). Latest timestamp 14:55: EnhancedInstantPreviewModal.tsx, MinimizedPreviewStack.tsx, grain.ts. Other tsx (CommandPalette 10:05, FloatingDock/Dashboard/App Nov 16-19) are older — left untouched.
- Downloaded CommandPalette.tsx verified as an OLD transparent-glass version (`--glass: rgba(38,40,50,.52)`, zero NANO_GRAIN refs) vs the current premium palette (5 refs). Deliberately not overwritten.
- New modal design: a true spring-driven 'jelly' dock — `useMotionValue`/`useSpring`/`useTransform`/`animate` drive width/height/per-corner radius, magnetic bulge toward cursor, 2s auto-throw into bottom-right corner squashed against both walls, hover pop, tethered pull with release threshold. Minimize = keep tab (`previewTabs.minimize()`); X = remove tab (`previewTabs.close(id)`). Reviewed the file's "ASSUMED API" note and confirmed both store methods exist.
- New MinimizedPreviewStack is presentational: props `tabs/activeId/onRestore/onClose/onCloseAll`, fanned spring cards, `useDragControls` drag-left=maximize / drag-right=close, hide-all/close-all pills, hidden handle. Kept store coupling out of it.
- Wired via existing PreviewTabStack.tsx rewritten as a thin wrapper (subscribes to previewTabs, maps PreviewTab -> StackTab), so Dashboard's two mounts needed no changes.
- git add 5 files (grain.ts, new modal, new stack, wrapper, UI-UX-STANDARD.md) -> commit 29fcacea -> `vercel --prod --yes` READY.
- Next: human visual verification of dock physics / gestures; tune spring constants and drag thresholds if needed.

## 2026-11-23 - Preview UX refinement (interactive query)
- Reviewed latest screenshots from ~/Downloads and ~/storage/shared/Pictures/Screenshot. Confirmed the modal chrome was overcrowded, the minimized tabs were generic "AI slop", and the palette read too thin/transparent.
- Rebuilt EnhancedInstantPreviewModal chrome into a single floating dock: grainy translucent glass, spring physics, only minimize + close. Added a 2s visibility window then a spring submerge into the bottom-right corner with a visible peek; corner hot-zone hover and drag-to-pull reveal it. Removed all other buttons (info/share/download/fullscreen/nav/strip) and their dead state/imports.
- Redesigned PreviewTabStack as a deck of glassy grain-textured picking cards: tight fan collapsed, spring fan-out on hover, per-card type glyph/label/close, drag-out-to-dismiss, click-to-restore, quiet hide-all/close-all pill, hidden-tab restore badge. Kept monochrome (rejected green accent).
- CommandPalette: densified glass to rgba(14,15,16,.968), added a second high-frequency NANO_GRAIN layer over the mid-frequency NANO_TEXTURE, stronger rim + deep shadow, refined mute tone for a premium frosted finish.
- Verified brace/paren/backtick balance on all three files; no local tsc available, Vercel cloud build authoritative.
- Committed 79ae2745 (4 files) and deployed `vercel --prod --yes` -> READY at cloudbliss-storage-qzb1fg0lk-sqc.vercel.app.
- Next: await human visual verification; tune submerge peek amount / spring stiffness or palette grain intensity from screenshots.

## 2026-10-27 - LOC analysis (interactive query)
- Task: count lines of code excluding comments and markdown.
- Method: git ls-files (ex *.md(x)) -> cloc 2.10 Perl script downloaded from AlDanial/cloc tag v2.10 (relied on raw.githubusercontent.com Availability). cloc comment handling is state-machine-based (string/template-safe), so comment counts are trustworthy.
- Corrections verified: .har capture (17,194 lines) was counted as JSON -> separated; Cargo.lock (2,115 raw lines) silently skipped by cloc -> added manually where noted; teardown confirmed language rows sum exactly to 249,950.
- Key result: 249,950 code lines across 1,142 non-md text files (+2,115 Cargo.lock raw = ~252,065 all-text); approx 206,640 lines when generated/data artifacts (lockfiles, HAR, BIP39 wordlist, l0g.txt dump, egg-info, robots) are excluded.
- Next: nothing queued (cold start; interactive query, no backlog item picked).
