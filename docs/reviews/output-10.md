# Review request: `output-10`

Review range: `5916a0b...feat/output/test-windows` (round 2). Check that with
`LLP_TEST_WINDOWS=offscreen` no window of the app can appear, take focus, go
full screen, stay on top, or show in the taskbar, that the variable is ignored
in a packaged build, and that normal runs are unchanged. For round 2, check the
three round 1 findings in "Team member's reply": `d1a9a1b` (title bar actions,
second launch) and `df44746` (offscreen output sizes).

- Team member: `output`
- Branch: `feat/output/test-windows`
- Base commit (`main`): `5916a0b` (round 2; round 1 was on `00b2492`)
- Last commit: the commit that adds this file
- Related: the lead's request; the shape devops proposed for the Playwright UI
  tests and the soak runs

## Changes outside my paths

None.

## What changed and why

devops' UI tests and soak runs need the real app without any window on the
user's screen.

- `windows/testWindows.ts` (new): `windowModeFrom(env, isPackaged)` reads
  `LLP_TEST_WINDOWS` once at launch. Only the exact value `offscreen` turns the
  mode on, and a packaged app always opens windows normally, so the variable
  can't hide the windows of a real service. `windowTestOptions(mode)` gives the
  `BrowserWindow` options the mode adds: `show: false`, `skipTaskbar: true`, and
  `webPreferences.offscreen: true` (the page loads and draws into memory, so
  Playwright can drive it and `capturePage` works).
- The control window takes the options and, in `offscreen` mode, skips its
  `ready-to-show` maximize and `show`.
- The output windows take the options, and in `offscreen` mode their handle
  never shows, focuses, goes full screen, or goes on top. It still gives the
  page the size of its placement: the monitor's size for full screen
  (`setContentBounds`) and the window bounds for window mode (`setBounds`).
  `hide` does nothing. The rest of the output logic (placement, relaunch, frame
  rate) runs as usual.
- In `offscreen` mode the control window's title bar can only close it (minimize
  and maximize would show it), and a second launch doesn't restore or focus it.
- `LLP_SMOKE_EXIT_MS` waits for `ready-to-show` in `offscreen` mode, because
  `show` never fires.
- `src/main/index.ts` reads the mode in `start()` and passes it to the control
  window, the outputs, and the smoke exit.

## Changed files

- `src/main/windows/testWindows.ts` (new),
  `src/main/windows/testWindows.test.ts` (new)
- `src/main/windows/control.ts`, `src/main/outputs/electronWindow.ts`,
  `src/main/outputs/start.ts`, `src/main/index.ts`, `src/main/ipc.ts`
- `src/main/outputs/electronWindow.test.ts` (new), `src/main/ipc.test.ts`,
  `src/main/index.wiring.test.ts`
- `docs/reviews/output-10.md` (new)

## Checks run

Round 2: `npm run verify` passed on `df44746`, on `main` at `5916a0b`: 5 steps
in 189.5 s. In real Electron, a hidden offscreen window (never visible) has no
frame, opens at 800×600 when nothing sizes it, and gets exactly the asked page
size from `setContentBounds` and `setBounds` (1920×1080, 3840×2160, 960×540, by
`innerWidth`, `innerHeight`, and `capturePage`).

Round 1, on `1702ea1`, on `main` at `00b2492`:

| Command or test  | Result                                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Passed, 5 steps in 151.4 s: typecheck, lint, format check, tests with coverage, build                                                                                        |
| New tests        | `testWindows.test.ts`: `offscreen` turns the mode on in development; unset, empty, other values, and other cases don't; a packaged app ignores it; the options for each mode |
| The real app     | Not run here. devops will run it offscreen for the first UI tests; a quick check that no window appears is worth doing then                                                  |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests (round 2 adds tests
      for the output window factory with a fake `BrowserWindow`)
- [x] Values from outside the process are validated (the variable is compared to
      one exact value)
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

1. Only the exact value `offscreen` counts, so a typo opens windows normally
   instead of hiding them by accident.
2. `skipTaskbar: true` too, as the lead asked, although a never-shown window has
   no taskbar entry anyway.

## Shared contract change requests

None.

## Where to look

- `src/main/outputs/electronWindow.ts`, `presentOffscreen`.
- `src/main/ipc.ts`, `controlWindowIn`, and `src/main/index.ts`, `bringBack`.
- `src/main/windows/control.ts`, the `ready-to-show` handler.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (6223474, codex4): Request changes with three findings: title bar
  actions and a second launch could show an offscreen window, and offscreen
  outputs did not get the size of their placement.
- Round 2 (6309345): reviewer (Codex, codex4) Approve with one nit: a test in
  `src/main/ipc.test.ts` leaves `isMaximized` returning `true`; reset it in
  `beforeEach`. The nit goes into output's next branch. Lead Approve;
  `LLP_TEST_WINDOWS=offscreen` is the one switch that keeps test windows off the
  user's screen (lead decision over qa's launcher). Rebased by the lead onto
  local `main` without conflicts.

## Team member's reply

Round 1 findings (codex4), all fixed:

1. `ipc.ts`: the title bar actions bypassed offscreen mode. Fixed in `d1a9a1b`:
   `allowsWindowAction(mode, action)` in `testWindows.ts` lets an offscreen
   window only close; `registerIpc` takes the window mode and logs an ignored
   action. Tests: `ipc.test.ts` (normal mode minimizes, maximizes, restores, and
   closes; offscreen ignores minimize and maximize and still closes) and
   `testWindows.test.ts`.
2. `index.ts`: a second launch restored and focused the offscreen control
   window. Fixed in `d1a9a1b`: `bringBack` does nothing in offscreen mode. Tests
   in `index.wiring.test.ts`: a second launch restores and focuses in normal
   mode and touches nothing in offscreen mode.
3. `electronWindow.ts`: offscreen outputs stayed at 800×600. Fixed in `df44746`:
   each mode has its own presentation. Offscreen full screen sets the content
   bounds to the monitor, window mode sets the window bounds, and neither shows,
   focuses, goes full screen, or goes on top; normal mode is unchanged. Tests in
   the new `electronWindow.test.ts` for both placements in both modes. The real
   Electron check under "Checks run" confirms the sizes.
