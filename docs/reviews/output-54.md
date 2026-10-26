# Review request: `output-54`

- Team member: `output`
- Branch: `fix/output/window-interaction`
- Base, head, review range and CI: in the request message.
- Scope: the m3-check3 pointer/always-on-top user decisions and M3-C3-9.
- Stacked on output-53 until the lead merges it. New feature work stays frozen.

## What changed and why

The output pointer stays visible. New screens and screens without an explicit
always-on-top value default to off, including the properties switch and the
preferences default. Existing explicit values remain effective.

An output raises once when first shown with `showInactive` and `moveTop`.
Subsequent placement corrections leave the control window alone, and only an
enabled always-on-top keeper maintains its stacking. Clicking a visible output
sends the existing show-window command and raises it again. Full screen windows
remain focusable so Windows accepts mouse input; showing them and changing their
settings never calls `focus` or `show`.

Changing only always on top now calls a dedicated stacking setter. It never
re-enters full screen, resets bounds, changes focusability or raises either
window. Pending placement callbacks read the latest stacking choice rather than
restoring the stale flag captured before the operator's change. Disabling always
on top releases the keeper and its timer. Monitor-disconnect demotion remains
the explicit exception: the affected output drops topmost and places the control
above it until the operator raises it or its full screen placement returns.

An output's native key events forward to the control renderer's active element,
preserving the existing clear, navigation and field/dialog precedence handlers.
The control is never focused or raised. Forwarding has one script in flight and
at most 64 queued events; held-key repeats are swallowed, errors log once, and
disposal drops the queue and listener. The control's web contents are captured
once and guarded against destruction.

## Changes outside my paths

- `src/renderer/src/screens/screenEdits.ts` and its test, plus
  `ScreenProperties.test.tsx`: the screen properties default follows the user's
  default-off decision. No properties layout change.
- `src/shared/schema/preferences.ts`: default-off value for new screens, keeping
  the existing optional schema and explicit saved values.
- `docs/spec/03-output.md` and `06-settings.md`: record visible pointer,
  default-off, raise-once/click behavior and stacking-only settings changes.
- `docs/spec/02-data.md`: correct the `alwaysOnTop` preference default to false.

## Checks run

- Targeted native-call fakes, output lifecycle, renderer pointer behavior,
  screen properties and defaults: see request message.
- Regressions cover twenty stacking changes without bounds/full-screen/focus
  calls; a late placement uses the current flag; a visible output raises once;
  pointer IPC stops after disposal; only enabled topmost gets a keeper; monitor
  removal still demotes safely.
- Typecheck, build, formatting and lint: see request message. Full verify runs
  on GitHub.
- The first
  [CI run](https://github.com/0913vision/llpresenter/actions/runs/40339237255)
  passed coverage, typecheck, format and build but failed three curly-brace lint
  checks after formatting. The branches were restacked on output-53's review
  fixes, the braces were corrected and lint was run after formatting completed.

## Checked in the app

- Built with `npm run build` and syntax-checked the CDP launcher with
  `node --check` before Electron started. Runs use `LLP_TEST_WINDOWS=offscreen`,
  `LLP_DEV_PORT=5182` and an isolated output-member fixture. No sound or desktop
  window is allowed.
- Both complete launches enabled the 본 화면 and 무대 화면 outputs. In each
  launch, selected those screens back and forth 25 times, switched 항상 위 on
  and off 25 times each, and dispatched 25 real CDP pointer clicks to the output
  renderer. Every click reached main's existing show-window channel. Missing
  flags initially showed the switch off; every edit persisted the chosen value.
- Preview bounds stayed identical during every stacking change. Native-call
  observation of the real control and output windows found no movement, resize,
  full-screen, focus, raise or focusability call from those settings changes in
  offscreen mode. The output's computed cursor stayed visible during the
  repeated check. All native windows stayed hidden throughout.
- Both launches closed the control normally and exited all Electron processes.
  There were five renderer targets throughout, with 314 live DOM elements, 809
  CDP DOM nodes and 346 listeners at iterations 5 and 25. Collected control
  heaps were 5,720,504 to 5,963,964 bytes and 5,797,980 to 6,073,532 bytes. This
  short repeated-flow check showed no growing window or element count; it is not
  an hours-long soak.
- Screenshots: [screen properties](evidence/output-54/properties-run1.png),
  [second launch properties](evidence/output-54/properties-run2.png),
  [output](evidence/output-54/output-run1.png).
- Offscreen mode intentionally suppresses native presentation and topmost. The
  app check can exercise two live outputs, settings persistence, geometry and
  pointer-to-main dispatch, but cannot prove the Windows desktop stacking or
  hardware pointer hit testing. Native-call fakes verify those presentation
  instructions; the user's native check must confirm the actual desktop order.

- After restacking on output-53 round 3, 180 focused tests and typecheck pass.
  The rebuilt app repeats both launches and all 25 interaction cycles: five
  targets, 318 elements, 815 CDP nodes and 364 listeners remain constant.
  Collected heaps are 5,776,188 to 6,065,628 bytes and 5,779,180 to 6,062,972
  bytes. Both launches quit normally. The screenshots above are refreshed. One
  preceding launch failed the initial geometry comparison before collecting
  samples; the instrumented two-launch check recorded unchanged bounds and no
  native movement or focus calls throughout the stacking edits.

### Round 3 app check

- Rebuilt after the key-forwarding fix and checked the launcher with
  `node --check`. Two offscreen launches repeat the screen selection,
  always-on-top and pointer checks 25 times each. Cursor visibility is now
  sampled with both setting values. Preview-frame bounds remain unchanged.
- Each cycle then opens the sample song in 진행, clicks the output, and sends
  native F2 and left/right keys to that output through main CDP using
  `webContents.sendInputEvent`. F2 clears the live slide, right advances from
  position 0 to 1 and left returns to 0. All F1 to F7 keys reach the existing
  control handlers in order. No focus, raise, bounds or full-screen call comes
  from changing the settings. The preliminary renderer-only CDP key injection
  did not clear, so the final check uses the native Electron input path.
- Both launches quit normally. Five targets, 527 live elements, 1,936 CDP nodes
  and 442 listeners remain constant at iterations 5 and 25. Collected heaps are
  6,689,628 to 7,267,656 bytes and 6,858,204 to 7,444,020 bytes. This is a short
  repeated-flow check, with the same native-desktop limits described above.
- Screenshots:
  [screen properties](evidence/output-54-round3/properties-run1.png),
  [click-then-key navigation](evidence/output-54-round3/key-navigation-run1.png),
  [second launch](evidence/output-54-round3/key-navigation-run2.png),
  [output](evidence/output-54-round3/output-run1.png).

## Review: lead

- Verdict: pending

## Review: reviewer

- Verdict: pending

## Team member's reply

### Round 3

1. Native output key down/up events now reach the control's existing handlers
   after a click, without changing focus or stacking. The click-then-key
   regression covers clear and slide navigation, queue bounds and disposal while
   control destruction or delivery is pending. Active-element dispatch preserves
   text-field and dialog precedence, modifiers and Num Lock state. The app check
   injects native keys into the clicked output through main CDP; a preliminary
   renderer-only CDP key injection did not exercise this path.
2. Spec 02 now documents the existing `alwaysOnTop` preference default as false.
