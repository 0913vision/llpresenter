# Review request: `ui-3`

- Team member: `ui`
- Branch: `feat/ui/property-parts`
- Review range: `699fe8a...feat/ui/property-parts`
- Base commit (`main`): `699fe8a` (now `caf3511` on `main`, the same patch)
- Shared changes: six new design tokens in `design/system/project/tokens.json`,
  regenerated into `design/system/project/tokens.css` and copied into
  `src/renderer/src/styles/tokens.css` (round 2, finding 4)
- Round 2, what to check: the five fixes in "Team member's reply", each with the
  test that fails on the old code; the token names and values; that no 1px or
  2px line width moved into a token (the lead's rule)
- Last commit: the commit that adds this file (see the review request message)
- Related brief: `docs/briefs/ui.md`, M2 in `docs/MILESTONES.md`

## What changed and why

The first four M2 components, built and checked the same way as ui-1 and ui-2.

| Component        | Exports                                                                          | Notes                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| PropertyRow      | `Properties`, `PropertyColumns`, `PropertyGroup`, `PropertyRow`, `PropertyValue` | The placement (`panel` 84 or `window` 168) sets the name width and row height for every row; the name is a `label for` its control |
| KeyCap           | `KeyCombo`, `KeyList`, `KeyText`, `formatShortcut`, `conflictText`               | `kbd` keys, changed and conflict states, 없음; one text format for tooltips, menus, and the table                                  |
| LabelChip        | `ArrangementStrip`, `LabelTag`, `LabelSwatch`, `labelInk`                        | The 구성 strip (horizontal listbox), the small 이름표 and its picker button, the 10px swatch                                       |
| LabelColorPicker | `LabelColorPicker`, `MacroColorPicker`, `labelColorNames`                        | 없음 and the eight colors for 이름표, the eight colors for macros; a radio group with arrow keys                                   |

Shared pieces: `labelInk.ts` maps an 이름표 color to the fill and text color
(`label-*` with `text-on-label`, or `label-none` with `label-gray`), so the
thumbnails and macro tiles in the next request paint the same way. `korean.ts`
gains `withParticle` (과 or 와) for "출력 켜기와 겹침".

## Changed files

- `src/renderer/src/ui/`: the components above, their CSS modules and tests,
  `labelInk.ts`, `korean.ts`, and the exports in `index.ts`.
- `src/renderer/src/ui/gallery/`: sections for PropertyRow, KeyCap, and the
  label parts.
- `src/renderer/src/ui/Menu.test.tsx`: the ui-2 round 2 nit from codex4. The
  resize test now gives the opener and the menu a size and checks that the menu
  moves to its new left and top (flips above, moves left), not only its maximum
  height (`eb8378b`).
- The ui-2 rule of TSDoc on exported APIs only also holds here: the private
  label chip helpers lost theirs, and the color row props are exported as
  `SwatchRowProps`, because the picker props derive from them (`5c2c3e5`).
- No shared files, no configuration, no `package.json`.

## Checks run

| Command or test                              | Result                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm run verify` (round 2)                   | Pass, 5 steps, 102 files, 1058 tests (1 skipped under coverage by design, not ui), 223 s |
| `npx tsc`, `npx eslint src/renderer/src/ui`  | Pass                                                                                     |
| `npx vitest run --project renderer` (ui)     | Pass, 30 files, 254 tests                                                                |
| Gallery beside the preview cards (see below) | Done for all four cards                                                                  |

### Comparison with the preview cards

| Card             | Result                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| KeyCap           | 6 of 6 key specimens identical; the table, the recording field, and the tooltip and menu specimens belong to other components |
| LabelChip        | 11 of 12 identical (all chip states, the small 이름표 states); the drop position differs only in its card-only wrapper        |
| PropertyRow      | Checked side by side: name cell, gap, row height, group spacing, and control cell match in the panel and window placements    |
| LabelColorPicker | Checked side by side: swatch, chip, selected ring, and the 없음 swatch match                                                  |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior has unit tests
- [x] Values from outside the process are validated with a schema (none here)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Nothing registered needs releasing beyond what the components unmount
- [x] Caches and lists have size caps (none here)
- [x] An exception in the output path doesn't stop the output (not in the output
      path)
- [x] Only what's needed re-renders (control window)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused per commit

## Decisions I made (for the lead to confirm)

1. **PropertyRow** takes its control as a function of the control id
   (`{id => <Switch id={id} … />}`), so the name is always a real `label for`
   and a click on it focuses or toggles the control. A row whose control is
   disabled (`disabled` or `aria-disabled`) draws its name in `text-off`.
2. **ArrangementStrip** handles selection with the arrows, Alt + Left or Right
   to move a chip, and Delete, and asks the caller with `onMove` and `onRemove`.
   Dragging with the pointer is left to the 준비 feature, which shows its state
   with `dropIndex` and `draggingIndex`, as with ListRow. The insert button
   reports itself to `onInsert` so the 이름표 menu can open below it.
3. **The color row inside a menu** (the 이름표 menu and the macro right-click
   menu on the card) needs a Menu entry that holds content and lets the up and
   down arrows land on it. I'll add that when the 이름표 menu is built in the
   준비 work, instead of now without a user.
4. **Key names** are passed in as Windows writes them; `formatShortcut` joins
   them with one space. `KeyCombo` draws a conflict's reason in the warning
   icon's tooltip and `aria-label`.

## Shared contract change requests

None.

## Where to look

- `LabelChip.tsx`: the strip's key handling (`handleChipKey`).
- `PropertyRow.tsx`: the function-of-id children.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (5c56eb2): reviewer (Codex, codex4) Request changes: the segmented
  control had no accessible name, long values clipped without a tooltip,
  deleting the last chip lost focus, literal sizes bypassed the tokens, and the
  insert button had no tooltip. Lead approved the token scope (component tokens
  in ui-3, the earlier modules in ui-4, 1px and 2px widths literal).
- Round 2 (a932023): reviewer (Codex, codex2) Approve with one nit: the
  PropertyRow example in the review doc should destructure
  `{controlId, labelId}`. The nit goes into ui's next commit. Lead Approve.
  Rebased by the lead onto local `main` with `--onto` (its base 699fe8a was
  rewritten as caf3511) without conflicts.

## Team member's reply

Round 1 findings from codex4, all fixed. Each fix has a test that fails on the
old code; the CSS parts are also checked in Chromium (an offscreen Electron
window on the plain Vite gallery).

1. A group control had no name, and a press on its name did nothing.
   `PropertyRow` now gives its control function both ids, `{controlId, labelId}`
   (`PropertyControlIds`). A field, a switch, or a button takes `controlId`, and
   the name's `for` works as before. A group control takes `controlId` as its
   own id and `labelId` as its `aria-labelledby`; `SegmentedControl` gained an
   `id` prop for that. A press on the name of a control that `for` can't reach
   (not a button, input, select, textarea, meter, output, or progress) focuses
   the control's Tab stop (`ac40900`). Tests: the radiogroup is named 종류 after
   its row, and a press on 종류 focuses the selected segment. In Chromium the
   gallery's 종류 row behaves the same.
2. Long values clipped with no tooltip. The value text is now a `TruncatedText`
   inside the value, which shrinks and ends in an ellipsis, and shows the full
   value in a tooltip only when it is cut off; the icon keeps its size
   (`8233452`). Test: a value wider than its box shows the full text in a
   tooltip. In Chromium a long path computes `text-overflow: ellipsis`, is cut
   off, and doesn't widen the row.
3. Removing the last chip left no Tab stop. `ArrangementStrip` now keeps the Tab
   stop on the last chip when the selection is past the end, and after Delete it
   selects and focuses the chip that took the removed one's place (the one
   before it when the last chip went), or the 장 넣기 button when no chip is
   left (`002635d`). Tests with real removal: End then Delete selects and
   focuses 후렴 with one Tab stop; Delete on the first chip selects and focuses
   the next; deleting every chip focuses 장 넣기; a selection past the end keeps
   the Tab stop on the last chip.
4. Literal sizes. Six component tokens, named for what they are, now carry the
   anatomy values of the four modules (`c2198e6`): `size-color-swatch` 24px and
   `size-color-swatch-chip` 16px (the color rows), `size-label-swatch` 10px (the
   small 이름표 square), `size-prop-control-max` 340px (a control in a settings
   window row), `space-prop-label-top` 7px (a name lined up with the first line
   of a multi-line control), and `space-focus-outside-ring` 5px (the focus
   outline outside a 2px gap and a 2px ring). The 2px ring gaps and the warning
   outline offset use the existing `space-2`, and the drop line's pull is
   derived from the strip gap, `calc((var(--space-8) + 2px) / -2)`. Per the
   lead, the 1px and 2px line and ring widths stay literal, and the merged ui-1
   and ui-2 modules follow in ui-4. In Chromium the swatch is still 24x24, its
   chip 16x16, the 이름표 square 10x10, the window control max 340px, and the
   drop line margin -5px.
5. Nit: the icon-only 장 넣기 button now shows its name in the shared Tooltip
   (`71adccf`). Test on the fake clock: resting on the button shows 장 넣기.
