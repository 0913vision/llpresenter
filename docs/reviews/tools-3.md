# Review request: `tools-3`

- Team member: tools
- Branch: `feat/tools/bible-panel`
- Base: `feat/tools/bible-field` at `886678db` (tools-2 round 2)
- Main implementation: `f6f01b9c`; the report gives the final head and its CI.
- Brief: `docs/briefs/tools.md`, M3-T4b. Merge order: tools-2, then tools-3.

## What changed and why

Valid reference input now replaces the center slide panel with a Bible panel:
passage title, count, one verse per slide, size control, and 바로 띄우기. Enter
and the button output the same selected tile through `outputTile`. Grid clicks,
next, previous, and reveal use the retained Bible source without a service row.
Preview sends no output; service-row selection restores the song panel and
cancels a pending Bible lookup without clearing live output.

All Bible output paths share serialized recent-history writes: ten pending
passages, deduplicated pairs, fresh settings revisions, one stale-edit retry,
and unknown-field preservation. Failed writes log and allow later writes. Long
verses split at the live line limit without losing Unicode pairs.

## Changed files and changes outside my paths

Owned code is in `show/bible/` (panel, source, actions, history, tests) and
`show/quick/BibleQuickField.tsx` (settings and selection subscriptions). The
code and test diff is 750 additions and 15 removals. Outside owned paths:

- `src/renderer/src/shell/Workspace.tsx`: mount `BibleQuickField` in 퀵 실행 and
  replace the center panel with `BiblePanel` while a Bible source is open.
- `src/renderer/src/state/showStore.ts`: retain one Bible projection.
- `src/renderer/src/state/showLibrary.ts`: resolve its tiles.
- `src/renderer/src/state/show.ts`: preserve it during service refresh, navigate
  and reveal it, and record history on Bible output.
- `docs/reviews/tools-3.md`: this request. `SlidePanel.tsx` has no final diff.

## Checks run

| Check                              | Result                                                           |
| ---------------------------------- | ---------------------------------------------------------------- |
| Typecheck                          | Passed after rebase and implementation                           |
| Related Vitest tests               | Seven files, 114 passed; six panel tests passed after layout fix |
| Changed-file ESLint                | Passed                                                           |
| Format, format:check, diff --check | Passed                                                           |
| Full verify                        | Passed at 37e67bdb; final head in report                         |

Prior implementation CI passed at `37e67bdb`:
[run 40263522806](https://github.com/0913vision/llpresenter/actions/runs/40263522806).
The report supplies restacked-head CI separately. No full local verify or app
launch.

Restacked onto the tools-2 translation and normalized-identity fix at
`886678db`. Typecheck and seven Bible/shared/main test files (58 tests) passed
after the rebase. Package tools used repository scripts or `npx --no-install`.

## Quality checklist

- [x] Main implementation passes GitHub verify; final-head run in report.
- [x] Tests cover both mounts at narrow, normal, and wide sizes, selected
      output, history races, stale responses, failure recovery, and cleanup.
- [x] Existing validated IPC, safe types, design tokens, and comment rules
      apply.
- [x] Subscriptions are released; one projection and ten pending passages cap
      retained data. No Bible database is committed.

## Decisions and next unit

Panel settings, adjacent verses, insertion, and per-screen view follow in
separate requests to keep this unit small. `SlideLayer` has lines and a label;
reference placement needs a later additive contract and output integration.
Already requested history writes finish after the field unmounts. No shared
contract changes in this unit.

## Where to look

Review service-refresh selection, Enter/button equivalence, history from grid
and navigation, stale writes, and the two actual Workspace mounts.

## Review: lead

- Verdict:
- Findings:

## Review: reviewer

- Verdict:
- Findings:

## Team member's reply

None yet.
