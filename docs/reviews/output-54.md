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

## Changes outside my paths

- `src/renderer/src/screens/screenEdits.ts` and its test, plus
  `ScreenProperties.test.tsx`: the screen properties default follows the user's
  default-off decision. No properties layout change.
- `src/shared/schema/preferences.ts`: default-off value for new screens, keeping
  the existing optional schema and explicit saved values.
- `docs/spec/03-output.md` and `06-settings.md`: record visible pointer,
  default-off, raise-once/click behavior and stacking-only settings changes.

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
  offscreen mode. The output's computed cursor stayed visible with both flag
  values. All native windows stayed hidden throughout.
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

## Review: lead

- Verdict: pending

## Review: reviewer

- Verdict: pending

## Team member's reply

1.
