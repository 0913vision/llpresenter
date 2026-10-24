# Review request: `output-9`

Review range: `f8dc565...fix/output/quit-hang` (round 3). Check the round 1
findings against "Team member's reply": every quit request, from the control
window, from Electron, or repeated, now waits for one shutdown in
`src/main/shutdown.ts` with one deadline for the saves and one for the log, and
the app always exits. Also check the UI state wiring (read before the control
window opens) and the soak recorder wiring. The planned output-8 wiring is part
of this request (the lead's call).

- Team member: `output`
- Branch: `fix/output/quit-hang`
- Base commit (`main`): `f8dc565` (round 3; round 2 was on `d1a0b97`, round 1 on
  `c4bbd3a`)
- Last commit: the commit that adds this file
- Related: qa bug M1-11 (blocker); shell-3's `registerUiState`; devops-7's
  `registerSoakRecorder`

## Changes outside my paths

- `src/main/uiState/register.ts` and its test (shell's files, with shell's
  permission): the module's own `before-quit` guard and its `flushedBeforeQuit`
  flag are gone, because the shutdown now calls `dispose()` and awaits it.
  `dispose()` is unchanged. The two tests of the guard and the `app` part of the
  Electron mock are removed.

Otherwise none. `src/main/index.ts` and `src/main/quit.ts` are mine. The wiring
calls shell's `src/main/uiState/register.ts` and devops' `src/main/soak/` as
they are.

## What changed and why

**M1-11, the app hangs on close with an empty log (`667f327`, then `e9e80f3`).**
Since output-6, `flushLogBeforeQuit` prevents the first `will-quit`, flushes the
log, and calls `app.quit()` again. With nothing queued, the flush resolves in
the same microtask checkpoint, so the second `app.quit()` reached Electron while
it was still inside the prevented `will-quit` (`is_quitting_` still set), and
Electron dropped it. The process kept running with no window and held the
single-instance lock, so the app couldn't be opened again without the Task
Manager. The second quit now comes from `setImmediate`, a later task, after
Electron has returned from the prevented `will-quit`. The state machine from
output-6 still makes a quit request during the flush wait for the same flush.

**The UI state and the soak record (`3e3728a`, then `e9e80f3`).**

- `registerUiState(join(userData, 'app.json'), log)` runs in the `whenReady`
  handler before `createControlWindow`, because the window reads `ui:get` at
  startup.
- `registerSoakRecorder(log)` starts after the control window opens (it does
  nothing unless `LLP_SOAK_RECORD` is set).
- Round 2 replaces both quit hooks with one `ShutdownCoordinator`
  (`src/main/shutdown.ts`). It listens to `before-quit`, so it holds every quit
  request, whatever started it. The first request prevents the quit and starts
  the shutdown; a request during the shutdown is prevented and waits for the
  same one; after the shutdown, the real quit runs from `setImmediate` (M1-11)
  and passes.
- The shutdown runs the steps in the order they were added: stop the outputs
  (output windows turn a close into "output off", so they go first), save the UI
  state, finish the soak record, close the data store, stop serving media, and
  remove the IPC channels. A step that throws is logged and the next one runs.
  All the steps together get `SAVE_LIMIT_MS` (3 s); when the limit passes, the
  step still waiting is logged and the shutdown carries on. Then the log flush
  gets `LOG_FLUSH_LIMIT_MS` (2 s). So the app exits within about 5 s whatever
  hangs.
- The control window's close handler only calls `app.quit()`, and
  `window-all-closed` quits again, because the coordinator now holds both.
  `flushLogBeforeQuit` (`src/main/quit.ts`) is gone. The bad `LLP_USER_DATA`
  exit also bounds its log flush with `flushWithin` (`f489c18`).
- data-11's `registerStore(log)` is wired next to the UI state (the lead's
  call), with "close the data store" as a shutdown step. data-9 will change that
  one call to its options object in its own branch.

## Changed files

- `src/main/shutdown.ts` (new), `src/main/shutdown.test.ts` (new)
- `src/main/quit.ts`, `src/main/quit.test.ts` (deleted)
- `src/main/index.ts`, `src/main/index.wiring.test.ts` (new)
- `docs/reviews/output-9.md` (new)

## Checks run

Round 3: `npm run verify` passed on the last commit before this document, on
`main` at `f8dc565` (5 steps in 141.0 s).

Round 2: `npm run verify` passed on the coordinator commits rebased onto `main`
at `db4b2e6`: 5 steps in 241.4 s, 145 test files and 1,556 tests. After the last
rebase onto `d1a0b97` (output-5, no conflict): typecheck, lint, and the 40
main-process test files (335 tests) pass.

| Test file              | What it proves                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shutdown.test.ts`     | With an Electron-like fake app (a quit during a quit event is ignored, and after a prevented one only a later task gets through): an empty log quits; the steps run in order with a deferred soak stop, then the log flush, then the quit; repeated quit requests run the steps once; a throwing step is logged and the next runs; a never-ending step quits after 3 s with the step named; a stuck log quits after 2 s with no timer left |
| `index.wiring.test.ts` | The real entry with Electron and the wired modules mocked: the UI state is read before the control window opens; closing the window asks to quit; `before-quit` is held, twice, until the UI state and the deferred soak stop finish, then the quit runs once and later quits pass; a failing save still quits; the last window closing quits through the same shutdown                                                                    |

Round 1, on `245b63a` on `main` at `c4bbd3a`: verify passed (1,356 tests). qa
then ran round 1 in the built app: an empty log exits 6 of 6 times, 5 to 10,000
queued lines and a double close all exit, a column width dragged right before
close is in `app.json` with no leftover temporary file, and the next start isn't
blocked. Round 2 changes the quit path again, so a short rerun is worth it.

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

Round 1 findings (codex5), both fixed in `e9e80f3` by one shutdown coordinator:

1. **A quit already under way couldn't be held (`index.ts:78`)**: all quit
   requests now meet in `before-quit`, where the coordinator prevents them until
   its one shutdown is done (UI state, soak record, data store, and the other
   steps, then the log flush); a repeated request waits for the same shutdown.
   Test: the whole sequence with a deferred soak stop, in `shutdown.test.ts` and
   through the real entry in `index.wiring.test.ts`.
2. **No deadline on the saves (`index.ts:82`)**: the steps share a 3-second
   limit; when it passes, the waiting step is logged and the shutdown goes on to
   the log flush (2 seconds), then quits. Tests: a step that never resolves, and
   a log flush that never resolves, both still quit.

Round 2 finding (codex5), and the same hang that qa found with a stuck rename of
`app.json`:

1. **The UI state's own quit guard (`index.ts:91`)**: fixed in `27df95e`.
   `registerUiState` no longer listens to `before-quit` at all (shell agreed and
   allowed the change in its files); the shutdown awaits its `dispose()` within
   the save limit, so the coordinator is the only quit hook. New integration
   test, `shutdown.integration.test.ts`: the real `registerUiState` and the real
   coordinator share one Electron-like app, a layout change is pending, and the
   `app.json` write never ends; the app still quits after the save limit and
   logs which step it waited for. It fails with the old guard (checked by
   restoring the old file).

From qa's round 2 run: a start right after the exit could find the
single-instance lock still held while Chromium tears down. `30b0361` releases
the lock right before the real quit, after the saves and the log flush. Tests:
the lock is released only when the shutdown is done (`shutdown.test.ts`), and
through the real entry (`index.wiring.test.ts`).
