# Agent rules

This file holds only the rules for AI agents working in this repository: what to
do, in what order, and what never to do. Information about the project is in
`README.md`; how code is written, tested, and committed is in `CONTRIBUTING.md`.

**Every message to the user is in Korean (합니다체), with no exception: reports,
answers, short progress notes, and questions. Messages to team members and to
Codex stay in English. Before you send anything to the user, check that it is
Korean. Don't use a playful tone.**

## Read first

1.  The team documents (workflow, your brief, milestones and file ownership, the
    member and review guides). They live outside the repository; the lead writes
    their folder to `.llp/team-dir` in your worktree.
2.  `README.md`, `CONTRIBUTING.md`, `docs/spec/` (behavior and data),
    `docs/TECH.md` (stack and quality bar), `docs/decisions.md` (decisions),
    `design/system/project/README.md` and the component docs (UI).

## Safety rules

Every session runs with permission prompts turned off, so follow these rules
without exception.

- Team members push only their own branches (`<tag>/<name>/<feature>`) to
  `origin`, so GitHub's runners verify them; after a rebase they push with
  `--force-with-lease` to their own branch only. Only the lead pushes `main`, in
  sensible work units; the pre-push hook checks commit messages only. Nobody
  pushes tags or force-pushes `main`. A merged branch is deleted from `origin`
  by the dispatcher or the lead, like a pull request's delete-after-merge;
  members never delete remote branches themselves.
- Never run `reset --hard`, rewrite history, or delete branches on `main`.
  Members rebase only their own branch, onto the local `main`. Nobody rebases
  `main` itself.
- Never change or delete files outside the repository or in another session's
  worktree.
- Never change global settings (`git config --global`, system settings, the
  registry, global npm packages).
- Never download and install programs. Add npm dependencies only when your brief
  allows them.
- Never write secrets such as tokens or passwords into files or messages.

## Team member rules

These rules are fixed until the current milestone is frozen. The lead changes
the process only at a milestone boundary, never in the middle of one.

- **Your files:** "File ownership" in the team's milestones document names who
  keeps each path, like code owners: the owner's rules apply to every change
  there, and the review checks them. You may change any path your request needs
  without asking first. List every change outside your own paths, with the
  reason, under "Outside my paths" in your pull request. Keep those changes to
  what the request needs; a larger change in someone else's area is that owner's
  request.
- **Shared contracts:** `src/core/schema/`, `src/contracts/`, and `src/preload/`
  are kept by data; the other `src/core/` folders belong to the feature that
  owns their domain. Additive changes (a new type, an optional field, a new IPC
  call in its area file) go in your own request, with schemas, valid and invalid
  tests, and caps, following data's conventions. A change that alters or removes
  an existing contract is tagged `break` and goes to data first.
- **Branches:** always work on your own branch (`<tag>/<name>/<feature>`). While
  one is in review, decide for yourself what to do next, as a developer on a
  real team would: start an independent ticket from the local `main`, stack on
  the open branch only when the next work really builds on it, and wait for the
  review when the open change is risky or likely to change (the team workflow,
  "Stacked branches"). Own your ticket until it merges; don't let it drag.
- **Before you push your branch:** rebase it onto the local `main`
  (`git rebase main`), not `origin/main`, which lacks the merges the lead hasn't
  pushed yet, and run `npx eslint --max-warnings 0` on the files you changed.
  Leave typecheck, tests, and verify to GitHub, which runs them on every pushed
  branch. Never poll CI.
- **Review request:** one ticket is one branch and one pull request: a short
  file outside git whose title becomes the one squashed commit on `main` (the
  member guide). When your branch's CI passes, message the lead. The lead
  decides how many reviewers and which ones review it. Resolve rebase conflicts
  yourself (for `package-lock.json`, take `main`'s file and run `npm install`).
  Answer findings once, one line each; nits go into your next branch.
- **Merging:** when the review passes, the lead squash-merges the branch onto
  the local `main`, one at a time, if its CI passed and it rebases cleanly onto
  `main`, even when other branches landed after its review. A conflict comes
  back to you.
- **Nothing about the process is committed:** no review files, check sheets,
  sample data for checks, screenshots, measurements, run logs, plans, status
  pages, briefs, or notes. Committed files hold the product only: code, tests,
  `docs/spec/`, `docs/TECH.md`, `docs/decisions.md`, the design system, README,
  and CONTRIBUTING. Process documents live in the team folder outside the
  repository.
- **Reporting:** send the lead one short message when your branch's CI passes,
  when you finish a task, when you're blocked, and when you have no work left.
  The lead gives you the next task. Don't wait silently.
- Use the dev server port and app data folder the lead gives you. Never let a
  window or an error dialog appear on the user's screen; check scripts with
  `node --check` before they start Electron.
- The lead alone edits `CLAUDE.md`, `docs/TECH.md`, `docs/decisions.md`, and the
  team documents; members change `docs/spec/` with their requests. The lead
  manages and doesn't write code.

## Context and compaction

A long conversation gets compacted, and then only a summary of it remains. Keep
what you need on disk, not in the conversation.

- Keep working notes in `.llp/notes.md` at your worktree root. Git ignores
  `.llp/`. The SessionStart hook (`scripts/session-context.ts`, set up in
  `.claude/settings.json`) prints your role, your notes, and the git state at
  every start, resume, and compaction.
- Use these sections: Task, Done, Now, Next, Waiting on, Facts not in the
  repository, Open questions. Rewrite what is stale instead of appending, and
  keep the file under 150 lines.
- Update the notes when you finish a step, before you send or answer a message,
  before you wait on anything, and as soon as you learn something that isn't
  written in the repository: a decision, an agent or session id, a port, the
  reason behind a choice.
- Write decisions other sessions need into `docs/decisions.md`; everything else
  about the process goes to the lead, not into the repository.
- Never put secrets in the notes.
- After a compaction, read your notes, your brief, and the files you were
  editing before you change anything. Trust the files over the summary.
- When you write a compaction summary, keep the current step and the next one,
  uncommitted files, the ids of agents and sessions you are waiting on, the
  user's decisions in their own words, and open questions.
