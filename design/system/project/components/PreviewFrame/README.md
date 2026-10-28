# PreviewFrame

The live monitoring panel shows one output screen large above a fixed row of
본 화면, 무대 화면, and 방송 자막. The selected slot shows an upward arrow and
a check instead of a second picture. There are three rendered pictures total.

This is alternative B chosen in
[the M2 comparison](../../../../drafts/m2-check1/README.md). The comparison
images remain the record of the choice; this specification describes the
implemented component.

## Where to use

- The preview panel at the top of the right column in the 진행 workspace.
- The large frame can also be used in 준비. Its segmented control and
  이름표 caption are separate from this three-slot monitoring selector.

Use SlideThumbnail for slide thumbnails. Screen settings, Look editing, and
stage layout editing use their editing canvases instead.

## Anatomy

- The panel body supplies `panel-inset` padding.
- The large picture spans the row above the three fixed screen slots.
  Vertical gap is `space-12`, or `space-8` in the narrow window form.
  Horizontal slot gap is `space-8`.
- Pictures keep `aspect-output` (16:9), with `output-black` background and a
  1px `line` frame. 방송 자막 uses `chroma`, matching its capture background.
  The upper corners use `radius-sm`; the caption joins directly below.
- The picture has `container-type: inline-size`. Output text scales with the
  renderer and does not use UI type tokens.
- The large caption is `size-control-md` high, with `bg-sunken` background,
  `space-8` horizontal padding, and lower `radius-sm` corners. The name uses
  `type-label-strong` and `text`; the target uses `type-label` and `text-3`
  at the right. A display target has a 14px monitor icon, gap `space-4`.
  NDI has text only. An actual Look name, if supplied, follows the target.
- All three small slots stay in the order 본 화면, 무대 화면, 방송 자막.
  Each is at most `size-preview-small-max` wide. An unselected slot has the
  screen's picture and a centered name, with no target or Look text.
- The selected slot has a `bg-app` picture-sized area with an 18px upward
  arrow in `accent`. It has no renderer or copied picture. Its caption has a
  12px check, `space-4` gap, and the screen name in `accent`. The whole slot
  has `ring-selected`. Blue marks monitoring selection.
- Every small caption is `size-control-sm` high, with `bg-sunken`,
  `type-caption`, and lower `radius-sm` corners. Unselected names use
  `text-2`.
- The narrow window form keeps the same three horizontal slots and names.
  It does not turn them into a vertical list.

## Layout

For an inner width `w`, a small picture is
`min((w - 2 * space-8) / 3, size-preview-small-max)` wide, with 16:9 height.
The selected marker has the same dimensions as either small picture.

The large picture normally fills the inner width. When panel height is
limited, its surface can shrink. The frame fits the available width and height
at 16:9 and stays horizontally centered. The caption and fixed slot row remain
available below it.

## States

| State | Picture | Name and target | Slot |
| --- | --- | --- | --- |
| Output on | Unchanged, 1px `line` | Normal colors | Normal |
| Hover | Unchanged | Unchanged | `ring-hover`; selected keeps `ring-selected` |
| Keyboard focus | Unchanged | Unchanged | 2px `accent` outline, offset `space-focus-preview-cell` |
| Output off | Unchanged, 1px `line-strong` | Name `text-off` | Selection stays blue |
| Monitor missing | Unchanged, 1px `warning` | Large target and leading warning icon use `warning` | Selection stays blue |

Output off never dims or stops the picture. The operator can still monitor
what will appear when output is enabled. Give reasons in tooltips, for example
"본 화면 출력이 꺼져 있습니다" or "모니터 3 연결 끊김, 창으로 표시 중".

## Behavior and accessibility

- Clicking a slot selects that screen for the large monitoring picture only.
  It never enables output, sends a live command, or changes live layers.
- Clicking the selected slot keeps the same selection.
- The large picture is not interactive.
- There is always one button per screen, in fixed left-to-right focus order.
  Each has `aria-pressed` for selection and an accessible name such as
  "무대 화면 크게 보기". Append a short state reason when applicable, such as
  "무대 화면 크게 보기, 모니터 3 연결 끊김".
- Native button Enter and Space activation select a screen. Keep focus on the
  activated slot.
- Modified Enter and Space pass through without selecting a screen.
- Swap immediately, with no picture transition.
- Do not add state explanations or placeholder Look names to the captions.

## Implementation

`PreviewFrame` takes `screens`, `big`, `compact`, `onBigChange`, and
`renderScreen`. A screen provides its ID, name, display or NDI target, optional
actual Look name, status, and chroma flag.

Each screen keeps one keyed picture cell and one fixed slot button. Both are
persistent grid siblings. CSS moves only the existing picture cell between
the large row and its original small column. The selected button shows the
marker. Never duplicate, reparent, hide/unmount, or recreate a renderer to
change monitoring selection. Every video and its renderer parent must retain
identity and playback position, including when the window changes size.

The shell adapter derives status from the live outputs map, selects through
`showLarge`, and uses `ScreenPreview` for each picture. `ScreenPreview`
continues subscribing to live layers directly, without React rendering for
each live push. The shared frame owns decoration, sizing, captions, slots,
and tooltips.
