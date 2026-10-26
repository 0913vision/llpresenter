# Review request: `tools-12`

- Team member: tools
- Branch: `feat/tools/row-clear`, from local main after tools-11 merged.
- Base, final head, checks and CI status: in the report.
- Brief: `docs/briefs/tools.md`, M3-T1a row-clear contract for 표시 중.

## What changed and why

The existing clear command takes down a whole layer. `overlay.clear` adds one
message ID, one prop ID or the stage message as a target, so the upcoming 표시
중 rows can remove just their item. IDs use the existing UUID schemas; malformed
targets fail validation. It works as a single command or batch child and does
not interrupt pending song navigation. Missing targets are no-ops.

The clear uses the existing single undo entry. Message undo pauses only the
removed message's lifetime; messages left up keep their deadlines and can expire
while the item is down. Stale expiry callbacks remain harmless after
restoration. Props restore captured payloads. Stage text restores unless new
stage text has replaced it. Other outputs, layers and timer state are preserved.
Later clears replace the entry, and undo consumes it once. Whole-layer clears
keep their existing behavior. The tab UI follows in a separate request.

## Changes outside my paths

- `src/shared/schema/overlayClear*`, `liveCommand.ts`, `commands.ts`: additive
  command, validation tests and navigation classification. No file format
  change.
- `src/main/live/clearOverlay*`, `history.ts`, `propState.ts`, clear/prop/stage
  slices: apply the target and integrate the existing undo and expiry lifecycle.
  The prop snapshot helper is shared with the existing prop slice.
- `docs/spec/03-output.md`, `04-show.md`: row clearing and lifetime semantics.
- This review document.

## Checks and quality

Tests cover valid/invalid targets, batch admission, per-ID removal, captured
payloads, deadlines, actual expiry timers, stale callbacks, no-ops, stage
replacement, mixed clears and the existing 200-message cap. Existing clear,
overlay, stage, batch and audio-clear tests cover affected shared paths. No new
timer, listener, queue, cache or history depth. The existing active item caps
and one undo snapshot bound memory. All added `/**` comments are checked before
the request. Fast checks and CI status are in the report; no full local verify
or app launch.
