# Review request: `output-26`

- Team member: `output`
- Branch: `feat/output/recovery`
- Base: `f4eba7be376d026a3d41d3bcad24ea7fce39daf7`
- Range: `f4eba7be...feat/output/recovery`
- Scope: M3-O8 part 1, session markers; output-25 nits and M2-9.
- Code head: `23d40a63119c9065c6af592f540b004854c04e40`
- Code CI:
  [40234192234](https://github.com/0913vision/llpresenter/actions/runs/40234192234),
  **success**, including the full GitHub Windows verify job.

## Changes

Startup opens `recovery/session.lock` after Electron's single-instance lock. An
existing marker detects an unclean exit and startup keeps the initial empty
output state. Data-39's runner receives restore mode after a crash, so startup
macros cannot turn outputs on before the recovery decision. Normal launch uses
normal macro mode. The marker is written atomically with a fresh opaque token.
Normal shutdown removes it after the data-store save steps and waits for that
cleanup before releasing Electron's lock. Repeated cleanup shares one promise.
Missing, changed or unwritable markers are handled without stopping the app;
warnings identify write/read/delete failures. Cleanup checks the current token
using a bounded read and leaves a newer launch's token intact.

This request leaves `live.json` untouched. Data is preparing its shared record
contract from the proposal, as the lead directed. The following O8 requests add
record persistence and D1c summary/apply/start-fresh handlers after the record
contract is available. Data-39's `startFresh()` port is now merged. This is the
session foundation, not the whole recovery workflow; no dialog or restore action
is introduced here.

M2-9 comes from a later work-area change, rather than the centering formula. The
current planner already uses the work area. `OutputWindow` ignored changed
window bounds after entering fallback, keeping the first center. A missing
monitor's fallback now follows a later placement change. A normal window, or a
fallback with an unchanged plan, retains the operator's position. The same
window/page, control-relative order and always-on-top policy remain in use.

## Changed files

- `src/main/live/recovery/session.ts` and its test: marker acquisition, crash
  detection, bounded identity checks, clean exit and file-error handling.
- `src/main/index.ts` and `index.wiring.test.ts`: marker lifecycle, shutdown
  ordering and a NOTE preserving the settings-owner-before-output-source order.
- `src/main/outputs/{outputWindow,manager}.test.ts` and `outputWindow.ts`: late
  work-area replanning with the same native window, preserving normal window
  placement and unchanged-plan fallback placement.
- `src/main/outputs/placement.test.ts`: the 62 DIP taskbar inset case.
- `src/main/outputs/settingsScreens.ts` and its test: explicit fallback
  dependency in tests, rather than a hidden default source.
- `src/main/live/slices/outputs.ts`: change the temporary identity bridge's NOTE
  to a TODO for data's planned shared helper.

No shared, preload, data-store or renderer file is changed.

## Verification

- After the data-39 rebase, 99 tests across eight relevant files passed in 1.31
  seconds. Typecheck, targeted ESLint after formatting, Prettier and whitespace
  checks passed.
- Both M2-9 regressions fail against the actual previous `OutputWindow`: the
  first fallback remains at x=1240 instead of updating to x=1271 after the work
  area changes from `(0,0,3440,1440)` to `(62,0,3378,1440)`. The source was
  restored in `finally`. The corrected tests pass, including normal-window
  operator-position preservation and the unchanged-plan hide/show case.
- A separate planner mutation from work area to monitor bounds fails the offset
  test at x=480 instead of x=511, reproducing the same 31 DIP difference. That
  mutation was also restored in `finally`.
- Session tests use isolated temporary files. Main wiring and output geometry
  use fakes. No local Electron, visible window, full verify, soak or memory run
  was started. The physical HDMI recheck remains for QA when the user returns.

## Review

Awaiting the lead and independent reviewer.
