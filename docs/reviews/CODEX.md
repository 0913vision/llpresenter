# How Codex reviews a request

The lead sends a Codex window one line:
`Review docs/reviews/<name>.md, round <n>. Follow docs/reviews/CODEX.md.`
Everything else is in this file and in the review document.

## Rules

- Read-only. Use only `git diff`, `git show`, `git log`, and reading files.
  Never edit files, commit, switch branches, run `npm install`, start the app,
  or push. Don't run tests or builds.
- Answer in English.

## What to read

1. The review document `docs/reviews/<name>.md` on the request's branch. Its top
   lists the team member, the branch, the review range (`base...head`), and the
   shared changes. For round 2 and later, read "Team member's reply" and check
   every earlier finding.
2. The diff of the review range only. Commits below the base belong to other
   requests.
3. The spec sections, design system READMEs, and briefs that the review document
   points to, and `CLAUDE.md`.

## What to check

- Behavior against `docs/spec/` and the design system in
  `design/system/project/`. A claim that something follows ProPresenter needs a
  cited source.
- Correctness: edge cases, error paths, races, and state that can be left behind
  (timers, listeners, flags, files).
- Stability for hours of use: nothing that grows without a cap, nothing created
  per 장 and left behind, and no exception that can stop the output.
- Validation of every value from outside the process.
- Tests: each new behavior and each fix has a test that would fail on the old
  code.
- The rules in `CLAUDE.md`: comments (TSDoc on exported APIs only,
  `NOTE(0913vision)` and `TODO(0913vision)` otherwise), design tokens, clean
  code, and commit messages.
- For a documents-only request: that each rule is exact enough to build and
  test, and consistent with the other spec files and merged code.

## Verdict

Approve when only nits remain. Reply in exactly this form:

```text
• Reviewer verdict for <name> (round <n>)
- Verdict: Approve | Request changes
- Findings:
  1. file:line problem. suggestion.
LLPDONE:<name>:<HHMMSS>
```

The last line is the marker the lead's watcher looks for: `LLPDONE:`, the review
name, `:`, and the current local time as six digits (for example
`LLPDONE:data-26:221240`), on a line of its own and nowhere else.

For round 1, the first line is `• Reviewer verdict for <name>` without the
round. Mark a finding that doesn't block with `Nit:`.
