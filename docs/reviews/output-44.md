# Review request: `output-44`

- Team member: `output`
- Branch: `feat/output/audio-transport`
- Base and review range: in the request message; initially stacked on output-43.
- Scope: M3-O7 transport foundation. The hidden player and media-store wiring
  follow in the next request; fade and undo follow that. O7 remains open.
- GitHub head CI: URL and result in the request message.

## What changed and why

Audio commands now have a registered live slice: explicit media or playlist
play, pause and resume at the same position, previous, next, playlist repeat,
and live volume. Sources resolve against a supplied current media catalog; only
audio items can play. Duplicate playlist entries retain their positions. A track
version distinguishes explicit restarts of the same file. Paused positions and
running anchors use main's monotonic clock. Volume defaults to 100 and survives
clears without being saved.

The media-reader connection is identity-safe. Missing targets and catalog errors
use the existing reducer diagnostics and preserve the last good state. The next
request connects the real media reader and hidden audio renderer. This request
creates no audio elements and does not produce sound.

The shared playback schema is additive and optional, preserving old audio
states. Positions and track versions are finite and capped; sources reuse D1b's
validated command schema. The mute policy permits sound only in a packaged run
without test flags, including when a packaged test explicitly sets
`LLP_TEST_WINDOWS`. The hidden window will enforce it in the next request.

## Changes outside my paths

- `src/shared/live.ts`, `schema/liveState.ts`, `schema/liveActions.ts`, and new
  `schema/audioState.ts` with tests: optional playback and volume state, using
  data's payload validation and source contracts. No existing field changed.

## Checks run

- `npm run typecheck`: pass.
- Targeted live, macro, audio state, live action/state and mute policy tests:
  353 tests pass across 29 files.
- Own-file ESLint and formatting: see request message.
- Full `npm run verify`: GitHub CI only, see request message.

### Known flaky native test

The implementation commit `7ca51090` was checked by
[CI run 40287488840](https://github.com/0913vision/llpresenter/actions/runs/40287488840).
Typecheck, lint, formatting and build passed. Tests: 5,207 passed, 3 skipped,
and one failed: `src/main/outputs/fullscreenOrder.electron.test.ts`, where
`win.isAlwaysOnTop()` was false in the native full-screen fixture.

The lead classified this as the known flaky test under the October 24 decision
in `docs/decisions.md`: record it and do not rerun. The lead authorized this
review request with that exception and assigned the recurring failure as a
separate fix before the audio player. This diff changes only audio transport,
its additive state schemas, the mute policy, and their tests. It does not change
`electronWindow.ts`, `onTopKeeper.ts`, `windowPlacement.ts`, the native fixture,
or any full-screen or always-on-top calls. This follow-up commit records the CI
evidence and changes no implementation.

## Quality checklist

- [x] Transport, malformed playback, volume bounds and mute policy tests
- [x] Errors preserve output state and do not block other output commands
- [x] No audio elements, timers, subscriptions or growing collections added
- [x] No dependencies, unchecked assertions, `any`, or non-null assertions
- [x] Comment rules and exported TSDoc placement checked
- [ ] GitHub head verify passes (see request message)

## Decisions I made

An empty `audio.play` resumes a paused track and otherwise does nothing. The
audio tab supplies its selected playlist explicitly when starting from empty.
Track selection uses the current catalog, not an unbounded copy in live state.

## Where to look

- `src/main/live/slices/audio.ts` and `audio.test.ts`.
- `src/shared/schema/audioState.ts` and its valid/invalid state tests.
- `src/main/windows/audioPolicy.ts` and its dev/test/packaged matrix.

## Review: lead

- Verdict: pending

## Review: reviewer

- Verdict: pending

## Team member's reply

1.
