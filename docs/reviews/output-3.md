# Review request: `output-3`

- Team member: `output`
- Branch: `fix/output/single-undo`
- Base commit (`main`): `13d88b1`
- Last commit: the commit that adds this file
- Related brief: `docs/briefs/output.md` (bug from qa, M2 cases K14 and K15).
  Numbered 3 because the brief and the team already call the rendering request
  output-2.

## Changes outside my paths

None. Only `src/main/live/reducer.ts` and its test change.

## What changed and why

The live reducer kept 20 undo levels, and new content didn't end an undo.
`docs/spec/03-output.md` ("Undo") and the `ClearButton` README say undo has one
level, and that once new content goes to the screens after a clear, that clear
can't be undone, so an undo never covers something new. With 20 levels, undo
after new content brought back old layers over the new ones, and M2's "undo
restores the last clear" failed.

- `LiveHistory.undo` is now the layers right before the last clear, or null.
  `UNDO_LIMIT` is gone.
- A clear that clears something records the layers before it, replacing any
  older entry.
- `slide.show`, `media.show`, and `message.show` end the undo when they change
  the state, whatever layer the clear touched (the lead's rule for K14 and K15;
  spec 03 names "a cleared layer", and any layer is the stricter reading, which
  also keeps an undo from reverting a new background).
- `clear.undo` restores the recorded layers and leaves nothing to undo, so a
  second undo does nothing.
- Turning an output on or off and a clear with nothing to clear keep the undo
  (spec 03: undo doesn't touch outputs; a dim clear button does nothing).

## Changed files

- `src/main/live/reducer.ts`
- `src/main/live/reducer.test.ts`
- `docs/reviews/output-3.md` (new)

## Checks run

On `e15f1fb`, on `main` at `13d88b1`.

| Command or test  | Result                                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Passed, 5 steps in 83.9 s: typecheck, lint, format check, 21 test files and 185 tests with coverage, build                                                                                                        |
| New tests        | One level only, an undo after an undo, new content of each of the three show commands ending the undo, outputs and empty clears keeping it, and the random command run checking that no undo outlives new content |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (no change)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (no change)
- [x] Caches and lists have size caps (the undo list is gone; one entry)
- [x] An exception in the output path doesn't stop the output (no change)
- [x] Only what's needed re-renders (control window): not touched
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values: not relevant

## Decisions I made (for the lead to confirm)

1. A show command that changes nothing (the same layer object again) keeps the
   undo, because the reducer returns the same history for it. Showing the same
   장 again from the UI sends a new object, which does end the undo.

## Shared contract change requests

None.

## Where to look

- `src/main/live/reducer.ts`, `setLayer` and `clear`: where the undo is set and
  ended.

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
