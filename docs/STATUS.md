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

| #   | Request                                         | Owner  | Codex window | State                         |
| --- | ----------------------------------------------- | ------ | ------------ | ----------------------------- |
| 1   | devops-3 lint-test speed fix                    | devops | 0:6          | Merged 8d23708                |
| 2   | ui-1 form controls                              | ui     | codex2       | Merged 982823a                |
| 3   | shell-1 column resize                           | shell  | codex3       | Merged 13d88b1                |
| 4   | data-1 schemas                                  | data   | codex2       | Merged 1a90661                |
| 5   | qa-1 M1 test plan                               | qa     | 0:6          | Merged c57f49d                |
| 6   | spec-1 shortcuts and settings                   | spec   | codex3       | Merged 63d0dbc                |
| 7   | output-1 displays and output windows (M2)       | output | 0:6          | Fixing round 2 finding        |
| 8   | devops-2 pre-push hook and version bot          | devops | codex3       | Merged 044d1fa                |
| 9   | ui-2 overlays                                   | ui     | codex4       | In review                     |
| 10  | data-5 ipc channels for shell and output        | data   | codex3       | In review, round 2            |
| 11  | data-2 settings schemas (data-3, data-4 next)   | data   | codex2       | In review, round 2            |
| 12  | spec-2 board list                               | spec   | codex3       | Fixing round 1 findings       |
| 13  | output-3 one-level undo fix (M2)                | output | codex2       | Merged 1f52d24                |
| 14  | shell-2 진행 workspace, first slice (M2)        | shell  | codex2       | Merged 3afbb50                |
| 15  | qa-2 M2 test plan                               | qa     | 0:6          | WIP, stacked on qa-1          |
| 16  | devops-4 lint test speedup                      | devops | codex2       | Merged cca7ea0                |
| 17  | output-4 bad LLP_USER_DATA (bug M1-1)           | output | codex2       | Merged 86f5926                |
| 18  | spec-3 M3 breakdown                             | spec   | 0:6          | In review, round 2            |
| 19  | spec-4 Bible translation format                 | spec   | codex3       | Fixing round 1 findings       |
| 20  | spec-5 decided shortcut rules in the spec files | spec   | codex4       | In review                     |
| 21  | shell-4 refit during a drag (bug M1-2)          | shell  | codex4       | In review                     |
| 22  | shell-5 진행 keys per spec-1 (M2)               | shell  | codex3       | In review                     |
| 23  | shell-6 장 panel header and size slider (M2)    | shell  | 0:6          | In review, stacked on shell-5 |
| 24  | shell-3 UI state IPC and app.json store         | shell  | codex2       | Waiting for data-5            |
| 25  | devops-5 soak judge trend (bug M1-3)            | devops | 0:6          | Fixing round 1 findings       |
| 26  | devops-6 npm run gallery without Electron       | devops | codex3       | In review                     |
| 27  | devops-7 soak recorder (M2)                     | devops | codex2       | In review                     |
| 28  | output-6 log flush and cap (bugs M1-4, M1-5)    | output | codex4       | In review                     |
| 29  | output-5 sleep prevention (M2)                  | output | 0:6          | Waiting for output-1          |
| 30  | output-2 render a 장 over video (M2)            | output | 0:6          | WIP, stacked on data-5        |
| 31  | ui-3 property parts (M2)                        | ui     | codex4       | Waiting for ui-2              |
| 32  | ui-4 진행 parts (M2)                            | ui     | codex4       | WIP                           |
| 33  | data-6 columns and canUndo contracts (M2)       | data   | codex3       | Planned after data-5          |

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
