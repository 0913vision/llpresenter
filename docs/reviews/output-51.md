# Review request: `output-51`

- Team member: `output`
- Branch: `feat/output/audio-manual-fade`
- Base, head, review range and GitHub CI: in the request message.
- Scope: M3-O7 manual three-second fade from spec 04. Prepared on output-49;
  send only after that request merges and this branch is rebased.

## What changed and why

The manual fade command now lowers the shared audio gain over three seconds,
then stops without moving to the next playlist entry. Both the active fallback
and a loading replacement follow the envelope. Reload joins its remaining
duration; an expired fade completes without starting a decoder.

Completion carries the track identity and fade start, and main ignores stale
completion. Play cancels a fade with a fresh track identity. F5 starts its short
clear fade from the current gain without raising the level; undo restores the
position and remaining manual fade duration. New playback and disposal cancel
the old timers. Repeated gain values do not trigger extra volume updates.

## Changes outside my paths

- `src/shared/schema/audioState.ts`: optional validated `fadeOutSince` and the
  named duration constant. Existing playback remains valid.
- `src/shared/schema/liveActions.ts` and `src/shared/commands.ts`: additive
  `audio.fadeOut.complete` command with bounded track and time fields.
- Shared schema tests cover malformed fade starts; transport tests cover valid
  completion, invalid fields and mismatched identities.
- `docs/qa/audio-native-check.md`: later user check sheet, still unrun.

## Checks run

- Audio transport, clear/undo, player, bridge and schema tests, typecheck,
  own-file ESLint and formatting: see request message.
- Full `npm run verify`: GitHub CI only, URL/result in the request message.
- All local media methods are mocked and players remain muted by default. No
  native audio or Electron windows were started.

## Quality checklist

- [x] Shared additions validate external values with existing bounded schemas
- [x] Natural end during fade stops instead of advancing the playlist
- [x] No new decoder, growing collection or dependency
- [x] Every fade timer releases on replacement, cancellation and disposal
- [x] Errors use the existing bounded log path
- [ ] Head checks pass (see request message)

## Review: lead

- Verdict: pending

## Review: reviewer

- Verdict: pending

## Team member's reply

1.
