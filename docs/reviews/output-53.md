# Review request: `output-53`

- Team member: `output`
- Branch: `fix/output/ready-frame-reveal`
- Base, head, review range and CI: in the request message.
- Scope: urgent M3-C3-1 from the user's `m3-check3` run. Argon second review
  requested by the lead. Media properties and O3 remain queued behind this fix.

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

## Changes outside my paths

- `src/shared/ipc.ts`, `schema/ipcPayloads.ts` and its test: additive validated
  ready report and boolean reply, with finite safe versions and capped IDs.
- `src/preload/index.ts` and its test: checked request/reply transport.
- `src/shared/testing/fakeLlpApi.ts`: default fake ready reply.
- `src/main/ipc.ts`: let the existing answer-registration helper accept a
  validated request payload, retaining its disposal path.

## Checks run

- Targeted output lifecycle, placement, IPC, background and renderer tests,
  typecheck, own-file lint and formatting: see request message.
- Regressions: heartbeat and stale frames cannot reveal; a hidden page keeps its
  newest lyrics/background; decode waits; no dissolve on reveal; the background
  still dissolves on a later shown change; window reuse and cleanup.
- Placement tests simulate an immediately ready page. Dedicated readiness tests
  explicitly delay decoding and reject stale versions.
- No local Electron or native window was started and no sound was played.
- Full verify runs on GitHub. Under the lead's API-403 rule, the lead confirms
  exact-head CI before merging.

## Review: lead

- Verdict: pending

## Review: reviewer

- Verdict: pending

## Team member's reply

1.
