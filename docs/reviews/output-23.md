# Review request: `output-23`

- Team member: `output`
- Branch: `feat/output/overlays`
- Base: `d74de593a52e5ec83443ce98519193db01e6d500`
- Code head: `7c44968c9ca9047bff6300f75dc3f36830156236`
- Range: `d74de59...feat/output/overlays`
- Task: M3-O6a, built on data-31 (`be5a043`). O6b timers stay out of scope.
- GitHub CI: the first run failed in two wiring tests, described below. The
  corrected branch must pass in full before the review request.

## What changed and why

The new registered slices and layers implement messages, notices, several props
and the stage message without a new registry list or shared contract. The main
store receives data-31's main-side settings reader. It snapshots validated
overlay content into live state; windows render copies, never change state.

Messages use generated branded UUIDs, target screens, and absolute deadlines.
Sending to some screens replaces only their prior message. `all` snapshots the
configured screens at send time. Legacy M2 messages remain supported. One main
timer expires the earliest message; deadlines and ids reject stale callbacks.
Zero durations and delays beyond the platform timer limit are handled.

A notice snapshots its image list, targets, interval, repeat and playback clock.
Windows compute the image from the same clock and schedule only the next image
change. Pause retains the image and partial dwell; start resumes it. A notice
without repeat holds its final image without a timer. Late-opening windows join
the current image. Settings edits update active notices and props immediately;
deleting an active item removes it. Missing targets warn with a distinct reason;
unexpected reducer exceptions use `log.error`, addressing the output-22 nit.

F4, F6 and F7 use the existing clear path. Undo restores all cleared overlays,
shifting message deadlines and notice clocks by the time they were down. A
message that expires while another layer is cleared is pruned from its undo
snapshot, including expiry between grouped batch clears. Stage text remains
through F1 and is removed only by its own command; only stage screens draw it.

Text retains two pages and at most two row elements, including multiline text.
Images retain two elements and replace the outgoing image only after decode;
overlay transparency has no black backing. Clears unload images immediately.
Props reuse a bounded pool of views across changes and clears. There are at most
200 active messages, 64 active props, 512 notice images and 200 targets per
overlay, as defined and validated by data-31. Failed replacements keep the last
good image. A timer drawing failure is logged and rotation continues.

Output rendering now accepts an optional frame containing screen identity and
stage text. Exact configured UUIDs win; M2 `main`, `stage` and `broadcast`
aliases resolve through screen settings until O3 supplies configured ids.
Targeted overlays stay hidden until identity resolves. The two authorized shell
changes pass this context into previews and release the screen subscription on
unmount.

## Changed files

- `src/main/index.ts`: start overlays and stop them before closing settings.
- `src/main/index.wiring.test.ts`: provide settings in the mocked data store,
  check the overlay registration context and shutdown before the data store.
- `src/main/live/{slice,sliceRegistry,store}.ts`: per-store settings and
  generated ids in the slice context, plus classified skipped-command logging.
- `src/main/live/commandErrors.ts`, `messageState.ts`, `noticeClock.ts`,
  `messageExpiry.ts`, `overlayRefresh.ts`, `overlays.ts`: target failures, pure
  state/clock helpers and bounded lifecycle services. `noticeClock.ts` has no
  platform imports and is shared with the renderer rather than copied.
- `src/main/live/slices/{messages,notices,props,stageMessage}.ts`: new slices.
- `src/main/live/slices/{clear,batch}.ts`: overlay clock restoration and pruning
  of an expired message in grouped undo.
- `src/main/live/{batch,sliceRegistry,overlays}.test.ts`,
  `src/main/live/testing/overlays.ts`: regressions and validated fixtures.
- `src/renderer/src/render/layers/{message,notice,props,stageMessage}.ts`: new
  registered rendering layers.
- `src/renderer/src/render/{layer,outputRenderer,slideLayer,classes}.ts`,
  `layers.module.css`: frame context, reusable text styles and transparent
  images.
- `src/renderer/src/render/{overlayText,overlayImage,screenIdentity}.ts` and
  their tests, `overlayLayers.test.ts`, `previewOverlays.test.tsx`: reusable
  views, routing, clock, pooling, error handling and preview integration
  coverage.
- `src/renderer/src/output/startOutput.ts` and its test: output-frame wiring.
- **Lead-authorized shell wiring:** `src/renderer/src/show/PreviewPanel.tsx`
  passes `screenId`; `src/renderer/src/show/ScreenPreview.tsx` passes screen
  identity and stage text. No other shell path is changed.
- **Lead-authorized test-only change:** `src/shared/schema/liveActions.test.ts`
  pins the unsupported-action case to a registry containing only `contentSlice`
  and `clearSlice` and renames it. Runtime contracts and preload are unchanged.

## Checks

- Fast local checks before rebase: typecheck and targeted ESLint passed; 22
  relevant test files passed, 260 tests in 11.55 seconds. The additional
  asynchronous notice failure regression then passed with its file, 7/7.
- Post-rebase checks: 22 relevant test files passed, 261 tests in 12.63 seconds;
  typecheck and targeted ESLint passed. Rebased again immediately before push to
  include data-33, with no conflict or changes to the overlay implementation.
- The two log regressions were run against the actual base `store.ts` and
  `sliceRegistry.ts`: both failed on the old warning behavior. Files were
  restored in `finally`; the corrected tests pass.
- `--no-fsModuleCache` avoids the known local Vitest glob expansion cache when
  adding registered modules. No shared test configuration or cache was changed.
- No local full verify, Electron process, visible window, memory measurement or
  soak was run tonight. Full verify runs on GitHub.

### Initial CI failure and correction

[Run 40215422092](https://github.com/0913vision/llpresenter/actions/runs/40215422092)
failed with 21 assertions in two existing wiring test files, with 3,417 tests
passing and one skipped. These failures were caused by this integration, not
environment noise. The main entry test's data-store mock lacked `settings`,
preventing startup. Its fixture now supplies the promise, and a new wiring test
checks that overlays receive it and stop before the data store closes. The
preview tests expected the original one-argument renderer call before screen
identity is available. That call remains intact; the screen frame is passed once
identity resolves. No additional shell test file was modified. Both existing
wiring files plus the new real-preview integration tests pass locally: 48 tests
across three files in 3.55 seconds. Typecheck and targeted lint pass.

## Implementation choices and remaining integration

- One fixed default message style reuses the existing default lyric style until
  M3-X1. Text props use their saved style. Stage layout placement belongs to O5.
- A notice edit that changes only targets keeps its phase. A changed interval,
  image list or repeat setting retains the current image if present and starts a
  new dwell; a paused notice stays paused. Sub-millisecond intervals use the
  platform's one-millisecond timer floor. No interval broadcasts are needed.
- New overlay images swap after decode. Existing lyric and background dissolve
  behavior remains in their own views. Appearance controls and timers are later
  work; no new dependency or contract is requested.

## QA soak scenario, deferred by the lead

Run this for 60 minutes later, when the user permits output and measurement:

1. Use main, captions and stage screens. Include two transparent PNG props, one
   text prop and a three-image notice set with a five-second interval. Record
   app version, screen configuration and starting memory after warmup.
2. Send a 30-second main-only message and a persistent captions-only message.
   After ten seconds, F6, wait ten seconds and undo. Confirm the first retains
   20 seconds. Send `all`, add a screen, and confirm it is not a new target.
3. Start the notice without repeat. Confirm changes at five and ten seconds,
   then a held final image. Enable repeat, pause seven seconds after a fresh
   start, wait, and resume. Confirm the remaining three-second dwell.
4. Change active notice interval and targets, edit active text prop content,
   toggle several props, and clear/undo F4, F6 and F7 singly and in one batch.
   Repeat these actions throughout the hour. Clear another layer while a message
   expires, then undo; confirm it does not return.
5. Keep stage text present through F1/F6/F7, confirm no audience screen shows
   it, then clear it explicitly. Switch previews and reopen an output to check
   routing and clock rejoin. Include a broken replacement image and verify the
   last good picture remains and the other layers continue.
6. Sample main, renderer and GPU memory once per minute after warmup. Record DOM
   nodes, active image sources, timer and listener counts at fixed checkpoints.
   Expect bounded nodes and no increasing retained sources or subscriptions;
   shutdown leaves no overlay timer or listener. Report memory trends with the
   measurements, separating the existing M2 GPU concern from any overlay growth.

## Review focus

Per-screen replacement, expiry versus undo, notice resume/edit clocks, image
handover, pooled prop cleanup, and the two explicitly authorized cross-owner
changes. The long soak remains a QA follow-up, not a claimed result.
