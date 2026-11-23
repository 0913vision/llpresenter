# ServiceTable

The 예배 순서 of the 준비 (Prep) workspace as a table: one row per item, with its name and how many 슬라이드 it has. It is a `ListBox` of `ListRow` rows that carry one read-only cell, so it keeps the list's selection, drag, rename, and menus. The item's settings are in the right column, not in the table.

## Where to use

- The 예배 순서 panel in 준비, in the center column.

## Where not to use

- The 예배 순서 in 진행 (Show): it keeps the plain list (`ListRow` with the extra information at the right).
- A list of files or songs (library, media): use `ListRow`.
- Property rows beside a name: use `PropertyRow`.

## Anatomy

- Header `ll-table__header`: height `size-table-header` (40), `caption` `text-3`, the column names 이름 and 슬라이드. It is hidden from assistive technology, because the row names itself.
- Row `ll-table__row`: a `ListRow` at `size-table-row` (44), with the cell after the name.
  - Item number `ll-row__lead`: `size-table-number` (24) wide, right-aligned, `caption` `text-3`, tabular numbers, before the type icon. It counts items only, not 구역 (section heads).
  - Name: `body-strong` `text`. The header's 이름 starts where the name does.
  - 슬라이드 cell: `size-table-slides` (72) wide, `body` `text-2`, tabular numbers, the 슬라이드 count. Empty for a media item, whose length shows on its tile.
- Section head: a compact group head, `size-table-section` (32), `caption-strong` `text-2`, with a 1px `bg-raised` line above every section but the first. It is no item row, so it carries no number, icon, or cell.
- Footer: the 항목 and 구역 add buttons after the last row.

## Sizes and variants

| Name | Height | Where to use |
|---|---|---|
| Header | 40 | Above the rows |
| Item row | 44 | Every item |
| Section head | 32 | Between groups of items |

The width follows the table, which never scrolls sideways (checked at 1280x720): the 슬라이드 cell keeps `size-table-slides` (72) and the name takes the rest, at least 160 wide.

## States

| State | Look |
|---|---|
| Row selected, live, done, warning | As `ListRow` |
| 슬라이드 cell | `text-2`; `text-on-selection` in a selected row |

## Behavior

- The cell is read-only. Clicks, keys, and menus act on the row, as in `ListRow`.
- The item's choices (테마, 배경, 오버레이, 예식문 버전) are made in the right column and the item editor.

## Writing

- Column names: 이름, 슬라이드.
