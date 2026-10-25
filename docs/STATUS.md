# Status

Only the lead edits this file. Last updated: October 26, 2026.

## Phases

| Phase             | State       | Note                                                                 |
| ----------------- | ----------- | -------------------------------------------------------------------- |
| 0 Handoff         | Done        | The rewrite started empty, with the documents and the design sources |
| 1 Foundation      | Done        | Frozen as tag ; qa signed off ()                                     |
| 2 Vertical slice  | Done        | Frozen as tag on October 26; bug M2-8 carried into M3                |
| 3 Feature bundles | In progress |                                                                      |
| 4 Polish          | Waiting     |                                                                      |
| 5 Later features  | Waiting     |                                                                      |

## Sessions

Since the power loss on October 25, Codex sessions do the members' work (), at
most four implementing at once, and a Claude session reviews (user decision; the
roles swap back when Codex's weekly usage falls to 20% or less). Paths outside a
member's own are changed only under a one-feature lead exception, named in the
task and the review document.

| Session           | Worktree | Works on now                                    |
| ----------------- | -------- | ----------------------------------------------- |
| lead (Claude)     |          | Plans, merges, pushes                           |
| reviewer (Claude) | shell's  | Reviews every request ( rules)                  |
| cx-data (Codex)   | reviewer | M3-T3a 매크로 execution, then contract requests |
| cx-output (Codex) | output   | M3-O9a live screen settings (output-25)         |
| cx-ui (Codex)     | ui       | M3-P2b song editor header, 구성, preview        |
| cx-spec (Codex)   | spec     | M3-S1b toolbar, media strip, narrow layout      |
| cx-qa (Codex)     | qa       | At set points only                              |
| cx-devops (Codex) | devops   | On request only                                 |

## Merge queue

Members push their own branches; GitHub's Windows runners verify each one, and a
review request needs a green run of its head. The lead merges approved requests
into local one at a time and pushes at a milestone freeze or a finished feature
bundle (). Open requests and their reviews are listed in each member's report;
the review documents record every verdict at merge.

## Review requests

| Review document            | Team member | Lead    | Reviewer                           | Merged  |
| -------------------------- | ----------- | ------- | ---------------------------------- | ------- |
| `docs/reviews/trial-1.md`  | trial       | Approve | Approve (Claude reviewer, round 2) | 24534c6 |
| `docs/reviews/devops-1.md` | devops      | Approve | Approve (Codex, round 3)           | 1298408 |
| `docs/reviews/devops-3.md` | devops      | Approve | Approve (Codex 0:6)                | 8d23708 |
| `docs/reviews/shell-1.md`  | shell       | Approve | Approve (Codex codex3, round 3)    | 13d88b1 |
| `docs/reviews/output-3.md` | output      | Approve | Approve (Codex codex2)             | 1f52d24 |
