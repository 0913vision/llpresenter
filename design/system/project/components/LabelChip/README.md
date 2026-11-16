# LabelChip

A label tag appears in lyric blocks and lists, and a color swatch appears in the preview name row.

## Where to use

- Small 이름표, 22px: to the left of lyric blocks in library song editing (Reflow) and imported song editing (ImportEdit, ImportSave), in the text import (ImportText) preview, and inside list rows.
- Color swatch, 10px: the name row under the preview in the 준비 workspace ("■ 프리코러스 5 / 9").
- The SlideThumbnail band and MacroTile also use the 이름표 color mapping (`data-color`).

## Where not to use

- The band under a thumbnail: SlideThumbnail's `ll-thumb__band`.
- The swatch row for picking an 이름표 color: LabelColorPicker (`ll-swatch`).
- Chips that report a state (live, warning): rings and icons show state (rule 18).

## Anatomy

- 이름표 color: `data-color="teal|green|yellow|orange|rose|violet|slate|gray"`. The fill color is `label-*`, and the text is `text-on-label`. Without the attribute, there is no 이름표: `label-none` + `label-gray` text.
- Small 이름표 `ll-tag`: height `size-control-xs` (22), `radius-sm`, horizontal padding `space-8`, text `band`. If it is a button that picks an 이름표, add a 12px `down` icon after the text (gap `space-6`, right padding `space-6`). With no 이름표, its text is "이름표".
- Color swatch `ll-label-swatch`: 10×10, `radius-xs`. With no 이름표, leave it empty with a 1px `line-control` border.

## Sizes and variants

| Name | Height | Text | Where to use |
|---|---|---|---|
| Small 이름표 `ll-tag` | 22 `size-control-xs` | `band` | Lyric blocks, list rows |
| Picker 이름표 `button.ll-tag` | 22 | `band` + 12px arrow | Lyric blocks (opens the 이름표 menu) |
| Color swatch `ll-label-swatch` | 10 | None | Preview name row |

## States

| State | Background | Text and icon | Other |
|---|---|---|---|
| Small 이름표 menu open | Unchanged | Unchanged | 2px gap + 1px `text` (`aria-expanded="true"`) |



## Behavior

- A picker 이름표 has `aria-haspopup="menu"` and gets `aria-expanded="true"` when open. The menu follows the Menu rules (rule 11).
- A small 이름표 fits its host column. Long names use an ellipsis, keeping the picker arrow visible; the menu shows the full name.

## Writing

- Example 이름표 names: "전주", "1절", "2절", "3절", "4절", "프리코러스", "후렴", "포스트코러스", "브리지", "간주", "후주".

## Implementation notes

- `<LabelTag name="후렴" color="yellow" picker onOpen />`, `<LabelSwatch color="green" />`
- The 이름표 color mapping rules (`--ll-label`, `--ll-label-fg`) are in this file. Thumbnails and macro tiles use the same `data-color`.

## Changes from the drafts

- Reflow, ImportEdit, ImportSave lyric blocks: 이름표 24px → 22px, no-이름표 text #8c8c8c (`text-3` on `bg-control`) → `label-gray`, arrow opacity 0.7 → 1, white ring on the 이름표 of the active block → only while the menu is open.
- ImportText: 이름표 24px → 22px.
