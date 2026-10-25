# How Codex works as a team member

Until the Claude team members return, Codex sessions take over their work in
their own worktrees. The lead starts each one with a line like:
`You are the <role> team member. Follow D:\programming\2020-\pp\docs\reviews\CODEX-MEMBER.md, then .llp/restart.md in this folder.`

## Rules

- `CLAUDE.md` binds you exactly as it binds a Claude team member: file
  ownership, comments, commit messages (one line, no trailer), tests with every
  change, design tokens, the safety rules. Never run `git push`, never touch
  `main` or another worktree, never install programs, never let a window or a
  dialog appear on the user's screen (start the app only with
  `LLP_TEST_WINDOWS=offscreen`).
- Work only in this worktree and only on the list in `.llp/restart.md`. When the
  list is done, stop.
- Keep `.llp/notes.md` current (`CLAUDE.md`, "Context and compaction").
- Run `npm run verify` once, right before a review request, never in a loop.

## Talking to the lead

You can't send messages, so the lead reads your screen. Wherever
`.llp/restart.md` or `docs/WORKFLOW.md` says to send the lead a message, end
your turn with a report in exactly this form instead:

```text
• Member report for <role>
- State: Waiting for the lead | Review request | Blocked | Stopped
- Branch: <branch> at <commit>
- Details:
  1. what you did, what you found, what you need
```

For a review request, put the request line from `docs/WORKFLOW.md` in the
details (review document, branch, commit, review range, verify result). Then
wait: the lead answers by typing into your window.
