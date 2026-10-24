# Review request: `trial-1`

- Team member: `trial`
- Branch: `docs/trial/workflow-check`
- Base commit (`rewrite`): `663b0b8`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/trial.md`

## What changed and why

This change adds only this document. It records whether the team workflow works
on this computer (brief tasks 1 to 7). Task 8 waits for the merge. No code,
configuration, or dependency changed.

### Worktree (task 1)

| Item                            | Value                                                                      |
| ------------------------------- | -------------------------------------------------------------------------- |
| `git rev-parse --show-toplevel` | `D:/programming/2020-/pp/.claude/worktrees/trial`                          |
| Path length                     | 47 characters                                                              |
| `git branch --show-current`     | `docs/trial/workflow-check`                                                |
| `git merge-base HEAD rewrite`   | `b8a189fbb646fdfd4367f1a80ab3d3cb9cb0380e` (at task 1, before the rebases) |

### Install (task 2)

- `npm ci` exited with code 0 and reported 0 vulnerabilities.
- First run (before the Electron fix): at most about 80 seconds, estimated. I
  started it in the background at 21:37:29 and saw it finished by 21:38:50.
  `node_modules` was 254 MB.
- Second run (after rebasing onto `rewrite` 2f36647, which includes the Electron
  fix 2235096): `time npm ci` printed `real 1m19.778s`, exit 0. `node_modules`
  was 623 MB. The jump of about 370 MB is the Electron binary in
  `node_modules/electron/dist`.
- Third run (after rebasing onto `rewrite` 663b0b8, commit efcebca):
  `time npm ci` printed `real 1m8.193s`, exit 0, 0 vulnerabilities.

### Checks (task 3)

First run, on b8a189f (before the Electron fix), exit 0 for all three:

- `npm run typecheck`: 9 s
- `npm run format:check`: 9 s
- `npm run build`: 3 s (main, preload, renderer)

The latest results, on the rebased commit efcebca (base 663b0b8), are in "Checks
run".

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

### Messages and rebases (tasks 6 and 7)

| Step | What happened                                                                                                               |
| ---- | --------------------------------------------------------------------------------------------------------------------------- |
| 1    | I rebased onto `rewrite` (already at the tip, no change) and sent the request for ff57392 with SendMessage. It arrived.     |
| 2    | The lead answered "Request changes" (Electron bug on `rewrite`). The answer arrived as a cross-session message.             |
| 3    | I rebased onto 2f36647 (no conflicts), reran task 4, and sent the request for ada76bb. It arrived.                          |
| 4    | The lead answered "Approve" and asked for a rebase onto c2775d8. I rebased (no conflicts) and sent the request for de8dc41. |
| 5    | The lead told me to wait for the reviewer. The reviewer answered "Request changes", relayed by the lead.                    |
| 6    | I rebased onto 663b0b8 (3 commits replayed, no conflicts), reran all checks, and sent the request again.                    |

Every message I sent arrived, and every answer came back by the same route
(cross-session messages through the lead). The hashes of my commits change at
each rebase. Step 8 (merge) is not done yet.

## Changed files

- `docs/reviews/trial-1.md` (new)

## Checks run

All on commit efcebca (rebased onto `rewrite` 663b0b8; the later commits on this
branch change only this document).

| Command or test                    | Result                                     |
| ---------------------------------- | ------------------------------------------ |
| `npm ci`                           | Passed, `real 1m8.193s`, 0 vulnerabilities |
| `npm run typecheck`                | Passed, exit 0                             |
| `npm test`                         | Passed, 8 files, 33 tests, 7.23 s          |
| `npm run format:check`             | Passed, exit 0                             |
| `npm run build`                    | Passed, exit 0                             |
| `npm run verify` (from phase 1 on) | Not available yet                          |

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

- Verdict: Request changes
- Reviewed commit: ada76bb (detached worktree), range
  rewrite...docs/trial/workflow-check
- Findings:
  1. docs/reviews/trial-1.md:5 The header "Base commit (rewrite)" still says
     b8a189f. The reviewed commit ada76bb sits on 2f36647 (git merge-base HEAD
     rewrite = 2f3664791b5a), and the branch tip 6e6ec48 now sits on c2775d8.
     Update the header to the current base, and label the value at line 22 as
     "at task 1, before the rebases" so the two values don't contradict each
     other.
  2. docs/reviews/trial-1.md:35-39 and 72-74 The checks were not rerun after the
     rebase. The task 3 table doesn't say which run it comes from, while "Checks
     run" says "first run, before the fix". The rebase brought in package.json
     (2235096, postinstall) and src/renderer/src/styles/tokens.css (2f36647),
     and WORKFLOW.md step 3 requires the checks after the rebase and before the
     request. Rerun npm run typecheck, npm run format:check, and npm run build
     on the rebased commit, and record the results with the commit they ran on.
  3. docs/reviews/trial-1.md:73 npm test is marked "Not run (not in the brief's
     task list)". CLAUDE.md "Checks" and WORKFLOW.md step 3 list it as a
     required check before every review request, package.json has "test":
     "vitest run", and 7 test files exist. The trial checks that the workflow
     works, so run it together with finding 2 and record the result.
  4. docs/reviews/trial-1.md:12 and 89-91 The brief's "Done when" asks for the
     results of steps 1 to 8, and its goal names messages and review requests,
     but the document covers only tasks 1 to 4 plus one rebase (reply item 4).
     Add whether each SendMessage review request arrived and how the lead's
     answer came back (task 6), and the result of every rebase (task 7),
     including the latest one onto c2775d8 that moved the tip from ada76bb to
     6e6ec48. Step 8 can wait until the merge.
  5. Nit: docs/reviews/trial-1.md:29 "rewrite 2f36647, which downloads Electron"
     reads as if 2f36647 were the fix. 2f36647 adds the --type-* token
     variables; the download comes from 2235096, which it includes. Suggest
     "rewrite 2f36647, which includes the Electron fix 2235096". At line 31,
     also say what the 254 MB to 623 MB jump is (presumably
     node_modules/electron/dist).
  6. Nit: docs/reviews/trial-1.md:27-28 "at most about 80 seconds, estimated"
     dropped the evidence the first commit had (started 21:37:29, seen finished
     by 21:38:50). Keep the two timestamps so the reader knows where 80 seconds
     comes from.
- Checked and fine: both commit messages follow the format; branch name follows
  <tag>/<name>/<feature>; ASCII, LF, final newline, no trailing whitespace, no
  middle dots or em dashes; task 4 claims match the repository and disk
  (D:\llp-dev\trial\logs\main.log shows "INFO started" with electron 44.9.3);
  range-diff shows the move onto c2775d8 needs no new review.
- Why not approve: the document is the whole deliverable of this change, the
  header base commit is wrong, and the checks and step 6 and 7 results that the
  workflow and the brief require are missing. Each fix is small.

## Team member's reply

Replies to the lead's round 1:

1. Finding 1: Acknowledged. Nothing to change in this branch.
2. Finding 2: Done. I rebased onto `rewrite` 2f36647 (no conflicts), ran
   `npm ci` again, and redid task 4. See "Dev app (task 4)".
3. Finding 3: Done. `time npm ci` printed `real 1m19.778s`. See "Install".
4. Rebase result: `git rebase rewrite` succeeded without conflicts.
5. Second rebase (brief step 7): I rebased onto `rewrite` c2775d8 (two commits
   that add design tokens), with no conflicts, because this branch only touches
   this document.

Replies to the reviewer:

1. Finding 1: Done. The header base commit is `663b0b8`, and the task 1 value is
   labeled "at task 1, before the rebases".
2. Finding 2: Done. I reran `typecheck`, `format:check`, and `build` on the
   rebased commit efcebca, and "Checks run" says which commit they ran on. The
   task 3 section says its numbers come from the first run on b8a189f.
3. Finding 3: Done. `npm test` passed (8 files, 33 tests). It is now in "Checks
   run".
4. Finding 4: Done. See "Messages and rebases (tasks 6 and 7)". Step 8 waits for
   the merge.
5. Finding 5: Done. The text now says 2f36647 includes the Electron fix 2235096,
   and the 254 MB to 623 MB jump is `node_modules/electron/dist`.
6. Finding 6: Done. The two timestamps are back in "Install".
7. Rebase onto 663b0b8 (the latest `rewrite`): succeeded without conflicts, 3
   commits replayed.
