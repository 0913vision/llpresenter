# Review request: `shell-2`

- Team member: `shell`
- Branch: `feat/shell/show-workspace`
- Base commit (`main`): `13d88b1`
- Last commit: see the commit that adds this file
- Related brief: the lead's M2 message (the 진행 workspace)

## What changed and why

This is the first slice of the 진행 workspace (`docs/spec/04-show.md`): the 예배
순서 list, the 장 grid, selection, the keyboard, and outputting a 장 through the
existing `slide.show` command. The data layer does not serve a service yet, so
the panels read an invented sample service (`sampleService.ts`, marked with a
`TODO`). Components are placeholders styled like the design system `ListRow` and
`SlideThumbnail`, to be swapped for the `ui` components when they merge.

1. `show/model.ts` and `show/navigation.ts`: pure rules with no React.
   - Row selection: up, down, Home, End, skipping headers, stopping at the ends.
   - Tile selection in the grid: arrows by one and by a row, no wrap, no move
     past a short last row.
   - Next 장: the tile after the live one. With no live 장, the first tile of
     the open item. After the last tile the key stops and does not move on to
     the next item (the lead's decision; moving on becomes a 환경설정 option
     later).
   - Previous 장: the tile before the live one, nothing on the first tile.
   - 이름표 jump: the first tile with that label after the live 장, or else the
     first one in the sequence. No key is bound to it yet, because the spec does
     not name the keys (see "Decisions").
2. `state/show.ts`: a zustand store with the rows, the tiles, the open item, and
   the selected tile, plus actions. `outputTile` sends
   `{type: 'slide.show', slide}` through `sendLive` and shows that tile
   selected. The live tile comes from the live state's slide layer, so the red
   ring follows what the main process says is on output.
3. `show/ServiceOrderList.tsx`: the list. Headers are not selectable, a click
   selects an item and outputs nothing, the live item has a LIVE badge, and the
   list handles up, down, Home, and End.
4. `show/SlideGrid.tsx`: the grid, a listbox with one tab stop on the selected
   tile (roving tabindex). A tile is a 16:9 canvas with the lyrics sized by
   `4.4cqw` and a 24px 이름표 band with the number and name in the 이름표 color.
   A click outputs the tile. Arrows move the selection, and Enter and Space
   click the focused tile, as the `SlideThumbnail` README says.
5. `show/shortcuts.ts`: a window `keydown` listener that outputs the next 장
   with the right arrow or Space and the previous 장 with the left arrow. It
   ignores keys with a modifier, text fields, and the 장 grid (which has its own
   keys). It is added and removed with the 진행 workspace.
6. `shell/Workspace.tsx`: the 진행 workspace fills the 예배 순서 and 장 panels
   and starts the shortcuts. `shell/sizeClass.ts` gets `defaultThumbnailColumns`
   (3, 4, 6 as in the design system `Layout`).

## Changed files

- `src/renderer/src/show/` (new): `model.ts`, `navigation.ts`,
  `sampleService.ts`, `shortcuts.ts`, `ServiceOrderList.tsx`, `SlideGrid.tsx`,
  their CSS modules, and the tests
- `src/renderer/src/state/show.ts` and `show.test.ts` (new)
- `src/renderer/src/shell/Workspace.tsx`, `sizeClass.ts`

## Checks run

`npm run verify` on commit `b55a52a` (base `main` 13d88b1, the review document
is added after it) passed all five steps in 106.9 s: `typecheck`, `lint`,
`format:check`, `test:coverage`, and `build`.

New tests: `navigation.test.ts` (26), `state/show.test.ts` (11),
`shortcuts.test.ts` (7), and `ShowPanels.test.tsx` (12).

### Running app (port 5187, app data `D:\llp-dev\shell`)

I started `npm run dev` with remote debugging, used the real main process, and
sent real mouse and key events through the Chrome DevTools Protocol at
1920x1080.

- Clicking an item selected it and showed its tiles, with the first tile
  selected and no output.
- Clicking the second tile made it live: its ring turned red and the item got
  the LIVE badge.
- With nothing focused, the right arrow and Space moved the live 장 forward and
  the left arrow moved it back, one tile each.
- Before the last-장 fix, two more Space presses moved the live 장 to the first
  tile of the next song. That behavior was removed in the second commit, and a
  unit test now covers that the key stops at the last 장.
- After the run no process of this worktree was left. A screenshot showed the
  list, the grid with 이름표 colors, and the rings as in the design system.

Not checked: a real second output window (output is another member's work), and
a physical keyboard.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Checks run")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (none yet: the
      live state already comes validated, and the data is a sample)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the `keydown` listener is removed on
      unmount)
- [x] Caches and lists have size caps (not applicable: fixed sample data)
- [x] An exception in the output path doesn't stop the output (these changes
      only send commands)
- [x] Only what's needed re-renders (selectors return primitives, and the live
      tile is a number or null per grid)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md` (TSDoc, and `TODO(0913vision)`)
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- The review document is `shell-2`. The UI state IPC request will be `shell-3`.
- The right arrow and Space work anywhere except text fields and the 장 grid,
  even when a toolbar button has focus, because an operator must not lose the
  next-장 key after clicking a toolbar button. In the grid, the arrows move the
  selection, as the spec says for a focused grid.
- Space in the grid clicks the focused tile (outputs it), not "next 장".
- Moving the selection in the list opens the item at once (there is no separate
  "focused row" and "open item").
- `tileForLabel` has tests but no key yet: the spec does not give the 이름표
  jump keys. I need them from the spec owner before I bind them.

## Shared contract change requests

- None. The panels use the existing `slide.show` command.

## Where to look

- `navigation.ts` and its test: the next, previous, and jump rules.
- `state/show.ts`: that the live tile is read from the live state and not
  stored.
- `shortcuts.ts`: which targets it ignores.
- `SlideGrid.tsx`: the roving tab stop and the focus move after an arrow key.

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

1. Lead finding, last 장: done in commit "fix(show): stop the next-장 key at the
   last 장 and use the shared 이름표 color type". `nextTile` returns null after
   the last tile, so the key does nothing there. Tests: "stops at the last tile
   and does not move on to the next item" in `navigation.test.ts` and "stops
   after the last tile and does not move on to the next item" in
   `state/show.test.ts`. The code for moving on (the `rows` field of
   `SequenceState` and the skip rules) is removed, not hidden behind a flag.
2. Lead answer 3: `SlideTile.labelColor` is now `LabelColor` from
   `@shared/colors`, with `none` for no color.

Replies to Codex round 1 (2553a74), findings 2 to 4:

3. Finding 2 (focus in the 예배 순서 list): fixed with roving focus. The rows
   are buttons with one tab stop (the open item, or the first row when none is
   open), and after an arrow key, Home, or End the list moves focus to the new
   row when the list had focus. A change of the selection from elsewhere does
   not take focus. Tests: "keeps one tab stop, on the first row until an item is
   open", "moves focus with the arrow keys so that Enter acts on the focused
   row", and "does not take focus when the selection changes from elsewhere" in
   `ShowPanels.test.tsx`. The 장 grid already moved focus; a test now covers it
   ("moves focus with the arrow keys").
4. Finding 3 (lyrics size): fixed. The canvas is the full-width query container
   again, and the 10% side padding sits on the text layer, so `4.4cqw` is 4.4%
   of the canvas width as the design system says. CSS cannot be unit tested
   here; I checked the computed sizes in the running app (see below).
5. Finding 4 (re-rendering): `Row` and `Thumbnail` are memoized and `onOutput`
   is stable (it changes only with the open item). Test: "re-renders only the
   rows whose state changed" counts the row renders after a selection change.
   There is no equivalent unit test for the grid, because its thumbnail has no
   child component to count; the memoization is the same pattern.
6. Running app after these fixes (1920x1080, a 270 px wide thumbnail): the
   lyrics are `11.88px`, which is exactly 4.4% of the canvas width, the canvas
   has no padding, and after a click and the down arrow in the list, the focus
   and the selection were both on the next row.
7. `npm run verify` on commit `0104d95` (base `main` 63d0dbc) passed all five
   steps in 147.3 s. The commits after it only change this document.
