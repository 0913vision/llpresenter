# Review request: `output-45`

- Team member: `output`
- Branch: `fix/output/fullscreen-topmost-settle`
- Base: `995786fa5c347f9c05d9a4f0b186d329e64c8fe9` (local `main`).
- Head, review range and GitHub CI: in the request message.
- Scope: the recurring native `win.isAlwaysOnTop()` failure after output-36.

## Cause

[Run 40287488840](https://github.com/0913vision/llpresenter/actions/runs/40287488840)
failed after the keeper's interval despite two `true` events on reentry. The
pinned Electron 44.9.3 implementation explains how that can happen:

1. [BaseWindow::SetAlwaysOnTop](https://github.com/electron/electron/blob/v44.9.3/shell/browser/api/electron_api_base_window.cc#L595)
   defaults the level to `floating`.
2. [NativeWindowViews::SetAlwaysOnTop](https://github.com/electron/electron/blob/v44.9.3/shell/browser/native_window_views.cc#L1196)
   sets the native Z order, then for `floating` calls
   [MoveBehindTaskBarIfNeeded](https://github.com/electron/electron/blob/v44.9.3/shell/browser/native_window_views.cc#L2119).
   That places the output after `Shell_TrayWnd` with `SetWindowPos`. Only after
   this move does Electron report the requested always-on-top value.
3. [Win32 SetWindowPos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowpos#remarks)
   removes topmost status when a topmost window is placed after a non-topmost
   window. If the taskbar is not topmost, the default level therefore undoes its
   own topmost setting. A `true` Electron event does not prove the final native
   style. Repeating the same default-level call cannot fix this case.

This identifies the taskbar-dependent failure path rather than assuming an
unexplained outside application changed the window, as output-36 did. The unit
regression models a non-topmost taskbar; the native CI fixture checks the real
window on reentry. No native window was opened locally.

## What changed and why

- `OnTopKeeper` uses the explicit `screen-saver` level whenever it sets or
  restores topmost. Electron skips its taskbar-relative move at this level.
  Turning topmost off keeps the existing call. The bounded single restore,
  second-loss error, polling interval and listener cleanup stay in place.
- A regression covers first set, repair, and off with a non-topmost taskbar.
  Existing window tests assert the explicit level through the output path.
- The native fixture asserts topmost immediately on first entry and reentry, as
  well as after the existing keeper interval. Errors are printed before
  assertions, so a failure no longer hides the keeper's diagnostics. No wait,
  retry loop, repeated test run, or relaxed assertion was added.

## Changed files

- `src/main/outputs/onTopKeeper.ts` and `onTopKeeper.test.ts`.
- `src/main/outputs/electronWindow.test.ts`.
- `src/main/outputs/fixtures/fullscreenOrder.mts`.
- This review document. Changes outside my paths: none.

## Checks run

- `npm run typecheck`: pass after rebasing onto local `main`.
- Own-file ESLint: pass.
- Outputs unit suite and formatting: see request message.
- Mutation: removing the explicit level fails the new taskbar regression at its
  first topmost assertion (`.llp/output-45-mutation.log`); the file was
  restored. The mutation ran after committing the product change.
- Full `npm run verify`, including the native Windows fixture: GitHub CI only,
  URL and result in the request message.

## Quality checklist

- [x] Regression rejects the broken default-level behavior
- [x] Existing second-loss and exception behavior stays bounded and logged
- [x] No new timer, listener, dependency, or shared contract
- [x] Comment rules, formatting, and exported TSDoc placement checked
- [ ] GitHub head verify passes (see request message)

## Review: lead

- Verdict: pending

## Review: reviewer

- Verdict: pending

## Team member's reply

1.
