# Review request: `output-24`

- Team member: `output`
- Branch: `feat/output/screen-backend`
- Base: `867f97149406bbc0058541bd67e54c69574bddd2`
- Code head: `4f45c000ba89166fef8f3c9f053b57dcf4e95ab0`
- Range: `867f971...feat/output/screen-backend`
- Scope: M3-O9a part 1, window methods. Settings wiring follows in output-25.
- Code CI:
  [40223573887](https://github.com/0913vision/llpresenter/actions/runs/40223573887),
  **success** at `3209af45f151d460b67d24763189d34dfd62bcd5`.

## Changes

Capture outputs use a fixed client size, default 1920 x 1080, without shrinking
to the control monitor. Their windows cannot minimize, maximize or resize by
hand, and keep drawing while covered. Returning to a normal window restores
those controls. Full screen, capture and normal windows reuse the same handle,
page and live content. Capture outputs do not reserve a saved monitor.

Always on top defaults on for full screen and off for the other methods when
unspecified; explicit choices apply in place. Fallback windows always turn it
off. The output-21 immediate demotion, control-relative order, bounded
fullscreen exit and one late bounds correction remain intact. Capture placement
uses the same correction mechanism with client bounds rather than outer window
bounds.

Renderer identity now includes the method. Capture switches the empty color to
`chroma` without rebuilding layers or restarting media. A still image's opaque
backing follows this empty color, keeping transparent PNG dissolves consistent
with both black and chroma. The native background uses the matching hex value
because BrowserWindow cannot consume a CSS variable.

## Changed files

- `src/main/outputs/{screens,placement,manager,outputWindow,testing}.ts` and
  relevant tests: capture placement, method flags, window reuse and monitor use.
- `src/main/outputs/{electronWindow,windowPlacement}.ts` and Electron fakes:
  native client bounds, controls, order, bounded correction and cleanup.
- `src/main/outputs/fixtures/fullscreenOrder.mts` and its Windows-only test:
  exact capture client/viewport sizes and covered animation-frame progression.
- `src/renderer/src/render/{layer,screenIdentity,outputRenderer}.ts`,
  `layers.module.css`, their tests and `output/startOutput.test.ts`: method
  metadata, empty color and live-content preservation. No shared or shell edit.

## Verification

- 117 tests across nine relevant files passed in 5.48 seconds. Typecheck,
  targeted ESLint, formatting and whitespace checks passed.
- The capture-placement and empty-color regressions both failed against the
  actual old implementations; corrected files were restored in `finally` and
  both tests then passed. No local full verify or Electron process was run.
- The existing native fixture runs only on GitHub Windows, guarded in both
  harness and child. It checks 1920 x 1080, 1280 x 720 and 3840 x 2160 client
  bounds and viewport size, disables minimize, covers the output and requires a
  new animation frame. Its deadline and unconditional cleanup remain.
  `node --check` passed locally. GitHub Windows passed all three sizes, covered
  frame progression and the existing fullscreen placement proof. The retained
  `native-fullscreen-order.log` artifact records the exact bounds above. Nothing
  was launched locally.
- Covered drawing uses `backgroundThrottling: false`, which Electron documents
  as keeping frames drawn and swapped for the window:
  [BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window).

## Following request and review focus

This request provides the window methods behind the existing ScreenSource
interface. The application still uses its M2 placeholder screen source.
Output-25 will connect settings reads/subscriptions, method/device/resolution
updates and wake-lock lifecycle checks, building on data-36 after the lead's
merge message. The existing display-sleep blocker also prevents system sleep; no
new power-setting switch or dependency is introduced here.

The lead chose data's shared stable starter UUIDs and exact-id-first lookup
before the settings connection. The lead also assigned data the correction of
the starter capture record's inherited `alwaysOnTop: true` to false in data-36,
for new defaults only. Saved explicit choices remain respected. No data-owned
file was changed in this request.

Please check client versus outer bounds, native size proof, method transitions,
always-on-top choices versus fallback safety, and preservation of the output-21
disconnect/reconnect behavior. The O6a soak and the fps-meter item stay
deferred.
