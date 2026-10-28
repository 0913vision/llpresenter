# Checkbox

A 16px checkbox for picking several things, and a check row that toggles when you click anywhere on it. Use them in the item tree of 다른 예배에서 가져오기 (import from another service), in the states to restore in 출력 상태 복구 (restore output state), and in the layer list of a Look.

## Where to use

- 다른 예배에서 가져오기, and the 예배 순서 (service order) of a new service: picking groups (예배 전, 찬양) and items
- 출력 상태 복구: the states to restore (화면 출력, 마지막 슬라이드, 표시 중이던 항목)
- The layer list in the Look editor (visibility)

## Where not to use

- On/off settings that apply at once (항상 위, 절전 막기, 오류 보고 보내기): use `Switch`.
- Picking only one: use `SegmentedControl` or `Select`.
- Marking the currently selected row in a list: use the `selection` background of the list row. Don't add a checkbox.

## Anatomy

- Box `ll-check`: 16×16, radius `radius-sm` (3px).
  - Off: background `bg-well`, border `inset 0 0 0 1px` `line-control`.
  - On: background `accent-fill`, white check mark (`check` 12px, `text-on-fill`), no border.
  - Mixed: background `accent-fill`, an 8×2 bar in the center (`text-on-fill`, radius 1px).
- Check row `ll-check-row`: height `size-row` (30), gap between the box and the next element `space-10`, text `body` (16/22) `text`.
  - Type icon `ll-check-row__icon`: 16px `text-2`, 10px from the text.
  - Extra info on the right `ll-check-row__meta`: `caption` (14/20) `text-3` (for example, the 구성 (arrangement) name 주일용).
  - Row with a value (출력 상태 복구): fix the name with `ll-check-row__text--fixed` (168px), and put the value `ll-check-row__value` (`label` 14/20, `text-3`, truncated with an ellipsis) after it.
- Row in a list `ll-check-row--list`: horizontal padding `space-14`, hover `bg-raised`. Same rules as a list row.
- Group header row `ll-check-row--group`: text `caption-strong` (16/22/600) `text-3`. When only some items of the group are picked, the box shows the mixed state.
- Rows in a dialog (출력 상태 복구) have no horizontal padding and no hover, and follow the padding of the dialog body.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Box | 16 | - | Inside rows, list headers (select all) |
| Check row | 30 | `body` 16/22 | Choices in dialogs |
| List row | 30 | `body` 16/22, horizontal padding 14 | 다른 예배에서 가져오기, new service, Look layers |
| Group header row | 30 | `caption-strong` 16/22/600 `text-3` | Parents in the item tree |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Off | `bg-well` | - | Border `line-control` 1px |
| On | `accent-fill` | Check mark `text-on-fill` | |
| Mixed | `accent-fill` | Bar `text-on-fill` | `aria-checked="mixed"` |
| Hover | `bg-raised` for list rows | Same | The box itself doesn't change |
| Focus | Same | Same | outline 2px `accent` on the box, offset 1px |
| Disabled (off) | `bg-well` | Row text, icon, and extra info `text-off` | Border `line-strong`. No hover |
| Disabled (on, mixed) | `bg-control` | Check mark and bar `text-off` | Don't lower the opacity. Reason in a tooltip |

## Behavior

- The whole row is a `label`, so a click on the box, icon, or name toggles it. Unmodified Space toggles it too; modified Space passes on without toggling.
- Modified Enter passes through without toggling; unmodified Enter remains with the dialog action.
- In 진행, clicking the box or any part of its label keeps keyboard focus where it was. Tab still focuses the checkbox and Space toggles it. 준비 and dialogs retain native label focus behavior.
- A click on a group header: if it is mixed or off, turn on the whole group; if it is on, turn off the whole group. When an item changes, recount the header state (all on, mixed, all off).
- In a list (item tree), Tab enters the list only once, the up and down arrows move between rows, and Space toggles. For the few rows in a dialog (출력 상태 복구), Tab stops at each box.
- aria: `role="checkbox"`, `aria-checked="true|false|mixed"`. For a tree structure, give the list `role="tree"` and each row `role="treeitem"` and `aria-checked`.

## Writing

- Write only the name of what is picked as the row name: "화면 출력", "마지막 슬라이드", "표시 중이던 항목". Don't write sentences such as "~을 복구합니다" (Restores ~).
- In the value, list what is in it now, separated by commas: "본 화면, 무대 화면, 방송 자막".

## Implementation notes

- `<Checkbox checked={true | false | 'mixed'} onChange />`
- `<CheckRow checked label="주일 광고" icon="notice" meta="주일용" variant="list" />`, `<CheckRow group label="예배 전" checked="mixed" />`
- Markup: `label.ll-check-row[.ll-check-row--list][.ll-check-row--group] > button.ll-check[role=checkbox][aria-checked] > span.ll-i.ll-i-check` + `[span.ll-i.ll-check-row__icon]` + `span.ll-check-row__text` + `[span.ll-check-row__value | span.ll-check-row__meta]`
- The CSS draws the bar of the mixed state with `::after`, so always include the check icon span.
- Classes: `ll-check`, `ll-check-row`, `ll-check-row--list`, `ll-check-row--group`, `ll-check-row__icon`, `ll-check-row__text`, `ll-check-row__text--fixed`, `ll-check-row__value`, `ll-check-row__meta`.

## Changes from the drafts

- Checked boxes in NewService, ServiceImport, Recovery, Looks: background #3d8bf0 (`accent`) → `accent-fill`.
- Unchecked boxes in ServiceImport, Looks: border #4a4a4a → `line-control`. Looks background transparent → `bg-well`.
- ServiceImport, NewService row height 28 → 30. Recovery row height 36 → 30, gap between box and icon 12 → 10. Looks layer list row 34 → 30, horizontal padding 12 → 14.
