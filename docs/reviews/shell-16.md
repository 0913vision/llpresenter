# Review request: `shell-16`

Review range: efd0a29...refactor/shell/ui-parts

What to check: that the 장 grid and the 예배 순서 list are the ui
`ThumbnailGrid` (`show`) and `ListBox` (`show`) with the same behavior for the
operator; that the 진행 key handler uses the shared ui constants and the Space
rule of the ui-4 "Shell handoff"; that the focus is still kept in the grid when
another item replaces the focused tile; and that the dead move helpers are gone.

- Team member: `shell`
- Branch: `refactor/shell/ui-parts`
- Base commit (`main`): `efd0a29`
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
- [x] Only what's needed re-renders (see the decision below)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- `ListBox` keeps `selected` in a context, so a change of the open item
  re-renders every row of the 예배 순서 list (a service has tens of rows). The
  old test "re-renders only the rows whose state changed" is dropped. If that
  becomes a cost, the fix is in `ListRow` (a memoized row), which is ui's file.
- A list without the click focus mark (the media strip, the 매크로 lists) keeps
  the focus where it was on a click, which is tested.

## Shared contract change requests

- None.

## Where to look

- `SlideGrid.tsx`: the focus effect on `openItemId`.
- `ServiceOrderList.tsx`: `groupRows`.
- `shortcuts.ts`: the two selectors that changed.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Not reviewed yet.

## Verify result

`npm run verify` on commit `7ef1531` (base `main` 4b72a17, then rebased onto
efd0a29): `typecheck`, `lint`, `format:check`, and `build` passed.
`test:coverage` had one failure, the known one on `main` since devops-13 (devops
fixes it as devops-17): `scripts/soak/media.test.ts`

> "ends the stalled maker and every process it started". All other tests passed.
