## 2026-10-27 - LOC analysis (interactive query)
- Task: count lines of code excluding comments and markdown.
- Method: git ls-files (ex *.md(x)) -> cloc 2.10 Perl script downloaded from AlDanial/cloc tag v2.10 (relied on raw.githubusercontent.com Availability). cloc comment handling is state-machine-based (string/template-safe), so comment counts are trustworthy.
- Corrections verified: .har capture (17,194 lines) was counted as JSON -> separated; Cargo.lock (2,115 raw lines) silently skipped by cloc -> added manually where noted; teardown confirmed language rows sum exactly to 249,950.
- Key result: 249,950 code lines across 1,142 non-md text files (+2,115 Cargo.lock raw = ~252,065 all-text); approx 206,640 lines when generated/data artifacts (lockfiles, HAR, BIP39 wordlist, l0g.txt dump, egg-info, robots) are excluded.
- Next: nothing queued (cold start; interactive query, no backlog item picked).
