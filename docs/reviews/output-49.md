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
cancels the old deadline. Timer callbacks isolate errors; a failed gain update
or clock read still stops the cleared audio and releases resources.

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

## Review: lead

- Verdict: pending

## Review: reviewer

- Verdict: pending

## Team member's reply

1.
