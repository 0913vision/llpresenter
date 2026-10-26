# Review request: `output-46`

- Team member: `output`
- Branch: `feat/output/audio-player`
- Base and range: in the request message; round 2 rebased onto local `main`.
- Scope: O7's reusable audio player. The hidden window and media-store wiring
  follow in output-47, then fade and undo. O7 remains open.
- GitHub head CI: URL and result in the request message.

## What changed and why

`AudioPlayer` keeps two hidden audio elements, muted unless explicitly allowed.
Only the dedicated hidden audio window will own it; previews and screen outputs
do not create audio players. The next request connects that window.

A new track loads on the spare while the last good track keeps playing. The
spare takes over only after its play promise succeeds, or when prepared paused.
A decoder failure is logged and leaves the previous track alone. Track versions
distinguish restarts and repeated playlist entries; generations reject old play
completions after a selection change, pause or clear.

The player reads output-44's monotonic position anchor, handles pause/resume and
live volume without reloading, and reports one next action per ended running
track. Unchanged states do not seek or reload. Clearing unloads both sources;
disposal also removes all listeners and elements. Error reports are deduplicated
and capped at 32; synchronous and asynchronous playback errors are isolated.

## Changed files

- `src/renderer/src/render/audioPlayer.ts` and `audioPlayer.test.ts`.
- This review document. Changes outside my paths: none.

## Checks run

- Renderer player tests: 8 pass, using mocked media methods and muted elements.
- Typecheck, own-file ESLint and formatting: see request message.
- Full `npm run verify`: GitHub CI only, URL/result in request message.
- No native windows, media playback or audio were started on this PC.

## Quality checklist

- [x] Default mute, position, pause/resume and volume regression coverage
- [x] Last good track, stale play completion, pending pause and clear coverage
- [x] Ended-event deduplication and disposal coverage
- [x] Fixed element/listener counts and bounded error reporting
- [x] No dependencies, shared changes, unchecked assertions or non-null
      assertions
- [ ] GitHub head verify passes (see request message)

## Review: lead

- Verdict: pending

## Review: reviewer

- Verdict: pending

## Team member's reply

Round 1 reply:

1. A paused replacement now pauses the active fallback immediately, before
   waiting for the replacement's `canplay`. The new regression starts A, loads
   B, pauses B before readiness, then fails B. It verifies that A was paused,
   remains loaded, and is not restarted. The regression failed on the reviewed
   code before this fix. No other transport behavior changes.
