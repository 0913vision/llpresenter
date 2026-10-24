# Review request: `output-7`

- Team member: `output`
- Branch: `feat/output/can-undo`
- Base commit (`main`): `8273192`
- Last commit: the commit that adds this file
- Related brief: `docs/briefs/output.md`; asked by the lead for shell's 되돌림
  button after data-6

## Changes outside my paths

None. Only `src/main/live/reducer.ts` and its test.

## What changed and why

data-6 added a required `LiveState.canUndo` (false in `emptyLiveState()`), so
the control window can show the 되돌림 (undo) button bright only when a clear
can be undone. The reducer now sets it wherever it sets the layers: true right
after a clear that cleared something, false after an undo and after new content
ends the undo. Turning an output on or off keeps it, as it keeps the undo. A
state with no change keeps it too, because the reducer returns the same history.

## Changed files

- `src/main/live/reducer.ts`, `src/main/live/reducer.test.ts`
- `docs/reviews/output-7.md` (new)

## Checks run

On `676ab6e`, on `main` at `8273192`.

| Command or test  | Result                                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Passed, 5 steps in 206.1 s: typecheck, lint, format check, 88 test files and 905 tests with coverage, build                                                           |
| New tests        | canUndo through a show, a clear, an output switch, an undo, and new content after a clear; and the 5,000 random commands keep canUndo equal to whether an undo exists |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (no change)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (no change)
- [x] Caches and lists have size caps (no change)
- [x] An exception in the output path doesn't stop the output (no change)
- [x] Only what's needed re-renders (control window): not touched
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values: not relevant

## Decisions I made (for the lead to confirm)

1. canUndo is derived from the undo entry in one place (`withLayers`), so the
   two can't disagree.

## Shared contract change requests

None.

## Where to look

- `src/main/live/reducer.ts`, `withLayers`.

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
