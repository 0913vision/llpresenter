# Status

Only the lead edits this file. Last updated: October 24, 2026.

## Phases

| Phase             | State       | Note                                                                                                                  |
| ----------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| 0 Handoff         | Done        | The rewrite started empty, with the documents and the design sources                                                  |
| 1 Foundation      | In progress | Initial frame, formatter, and session notes hook committed. Next: trial, then devops and the rest of the lead's share |
| 2 Vertical slice  | Waiting     |                                                                                                                       |
| 3 Feature bundles | Waiting     | prep, output, tools                                                                                                   |
| 4 Polish          | Waiting     |                                                                                                                       |
| 5 Later features  | Waiting     |                                                                                                                       |

## Sessions

| Name   | Branch                         | State                                | Brief                   |
| ------ | ------------------------------ | ------------------------------------ | ----------------------- |
| lead   | `main`                         | Held by the phase 0 session          | `docs/briefs/lead.md`   |
| trial  | `docs/trial/workflow-check`    | Merged (24534c6); continues as shell | `docs/briefs/trial.md`  |
| devops | `chore/devops/verify`          | Started                              | `docs/briefs/devops.md` |
| ui     | `feat/ui/form-controls`        | Started                              | `docs/briefs/ui.md`     |
| shell  | `feat/shell/column-resize`     | Started                              | `docs/briefs/shell.md`  |
| data   | `feat/data/schemas`            | Started                              | `docs/briefs/data.md`   |
| spec   | `docs/spec/shortcuts-settings` | Started                              | `docs/briefs/spec.md`   |
| qa     | `docs/qa/m1-plan`              | Started (M1 test plan)               | `docs/briefs/qa.md`     |
| output | `feat/output/windows`          | Started (M2)                         | `docs/briefs/output.md` |

## Merge queue

The lead merges one branch at a time, in this order, after the lead and the
assigned Codex window approve. A branch that isn't ready yet doesn't block the
ones after it. The same Codex window reviews every round of a request.

| #   | Request                                     | Owner  | Codex window | State                        |
| --- | ------------------------------------------- | ------ | ------------ | ---------------------------- |
| 1   | lint-test speed fix (`fix/devops/...`)      | devops | 0:6          | being written                |
| 2   | ui-1 form controls                          | ui     | codex2       | ready to send                |
| 3   | shell-1 column resize, round 3              | shell  | codex3       | nits fixed, tests to confirm |
| 4   | data-1 schemas, round 2                     | data   | codex2       | fixing Codex findings        |
| 5   | qa-1 M1 test plan                           | qa     | 0:6          | ready to send                |
| 6   | spec-1 shortcuts and settings, round 2      | spec   | codex3       | fixing Codex findings        |
| 7   | output-1 displays and output windows (M2)   | output | 0:6          | finishing checks             |
| 8   | devops-2 pre-push hook and version bot      | devops | codex2       | WIP                          |
| 9   | ui-2 overlays                               | ui     | codex2       | WIP, stacked on ui-1         |
| 10  | data-ipc: channels for shell-2 and output-2 | data   | codex3       | waiting for the shapes       |
| 11  | data-2, data-3, data-4                      | data   | codex2       | WIP                          |
| 12  | spec-2 board list                           | spec   | codex3       | WIP, stacked on spec-1       |

M1 freezes when 1 to 6, 8, 9, and 11 are merged. The switch to GitHub pull
requests with rebase merges happens at that freeze, not before (it needs the
GitHub CLI on this computer).

## Review requests

| Review document           | Team member | Lead    | Reviewer                           | Merged  |
| ------------------------- | ----------- | ------- | ---------------------------------- | ------- |
| `docs/reviews/trial-1.md` | trial       | Approve | Approve (Claude reviewer, round 2) | 24534c6 |
