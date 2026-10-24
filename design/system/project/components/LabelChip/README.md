# LabelChip

A chip that shows a group of 장 (slide) in a song (1절, 프리코러스, 후렴) painted in its 이름표 (label) color. Use it in the 구성 (arrangement) strip and lyric blocks of the 준비 (Prep) workspace, and as a small 이름표 inside lists.

## Where to use

- 구성 strip chip, 30px: the "구성" of a 예배 순서 (service order) item in the 준비 workspace (PrepService). The chip order matches the order of the thumbnails below, and dragging a chip changes the order.
- Small 이름표, 22px: to the left of lyric blocks in library song editing (Reflow) and imported song editing (ImportEdit, ImportSave), in the text import (ImportText) preview, and inside list rows.
- Color swatch, 10px: the name row under the preview in the 준비 workspace ("■ 프리코러스 5 / 9").
- The SlideThumbnail band and MacroTile also use the 이름표 color mapping (`data-color`).

## Where not to use

- The band under a thumbnail: SlideThumbnail's `ll-thumb__band`.
- The swatch row for picking an 이름표 color: LabelColorPicker (`ll-swatch`).
- Chips that report a state (live, warning): rings and icons show state (rule 18).

## Anatomy

- 이름표 color: `data-color="teal|green|yellow|orange|rose|violet|slate|gray"`. The fill color is `label-*`, and the text is `text-on-label`. Without the attribute, there is no 이름표: `label-none` + `label-gray` text.
- 구성 strip `ll-chip-strip`: a horizontal row that wraps, gap `space-8` between chips and between lines.
- Chip `ll-chip`: height `size-control-md` (30), corner radius `radius-sm`, left padding `space-6`, right padding `space-10`, text `band` (12/16/700). A 14px `grip` icon in front (opacity 0.55), gap between icon and text `space-6`. A group without an 이름표 shows its group number ("4").
- Insert slot `ll-chip-add`: 30×30, `radius-sm`, 1px dashed `line-control`, 14px `plus` icon in `text-2`. Place it at the very end of the strip.
- Drop position `ll-chip-drop`: while dragging, a 2px × 30 `accent` bar (`radius-full`) in the middle of the gap between chips. Its left and right margins are pulled in to −5px so that the gap doesn't widen.
- Small 이름표 `ll-tag`: height `size-control-xs` (22), `radius-sm`, horizontal padding `space-8`, text `band`. If it is a button that picks an 이름표, add a 12px `down` icon after the text (gap `space-6`, right padding `space-6`). With no 이름표, its text is "이름표".
- Color swatch `ll-label-swatch`: 10×10, `radius-xs`. With no 이름표, leave it empty with a 1px `line-control` border.

## Sizes and variants

| Name | Height | Text | Where to use |
|---|---|---|---|
| Chip `ll-chip` | 30 `size-control-md` | `band` | 구성 strip |
| Insert `ll-chip-add` | 30 | Icon 14 | End of the 구성 strip |
| Small 이름표 `ll-tag` | 22 `size-control-xs` | `band` | Lyric blocks, list rows |
| Picker 이름표 `button.ll-tag` | 22 | `band` + 12px arrow | Lyric blocks (opens the 이름표 menu) |
| Color swatch `ll-label-swatch` | 10 | None | Preview name row |

## States

| State | Background | Text and icon | Other |
|---|---|---|---|
| Default | `label-*` / `label-none` | `text-on-label` / `label-gray`, grip 0.55 | |
| Hover (color chip) | Unchanged | Grip opacity 1 | Cursor grab |
| Hover (no 이름표) | `bg-control-hover` | Grip opacity 1 | |
| Selected | Unchanged | Unchanged | 2px gap (`bg-panel`) + 2px `accent` |
| Live | Unchanged | Unchanged | 2px gap + 2px `live` |
| Focus | Unchanged | Unchanged | `outline: 2px solid accent`, offset 5px (outside the ring) |
| Dragging | Unchanged | Grip 1 | `shadow-popover`, cursor grabbing. `ll-chip-drop` at the drop position |
| Insert hover / pressed | `bg-raised` / `bg-control-hover` | `text-2` / `text` | |
| Small 이름표 menu open | Unchanged | Unchanged | 2px gap + 1px `text` (`aria-expanded="true"`) |

The 2px gap before the ring keeps the ring from blending with the chip color on color chips (a navy chip and `accent` differ in brightness by only 1.1:1). Because the chip is 30px, the live ring is also 2px, not 3px. You can change the gap color with `--ll-chip-gap` (default `bg-panel`).

Hover on a color chip doesn't change the background color. The 이름표 color itself is the information, so the hover gray (#333333) must not cover it.

## Behavior

- The 구성 strip is `role="listbox"` with `aria-orientation="horizontal"`, and each chip is `role="option"` + `aria-selected`. The arrow keys select chips, and selecting a chip also selects its thumbnail below.
- Drag a chip to change the order. From the keyboard, Alt + ←/→ moves the selected chip by one place. Delete removes the 장 at that place from the 구성 (it doesn't delete it from the song).
- Insert (+) opens the 이름표 menu so that the user picks the group to insert. `aria-label="장 넣기"`.
- A picker 이름표 has `aria-haspopup="menu"` and gets `aria-expanded="true"` when open. The menu follows the Menu rules (rule 11).
- The chip of a live group has `data-state="live"`.

## Writing

- The chip text is a single 이름표 name. Don't add a count or a repeat mark such as "(2)". If the same group appears twice, there are two chips.
- With no 이름표, write only the group number ("4"). In a picker 이름표, write "이름표".
- Example 이름표 names: "1절", "2절", "프리코러스", "후렴", "브리지", "간주", "엔딩".

## Implementation notes

- `<ArrangementStrip items={[{ id, name: '1절', color: 'teal', n: 1 }, …]} selected={4} live={2} onReorder onInsert />`
- `<LabelChip name="후렴" color="yellow" selected live dragging />`, `<LabelTag name="후렴" color="yellow" picker onOpen />`, `<LabelSwatch color="green" />`
- Classes: `ll-chip-strip`, `ll-chip`, `ll-chip__grip`, `ll-chip-add`, `ll-chip-drop`, `ll-tag`, `ll-label-swatch`. Dragging is `.is-dragging`.
- The 이름표 color mapping rules (`--ll-label`, `--ll-label-fg`) are in this file. Thumbnails and macro tiles use the same `data-color`.

## Changes from the drafts

- PrepService 구성 strip: chip corner radius 4px → `radius-sm` 3px, gap between chips 6 → 8, selected chip ring "2px gap + 1px #ececec" → "2px gap + 2px `accent`" (the same color as a selected thumbnail), chip hover #333333 → grip opacity only, text of a chip without an 이름표 #b4b4b4 → `label-gray`, insert dashed line #4a4a4a → `line-control`.
- Reflow, ImportEdit, ImportSave lyric blocks: 이름표 24px → 22px, no-이름표 text #8c8c8c (`text-3` on `bg-control`) → `label-gray`, arrow opacity 0.7 → 1, white ring on the 이름표 of the active block → only while the menu is open.
- ImportText: 이름표 24px → 22px.
