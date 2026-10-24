# Review request: `shell-9`

Review range: c4bbd3a...feat/shell/undo-and-columns

What to check: (1) the 되돌림 button against `LiveState.canUndo` (dimmed and
silent when nothing can be undone, bright and sending `clear.undo` otherwise)
and the key path through `undoClear`; (2) the saving of the thumbnail columns:
`setThumbnailColumns` sends only `{sizeClass, columns}`, sends nothing for a
number already in effect, clamps and rounds to the shared limits, and
`seedThumbnailColumns` reads the saved numbers without sending anything; (3) the
startup order in `control/main.tsx` (read the UI state once, seed the columns,
then build the width store) and the split of the loader; (4) the comment-only
fix of a document nit in `docs/reviews/shell-3.md`.

- Team member: `shell`
- Branch: `feat/shell/undo-and-columns`
- Base commit (`main`): `c4bbd3a`
- Last commit: see the commit that adds this file
- Related brief: the lead's queue (canUndo and the saved thumbnail columns)

## What changed and why

1. **되돌림 follows `LiveState.canUndo`** (output-7 sets it in the reducer). The
   button is dim (`aria-disabled`, `data-state="off"`, still focusable) while
   there is nothing to undo, and a click or Ctrl Z then sends nothing. The
   `TODO(0913vision)` in `state/clear.ts` is gone. Before the first live state
   arrives the button is dim.
2. **The thumbnail columns are saved.** The 썸네일 크기 slider now sends
   `{sizeClass, columns}` through `ui:layout:set` (data-6 allows a columns-only
   change, and `UiStateStore` of shell-3 merges it field by field into
   `layout.<size class>`). At startup the saved columns of each size class come
   from the UI state. `MIN` and `MAX` columns now come from
   `COLUMN_LIMITS.columns`.
3. **Loader split.** `loadUiState(api)` reads the state once (empty outside
   Electron or when the main process cannot answer, with the failure logged),
   `createColumnWidthStore(api, uiState)` builds the width store from it, and
   `loadColumnWidthStore` stays as the two together.
4. The document nit of shell-3 (a decision that still said `columns` was
   missing) is fixed in `docs/reviews/shell-3.md`.

## Changed files

- `src/renderer/src/state/clear.ts`, `clear.test.ts`; `show/ClearRow.tsx`,
  `ClearRow.module.css`, `ClearRow.test.tsx`
- `src/renderer/src/state/show.ts`, `thumbnailColumns.test.ts`
- `src/renderer/src/shell/loadColumnWidthStore.ts`, `columnWidthStore.test.ts`
- `src/renderer/src/control/main.tsx`
- `docs/reviews/shell-3.md`

## Checks run

`npm run verify` on commit `614f533` (base `main` 568bbe4) passed all five steps
in 272.9 s: `typecheck`, `lint`, `format:check`, `test:coverage`, and `build`.
The rebase onto `main` c4bbd3a afterwards brought other members' changes only.

### Running app (port 5187)

With a temporary local wiring of `registerUiState` in `src/main/index.ts`
(reverted; output wires it in output-8): clicking the right end of the slider
changed the grid from 4 to 2 columns, closing the window wrote
`{"layout": {"normal": {"columns": 2}}}` to `app.json` without touching the
widths, and the next start showed 2 columns.

Not checked in the app: the 되돌림 button with a real undo (it follows the live
state; the unit tests cover both states).

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Checks run")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (the saved
      columns are clamped to the shared limits; the schema is data's)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (nothing new is registered)
- [x] Caches and lists have size caps (three size classes)
- [x] An exception in the output path doesn't stop the output (not touched)
- [x] Only what's needed re-renders (one boolean selector per button)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- The slider sends one message per step (at most seven values), and the main
  process debounces the file write.
- A number that is already in effect sends nothing, even when it is the default,
  so the file only holds numbers the operator chose.

## Shared contract change requests

- None.

## Where to look

- `state/show.ts`: `setThumbnailColumns` and `seedThumbnailColumns`.
- `control/main.tsx`: the order of the startup.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1.
