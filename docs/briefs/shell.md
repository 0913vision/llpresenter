# Brief: shell

- Session name: shell (the session that ran trial continues as shell)
- Branch: `feat/shell/column-resize` (own worktree)
- Dev server port: 5187; app data folder: `D:\llp-dev\shell`
- Phase: phase 1, in parallel with devops, ui, and data

## Goal

Make the app shell's three-column layout behave exactly as the design system
`Layout` component specifies: draggable column gaps, widths clamped to their
ranges, widths remembered per size class, and the shrink rule for small windows.
The shell runs for whole services, so dragging must stay smooth and must never
leave the layout in a broken state.

## Tasks

1. In your worktree, start the new branch from the latest `rewrite`:
   `git switch -c feat/shell/column-resize rewrite`. Rewrite `.llp/notes.md` for
   this task.
2. **Align the size class names with the design system** (`refactor(shell)`):
   the code uses `compact` / `regular` / `wide`, while the design system and the
   saved settings keys (`layout.narrow`, `layout.normal`, `layout.wide` in
   `docs/spec/02-data.md`) use `narrow` / `normal` / `wide`. Rename them in
   `src/renderer/src/shell/` and its tests. Commit this on its own.
3. **Column logic as pure functions** with unit tests, in
   `src/renderer/src/shell/columns.ts`: the limits (left 200 to 400, right 320
   to 720, center at least 560), clamping a drag, and the on-screen shrink rule
   when the window gets narrower (shrink the right column first, then the left,
   down to their minimums, without changing the saved widths). Cover every
   boundary.
4. **Dragging:** make the 4px gaps between columns draggable with the
   `col-resize` cursor, using pointer events with pointer capture. Release every
   listener when the drag ends or the component unmounts. Update the widths
   during the drag without re-rendering the panels' contents (CSS variables on
   the grid are fine).
5. **Remembering widths:** keep the widths per size class, and switch to the
   saved widths of a class (or its defaults) when the window crosses into it.
   Saving to `app.json` needs a main-process store that doesn't exist yet, so
   put persistence behind a small interface (`ColumnWidthStore` with `load` and
   `save`) and use an in-memory implementation for now. Propose the IPC contract
   for saving UI state to the lead with SendMessage; the lead adds shared
   contracts.
6. Keep the keyboard in mind: the gaps are not focusable in the design system,
   so don't add focus stops.

## Out of scope

- The toolbar, menu bar, and status bar contents, and the ui components (ui owns
  `src/renderer/src/ui/`). The lead switches the shell to the ui components
  later, or gives that to you as a next task.
- `src/shared/`, `package.json`, and configuration files. Ask the lead.

## Owned files (change only these)

- `src/renderer/src/shell/` and its tests
- `src/renderer/src/control/App.tsx` and `App.module.css`, only where the layout
  needs them
- `docs/reviews/shell-<number>.md`

## What to read

- `CLAUDE.md`, `docs/WORKFLOW.md`
- `design/system/project/components/Layout/README.md` (the source for every rule
  above), `design/system/project/README.md` (window sizes and layout)
- `docs/spec/02-data.md` (`app.json`, the `layout.*` keys)

## Allowed dependencies

- None.

## Done when

- Dragging works at 1280×720, 1920×1080, and 2560×1440, the center never goes
  under 560, the shrink rule holds when the window narrows, and each size class
  keeps its own widths.
- Unit tests cover the column logic and the drag hook, and they pass.
- The review request is merged into `rewrite` by fast-forward.

## How to verify

- `npm run typecheck`, `npm test`, `npm run format:check`, `npm run build`, and
  `npm run verify` once devops lands it.
- Run the app with your port and app data folder and drag the gaps at the three
  window sizes. Describe what you checked in the review request.

## Commits

- One line, `tag(scope): <sentence>`, scope `shell`. Run `npm run format` first.

## When you finish

Rebase onto the latest `rewrite`, run the checks, write
`docs/reviews/shell-1.md`, commit it, and send the lead:

```text
Review request: docs/reviews/shell-1.md, branch feat/shell/column-resize, commit <hash>
```
