# M1 test report

This report holds the results of the M1 test plan (`docs/qa/m1-plan.md`). The
lead asked QA to start before the freeze, on what is already merged into `main`,
so the report has two runs:

| Run         | Build                                          | Version | State       |
| ----------- | ---------------------------------------------- | ------- | ----------- |
| Pre-freeze  | `main` at `13d88b1`, a clean clone from GitHub | 0.2.0   | In progress |
| Frozen `m1` | The tag `m1`                                   | -       | Waiting     |

At `13d88b1`, `main` holds devops-1 (verify, lint, coverage, CI, soak runner),
devops-3 (the lint test fix), shell-1 (column dragging and widths per size
class, in memory), and the initial frame. It doesn't hold devops-2 (pre-push
hook and version bot), ui-1 and ui-2 (components and gallery), shell-2 (the
`app.json` store), or data-1 to data-4 (schemas). Cases that need those are "not
yet merged" in the pre-freeze run.

## Environment

As the plan's "Test environment" says, with these differences found while
testing:

- Electron sees one monitor: BenQ GW2780, 1920×1080 at 100%, with the task bar
  on the left (work area from x 67). Windows larger than the monitor still open
  at their full size, and the plan's emulated viewport covers what doesn't fit.
- The QA launcher keeps each app window on the monitor but fully transparent,
  click-through, unfocusable, and out of the task bar and Alt+Tab, and closes it
  at the end of each run (approved by the lead). Offscreen placement, which the
  plan first named, didn't hold at the monitor's full size and made the viewport
  16×8 px larger than the window, so it isn't used.
- CDP ports come from the OS (`netsh` shows 9347 to 9446 and other ranges
  excluded on this computer).

## Bugs

| ID   | Severity | Area and owner              | Title                                                                              | Build     | State                                        |
| ---- | -------- | --------------------------- | ---------------------------------------------------------------------------------- | --------- | -------------------------------------------- |
| M1-1 | minor    | Main process wiring, output | A relative `LLP_USER_DATA` throws at load and leaves Electron's error dialog       | `13d88b1` | Open, `fix/output/user-data-path` (output-4) |
| M1-2 | minor    | Shell, shell                | A resize within one size class during a drag leaves the grid wider than the window | `13d88b1` | Open, `fix/shell/drag-refit`                 |
| M1-3 | minor    | Soak judge, devops          | Steady memory growth under about 13 MB per hour passes a 60-minute soak            | `13d88b1` | Open, `fix/devops/soak-slope`                |
| M1-4 | minor    | Main process wiring, output | Log lines still queued when the app quits are lost                                 | `13d88b1` | Open, `fix/output/log-flush`                 |
| M1-5 | minor    | Logger, output              | The log's write queue has no cap and writes one line at a time                     | `13d88b1` | Open, `fix/output/log-flush`                 |

### M1-1: A relative `LLP_USER_DATA` throws at load

- Severity: minor. Only the development variable is affected, but the result is
  an error dialog and a process without a window.
- Area and owner: `src/main/index.ts` (output).
- Build: `main` at `13d88b1`, version 0.2.0.
- Steps: Set `LLP_USER_DATA` to a relative path (for example `D:llp-devqa`, the
  typo that `docs/WORKFLOW.md` had until `3875cd7`), then start the app.
- Expected: No error dialog. The app logs or prints the bad value and quits, or
  ignores it.
- Actual: `app.setPath('userData', ...)` throws `Path must be absolute` while
  the main module loads, before the app's `uncaughtException` handler exists.
  Electron's own handler calls
  `dialog.showErrorBox("A JavaScript error occurred in the main process", ...)`,
  and the process keeps running with no window, holding the single-instance
  lock. The QA launcher recorded the dialog call, so nothing showed on screen.
- Evidence: `.llp/qa/probe-relative.mjs` output, quoted above.
- A test that would have caught it: start the main process with
  `LLP_USER_DATA=relative` and expect no `showErrorBox` call and a clean exit or
  fallback.

### M1-2: A resize during a drag leaves the grid wider than the window

- Severity: minor. It lasts until the pointer moves, and only when the window
  shrinks within one size class during a drag.
- Area and owner: `src/renderer/src/shell/ColumnLayout.ts` (shell).
- Build: `main` at `13d88b1`, version 0.2.0. Case C9.
- Steps: At 2399×1000 (normal), set the left column to 400 and the right to 720.
  Press on the right gap and start dragging, then shrink the window to 1600×1000
  without moving the pointer.
- Expected: The widths fit the new window at once: the right column shrinks so
  that the center stays at 560, and nothing reaches past the window (`Layout`
  shrink rule; shell-1's "fit after a resize during a drag").
- Actual: `refit()` returns early while a drag is in progress, so the grid keeps
  400, 560, and 720. The page is 1692 px wide in a 1600 px window, and 92 px at
  the right are cut off until the pointer moves. After the next move, the widths
  are 400, 560, and 624. Crossing into another size class does refit, because
  `setSizeClass` drops the drag.
- A test that would have caught it: a `ColumnLayout` with a drag in progress, a
  smaller `windowWidth`, then `refit()`; expect the shown widths to fit the
  window.

### M1-3: Steady memory growth passes the soak judge

- Severity: minor. It weakens the M2 soak criterion ("no memory growth").
- Area and owner: `scripts/soak/judge.mts` (devops).
- Build: `main` at `13d88b1`, version 0.2.0. Case V18 (b).
- Steps: Judge a 60-minute record in which the lowest memory of one process
  rises in every window, 12 MB over the hour
  (`npm run soak -- --judge b-growing.jsonl`).
- Expected: The judge fails ("If memory keeps growing for 60 minutes, the test
  fails", `docs/TECH.md` "Memory").
- Actual: "Soak test passed." The judge marks the process "flat": its window
  minimums rise 244.9, 246.8, 248.6, 250.4, 252.2, and 254.1 MB, but it compares
  only the first and last (9.2 MB) with its 10 MB minimum, and those windows
  start at about minutes 5 and 51. So steady growth under about 13 MB per hour
  passes a 60-minute run, which is about 40 MB over a 3-hour service day.
- A test that would have caught it: a linear 12 MB per hour record must fail; or
  judge the slope over the whole required time.

### M1-4: Log lines queued at quit are lost

- Severity: minor. Only the log is affected, but the log exists to show what
  happened right before a quit.
- Area and owner: `src/main/index.ts` (output).
- Build: `main` at `13d88b1`, version 0.2.0. Found during S9.
- Steps: From the control window, send 5 malformed live commands and the window
  action `close` in the same tick. Open `logs\main.log`.
- Expected: All 5 "dropped a malformed command" warnings are in the file, since
  the main window's `closed` handler flushes the log before it quits.
- Actual: 1 of 5 reached the file (1 of 50, 2 of 200). With a backlog of 10,000
  lines, the app quit in 0.4 s with exit code 0 and dropped the rest. The
  `window-all-closed` handler calls `app.quit()` at once, so the
  `log.flush().then(() => app.quit())` in the `closed` handler never finishes.
- Evidence: `.llp/qa/log-quit.mjs` printed sent and logged pairs of 1 and 1, 5
  and 1, 50 and 1, and 200 and 2.
- A test that would have caught it: quit with pending log lines and expect every
  line on disk.

### M1-5: The log's write queue has no cap

- Severity: minor. Informative under the lead's rule for S9: the output didn't
  stop.
- Area and owner: `src/main/log.ts` (output since 2026-10-25).
- Build: `main` at `13d88b1`, version 0.2.0. Case S9.
- Steps: Send 10,000 malformed live commands in one burst from the control
  window, then read the log and the main process heap.
- Expected: Lists and queues have a cap (`CLAUDE.md`), so a burst of repeated
  warnings is merged or dropped with a count, and writes are batched.
- Actual: The logger queues one `appendFile` per line, at about 130 to 300 lines
  per second here. The main heap goes from 4.1 to 17.3 MB, the lines take 30 to
  over 70 seconds to reach the file, and a `live.get` round trip right after the
  burst takes 850 ms.
- A test that would have caught it: log 10,000 lines with a fake file system and
  expect a bounded queue and batched writes.

## Results, pre-freeze run (`13d88b1`)

### V. Install, checks, CI, and the version bot

| Case       | Result         | Note                                                                                                                                                                                                                                                                                                                                          |
| ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1         | pass           | `npm ci` exit 0 in 1 min 30 s; `node_modules/electron/dist/electron.exe` present                                                                                                                                                                                                                                                              |
| V2         | not yet merged | devops-2 adds the `prepare` script. The global `core.hooksPath` is unset before and after                                                                                                                                                                                                                                                     |
| V3         | pass           | Git Bash: 5 steps in order, "verify passed: 5 steps in 96.8 s", exit 0                                                                                                                                                                                                                                                                        |
| V4         | pass           | PowerShell 5.1: the same steps, 96.9 s, exit 0                                                                                                                                                                                                                                                                                                |
| V5         | pass           | Vitest 37.7 s and 39.0 s for 179 tests on an idle machine; `coverage/index.html` covers `src/` and `scripts/`. Under load from other sessions, 59.9 s and 68.3 s (noted, not a bug)                                                                                                                                                           |
| V6         | pass           | Each break stops verify at its own step: (a) typecheck, (b) lint, (c) format:check, (d) test:coverage, (e) build; the summary names the step and exit code                                                                                                                                                                                    |
| V7         | pass           | All 13 violations fail with their rule (`no-explicit-any`, `no-non-null-assertion`, `consistent-type-assertions`, `no-floating-promises` for a floating and a `void` promise, `switch-exhaustiveness-check`, `no-unused-vars`, `llp/allowed-comments` for 4 comment forms, `tsdoc/syntax`, `react-hooks/rules-of-hooks`); a clean file passes |
| V8         | pass           | CI run 40108330981 for `13d88b1`: success on `windows-2025`, `npm ci` and `npm run verify` ran, artifact `coverage` uploaded                                                                                                                                                                                                                  |
| V9         | pass           | `ci.yml` runs on a push to `main` and on `workflow_dispatch`. The run for `8d23708` was cancelled by the concurrency rule when `13d88b1` arrived                                                                                                                                                                                              |
| V10 to V17 | not yet merged | devops-2                                                                                                                                                                                                                                                                                                                                      |
| V18        | fail           | M1-3. (a) passes; (c) fails "too short"; (d) fails "Relaunched"; (e) passes with an fps warning; (f) drops and lists the 6 broken lines. (b) passes, but it should fail: memory that rises in every window by 12 MB over 60 minutes                                                                                                           |

### W. Window, size classes, and workspaces

Runs S1 to S12 from the plan's matrix. On this monitor, every size that the
window couldn't reach ran on an emulated viewport, marked "(emulated)".

| Case      | Result       | Note                                                                                                                                                                                                                                                                               |
| --------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1 to W4  | pass         | S1, S2, S3, S5, S6, S8, S9, S10, S11, and S12 on real windows, and S4 and S7 (1280×720 at 125% and 150%) on an emulated viewport: class, bars (menu 30, toolbar 40 or 56, status 28), default columns, 4 px gaps and edges, and the center width all as expected, with no overflow |
| W5        | pass at 100% | The content stays at 1280×720. Under emulated 125% and 150% scaling, the smallest window is 1282×722 and 1280×721 CSS pixels: a rounding of the emulation, to confirm in the user's spot check at real scaling, not filed                                                          |
| W6        | not run yet  |                                                                                                                                                                                                                                                                                    |
| W7        | pass         | Minimize and maximize reach the main process (recorded), and close quits with exit code 0                                                                                                                                                                                          |
| W8        | pass         | At 1280×720, 1920×1080, and 2560×1440: opens in 진행; each tab selects its workspace with the same column widths; the left columns hold 예배 순서 and 퀵 실행 (진행) and 예배 순서 and 라이브러리 (준비)                                                                           |
| W9 to W11 | pass         | narrow, normal, narrow at 1599, 1600, 1599; normal, wide, normal at 2399, 2400, 2399; height doesn't change the class                                                                                                                                                              |
| W12       | pass         | 2,562 widths at 100% (1 px steps) and 322 at 125% and 150% (8 px steps): the class changes exactly at 1600 and 2400, the center never under 560, no overflow, no long task, no error. At 125%, only the minimum width shows the same 2 px rounding as W5                           |
| W13       | not run yet  |                                                                                                                                                                                                                                                                                    |
| W14       | pass         | 본 화면 output stays on, and the state version stays the same, through 준비, 화면 설정, and 진행                                                                                                                                                                                   |
| W15       | pass         | A second instance with the same folder exits with code 0, and the first one gets a focus call (recorded)                                                                                                                                                                           |

### C. Column widths

| Case       | Result                  | Note                                                                                                                                                                               |
| ---------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1         | pass                    | Two gaps, 4 px wide and as high as the work area, cursor `col-resize`, never reached by Tab (40 presses)                                                                           |
| C2         | pass                    | Left stops at 400 and 200; the right column stays at 480                                                                                                                           |
| C3         | pass                    | Right stops at 720 and 320; the left column doesn't move                                                                                                                           |
| C4         | pass                    | At 1280×720 the right column stops at 484 (center 560), then the left column doesn't widen; the center never under 560                                                             |
| C5         | pass                    | At 1600: right stops at 720 (center 584), then left at 304 (center 560)                                                                                                            |
| C6         | pass                    | With the pointer past the left edge the left column holds 200, past the right edge 400, and the drag ends on release outside                                                       |
| C7         | pass                    | No DOM mutation inside the panels during a 50-step drag                                                                                                                            |
| C8         | pass                    | A touch drag on the other gap changes nothing during a mouse drag; the right mouse button doesn't start a drag                                                                     |
| C9         | fail                    | M1-2                                                                                                                                                                               |
| C10        | not yet merged          | The in-memory store has no file; runs with shell-2                                                                                                                                 |
| C11        | pass                    | normal 350 and 600, narrow 250 and 360, wide 320 and 650; a class without saved widths shows its defaults                                                                          |
| C12        | pass                    | At 1599: 400 and 623. At 1280: 384 and 320 (right first), center 560. Back at 1599: 400 and 623                                                                                    |
| C13        | pass                    | At 2399: 400 and 720. At 1600: 400 and 624. Back: 400 and 720                                                                                                                      |
| C14 to C21 | not yet merged          | shell-2 (`app.json` store): widths live in memory only at `13d88b1`, so a restart shows the defaults, as expected for now                                                          |
| C22        | pass (emulated scaling) | At 125% (viewport 1284) and 150% (1281): the left column stops at 348 and 345 and the right at 508 and 505, where the center reaches 560 for those widths, and both go down to 200 |
| C23        | pass                    | 1,000 drags (two rounds of 500 on each gap): DOM nodes 182 and listeners 157 before and after; renderer heap 2.04, 2.09, 1.80 MB; main heap 4.23, 4.35, 4.59 MB                    |

### S. Stability

| Case | Result      | Note                                                                                                                                     |
| ---- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| S1   | pass        | No `dialog.*` call in any run except the M1-1 probe, which used a relative path on purpose                                               |
| S2   | pass        | A throw from a main-process timer is logged as `uncaught exception`; no dialog; `live.get` still answers                                 |
| S3   | pass        | A rejected promise is logged as `unhandled rejection`; the app keeps running                                                             |
| S4   | pass        | 20 control window crashes: each logged, back in 0.65 to 1.0 s with the 본 화면 output still on, IPC listener counts unchanged, no dialog |
| S5   | pass        | `https:` and `file:` navigation and `window.open` are blocked; one window                                                                |
| S6   | pass        | No network request during start and workspace switches                                                                                   |
| S7   | pass        | A policy starting `default-src 'self'; script-src 'self'`; an inline script added from CDP doesn't run                                   |
| S8   | pass        | No `require`, `process`, or `module` in the renderer; `window.llp` has `live` (`get`, `send`, `subscribe`) and `window` (`control`)      |
| S9   | fail        | M1-5 (and M1-4, found here). The last valid toggle decides the state, and the main process stays up                                      |
| S10  | pass        | One `main.log` in UTF-8 with time, level, message, and detail; `started {"version":"0.2.0","electron":"44.9.3"}`                         |
| S11  | pass        | Exit code 0 after the close button                                                                                                       |
| S12  | pass        | Two force-quits, then a normal start with no dialog                                                                                      |
| S13  | not run yet | Runs at the freeze                                                                                                                       |
| S14  | not run yet | Needs the `v` tag (devops-2)                                                                                                             |

### D. Data formats

| Case       | Result         | Note                                                                                                                                                                                                                                                 |
| ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 to D16  | not yet merged | data-1 to data-3                                                                                                                                                                                                                                     |
| D17        | pass           | On the current hand-written guards (data-4 isn't merged): 9 malformed commands each dropped with a warning; no prototype pollution; the 3 well-formed ones (extra fields, a `__proto__` key, a 1 MB message) are applied; a valid `output.set` works |
| D18        | pass           | `"exit"`, `null`, and `{}` do nothing; `minimize` works                                                                                                                                                                                              |
| D20 to D37 | not yet merged | data-1 to data-3                                                                                                                                                                                                                                     |
