# Review request: `data-83`

- Team member: data
- Branch: `feat/data/group-slide-hotkeys`
- Stacked on data-76, `d14d1485`; exact range in report.
- Lead relay from spec: S26 physical per-slide hot keys, October 27.
- CI pending.

## What changed and why

Final stored field: `groups[].slides[].hotKey?: string`, validated as exactly
`KeyA`..`KeyZ` or `Digit0`..`Digit9`. Absence means unassigned. A linear scan
refuses duplicate assignments across all source slides in the song, including
inside one group. Repeating a group in an arrangement remains valid because it
repeats one assignment, not another source slide.

Shared ShowTile now accepts optional `hotKey` and
`sourceSlide: {songId, groupId, slideIndex}`. The IDs use the existing branded
song/group UUIDs; slideIndex is zero-based within the source group at that
projection's revision. A key-bearing tile requires sourceSlide. Legacy tiles
remain valid. Both service and library projection validators carry the metadata,
and the renderer's SlideTile aliases this shared type.

`findSlideHotKey(tiles, code)` in `src/shared/slideHotKeys.ts` returns
`{tileIndex, sourceSlide}` or null. It always picks the first projected
occurrence and has no current-cursor input or cycling state. Same-named groups
and the second/later slide in a group resolve correctly. An omitted source or
unassigned key returns null.

Version 1 `hotKey` was an unknown extension field. Migration archives it under
the slide's `legacyV1.hotKey`, preserving any previous archive, so it does not
invent assignments or reject valid old extension values. Version 2 validates and
persists the new field. Spec 02 records the storage/projection contract.

## Rollout and scope

This extends the staged data-76 API. It does not activate version 2 persistence,
switch active legacy projection producers, or bind keyboard events. The lead's
editor/grid/chip/live owners can use these fields when adopting the format. Main
must copy the source metadata and optional assignment onto each projected
occurrence; the key handler can resolve the validated tile array with the
helper.

## Changes outside my paths

Spec 02 records the lead-requested contract. `renderer/src/show/model.ts` is
shell-owned: its SlideTile alias exposes the shared metadata without duplicating
the contract. No renderer behavior or styles change. data-82's scrollbar nit
follows in the next branch, keeping this request a contract-only change.

## Checks

- Focused schema, migration and projection tests, typecheck, changed-file lint
  and format/diff: final results in report.
- Covers all 36 codes, invalid/null values, duplicates within/across groups,
  repeated occurrences, same-named groups, unknown legacy field preservation,
  service/library metadata, source validation and deterministic first lookup.
- Invented sentences and low-entropy fixture UUIDs only. No new listeners,
  timers, caches or expanded-song allocations.
- CI pending; no per-member CI polling.

## Checked in the app

This is a staged contract and pure lookup helper. No active producer emits the
new fields yet, and no keyboard handler or screen changes. No new screenshot
would demonstrate the contract in the current legacy UI. The assigned consumer
owners must exercise the visible binding/projection changes in the real app.

## Verdicts (recorded by the lead at merge)

- Round 1 (81623da6): reviewer (Codex) Approve. Lead Approve through the lead's
  merge check: the exact-head CI run passed, the branch rebased onto local
  `main` without conflicts, and typecheck passes. Earlier rounds' findings and
  replies are above.
