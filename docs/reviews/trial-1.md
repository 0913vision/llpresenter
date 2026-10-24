# Review request: `trial-1`

- Team member: `trial`
- Branch: `docs/trial/workflow-check`
- Base commit (`rewrite`): `c2775d8`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/trial.md`

## What changed and why

This change adds only this document. It records whether the team workflow works
on this computer (brief tasks 1 to 4). No code, configuration, or dependency
changed.

### Worktree (task 1)

| Item                            | Value                                             |
| ------------------------------- | ------------------------------------------------- |
| `git rev-parse --show-toplevel` | `D:/programming/2020-/pp/.claude/worktrees/trial` |
| Path length                     | 47 characters                                     |
| `git branch --show-current`     | `docs/trial/workflow-check`                       |
| `git merge-base HEAD rewrite`   | `b8a189fbb646fdfd4367f1a80ab3d3cb9cb0380e`        |

### Install (task 2)

- `npm ci` exited with code 0 and reported 0 vulnerabilities.
- First run (before the Electron fix): at most about 80 seconds, estimated,
  `node_modules` 254 MB.
- Second run (after rebasing onto `rewrite` 2f36647, which downloads Electron):
  `time npm ci` printed `real 1m19.778s`, exit 0, 0 vulnerabilities.
  `node_modules` is 623 MB, and `node_modules/electron/dist` exists.

### Checks (task 3)

| Command                | Result                                        |
| ---------------------- | --------------------------------------------- |
| `npm run typecheck`    | Passed, exit 0, 9 s                           |
| `npm run format:check` | Passed, exit 0, 9 s                           |
| `npm run build`        | Passed, exit 0, 3 s (main, preload, renderer) |

### Dev app (task 4)

First run, before the fix: the dev server started on 5190, but Electron failed
with `Error: Electron uninstall` because `node_modules/electron/dist` was
missing. The lead fixed this on `rewrite` in 2235096.

Second run, after the rebase and the second `npm ci`, with `LLP_DEV_PORT=5190`
and `LLP_USER_DATA=D:\llp-dev\trial`, waiting 20 seconds:

- The dev server listened on `http://localhost:5190/`.
- Electron started. The log printed `starting electron app...` and
  `INFO started {"version":"0.2.0","electron":"44.9.3"}`.
- `D:\llp-dev\trial` was created and filled with Chromium data, so
  `LLP_USER_DATA` works.
- Collision check: while the lead's dev app ran (port 5173, process 52044, with
  `--user-data-dir="D:\llp-dev\lead"`), both apps ran side by side. The
  processes of each app had their own `--user-data-dir` (`lead` and `trial`),
  and the ports 5173 and 5190 were both listening. Nothing collided.
- Cleanup: I stopped only the processes whose command line contains this
  worktree path. Afterwards no node or electron process of this worktree was
  left, port 5190 was no longer listening, and the lead's app was untouched
  (port 5173 still listening, 3 Electron processes with `D:\llp-dev\lead`).

## Changed files

- `docs/reviews/trial-1.md` (new)

## Checks run

| Command or test                    | Result                                 |
| ---------------------------------- | -------------------------------------- |
| `npm run typecheck`                | Passed (first run, before the fix)     |
| `npm test`                         | Not run (not in the brief's task list) |
| `npm run format:check`             | Passed (first run, before the fix)     |
| `npm run verify` (from phase 1 on) | Not available yet                      |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

Not applicable. This change is a document only.

## Decisions I made (for the lead to confirm)

- None.

## Shared contract change requests

- None. The Electron binary problem I reported is fixed on `rewrite`.

## Where to look

- The "Dev app" section above, especially the collision check and cleanup.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: lead

- Verdict: Approve
- Findings:
  1. All three round-1 findings are addressed: the rerun after the Electron fix,
     the dev app with its own port and app data folder, the collision check with
     the lead's app, the leftover-process check, and a timed `npm ci`.

Round 1 (5f6ce06):

- Verdict: Request changes
- Findings:
  1. The Electron failure is a bug in `rewrite`, not in this branch. Electron 44
     no longer downloads its binary on install, and electron-vite reads the
     binary path directly. Fixed on `rewrite` in 2235096
     (`postinstall: install-electron`), recorded in `docs/decisions.md`.
     Verified by the lead in a fresh worktree: `npm ci` downloads the binary and
     `npm run dev` reaches "smoke ok".
  2. Redo task 4 after rebasing: the dev app with `LLP_DEV_PORT=5190` and
     `LLP_USER_DATA=D:\llp-dev\trial`, the collision check against the lead's
     dev app, and the leftover-process check.
  3. Record the `npm ci` time again with a real timer (for example
     `time npm ci`), since the first number was an estimate.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1. Finding 1: Acknowledged. Nothing to change in this branch.
2. Finding 2: Done. I rebased onto `rewrite` 2f36647 (no conflicts), ran
   `npm ci` again, and redid task 4. See "Dev app (task 4)".
3. Finding 3: Done. `time npm ci` printed `real 1m19.778s`. See "Install".
4. Rebase result: `git rebase rewrite` succeeded without conflicts.
5. Second rebase (brief step 7): I rebased onto `rewrite` c2775d8 (two commits
   that add design tokens). The base commit is now c2775d8. There were no
   conflicts, because this branch only touches this document.
