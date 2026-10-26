# Review request: `output-47`

- Team member: `output`
- Branch: `feat/output/audio-window`
- Base and range: in the request message; stacked on output-46 round 2.
- Scope: O7 hidden audio window, catalog connection and renderer bridge. Fade
  and clear undo follow in output-49, after output-48's identity fix. O7 remains
  open.
- GitHub head CI: URL/result in the request message.

## What changed and why

Main owns one hidden, sandboxed, unfocused audio window with background
throttling disabled. It uses the output page's audio-only entry, independently
of screen toggles, previews and control-window navigation. The real media
catalog connects before macro startup and releases before the data store closes.
Renderer crashes use the existing output recovery policy: quick reloads, then
10/20/40/60-second backoff, continuing during the service. A loaded page that
survives a minute resets the limit. Disposal releases all recovery timers.
Creation/load errors are isolated from the remaining startup and output paths.

Main mutes web contents before loading in dev, tests and offscreen runs. The
renderer independently defaults to muted; only a packaged service run without
test flags receives permission to unmute. Playback uses the Windows default
device. No native audio or windows were executed here.

The audio bridge reads main's clock before following live state, keeps the
fallback clock if that read fails, and releases state subscriptions and the
player on pagehide. Ended notifications carry the track version: main rejects
late or paused-track notifications, so a delayed event cannot skip a newer
selection. Manual next commands without a version keep their existing behavior.

## Changes outside my paths

- `src/shared/schema/liveActions.ts`: additive optional bounded
  `audio.next.trackVersion`, with valid/stale/paused and malformed-value tests.

## Checks run

- Targeted main wiring, audio transport/window/policy and renderer tests: 67
  tests pass across 6 files.
- Typecheck, own-file ESLint and formatting: pass.
- Full `npm run verify`: GitHub CI only, see request message.

## Quality checklist

- [x] Dev/test/offscreen mute and packaged-service policy coverage
- [x] Hidden window, bounded crash handling and late-disposal coverage
- [x] Clock, subscription lifecycle and guarded ended transport coverage
- [x] Main startup/disposal wiring and exception isolation coverage
- [x] No dependencies, unchecked assertions or growing resources
- [ ] GitHub head verify passes (see request message)

## Where to look

- `windows/audio.ts`, `output/startAudio.ts` and their tests.
- `src/main/index.ts` and its wiring test.
- `audio.next` optional version and the slice's stale-notification guard.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex): Request changes; the findings and replies are above.
- Round 2 (fea9018e): reviewer (Codex) Approve; second review (Gemini 4 Argon,
  gem1) Approve, no findings, asked to look at anything that could stop or slow
  the outputs, window and listener lifetimes, crash recovery, startup and
  shutdown order, sound during development, and focus. Lead Approve. Held out of
  m3-check2 on purpose (a new window on the output path the hour before a user
  check) and merged right after the tag and the 0.16.0 bump; rebased by the lead
  onto local `main` without conflicts; typecheck passes.

## Team member's reply

Round 1 reply:

1. The audio window now uses `RendererRecovery`, matching spec 08's persistent
   recovery and capped cool-down. `did-finish-load` marks a ready audio page;
   both crash and ready listeners, pending loads and all timers are released on
   disposal. Regression tests cross the crash limit, verify the complete backoff
   sequence including the repeated 60-second cap, cancel a pending attempt on
   shutdown, and reset to quick recovery after a healthy minute.
