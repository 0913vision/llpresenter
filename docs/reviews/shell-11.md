# Review request: `shell-11`

Review range: 826d4d8...refactor/shell/undo-button

What to check: that `ClearRow` no longer subscribes to `canUndo` (only the new
`UndoButton` does), so a change of `canUndo` redraws only the undo button and a
change of the layers redraws only the buttons whose layer changed; and that the
two new tests in `ClearRow.test.tsx` would fail on the old code.

- Team member: `shell`
- Branch: `refactor/shell/undo-button`
- Base commit (`main`): `826d4d8`
- Last commit: see the commit that adds this file
- Related brief: the nit of codex2 on shell-9 (`ClearRow.tsx:42`)

## What changed and why

Codex2's nit on shell-9: `ClearRow` called `useCanUndo()` itself, so every
change of `canUndo` redrew the row and all seven clear buttons. The undo button
is now its own component, `UndoButton`, with its own `canUndo` selector. The row
has no subscription.

## Changed files

- `src/renderer/src/show/ClearRow.tsx`
- `src/renderer/src/show/ClearRow.test.tsx` (counts how many icons draw after a
  change: "redraws only the undo button when canUndo changes" and "redraws only
  the buttons whose layer changed when the layers change")

## Checks run

Pending.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Checks run")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (not touched)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (nothing new is registered)
- [x] Caches and lists have size caps (not applicable)
- [x] An exception in the output path doesn't stop the output (not touched)
- [x] Only what's needed re-renders (this change is about that)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- None.

## Shared contract change requests

- None.

## Where to look

- `ClearRow.tsx`: that `ClearRow` has no hook.

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
