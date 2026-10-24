# Status

Only the lead edits this file. Last updated: October 25, 2026.

## Phases

| Phase             | State       | Note                                                                 |
| ----------------- | ----------- | -------------------------------------------------------------------- |
| 0 Handoff         | Done        | The rewrite started empty, with the documents and the design sources |
| 1 Foundation      | Done        | Frozen as tag `m1`; qa signed off (`docs/qa/m1-report.md`)           |
| 2 Vertical slice  | In progress | Milestone M2                                                         |
| 3 Feature bundles | Waiting     | prep, output, tools                                                  |
| 4 Polish          | Waiting     |                                                                      |
| 5 Later features  | Waiting     |                                                                      |

## Sessions

| Name   | Branch                         | State                                                       | Brief                   |
| ------ | ------------------------------ | ----------------------------------------------------------- | ----------------------- |
| lead   | `main`                         | Merges, reviews, pushes                                     | `docs/briefs/lead.md`   |
| devops | `feat/devops/soak-scenario`    | devops-13 round 3, then devops-16                           | `docs/briefs/devops.md` |
| ui     | `feat/ui/live-parts`           | ui-7 round 2, then ui-8 round 2                             | `docs/briefs/ui.md`     |
| shell  | `feat/shell/service-data`      | shell-14 round 3 after data's preload change, ui-4 adoption | `docs/briefs/shell.md`  |
| data   | M1-12 and the preload read fix | Then the M3-D1a contracts                                   | `docs/briefs/data.md`   |
| spec   | None                           | Findings only, no new tasks                                 | `docs/briefs/spec.md`   |
| qa     | `docs/qa/m2-notes`             | The M3 wave A test plan, retests                            | `docs/briefs/qa.md`     |
| output | `feat/output/restart-cooldown` | output-11 round 2, output-12 round 2, then the soak wiring  | `docs/briefs/output.md` |

## Merge queue

The lead merges approved requests into local `main` one at a time and pushes to
GitHub only at a milestone freeze or a finished feature bundle
(`docs/decisions.md`). Codex windows (codex2 to codex5) review each request from
a one-line pointer to its review document (`docs/reviews/CODEX.md`).

M1 is frozen as tag `m1` and signed off by qa. Open requests for M2:

| Request                                         | Owner       | State                                    |
| ----------------------------------------------- | ----------- | ---------------------------------------- |
| output-11 output restart cool-down              | output      | Round 2 in review                        |
| output-12 preview mode                          | output      | Fixing round 1 findings                  |
| ui-7 ClearButton, PreviewFrame, Notification    | ui          | Fixing round 1 findings                  |
| ui-8 gallery gaps                               | ui          | Fixing round 1 findings                  |
| shell-14 service data in the control window     | shell       | Waits for data's preload read fix        |
| data: `service.get` rejects on a read failure   | data        | WIP                                      |
| M1-12 one owner of `app.json`                   | data, shell | WIP (data first, then shell's `uiState`) |
| devops-13 soak scenario                         | devops      | Fixing round 2 findings                  |
| Soak wiring in `src/main/index.ts`              | output      | After devops-13                          |
| devops-16 verify rerun on worker start failures | devops      | After devops-13                          |
| qa section B: menu bar, search, status bar      | shell       | Queued                                   |
| 20-minute soak run                              | devops      | After the soak wiring                    |
| M2 run with the user on real monitors           | qa, lead    | Last                                     |

## Review requests

| Review document            | Team member | Lead    | Reviewer                           | Merged  |
| -------------------------- | ----------- | ------- | ---------------------------------- | ------- |
| `docs/reviews/trial-1.md`  | trial       | Approve | Approve (Claude reviewer, round 2) | 24534c6 |
| `docs/reviews/devops-1.md` | devops      | Approve | Approve (Codex, round 3)           | 1298408 |
| `docs/reviews/devops-3.md` | devops      | Approve | Approve (Codex 0:6)                | 8d23708 |
| `docs/reviews/shell-1.md`  | shell       | Approve | Approve (Codex codex3, round 3)    | 13d88b1 |
| `docs/reviews/output-3.md` | output      | Approve | Approve (Codex codex2)             | 1f52d24 |
