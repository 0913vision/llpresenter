# ClearButton

The clear row removes a layer or all layers from the output screens.

## Where to use

- The 지우기 row under the output preview, in the right column of the 진행 workspace (regular and narrow windows).
- Places that use the same right column as the 진행 workspace, such as the Bible screen.

## Where not to use

- Clearing the contents of a list or a field (emptying a text field, deleting an item): Button, IconButton.
- Taking items down one at a time from the 표시 중 (showing) list in 진행 도구 (show tools): IconButton (지우기).
- Don't add a button that clears a chosen set of layers at once (like Clear Groups in ProPresenter) in v1. Build such combinations as 지우기 actions in a macro, and if needed, attach that macro to the 시작할 때 (on start) macro of a 예배 순서 (service order) item.

## Anatomy

- Row: background `bg-panel`, corner radius `radius-lg`, padding `space-8`, gap between buttons `space-4`. The row is a panel of its own and has no header.
- Order: standby, then all, slide, media, prop, audio, and message.
- Button: height `size-clear-button` (52px), corner radius `radius-md`, name `caption-strong` (16/22/600) under an icon `size-icon-18`, gap `space-4`. Buttons share the row width (flex 1). 모두 is 1.4 times as wide.
- 대기 화면: flex 1.4 with at least its label's width. In the narrow row it returns to flex 1 with no minimum width. The `space-12` group gap stays at every width, so the icon-only row keeps the distinction.
- Narrow window: row padding `space-6`, button height 40, icon `size-icon-16` only, no name. All stays 1.4 times as wide.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| 지우기 | `size-clear-button` 52 | `caption-strong` | Regular window (column `col-right` 480) |
| 대기 화면 | 52, 1.4 times as wide, at least its label | `caption-strong` | First place, before the group gap |
| 모두 | 52, 1.4 times as wide | `caption-strong` | First of the six clears |
| Compact | 40 | No name (icon 16) | Narrow window (column `col-right-compact` 360) |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Something to clear | `bg-control` | `text` | That layer is on the screens now |
| Hover, pressed | `bg-control-hover` | `text` | 100ms ease-out |
| Nothing to clear | `bg-control-off` | `text-off` | No hover, a click does nothing |
| Focus | Unchanged | Unchanged | `outline: 2px solid accent`, offset 1px, on keyboard focus only |

Don't use red because a layer is live. Show only whether there is something to clear, with brightness.

## Behavior

- 대기 화면 runs 항목 끄기: remove the live item's slide, background, and overlays, leaving graphics, messages, and audio running. The button stays bright and pressed when that item can be restored; pressing it again restores the item. With no live or restorable item it is off. Its command keeps the name 항목 끄기 in menus and the shortcut list, without a default shortcut.
- Unmodified Enter and Space press a focused clear button. Modified activation keys pass to their owner without clearing a layer.
- A click clears that layer at once. Don't show a confirmation dialog.
- 모두 clears every layer that has something to clear at once. While even one layer is left, 모두 is in the something-to-clear state.
- Give a button with nothing to clear `aria-disabled="true"` and `data-state="off"` instead of `disabled`. It keeps its focus and tooltip, and its shortcut does nothing.
- Give each button `aria-label="가사 지우기"` and `aria-keyshortcuts="F2"`. The row is `role="group"` (name "지우기").

## Writing

- Write tooltips and accessible names as the layer name followed by clear.
- The item toggle keeps the visible name 대기 화면 in both states. Its tooltip and `aria-label` are 대기 화면으로, or 항목 되돌리기 while pressed.
- Don't show a notification after a clear. The button changing to nothing to clear is enough.

## Implementation notes

```jsx
<ClearRow compact={narrow}>
  <ClearButton layer="all" active={anyOn} onClear={clearAll} />
  <ClearButton layer="slide" active={on.slide} onClear={() => clear('slide')} />
  …
</ClearRow>
```

- `layer` (`all`, `slide`, `media`, `prop`, `audio`, `message`, the shared `ClearTarget`) sets the icon, the name, and the default shortcut (see the lists above). Pass `shortcut` with the current key when the 단축키 page changed it. With `active={false}`, the button draws `data-state="off"` and `aria-disabled`.

```html
<button class="ll-clear" aria-label="가사 지우기" aria-keyshortcuts="F2">
  <span class="ll-i ll-i-text" aria-hidden="true"></span><span class="ll-clear__label">가사</span>
</button>
```

## Changes from the drafts

- ShowH: tooltip "가사 지우기 F2" written as one run of text → shortcut set `space-8` apart in `text-3`.
