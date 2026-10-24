# Review request: `shell-1`

- Team member: `shell`
- Branch: `feat/shell/column-resize`
- Base commit (`main`): `5b09a98`
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

All on commit `6b79f52` (rebased onto `main` 5b09a98; the review document is
added after it).

| Command or test        | Result                             |
| ---------------------- | ---------------------------------- |
| `npm ci`               | Passed, 0 vulnerabilities          |
| `npm run typecheck`    | Passed                             |
| `npm test`             | Passed, 12 files, 76 tests         |
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

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1.
