# How an AI session works as a team member

`CLAUDE.md` binds every team member, whatever tool runs it. This file adds how a
session that can't send messages works with the lead.

## The loop

1. **Ticket:** the lead gives you one ticket at a time (a bug, or a unit of a
   plan). One ticket is one branch and, after the merge, one commit on `main`.
2. **Build it:** implement it with tests in your own worktree. Commit on your
   branch as often as you like; the commits are squashed at merge.
3. **Check before you push:** `npm run typecheck`, `npm run format:check`,
   `npx --no-install eslint <changed files>`, and
   `npx --no-install vitest related --run <changed source files>`. Push only
   when all four pass: `git push -u origin <branch>`, or `--force-with-lease`
   after a rebase. Never push `main` or tags. Never poll CI.
4. **Open the pull request:** write `.llp/pr/<name>.md` in your worktree (git
   ignores `.llp/`), at most about 30 lines:

   ```markdown
   # tag(scope): one sentence starting with a base-form verb

   - Why: the bug or the plan unit, in one or two lines.
   - What: the main changes, a few bullets.
   - Tests: what the new tests prove.
   - App check: one or two lines, only when the operator can see the change.
   - Look at: where the reviewer should look, and anything you're unsure of.
   - Outside my paths: changed files you don't own, with the reason.
   ```

   The title is the commit message `main` gets, so follow the commit rules in
   `CLAUDE.md`. Screenshots, if you need them, go in `.llp/pr/<name>/`. Then
   print the request line: `LLPREQ:<name>|<branch>|<base commit>|<round>`. What
   you do while it is reviewed is your call, as on a real team: an independent
   ticket from `main`, a branch stacked on it when the next work really builds
   on it, or waiting for the review when the change is risky or likely to
   change. You own the ticket until it merges; when something outside it slows
   you down (a flaky test, a conflict, an unclear spec), fix or report it
   quickly instead of letting the ticket drag.

5. **CI and review:** the dispatcher waits for your branch's CI run to pass,
   then sends the pull request to a reviewer. A failed run or the review verdict
   comes back to you as a message.
6. **Changes requested:** fix them on the same branch, add a
   `## Round <n> changes` list to the pull request file (one line per finding:
   what changed), push, and print the request line with the next round.
7. **Merge:** the dispatcher or the lead squash-merges the branch onto `main`
   with the pull request title. If your next branch was stacked on it, move it:
   `git rebase --onto main <old head of the merged branch> <next branch>`.

Nothing about the process goes into the repository: no review files, no
screenshots, no measurements, no local paths, user names, or ports. Committed
files hold the product: code, tests, specs, plans, and decisions.

## Talking to the lead

The lead reads your screen. When you finish a ticket, get blocked, or have no
work left, end your turn with a report of at most three lines:

```text
• Member report for <role>: <state> on <branch> at <commit>
- <what you did or what you need>
LLPDONE:<role>:<HHMMSS>
```

The last line is the marker the lead's watcher looks for: `LLPDONE:`, your role,
`:`, and the current local time as six digits, on a line of its own. Keep
`.llp/notes.md` short and current (`CLAUDE.md`, "Context and compaction").
