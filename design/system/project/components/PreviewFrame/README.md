# PreviewFrame

The body of the preview panel. It shows one of the three output screens (본 화면 (main screen), 무대 화면 (stage screen), 방송 자막 (broadcast captions)) large, and the other two scaled down small.

## Where to use

- The preview panel at the top of the right column in the 진행 (Show) workspace (ShowH, Compact, Problems).
- Only the large frame (`ll-monitor__frame`) of the preview panel in the 준비 (Prep) workspace (PrepService, Reflow). The 준비 workspace switches screens with the segmented control in the header, so it has no row of small previews. Its name row shows the 이름표 (label) color swatch (`ll-label-swatch` from LabelChip), the 이름표 name, the position ("5 / 9"), and the Look name.

## Where not to use

- Slide thumbnails: use SlideThumbnail.
- The large editing canvases of 화면 설정 (Screen settings), Look editing, and stage layout editing.
- Don't use the class `ll-preview`. It belongs to the design system preview tool. This component is `ll-monitor`.

## Anatomy

- Outer `ll-monitor`: stacks the large preview and the row of small previews vertically, gap `space-10`. The panel body gives the `panel-inset` (14) padding.
- Screen frame `ll-monitor__frame`: 16:9, corner radius `radius-md`, background `output-black`, border `0 0 0 1px line`. 방송 자막 uses `chroma` (`ll-monitor__frame--chroma`), the same as the capture window background.
- Screen content `ll-monitor__screen`: the slot where the same renderer as the output window goes, scaled to the frame width (canvas, video, and so on). Look decides the font sizes and colors inside it, and it doesn't use UI tokens. The frame has `container-type: inline-size`, so you can match proportions with `cqw` when you draw it in HTML.
- Large preview name row `ll-monitor__caption`: `space-10` below the frame. Screen name `label-strong` (12/16/600) `text`, target `label` `text-3` (with a 14px `monitor` icon in front, gap `space-4`), and the Look name at the right end in `label` `text-3`. Gap between items `space-8`. If the target is NDI, write only the text, without the icon.
- Small preview row `ll-monitor__smalls`: a two-cell grid, gap `space-10`. Each cell `ll-monitor__small` is a button, with a name row `space-6` below the frame (`caption` 11/14, name `text-2`, target `text-3`, gap `space-6`). Don't write the Look name. A small frame is at most `size-preview-small-max` (160) wide, so a right column widened by the user leaves the height to the large preview.
- Narrow window (`ll-monitor--compact`): the small previews become rows. Frame width 64px (height 36), gap between frame and text `space-8`, name and target on two lines (gap `space-2`).
- If the height isn't enough to keep the 진행 도구 (show tools) at 240, the preview panel shrinks. The large frame then keeps 16:9, gets smaller to fit the height, and is centered (see Layout).

## Sizes and variants

| Name | Height | Text | Where to use |
|---|---|---|---|
| Default | Large frame = inner column width × 9/16, small frame = min((width − 10) / 2, 160) × 9/16 | Name row `label-strong`/`label`, small cells `caption` | Regular and wide windows (right column 480, 560) |
| Narrow window `--compact` | Large frame the same, small cells 36 (frame 64×36) | Same, small cells on two lines | Narrow window (right column 360) |

## States

| State | Background | Text and icon | Other |
|---|---|---|---|
| Output on (default) | Screen content | Name `text` (small cells `text-2`), target and Look `text-3` | Frame 1px `line` |
| Small cell hover | Same | Same | Frame 1px `line-control` |
| Small cell focus | Same | Same | `outline: 2px solid accent` around the cell, offset 3px |
| Output off | Screen content unchanged | Name `text-off` | Frame 1px `line-strong`. title "본 화면 출력이 꺼져 있습니다" |
| Monitor missing | Screen content unchanged | Target `warning`, the leading icon becomes the `warning` icon | Frame 1px `warning`. title "모니터 3 연결 끊김, 창으로 표시 중" |

Output off: in the draft ShowH, turning off the output button in the toolbar changes only the button text color and dot, and the preview stays the same. Even while output is off, the operator must see what goes out when it is turned back on, so don't dim the picture. Change only the name to `text-off` and only the frame to the one step lighter `line-strong`. The toolbar output button is the main signal for off, and the preview only supports it.

Keep the missing monitor border as it is on hover. A cell with output off shows hover.

## Behavior

- A click on a small cell brings that screen to the large preview, and the screen that was large moves down to the small row. The order of the small row is always 본 화면 → 무대 화면 → 방송 자막, without the large one.
- The large preview can't be clicked.
- A small cell is a `button` with `aria-label="무대 화면 크게 보기"`. If it has a state, add the reason: "무대 화면 크게 보기, 모니터 3 연결 끊김".
- Put the state as `data-state="off"` or `data-state="warning"` on the large preview (`ll-monitor__main`) or on a small cell.
- Focus order: small cells from left to right.
- The output screen side has no motion, so swap places at once, without a transition.

## Writing

- Write only the screen name, the target, and the Look name in the name row. Don't add descriptions such as "출력 중" (live), "꺼짐" (off), or "창으로 표시 중" (showing in a window) as text. Give them in the title tooltip.
- Screen names are "본 화면", "무대 화면", "방송 자막". Targets are "모니터 2", "NDI". Look names are exactly as the user named them ("기본", "현재와 다음", "하단 자막").

## Implementation notes

- `<PreviewFrame screens={[main, stage, broadcast]} big={bigId} compact={sizeClass === 'narrow'} onBigChange={id => …} renderScreen={screen => …} />`; `renderScreen` draws a screen's output (the same renderer as its output window) scaled to the frame. Each screen's content stays mounted across swaps: the app keeps one cell per screen in the same place of the tree and lets the grid put the large one on top, and a small cell has its button laid over it instead of around it. A swap never rebuilds a renderer or restarts a video.
- Each screen: `{id, name: '무대 화면', target: {kind: 'display', label: '모니터 3'}, look: '현재와 다음', status, chroma: false}`, where `status` is `{kind: 'on'}`, `{kind: 'off'}`, or `{kind: 'warning', reason: '모니터 3 연결 끊김', detail: '창으로 표시 중'}`. The tooltip says `reason, detail` (or "본 화면 출력이 꺼져 있습니다" when off), and a small cell's name adds the reason: "무대 화면 크게 보기, 모니터 3 연결 끊김".
- Classes: `ll-monitor`, `ll-monitor--compact`, `ll-monitor__main`, `ll-monitor__frame`, `ll-monitor__frame--chroma`, `ll-monitor__screen`, `ll-monitor__caption`, `ll-monitor__name`, `ll-monitor__target`, `ll-monitor__look`, `ll-monitor__smalls`, `ll-monitor__small`.
- `.is-hover` and `.is-focus` fix a state in the preview.

## Changes from the drafts

- ShowH, Compact, Problems, PrepService, Reflow: screen frame corner radius 3px → `radius-md` 4px (matches thumbnails and media tiles).
- ShowH, Problems: small cell name #cfcfcf → `text-2`. Small cell hover: ring around the whole cell → 1px `line-control` on the frame only.
- Compact: frame in the small preview row 80px → 64px, panel padding 12 → 14, gap 8 → 10. Add the `monitor` icon in front of the target in the large name row.
- Problems: small cell name row "⚠ 창으로 표시 중" → "⚠ 모니터 3" (target in `warning`) + title tooltip.
