# Review request: `output-9`

Review range: `c4bbd3a...fix/output/quit-hang`. Check that the app always exits
when the control window closes, with an empty or a full log and with repeated
quit requests (qa's blocker M1-11), and that the UI state is loaded before the
control window opens and written, with the soak record, before the app quits.
Both changes touch the same quit path in `src/main/index.ts`, so they come as
one request (the lead's call); the wiring was planned as output-8.

- Team member: `output`
- Branch: `fix/output/quit-hang`
- Base commit (`main`): `c4bbd3a`
- Last commit: the commit that adds this file
- Related: qa bug M1-11 (blocker); shell-3's `registerUiState`; devops-7's
  `registerSoakRecorder`

## Changes outside my paths

None. `src/main/index.ts` and `src/main/quit.ts` are mine. The wiring calls
shell's `src/main/uiState/register.ts` and devops' `src/main/soak/` as they are.

## What changed and why

**M1-11, the app hangs on close with an empty log (`245b63a`).** Since output-6,
`flushLogBeforeQuit` prevents the first `will-quit`, flushes the log, and calls
`app.quit()` again. With nothing queued, the flush resolves in the same
microtask checkpoint, so the second `app.quit()` reached Electron while it was
still inside the prevented `will-quit` (`is_quitting_` still set), and Electron
dropped it. The process kept running with no window and held the single-instance
lock, so the app couldn't be opened again without the Task Manager. The second
quit now comes from `setImmediate`, a later task, after Electron has returned
from the prevented `will-quit`. The state machine from output-6 still makes a
quit request during the flush wait for the same flush.

**The UI state and the soak record (`abc9bd4`).**

- `registerUiState(join(userData, 'app.json'), log)` runs in the `whenReady`
  handler before `createControlWindow`, because the window reads `ui:get` at
  startup.
- `registerSoakRecorder(log)` starts after the control window opens (it does
  nothing unless `LLP_SOAK_RECORD` is set).
- When the control window closes: the outputs stop, the IPC channels go, and the
  app quits once both `ui.dispose()` (which writes pending column widths) and
  the soak stop (which writes queued record lines) have finished. A failure is
  logged and the app still quits. The log flush stays last, in `will-quit`.
- `window-all-closed` no longer quits by itself. The output windows are
  destroyed inside the control window's close handler, which made the last
  window close at once and quit before the widths were written (shell saw an
  empty `app.json.tmp`). The control window's handler is now the only path that
  quits on close.

## Changed files

- `src/main/quit.ts`, `src/main/quit.test.ts`
- `src/main/index.ts`, `src/main/index.wiring.test.ts` (new)
- `docs/reviews/output-9.md` (new)

## Checks run

On `245b63a`, on `main` at `c4bbd3a`.

| Command or test        | Result                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify`       | Passed, 5 steps in 220.0 s: typecheck, lint, format check, 123 test files and 1,356 tests with coverage, build                                                                                                                                                                                                                       |
| `quit.test.ts`         | The fake app now quits like Electron: a quit during a `will-quit` is ignored, and after a prevented one only a later task gets through. New tests: an empty log quits; repeated quit requests during the flush still quit and the last line is on disk. The empty-log test hangs on the old code (checked by restoring the old line) |
| `index.wiring.test.ts` | Loads the real entry with Electron and the wired modules mocked: the UI state is read before the control window opens; the app quits only after both the UI state and the soak record are written; it still quits when saving fails; the last window closing doesn't quit by itself                                                  |
| The real app           | Not run: no window may appear on the user's screen. qa's invisible harness reproduced M1-11; please have qa rerun it on this branch (empty log, full log, repeated close)                                                                                                                                                            |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (no change)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the UI state and soak recorder are
      disposed on close; the entry tests remove the process handlers they add)
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

1. `setImmediate` instead of skipping the hold when the log is empty: it also
   covers a log that empties quickly, and it doesn't need to know whether a
   write is in progress.
2. `window-all-closed` keeps a listener that does nothing, because without a
   listener Electron quits on its own when the last window closes.

## Shared contract change requests

None.

## Where to look

- `src/main/quit.ts`, `finish`.
- `src/main/index.ts`, the `closed` handler and the `window-all-closed` note.

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
