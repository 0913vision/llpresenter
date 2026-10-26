# Review request: `output-53`

- Team member: `output`
- Branch: `fix/output/ready-frame-reveal`
- Base, head, review range and CI: in the request message.
- Scope: urgent M3-C3-1 and M3-C3-7 from the user's `m3-check3` run. Argon
  second review requested by the lead. New feature work is frozen.

## What changed and why

The first output toggle previously created and showed its window immediately.
Lyrics could draw before the background decoder supplied a frame, then the
normal background dissolve exposed a partial picture. Later toggles reused the
already loaded window and appeared instant.

Configured screens now preload one hidden window each, including before the
first on command. Hidden pages keep following live state and decoding their
backgrounds, and renderer recovery continues while hidden. Each window is reused
until its screen is removed or the app quits. Its current placement size is
prepared without showing it.

A separate frame probe carries the screen, current live version, completeness
and actual viewport size. Main accepts a complete frame only at the native
window's prepared content size. The renderer retries every 100 ms while on and
awaiting a reveal, including without a DOM resize event. Preparing an equal-size
placement never discards a valid current frame. Probes only acknowledge
visibility once a window is already shown; they never reapply its placement.

An output requested on never waits hidden indefinitely: after the named 1,500 ms
deadline main reveals what is drawn and warns once for that window. Switching
off or disposing cancels the deadline. Unavailable monitor information uses the
existing window fallback rather than preventing the requested output entirely.
Hidden windows are sized before the operator's first on command.

The renderer waits for known screen settings, fonts, a complete current
background and two frame callbacks stable at the current version and viewport
before reporting completeness. A video uses its decoded frame callback when
available, with a 250 ms current-data fallback if hidden presentation suppresses
that callback; images report after loading. Hidden content and the pending
reveal have no background or lyric transition. The normal 500 ms background
dissolve remains for changes after main acknowledges a reveal. Ready IPC has at
most one request in flight, and all video callbacks, frame callbacks and
listeners are cancelled on disposal.

The same renderer transition flag makes every newly mounted preview draw its
current frame instantly. It stays instant for redraws of that initial content;
subsequent content changes retain the normal dissolve. This covers both the live
ScreenPreview and the local song preview that remounts after leaving the 준비
media view, without separate transition implementations.

## Changes outside my paths

- `src/shared/ipc.ts`, `schema/ipcPayloads.ts` and its test: additive validated
  ready report and boolean reply, with finite safe versions and capped IDs.
- `src/preload/index.ts` and its test: checked request/reply transport.
- `src/shared/testing/fakeLlpApi.ts`: default fake ready reply.
- `src/main/ipc.ts`: let the existing answer-registration helper accept a
  validated request payload, retaining its disposal path.
- `src/renderer/src/show/ScreenPreview.test.tsx`: exercise the real shared
  renderer through a preview remount and a subsequent live slide change.
- `src/renderer/src/prep/editor/SongPreview.tsx`, `songPreviewModel.ts` and
  `SongPreviewMount.test.tsx`: keep initial picture identity stable through
  separate asynchronous Look, screen and label redraws.
- Spec 03: record the bounded reveal fallback requested during Argon's review.

## Checks run

- Targeted output lifecycle, placement, IPC, background and renderer tests,
  typecheck, own-file lint and formatting: see request message.
- Regressions: heartbeat and stale frames cannot reveal; a hidden page keeps its
  newest lyrics/background; decode waits; no dissolve on reveal; the background
  still dissolves on a later shown change; window reuse and cleanup.
- Placement tests simulate an immediately ready page. Dedicated readiness tests
  explicitly delay decoding and reject stale versions.
- The real app was built and exercised offscreen as recorded below. No sound was
  played and no window appeared on the user's desktop.
- Full verify runs on GitHub. Under the lead's API-403 rule, the lead confirms
  exact-head CI before merging.
- The first head's
  [CI run](https://github.com/0913vision/llpresenter/actions/runs/40331579225)
  passed coverage tests and build but failed lint: formatting expanded six
  single-line conditions/loops that then required braces. Those braces are
  corrected, and own-file lint is checked after formatting for the new head.

## Checked in the app

- Built with `npm run build`. The CDP check script passed `node --check` before
  Electron started. Two complete launches used `LLP_TEST_WINDOWS=offscreen`,
  `LLP_DEV_PORT=5182` and an isolated output-member fixture copied from
  `docs/qa/m3-check/sample`. All videos stayed muted.
- In each launch, changed the live lyrics and silent background while hidden,
  then turned the output on and off 25 times. Each reveal waited for main's
  actual current-version ready acknowledgment, with a decoded background at
  opacity 1 and no lyric/background transition. Hidden windows displayed the
  newest state. BrowserWindow visibility remained false throughout the check.
- In each launch, selected an invented library song in 준비 and switched to
  media and back 25 times. The remounted preview had a zero-second transition
  and showed the selected slide immediately. Both launches quit normally,
  closing all their Electron windows and processes.
- Across output iterations 5 to 25, the five renderer target IDs and the DOM and
  video element counts stayed unchanged. Collected output heaps were 2,449,720
  to 2,459,004 bytes in run 1 and 2,437,724 to 2,447,180 in run 2. Preview
  remounts kept 346 live DOM elements, 1,035 CDP DOM nodes and 375 listeners;
  collected control heaps were 6,402,480 to 6,695,592 bytes and 6,400,032 to
  6,686,996 bytes. This is a short repeated-flow check, not an hours-long soak.
- Screenshots: [control](evidence/output-53/control-run1.png),
  [decoded output](evidence/output-53/output-run1.png),
  [준비 after media remount](evidence/output-53/prep-remount-run1.png),
  [second launch](evidence/output-53/prep-remount-run2.png).
- Round 2 repeats both launches against the review fixes. Each launch also
  alternates a missing background and an intentionally corrupt image 20 times:
  main acknowledges a completed fallback and valid lyrics remain visible at
  once. After a full screen to window change, native bounds set to x 123, y 234,
  1100 by 700 remain exactly unchanged through 20 off/on cycles. These are
  hidden native bounds and decoder checks, not a desktop full-screen check.
- Round 2 again kept five targets and 70 output elements with two videos. Output
  heaps at iterations 5 and 25 were 2,454,536 to 2,463,632 bytes and 2,454,384
  to 2,463,660 bytes. Prep remounts kept 347 live elements and 376 listeners,
  with collected heaps 6,643,908 to 6,935,208 bytes and 6,641,024 to 6,949,316
  bytes. Both launches closed normally.
- Round 2 screenshots:
  [fallback with valid lyrics](evidence/output-53-round2/fallback-run1.png),
  [second fallback run](evidence/output-53-round2/fallback-run2.png),
  [remounted preview](evidence/output-53-round2/prep-remount-run1.png).

### Round 3 app check

- Rebuilt the rebased branch and syntax-checked the launcher before each run.
  Two offscreen launches repeat the normal, failed-media, operator-bounds and
  preview-remount flows above. The viewport is already prepared before first on;
  accepted complete reports are compared with native content bounds.
- The check suppresses video frame callbacks and changes the hidden background
  to another silent video entry. It also denies every completeness report for
  two on/off cycles in each launch. Both cycles must reveal despite that denial,
  and the preparation timeout must appear exactly once in the window's log.
- Screen-settings reads in the control window are delayed 500 ms, independently
  of the Look response. The remounted song preview remains instant both before
  and after that response and across 25 media-view remounts per launch.
- Both launches quit normally. The four forced-reveal acknowledgments arrived
  1,617 to 1,636 ms after on, following the 1,500 ms deadline and status
  polling. Each window logged the timeout exactly once across both forced
  reveals. Five targets, 70 output elements and two videos remained constant;
  output heaps at iterations 5 and 25 were 2,467,100 to 2,477,316 bytes and
  2,455,540 to 2,465,316 bytes. Preview remounts kept 346 live elements, 1,038
  CDP nodes and 389 listeners, with heaps 6,709,584 to 6,989,076 bytes and
  6,706,332 to 6,996,120 bytes. This is a repeated short flow, not an hours-long
  soak.
- Offscreen mode cannot reproduce Windows' actual hidden compositor; callback
  suppression and main's forced deadline exercise its bounded fallback without
  exposing a desktop window or playing sound. Native hidden-window behavior
  still needs the user's normal-mode check.
- Screenshots: [deadline fallback](evidence/output-53-round3/deadline-run1.png),
  [second deadline run](evidence/output-53-round3/deadline-run2.png),
  [delayed-settings preview](evidence/output-53-round3/prep-remount-run1.png).

## Verdicts (recorded by the lead at merge)

- Rounds 1 and 2 (Codex): see the findings and replies above.
- Second review round 1 (Gemini 4 Argon, gem1): Request changes, two High (an
  output could stay hidden for good; the reveal could wait forever on a video
  frame), two Medium, and one Low.
- Round 3 (1dbd62a7): reviewer (Codex, codex3) Approve; Argon round 2 Approve,
  no findings. Lead Approve; output windows are preloaded hidden and revealed on
  a complete frame, with a named deadline so an output the operator turned on is
  never left hidden. Fixes M3-C3-1 and M3-C3-7 from the user's check. The
  exact-head CI run passed, checked by the lead at merge. Rebased by the lead
  onto local `main` without conflicts; typecheck passes.

## Team member's reply

### Round 2

1. Terminal video errors, rejected playback and failed image fallback now finish
   readiness with the last good background or the empty screen color. A failed
   replacement unloads its candidate and cancels pending work; changing to a new
   source waits for that source again. Regressions cover initial
   video/image/play failure revealing valid lyrics and a failed replacement
   retaining its last good background.
2. Hidden preparation now uses the same operator-bound preservation decision as
   actual placement. An existing window-method output keeps its native size and
   position without a default `setContentBounds` before reveal. A regression
   covers full screen to window, operator resize, and off/on with a new version.
   Rebased onto local main for this round. See the round 2 request for checks
   and exact-head CI.

### Round 3

1. Hidden windows are prepared while off. Ready probes include their actual
   viewport, and main compares it with native content bounds. A size-stable
   method/origin change no longer invalidates the current frame. The renderer
   retries the same version and stabilizes two frames at the actual viewport,
   without depending on a resize event. The 1,500 ms main deadline reveals the
   drawn frame and warns once if no complete frame arrives, including when
   monitor discovery fails. Deadline disposal and cancellation are tested.
2. A suppressed video frame callback falls back after 250 ms when current data
   exists. Both the callback and timer are cancelled on source changes and
   disposal. Main's reveal deadline independently bounds fonts, decoder or IPC
   readiness stalls.
3. A shown acknowledgment belongs to the enable cycle, so a newer live version
   cannot discard it. Redrawing after acknowledgment upgrades a pending content
   replacement to its normal dissolve. Loop handovers remain immediate.
4. The local song preview memoizes its layers by actual content and visibility,
   rather than the enclosing settings object. A real renderer test resolves
   Looks, then screens, then labels separately: the initial picture remains
   instant, and only a new selected block enables the normal transition.
5. Requesting output resumes renderer recovery before entering the readiness
   gate. A limited hidden renderer retries immediately without needing to
   produce an impossible ready frame first.
