# Slider

A horizontal slider that sets a value by dragging. Use it for the thumbnail size under the 슬라이드 (slide) grid and for the volume in 진행 도구 (show tools) and the media properties.

## Where to use

- The row under the grid (32px) in the 진행 (Show) workspace, the 준비 (Prep) workspace, and media: continuous thumbnail size from 50% to 200%, default 100%, with an adjacent % field (`ThumbnailSizeControl`)
- 진행 도구 audio tab: volume
- Sound group in the media properties: volume

## Where not to use

- Values that need an exact number (font size, line spacing, padding, edge margin): use the number field of `TextField`.
- Playback position (time bar): the playback bar has its own spec. Don't stretch this slider for it.

## Anatomy

- Redraw the native `input[type="range"]` with `appearance: none`.
- Hit height 16px, track 4px `radius-full`.
- Filled part `text`, remaining part `line-strong`. This carries over `accent-color: #ececec` from the drafts as is. Don't use blue (`accent`). A slider shows size and amount, not state, so don't mix it with the blue that is reserved for selection and focus.
- Knob: a 12×12 circle in `text`.
- Width: 120px in a regular window, 96px in a narrow window and for the 진행 도구 volume (`ll-slider--compact`), fills the control cell in a property field (`ll-slider--block`).
- Leading icon row `ll-slider-row`: icon 14px `text-3`, 8px from the slider. `grid` for thumbnail size, `audio` for volume.
- Pass the filled ratio in the CSS variable `--ll-value` (0%~100%). Set it again from `(value − min) / (max − min)` every time the value changes.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Default | 16 (track 4) | - | Thumbnail size in the row under the grid, width 120 |
| compact | 16 | - | Thumbnail size in a narrow window, 진행 도구 volume, width 96 |
| block | 16 | - | Volume inside a property field, as wide as the cell |

## States

| State | Track | Knob | Other |
| --- | --- | --- | --- |
| Default | Filled `text`, remaining `line-strong` | `text` | |
| Hover | No change | No change | |
| Dragging | No change | No change | The value applies at once while dragging |
| Focus | Same | 1px gap + 2px `accent` ring | Draw the ring only on the knob. The gap color is `--ll-slider-cut` (default `bg-panel`) |
| Disabled | Filled `text-off`, remaining `line-strong` | `text-off` | The leading icon is `text-off` too. Reason in a tooltip (for example, volume while sound is off) |

## Behavior

- Slide size uses `ThumbnailSizeControl`: continuous pointer values from 50% to 200%, default 100%, with a synchronized % field. The slider uses `step="any"`; arrows change 1 percentage point, Shift arrows 10. The field displays the nearest whole percent while dragging. Releasing or cancelling the pointer commits the nearest whole percent. The field commits on Enter or blur, clamps and rounds to 1%, and Escape cancels its typed change. These spec-13 defaults are our design, not ProPresenter's documented numeric range.
- `thumbnailWidth` computes the baseline from usable grid width, the default 3/4/6 columns, and the horizontal token gap, then scales and caps at the usable width. Pass it as `ThumbnailGrid.tileWidth`; tiles wrap at that fixed width and do not stretch to fill a row. Keyboard row movement reads the actual wrapped columns.
- In 진행, pass `workspace="show"` to every Slider, including volume. A completed or cancelled pointer interaction restores the focus held before dragging when the slider still has focus. Capture loss before `pointerup` or `pointercancel` does not finish the gesture. A focus move made during the drag, such as Tab to another control, stays in effect. This also works without an `onCommit` callback. Native pointer dragging stays enabled; a release outside the input finishes once. Losing window focus commits the value without restoring focus. Temporary pointer listeners are removed at completion, a workspace or disabled-state change, and unmount. Tab focuses the slider for its normal keyboard controls; 준비 focuses it normally on a click. `ThumbnailSizeControl` forwards its workspace to Slider, and its % input remains editable and can take focus. The caller owns the size class, live preview state, measured grid width/gap, and delayed persistence; `onChange` carries continuous previews and `onCommit` carries the completed whole percentage.
- A click anywhere on the track moves the knob to that point, and the user can keep dragging from there.
- Keyboard: left/right and up/down arrows move one step, PageUp/PageDown move 10%, Home/End go to the start and the end. For thumbnail size, one step is 1.
- While the user drags, the grid changes at once for thumbnail size, and the sound changes at once for volume.
- aria: the name isn't visible, so give an `aria-label` ("썸네일 크기", "음량"). For volume, give `aria-valuetext="70%"`.

## Writing

- Slide size shows its % input next to the slider (M2 check 1 row 9); name it "슬라이드 크기". Other sliders keep the value in their tooltip or accessible value and add no adjacent description. Convey the name with the leading icon, `aria-label`, and a tooltip.

## Implementation notes

- `<ThumbnailSizeControl value={scalePercent} onChange={setScalePercent} onCommit={saveScalePercent} workspace="show" />`
- `<Slider width="compact" workspace="show" min={0} max={100} value={70} label="음량" icon="audio" onChange={setVolume} />`
- Markup: `span.ll-slider-row > span.ll-i + input[type=range].ll-slider[.ll-slider--compact|--block][style="--ll-value: 25%"]`.
- If the gap color of the focus ring differs from the background (on a dialog), change `--ll-slider-cut` to `var(--bg-dialog)`.
- Classes: `ll-slider`, `ll-slider--compact`, `ll-slider--block`, `ll-slider-row`.

## Changes from the drafts

- Thumbnail size in ShowH, PrepService, Reflow, NewService, AddSongs, AddSongsQuick, ServiceImport, ServiceSwitch, ImportEdit, ImportSave, Problems, and Media, thumbnail size in Compact, volume in Overlays and Media: browser default range (`accent-color`) → `ll-slider` (track 4, knob 12). Widths stay 120 and 96.
- Row under the grid in ShowH and others: gap between the `grid` icon and the slider 10 → 8.
- Overlays volume: `audio` icon 16 → 14. Media volume: icon 16 → 14, gap 10 → 8, when disabled `accent-color: #6e6e6e` → fill and knob `text-off`.
