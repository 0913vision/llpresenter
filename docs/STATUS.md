# Status

Only the lead edits this file. Last updated: October 26, 2026.

## Phases

| Phase             | State       | Note                                                         |
| ----------------- | ----------- | ------------------------------------------------------------ |
| 0 Handoff         | Done        | The rewrite started empty, with the documents and the design |
| 1 Foundation      | Done        | Frozen as tag `m1`; qa signed off (`docs/qa/m1-report.md`)   |
| 2 Vertical slice  | Done        | Frozen as tag `m2` on October 26; bug M2-8 carried into M3   |
| 3 Feature bundles | In progress | `docs/plans/m3-breakdown.md`                                 |
| 4 Polish          | Waiting     |                                                              |
| 5 Later features  | Waiting     |                                                              |

## Sessions

On October 26 at 08:10, Codex's weekly usage ran low, so Claude sessions took
over the members' work in the same worktrees, at most four implementing at once
(user decision). Two Claude reviewers review; the lead routes each request to
one of them, and later rounds stay with the round-1 reviewer. Ownership works
like code owners (`CLAUDE.md`, "Your files").

| Session             | Worktree   | Works on now                                    |
| ------------------- | ---------- | ----------------------------------------------- |
| lead (Claude)       | `main`     | Plans, routing, merges, pushes                  |
| reviewer A (Claude) | shell's    | Renderer requests (ui, 진행, 준비)              |
| reviewer B (Claude) | review2    | Main process, contracts, documents              |
| data (Claude)       | reviewer   | Nested dispatch rejection, close handshake      |
| output (Claude)     | output     | M3-O8 recovery part 2, then the rest of O4      |
| ui (Claude)         | ui         | M3-P3a item panel and 항목 설정                 |
| 진행 work (Claude)  | spec       | M3-S1b narrow layout, then M3-S2a notifications |
| qa, devops (Codex)  | qa, devops | Idle; on request only                           |

## Merge queue

Members push their own branches; GitHub's Windows runners verify each one, and a
review request needs a green run of its head. The lead merges approved requests
into local `main` one at a time and pushes at a milestone freeze or a finished
feature bundle (`docs/decisions.md`). Each review document records its verdicts
at merge.

## Review requests

| Review document            | Team member | Lead    | Reviewer                           | Merged  |
| -------------------------- | ----------- | ------- | ---------------------------------- | ------- |
| `docs/reviews/trial-1.md`  | trial       | Approve | Approve (Claude reviewer, round 2) | 24534c6 |
| `docs/reviews/devops-1.md` | devops      | Approve | Approve (Codex, round 3)           | 1298408 |
| `docs/reviews/devops-3.md` | devops      | Approve | Approve (Codex 0:6)                | 8d23708 |
| `docs/reviews/shell-1.md`  | shell       | Approve | Approve (Codex codex3, round 3)    | 13d88b1 |
| `docs/reviews/output-3.md` | output      | Approve | Approve (Codex codex2)             | 1f52d24 |
