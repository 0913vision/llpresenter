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

A separate ready-frame request carries the screen and current live version. Main
rejects stale or unknown reports and reveals a pending window only after that
version is ready. The reply acknowledges the reveal. Heartbeat/frame-rate
reports alone cannot reveal a window. A ready report never reapplies a visible
window's placement, preserving monitor-removal demotion.

The renderer waits for known screen settings, fonts, a complete current
background and two frame callbacks before reporting. A video uses its decoded
frame callback when available; images report after loading. Hidden content and
the pending reveal have no background or lyric transition. The normal 500 ms
background dissolve remains for changes after main acknowledges a reveal. Ready
IPC has at most one request in flight, and all video callbacks, frame callbacks
and listeners are cancelled on disposal.

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

## Review: lead

- Verdict: pending

## Review: reviewer

- Verdict: pending

## Team member's reply

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
