# ClearButton

The clear row removes a layer or all layers from the output screens.

## Where to use

- The 지우기 row under the output preview, in the right column of the 진행 workspace (regular and narrow windows).
- Places that use the same right column as the 진행 workspace, such as the Bible screen.

## Where not to use

- Clearing the contents of a list or a field (emptying a text field, deleting an item): Button, IconButton.
- Taking items down one at a time from the 표시 중 (showing) list in 진행 도구 (show tools): IconButton (지우기).
- Don't add a button that clears a chosen set of layers at once (like Clear Groups in ProPresenter) in v1. Build such combinations as 지우기 actions in a macro, run with its key or from 빠른 실행.

## Anatomy

- Row: background `bg-panel`, corner radius `radius-lg`, padding `space-8` by `panel-inset`, so its buttons begin and end on the lines of the panels around it. The row is a panel of its own and has no header.
- Order: 대기 화면, the six clears (모두, 가사, 미디어, 그래픽, 오디오, 메시지), 되돌리기. The clears are one group with `space-4` between them; `space-12` sets 대기 화면 and 되돌리기 apart. There are no dividers.
- Button: height `size-clear-button` (52px), corner radius `radius-md`, background `bg-control`, name `label` under an icon `size-icon-18`, gap `space-4`. The clears are equally wide; 대기 화면 and 되돌리기 are as wide as their names.
- The group gap stays at every width, so the icon-only row keeps the distinction.
- Narrow window: row padding `space-6`, button height 40, icon `size-icon-16` only, no name.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| 지우기 | `size-clear-button` 52 | `label` | Regular window (column `col-right` 480) |
| Compact | 40 | No name (icon 16) | Narrow window (column `col-right-compact` 360) |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Something to clear | `bg-control` | `text` | That layer is on the screens now |
| Hover, pressed | `bg-control-hover` | `text` | 100ms ease-out |
| Nothing to clear | `bg-control` | Icon `text-off`, name `text-3` | No hover, a click does nothing |
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
  <ClearButton name="대기 화면" icon="slides" label="대기 화면으로" command="item.stop" active={on} onPress={stop} />
  <ClearGroup>
    <ClearButton name="가사" icon="text" label="가사 지우기" command="clear.slide" active={on.slide} onPress={() => clear('slide')} />
    …
  </ClearGroup>
  <ClearButton name="되돌리기" icon="undo" label="되돌리기" command="clear.undo" active={canUndo} onPress={undo} />
</ClearRow>
```

- The row knows no layer: the caller gives each button its name, its icon, what a press does, and its command. The tooltip shows the current key of the command. With `active={false}`, the button draws `data-state="off"` and `aria-disabled`.

```html
<button class="ll-clear" aria-label="가사 지우기" aria-keyshortcuts="F2">
  <span class="ll-i ll-i-text" aria-hidden="true"></span><span class="ll-clear__label">가사</span>
</button>
```

## Changes from the drafts

- ShowH: tooltip "가사 지우기 F2" written as one run of text → shortcut set `space-8` apart in `text-3`.
