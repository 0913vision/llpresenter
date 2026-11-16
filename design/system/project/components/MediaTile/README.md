# MediaTile

Media tiles show videos and images in the media grid.

## Where to use

- The playlist grid of the media view (Media): a click selects the media and shows it in the property panel on the right.

## Where not to use

- 슬라이드 (slide): use SlideThumbnail (an image placed in a 슬라이드 is still a 슬라이드, so it is a thumbnail).
- The small 36×20 picture inside the background picker dropdown in a panel header: use Select's `ll-select__media`.
- Notice and prop tiles in the 진행 도구 (show tools).

## Anatomy

- Tile `ll-media`: a button, with the name `space-8` below the picture frame.
- Picture frame `ll-media__frame`: 16:9, corner radius `radius-md`, background `bg-well` (before the picture loads). The picture `ll-media__img` uses `object-fit: cover`.
- Duration `ll-media__dur`: `space-6` in from the bottom right of the picture. Height `size-count` (22), horizontal padding `space-6`, `radius-sm`, background `scrim-strong`, text `caption-strong` (16/22/600) `text`, tabular-nums. For looping playback, a 12px `loop` icon goes in front (gap `space-4`). Don't write a duration for a still image.
- Name `ll-media__name`: `label` (14/20) `text-2`, one line, truncated with an ellipsis.
- Missing file `ll-media__missing`: the frame background becomes hatching (`bg-inset`/`bg-well`, 135°, 6px), with a 24px `filex` icon in `warning` in the center. Hide the picture and the duration.
- Copying `ll-media__busy`: `scrim` over the frame, a percentage in the center (`caption-strong` `text`), and a progress bar `space-6` in from the bottom (StatusMarks' `ll-progress`).
- Grid `ll-media-grid`: the size slider in the panel's bottom row sets the column count (2–8 columns, `--ll-cols`), gap `space-16` vertical, `space-12` horizontal. The outer margin is the panel body's `panel-inset`.
- The shared media bin initially fits tile height automatically: at least five columns, adding columns so the 16:9 picture, `space-8`, 20px name line and both panel insets fit the bounded viewport. Its virtual row stride includes the same 20px name line. Once the operator adjusts the size slider, that explicit column count takes precedence over automatic fitting until the view closes.

## Sizes and variants

| Name | Height | Text | Where to use |
|---|---|---|---|
| Grid tile | width × 9/16 + 8 + 16 | Name `label`, duration `caption-strong` | Media view |
| Video (loop) / video (once) / image | Same | `loop` before the duration / none / no duration | |

## States

| State | Background | Text and icon | Other |
|---|---|---|---|
| Default | Picture | Name `text-2` | |
| Hover | Picture | Name `text-2` | Frame 1px `line-control` |
| Selected | Picture | Name `text` | Frame `ring-selected` |
| Live (current background) | Picture | Name `text` | Frame `ring-live`. Takes priority over selected |
| Focus | Picture | Unchanged | `outline: 2px solid accent` on the frame, offset 4px |
| Missing file | Hatching | `filex` 24 `warning` | If live, also `ring-live`. The path is in the title tooltip |
| Copying | Picture + `scrim` | Percentage `text`, name `text-3` | Progress bar `accent`. Can't be clicked (`aria-disabled`), no hover |

## Behavior

- A click on a missing file tile opens the "다시 연결" (relink) file open dialog. The right-click menu also has "다시 연결". Don't put a button inside the tile.
- A copying tile can't be clicked, and its right-click menu has only "복사 멈추기" (stop copying).
- The grid is `role="listbox"`, and each tile is `role="option"` + `aria-selected`. While a tile has keyboard focus, the arrow keys move between tiles, and Enter acts as a click.
- Shift+F10 or the Menu key opens the context menu. Shift+F10 with Ctrl, Alt or Windows passes through without opening it.
- Modified Enter passes through to shortcuts and does not activate the tile.
- Read-only notice grids move keyboard focus without selecting or outputting tiles. Tab enters once at the last focused tile; arrow keys, Home, and End reach tiles across virtual windows.
- State attributes: `data-state="live"`, `data-state="warning"`, `data-state="busy"` (separate them with spaces when combined).
- The progress bar is `role="progressbar"` + `aria-valuenow`.

## Writing

- The name is the file name without the extension ("따뜻한 빛"). While copying, show the original file name as it is ("부활절 배경.mp4").
- Write the duration as minutes:seconds, such as "0:30", "1:00", "5:00".
- Missing file tooltip: "파일을 찾을 수 없습니다: D:\예배 미디어\배경\따뜻한 빛.mp4". Don't add the text "파일 없음" (missing file) under the tile.

## Implementation notes

- `<MediaTile name="따뜻한 빛" picture={thumb} duration="0:30" loop live selected missingFile={path} copying={62} />`
- `<MediaGrid label="배경 영상" columns={5} selected={index} onSelect={…} onActivate={…} onOutput={…} onMenu={…}>`: a click or Enter calls `onActivate` (select), a double click `onOutput`.
- `MediaGrid` and its windowed host accept `arrowsMove="focus"` for read-only notice tiles. The default remains `"selection"` for the media view.
- Classes: `ll-media-grid`, `ll-media`, `ll-media__frame`, `ll-media__img`, `ll-media__dur`, `ll-media__name`, `ll-media__missing`, `ll-media__busy`.
- The duration chip background is `scrim` (0.6) for now. A 0.72 token has been requested so that the text reads on bright pictures too.

## Changes from the drafts

- Media grid: gap 18/14 → 16/12, name #cfcfcf → `text-2`, duration chip 20px → 18px.
- Duration chip background rgba(0, 0, 0, 0.72) → `scrim` (see the token request).
- Problems missing file tile: hatching #1a1a1a/#151515 → `bg-inset`/`bg-well`, the 20px "다시 연결" button inside the tile and the "파일 없음" text next to the name → removed (a click relinks, and the tooltip gives the reason).
- Media copying tile: picture opacity 0.35 + overlay 0.45 + "복사 중" text → `scrim` + percentage only, 3px #2b2b2b bar at the bottom edge → `ll-progress` 4px at an inset of 6.
