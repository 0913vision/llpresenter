# Review request: `tools-3`

- Team member: tools
- Branch: `feat/tools/bible-panel`
- Base: local `main` at `a0db9860`, including approved tools-2 round 2.
- Round-1 implementation after rebase: `5022b4bf`; the report gives the round-2
  head, review ranges, and its CI.
- Brief: `docs/briefs/tools.md`, M3-T4b.

## What changed and why

Valid reference input now replaces the center slide panel with a Bible panel:
passage title, count, one verse per slide, size control, and 바로 띄우기. Enter
and the button output the same selected tile through `outputTile`. Grid clicks,
next, previous, and reveal use the retained Bible source without a service row.
Preview sends no output; explicit service-row selection, including reselection,
restores the song panel and cancels a pending Bible lookup. Preview, observed
live output, and the last output request occupy at most three source slots, so
another preview cannot discard the passage needed for reveal or previous.

All Bible output paths share serialized recent-history writes: ten pending
passages, deduplicated pairs, fresh settings revisions, one stale-edit retry,
and unknown-field preservation. Failed writes log and allow later writes. Long
verses split at the live line limit without losing Unicode pairs.

## Changed files and changes outside my paths

Owned code is in `show/bible/` (panel, source, actions, history, tests) and
`show/quick/BibleQuickField.tsx` (settings and selection subscriptions). The
initial code and test diff was 750 additions and 15 removals; round 2 adds the
requested fixes and regressions. Outside owned paths:

- `src/renderer/src/shell/Workspace.tsx`: mount `BibleQuickField` in 퀵 실행 and
  replace the center panel with `BiblePanel` while a Bible source is open. The
  existing service-list selection callback also resets pending lookups when the
  selected row is selected again.
- `src/renderer/src/state/showStore.ts`: retain at most three Bible sources.
- `src/renderer/src/state/showLibrary.ts`: resolve the matching source's tiles.
- `src/renderer/src/state/show.ts`: preserve it during service refresh, navigate
  and reveal it, retain pending Bible output, and record history for the source
  actually output, including a retained live passage.
- `docs/reviews/tools-3.md`: this request. `SlidePanel.tsx` has no final diff.

## Checks run

| Check                              | Result                                 |
| ---------------------------------- | -------------------------------------- |
| Typecheck                          | Passed after rebase and implementation |
| Related Vitest tests               | Nine files, 145 passed                 |
| Changed-file ESLint                | Passed                                 |
| Format, format:check, diff --check | Passed                                 |
| Full verify                        | GitHub CI only; final head in report   |

Prior round-1 CI passed at `a4d8d6f8`:
[run 40266434915](https://github.com/0913vision/llpresenter/actions/runs/40266434915).
The report supplies round-2 head CI separately. No full local verify or app
launch. Package tools use repository scripts or `npx --no-install`.

Rebased onto local `main` at `a0db9860` with
`git rebase --onto main 886678db feat/tools/bible-panel`. Typecheck passed after
the rebase and after the fixes. All four new `/**` comments in the full review
range sit immediately on exported function declarations.

## Quality checklist

- [x] Main implementation passes GitHub verify; final-head run in report.
- [x] Tests cover both mounts at narrow, normal, and wide sizes, selected
      output, history races, stale responses, failure recovery, and cleanup.
- [x] Existing validated IPC, safe types, design tokens, and comment rules
      apply.
- [x] Subscriptions are released; three source slots and ten pending history
      passages cap retained data. Superseded previews and former live sources
      are evicted. No Bible database is committed.

## Decisions and next unit

Panel settings, adjacent verses, insertion, and per-screen view follow in
separate requests to keep this unit small. `SlideLayer` has lines and a label;
reference placement needs a later additive contract and output integration.
Already requested history writes finish after the field unmounts. No shared
contract changes in this unit.

## Where to look

Review service-refresh selection, Enter/button equivalence, history from grid
and navigation, stale writes, and the two actual Workspace mounts.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex, codex5): Request changes: reselecting the open row didn't
  cancel a pending lookup, and previewing a passage dropped the live passage's
  source.
- Round 2 (e2ca81cb): reviewer (Codex, codex5) Approve, no findings. Lead
  Approve after reading the output actions: Bible passages go out through the
  standard slide command path, and the kept sources are bounded to the live and
  the previewed passage. Written by the Codex tools member. Rebased by the lead
  onto local `main` without conflicts; typecheck passes.

## Team member's reply

1. Addressed both round-1 findings. For P2-1, Workspace now forwards every
   explicit service-row selection through the existing selection callback,
   including reselection, to reset the Bible reference field. A deferred-lookup
   integration test starts with a song already open, reselects that row,
   resolves the old lookup, and verifies that the song panel stays open, the
   field is cleared, and no output is sent. For P2-2, preview, observed live
   output, and the last requested output retain separate bounded sources. Tile
   resolution, panel rendering, reveal, previous, and recent history use the
   matching passage. Regression tests output A, preview B and C, then reveal A
   and output its previous verse, with both early and late main feedback. They
   also verify superseded-source eviction and A-live/B-requested/C-preview
   ordering before B's feedback arrives.
