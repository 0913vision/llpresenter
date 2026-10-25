# Review request: data-20

Shared changes: `app.json` gains optional `uiZoomPercent`; the value is 100
through 200 in 10-point steps. Invalid stored values fall back to 100; an absent
field reads as 100 without adding a default field to old files. The preload
exposes `ui.getZoom()` and `ui.changeZoom(command)`, backed by validated
`ui:zoom:get` and `ui:zoom:change` invokes. The commands are `ui.zoomIn`,
`ui.zoomOut`, and `ui.zoomReset`. Replies are checked percentages; failures log
and reject. No live command or output-rendering contract changes.

The lead's `.llp/task.md` grants one-feature permission for output's control
window/startup code and shell's zoom-key handling. The changes to those paths
are limited to zoom wiring, its tests, and the control App's overflow fallback
required by the zoomed-viewport rule. Menus, layout reset, and the settings
window remain outside this request.

- Team member: data
- Branch: `feat/data/ui-zoom`
- Base commit (`main`): `b7c61e3fd283b6ccba6f542bdad088bf1e436356`
- Last code commit: `33b2b56`
- Review range: `b7c61e3..feat/data/ui-zoom`
- Task: M2 check 1 row 11, UI zoom vertical slice
- Spec: 10, "UI zoom and layout recovery", focus precedence, physical aliases,
  and the 일반 appearance setting

## What changed and why

Ctrl +, Ctrl -, and Ctrl 0 now change a computer-local UI zoom value. The main
process calculates each 10-point step against its current value, clamps to 100
through 200, and resets to 100. Bursts cannot lose steps because a window never
calculates a new percentage from an old renderer copy. `AppConfigFile` remains
the sole `app.json` writer, preserving the other UI fields, last service, and
unknown fields through the existing atomic, ordered save path. Broken or newer
files retain their existing protection; zoom can still change in memory so
recovery keys remain usable.

Before loading its page, the control window attaches its web contents to the
zoom registration. This registration isolates zoom, applies the stored factor,
and reapplies the current value after navigation or a renderer reload. Only
explicitly attached control windows receive updates or may invoke the zoom
channels. An output sender is rejected and logged. A failed isolation attempt
never applies a factor, and a failed native application is logged without
throwing into startup or the live path.

Electron's default zoom policy shares a zoom level by origin. The pinned
Electron 44 supports `setZoomMode('isolated')`, which separates the control web
contents and persists across navigation. This avoids relying on different page
filenames to protect output windows. See the
[Electron zoom-mode documentation](https://www.electronjs.org/docs/latest/api/web-contents#contentssetzoommodemode).

The renderer installs one capture listener for all three control workspaces. It
matches physical `code` and modifiers without reading the typed character: Ctrl
Equal, Ctrl Shift Equal, and Ctrl NumpadAdd enlarge; Ctrl Minus and Ctrl
NumpadSubtract reduce; Ctrl Digit0 and Ctrl Numpad0 reset. Extra Alt or Meta,
and Shift on any alias except Equal, do not match. Recognized keys are consumed
before fields, menus, and dialogs, including at the limits. UI-key repeat is
allowed. Shortcut-recording fields and active IME compositions retain their
keys; composition lifecycle and blur tracking also cover an event whose
composition flag is missing. Unmount removes every listener.

Size classes and column fitting already use `window.innerWidth` on resize, so
they follow the effective CSS viewport after native zoom. When the enlarged
workspace cannot fit, the control App scrolls. Its workspace keeps the existing
minimum window height minus the menu, current toolbar, and status bar heights,
all from design tokens. This prevents the large preview from collapsing at 200%
while keeping the existing narrow form. Preview rendering and its output
proportions are unchanged. Zoom never sends a live command, changes a lyric
style, or rewrites thumbnail or column settings.

Shutdown removes the zoom channels and window listeners before flushing the
shared app config. Window destruction also releases its registration.

## Changed files

- `src/shared/schema/uiZoom.ts` and its tests: strict percentage/command
  validation, limits, and invalid stored-value fallback tests.
- `src/shared/schema/appConfig.ts`, `src/shared/ipc.ts`, preload, and fake API:
  optional local setting and checked read/change methods.
- `src/main/store/appConfigFile.ts` and its tests: the getter/default and
  ordered single-writer updates alongside existing fields.
- `src/main/store/uiZoom.ts` and its tests: main-owned commands, attached
  control windows, isolation, restoration, IPC validation, and cleanup.
- `src/main/windows/control.ts` and its test, and `src/main/index.ts` and its
  wiring test: attachment before page load and disposal before saving.
- `src/renderer/src/shell/uiZoomKeys.ts` and its tests: physical key aliases,
  focus/IME rules, and listener lifetime.
- `src/renderer/src/control/App.tsx`, its test, and `App.module.css`: all
  workspace integration, effective viewport, and overflow recovery.
- This review document. No output-window or output-renderer source changed.

## Checks run

| Command or test                                               | Result                                             |
| ------------------------------------------------------------- | -------------------------------------------------- |
| `npm run typecheck`                                           | Passed, including after rebase                     |
| Contract/store/preload/fake API focused tests                 | Passed: 5 files, 92 tests                          |
| Zoom registration, control window, startup wiring tests       | Passed: 3 files, 29 tests                          |
| Renderer keys, App, Workspace, clear keys, PreviewPanel tests | Passed: 5 files, 89 tests                          |
| ESLint on changed TypeScript files                            | Passed after final renderer brace-style correction |
| `npm run format`                                              | Passed before each code commit                     |
| `npm run build`                                               | Passed, including after rebase                     |
| Real Electron offscreen check after rebase                    | Passed; results below                              |
| `npm run verify`                                              | Passed once: all 5 steps, 163.1 s                  |

The native check runs the built app with `LLP_TEST_WINDOWS=offscreen` and
`LLP_USER_DATA` under this worktree's ignored `.llp` folder. Its script was
checked with `node --check` before Electron started. All windows stayed hidden.
It verified:

- Stored 150% at launch, isolated mode, actual native Ctrl Equal/Minus/0 input,
  and the 100% and 200% clamps.
- An actual output page retains zoom factor 1 while the control reaches 2.
- At 1280 by 720 DIP and 200%, the CSS viewport is 640 by 360 and selects
  `narrow`. Both scroll offsets move: width 1092 versus client width 633, height
  720 versus client height 353.
- All three preview frames remain positive and 16:9: large frame approximately
  252.44 by 141.99, two small frames 64 by 36.
- The live-state snapshot stays unchanged throughout the zoom commands.
- Immediate shutdown after the final command persists 110%, proving the pending
  app-config save is flushed.

Local native-check log: `.llp/ui-zoom-smoke-rebased.log`; result artifact:
`.llp/ui-zoom-smoke-result.json`. The normal unit tests are committed; these
local diagnostic artifacts stay ignored.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes.
- [x] `npm run format:check` passes in verify.
- [x] New storage, IPC, window, keyboard, and overflow behaviors have tests or
      the recorded real Electron check.
- [x] IPC commands and replies pass schemas. New validation stays in schema
      modules.
- [x] No `any`, type assertions that bypass checks, or non-null assertions.
- [x] Window listeners, IME/key listeners, and IPC handlers are released.
- [x] The registration holds only attached control windows; destruction removes
      entries. No document cache, recurring timer, or output subscription added.
- [x] Zoom is isolated from output windows; native failures are logged.
- [x] Only size-class boundary changes re-render the App; zoom uses the native
      viewport and existing resize/refit behavior.
- [x] Helpers and names follow the repository's code and comment conventions.
- [x] Every added CSS size uses existing design tokens.
- [x] Scope is the requested UI zoom slice and its necessary overflow recovery.
- [ ] No long-running performance benchmark was run for this request.

## Decisions I made (for the lead to confirm)

1. The stored field stays optional for old files. The file schema defaults an
   invalid present value to 100; the store getter supplies 100 for an absent
   value. Other broken app-config fields still mark the file broken and prevent
   writes as before.
2. Zoom changes are commands rather than absolute renderer-calculated values, so
   rapid keys and multiple control windows always use main's current value.
3. The registry admits only explicitly attached control windows and fails closed
   if native isolation fails. The future settings window can attach to the same
   registry when it is implemented.
4. The App overflow adjustment is needed to keep controls and the large preview
   reachable below the normal logical minimum height after zoom. It uses the
   existing design tokens and leaves other workspaces' content and output
   geometry alone.

## Where to look

- `src/main/store/uiZoom.test.ts`: isolation, bursts/limits, output senders,
  reloads, native failures, and cleanup.
- `src/renderer/src/shell/uiZoomKeys.test.tsx`: aliases and focus precedence.
- `src/renderer/src/control/App.test.tsx`: workspace integration without live
  commands, and effective viewport size classes.
- `src/main/store/appConfigFile.test.ts`: persistence, defaulting, other fields,
  and broken-file protection.

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
