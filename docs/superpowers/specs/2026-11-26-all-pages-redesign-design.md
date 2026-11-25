# All-pages redesign — short design

## Intent
Every route except `/`, `/pricing`, `/checkout` should feel like one product: quiet, monochrome, symmetric, and navigable through the same floating glass chrome used by the Dashboard Files tab and AccountSettings.

## Goals
- Fix input text-selection outlines.
- One floating glass navigation primitive with spring physics (layoutId thumb, 380/21/0.8; tap 600/16).
- Centred, symmetric content shells; one lead element per screen; no white tints, no coloured accents, no stacked boxes.
- Preserve every handler, route, and data flow.

## Non-goals
- `/`, `/pricing`, `/checkout` (excluded by user).
- Rewriting auth logic, security logic, or edge functions.

## Constraints
- Must build with Vercel (`vercel --prod --yes`).
- No emoji; SVG icons only via `currentColor`.
- Reduced motion must stay honoured.

## Approach chosen
A shared `GlassNav` component plus a global `page-frame` CSS layer. A single source of truth for the floating bar; page groups only swap content, not chrome. This was chosen over per-page bespoke headers because it guarantees consistency and is the cheapest path across 40 routes.

## What is left to builders
Apply `GlassNav`/`page-frame` to each assigned page group without changing logic; verify with a build and a live screenshot where possible.
