# Review request: `ui-3`

- Team member: `ui`
- Branch: `feat/ui/property-parts` (stacked on `feat/ui/overlays`, ui-2)
- Base commit (`main`): filled in when sent, after ui-2 merges
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
- No shared files, no configuration, no `package.json`.

## Checks run

| Command or test                              | Result                    |
| -------------------------------------------- | ------------------------- |
| `npm run verify`                             | Filled in when sent       |
| `npx tsc`, `npx eslint src/renderer/src/ui`  | Pass                      |
| `npx vitest run --project renderer` (ui)     | Pass, 30 files, 254 tests |
| Gallery beside the preview cards (see below) | Done for all four cards   |

### Comparison with the preview cards

| Card             | Result                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| KeyCap           | 6 of 6 key specimens identical; the table, the recording field, and the tooltip and menu specimens belong to other components |
| LabelChip        | 11 of 12 identical (all chip states, the small 이름표 states); the drop position differs only in its card-only wrapper        |
| PropertyRow      | Checked side by side: name cell, gap, row height, group spacing, and control cell match in the panel and window placements    |
| LabelColorPicker | Checked side by side: swatch, chip, selected ring, and the 없음 swatch match                                                  |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (filled in when sent)
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
