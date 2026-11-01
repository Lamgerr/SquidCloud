# Material 3 Redesign — Implementation Plan

> **For agentic workers:** execute task-by-task. Each task ends with a runnable verification and a commit. Steps use `- [ ]`.

**Goal:** Replace CloudBliss’s monochrome editorial skin with a Material 3 (Material You) design system and rebuild the app shell, home, files and settings surfaces on it, without changing routes or data flow.

**Architecture:** A generated M3 token layer (`tokens/m3.json` → `scripts/gen_m3_theme.mjs` → `src/styles/m3/theme.css`) feeds a hand-written component CSS layer and thin React primitives. Legacy shadcn variables are bridged to M3 roles so untouched screens inherit the palette. The dashboard swaps its ink/bone `AppTheme` wrapper and its sidebar/top bar for M3 navigation components.

**Tech Stack:** React 18, TypeScript, Vite 5, Tailwind 3, Radix, Phosphor icons, sonner, plain CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-11-01-material3-redesign-design.md`

## Global Constraints

- No new runtime dependencies.
- New component code contains no hardcoded hex colors; all color comes from `--md-sys-color-*`.
- Required contrast: text 4.5:1, UI and focus 3:1 — measured, not asserted.
- Every interactive element implements default, hover, focus, active, disabled, selected (where selectable); loading/error where applicable.
- `prefers-reduced-motion: reduce` collapses transforms; no ambient animation.
- Preserve: routes, props, keyboard shortcuts, `data-kbd-item` navigation, long-press sheets, focus traps, permission gates.
- No emoji anywhere.
- Dark theme is the default and primary target; light must also pass.

## Review Focus

- Legacy screens that were never migrated must not become unreadable when the palette flips (e.g. `text-white` on a light surface in `SettingsRow`).
- Overlay layers (Radix dialogs, dropdowns, sheets, sonner toasts) render in portals outside the dashboard subtree and must still pick up M3 roles.
- Long file names, 0-byte files, and empty folders must not break row alignment or overflow at 320px.
- The mobile bar must not cover the last row of a list; safe-area insets must be respected.
- Seed switching must repaint every role, including legacy bridged variables, without a reload.

---

### Task 1: Token engine and generated theme

**Files**
- Create: `tokens/m3.json`
- Create: `scripts/gen_m3_theme.mjs`
- Generate: `src/styles/m3/theme.css`
- Modify: `src/index.css` (import the generated theme)

**Interfaces**
- Produces: CSS custom properties `--md-sys-color-<role>` (kebab-case), `--md-sys-typescale-<role>-<prop>`, `--md-sys-shape-corner-<size>`, `--md-sys-elevation-<level>`, `--md-sys-state-<state>-opacity`, and HSL triplets `--m3-<role>-hsl` for the shadcn bridge.
- Produces: `html[data-m3-seed="bliss"|"azure"|"moss"|"violet"]` variants; light on `html`, dark on `html.dark`.

- [ ] Write `tokens/m3.json` with seeds, tone maps and typescale.
- [ ] Write `scripts/gen_m3_theme.mjs` (OKLCH → sRGB, tone snap to CIE L\*, gamut map, emit CSS + contrast table).
- [ ] Run `node scripts/gen_m3_theme.mjs --check` → every required pair reports PASS in light and dark.
- [ ] Import `./styles/m3/theme.css` from `src/index.css` before Tailwind base.
- [ ] Commit.

### Task 2: M3 CSS layer (typescale, shape, states, motion)

**Files**
- Create: `src/styles/m3/base.css`
- Create: `src/styles/m3/components.css`
- Modify: `src/index.css` (bridge legacy shadcn vars to M3 roles; delete the lime `.dark` palette)

**Interfaces**
- Produces classes: `.m3-btn` + variants, `.m3-icon-btn`, `.m3-fab`, `.m3-card`, `.m3-chip`, `.m3-list-item`, `.m3-nav-*`, `.m3-appbar`, `.m3-search`, `.m3-field`, `.m3-seg`, `.m3-switch`, `.m3-progress`, `.m3-badge`, `.m3-divider`, `.m3-kbd`, typescale `.m3-display-*`, `.m3-headline-*`, `.m3-title-*`, `.m3-body-*`, `.m3-label-*`.
- Produces state-layer token usage: `--md-sys-state-hover-opacity` etc.

- [ ] Write `base.css`: reset touch-ups, typescale, shape/elevation helpers, focus ring, scrollbars, reduced motion, selection.
- [ ] Write `components.css`: all component classes with 8 states.
- [ ] Replace the `:root` / `.dark` HSL block in `index.css` with the M3 bridge.
- [ ] Verify no `.dark` rule still hardcodes lime.
- [ ] Commit.

### Task 3: React primitives

**Files**
- Create: `src/components/m3/primitives.tsx`
- Create: `src/components/m3/navigation.tsx`
- Create: `src/components/m3/theme.tsx`
- Create: `src/components/m3/index.ts`
- Create: `src/pages/DesignSystem.tsx`
- Modify: `src/App.tsx` (route `/design`)

**Interfaces**
- `Button({ variant?: 'filled'|'tonal'|'outlined'|'text'|'elevated', size?: 'sm'|'md'|'lg', icon?, trailingIcon?, loading?, children })`
- `IconButton({ variant?: 'standard'|'filled'|'tonal'|'outlined', size?, selected?, label })`
- `Fab({ size?: 'sm'|'md'|'lg', extended?, icon, label? })`
- `Card({ variant?: 'filled'|'elevated'|'outlined', interactive?, children })`
- `Chip({ variant?: 'assist'|'filter'|'suggestion', selected?, icon?, onRemove? })`
- `ListItem({ leading, headline, supporting, trailing, selected?, onClick? })`
- `NavigationDrawer`, `NavigationBar`, `TopAppBar`, `SearchBar`
- `M3ThemeProvider` + `useM3Theme()` exposing `{ seed, setSeed }`.

- [ ] Implement primitives with ripple/state layers and full keyboard support.
- [ ] Implement navigation components.
- [ ] Add `/design` specimen page exercising every primitive in light and dark.
- [ ] `npx tsc --noEmit` passes.
- [ ] Commit.

### Task 4: App shell

**Files**
- Create: `src/components/m3/AppShell.tsx`
- Modify: `src/pages/Dashboard.tsx` (mount shell; remove `AppTheme`; replace sidebar/top bar; add mobile nav bar)
- Modify: `src/components/MobileBottomNavbar.tsx` (M3 navigation bar styling; keep logic)
- Modify: `src/components/MobileNavHeader.tsx` (M3 small top app bar)

**Interfaces**
- `AppShell({ activeTab, onTabChange, collapsed, onToggleCollapse, user, profile, bookmarks, onSearchOpen, onSignOut, onNavigateToFolder, onStorageClick, onWorkspaceChange, ... })` — same information as `EnterpriseSidebar`, no new data.

- [ ] Build drawer/rail with destinations, sections, bookmarks and account chip.
- [ ] Build top app bar with context chips, search and actions.
- [ ] Wire into Dashboard; delete the old top bar block and `AppTheme` usage.
- [ ] Mobile: navigation bar + FAB above safe area; verify no content underlap.
- [ ] Commit.

### Task 5: Home overview

**Files**
- Modify: `src/components/DashboardOverview.tsx` (full rewrite, same props)
- Modify: `src/components/ui/StatsPanel.tsx` (M3 stat cards + tonal category bar)

- [ ] Hero storage card with ring, plan, two actions.
- [ ] Limit cards with tonal icon wells and progress.
- [ ] Recent list + folder grid + activity chart in M3 containers.
- [ ] Empty states for no files / no folders.
- [ ] Commit.

### Task 6: Files surface

**Files**
- Modify: `src/components/FileItem.tsx` (grid card + list row)
- Modify: `src/components/ui/LazyFileGrid.tsx` (header, gaps, skeletons)
- Modify: `src/components/ui/FolderRow.tsx` (grid card + list row)
- Modify: `src/pages/Dashboard.tsx` (FilesView header/toolbar → chips + segmented button)
- Modify: `src/components/ui/MobileFolderCard.tsx` (if needed for grid parity)

- [ ] M3 list rows: 64px, 40px tonal leading, 2-line text, hover/press/selected.
- [ ] M3 grid cards: 16 radius, tonal preview field, type badge as tonal pill.
- [ ] Toolbar: filter chips + sort menu + segmented density + refresh.
- [ ] Verify 320px: no horizontal overflow.
- [ ] Commit.

### Task 7: Settings groups and overlays

**Files**
- Modify: `src/components/SettingsRow.tsx` (M3 grouped list, 48px tonal icon well, light-mode safe)
- Modify: `src/components/ui/dialog.tsx`, `sheet.tsx`, `sonner.tsx`, `dropdown-menu.tsx` (class names only → M3 surfaces)

- [ ] Rebuild `SettingsRow` / `SettingsCard` / `SettingsDivider`.
- [ ] Point Radix overlay classes at M3 tokens.
- [ ] Commit.

### Task 8: Verification

- [ ] `node scripts/gen_m3_theme.mjs --check` → PASS (both themes, all seeds).
- [ ] `python3 scripts/check_no_emoji.py` → clean.
- [ ] `npm run build` → succeeds.
- [ ] Render `/design` and the dashboard in Chromium at 1440, 768, 390 and 320: no overflow, no contrast failures, focus visible, seed switch repaints.
- [ ] Update `agent/state.json`, `agent/journal.md`, `agent/SUMMARY.md`; commit.

---

## Self-review

- Spec §5.1 color → Task 1; §5.2–5.5 → Task 2; §5.6 → Tasks 3/6; §5.7 → Tasks 1–2; §6.1 → Task 3; §6.2 → Task 4; §6.3 → Task 5; §6.4 → Task 6; §6.5 → Task 7; §7 → Tasks 2, 8.
- Review Focus items map to Task 7 (legacy hardcoded white), Task 7 (portal tokens), Task 6 (overflow/long names), Task 4 (mobile safe area), Task 3/4 (seed repaint).
