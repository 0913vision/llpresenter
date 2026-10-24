# Review request: `trial-1`

- Team member: `trial`
- Branch: `docs/trial/workflow-check`
- Base commit (`rewrite`): `b8a189fbb646fdfd4367f1a80ab3d3cb9cb0380e`
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
- Duration: about 70 seconds at most. I started it in the background at 21:37:29
  and saw it finished by 21:38:50. I did not wrap it in a timer, so the exact
  value is not known.
- `node_modules` is 254 MB (104 top-level entries).

### Checks (task 3)

| Command                | Result                                        |
| ---------------------- | --------------------------------------------- |
| `npm run typecheck`    | Passed, exit 0, 9 s                           |
| `npm run format:check` | Passed, exit 0, 9 s                           |
| `npm run build`        | Passed, exit 0, 3 s (main, preload, renderer) |

### Dev app (task 4)

I ran `npm run dev` with `LLP_DEV_PORT=5190` and
`LLP_USER_DATA=D:\llp-dev\trial`, and waited 20 seconds.

- The dev server started at `http://localhost:5190/`, so the port variable
  works.
- **The Electron process did not start.** electron-vite failed with
  `Error: Electron uninstall` (thrown from `getElectronPath`). The package
  `electron` 44.9.3 is in `node_modules`, but `node_modules/electron/dist` does
  not exist, so the Electron binary was not downloaded during `npm ci`. I did
  not try to fix it, as the brief says.
- The dev command exited by itself after the error. Afterwards no node process
  from this worktree remained, nothing listened on port 5190, and there were no
  `electron` processes.
- `D:\llp-dev\trial` was not created, because the app never started. So
  `LLP_USER_DATA` is untested.
- The collision check with the lead's dev app (5173) could not be done. Port
  5173 was not listening and no Electron was running at that time.

## Changed files

- `docs/reviews/trial-1.md` (new)

## Checks run

| Command or test                    | Result                                 |
| ---------------------------------- | -------------------------------------- |
| `npm run typecheck`                | Passed                                 |
| `npm test`                         | Not run (not in the brief's task list) |
| `npm run format:check`             | Passed                                 |
| `npm run verify` (from phase 1 on) | Not available yet                      |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

Not applicable. This change is a document only.

## Decisions I made (for the lead to confirm)

- None. I recorded the Electron failure and did not change anything.

## Shared contract change requests

- Electron's binary is missing after `npm ci`, so the dev app cannot start in a
  new worktree. Please check whether the install script is blocked (for example
  by an `ignore-scripts` setting or a failed download) and decide the fix in
  `package.json` or the setup notes. This affects every member.

## Where to look

- The "Dev app" section above, especially the Electron failure.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1.
