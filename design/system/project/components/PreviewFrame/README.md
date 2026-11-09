# PreviewFrame

The live monitoring panel shows one output screen large, at the full width of
the panel, and a row of small tiles for the other screens only. The screen shown
large never appears as a tile: there is no marker tile and no second picture of
it. A click on a tile makes that screen the large one. There is one rendered
picture per screen.

This replaces alternative B of the M2 comparison, which kept a marker tile for
the large screen (theme-289, after the user asked why one preview is large and
another small).

## Where to use

- The preview panel at the top of the right column in the 진행 workspace.
- The same `PreviewPanel` wraps it in 준비, including its title and screen
  picker. Only the rendered content and caption content differ.

Use SlideThumbnail for slide thumbnails. Screen settings and 테마 editing use
their editing canvases instead.

## Anatomy

- The panel body supplies `panel-inset` padding. The large picture fills the
  body's width inside it, 16:9, centered when it is shorter than the width.
- Below the large picture is one row of tiles, one for each other screen, in
  the fixed order 청중 화면, 무대 화면, 방송 화면 without the large one. Vertical
  gap is `space-12` in both workspaces at every window size; horizontal gap is
  `space-8`.
- Pictures keep `aspect-output` (16:9), with `output-black` background and a
  1px `line` frame. 방송 화면 uses `chroma`, matching its capture background.
  The upper corners use `radius-sm`; the caption joins directly below.
- The picture has `container-type: inline-size`. Output text scales with the
  renderer and does not use UI type tokens.
- The large caption is `size-control-md` high, with `bg-sunken` background,
  `space-8` horizontal padding, and lower `radius-sm` corners. The name uses
  `type-label-strong` and `text`; the target uses `type-label` and `text-3`
  at the right. A display target has a 14px monitor icon, gap `space-4`.
  NDI has text only. A screen with no target, as in 준비, shows its name only;
  an owner can also replace the caption content.
- A tile is at most `size-preview-small-max` wide. It has the screen's picture
  and a centered name, with no target text. Its caption is `size-control-sm`
  high, with `bg-sunken`, `type-caption`, `text-2`, and lower `radius-sm`
  corners.
- A picture-specific indicator follows the caption name in either size. A
  missing background video uses a 14px pause icon in `warning`, with its reason
  in a shared tooltip on hover or keyboard focus. It does not change the
  screen's output status or monitoring selection.
- The narrow window form keeps the tiles in one horizontal row. It does not
  turn them into a vertical list.

## Layout

For an inner width `w` and `n` other screens, a tile picture is
`min((w - (n - 1) * space-8) / n, size-preview-small-max)` wide, with 16:9
height.

The column decides how much the panel gets. When it is too short for the large
picture with its caption and the tile row, the tile row goes first: the panel
header shows a screen picker (a segmented control with the screen names) in
its place, and the large picture keeps the full width. Only when the column is
still too short does the large picture shrink: its frame fits the available
width and height at 16:9 and stays horizontally centered. In 진행 the 진행 도구
panel keeps its 240 px and the column does not scroll, at 1920 x 1080 and at
1280 x 720. In 준비 the panel gives the height it does not use back to the
panels below it: the row is as tall as the picture, its caption, and the tile
row, or the picture and its caption alone while the picker is in the header.

## States

| State | Picture | Name and target | Tile |
| --- | --- | --- | --- |
| Output on | Unchanged, 1px `line` | Normal colors | Normal |
| Hover | Unchanged | Unchanged | `ring-hover` |
| Keyboard focus | Unchanged | Unchanged | 2px `accent` outline, offset `space-focus-preview-cell` |
| Output off | Unchanged, 1px `line-strong` | Name `text-off` | Normal |
| Monitor missing | Unchanged, 1px `warning` | Large target and leading warning icon use `warning` | Normal |

Output off never dims or stops the picture. The operator can still monitor
what will appear when output is enabled. Give reasons in tooltips, for example
"청중 화면 출력이 꺼져 있습니다" or "모니터 3 연결 끊김, 창으로 표시 중".

## Behavior and accessibility

- Clicking a tile or a picker segment selects that screen for the large monitoring picture only.
  It never enables output, sends a live command, or changes live layers.
- The large picture is not interactive.
- There is one button for each tile, in fixed left-to-right focus order. The
  large picture has no button. Each button has an accessible name such as
  "무대 화면 크게 보기". Append a short state reason when applicable, such as
  "무대 화면 크게 보기, 모니터 3 연결 끊김".
- Native button Enter and Space activation select a screen. Keep focus on the
  activated slot.
- Modified Enter and Space pass through without selecting a screen.
- Swap immediately, with no picture transition.
- Keep live captions to screen names and destinations. Local item captions may
  show the selected slide's label, position and theme in the same fixed row.

## Implementation

`PreviewFrame` takes `screens`, `big`, `compact`, `tiles`, `caption`,
`onBigChange`, and `renderScreen`. A screen provides its ID, name, an optional
display or NDI target, status, chroma flag, and an optional indicator icon and
tooltip. `tiles` turns the tile row off; `caption` replaces the content of the
large caption.

Each screen keeps one keyed picture cell. CSS moves only the existing cell
between the large row and its tile column; a tile has a button laid over it.
Never duplicate, reparent, or recreate a renderer to change monitoring
selection while the tile row shows. While the tile row is off, only the large
screen's picture is mounted. Every video and its renderer parent must retain
identity and playback position, including when the window changes size.

`usePreviewRoom` tells a panel whether the tile row fits: it compares what the
picture, its caption, the tile row, and the rows around them need with what the
column leaves the panel after the minimum heights of its neighbors. The 진행
and 준비 both use `PreviewPanel`, which owns its header and body together.
They share the default workspace height budget, including the space reserved
below the preview. A saved splitter height still takes precedence.

The shell adapter derives status from the live outputs map, selects through
`showLarge`, and uses `ScreenPreview` for each picture. `ScreenPreview`
continues subscribing to live layers directly, without React rendering for
each live push. The shared frame owns decoration, sizing, captions, tiles,
and tooltips.
