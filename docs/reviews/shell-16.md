# Review request: `shell-16`

Review range: ce2e26d...refactor/shell/ui-parts

What to check: that the 장 grid and the 예배 순서 list are the ui
`ThumbnailGrid` (`show`) and `ListBox` (`show`) with the same behavior for the
operator; that the 진행 key handler uses the shared ui constants and the Space
rule of the ui-4 "Shell handoff"; that the focus is still kept in the grid when
another item replaces the focused tile; and that the dead move helpers are gone.

Round 2, what to check: the reply to the round 1 findings below; that the
restored render-count tests and the Tab stop test follow ui-10, and fail on the
code before it.

Round 3, what to check: the reply to the round 2 findings below: a list key that
stays on the open item keeps its tile selection, and the list has its body
padding again.

- Team member: `shell`
- Branch: `refactor/shell/ui-parts`
- Base commit (`main`): `ce2e26d` (ui-10 is in it: `ListBox` redraws only
  changed rows and gives the Tab stop to a row)
- Last commit: see the commit that adds this file
- Related brief: "Shell handoff" in `docs/reviews/ui-4.md`

## What changed and why

- `SlideGrid` renders `ThumbnailGrid workspace="show"` with `SlideThumbnail`
  items. The arrow keys, Enter, the Tab stop, and focus following the selection
  now come from the ui part. `useKeptFocus` stays, because the ui part only
  moves the focus while it is still inside the grid, and a replaced tile drops
  it to the body (shell-13, finding 2).
- `ServiceOrderList` renders `ListBox workspace="show"` with `ListGroup` and
  `ListRow` (type icon, LIVE badge, and the warning of a row problem, which is
  now the ui `WarningMark` with its tooltip). Consecutive rows after a header
  form one group.
- `shortcuts.ts`: `CLICK_FOCUS_SELECTOR` replaces the own list of click focus
  parts, and `[role="listbox"]` replaces the two marks (`data-slide-grid`,
  `data-service-list`) for the parts that pass Space on. A list that takes Space
  has already cancelled the key.
- `clearKeys.ts` uses `SHORTCUT_RECORDING_SELECTOR`.
- Removed because the ui parts do it: `moveRow`, `moveTile`, `moveRowSelection`,
  `moveTileSelection`, their key types, and `selectableRows`, with their tests.
  `selectTile` replaces `moveTile` for the grid's `onSelect`.

## Changed files

- `src/renderer/src/show/SlideGrid.tsx`, `SlideGrid.module.css`
- `src/renderer/src/show/ServiceOrderList.tsx`, `ServiceOrderList.module.css`
- `src/renderer/src/show/shortcuts.ts`, `clearKeys.ts` and their tests
- `src/renderer/src/show/navigation.ts`, `navigation.test.ts`
- `src/renderer/src/state/show.ts`, `show.test.ts`
- `src/renderer/src/show/ShowPanels.test.tsx`, `SlidePanel.test.tsx`,
  `PreviewPanel.test.tsx`
- Round 2: `src/renderer/src/state/preview.ts` (the `previewBig` TODO names
  M3-D2, as the lead decided) and `docs/reviews/shell-19.md` (the missing
  "Verify result", codex3's nit)
- Round 3: `src/renderer/src/state/show.ts` (`openItem`),
  `ServiceOrderList.module.css`, `ServiceOrderList.layout.test.ts` (new),
  `src/renderer/src/shell/testing/cssRules.ts` (new, the CSS rule reader that
  `Toolbar.layout.test.ts` and `PreviewPanel.layout.test.ts` each had a copy
  of), and the tests named in the reply

## Checks run

See "Verify result" at the end of this file.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Verify result")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests (the existing tests
      moved to the ui parts' roles; click focus for a marked list and for an
      unmarked one is tested)
- [x] Values from outside the process are validated with a schema (not touched)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (`useKeptFocus` removes its
      `pointerdown` listener on unmount)
- [x] Caches and lists have size caps (not applicable)
- [x] An exception in the output path doesn't stop the output (not touched)
- [x] Only what's needed re-renders (render-count tests for a new open item and
      a moved live mark)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- A list without the click focus mark (the media strip, the 매크로 lists) keeps
  the focus where it was on a click, which is tested.
- Round 3: the guard is in `openItem`, so every way of opening the open item
  again keeps its tile selection: a list key at either end, Enter on the open
  row, and a click on it. Before shell-16 a click on the open row went back to
  its first tile; now it keeps the selected one.

## Shared contract change requests

- None.

## Where to look

- `SlideGrid.tsx`: the focus effect on `openItemId`, `selectedTile`, and the
  tile count.
- `ServiceOrderList.tsx`: `groupRows`.
- `shortcuts.ts`: the two selectors that changed.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (codex2): Request changes with three findings: grid focus was lost
  when a service update removed the focused tile, Shift Tab was trapped in a
  list with nothing selected, and every row redrew on a selection change. The
  last two were fixed in ui's ListBox (ui-10).
- Round 2 (codex2): Request changes with one finding and a nit: navigation at a
  list end reopened the current item and reset its tile selection, and the list
  lost its body padding.
- Round 3 (5df29c6): reviewer (Codex, codex2) Approve with no findings. Lead
  Approve; the 장 grid and the 예배 순서 list are built from ui's parts, only
  changed rows redraw (render-count tests restored), and a key or a click on the
  item that is already open keeps its tile selection (lead decision). Rebased by
  the lead onto local `main` without conflicts.

## Team member's reply

Round 1 (codex2, request changes), answered once:

1. The grid lost the focus when a service update removed the focused tile of the
   open item, because the focus effect ran only when the open item changed.
   `SlideGrid` now also runs it when `selectedTile` or the tile count changes,
   and still only while the focus is in the grid. Test: "keeps the focus in the
   grid when a service update removes the focused tile of the same item".
2. A new open item redrew every row of the 예배 순서 list. ui fixed `ListBox` in
   ui-10, and the rows here pass `live` and the other values as props, so the
   memoized `ListRow` skips unchanged rows. The render-count test is back
   ("redraws only the rows whose open state changed"), and a second one covers a
   moved live mark. Both fail with the `ListRow.tsx` from before ui-10.
3. Shift Tab was trapped in the list before anything was selected. Fixed in
   ui-10: the list itself takes no Tab stop. The test "keeps one tab stop: the
   first row until an item is open, then its row" now expects the first row to
   hold the stop and the list to have no `tabindex`; it fails before ui-10.

Round 2 (codex2, request changes), answered once:

1. `openItem` now returns early when the item is already open, so `ListBox`
   calling `onSelect` on an unchanged row no longer resets `selectedTile`. The
   old `moveRow` had the same guard. Tests: "keeps the tile selection when the
   open item is opened again" (`show.test.ts`) and "keeps the tile selection
   when a key stays on the last row" and "... on the first row"
   (`ShowPanels.test.tsx`, a service of two songs, the third tile selected,
   ArrowDown and End on the last row, ArrowUp and Home on the first).
2. Nit: `ServiceOrderList.module.css` gives the wrapper `.list` the Panel list
   body padding again (`space-4` top, `space-8` bottom, 0 at the sides; Panel
   README, `ll-panel__body--list`) instead of `display: contents`. The unused
   `.warning` rule is gone; the row warning is the ui `WarningMark`. The rule
   test is `ServiceOrderList.layout.test.ts`. Not measured in the real app.

## Verify result

### Round 3

`npm run verify` on commit `0e5591f` (base `main` ce2e26d): all five steps
passed in 91.9 s. With `state/show.ts` and `ServiceOrderList.module.css` from
before the fixes put back in the working tree only, the four new tests fail (the
`openItem` test, the two list end tests, and the padding rule test); the files
were restored with `git checkout` afterward.

### Round 2

`npm run verify` on commit `4aef1ae` (base `main` 60bbcec): all five steps
passed in 108.5 s (`typecheck`, `lint`, `format:check`, `test:coverage`, and
`build`). `ShowPanels.test.tsx` passes (28 tests). With `ListRow.tsx` from
`efd0a29` (before ui-10) put back in the working tree only, the two render-count
tests and the Tab stop test fail; the file was restored with `git checkout`
afterward.

### Round 1

`npm run verify` on commit `7ef1531` (base `main` 4b72a17, then rebased onto
efd0a29): `typecheck`, `lint`, `format:check`, and `build` passed.
`test:coverage` had one failure, the known one on `main` since devops-13 (devops
fixes it as devops-17): `scripts/soak/media.test.ts` > "ends the stalled maker
and every process it started". All other tests passed.
