# ClearButton

The 지우기 (clear) row in the right column of the 진행 (Show) workspace. It takes one layer (lyrics, media, props, audio, messages, notices) or all layers off the output screens at once. An optional button undoes the last 지우기; its visibility setting is off by default.

## Where to use

- The 지우기 row under the output preview, in the right column of the 진행 workspace (regular and narrow windows).
- Places that use the same right column as the 진행 workspace, such as the Bible screen.

## Where not to use

- Clearing the contents of a list or a field (emptying a text field, deleting an item): Button, IconButton.
- Taking items down one at a time from the 표시 중 (showing) list in 진행 도구 (show tools): IconButton (내리기).
- Don't mix other commands into the 지우기 row. Put only 되돌림 (undo) there, after the divider.
- Don't add a button that clears a chosen set of layers at once (like Clear Groups in ProPresenter) in v1. Build such combinations as 지우기 actions in a macro, and if needed, attach that macro to the 시작할 때 (on start) macro of a 예배 순서 (service order) item.

## Anatomy

- Row: background `bg-panel`, corner radius `radius-lg`, padding `space-8`, gap between buttons `space-4`. The row is a panel of its own and has no header.
- Order: 모두 (all), 가사 (lyrics), 미디어 (media), 그래픽 (props), 오디오 (audio), 메시지 (message), 공지 (notice). When clear undo is enabled, append its divider and 되돌림.
- Button: height `size-clear-button` (52px), corner radius `radius-md`, name `caption-strong` (16/22/600) under an icon `size-icon-18`, gap `space-4`. Buttons share the row width (flex 1). 모두 is 1.4 times as wide.
- Icons: 모두 `layers`, 가사 `text`, 미디어 `image`, 그래픽 `prop`, 오디오 `audio`, 메시지 `msg`, 공지 `notice`, 되돌림 `undo`.
- Divider: 1×32, `line`, horizontal margin `space-4` (8 together with the gap between buttons).
- 되돌림: background `bg-toolbar-hover`. It sits one step lower than the 지우기 buttons to show that it does a different job.
- Narrow window: row padding `space-6`, button height 40, icon `size-icon-16` only, no name. Divider 1×24, horizontal margin `space-2`. 모두 stays 1.4 times as wide, so its width sets it apart.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| 지우기 | `size-clear-button` 52 | `caption-strong` | Regular window (column `col-right` 480) |
| 모두 | 52, 1.4 times as wide | `caption-strong` | First place in the row |
| 되돌림 | 52 | `caption-strong` | Last place, after the divider |
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

- Unmodified Enter and Space press a focused clear button. Modified activation keys pass to their owner without clearing a layer.
- A click clears that layer at once. Don't show a confirmation dialog. If the operator clicked by mistake, 되돌림 brings it back.
- 모두 clears every layer that has something to clear at once. While even one layer is left, 모두 is in the something-to-clear state.
- 되돌림 undoes the last 지우기 (including 모두), one step only. After the undo, it has nothing to undo. Render it only when 환경설정 > 진행 > 지우기 되돌리기 단추 보이기 is on; the setting is off by default. The caller owns this setting and omits both the button and its divider when off.
- Shortcuts: 모두 F1, 가사 F2, 미디어 F3, 그래픽 F4, 오디오 F5, 메시지 F6, 공지 F7. F1 to F7 work in every workspace and in the 환경설정 window, wherever the focus is: in a text field, with a menu or a dialog open, and during a drag. Only the key recording field on the 단축키 page takes them, while it records. Clear undo has no default shortcut. Ctrl Z is edit undo and never restores cleared output. The tooltip and `aria-keyshortcuts` reflect an explicitly supplied current shortcut; these UI parts display it but do not register key bindings.
- Give a button with nothing to clear `aria-disabled="true"` and `data-state="off"` instead of `disabled`. It keeps its focus and tooltip, and its shortcut does nothing.
- Give each button `aria-label="가사 지우기"` and `aria-keyshortcuts="F2"`. The row is `role="group"` (name "지우기").
- Tooltip: append an assigned shortcut in `text-3`, `space-8` after the name. "가사 지우기 F2", "모두 지우기 F1". Without an assigned shortcut, clear undo shows only "되돌리기" and omits `aria-keyshortcuts`.

## Writing

- A button name is the one-word name of its layer: 모두, 가사, 미디어, 그래픽, 오디오, 메시지, 공지. The undo button is "되돌림".
- Write tooltips and `aria-label` as "layer name + 지우기": "가사 지우기". For 되돌림, write "되돌리기".
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

- `layer` (`all`, `slide`, `media`, `prop`, `audio`, `message`, `notice`, the shared `ClearTarget`) sets the icon, the name, and the default shortcut (see the lists above). Pass `shortcut` with the current key when the 단축키 page changed it. With `active={false}`, the button draws `data-state="off"` and `aria-disabled`.
- `ClearUndo` draws the divider before 되돌림 itself, so the row takes only `ClearButton` and optional `ClearUndo` children. It has no default `shortcut`; pass an explicitly assigned key only when one exists. `showClearUndoButton` comes from the caller's setting, default false. Gallery specimens show the enabled setting to demonstrate the part.
- Classes: row `ll-clear-row`, compact form `ll-clear-row--compact`, divider `ll-clear-row__divider`, button `ll-clear`, 모두 `ll-clear--all`, 되돌림 `ll-clear--undo`, name `ll-clear__label` (hidden in the compact form).

```html
<button class="ll-clear" aria-label="가사 지우기" aria-keyshortcuts="F2">
  <span class="ll-i ll-i-text" aria-hidden="true"></span><span class="ll-clear__label">가사</span>
</button>
```

## Changes from the drafts

- ShowH, Problems, Bible: text of a button with nothing to clear #5c5c5c → `text-off`. Text of 되돌림 with nothing to undo #5c5c5c → `text-off`.
- ShowH: tooltip "가사 지우기 F2" written as one run of text → shortcut set `space-8` apart in `text-3`.
- Compact: 모두 width 1.6 times → 1.4 times. 10px name under 모두 → removed (icon only). Divider height 26 → 24. Tooltip "가사 지우기" → "가사 지우기 F2". Clear undo keeps the tooltip "되돌리기" without a default shortcut.
