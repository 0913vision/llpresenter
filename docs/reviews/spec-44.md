Review range: `8e6eba7d...feat/spec/output-actions`

# Review request: `spec-44`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/output-actions`
- Base commit: `8e6eba7d`, main at round 2
- Review round: 2
- Task: M3-S2a part 1, the output actions and status that the lost monitor card
  needs (lead, 09:3x: shell builds the main handlers too)
- Code owners: data for `src/shared/` and `src/preload/`; output for
  `src/main/outputs/` and `src/main/rendererMessages.ts`

## What changed and why

Spec 03 and 08 give the lost monitor card two actions, 모니터 다시 찾기 and 창
보기, and a detail line "모니터 3 → 창으로 표시 중". None of the three had a way
to the control window. This request adds them; spec-45 builds the cards on top.

**Contract (additive).** `output.findMonitors()` sends `output:find-monitors`
with no payload. `output.showWindow(screenId)` sends `output:show-window` with
`{screenId}`, checked by `parseOutputShowWindowRequest`, which shares the
existing retry request schema. `OutputScreenStatus` gains an optional `monitor`:
the number (from 1, as 화면 설정 counts) of the monitor the screen last showed
full screen on, kept after that monitor disconnects. It is a whole number from 1
to `MONITOR_NUMBER_MAX` (64). The fake API gets no-op defaults.

**Main.** `output:find-monitors` calls the display registry's existing
`refresh()`, which reads the monitors at once and lets the output manager match
the saved monitors again. `output:show-window` resolves an alias as 다시 시도
does and calls `OutputManager.showWindow`, which asks the screen's
`OutputWindow` to `bringToFront()`. That only acts while the window shows as a
normal window (a fallback or a window-method screen), and the Electron handle
raises a visible window with `moveTop()`, which never takes focus, so the
operator's keys stay in the control window. The manager remembers each screen's
monitor number when it goes full screen and keeps it through a disconnect; the
status board passes it on and announces a change of it. The retry and show
window handlers share one request handler.

## Round 2 response

1. 창 보기 now restores a minimized output first, with `showInactive()`, which
   on Windows shows the window in its last size without activating it, and then
   raises it with `moveTop()`. A test checks the order and that neither
   `focus()` nor `show()` runs.
2. The Electron window keeps an explicit raise flag. A placement that finishes
   later (the fallback after a deferred full screen exit) or a bounds correction
   calls `orderWindow(false)`, which now raises the window again instead of
   moving the control window above it. The flag clears when the window hides,
   goes full screen, is placed behind the control for a monitor removal, or is
   disposed, so the next fallback goes behind the control window again, as spec
   03 asks. Tests cover the deferred placement, the late correction, and each of
   the three ends.

## Decisions I made (for the lead to confirm)

1. 창 보기 raises the window without focusing it (`moveTop`, not `focus`), so F1
   to F7 and the 진행 keys keep working right after.
2. The monitor number is recorded only when the screen actually shows full
   screen, so an output that is off reports none until it first shows.
3. A monitor renumbering while a screen stays full screen reaches the renderer
   with the next status announcement (frame rate reports come every second), not
   at once; it changes no card.

## Changes outside my paths

data keeps:

- `src/shared/ipc.ts`: the two channels and the two `LlpApi.output` methods.
- `src/shared/schema/outputStatus.ts` and `.test.ts`: the optional `monitor`
  with its cap, and the show window request, with valid and invalid cases.
- `src/shared/testing/fakeLlpApi.ts`: no-op defaults.
- `src/preload/index.ts` and `.test.ts`: the two one-way sends.

output keeps:

- `src/main/outputs/start.ts` and `.test.ts`: the two listeners, tested through
  the started outputs (a silent monitor change seen at once, an alias raised, a
  malformed request dropped and logged).
- `src/main/outputs/manager.ts` and `.test.ts`: `showWindow` and the kept
  monitor number (about 15 lines in the manager).
- `src/main/outputs/outputWindow.ts`, `electronWindow.ts`, `testing.ts`, and
  their tests: `bringToFront` on the handle, the window, and the fake.
- `src/main/outputs/statusBoard.ts` and `.test.ts`: the monitor number in the
  snapshot and the change check.
- `src/main/rendererMessages.ts` and `.test.ts`: `handleShowWindowRequest` and
  the shared screen request handler.

This review document is in my own path. No dependency is added.

## Validation

| Command or test                                                                                               | Result                 |
| ------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `npm run typecheck`                                                                                           | Pass                   |
| `npx vitest run --no-fsModuleCache src/main/outputs src/main/rendererMessages.test.ts src/shared src/preload` | Pass                   |
| `npx eslint --max-warnings 0` on the changed files                                                            | Pass                   |
| `npx prettier --check` on the changed files                                                                   | Pass                   |
| GitHub CI (`npm run verify`)                                                                                  | In the request message |

No Electron process, visible window, soak, or memory measurement was started.
`moveTop` is covered with the fake `BrowserWindow`; the real raise is for the
lead's run.
