# Review request: `tools-6`

- Team member: tools
- Branch: `feat/tools/quick-drag`
- Base: local `main` at `c7912cfa`, rebased for round 2.
- Brief: `docs/briefs/tools.md`, M3-T4b. Final head and CI are in the report.

## What changed and why

퀵 실행 추가 now offers saved 소품, 타이머 and 매크로 targets in submenus. The
menu reads and follows those documents only while open. Empty groups are
disabled. Selecting a target adds its stable ID without outputting it.

Dragging a quick row shows the shared insertion line and saves its new order.
Movement must exceed 4 px, so an ordinary click still runs the item. Drops are
limited to the visible list area; the insertion line hides outside it. The
ending pointer click is suppressed, including when move, release and click
arrive before React commits a frame. Keyboard activation remains available.
Escape, pointer cancellation, window blur, revision changes, locking and unmount
release tracking. Show's existing policy of preserving keyboard focus stays in
effect.

Moves use stable source and destination IDs against the latest settings read,
retain unknown items and unrelated additions, and share the existing close gate
and bounded stale retry. A missing source or destination, or an unchanged order,
does not write. Reordering never outputs or clears content.

## Changed files and changes outside my paths

Owned code only: `show/quick/` menu, row wrapper, panel, settings writer,
`useQuickDrag` and tests. This review document is the only other path. No shared
contract, dependency, storage format or output renderer changes.

## Checks and quality

- Typecheck passed after rebase and implementation.
- Four related test files passed, 57 tests, including submenu selection, actual
  panel reorder, unknown-item preservation, no-op moves, drag lifecycle and
  batched-event regressions. Existing close-gate regressions still pass.
- Changed-file ESLint, repository format check and exact-head GitHub verify
  results are in the report. No full local verify or app launch.
- No new TSDoc comments. Every new `/**` was checked before the request.
- Native listeners release on termination and unmount. No operation queue or new
  cache; the existing 500-row cap remains in force. Settings reads and writes
  use the existing validated IPC boundary.

## Decisions and where to look

Pointer tracking preserves the Show keyboard focus policy without marking the
whole quick list as click-focus or using browser-native drag. Review
`useQuickDrag.ts` for cancellation and ending-click suppression, and
`quickEdits.ts` for ID-based application to the newest snapshot.

This unit covers target submenus and internal reordering. Service-row copy into
quick, black execution and the remaining Bible display options are still
pending. The lead's next priority is T1a, then the retained 타이머 tab. Audio
waits for O7 and confirmation from the lead before starting.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex, codex2): Request changes; the findings and replies are above.
- Round 2 (2421b11a): reviewer (Codex, codex2) Approve. Lead Approve. Rebased by
  the lead onto local `main` after output-44 without conflicts; typecheck
  passes. 퀵 실행 target submenus and drag reorder are in.

## Team member's reply

1. Addressed the round-1 P2 finding. Both movement and release now check the
   list bounds and hit-test the visible element at the pointer, excluding
   clipped rows and other panels. Outside movement hides the insertion line;
   outside release preserves order and suppresses the ending click. Six new
   regression cases failed before the fix and pass after it: all four edges,
   release outside without a final move, and a clipped list with re-entry. Final
   checks and exact-head CI are in the report.
