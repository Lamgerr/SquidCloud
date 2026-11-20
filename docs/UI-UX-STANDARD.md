# SquidCloud UI/UX Standard

> **This is the single source of truth for how SquidCloud looks, feels, and behaves.**
> Any agent or contributor updating a page or component MUST read this file first and
> follow it. If a change conflicts with this document, the document wins — update the
> document explicitly rather than improvising in code.
>
> Companion: `docs/agents/UI-UX-AGENT-GUIDE.md` (the step-by-step workflow agents follow).
> House rules for design work also live in `.claude/rules/` and the `design-doctrine` skill.

---

## 1. Design intent in one paragraph

SquidCloud is a privacy-first file product. The interface is **quiet, confident, and
invisible**: deep near-black surfaces, one warm-white text color, hairline rules, small
radii, mono micro-labels, and motion that obeys real spring physics. It borrows the
discipline of **tvOS** (focus, one thing leads, generous negative space) and **macOS**
(density that stays legible, chrome that gets out of the way). It is **not** a glassmorphism
showcase: there is no global white/translucent overlay, no rainbow glow, no gradient soup,
no emoji as icons. Every screen has one lead element, and the rest recedes.

**If a screen looks "AI-generated", it is because several elements compete for attention,
surfaces are washed-out/white, or motion is decorative. All three are forbidden.**

---

## 2. Non-negotiable rules (violating any one = rejected change)

1. **One surface tier.** Backgrounds are near-black (`var(--sa-bg)` / `--sa-bg-2`). Surfaces
   use a hairline border and a faint inset top rim. No white fills, no `rgba(255,255,255,0.5)`
   panels. The only translucent glass allowed is the floating dock, and it is **dark**
   in both themes (see `src/components/FloatingDock.tsx` → `DOCK_CSS`).
2. **One thing leads.** Each screen has exactly one primary action and one focal content
   area. Display type is ≥ 2.5× body size. No "four equal cards" grids that the eye
   cannot land on.
3. **No global glass overlay.** Do not mount `<LiquidGlass />` or reintroduce
   `src/components/custom/liquid-glass.tsx` (unused, kept only as reference). It injects
   white fills across the app and was removed for this reason.
4. **Motion = spring physics, not easing theatre.** Use `framer-motion` springs
   (`type: 'spring'`, stiffness/damping/mass) for anything that moves on user intent.
   Respect `useReducedMotion()` — provide a zero/short-duration variant. No CSS keyframe
   loops on primary controls (the only loops allowed are the drop-target ripple and the
   drag bob).
5. **Icons are inline SVG with `currentColor`.** Use the local `Icons` set in
   `FloatingDock.tsx` or `lucide-react`. **Zero emoji** anywhere (UI, copy, comments,
   commit messages). No colored emoji status dots.
6. **Feedback has one owner.** Uploads/downloads report progress in the floating dock's
   activity sheet. Do not add "queued"/"complete" toasts for transfers. Only failures
   may toast, and the toast points to the dock.
7. **Tokens by intent.** Colors/spacing/type come from `tokens/*.json` through the
   CSS-variable layer at the app root (`src/components/custom/squid-app.tsx` → `AppTheme`
   sets `--sa-*`). No hardcoded hex, no one-off px timing in components unless it defines
   a spring or hairline that has no token.
8. **Every interactive element ships 8 states:** default, hover, focus-visible, active,
   disabled, loading, error (inputs), selected (selectables). Focus-visible is a real
   outline, never removed.
9. **Keyboard and screen readers first.** Menus (including the dock `+`) support Escape,
   Arrow navigation, focus return, `aria-expanded`/`aria-haspopup`, and `role="menu"`.
   Live status uses `aria-live="polite"`.
10. **Density rules.** Micro-labels are Geist Mono, `text-[10–11px]`, uppercase with
    `letter-spacing` — but sentence-case for body. File rows use a 2px hairline progress
    bar. Targets ≥ 24px (44px for the two dock actions).

---

## 3. The visual system

### 3.1 Color (semantic, from `AppTheme`)

| Token | Use |
|---|---|
| `--sa-bg` / `--sa-bg-2` / `--sa-bg-3` | Page / panel / raised surface (near-black in dark theme) |
| `--sa-text` | Primary text and primary action foreground |
| `--sa-text-2` | Secondary copy, row metadata |
| `--sa-mute` | Micro-labels, disabled-adjacent text |
| `--sa-line` / `--sa-line-2` | Hairline rules and borders |
| `--sa-f` | Hanken Grotesk (UI), `--sa-mono` Geist Mono (numbers/labels) |

Success = muted green (`#8fc98f` family), failure = muted red (`#d98080` family). Never
saturated neon. Do not introduce new accent hues without updating this table.

### 3.2 Type scale

- Display / page title: `22–28px`, weight 400, `letter-spacing: -0.02em`.
- Section kicker: mono `10–11px`, uppercase, `tracking-[0.1em]`, muted.
- Body: `13–14px`, line-height 1.5, `--sa-text-2`.
- Numbers/progress: mono, `tabular-nums`.

### 3.3 Spacing & radius

- 4px rhythm. Row padding `12px`, panel padding `14–16px`.
- Radius: `6px` for cards/rows, `8–10px` for popovers, `999px` only for the dock faces
  and segmented control. No `24px` blob cards.

### 3.4 Surfaces and elevation

- Panel: `--sa-bg-2`, 1px `--sa-line`, `box-shadow: inset 0 1px 0 var(--sa-line-2)`.
- Dock glass (the sole glass tier): `--g-fill: rgba(13,14,13,0.86)`,
  `backdrop-filter: blur(18px)`, hairline rim, dark in light theme too.
- Elevation shadow is soft and black: `0 12–24px 28–50px -14px rgba(0,0,0,0.75)`.

---

## 4. Motion vocabulary

Spring presets used in the dock (reuse these, don't invent new ones):

| Name | Config | Used for |
|---|---|---|
| `press` | scaleX .93 / scaleY .86 | button press |
| `hover` | scale 1.045 | hover lift |
| `jelly` | stiffness 520, damping 15, mass .8 | face bounce on press/release |
| `enter` | stiffness 240, damping 20 | dock slide-in |
| `sheet` | stiffness 330, damping 24, mass .9 | activity sheet extend/retract |
| `row` | stiffness 380, damping 24 | transfer row enter/exit |
| `glide` | stiffness 180–200, damping 26 | progress bars |

Rules: motion communicates **state change** (expand, progress, completion), never
decoration. Every motion has a reduced-motion branch. No layout-shifting animation that
moves unrelated content.

---

## 5. Component contracts

### 5.1 Floating dock (`src/components/FloatingDock.tsx`)

- Position: fixed bottom-right, safe-area aware, `bottom: 20px` desktop / raised on mobile.
- **One lead action: Upload** (pill face with label). When active, label becomes live
  percentage and the ring shows progress; on completion, a check appears.
- **Satellite: `+`** in a separate circle at the end; opens a `role="menu"` of create
  actions (new folder, clone from GitHub, upload folder, file types). `+` rotates 135°
  when open, items rise out of it as glass droplets with staggered springs.
- **Activity sheet**: extends upward from the dock on hover, focus, or while uploading.
  Shows overall progress, per-file rows (name, %, 2px bar), and on row hover expands to
  full info (size, transferred, speed, remaining, error). Footer has retry-failed /
  clear-done and opens the full transfer center. It is the **only** transfer surface.
- `DropGlow` overlay: a dark glass droplet falls in when files are dragged over the page.
- `GlassSegment`: icon-only segmented control with a `layoutId` spring thumb. Use it for
  list/grid/sort toggles instead of text buttons.
- Props: `onUploadFiles`, `actions`, `dragging`, `hidden`, `disabled`, `onDisabledClick`.
  Keep this API stable — Dashboard passes `handleFilesDropped` and create actions.

### 5.2 Dashboard (`src/pages/Dashboard.tsx`)

- Two render branches (mobile/desktop) share the same rules. `AppTheme` is mounted once
  per branch; `LiquidGlass` is **not** mounted.
- `PathBar` is icon-led: home circle, chevrons, current folder in 22px light type.
- Toolbar uses `GlassSegment` for view mode and compact icon buttons for select/sort/
  refresh. Micro-copy lives in the dock, not in toasts.
- Empty states own the viewport and point to the dock's Upload action.

### 5.3 Toasts

Reserve toasts for: errors (destructive), and one-off non-transfer confirmations
(e.g. "links copied"). Never for upload start/progress/complete. Keep them short:
`title` + `description`; description tells the user where to go or what to do.

---

## 6. Anti-patterns (all observed in past versions — do not reintroduce)

- `<LiquidGlass />` global layer (white fills) — removed 2026-11-20.
- `BackgroundUploadPanel` as a second fixed bottom-right card overlapping the dock —
  removed; its capability now lives in the dock activity sheet.
- "N file(s) queued" / "Upload complete" toasts alongside a transfer panel — removed.
- Rainbow/conic gradient glow around the dock — removed (dark hairline rim instead).
- `dangerouslySetInnerHTML` with untrusted markdown, devtools-detection overlays,
  hardcoded service-role keys, `verify_jwt=false` without internal auth.
- Four equal stat cards, template gradients, emoji icons, `font-bold` everywhere.

---

## 7. Definition of done for any UI change

1. Reads this file and the agent guide; states which rules apply.
2. Matches tokens, type scale, surface tier, and spring presets above.
3. All 8 states implemented for touched interactive elements.
4. `useReducedMotion()` branch where motion is added.
5. Keyboard path tested (Tab/Escape/Arrows) and `aria-*` present.
6. No duplicate feedback source (check toasts vs dock vs panel).
7. `npx tsc --noEmit` passes (or reports pre-existing unrelated errors clearly).
8. Screenshot reviewed in dark theme; if light theme is touched, reviewed there too.
9. `git diff` contains only intended files; no secrets, no build artifacts.

---

## 8. Change log

| Date | Change |
|---|---|
| 2026-11-20 | Initial standard. Dock owns transfer feedback; global glass + separate panel + duplicate toasts removed; spring/tier/state contracts defined. |
