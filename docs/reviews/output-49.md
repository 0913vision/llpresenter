# Review request: `output-49`

- Team member: `output`
- Branch: `feat/output/audio-clear-fade`
- Base and range: in the request message; stacked on output-48.
- Scope: F5/F1 audio fade and clear undo. The manual three-second fade follows
  separately. O7's native fade check remains pending on the user sheet.
- GitHub head CI: URL/result in the request message.

## What changed and why

Clearing audio fades the active track over 400 ms and unloads its decoder at the
deadline, leaving time for command delivery within the half-second limit.
Pending replacements stop immediately. A repeated empty state keeps the existing
envelope, volume changes scale its current gain, and new playback or disposal
cancels the old deadline. New playback unloads the cleared track before
restoring gain, so a failed or stalled replacement cannot retain it as a
fallback. Timer callbacks isolate errors; a failed gain update or clock read
still stops the cleared audio and releases resources.

Clear history records the audio clear on main's monotonic clock. Undo restores
the position at the clear, resumes running audio and keeps paused audio paused.
Wall-clock corrections while cleared do not move that position. A grouped clear
retains the audio stamp even when another layer clears first. Unrelated clears
leave the audio anchor alone. Undo allocates a fresh track identity from
output-48's retained counter, rejecting stale ended notifications.

The native sound check is deferred. Unit tests mock media methods and never
produce sound; measured audible timing and device buffering need the later user
run.

## Changes outside my paths

- `docs/qa/audio-native-check.md`: the later native fade/undo sheet requested by
  the lead. Every native result is explicitly pending.

## Checks run

- Targeted live, macro, player, fade and audio bridge tests, typecheck, own
  ESLint and formatting: see request message.
- Full `npm run verify`: GitHub CI only, see request message.
- New regressions cover the deadline, cancellation, failures, volume during
  fade, mono-clock undo, grouped clears and fresh undo identity.

## Quality checklist

- [x] Fixed fade timers cancel on new playback and disposal
- [x] Audio exceptions remain isolated and logged
- [x] Undo preserves position, pause and volume and uses a fresh identity
- [x] No dependencies or new IPC contracts
- [ ] GitHub head verify passes (see request message)
- [ ] Later native audio check passes (intentionally pending)

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex): Request changes; the findings and replies are above.
- Round 2 (fa68d213): reviewer (Codex) Approve. Lead Approve; clearing audio
  fades the active track over 400 ms and unloads it at the deadline, inside the
  half-second limit of IC-D2, and new playback or disposal cancels the old
  deadline. CI result as reported by the member (the anonymous GitHub API limit
  was reached at merge time). Rebased by the lead onto local `main` without
  conflicts; typecheck passes.

## Team member's reply

1. Addressed the round 1 finding. Cancelling a clear fade now removes the
   cleared track from active playback and unloads it before restoring gain or
   loading the replacement. The regressions track actual mocked play/pause state
   for a stalled load, load error and rejected play; all three failed before the
   fix. The existing successful-replacement check also verifies that the
   cancelled deadline cannot stop the new playback. Head checks and CI are in
   the round 2 request message. No native audio was played.
