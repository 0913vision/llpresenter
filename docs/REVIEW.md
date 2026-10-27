# How a reviewer reviews a pull request

The lead's dispatcher sends a reviewer session one line:
`Review the pull request <file> (branch <branch>, range <base>...<branch>, round <n>). Follow docs/REVIEW.md.`

A pull request is a short file in the author's worktree, outside git
(`.llp/pr/<name>.md`), plus the commits in the range. Its CI run has already
passed when you get it.

## Rules

- Read-only. Use only `git diff`, `git show`, `git log`, and reading files.
  Never edit files, commit, switch branches, run `npm install`, start the app,
  or push. Don't run tests or builds.
- Answer in English.

## What to read

1. The pull request file: title, why, what changed, how it was tested, and where
   to look. For round 2 and later, its "Round <n> changes" list answers your
   earlier findings.
2. The diff of the range only. Commits below the base belong to other requests.
3. The spec sections, design system READMEs, and briefs it points to, and
   `CLAUDE.md`.

## What to check

- Behavior against `docs/spec/` and the design system in
  `design/system/project/`. A claim that something follows ProPresenter needs a
  cited source.
- Correctness: edge cases, error paths, races, and state that can be left behind
  (timers, listeners, flags, files).
- Stability for hours of use: nothing that grows without a cap, nothing created
  per slide and left behind, and no exception that can stop the output.
- Validation of every value from outside the process.
- Tests: each new behavior and each fix has a test that would fail on the old
  code.
- The rules in `CLAUDE.md`: comments, design tokens, clean code, and the pull
  request title, which becomes the one squashed commit on `main`.
- For a change the operator can see: the pull request says how it was checked in
  the app. Screenshots, if any, are next to the file in `.llp/pr/<name>/`.

Review the code, not the paperwork. Don't ask for longer descriptions, more
screenshots, or measurements unless a real risk needs them. Approve when only
nits remain.

## Verdict

Reply in exactly this form:

```text
• Reviewer verdict for <name> (round <n>)
- Verdict: Approve | Request changes
- Findings:
  1. file:line problem. suggestion.
LLPDONE:<name>:<HHMMSS>
```

For round 1, the first line is `• Reviewer verdict for <name>` without the
round. Mark a finding that doesn't block with `Nit:`. The last line is the
marker the dispatcher looks for: `LLPDONE:`, the name, `:`, and the current
local time as six digits, on a line of its own.
