# Agent Guide: Working on SquidCloud UI/UX

> Read this before touching any page or component. It tells you how to make a change
> that is **consistent** with SquidCloud and does not make the UI worse. The design
> rules themselves are in `docs/UI-UX-STANDARD.md` — this file is the *how to work*.

---

## 0. Non-negotiable context

- Product: privacy-first cloud storage. Tone: quiet, confident, invisible.
- Reference feel: **tvOS** (focus, one thing leads, negative space) + **macOS**
  (dense but legible, chrome out of the way). Not a glassmorphism demo.
- Stack: React 18 + Vite + TypeScript + Tailwind 3 + `framer-motion` + Supabase.
- Themes: dark is the reference. Light exists and must not introduce white glass panels.
- **Zero emoji** in UI, code, comments, or commits.

---

## 1. Before you write code (read in this order)

1. `docs/UI-UX-STANDARD.md` — the source of truth (tiers, tokens, type, motion, states).
2. `.claude/rules/components.md`, `typography-and-spacing.md`, `tokens-and-color.md`,
   `accessibility.md` — deeper house rules.
3. The target file **and** its neighboring files — match the existing pattern; don't
   impose a new one.
4. `src/components/custom/squid-app.tsx` — `AppTheme` and the `--sa-*` CSS variables.
5. `src/components/FloatingDock.tsx` — the dock + activity sheet; this is where all
   upload/download feedback lives.

Then say (in your plan or first message) which rules apply to the change. If you cannot
find the relevant rule, stop and ask rather than inventing a style.

---

## 2. The make-it-better loop

### Step 1 — Diagnose before editing
- Reproduce or locate the exact problem. Read the error/message fully.
- Check `git status` and recent diffs: what changed, and is anything unrelated staged?
- For UI regressions, search for the **feedback owner**: if two surfaces report the same
  state (toast + panel, badge + banner), that is a bug.

### Step 2 — Decide the minimal surface
- Which single component owns this behavior? Change it, don't scatter edits.
- For transfers: the owner is always the dock activity sheet. Never add a second surface.
- For page chrome: `AppShell`, `TopBar`, `Wrap`, `Panel`, `Pill`, `Note`, `Spinner`, `Ico`,
  `btn` from `src/components/custom/squid-app.tsx` are the primitives. Reuse them.

### Step 3 — Implement to the standard
Checklist you MUST satisfy:
- [ ] Colors/spacing/type from `--sa-*` tokens (no hardcoded hex/px one-offs).
- [ ] One surface tier: near-black + hairline border + faint inset rim. No white fills.
- [ ] One lead element per screen; display type ≥ 2.5× body.
- [ ] Inline SVG icons (`currentColor`) or lucide; no emoji.
- [ ] Motion uses `framer-motion` springs + `useReducedMotion()`; no decorative loops.
- [ ] 8 states on every interactive element: default/hover/focus/active/disabled/loading/
      error/selected. `focus-visible` outline present.
- [ ] Keyboard: Escape closes, Arrows navigate menus, focus returns to trigger,
      `role`/`aria-*` correct, `aria-live` for async status.
- [ ] Copy: title + actionable description; no "Something went wrong" without a next step.

### Step 4 — Verify (do not skip)
```bash
npx tsc --noEmit                 # type errors
npm run lint                     # if available
git diff --stat                  # only intended files
git status --short               # no secrets / build artifacts / stray files
```
If the repo has design gates (`node scripts/verify_states.mjs <file>`,
`verify_responsive.mjs`, `accuracy_report.mjs`), run them and report real output — never
claim a number you did not measure. Then visually review: render in dark theme, exercise
each state, confirm the state actually changes. Check light theme if touched.

### Step 5 — Commit cleanly
- One focused commit, real message, no unrelated staged files.
- Do not commit `.env*`, keystores, captures (`*.har`), or `node_modules`.

---

## 3. Patterns specific to this repo

### 3.1 Where things live

| Concern | File(s) |
|---|---|
| App theme / CSS variables | `src/components/custom/squid-app.tsx` |
| Design tokens (source) | `tokens/*.json` (DTCG, primitive → semantic → component) |
| Floating dock + transfer sheet + glass tier | `src/components/FloatingDock.tsx` |
| Upload queue | `src/services/backgroundUpload.ts` (`addTask`, `removeTask`, `pauseAll`, `resumeAll`, `retryFailed`, `clearCompleted`, `subscribe`) |
| Download queue | `src/services/backgroundDownload.ts` |
| Full transfer center modal | `src/components/FullScreenTransferModal.tsx` |
| Dashboard layouts | `src/pages/Dashboard.tsx` (mobile branch ~line 1300, desktop ~1850) |
| Checkout | `src/pages/CheckoutPage.tsx` |
| Toast provider | `src/components/ui/toaster.tsx` + `useToast` |

### 3.2 Adding a create action to the dock
Pass it in the `actions` prop from Dashboard:
```tsx
actions={[{ id: 'new-folder', label: 'New folder', icon: <I.FolderPlus size={20} />, run: handleCreateFolder }]}
```
Use `Icons` from `FloatingDock.tsx` (or lucide) — never emoji. The `+` menu handles focus,
Escape, and staggered springs automatically.

### 3.3 Reporting transfer progress
Call `backgroundUploadService.addTask(...)`. Do nothing else. The dock subscribes and
updates the sheet. If you must surface a failure outside the dock, use a destructive toast
that says "Retry from the dock" — no success/progress toasts.

### 3.4 Changing the glass
Only `DOCK_CSS` in `FloatingDock.tsx` defines glass now. Keep `--g-fill` dark in both
themes. Do not restore `LiquidGlass` or add `backdrop-filter` panels to normal pages.

### 3.5 Page layout template
```
AppTheme  →  DragDropUpload  →  shell (sidebar + content)  →  FloatingDock + DropGlow
```
Dock and DropGlow mount once per rendered branch. Never mount the dock twice.

---

## 4. Common mistakes and their fixes

| Mistake | Fix |
|---|---|
| Added a toast for "queued"/"complete" | Delete it; the dock sheet owns it. |
| Second fixed transfer card appeared | Remove `BackgroundUploadPanel`; use dock sheet. |
| Screen looks washed-out/white | Remove `LiquidGlass`; check for `rgba(255,255,255,…)` fills. |
| Buttons feel laggy/linear | Use framer springs + brief hover/press scale, not long CSS eases. |
| Four equal cards / no focal point | Give one element size/weight; demote the rest to a list. |
| Emoji used as icon | Replace with inline SVG `Icons` or lucide. |
| Menu not keyboard accessible | Add Escape/Arrow handlers, focus return, `aria-expanded`. |
| Motion ignores reduced-motion | Add `useReducedMotion()` zero-duration variant. |
| Hardcoded color/px in a component | Move to `--sa-*` token or shared constant. |
| Changed two unrelated files | Split commits; keep diffs reviewable. |

---

## 5. Handoff template (copy/paste into your PR or summary)

```
Changed: <files>
Rule applied: <which sections of UI-UX-STANDARD.md>
Feedback owner: <dock sheet / toast / inline — name one>
States implemented: <list 8 or note which are N/A and why>
Motion: <spring preset + reduced-motion branch>
Verification: tsc <result>, lint <result>, screenshot <dark/light reviewed>
Not changed: <anything intentionally left alone and why>
```

---

## 6. Escalation

If a requested change would break a non-negotiable rule (e.g. "make the whole app glassy",
"add a second upload panel", "use emoji icons"), do not implement it silently. State which
rule it conflicts with and propose the closest compliant alternative. If three fix
attempts fail, stop and question the pattern rather than stacking more changes.
