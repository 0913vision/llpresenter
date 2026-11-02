# ServiceTable

The 예배 순서 of the 준비 (Prep) workspace as a table: one row per item, with the item's own choices in cells that edit in place. It is a `ListBox` of `ListRow` rows that carry cells, so it keeps the list's selection, drag, rename, and menus.

## Where to use

- The 예배 순서 panel in 준비, in the center column.

## Where not to use

- The 예배 순서 in 진행 (Show): it keeps the plain list (`ListRow` with the extra information at the right).
- A list of files or songs (library, media): use `ListRow`.
- Property rows beside a name: use `PropertyRow`.

## Anatomy

- Header `ll-table__header`: height `size-table-header` (40), `caption` `text-3`, the column names above the cells. It is hidden from assistive technology, because each cell names itself.
- Row `ll-table__row`: a `ListRow` at `size-row-double` (52), with the cells after the name.
  - Item number `ll-row__lead`: `size-table-number` (24) wide, right-aligned, `caption` `text-3`, tabular numbers, before the type icon. It counts items only, not 구역 (section heads).
  - Name: `body`, as in the list. The header's 이름 starts where the name does.
  - Cells, each `space-10` after the one before, `body` `text`, one line, truncated:

    | Cell | Width token | Content |
    |---|---|---|
    | 구성 | `size-table-arrangement` (96) | The item's 구성 name, 기본 when it uses none. Song items only. |
    | 슬라이드 | `size-table-slides` (72) | The 슬라이드 count, or the duration of a media item. Tabular numbers. |
    | 테마 | `size-table-theme` (140) | The 테마 name; `text-3` when the item follows its kind's default, with the reason as a tooltip. No tag word after it. |
    | 배경 | `size-table-background` (168) | A `size-table-thumb` (20) still, then the name of the background that plays. `text-3` when it comes from the song. 없음 and no still when nothing plays. |
    | 시작할 때 | `size-table-start` (112) | The 매크로 name, 없음 when none. |
    | 메모 | `size-table-memo` (160) | The text. |

- Section head: the list's group head (`ListGroup`), unchanged.
- Footer: the 항목 and 구역 add buttons after the last row.

## Sizes and variants

| Name | Height | Where to use |
|---|---|---|
| Header | 40 | Above the rows |
| Item row | 52 | Every item |
| Section head | 29 | Between groups of items |

The width follows the table, which never scrolls sideways (checked at 1280x720):

- Regular width: the five cells keep the widths above and 메모 keeps `size-table-memo` (160). The name takes the rest, and is at least 160 wide.
- Narrower: the six cells shrink together and truncate. Below the width where the name would get less than about 160px (a table of about 1010px), 메모 hides first; the memo stays in 항목 설정.
- Wider: the extra width goes to the name and to 메모 as 1.5 to 1.2, as draft g5 does, so no gap opens between the name and 구성.
- 메모 text is regular weight `text-2`.

## States

| State | Look |
|---|---|
| Row selected, live, done, warning | As `ListRow` |
| Cell default | Text, no frame |
| Cell hover | Pointer stays the default arrow; the tooltip shows the cell's reason |
| Cell focus | `outline: 2px solid accent`, as other focus rings |
| Cell open | The list or picker below the cell; `aria-expanded` |
| Cell locked (새 버전의 파일) | `aria-disabled`; the tooltip says the file is a newer version |
| Memo editing | A field in the cell: `bg-well`, `ring-field-focus` |

## Behavior

- 구성, 테마, 시작할 때 open a menu of radio choices below the cell. 배경 opens the media picker of the item settings, with 곡 기본값 first. 메모 turns into text: Enter or leaving the cell saves, Esc puts the saved text back. An empty memo removes it. Each choice is one write of this item, as the same rows in the right column.
- Keyboard: with a row selected, ArrowRight moves into its first cell and ArrowLeft and ArrowRight move between cells. Enter (or Space) opens the cell. Esc, or ArrowLeft from the first cell, goes back to the row. While a cell has focus, Delete, rename, and the arrows of the list do not act on the row.
- Cells sit out of the Tab order, so Tab still goes from the list to the next panel.
- A kind that has no such choice leaves the cell empty or read-only: only song items have a 구성 and a 배경 to choose, and 구역 rows have no cells.

## Writing

- Use the labels of the right column: 구성, 테마, 배경, 시작할 때, 메모, and 기본 and 없음 for the empty choices.
- Never add a tag word such as "기본" after a name that follows a default. Dim the name and explain it in the tooltip.
