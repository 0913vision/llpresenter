# Review request: `shell-1`

- Team member: `shell`
- Branch: `feat/shell/column-resize`
- Base commit (`main`): `eba31da`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/shell.md`

## What changed and why

The three columns of the app shell now follow the design system `Layout`
document: the gaps between columns can be dragged, widths stay inside their
ranges, each size class keeps its own widths, and a narrow window shrinks the
columns on screen without touching the saved widths.

1. `refactor(shell)`: the size classes are now `narrow`, `normal`, and `wide`,
   like the design system and the `layout.*` keys in `docs/spec/02-data.md`.
2. `feat(shell)`: `columns.ts` holds the pure rules. Left 200 to 400, right 320
   to 720, center at least 560, and four fixed 4px gaps across the row.
   `fitToWindow` clamps the saved widths and shrinks the right column first,
   then the left one. `dragColumn` clamps a drag to the range and to the room
   that the center needs.
3. `feat(shell)`: `ColumnLayout` is a class with no DOM. It owns the saved
   widths of the current size class, the widths on screen, and the drag. It
   saves only the dragged column when the drag ends, so a column that is shrunk
   on screen does not overwrite its saved width. `ColumnWidthStore` (`load` and
   `save`) is the persistence interface, with an in-memory implementation for
   now.
4. `feat(shell)`: `ColumnGap` is the 4px gap with the `col-resize` cursor. It
   uses pointer events and pointer capture, so there is no window-level listener
   to release. `useColumnLayout` writes the widths to the grid as the CSS
   variables `--ll-col-left` and `--ll-col-right`, so a drag does not re-render
   the panels. The only listener it registers is a `resize` listener, which it
   removes on unmount, and it coalesces calls with `requestAnimationFrame`.

The gaps have no focus stop, as the brief says.

## Changed files

- `src/renderer/src/shell/`: `sizeClass.ts`, `columns.ts`, `ColumnLayout.ts`,
  `columnWidthStore.ts`, `ColumnGap.tsx`, `ColumnGap.module.css`,
  `useColumnLayout.ts`, `Workspace.tsx`, `Workspace.module.css`, `Toolbar.tsx`
  (one line for the rename), and the tests next to them
- `src/renderer/src/control/App.tsx` (creates the store and passes it down)

## Checks run

Round 2: all on commit `fdea8a2` (rebased onto `main` eba31da; the review
document changes come after it). Round 1 ran on `6b79f52` with 76 tests.

| Command or test        | Result                             |
| ---------------------- | ---------------------------------- |
| `npm ci`               | Passed, 0 vulnerabilities          |
| `npm run typecheck`    | Passed                             |
| `npm test`             | Passed, 12 files, 87 tests         |
| `npm run format:check` | Passed                             |
| `npm run build`        | Passed                             |
| `npm run verify`       | Not available yet (no such script) |

New tests: `columns.test.ts` (19, every boundary), `ColumnLayout.test.ts` (11),
and `Workspace.test.tsx` (9: pointer drag of both gaps, capture, ignored moves
and buttons, lost capture, size class memory, workspace switch, shrink and
restore on resize, listener removal).

### Running app (port 5187, app data `D:\llp-dev\shell`)

I started `npm run dev` with remote debugging, set the viewport to each size,
and sent real mouse events through the Chrome DevTools Protocol. Window sizes
were set with the device metrics override, because the window must be at least
1280 wide anyway.

| Size      | Class  | Start (L, C, R) | Left far right | Left far left  | Right far left | Right far right |
| --------- | ------ | --------------- | -------------- | -------------- | -------------- | --------------- |
| 1280x720  | narrow | 220, 684, 360   | 344, 560, 360  | 200, 704, 360  | 200, 560, 504  | 200, 744, 320   |
| 1920x1080 | normal | 280, 1144, 480  | 400, 1024, 480 | 200, 1224, 480 | 200, 984, 720  | 200, 1384, 320  |
| 2560x1440 | wide   | 320, 1664, 560  | 400, 1584, 560 | 200, 1784, 560 | 200, 1624, 720 | 200, 2024, 320  |

- The center never went under 560, and each column stopped at its range.
- The cursor on the gap is `col-resize`.
- Going back to 1280, 1920, and 1280 again showed 200/320 each time, which are
  the last widths dragged in each class, so classes keep their own widths.
- Shrink rule at 1920 with 400 and 720: 1700 gave 400/564/720, 1600 gave
  400/560/624 (right shrinks first), and 1920 again restored 400/784/720.
- After the run no process of this worktree was left.

Not checked: dragging with a physical mouse, and a real display at 125% or 150%
scaling.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (the script does not exist yet, so the four
      individual checks above pass instead)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (none yet, the
      store is in memory)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the `resize` listener and the
      animation frame are released on unmount; pointer capture needs no
      listener)
- [x] Caches and lists have size caps (the store holds at most three entries)
- [x] An exception in the output path doesn't stop the output (not touched)
- [x] Only what's needed re-renders (a drag writes CSS variables and does not
      render React)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md` (TSDoc, and one `TODO(0913vision)`)
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- A drag saves only the dragged column. If the other column was shrunk on
  screen, its saved width stays as it was.
- A drag starts from the widths on screen, not the saved widths.
- The grid has five tracks (column, gap, center, gap, column), and the hit area
  of a gap is 8px wide (4px plus 2px on each side, `space-2`), drawn over the
  panels.
- Mouse buttons other than the primary one do not start a drag.
- `useColumnLayout` also watches `resize` itself (with `requestAnimationFrame`)
  in addition to `useSizeClass`, so that the shrink rule runs on every size
  change and not only at class boundaries.

## Shared contract change requests

- None for this change. The lead agreed on the IPC proposal (`ui:get` and
  `ui:layout:set`) in a message. The follow-up task replaces the in-memory store
  with `createIpcColumnWidthStore`.

## Where to look

- `columns.ts` and its test: the rules, especially `fitToWindow` and the
  `Math.max(min, ...)` guard in `dragColumn` for windows too small to fit.
- `ColumnLayout.ts`: `endDrag` saving only the dragged column.
- `useColumnLayout.ts`: the two layout effects and the listener cleanup.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: lead

Round 2 (25909a4):

- Verdict: Approve
- Findings: none. Round 1 findings 1 to 3 and both nits are addressed.

Round 1 (906d57e):

- Verdict: Request changes
- Findings:
  1. Agree with the reviewer's findings 1 to 3; each needs a regression test in
     `ColumnLayout.test.ts` or `Workspace.test.tsx`.
  2. Nit: `columns.ts` repeats the 4px panel gap as `PANEL_GAP`, which also
     lives in the `--panel-gap` token. Keep the constant, but add a
     `NOTE(0913vision)` that it must match the token, or derive the fixed gap
     width from the grid instead.
  3. Nit: the size class is set from two places (`watchWindowResize` calls
     `setSizeClass`, and the `sizeClass` prop effect calls it too). Keep one
     source: let the prop drive `setSizeClass` and let the resize handler only
     `refit`.
  4. The column logic itself matches the Layout rules (ranges, center 560,
     right-first shrink), and the drag avoids re-rendering the panels. Good
     work.

## Review: reviewer

- Verdict: Request changes (Codex)
- Findings:
  1. src/renderer/src/shell/ColumnLayout.ts:72 Clicking and releasing a gap
     without moving overwrites its saved width with the temporarily shrunk
     width. At 1600px, saved widths 400/720 display as 400/624; clicking the
     right gap permanently saves 624. Save only when the dragged width changes,
     and add a regression test.
  2. src/renderer/src/shell/ColumnLayout.ts:46 Resizing during a drag skips
     fitting, and endDrag() never refits afterward. Shrinking from 1920px to
     1600px with columns 400/720 leaves tracks requiring 1696px, clipping the
     right panel even after release. Handle resizing during a drag and test
     fitting through release.
  3. src/renderer/src/shell/ColumnGap.tsx:25 Pointer identity is not tracked,
     and another pointer can replace the shared controller's active drag. Two
     fingers on different gaps can make movement on one gap resize the other
     column, then end its drag prematurely. Enforce one active pointer across
     both gaps, ignore unrelated events, and add tests.
  4. docs/reviews/shell-1.md:1 Nit: Commit 906d57e uses docs(review), while the
     brief requires scope shell. Use docs(shell).

Lead's note on reviewer nit 4: `docs(review)` is the team's convention for
review documents (trial-1 used it), so keep it; no change needed.

## Team member's reply

Replies to the lead:

1. Finding 1: Done, see the replies to the reviewer below.
2. Finding 2: Done. `columns.ts` keeps `PANEL_GAP` with a `NOTE(0913vision)`
   that it must match the `--panel-gap` token.
3. Finding 3: Done. The resize handler in `useColumnLayout.ts` only calls
   `refit`. The `sizeClass` prop is the only source of `setSizeClass`.
4. Finding 4: Thank you.

Replies to the reviewer:

1. Finding 1: Fixed. `endDrag` saves the dragged column only when its width
   differs from the width at the start of the drag. Tests: "does not overwrite a
   saved width when a gap is pressed without moving" and "does not save a drag
   that returns to the starting width" in `ColumnLayout.test.ts`, and "keeps a
   shrunk width unsaved when a gap is clicked without moving" in
   `Workspace.test.tsx`.
2. Finding 2: Fixed. `endDrag` calls `refit` after the drag, so a window that
   shrank during the drag is fitted at release. Tests: "fits the widths to a
   window that resized during the drag when it ends" and "fits the columns when
   the window shrinks during a drag".
3. Finding 3: Fixed. `beginDrag` now returns a `DragSession`, or nothing while
   another drag is active, so only one drag can exist across both gaps. A
   session that has ended or was dropped by a size class change does nothing.
   `ColumnGap` remembers the pointer id of its own drag and ignores move, up,
   cancel, and lost-capture events of other pointers, and it ignores a second
   press on the gap that is being dragged. Tests: "does not start a second drag
   while one is in progress", "ignores moves and releases of a drag that has
   ended", "lets a stale session end without touching a newer drag" (controller)
   and "lets only one pointer drag across both gaps", "ignores a second pointer
   on the gap that is being dragged", "can drag the other gap after the first
   drag ends" (component).
4. Finding 4: Keeping `docs(review)`, as the lead said.
5. Rebase: onto `main` eba31da, no conflicts. Checks on commit fdea8a2:
   `npm ci`, `npm run typecheck`, `npm test` (12 files, 87 tests),
   `npm run format:check`, and `npm run build` all passed. I ran the three-size
   drag check and the shrink check in the running app again, with the same
   results as in "Running app".
