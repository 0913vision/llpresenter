# ClearButton

The 지우기 (clear) row in the right column of the 진행 (Show) workspace. It takes one layer (lyrics, media, props, audio, messages) or all layers off the output screens at once. An optional button undoes the last 지우기; its visibility setting is off by default.

## Where to use

- The 지우기 row under the output preview, in the right column of the 진행 workspace (regular and narrow windows).
- Places that use the same right column as the 진행 workspace, such as the Bible screen.

## Where not to use

- Clearing the contents of a list or a field (emptying a text field, deleting an item): Button, IconButton.
- Taking items down one at a time from the 표시 중 (showing) list in 진행 도구 (show tools): IconButton (지우기).
- Keep the item toggle 대기 화면 before the six clears and 되돌리기 (undo) after the divider. Don't mix other commands into the row.
- Don't add a button that clears a chosen set of layers at once (like Clear Groups in ProPresenter) in v1. Build such combinations as 지우기 actions in a macro, and if needed, attach that macro to the 시작할 때 (on start) macro of a 예배 순서 (service order) item.

## Anatomy

- Row: background `bg-panel`, corner radius `radius-lg`, padding `space-8`, gap between buttons `space-4`. The row is a panel of its own and has no header.
- Order: 대기 화면 (standby), then 모두 (all), 가사 (lyrics), 미디어 (media), 그래픽 (props), 오디오 (audio), 메시지 (message). Separate 대기 화면 from the six clears by `space-12`: the row's `space-4` gap plus `space-8` after that button. Then its divider and 되돌리기, always: the row never changes its buttons' size or place (principle 6), and 되돌리기 is in its off state (like a button with nothing to clear) until a clear can be brought back. Its label never wraps.
- Button: height `size-clear-button` (52px), corner radius `radius-md`, name `caption-strong` (16/22/600) under an icon `size-icon-18`, gap `space-4`. Buttons share the row width (flex 1). 모두 is 1.4 times as wide.
- 대기 화면: flex 1.4 with at least its label's width. In the narrow row it returns to flex 1 with no minimum width. The `space-12` group gap stays at every width, so the icon-only row keeps the distinction.
- Icons: 대기 화면 `slides`, 모두 `layers`, 가사 `text`, 미디어 `image`, 그래픽 `prop`, 오디오 `audio`, 메시지 `msg`, 되돌리기 `undo`.
- Divider: 1×32, `line`, horizontal margin `space-4` (8 together with the gap between buttons).
- 되돌리기: background `bg-toolbar-hover`. It sits one step lower than the 지우기 buttons to show that it does a different job.
- Narrow window: row padding `space-6`, button height 40, icon `size-icon-16` only, no name. Divider 1×24, horizontal margin `space-2`. 모두 stays 1.4 times as wide, so its width sets it apart.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| 지우기 | `size-clear-button` 52 | `caption-strong` | Regular window (column `col-right` 480) |
| 대기 화면 | 52, 1.4 times as wide, at least its label | `caption-strong` | First place, before the group gap |
| 모두 | 52, 1.4 times as wide | `caption-strong` | First of the six clears |
| 되돌리기 | 52 | `caption-strong` | Last place, after the divider |
| Compact | 40 | No name (icon 16) | Narrow window (column `col-right-compact` 360) |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Something to clear | `bg-control` | `text` | That layer is on the screens now |
| Hover, pressed | `bg-control-hover` | `text` | 100ms ease-out |
| Nothing to clear | `bg-control-off` | `text-off` | No hover, a click does nothing |
| Undo available | `bg-toolbar-hover` | `text` | Hover is `bg-control-hover` |
| Nothing to undo | `bg-toolbar-hover` | `text-off` | No hover |
| Focus | Unchanged | Unchanged | `outline: 2px solid accent`, offset 1px, on keyboard focus only |

Don't use red because a layer is live. Show only whether there is something to clear, with brightness.

## Behavior

- 대기 화면 runs 항목 끄기: remove the live item's slide, background, and overlays, leaving graphics, messages, and audio running. The button stays bright and pressed when that item can be restored; pressing it again restores the item. With no live or restorable item it is off. Its command keeps the name 항목 끄기 in menus and the shortcut list, without a default shortcut.
- Unmodified Enter and Space press a focused clear button. Modified activation keys pass to their owner without clearing a layer.
- A click clears that layer at once. Don't show a confirmation dialog. If the operator clicked by mistake, 되돌리기 brings it back.
- 모두 clears every layer that has something to clear at once. While even one layer is left, 모두 is in the something-to-clear state.
- 되돌리기 undoes the last 지우기 (including 모두), one step only. After the undo, it has nothing to undo and is off again. It is never removed from the row, so the buttons beside it keep their size and place.
- Shortcuts: 모두 F1, 가사 F2, 미디어 F3, 그래픽 F4, 오디오 F5, 메시지 F6. F1 to F6 work in every workspace and in the 환경설정 window, wherever the focus is: in a text field, with a menu or a dialog open, and during a drag. Only the key recording field on the 단축키 page takes them while it records. Clear undo has no default shortcut. Ctrl Z is edit undo and never restores cleared output. The tooltip and `aria-keyshortcuts` reflect an explicitly supplied current shortcut; these UI parts display it but do not register key bindings.
- Give a button with nothing to clear `aria-disabled="true"` and `data-state="off"` instead of `disabled`. It keeps its focus and tooltip, and its shortcut does nothing.
- Give each button `aria-label="가사 지우기"` and `aria-keyshortcuts="F2"`. The row is `role="group"` (name "지우기").
- Tooltip: append an assigned shortcut in `text-3`, `space-8` after the name. "가사 지우기 F2", "모두 지우기 F1". Without an assigned shortcut, clear undo shows only "되돌리기" and omits `aria-keyshortcuts`.

## Writing

- A button name is the one-word name of its layer: 모두, 가사, 미디어, 그래픽, 오디오, 메시지. The undo button is "되돌리기".
- Write tooltips and `aria-label` as "layer name + 지우기": "가사 지우기". For 되돌리기, write "되돌리기".
- The item toggle keeps the visible name 대기 화면 in both states. Its tooltip and `aria-label` are 대기 화면으로, or 항목 되돌리기 while pressed.
- Don't show a notification after a clear. The button changing to nothing to clear is enough.

## Implementation notes

```jsx
<ClearRow compact={narrow}>
  <ClearButton layer="all" active={anyOn} onClear={clearAll} />
  <ClearButton layer="slide" active={on.slide} onClear={() => clear('slide')} />
  …
  {showClearUndoButton && <ClearUndo available={!!last} onUndo={undo} />}
</ClearRow>
```

- `layer` (`all`, `slide`, `media`, `prop`, `audio`, `message`, the shared `ClearTarget`) sets the icon, the name, and the default shortcut (see the lists above). Pass `shortcut` with the current key when the 단축키 page changed it. With `active={false}`, the button draws `data-state="off"` and `aria-disabled`.
- `ClearUndo` draws the divider before 되돌리기 itself, so the row takes only `ClearButton` and optional `ClearUndo` children. It has no default `shortcut`; pass an explicitly assigned key only when one exists. `showClearUndoButton` comes from the caller's setting, default false. Gallery specimens show the enabled setting to demonstrate the part.
- Classes: row `ll-clear-row`, compact form `ll-clear-row--compact`, divider `ll-clear-row__divider`, button `ll-clear`, 모두 `ll-clear--all`, 되돌리기 `ll-clear--undo`, name `ll-clear__label` (hidden in the compact form).

```html
<button class="ll-clear" aria-label="가사 지우기" aria-keyshortcuts="F2">
  <span class="ll-i ll-i-text" aria-hidden="true"></span><span class="ll-clear__label">가사</span>
</button>
```

## Changes from the drafts

- ShowH, Problems, Bible: text of a button with nothing to clear #5c5c5c → `text-off`. Text of 되돌리기 with nothing to undo #5c5c5c → `text-off`.
- ShowH: tooltip "가사 지우기 F2" written as one run of text → shortcut set `space-8` apart in `text-3`.
- Compact: 모두 width 1.6 times → 1.4 times. 10px name under 모두 → removed (icon only). Divider height 26 → 24. Tooltip "가사 지우기" → "가사 지우기 F2". Clear undo keeps the tooltip "되돌리기" without a default shortcut.
