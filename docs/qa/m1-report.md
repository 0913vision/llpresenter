# M1 test report

This report holds the results of the M1 test plan (`docs/qa/m1-plan.md`). The
lead asked QA to start before the freeze, on what is already merged into `main`,
so the report has two runs:

| Run         | Build                                                   | Version | State                                               |
| ----------- | ------------------------------------------------------- | ------- | --------------------------------------------------- |
| Pre-freeze  | `main` at `13d88b1`, a clean clone from GitHub          | 0.2.0   | Done                                                |
| Pre-freeze  | `main` at `3afbb50` (ui-1 merged), the same clone       | 0.2.0   | Done (G)                                            |
| Pre-freeze  | `main` at `23e0344` (devops-2, data-1, output-4 merged) | 0.4.1   | Done (V, D, M1-1 retest)                            |
| Pre-freeze  | `main` at `9e2496a` (shell-4, devops-6 merged)          | 0.4.1   | Done (M1-2 retest, C regression, `npm run gallery`) |
| Pre-freeze  | `main` at `c402184` (output-1, data-2, devops-5 merged) | 0.4.2   | Done (output-1, M1-3 retest)                        |
| Pre-freeze  | `main` at `b9392d0` (data-5, data-3, spec-2 merged)     | 0.5.0   | Done (D1 to D37, data-5, output-1, M1-3)            |
| Frozen `m1` | The tag `m1`                                            | -       | Waiting                                             |

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

| ID   | Severity | Area and owner              | Title                                                                                      | Build     | State                                                 |
| ---- | -------- | --------------------------- | ------------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------- |
| M1-1 | minor    | Main process wiring, output | A relative `LLP_USER_DATA` throws at load and leaves Electron's error dialog               | `13d88b1` | Fixed (output-4), verified on `23e0344`               |
| M1-2 | minor    | Shell, shell                | A resize within one size class during a drag leaves the grid wider than the window         | `13d88b1` | Fixed (shell-4), verified on `9e2496a`                |
| M1-3 | minor    | Soak judge, devops          | Steady memory growth under about 13 MB per hour passes a 60-minute soak                    | `13d88b1` | Fixed (devops-5), verified on `c402184` and `b9392d0` |
| M1-4 | minor    | Main process wiring, output | Log lines still queued when the app quits are lost                                         | `13d88b1` | Open, `fix/output/log-flush`                          |
| M1-5 | minor    | Logger, output              | The log's write queue has no cap and writes one line at a time                             | `13d88b1` | Open, `fix/output/log-flush`                          |
| M1-6 | minor    | Design system cards, ui     | The design system cards render without Pretendard, so card comparisons use a fallback font | `3afbb50` | Fix in review (ui-5, `fix/ui/card-font`)              |
| M1-7 | major    | Tests and `verify`, devops  | On a busy computer, test timeouts fail `verify` and stop pushes                            | `c402184` | Fix in review (devops-9, `fix/devops/load-timeouts`)  |

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
- Retest on `23e0344` (v0.4.1): pass. The app logs "LLP_USER_DATA is not a
  usable app data folder; quitting" with the reason "the path is not absolute"
  and exits with code 1. No dialog call was recorded (the launcher wrote its
  records at exit), no folder was created, no process stayed, and a normal
  instance started afterward.

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
- Retest on `9e2496a`: pass. Right after the resize, without a pointer move, the
  columns show 400, 560, and 624 and nothing reaches past the window. The other
  C cases pass again on that build.

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
- Retest on `c402184` and again on `b9392d0` (devops-5 merged): pass. The judge
  fails the record ("growing output:main: +12.0 MB/h", "Soak test failed."), and
  the other five V18 records give the same verdicts as before.

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

### M1-6: The design system cards render without Pretendard

- Severity: minor. It affects every comparison against a card, not the app.
- Area and owner: `design/system/` (ui).
- Build: `main` at `3afbb50`. Found during P-compare for G20 to G28.
- Steps: `node design/system/card-server.js 5289`, open `/card/Button`, and read
  `document.fonts`.
- Expected: Pretendard Variable loads, as in the app and the gallery.
- Actual: `tokens.css` declares `@font-face` with
  `url("fonts/PretendardVariable.woff2")`, but `design/system/project/fonts/`
  isn't in the repository, so the request returns 404 and the cards fall back to
  Segoe UI and Malgun Gothic. The string "만들기 새 곡으로 저장" in 600 13px
  measures 127.7 px on a card and 110.4 px in the gallery. With the font copied
  from `node_modules/pretendard` into the folder (in QA's scratch clone only),
  both measure 110.4 px.
- A check that would have caught it: the card server, or a test, fails when a
  `url()` in `tokens.css` points at a missing file.

### M1-7: Test timeouts on a busy computer stop pushes

- Severity: major (the lead's call). Any push to `main` can fail when other
  sessions build and test on the same computer.
- Area and owner: the Vitest settings and `test/git-repo.test.ts` (devops).
- Build: local `main` at `c402184`, the push that the pre-push hook stopped,
  fetched read-only into the QA clone. The failure has the same shape as the
  lead's hook failure.
- Steps: Run `npm run test:coverage` while several sessions build and test on
  this computer.
- Expected: `verify` fails only for real failures, so a busy computer doesn't
  stop a push (`docs/TECH.md` aims for under a minute, but the gate mustn't
  depend on load).
- Actual: Exit 1 after 420.9 s: 1 failed, 736 passed, 1 skipped, and 2 unhandled
  errors. `makeTempGitRepo` "writes files and commits them with the given
  subject" timed out at its 5000 ms limit (5625 ms; the file took 12.6 s), and
  "[vitest-pool]: Failed to start forks worker ... Timeout waiting for worker to
  respond" hit `Checkbox.test.tsx` and `Gallery.test.tsx`. The same suite took
  38 s on an idle computer at `13d88b1`.
- A test that would have caught it: run `verify` with the CPU held busy (devops
  did this for the fix: it passed at 100% CPU with all 74 files).
- Fix in review: devops-9 runs Vitest in worker threads, gives tests and hooks
  60 s, and has the `verify` summary list what failed (FAIL lines, pool errors,
  unhandled rejections), so a timeout and a broken test look different.

## Results, pre-freeze run (`13d88b1`)

### V. Install, checks, CI, and the version bot

| Case | Result | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1   | pass   | `npm ci` exit 0 in 1 min 30 s; `node_modules/electron/dist/electron.exe` present                                                                                                                                                                                                                                                                                                                                                                                                  |
| V2   | pass   | On `23e0344`: `npm ci` sets `core.hooksPath` to `.githooks` in the clone's repository config; the global value is unset before and after                                                                                                                                                                                                                                                                                                                                          |
| V3   | pass   | Git Bash: 5 steps in order, "verify passed: 5 steps in 96.8 s", exit 0                                                                                                                                                                                                                                                                                                                                                                                                            |
| V4   | pass   | PowerShell 5.1: the same steps, 96.9 s, exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| V5   | pass   | Vitest 37.7 s and 39.0 s for 179 tests on an idle machine; `coverage/index.html` covers `src/` and `scripts/`. Under load from other sessions, 59.9 s and 68.3 s (noted, not a bug)                                                                                                                                                                                                                                                                                               |
| V6   | pass   | Each break stops verify at its own step: (a) typecheck, (b) lint, (c) format:check, (d) test:coverage, (e) build; the summary names the step and exit code                                                                                                                                                                                                                                                                                                                        |
| V7   | pass   | All 13 violations fail with their rule (`no-explicit-any`, `no-non-null-assertion`, `consistent-type-assertions`, `no-floating-promises` for a floating and a `void` promise, `switch-exhaustiveness-check`, `no-unused-vars`, `llp/allowed-comments` for 4 comment forms, `tsdoc/syntax`, `react-hooks/rules-of-hooks`); a clean file passes                                                                                                                                     |
| V8   | pass   | CI run 40108330981 for `13d88b1`: success on `windows-2025`, `npm ci` and `npm run verify` ran, artifact `coverage` uploaded                                                                                                                                                                                                                                                                                                                                                      |
| V9   | pass   | `ci.yml` runs on a push to `main` and on `workflow_dispatch`. The run for `8d23708` was cancelled by the concurrency rule when `13d88b1` arrived                                                                                                                                                                                                                                                                                                                                  |
| V10  | pass   | On GitHub: v0.3.0, v0.4.0, and v0.4.1 are annotated tags, each on one `Bump version: x.y.z` commit by `github-actions[bot]` that changes only `version` in `package.json` and both entries in `package-lock.json`                                                                                                                                                                                                                                                                 |
| V11  | pass   | GitHub: 0.2.0 to 0.3.0 and 0.3.0 to 0.4.0 are minor (the ranges hold feat and refactor); 0.4.0 to 0.4.1 is a patch (docs only). Dry runs in a scratch repository, counted since the last `v` tag: fix with docs patch; feat with fix and docs minor; refactor minor; break minor; style with chore patch; bump commits only, or none, no bump; bump with fix patch; no tag counts the whole history. An invalid subject counts as a patch (the pre-push check stops such commits) |
| V12  | pass   | `workflow_dispatch` has the boolean input `major`; the dry run with `--major` gives 2.0.0. The bump job alone has `contents: write` and `needs: verify`. A live major run is left to the user                                                                                                                                                                                                                                                                                     |
| V13  | pass   | The pre-push check accepts `Bump version: 9.9.9` and stops `Bump version: 1.2`                                                                                                                                                                                                                                                                                                                                                                                                    |
| V14  | pass   | Real pushes to a local bare repository (`D:\llp-dev\qa\bare.git`, the lead's instruction, never GitHub) from a throwaway clone whose only remote is that path. Each stops a push to `main` with a one-line reason: a body, a trailer, a second line without a blank line, a subject outside the format, a malformed bump subject, a failing verify (lint, 109 s), and a dirty tree. A non-fast-forward push is rejected                                                           |
| V15  | pass   | A valid commit and the exact bot subject go through after verify passes (386 s under load)                                                                                                                                                                                                                                                                                                                                                                                        |
| V16  | pass   | A feature branch with a bad subject and a tag go through without a check. A push that deletes `main` passes the hook, by design (the lead)                                                                                                                                                                                                                                                                                                                                        |
| V17  | pass   | The hook is `#!/bin/sh` calling `node scripts/hooks/pre-push.mts` and runs through Git for Windows from both shells                                                                                                                                                                                                                                                                                                                                                               |
| V18  | fail   | M1-3. (a) passes; (c) fails "too short"; (d) fails "Relaunched"; (e) passes with an fps warning; (f) drops and lists the 6 broken lines. (b) passes, but it should fail: memory that rises in every window by 12 MB over 60 minutes                                                                                                                                                                                                                                               |

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

### G. Gallery (ui-1 on `3afbb50`)

The gallery ran on plain Vite (no Electron), and pages opened in the invisible
viewer. The cards had Pretendard added in QA's scratch clone (see M1-6).

| Case                     | Result         | Note                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1                       | pass           | No exception, console error, or warning. Sections for the nine ui-1 components; ui-2's seven come with ui-2                                                                                                                                                                                                                                                                                                                          |
| G2                       | pass           | `out/renderer` holds only `index.html` and `assets`; no gallery string in the build                                                                                                                                                                                                                                                                                                                                                  |
| G3                       | pass           | The same policy in `gallery.html` and `index.html`                                                                                                                                                                                                                                                                                                                                                                                   |
| G4                       | pass           | Every row of "Sizes and variants" and "States" is in the gallery for the nine components. The cards' context specimens (the Button dialog footer and panel strip, the ToolbarButton tooltips) aren't; the tooltips need ui-2                                                                                                                                                                                                         |
| G5                       | pass           | No literal design value in the component CSS. Component custom properties hold the same literals as the design CSS (for example the 30×18 switch and the 120 and 96 sliders), for which no tokens exist. The 1 px of a screen-reader-only element is allowed                                                                                                                                                                         |
| G6                       | pass           | `live` only on output toggle dots that are on and on the error ring of fields                                                                                                                                                                                                                                                                                                                                                        |
| G7                       | pass           | No ring after a mouse click; after Tab, 2px `accent` with a 1px offset on buttons, segments, tabs, the switch, and the select, and `ring-field-focus` (1px inset) on text fields                                                                                                                                                                                                                                                     |
| G8                       | pass           | `text-off` and opacity 1 everywhere. `aria-disabled` and focusable: Button, IconButton, ToolbarButton, segments, Select, Checkbox, Switch. Native `disabled`: TextField and Slider (recorded, the Slider README sets only the look). Disabled switch: track `bg-control`, thumb `text-off`; disabled slider: fill and knob `text-off`. The gallery's disabled Button samples carry no reason tooltip (gallery content, not a defect) |
| G9                       | pass           | 100 ms ease-out on hover backgrounds and the switch, 0 under reduced motion, no animation. Menus, tooltips, and dialogs come with ui-2                                                                                                                                                                                                                                                                                               |
| G10                      | fail           | 47 native `title` attributes (IconButton, SegmentedControl, ToolbarButton, TextField, Switch, Slider). ui-2's Tooltip replaces them; to recheck after it merges                                                                                                                                                                                                                                                                      |
| G11                      | pass           | Every interactive element has an accessible name                                                                                                                                                                                                                                                                                                                                                                                     |
| G12                      | pass           | No middle dot, em dash, period at the end of a tooltip, "하기" button name, or glossary word to avoid                                                                                                                                                                                                                                                                                                                                |
| G13                      | pass           | Pretendard Variable is the only face, loaded from the bundle                                                                                                                                                                                                                                                                                                                                                                         |
| G14, G16                 | not yet merged | ui-2 (menus, tooltips, dialogs)                                                                                                                                                                                                                                                                                                                                                                                                      |
| G15                      | pass           | The compact ToolbarButton and Slider forms show                                                                                                                                                                                                                                                                                                                                                                                      |
| G20 to G28 (a), (b)      | pass           | All 131 card specimens match their gallery specimens in size, padding, radius, colors, font, outline, and shadow, with hover, pressed, and focus forced over CDP where the gallery doesn't pin them                                                                                                                                                                                                                                  |
| G20 (c) Button           | pass           | `aria-disabled`, focusable, `type="button"`, no wrapping, icons hidden                                                                                                                                                                                                                                                                                                                                                               |
| G21 (c) IconButton       | pass           | Named, tooltip name equals the label, Space flips `aria-pressed` and Enter flips it back, menu buttons have `aria-haspopup="menu"`                                                                                                                                                                                                                                                                                                   |
| G22 (c) SegmentedControl | pass           | Roving focus; → → → ← Home End select 1, 2, 0, 2, 0, 2 with wrap; groups named; tabs and toggle kinds present                                                                                                                                                                                                                                                                                                                        |
| G23 (c) ToolbarButton    | pass           | "작업 공간" tab lists with one Tab stop and arrows that switch; outputs: `aria-pressed` and `data-state`, a dot only when on or warning, and the three tooltip forms. The "화면 출력" group belongs to the toolbar (B4), not the component                                                                                                                                                                                           |
| G24 (c) TextField        | pass           | Esc clears, a second Esc releases focus; the clear button is out of the tab order; number 10, 11, 21, 20 with ↑, Shift ↑, ↓; the error links its reason; the textarea grows from 72 to 160 px (8 lines), then scrolls, with no resize handle                                                                                                                                                                                         |
| G25 (c) Select           | pass           | `aria-haspopup="listbox"` and `aria-expanded` on every trigger; the menu comes with ui-2                                                                                                                                                                                                                                                                                                                                             |
| G26 (c) Checkbox         | pass           | Space and a click on the row toggle; mixed state shown; the list takes one Tab stop                                                                                                                                                                                                                                                                                                                                                  |
| G27 (c) Switch           | pass           | Space toggles, the arrows don't; every switch is named                                                                                                                                                                                                                                                                                                                                                                               |
| G28 (c) Slider           | pass           | → ← ↑ PageUp PageDown Home End step correctly (1 to 5), named, and the fill follows the value (the component names the variable `--slider-value`, not the README's `--ll-value`)                                                                                                                                                                                                                                                     |
| G29 to G35               | not yet merged | ui-2                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### D. Data formats

| Case            | Result | Note                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 to D16       | pass   | On `23e0344` for the four formats data-1 merged (song, service, 틀, `app.json`): 176 checks pass, 0 fail; the same 176 pass again on `b9392d0`. D1: all 18 parsers and serializers exist on `b9392d0`. D12 records: a 5.4 MB song parses in 40 to 80 ms; nesting deeper than 64 levels returns an error; `__proto__`, `constructor`, and `prototype` are kept as own fields and pollute nothing |
| D17             | pass   | On the current hand-written guards (data-4 isn't merged): 9 malformed commands each dropped with a warning; no prototype pollution; the 3 well-formed ones (extra fields, a `__proto__` key, a 1 MB message) are applied; a valid `output.set` works                                                                                                                                            |
| D18             | pass   | `"exit"`, `null`, and `{}` do nothing; `minimize` works                                                                                                                                                                                                                                                                                                                                         |
| D20 to D22, D37 | pass   | Every listed rule fails with its field or passes as the plan says. The lead confirmed the recorded items as designed: an empty service name and an empty header are allowed; an item with no known kind key is kept; a 틀 with a `date` keeps it as an unknown field; `app.json` takes any non-negative width and positive column count, and the shell clamps; the 64-level limit stands        |
| D23 to D36      | pass   | On `b9392d0` for the 14 settings formats of data-2 and data-3: 719 checks pass, 0 fail, and 71 are recorded (below). Each format also passes the shared checks D2 to D7, D9 to D11, and D16 (6,000 mutated files against all 14 parsers, each result written back: nothing throws)                                                                                                              |

Recorded on `b9392d0` (D23 to D36), for the lead to confirm or correct:

- No module exports defaults for screens, Looks, stage layouts, or 이름표, so
  the default checks of D23, D24, D25, and D32 wait for the code that creates
  the files. `defaultPreferences` equals the spec 02 table (D33).
- An unknown 매크로 action kind and an unknown 퀵 실행 item kind are kept as
  they are, like unknown 예배 순서 items (D21). The plan's D27 expected a
  failure for a `kind` outside its enum; QA counts the kept item as designed.
  Unknown 타이머 kinds, 소품 content kinds, background kinds, screen kinds and
  methods, and media kinds fail the file instead.
- D26: a 소품 action without `mode` reads as `on`, and a 타이머 action without
  `operation` reads as `start`; both are written on the next save. A 무대 화면
  배치 action without `screen` stays without it. An 오디오 action without
  `operation`, and a `clearLayer` action with both a layer and a 소품, fail. An
  icon outside the icon list, a collection that names no 매크로, and a 매크로
  that runs itself pass.
- D32: a bad `key` (`""`, `"Ctrl+A"`, `"c"`, `"F5"`, `"Numpad1"`, `7`, or no
  key) loads as `null` and is listed in `dropped`, and the rest of the file
  loads (spec 10). Two 이름표 with the same key pass.
- D34: each of 23 bad bindings (a string, the `[["Ctrl", "1"]]` form of the 02
  example, bare letters and digits, modifiers out of order or repeated, a
  modifier key as the code, and the reserved keys Tab, Shift Tab, Esc, Enter,
  Ctrl C, Ctrl V, Alt F4, F10, Print Screen, and Ctrl Alt Delete) drops only its
  command, which is listed in `dropped`. Unknown command IDs are kept, and so
  are the IDs `__proto__`, `constructor`, and `prototype`, as own keys that
  pollute nothing. Two commands with the same key pass, since conflicts belong
  to the store (spec 10).
- D35: two default translations, none, 11 recents, a recent that names no
  installed translation, and a `file` with a path separator, `..\..\`, or a
  drive letter all pass.
- D36: kind `"input"` fails; `in` after `out` and `in` equal to `out` fail at
  `items.0.props.out`; a playlist item that names no media, and an audio item in
  a video playlist, pass.
- D23: `edgeMargin` -1 and 101 fail (0 to 100). D24: a `current` that names no
  Look, `#3D8BF0`, and weights 50 and 1000 pass; weight 650.5 fails. D28:
  `targets` `[]`, `duration` 0, and a blank with no closing brace pass.

Observations for the owners, not filed as bugs because no code reads these files
yet:

- `serializeShortcuts` writes a reserved key, such as Tab, that the next read
  drops. The key field refuses reserved keys (spec 10), so only a code bug would
  write one.
- `preferences.json` takes any positive `previewFps`, `backupCopies`,
  `backup.keep`, and `bible.maxLines` (1000, 100000, and 50 pass). Spec 10
  proposes 15, 30, or 60 fps, 3 to 50 copies, 1 to 365 backups, and 1 to 12
  lines, but its settings part is still a proposal. Whatever the file says, the
  code that keeps recovery copies and backups needs a cap.
- `bible.json` `file` takes a path that climbs out of the folder or is absolute,
  where spec 02 says a file name. The code that opens a translation should keep
  it inside the translations folder.
- Spec 02 "Shortcuts" still shows `[["Ctrl", "1"]]`, while spec 10 decided
  `{code, mods}` and the schema follows spec 10.
