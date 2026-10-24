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

| Name   | Branch                      | State                                | Brief                   |
| ------ | --------------------------- | ------------------------------------ | ----------------------- |
| lead   | `main`                      | Held by the phase 0 session          | `docs/briefs/lead.md`   |
| trial  | `docs/trial/workflow-check` | Merged (24534c6); continues as shell | `docs/briefs/trial.md`  |
| devops | `chore/devops/verify`       | Started                              | `docs/briefs/devops.md` |
| ui     | `feat/ui/form-controls`     | Started                              | `docs/briefs/ui.md`     |
| shell  | `feat/shell/column-resize`  | Started                              | `docs/briefs/shell.md`  |
| data   | `feat/data/schemas`         | Started                              | `docs/briefs/data.md`   |

## Next steps

1. Review the trial, devops, and ui requests as they arrive, with a fresh review
   agent each time, and merge them fast-forward.
2. The lead's share: data format schemas in `src/shared/`, column dragging and
   remembering, then switching the shell to the ui components after `ui-1`.
3. Bring the open questions in `docs/spec/README.md` to the user.

## Review requests

| Review document           | Team member | Lead    | Reviewer                           | Merged  |
| ------------------------- | ----------- | ------- | ---------------------------------- | ------- |
| `docs/reviews/trial-1.md` | trial       | Approve | Approve (Claude reviewer, round 2) | 24534c6 |
