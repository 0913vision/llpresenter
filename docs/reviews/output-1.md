# Review request: `output-1`

- Team member: `output`
- Branch: `feat/output/windows`
- Base commit (`main`): `63d0dbc` (round 2; round 1 was on `8b5edaa`)
- Last commit: the commit that adds this file
- Related brief: `docs/briefs/output.md` (task 1), milestone M2

## Changes outside `src/main/displays/` and `src/main/outputs/` (read first)

- `src/main/windows/page.ts` (new): `loadPage`, `preloadPath`, and
  `blockNavigation` moved out of `src/main/windows/control.ts`, as the lead
  approved. `loadPage` now takes `{name: 'index' | 'output', query?}` and keeps
  the rejection logging from 8b623b3. `control.ts` only imports them; its
  behavior is unchanged.
- `src/main/index.ts`: starts the outputs after the control window and stops
  them on `before-quit` and when the control window closes.
- `electron.vite.config.ts`: a second renderer input, `output.html`.
- `src/renderer/output.html` (new): a placeholder page (black, cursor hidden,
  the same content security policy as `index.html`). output-2 adds its script.
- No change to `src/shared/` or `src/preload/`. The shapes output-2 needs went
  to data for queue #10.

## What changed and why

The main-process half of the output path: one output window per screen, on the
right monitor, that survives hides, monitor changes, and renderer crashes. The
main process keeps owning the live state; this code only reads the output
switches (`outputs` in `LiveState`) and the monitor list, and dispatches
`output.set` off in the two cases the spec asks for.

| Module                                      | Responsibility                                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `displays/rect.ts`                          | Rectangle helpers (overlap, centering).                                                                                                                                 |
| `displays/monitor.ts`                       | Numbers monitors from 1, left to right, then top to bottom; finds the control monitor (the one holding the control window).                                             |
| `displays/registry.ts`                      | `DisplayRegistry`: reads the monitors, waits 300 ms for a burst of display events to settle, reports only real changes, keeps the last list on an empty or failed read. |
| `displays/electronSource.ts`                | Thin adapter over Electron's `screen`.                                                                                                                                  |
| `displays/assign.ts`                        | Finds each screen's saved monitor: display id, then name and resolution, then position and resolution (spec 03).                                                        |
| `outputs/screens.ts`                        | `OutputScreen` and `ScreenSource`: the subset of `screens.json` the windows need, with the schema's field names.                                                        |
| `outputs/defaultScreens.ts`                 | The temporary screen list (TODO until the settings store exists): 본 화면 (`main`) in full screen on the first non-primary monitor.                                     |
| `outputs/placement.ts`                      | Pure: full screen on the monitor, a window on the control monitor, or off.                                                                                              |
| `outputs/restartBudget.ts`                  | Stops restarting after 3 crashes in 60 seconds (spec 08, proposal).                                                                                                     |
| `outputs/outputWindow.ts`                   | One screen's window: created on first turn-on, kept across hides, moved only when the placement changes, reloaded 100 ms after a renderer crash.                        |
| `outputs/manager.ts`                        | `OutputManager`: follows the output switches and the monitors, isolates each screen's errors, logs status changes, turns an output off when needed.                     |
| `outputs/electronWindow.ts`                 | Thin adapter over `BrowserWindow`.                                                                                                                                      |
| `outputs/start.ts`                          | Wires the registry, the default screens, and the manager for `index.ts`.                                                                                                |
| `displays/testing.ts`, `outputs/testing.ts` | Test fixtures: monitors, a recording logger, a fake window handle.                                                                                                      |

Behavior, against the brief and spec 03 and 08:

- Turning an output on creates its window the first time and shows it without
  taking focus, full screen on its monitor (always on top, the 환경설정
  default). Turning it off hides it. The window is never recreated.
- A content change (장, clear, undo) leaves the windows alone: the reducer keeps
  the same `outputs` object, and the manager skips the work.
- A monitor that disconnects moves its output into a 960 x 540 window on the
  control monitor, in the same window, so the page isn't reloaded. When the
  monitor comes back, the window goes full screen on it again. With 연결이
  끊기면 set to off, the output turns off instead. A window the operator dragged
  keeps its place when it shows again.
- An unassigned full screen output shows in a window too.
- Closing a window-mode output with its close button turns that output off.
- A renderer crash reloads the page in the same window within 100 ms, which
  reads the current live state. After 3 crashes in 60 seconds, restarts stop and
  an error is logged; turning the output off and on again retries. The
  notification for that comes with the notification component later.
- A monitor change, a failing window, or a failing listener for one screen never
  touches the others. Every window, listener, and timer is released on
  `dispose`, which runs on `before-quit` because the windows turn a close into
  "output off".

## Changed files

- `src/main/displays/`: `rect.ts`, `monitor.ts`, `assign.ts`, `registry.ts`,
  `electronSource.ts`, `testing.ts`, and tests for `rect`, `monitor`, `assign`,
  `registry`.
- `src/main/outputs/`: `screens.ts`, `defaultScreens.ts`, `placement.ts`,
  `restartBudget.ts`, `outputWindow.ts`, `manager.ts`, `electronWindow.ts`,
  `start.ts`, `testing.ts`, and tests for `defaultScreens`, `placement`,
  `restartBudget`, `outputWindow`, `manager`.
- `src/main/windows/page.ts` (new), `src/main/windows/control.ts`,
  `src/main/index.ts`, `electron.vite.config.ts`, `src/renderer/output.html`.
- `docs/reviews/output-1.md` (new).

## Checks run

Round 2, on `bc0cf7b`, rebased onto `main` at `63d0dbc`.

| Command or test         | Result                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run verify`        | Passed, 5 steps in 155.8 s: typecheck, lint, format check, 30 test files and 246 tests with coverage, build |
| New tests               | 12 files under `src/main/displays/` and `src/main/outputs/`, all passing                                    |
| The app on two monitors | Not run: the rule is that no window may appear on the user's screen. See "Where to look" for a manual check |

Round 1, on `b14cc8f` on `main` at `8b5edaa`: verify passed (181 tests).

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema: no new IPC.
      Electron's display list is typed and checked for an empty result
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (display watchers, the settle timer,
      the relaunch timers, store and registry listeners, windows)
- [x] Caches and lists have size caps (the crash times keep only the last 60
      seconds)
- [x] An exception in the output path doesn't stop the output (per-screen `try`,
      listener isolation, failed monitor reads keep the last list)
- [x] Only what's needed re-renders (control window): not touched
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values: none yet (the frame rate report comes with
      output-2)

## Decisions I made (for the lead to confirm)

1. **One framed window per screen that goes full screen with `setFullScreen`**,
   instead of a frameless window. Electron can't add a frame later, and the
   fallback window needs a title bar and a close button, so this is the only way
   to fall back without reloading the page (spec 03: "Content and playback
   position don't break"). The lead agreed before the work.
2. **Loose monitor matches skip the control monitor and monitors that another
   screen holds by id.** Otherwise a look-alike monitor could put a full screen
   output over the operator's window, or over another screen, when the real
   monitor is unplugged.
3. **Monitor numbering sorts by x, then y** (spec 03: "left to right and top to
   bottom").
4. **A 300 ms settle time** for display events, because Windows sends several
   events for one plug.
5. **An empty monitor list is ignored** (Windows can report none for a moment
   while it reconfigures).
6. **The fallback window is 960 x 540, centered on the control monitor's work
   area**, and isn't always on top, so it never covers the control window for
   good.
7. **The default screen list has only `main`**, full screen on the first monitor
   that isn't the primary one, resolved at startup. Without a second monitor it
   shows in a window. The 무대 and 방송 자막 toolbar buttons do nothing until
   the settings store exists.
8. **Restart limit (proposal from spec 08):** 3 crashes in 60 seconds, logged at
   error level. **Retry by turning the output off and on** is my proposal.
9. **Not in this request:** 절전 막기 (prevent sleep, a `powerSaveBlocker` while
   an output is on), restarting a hung renderer (`unresponsive`), edge margin
   and offset, and the capture window. I can add the first two in a small
   follow-up if you want them before M2 closes.

## Shared contract change requests

None in this request. For output-2, data has the shapes for queue #10: a
`startedAt` on the media layer, `log:write` and `output:frame-rate` channels,
and the `llp-media` URL scheme helpers.

## Where to look

- `src/main/outputs/manager.ts`, `sync`: the order of work in one pass, and the
  `output.set` off that is dispatched after the loop, so the nested pass it
  causes sees a finished state.
- `src/main/outputs/outputWindow.ts`, `show` and `place`: when a visible window
  is moved, and why window mode passes `null` bounds to keep the operator's
  position.
- `src/main/outputs/electronWindow.ts`: the Electron calls, which tests can't
  reach. Worth a manual check on two monitors: turn on 본 화면, unplug and plug
  the second monitor, close the fallback window, and kill the output renderer
  from the task manager.
- `src/main/displays/assign.ts`: the loose matching rules.

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

Round 1 findings (Codex 0:6), each addressed in its own commit:

1. **Look-alike monitors (`assign.ts`)**: fixed in `78dc22d`. Every pass after
   the saved id now assigns a monitor only when it is the screen's single
   candidate and no other screen wants it in the same pass; an ambiguous match
   is rejected and the screen falls back to a window. A new pass right after the
   saved id keeps each screen on the monitor it had at the last assignment (the
   manager remembers it), so two outputs on monitors of the same model stay put
   when the ids change. The control monitor and monitors taken by a stronger
   match stay excluded. Regression tests: one of two same-model monitors
   unplugged after the ids changed (the other output keeps its monitor), the ids
   changing while both are plugged in, two monitors that nothing tells apart,
   two screens saved at the same position, and a manager test where a look-alike
   monitor connects next to an output's monitor.
2. **Stale list after an empty or failed read (`registry.ts`)**: fixed in
   `b554701`. An empty or failed read keeps the last list and schedules another
   read after `DISPLAY_RETRY_MS` (1 second), until a read works. The settle
   timer and the retry share one cancellable pending read, released on
   `dispose`, and a display event replaces a pending retry. A failing streak is
   logged once, and recovery is logged once. Tests: recovery from an empty read
   without another display event, recovery from a failed read at start, and
   dispose cancelling a pending retry.
3. **Nit, TSDoc on the private `changes()`**: removed in `bc0cf7b`. A
   non-exported helper in `assign.ts` lost its TSDoc the same way; the rule it
   stated moved into the `NOTE` above the passes.
