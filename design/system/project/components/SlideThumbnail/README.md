# SlideThumbnail

A thumbnail that shows one 장 (slide) as a 16:9 output canvas with a 24px 이름표 (label) band. Use it in the 장 grid of the 진행 (Show) workspace and in the 장 list of the 준비 (Prep) workspace.

## Where to use

- The 장 panel in the 진행 workspace (ShowH, Compact, Problems). A click outputs that 장.
- A 예배 순서 (service order) item in the 준비 workspace (PrepService). Lay out the 장 in 구성 (arrangement) order.
- The 장 panel of a library song in the 준비 workspace (Reflow), imported song editing (ImportEdit), and Bible verses (Bible).

## Where not to use

- Media tiles: use MediaTile (the name sits separately under the image, and a duration chip is attached).
- Screens in the preview panel: use PreviewFrame (it shows a scaled-down copy of the real output that Look draws).
- Notice and prop tiles in the 진행 도구 (show tools): use the component of that tab.

## Anatomy

- Outer element: `button`. Its corner radius `radius-md` (4px) clips the canvas and the band together (`overflow: hidden`). Rings are outer shadows, so they aren't clipped.
- Canvas: 16:9, background `output-black`. Don't draw the song's default background (background media such as 따뜻한 빛). Fill only an image or video placed in the 장 itself, with `object-fit: cover` (a Sunday announcement 장).
- Lyrics: text `text-on-fill`, weight 700, line height 1.45, centered, horizontal padding 10%. Keep the line breaks as written in the 장 (`white-space: pre-line`, `word-break: keep-all`).
- Lyric font size = canvas width × 0.044. In CSS, set `container-type: inline-size` on the canvas and `font-size: 4.4cqw` on the text. Don't set a minimum, because the thumbnail must break lines in the same places as the output.
  - The draft ShowH formula `thumbFont = 48 / column count` (px) fits only a center column of 1144 (1116 inside the body). As width ratios, 2 columns 552px→24px (0.0435), 4 columns 270px→12px (0.0444), and 6 columns 176px→8px (0.0455), so a single 0.044 is used.
- 이름표 band: height `size-thumb-band` (24px), text `band` (12/16/700), left padding `space-8`, gap between number and name `space-8`, number in `tabular-nums`. If the 이름표 has a color, paint the whole band in that color (`label-teal` and so on) with `text-on-label` text. Otherwise use `label-none` with `label-gray` text, and write only the number. Truncate a long name with an ellipsis.
- Grid (`ll-thumb-grid`): the size slider in the panel's bottom row sets 2–8 columns. Gap `space-16` vertical, `space-12` horizontal. The outer margin is the panel body's `panel-inset` (14). The window size range sets the default column count (narrow window 3, regular 4, wide 6. See Layout).
  - The slider is "썸네일 크기" (thumbnail size), so moving it right makes thumbnails larger and the columns fewer. The right end is 2 columns and the left end is 8 columns (column count = 10 − slider value, values 2–8).

## Sizes and variants

| Name | Height | Text | Where to use |
|---|---|---|---|
| Lyrics 장 | width × 9/16 + 24 | lyrics width × 0.044 / band `band` | 장 panel in 진행, 예배 순서 items, library song 장 panel |
| Media 장 | width × 9/16 + 24 | band `band` | A 장 with an image or video (Sunday announcement) |

The thumbnail itself has no size variants. The column count of the grid sets its size.

## States

| State | Background | Text and icon | Other |
|---|---|---|---|
| Default | `output-black`, band `label-*` or `label-none` | `text-on-fill`, band `text-on-label` or `label-gray` | |
| Hover | Same | Same | Outer 1px `line-control` |
| Selected (not live) | Same | Same | `ring-selected` (2px `accent`) |
| Live | Same | Same | `ring-live` (3px `live`). Takes priority over selected |
| Focus | Same | Same | `outline: 2px solid accent`, `outline-offset: 4px` (outside the live ring) |
| 장 media file missing | Hatching (`bg-inset`/`bg-well`, 135°, 6px) | `filex` 24px `warning` in the center | If live, also `ring-live`. The path is in the title tooltip |

Hover uses the same 1px `line-control` as the hover of the small previews (ShowH `.pv:hover`, 1px #6e6e6e). Because it is a gray 1px line, it doesn't get confused with the blue 2px (selected) or the red 3px (live), and it only shows where you can click. On a selected or live thumbnail, hover keeps that ring as it is.

## Behavior

- In the 진행 workspace, a click outputs that 장. In the 준비 workspace, a click only selects it.
- The grid is `role="listbox"`, and each thumbnail is `role="option"` + `aria-selected`. Tab enters the grid only once (roving tabindex), on the selected thumbnail.
- In the 준비 workspace, the arrow keys move between thumbnails, and Enter and Space act as a click.
- In the 진행 workspace, the grid keeps only ↑ and ↓ (one row) and Enter (a click). ←, →, Space, Page Up, and Page Down go to 다음 장 and 이전 장 even while the grid has focus, as in ProPresenter (focus precedence, rule 5, in `docs/spec/10-shortcuts-and-settings.md`). Space never presses the focused thumbnail there.
- The grid takes keyboard focus on a mouse click, also in 진행, where a click on other buttons and tiles leaves focus where it was. While focus is in the grid, it follows the selection, also when 다음 장 moves it.
- A live 장 has `data-state="live"`, a 장 whose media file is missing has `data-state="warning"`, and one with both has `data-state="live warning"`.
- Write the `aria-label` in this order: number, 이름표, first line. "2 프리코러스, 저 천사여 찬송하세".
- Moving the size slider changes only the column count, and the lyric text follows the width.

## Writing

- Write only the number and the 이름표 name in the band. Don't add text such as "출력 중" (live) or "선택됨" (selected). The rings show state.
- 이름표 names are short nouns: "1절", "프리코러스", "후렴", "브리지".
- Missing file tooltip: "파일을 찾을 수 없습니다: D:\예배 미디어\광고\11월 1일 광고.png"

## Implementation notes

- `<SlideThumbnail number={2} label="프리코러스" labelColor="green" text={'저 천사여 찬송하세\n찬송 성부 성자 성령'} media={src} missingFile={path} live selected />`
- `<ThumbnailGrid label="장" columns={4} workspace="show" selected={index} onSelect={…} onOutput={…}>…</ThumbnailGrid>` → `<div class="ll-thumb-grid" style="--ll-cols: 4">`. With `workspace="prep"`, a click selects, and there is no `onOutput`.
- Classes: `ll-thumb`, `ll-thumb__canvas`, `ll-thumb__text`, `ll-thumb__media`, `ll-thumb__missing`, `ll-thumb__band`, `ll-thumb__num`, `ll-thumb__label`, `ll-thumb-grid`.
- Attributes: `data-color="teal|green|yellow|orange|rose|violet|slate|gray"` (none means no 이름표. `42-labelchip.css` maps the colors), `aria-selected`, `data-state`.
- `.is-hover` and `.is-focus` fix a state in the preview.

## Changes from the drafts

- ShowH, PrepService, Problems: size slider 1–5 (6–2 columns) → 2–8 columns. Lyrics `48 / column count`px → canvas width × 0.044. No thumbnail hover → 1px `line-control`.
- Compact: band 22px, 11px → 24px, 12px (`band`), grid gap 12/10 → 16/12, panel padding 12 → 14, lyrics fixed 11px → width × 0.044.
- Reflow 장 panel: grid gap 14/12 → 16/12, lyrics fixed 11px → width × 0.044.
