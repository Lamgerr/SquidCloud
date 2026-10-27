# Summary

## Done (2026-10-27)
- LOC analysis for the workspace, excluding comments and markdown:
  - All non-md tracked text files: **249,950 code lines** (code = non-comment-only, non-blank), 11,754 comment lines, 23,576 blank lines, 1,142 files.
  - Bulk: TypeScript 796 files / 161,907 lines; then SQL 11,377, JS 5,380, CSS 5,296, HTML 4,627.
  - Data/generated artifacts inside that total: HAR web capture 17,194; package-lock.json x4 + Cargo.lock 25,877; from repo's own src, ~(about) 206,600 lines.
  - Markdown: 471 files / 97,673 lines excluded per request.
- Rigor notes: cloc 2.10 (comment-aware, string-safe); totals verified by summing language rows; HAR misclassification and Cargo.lock skip discovered and corrected by hand.

## In progress
- None.

## Blocked - needs a decision
- None.

## Queued next
- Nothing yet (cold start). Backlog generation not performed for this interactive query.
