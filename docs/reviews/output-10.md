# Review request: `output-10`

Review range: `00b2492...feat/output/test-windows`. Check that with
`LLP_TEST_WINDOWS=offscreen` no window of the app can appear, take focus, go
full screen, stay on top, or show in the taskbar, that the variable is ignored
in a packaged build, and that normal runs are unchanged.

- Team member: `output`
- Branch: `feat/output/test-windows`
- Base commit (`main`): `00b2492`
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
  never shows, focuses, goes full screen, or goes on top: `showFullScreen`,
  `showWindowed`, and `hide` do nothing to the window. The rest of the output
  logic (placement, relaunch, frame rate) runs as usual.
- `LLP_SMOKE_EXIT_MS` waits for `ready-to-show` in `offscreen` mode, because
  `show` never fires.
- `src/main/index.ts` reads the mode in `start()` and passes it to the control
  window, the outputs, and the smoke exit.

## Changed files

- `src/main/windows/testWindows.ts` (new),
  `src/main/windows/testWindows.test.ts` (new)
- `src/main/windows/control.ts`, `src/main/outputs/electronWindow.ts`,
  `src/main/outputs/start.ts`, `src/main/index.ts`
- `docs/reviews/output-10.md` (new)

## Checks run

On `1702ea1`, on `main` at `00b2492`.

| Command or test  | Result                                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Passed, 5 steps in 151.4 s: typecheck, lint, format check, tests with coverage, build                                                                                        |
| New tests        | `testWindows.test.ts`: `offscreen` turns the mode on in development; unset, empty, other values, and other cases don't; a packaged app ignores it; the options for each mode |
| The real app     | Not run here. devops will run it offscreen for the first UI tests; a quick check that no window appears is worth doing then                                                  |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests (the Electron
      factories stay thin and untested, as before)
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

- `src/main/outputs/electronWindow.ts`, `keepOffscreen`.
- `src/main/windows/control.ts`, the `ready-to-show` handler.

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
