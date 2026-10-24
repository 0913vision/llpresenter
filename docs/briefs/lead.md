# Brief: lead (team lead)

Right now, the session that handled phase 0 is the lead. Use this brief when a
new session takes over as the lead.

- Session name: lead
- Location: `D:\programming\2020-\pp`, branch `rewrite`
- Dev server port: 5173; app data folder: `D:\llp-dev\lead`
- Permission mode: permission prompts turned off

## Role

You're the team lead and take on the lead's responsibilities in
`docs/WORKFLOW.md`. You start team members, review, call the reviewer, and merge
into `rewrite`, by fast-forward only, only the branches that both of you
approved. You do the foundation work of phases 1 and 2 yourself.

## Pre-approved by the user

- Merging a team member's branch into `rewrite` with `git merge --ff-only`, once
  both the lead and the reviewer approve it and it's rebased onto the latest
  `rewrite`.
- Committing documents and shared files to `rewrite`.
- Starting team member sessions for a phase that the user said to start (same
  permission mode, own worktree, local).
- Pushing `rewrite` to `origin` after a merge (never a force push). Do the first
  push only after you confirm with the user that the repository is public.

## Needs separate approval

- Force pushes, pushes to other remote branches, deleting branches and
  worktrees, changing global settings, installing programs, and adding Codex.

## When you take over

1. Read `CLAUDE.md`, `docs/HANDOFF.md`, `docs/WORKFLOW.md`, `docs/PLAN.md`, and
   `docs/STATUS.md`.
2. Continue from "Next steps" in `docs/STATUS.md`. If team members are active or
   review requests are open, check their state first.

## Phase 1 order

1. Build the initial scaffold, commit it to `rewrite`, and push it (phase 1 in
   `docs/PLAN.md`).
2. Trial run: when the user says to start, start the trial session with
   `docs/briefs/trial.md`. When trial sends a review request, add one small
   commit to `rewrite` (for example, a `docs/STATUS.md` update) and ask trial to
   rebase, to check the rebase flow too. Call the reviewer once to check the
   review flow too. When both of you approve, merge.
3. Report the trial run results to the user. If there are problems, fix
   `docs/WORKFLOW.md`.
4. When the user says to start, start the devops session with
   `docs/briefs/devops.md`. At the same time, do the rest of the lead's phase 1
   share yourself.

## Calling the reviewer

- The reviewer is Codex in its own tmux window. Send each review request with
  `tmux send-keys` (set `MSYS_NO_PATHCONV=1` in Git Bash so a leading `/` isn't
  turned into a path), then a separate Enter, and read the verdict with
  `tmux capture-pane`. Start every prompt with the read-only rule: read with
  `git diff` and `git show` only, never edit files, commit, switch branches, or
  install anything. Ask for the verdict in the review document format.
- If Codex isn't available, start a fresh reviewer session in a tmux window, the
  same way as a team member, in a detached worktree at the reviewed commit
  (`git worktree add --detach .claude/worktrees/reviewer <branch>`). Never use a
  subagent.
- Give it: the path of the review document, the range of
  `git diff rewrite...<branch>`, the brief, the quality bar in `docs/TECH.md`,
  the code, comment, and review rules in `CLAUDE.md`, and the related spec and
  design system component docs.
- Get back: "Approve" or "Request changes," and a list of findings (file, line,
  reason, and the situation where it fails). Send it to the team member to paste
  into the reviewer section of the review document.
