# Review request: `output-48`

- Team member: `output`
- Branch: `fix/output/audio-generation`
- Base and range: in the request message; rebased onto local `main` after
  output-47.
- Scope: audio track identity across transactions and clears. The prepared
  fade/undo work follows in output-49.
- GitHub head CI: URL/result in the request message.

## What changed and why

A batch compresses its final live-state version to one increment. Audio used
each intermediate state version as its track identity. Two plays in a batch
could therefore allocate track version 2 and leave state version 1; the next
play could allocate 2 again. The renderer would treat a different file as the
same track, and an old ended notification could advance it.

Track identities now use their own optional, bounded counter in live state. It
survives clears and the batch's state-version compression. Existing states
without the field start from their current track version. Pause and volume leave
the identity alone. No source, command or playback field changes meaning.

## Changes outside my paths

- `src/shared/live.ts` and `schema/liveState.ts`: additive optional
  `audioTrackVersion`, bounded to a nonnegative safe integer, with valid and
  invalid schema tests in `audioState.test.ts`.

## Checks run

- Audio/live/macro and shared state tests, typecheck, own ESLint and formatting:
  see request message.
- Full `npm run verify`: GitHub CI only, see request message.
- Regression: two batched plays, next, clear and fresh play all receive distinct
  increasing identities; the old ended notification is rejected.
- No native audio or windows were started here.

## Quality checklist

- [x] Transaction and clear identity regression coverage
- [x] Optional state preserves old inputs; counter is finite and capped
- [x] No new resource, dependency or growing collection
- [ ] GitHub head verify passes (see request message)

## Verdicts (recorded by the lead at merge)

- Round 1 (eac79289): reviewer (Codex) Approve. Lead Approve; audio track
  identities no longer follow live-state versions that a batch compresses, so
  two plays in one batch can't share an identity. Merged after m3-check3;
  rebased by the lead onto local `main` after ui-45 without conflicts; typecheck
  passes.

## Team member's reply

1.
