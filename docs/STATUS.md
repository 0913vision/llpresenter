# Status

Only the lead edits this file. Last updated: October 25, 2026.

## Phases

| Phase             | State       | Note                                                                 |
| ----------------- | ----------- | -------------------------------------------------------------------- |
| 0 Handoff         | Done        | The rewrite started empty, with the documents and the design sources |
| 1 Foundation      | In progress | Milestone M1; freezes as tag `m1` when the M1 queue items are merged |
| 2 Vertical slice  | In progress | Milestone M2; output and shell started                               |
| 3 Feature bundles | Waiting     | prep, output, tools                                                  |
| 4 Polish          | Waiting     |                                                                      |
| 5 Later features  | Waiting     |                                                                      |

## Sessions

| Name   | Branch                         | State                                 | Brief                     |
| ------ | ------------------------------ | ------------------------------------- | ------------------------- |
| lead   | `main`                         | Merges, reviews, pushes               | `docs/briefs/lead.md`     |
| devops | `chore/devops/version-bot`     | devops-2 round 2 (Codex findings)     | `docs/briefs/devops-2.md` |
| ui     | `feat/ui/form-controls`        | ui-1 round 2, then ui-2 stacked       | `docs/briefs/ui.md`       |
| shell  | `feat/shell/show-workspace`    | shell-2 in review                     | `docs/briefs/shell.md`    |
| data   | `feat/data/schemas`            | data-1 round 3, then data-ipc         | `docs/briefs/data.md`     |
| spec   | `docs/spec/shortcuts-settings` | spec-1 round 2, then spec-2 stacked   | `docs/briefs/spec.md`     |
| qa     | `docs/qa/m1-plan`              | qa-1 in review, then the M2 test plan | `docs/briefs/qa.md`       |
| output | `feat/output/windows`          | output-1 in review, then output-2     | `docs/briefs/output.md`   |

## Merge queue

The lead merges one branch at a time, in this order, after the lead and the
assigned Codex window approve. A branch that isn't ready yet doesn't block the
ones after it. The same Codex window reviews every round of a request.

| #   | Request                                     | Owner  | Codex window | State                   |
| --- | ------------------------------------------- | ------ | ------------ | ----------------------- |
| 1   | devops-3 lint-test speed fix                | devops | 0:6          | Merged 8d23708          |
| 2   | ui-1 form controls                          | ui     | codex2       | Fixing round 1 findings |
| 3   | shell-1 column resize                       | shell  | codex3       | Merged 13d88b1          |
| 4   | data-1 schemas                              | data   | codex2       | Fixing round 2 findings |
| 5   | qa-1 M1 test plan                           | qa     | 0:6          | In review               |
| 6   | spec-1 shortcuts and settings               | spec   | codex3       | Fixing round 1 findings |
| 7   | output-1 displays and output windows (M2)   | output | 0:6          | Queued after qa-1       |
| 8   | devops-2 pre-push hook and version bot      | devops | codex3       | Fixing round 1 findings |
| 9   | ui-2 overlays                               | ui     | codex2       | WIP, stacked on ui-1    |
| 10  | data-ipc: channels for shell-2 and output-2 | data   | codex3       | Waiting for the shapes  |
| 11  | data-2, data-3, data-4                      | data   | 0:6          | WIP                     |
| 12  | spec-2 board list                           | spec   | codex3       | WIP, stacked on spec-1  |
| 13  | output-3 one-level undo fix (M2)            | output | codex2       | Merged 1f52d24          |
| 14  | shell-2 진행 workspace, first slice (M2)    | shell  | codex2       | In review               |
| 15  | qa-2 M2 test plan                           | qa     | 0:6          | WIP                     |
| 16  | devops lint speedup                         | devops | codex3       | Planned after devops-2  |

M1 freezes when 1 to 6, 8, 9, and 11 are merged. The switch to GitHub pull
requests with rebase merges happens at that freeze, not before (it needs the
GitHub CLI on this computer).

## Review requests

| Review document            | Team member | Lead    | Reviewer                           | Merged  |
| -------------------------- | ----------- | ------- | ---------------------------------- | ------- |
| `docs/reviews/trial-1.md`  | trial       | Approve | Approve (Claude reviewer, round 2) | 24534c6 |
| `docs/reviews/devops-1.md` | devops      | Approve | Approve (Codex, round 3)           | 1298408 |
| `docs/reviews/devops-3.md` | devops      | Approve | Approve (Codex 0:6)                | 8d23708 |
| `docs/reviews/shell-1.md`  | shell       | Approve | Approve (Codex codex3, round 3)    | 13d88b1 |
| `docs/reviews/output-3.md` | output      | Approve | Approve (Codex codex2)             | 1f52d24 |
