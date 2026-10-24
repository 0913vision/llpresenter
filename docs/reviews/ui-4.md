# Review request: `ui-4`

- Team member: `ui`
- Branch: `feat/ui/show-parts`
- Review range: `5916a0b...feat/ui/show-parts` (round 1 was
  `02bb9c0...feat/ui/show-parts`; round 2 rebased onto `main` without conflicts)
- Base commit (`main`): `5916a0b`
- Round 2, what to check: the two fixes in "Team member's reply", each with the
  test that fails on the old code, and "Shell handoff" against shell's
  `src/renderer/src/show/shortcuts.ts`
- Last commit: the commit that adds this file (see the review request message)
- Related brief: `docs/briefs/ui.md`, M2 in `docs/MILESTONES.md`
- Shared changes: eleven new design tokens in
  `design/system/project/tokens.json`, regenerated into
  `design/system/project/tokens.css` and copied into
  `src/renderer/src/styles/tokens.css`; the 진행 click focus rule in
  `design/system/project/README.md`
- What to check: the keyboard rules against
  `docs/spec/10-shortcuts-and-settings.md` ("Focus precedence", rules 5 and 6,
  and the click focus rule) and each README; `TileList`, which the four tile
  lists share; that every new behavior has a test; the token names and values

## What changed and why

The tiles and tile lists of the 진행 workspace, built and checked the same way
as ui-1 to ui-3: each follows its README in `design/system/project/components/`
and its reference CSS, ported to a CSS module that uses only tokens.

| Component      | Exports                                                                                        | Notes                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| SlideThumbnail | `SlideThumbnail`, `ThumbnailGrid`, `thumbnailName`                                             | 16:9 canvas, lyrics at canvas width × 0.044, 이름표 band; rings for selected and live; missing media file with hatching and a tooltip |
| MediaTile      | `MediaTile`, `MediaGrid`, `MediaStrip`, `copyingText`                                          | Picture, duration with the loop icon, name; live, selected, missing file, copying (scrim, percentage, progress bar, can't be used)    |
| MacroTile      | `MacroTile`, `MacroRow`, `MacroGrid`, `MacroList`, `macroName`, `scheduleText`, `scheduleMeta` | 64px color tile or 30px row; last run, selected, scheduled (clock badge); the 새 매크로 slot at the end of the grid                   |
| Tile lists     | `TileList`, `gridMoves`, `rowMoves`, `stripMoves`                                              | The listbox the four tile lists build on: arrows, Tab stop, click and Enter, double click, right-click and Shift F10 or the Menu key  |

Shared pieces:

- `clickFocus.ts`: `CLICK_FOCUS_SELECTOR` and `clickFocusProps`, the parts that
  keep focus on a mouse click in 진행 (text fields, sliders, menus, dialogs, the
  장 grid, the 예배 순서 list). Shell's 진행 handler still uses its own
  selectors; "Shell handoff" below says what it changes when it takes these
  parts.
- `workspace.ts`: `Workspace` (`show` or `prep`). In 진행 the 장 grid keeps ↑ ↓
  and Enter and leaves ← → Space Page Up Page Down to 다음 장 and 이전 장, and
  the 예배 순서 list (`ListBox workspace="show"`) does the same with ↑ ↓ Home
  End Enter.
- `MissingFile.tsx`: the hatching with the missing file icon and its tooltip
  text, shared by thumbnails and media tiles.
- `shortcutRecording.ts`: `SHORTCUT_RECORDING_ATTRIBUTE`,
  `SHORTCUT_RECORDING_SELECTOR`, and `shortcutRecordingProps`, the mark that
  shell's clear keys already skip. The key recording field itself comes later
  under M3's U1 (the lead's call).
- The ui-6 nit: `menuButtonProps` documents and tests the `IconButton` case,
  where the caller also passes `menu` and `expanded`.

README updates from spec (spec-1's focus rules): SlideThumbnail (behavior and
implementation notes), ListRow, MediaTile, MacroTile, and the design system
README ("States and motion", the 진행 click focus rule).

## Changed files

- `src/renderer/src/ui/`: `SlideThumbnail`, `TileList`, `MediaTile`,
  `MacroTile`, `MissingFile`, `clickFocus`, `workspace`, `shortcutRecording`,
  their CSS modules and tests; `ListRow.tsx` (the workspace choice and the click
  focus mark); `menuButton.ts` (the nit); `index.ts`.
- `src/renderer/src/ui/gallery/`: sections for SlideThumbnail, MediaTile, and
  MacroTile.
- `src/renderer/src/styles/tokens.css`, `design/system/project/tokens.json`,
  `design/system/project/tokens.css`: the new tokens.
- `design/system/project/README.md` and the READMEs of SlideThumbnail, ListRow,
  MediaTile, and MacroTile.

## Checks run

| Command or test                              | Result                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                             | Pass, 5 steps run at once, 274 s in round 2 (192 s in round 1; the new verify prints no test counts on a pass) |
| `npx vitest run --project renderer` (ui)     | Pass, 38 files, 343 tests (340 in round 1)                                                                     |
| Gallery beside the preview cards (see below) | Done for the three cards, in Chromium (offscreen Electron)                                                     |

### Comparison with the preview cards

My offscreen script loads each card and its gallery section, puts the pinned
hover and focus states on the gallery with real input, and compares the computed
styles of every part.

| Card           | Result                                                                                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MacroTile      | 9 of 9 identical                                                                                                                                                                                                                              |
| MediaTile      | 8 of 10 identical; the two missing file specimens draw their hatching on a cover over the frame (`MissingFileMark`, shared with thumbnails) instead of on the frame itself, so the frame's own background differs under a cover that hides it |
| SlideThumbnail | 20 of 20 the same size and look; the only computed difference is the band's `width`, because the card sizes boxes with `content-box` (184 + 16) and the app with `border-box` (200)                                                           |

Differences kept on purpose: the grid panel's meta reads "5 / 8" for its eight
sample 장 (the card says "5 / 9"); the macro card's 주일 예배 tool row belongs
to the 진행 도구 tab, not to MacroTile.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior has unit tests
- [x] Values from outside the process are validated with a schema (none here)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered listener is released (tooltips; no new timers)
- [x] Caches and lists have size caps (none here)
- [x] An exception in the output path doesn't stop the output (not in the output
      path)
- [x] Only what's needed re-renders: tiles are `memo` components with flat
      props, and `TileList` sets the Tab stop on the DOM, so a selection change
      re-renders only the two tiles whose `selected` changed
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md` (TSDoc on exported APIs only)
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused per commit

## Decisions I made (for the lead to confirm)

1. **`TileList` owns the Tab stop.** Tiles set no `tabIndex`; the list sets it
   on the DOM after each render (one tile 0, the rest -1). With
   `arrowsMove: 'selection'` (장 grid, media) the arrows move the selection and
   the selected tile holds the Tab stop; with `arrowsMove: 'focus'` (매크로) the
   arrows move keyboard focus only, because a 매크로's selection means "being
   edited or under its menu", and the tile last in focus holds the Tab stop.
   `columns: 'auto'` reads the column count of the auto-fill 매크로 grid from
   the layout when an arrow key is pressed.
2. **Space.** The 장 grid in 진행 and every media list pass Space on (their
   READMEs don't give it to them): the window still sees the keydown. The 장
   grid in 준비 and the 매크로 lists press with Space, as their READMEs say, and
   cancel its keydown (round 2). In every list the button's own click on Enter
   and on the Space keyup is cancelled, and the list presses the tile itself,
   once per plain press (round 2).
3. **Clicks and activation.** Each list reports indexes, so the caller keeps its
   own ids. A click or Enter on a media tile calls `onActivate`, which the media
   view uses to select and the 진행 strip to send out; on a tile whose file is
   missing, the caller opens 다시 연결 there. A copying tile is `aria-disabled`
   and reports nothing.
4. **The 새 매크로 slot sits outside the listbox.** It is a button in the same
   grid, but a listbox may only hold options, so `MacroGrid` wraps the tiles in
   a `display: contents` listbox and puts the slot after it.
5. **Schedules.** `MacroSchedule` is `startup` (시작할 때 실행, which shows the
   clock badge in version 1) or a `time` such as 10:30, which spec 07 keeps
   reserved; the tile and the row write both as the README does.
6. **Tokens.** Every anatomy value of the new modules is a token or derived from
   one: `aspect-output`, `ring-hover`, `space-focus-outside-live-ring`,
   `space-thumb-lyrics-inset`, the `thumb-lyrics` type style (700, canvas width
   × 0.044, line height 1.45), `size-media-strip-tile`, `size-macro-tile`,
   `size-macro-cell-min`, `size-macro-clock`, `size-macro-swatch`, and
   `size-hatching-stripe`. The rings on colored tiles are built from `space-2`
   plus a 1px or 2px line, and 1px and 2px line widths stay literal (the lead's
   rule).

## Shared contract change requests

None.

## Shell handoff

Shell's 진행 handler (`src/renderer/src/show/shortcuts.ts`) keeps its own
selectors today: `FOCUSABLE_ON_CLICK_SELECTOR` and `PASSING_PARTS_SELECTOR` both
name `[data-slide-grid]` and `[data-service-list]`, the marks of shell's own
`SlideGrid` and `ServiceOrderList`. The ui parts don't carry those marks. When
shell moves to `ThumbnailGrid workspace="show"`, `ListBox workspace="show"`,
`MediaStrip`, and the 매크로 lists, it changes three things:

1. **Click focus.** Replace `FOCUSABLE_ON_CLICK_SELECTOR` with
   `CLICK_FOCUS_SELECTOR` from `@renderer/ui`. It covers the text fields and
   sliders (`input`, `textarea`, `select`, `contenteditable`), menus and
   dialogs, and every part marked with `clickFocusProps`: `ThumbnailGrid` and
   `ListBox`. `MediaStrip` and the 매크로 lists aren't marked, so a click there
   leaves the focus where it was, and → and Space still go to 다음 장.
2. **Keys a part takes.** Every ui list cancels the keydown of each key it takes
   (`preventDefault`), and `handleShowKey` already returns on
   `defaultPrevented`. In 진행:

   | Part                     | Takes (keydown cancelled)                         | Passes on to the window                 |
   | ------------------------ | ------------------------------------------------- | --------------------------------------- |
   | `ThumbnailGrid` (`show`) | ↑ ↓, Enter (sends out, once per press), menu      | ← → Space Page Up Page Down, digit keys |
   | `ListBox` (`show`)       | ↑ ↓ Home End, Enter                               | ← → Space Page Up Page Down, digit keys |
   | `MediaStrip`             | ← →, Enter, menu                                  | Space Page Up Page Down, digit keys     |
   | `MacroGrid`, `MacroList` | Arrows, Enter, Space (runs, once per press), menu | Page Up Page Down, digit keys           |

   "Menu" is Shift F10 and the Menu key. A held key or a key with a modifier
   presses nothing. The tile lists also cancel every Space keyup, so a passed
   Space never clicks a tile; `handleShowKeyUp` needs no change for them.

3. **Space routing.** `isTakenByFocusedControl` treats a focused `button` as
   taking Space unless it sits inside `PASSING_PARTS_SELECTOR`, and every tile
   is a `button` with `role="option"`. Replace `PASSING_PARTS_SELECTOR` with
   `[role="listbox"]`: a ui list that takes Space has already cancelled the
   keydown, and a list that passes it leaves it to 다음 장. The rows of
   `ListBox` are not buttons, so the 예배 순서 list passes Space either way; a
   `ListRow` end button such as 내리기 still takes Space as a button.

`SHORTCUT_RECORDING_SELECTOR` from `@renderer/ui` is the same string as
`SHORTCUT_RECORDER_SELECTOR` in `clearKeys.ts`, so shell can import it.

## Where to look

- `src/renderer/src/ui/TileList.tsx`: the keys, the Tab stop, and focus that
  follows the selection.
- `src/renderer/src/ui/SlideThumbnail.tsx`: the 진행 and 준비 keys.
- `src/renderer/src/ui/MacroTile.tsx`: focus-only arrows and the 새 매크로 slot.

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

Round 1 findings from codex2, both fixed.

1. A held or modified Enter pressed a tile through the button's own click.
   `TileList` now cancels that click on every Enter keydown and presses the tile
   itself only on a plain, first keydown; the Space keyup works the same way, so
   a modified Space presses nothing either (`2a6438f`). Tests that fail on the
   old code: a held Enter (four keydowns) presses the tile once; Enter and Space
   with Control, Shift, Alt, or Meta press nothing on a 매크로 list, and a plain
   Space still does. While writing the shell handoff I found that a list that
   presses with Space didn't cancel the keydown, so shell's handler couldn't
   tell it from a list that passes Space on; it does now (`e30e03e`). Test: the
   Space keydown is cancelled on a 매크로 tile and not on a media strip tile.
2. The claim about shell's handler was wrong: it still uses its own selectors.
   The shared-pieces note now says so, and "Shell handoff" lists what shell
   changes, including the Space routing of the 장 grid and the media strip. I
   sent it to shell.
