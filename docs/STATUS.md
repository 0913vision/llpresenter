# Status

Only the lead edits this file. Last updated: October 25, 2026.

## Phases

| Phase             | State       | Note                                                                 |
| ----------------- | ----------- | -------------------------------------------------------------------- |
| 0 Handoff         | Done        | The rewrite started empty, with the documents and the design sources |
| 1 Foundation      | Done        | Frozen as tag `m1`                                                   |
| 2 Vertical slice  | In progress | Milestone M2                                                         |
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

The lead merges approved requests into local `main` one at a time and pushes to
GitHub only at a milestone freeze or a finished feature bundle
(`docs/decisions.md`). Codex windows (codex2 to codex5) review each request from
a one-line pointer to its review document (`docs/reviews/CODEX.md`).

M1 is frozen as tag `m1`. Open requests for M2:

| Request                                      | Owner  | State                                |
| -------------------------------------------- | ------ | ------------------------------------ |
| data-9 backups                               | data   | Fixing round 2 findings              |
| data-13 media library lookup                 | data   | WIP                                  |
| output-10 offscreen test switch              | output | WIP                                  |
| shell-12 진행 previews                       | shell  | Fixing round 1 findings              |
| ui-4 진행 parts                              | ui     | In review                            |
| ui-7 ClearButton, PreviewFrame, Notification | ui     | WIP                                  |
| devops-13 soak scenario and run              | devops | WIP, waits for data-13 and output-10 |

## Review requests

| Review document            | Team member | Lead    | Reviewer                           | Merged  |
| -------------------------- | ----------- | ------- | ---------------------------------- | ------- |
| `docs/reviews/trial-1.md`  | trial       | Approve | Approve (Claude reviewer, round 2) | 24534c6 |
| `docs/reviews/devops-1.md` | devops      | Approve | Approve (Codex, round 3)           | 1298408 |
| `docs/reviews/devops-3.md` | devops      | Approve | Approve (Codex 0:6)                | 8d23708 |
| `docs/reviews/shell-1.md`  | shell       | Approve | Approve (Codex codex3, round 3)    | 13d88b1 |
| `docs/reviews/output-3.md` | output      | Approve | Approve (Codex codex2)             | 1f52d24 |
