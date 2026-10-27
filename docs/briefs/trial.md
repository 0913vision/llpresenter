# Brief: trial

- Session name: trial
- Branch: `docs/trial/workflow-check` (own worktree)
- Dev server port and app data folder: given by the lead (machine-specific, kept
  outside the repository).
- Phase: phase 1, after the initial scaffold lands on `rewrite`

## Goal

Confirm that the team workflow actually works on this Windows computer:
worktrees, installing dependencies, type checking and building, running the dev
app, review requests, messages, rebasing, and fast-forward merges.

## Tasks

0. Before anything else, rename your branch with
   `git branch -m docs/trial/workflow-check` if it has another name, then create
   `.llp/notes.md` as `CLAUDE.md` describes under "Context and compaction".
1. Record the worktree information: the path that
   `git rev-parse --show-toplevel` prints and its length in characters,
   `git branch --show-current`, and the base commit
   (`git merge-base HEAD rewrite`).
2. Run `npm ci`, and record how long it took and the size of `node_modules`.
3. Run `npm run typecheck`, `npm run format:check`, and `npm run build`, and
   record the results.
4. With `LLP_DEV_PORT=5190` and `LLP_USER_DATA=<trial folder>`, start
   `npm run dev` in the background and wait 20 seconds. Record the dev server
   address (port) and whether the Electron process started, then stop
   everything. Check that nothing collides even while the lead's dev app (5173)
   is running. After you stop everything, check that no Electron processes are
   left.
5. Write `docs/reviews/trial-1.md` from `docs/reviews/_template.md` with the
   results above, and commit it. Mark the quality checklist as not applicable.
6. Rebase onto the latest `rewrite`, then send the lead this message with
   SendMessage, and wait:

   ```text
   Review request: docs/reviews/trial-1.md, branch docs/trial/workflow-check, commit <hash>
   ```

7. If the lead adds one more commit to `rewrite` and asks you to rebase again,
   rebase (if conflicts occur, resolve them yourself), write the rebase result
   in "Team member's reply" in the review document, commit it, and notify the
   lead again.
8. When the lead says that the branch is merged, you're done.

## Out of scope

- Don't change code, configuration, or dependencies.
- Don't create or change any file other than this brief and the review document.

## Owned files

- `docs/reviews/trial-1.md`

## What to read

- `CLAUDE.md`, `docs/WORKFLOW.md`

## Done when

- The results of steps 1 to 8 are in the review document, and the branch is
  merged into `rewrite` by fast-forward.
- If something goes wrong (the path is too long, the install fails, a process
  doesn't stop, a message doesn't arrive), write it down as it is. Don't try to
  fix it.
