# CloudBliss — Material 3 Redesign

**Status:** approved for build (autonomous run, 2026-11-01)
**Scope:** visual system + app shell + primary file surfaces
**Reference:** Material 3 / Material You (Android 14–16), `material-web`, and the two Sekai Tune screenshots in `sekai-refs/`

---

## 1. Intent

CloudBliss is a zero-knowledge cloud storage web app (React 18 + Vite + Tailwind 3 + Radix). It works, but it looks machine-made: monochrome chrome, hairline boxes, 9.5–13px type, an uppercase mono kicker on every section, and a single flat visual weight from the top bar to the last row. It is dressed as an editorial broadsheet when it should move like a native Android app.

The goal is a **Material 3 interface that reads as a first-party Android app** — the same visual grammar as Files by Google, Google One, Gmail and the supplied Sekai Tune reference — while keeping every route, data flow, permission check, keyboard shortcut and accessibility affordance that exists today.

The reference gives the emotional target: warm dark surfaces, generous rounded containers, peach tonal circles carrying icons, one obvious primary action, type large enough to lead, and no decorative borders.

## 2. What exists today (scan + diagnosis)

**Stack.** React 18, Vite 5, Tailwind 3 with shadcn-style HSL variables, Radix primitives, Phosphor icons via `src/lib/icon-map.tsx`, `index.css` (1,875 lines) plus `src/styles/*.css`, and a second runtime design language in `src/components/custom/squid-app.tsx`.

**The real problem is `AppTheme`.** `<AppTheme />` is mounted by `Dashboard` and `DeveloperAPI`. It injects `html.sq-app-root` CSS that:

| Rule | Consequence |
|---|---|
| `--primary: {text}` | Primary is white. No action can ever read as primary. |
| `--radius: .3rem`; `.rounded-xl, .rounded-2xl { border-radius: 6px }` | Every container is a 6px box, including cards meant to be 28px. |
| `h1…h6, strong, .font-semibold { font-weight: 500 }` | Display type has no weight contrast against body. |
| `.shadow* { box-shadow: none }` / flatten glass to hairlines | No elevation, no tonal separation; everything is a 1px outline. |
| `.lg-section-header` = 11px mono uppercase | Every section shouts in the same voice. |
| `--sa-*` ink/bone palette | Zero brand color in the product surface. |

**Supporting findings.**

- `SettingsRow` hardcodes `text-white` / `bg-white/[0.06]` — light mode is already broken there.
- `StatsPanel` uses 9.5px labels and grayscale-only category colors; color carries no meaning and fails “not by color alone” when it does.
- `FileItem` grid and list are bordered boxes with 7px icon tiles; the file type is a 10px mono tag.
- Three brand signals disagree: logo is blue→cyan, `index.css` dark primary is lime, `AppTheme` primary is white.
- Mobile uses a custom morphing bar and a separate header, visually unrelated to the desktop shell.

## 3. Goals / non-goals

**Goals**

1. A real M3 token layer: full color roles, typescale, shape, elevation, motion, state layers — generated from a seed, in light and dark.
2. Native M3 primitives in React (buttons, FAB, chips, cards, lists, nav, app bar, search, fields, dialogs, sheets, snackbar, switch, progress) with all eight states.
3. The app shell rebuilt: navigation drawer / rail, top app bar, mobile navigation bar, FAB.
4. Home, Files, Settings surfaces rebuilt to the reference bar.
5. Runtime **dynamic color**: four seeds, persisted, defaulting to the warm reference palette.
6. Every color pair verified by the repo’s own contrast gate; no hardcoded hex in new component code.

**Non-goals (this pass)**

- Rewriting the 90+ secondary screens (viewers, editors, SDK docs, billing flows). They inherit the M3 color and radius bridge and are migrated later.
- Removing Radix or Tailwind. The system is expressed as tokens + CSS + thin React components.
- Changing product copy, routes, permissions, encryption, upload logic, or data fetching.
- Light-mode marketing pages.

**Anti-goals (would mean failure even if it compiles)**

- A reskin that only recolors the existing boxes (same density, same 11px mono kickers).
- Losing the keyboard-first file navigation, long-press sheets, or focus rings.
- A palette that fails contrast in either theme.
- Copying the reference’s music-specific layout instead of its *grammar*.

## 4. Approaches considered

**A. Rewrite every component against M3.** Highest fidelity, but 120+ components, many with product logic; regression risk far beyond the budget. Rejected.

**B. Token engine + primitives + rewrite the surfaces people live in; legacy inherits tokens.** One source of truth; the shell, home, files and settings become genuinely M3; everything else shifts to the new palette and shape for free. Chosen.

**C. Adopt `@material/web` custom elements.** Authentic components, but shadow-DOM styling fights Tailwind and the existing Radix dialogs/menus/toasts; bundle weight and a second focus-trap implementation. Rejected.

## 5. Decisions

### 5.1 Color — M3 roles, brand-seeded, dark first

Tonal palettes are generated in OKLCH and **tone-snapped to CIE L\*** (the scale Material uses), then gamut-mapped to sRGB. Every role is the standard M3 mapping (e.g. dark `primary = P80`, `primary-container = P30`, `surface = N6`, `surface-container-high = N17`).

Seeds:

| Seed | Primary hue | Character | Use |
|---|---|---|---|
| **bliss** (default) | 32° coral | warm charcoal + peach, the reference | default product skin |
| azure | 258° blue | cool neutral, logo-linked | alternate |
| moss | 148° green | calm, utility | alternate |
| violet | 300° violet | expressive | alternate |

Why coral by default: the reference is warm, and a stock blue M3 scheme is indistinguishable from every generated Material template. The blue→cyan logo still works as the identity mark against warm neutrals, which is exactly how Material You behaves when the wallpaper seed is warm. `azure` is one click away and restores brand-blue.

Neutrals take the seed hue at chroma ≈0.006 (M3 neutral chroma 4), so dark surfaces are charcoal with a warm or cool cast rather than pure gray. True `#000` is never a surface.

Semantic additions on top of M3: `success`, `warning`, and a five-family file-type set (`image`, `video`, `audio`, `doc`, `archive`, `code`) each with container/on-container tones, replacing the old raw hexes.

### 5.2 Type — Geist on the M3 scale

M3 roles mapped to Geist Sans (already bundled; Roboto would need a new font dependency and would be a downgrade at display sizes):

| Role | Size / line | Weight | Use |
|---|---|---|---|
| display-small | 36 / 44 | 500 | hero greeting, big storage number |
| headline-medium | 28 / 36 | 500 | page titles |
| headline-small | 24 / 32 | 500 | section leads |
| title-large | 22 / 28 | 500 | card titles |
| title-medium | 16 / 24 | 500 | list group headers |
| body-large | 16 / 24 | 400 | reading text |
| body-medium | 14 / 20 | 400 | default UI text |
| label-large | 14 / 20 | 500 | buttons, tabs |
| label-medium | 12 / 16 | 500 | chips, captions |

Mono survives **only** for data that needs alignment (hashes, sizes in tables, code). No mono kickers in chrome.

### 5.3 Shape

M3 scale: 4 / 8 / 12 / 16 / 28 / full.
Cards 16 (list containers 16, hero 28), buttons and chips full, search bar full, FAB 16, dialogs 28, sheets 28 top corners, thumbnails 12.

### 5.4 Elevation

Tonal elevation in dark (surface-container steps), plus shadow only for floating layers (dialog, menu, FAB, sheet). No shadow on resting cards, no 1px border on content cards. `outline-variant` is reserved for real dividers and inputs.

### 5.5 Motion

M3 easing: `standard = cubic-bezier(0.2, 0, 0, 1)`, `emphasized-decelerate = cubic-bezier(0.05, 0.7, 0.1, 1)`, `emphasized-accelerate = cubic-bezier(0.3, 0, 0.8, 0.15)`. Durations 100 / 200 / 300 / 400 / 500 ms. One authored transition per state change; `prefers-reduced-motion` collapses transforms to opacity.

### 5.6 Iconography

Phosphor (existing) at M3 sizes: 24 in nav and list leading, 20 in buttons, 18 in dense rows. Active navigation and selected chips use `weight="fill"` — the M3 filled/outlined state change — with no new icon dependency.

### 5.7 Where the theme lives

- `tokens/m3.json` — DTCG source: seeds, role→tone map, typescale, shape, motion.
- `scripts/gen_m3_theme.mjs` — generates `src/styles/m3/theme.css` (all roles, all seeds, light + dark, plus HSL triplets for the shadcn bridge) and prints a contrast table.
- `src/styles/m3/base.css` — typescale, shape/elevation utilities, state layers, focus, scrollbars, motion.
- `src/styles/m3/components.css` — component classes.
- Imported once from `src/index.css`.
- `AppTheme` is removed from `Dashboard` (the ink/bone overrides die with it); `.sa-kbd` is re-homed as `.m3-kbd` so no dashboard markup depends on it.
- Legacy shadcn variables are bridged to M3 roles, so every untouched component inherits the new palette.

## 6. What gets rebuilt

1. **Primitives** (`src/components/m3/*`): Button, IconButton, FAB, Card, Chip, ListItem, NavigationDrawer/Rail, NavigationBar, TopAppBar, SearchBar, TextField, SegmentedButton, Switch, Progress, Badge, Divider, plus M3 dialog/sheet/snackbar styling for existing Radix/sonner layers.
2. **Shell**: 280px standard drawer that collapses to an 80px rail, small top app bar with contextual storage/workspace chips and a docked search, mobile top bar + 80px navigation bar + FAB.
3. **Home**: greeting + date, primary-container hero with storage ring and two actions, three limit cards, grouped recents list, folder grid, activity chart.
4. **Files**: title + count header, split create/upload button, filter chips, segmented density control, M3 list rows (64px, 40px tonal leading icon) and grid cards (16px, tonal preview field).
5. **Settings rows**: grouped list containers with 48px circular tonal icon wells — the pattern in the second reference screenshot.

## 7. Accessibility contract

- All required pairs pass `scripts/validate_contrast.py` (4.5:1 text, 3:1 UI) in both themes, measured on the generated source.
- Focus: 2px `primary` ring with 2px offset, visible on every interactive element; no `outline: none` without a replacement.
- Targets: 48px minimum on mobile, 40px on desktop pointer surfaces.
- State is never color-only: selected chips get a check, shared files get an icon, errors get an icon and text.
- Reduced motion honored globally.
- File rows keep `data-kbd-item` arrow-key navigation, Space selection, and `aria-current`/`aria-selected` semantics.

## 8. Left to the builder

- Exact spacing rhythm inside new cards (4px grid, 8/12/16/24 padding).
- Copy for empty states and helper lines (keep existing product vocabulary).
- Whether the specimen page ships at `/design` in production (it is dev-facing but harmless).
- Which secondary screens to migrate next, once the shell lands.
