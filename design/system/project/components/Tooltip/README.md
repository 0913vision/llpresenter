# Tooltip

A small box that briefly shows a name, a shortcut, the reason something is disabled, or the reason for an error when the pointer rests on its target or keyboard focus stays there. Use it for icon-only buttons, 지우기 (clear) buttons, toolbar buttons, status icons, and text fields with an error.

## Where to use

- Names of icon-only buttons and toolbar buttons: "사이드바 접기", "본 화면 출력 끄기 (모니터 2)"
- Controls that have a shortcut: "가사 지우기 F2", "되돌리기 Ctrl Z"
- The reason a control is disabled, the reason for a text field error: "라이브러리에 같은 제목의 곡이 있습니다"
- The detailed reason behind a status icon: "미디어 파일 없음", "배경 파일을 찾을 수 없음"
- The full name of a name truncated with an ellipsis

## Where not to use

- Warnings that the user must read: use `Notification` or `AlertDialog`.
- Content with choices to make: use `Menu`.
- Don't show a tooltip that only repeats the name on a button whose text is visible. Show one only when there is a shortcut or a reason.
- Don't show tooltips inside the output screens (본 화면 (main screen), 무대 화면 (stage screen), 방송 자막 (broadcast captions)).

## Anatomy

- Surface `ll-tooltip`: background `bg-raised`, corner radius `radius-md` (4px), shadow `shadow-popover`, padding 5px top and bottom and `space-8` left and right, maximum width 280px. Text that overflows wraps at word boundaries (`keep-all`), and text with no break points, such as a path, breaks anywhere. There is no arrow. Stacking `z-tooltip`.
- Text: `label` (12/16) `text`.
- Shortcut `ll-tooltip__key`: `space-8` after the name, `text-3`, tabular numbers, no wrapping. Don't draw a key box (it is the text shortcut from `KeyCap`).
- Second line `ll-tooltip__sub`: `space-2` above, `text-3`. After the reason, one fact that the user needs to decide (the 슬라이드 (slide) count and modified date of the conflicting song, a file path).
- Position: 6px below the target, centered horizontally on the target. If the target is wider than the tooltip (a text field), align the left edges. If there isn't enough room below, flip it to 6px above the target, and at the side edges of the window, push it 8px inward. Position it from the target's rectangle, not from the pointer position.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Name only | 26 (16 + 5 × 2) | `label` 12/16 `text` | Icon buttons, toolbar buttons |
| Shortcut | 26 | `label` `text` + `text-3` | 지우기 buttons, undo |
| Two lines | 44 (16 + 2 + 16 + 5 × 2) | `label` `text`, second line `text-3` | Error reason + extra info |
| Wrapping | Up to 280 wide, 16 per line | `label` | Long reasons, file paths |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Appearing | `bg-raised` | `text`, shortcut and second line `text-3` | Opacity 0 → 1, 120ms ease-out. At once under `prefers-reduced-motion` |
| Visible | `bg-raised` | Unchanged | |
| Closed | None | None | Disappears at once (no fade) |
| On a disabled target | Unchanged | Unchanged | Show it even when the target has `aria-disabled="true"` |
| Text field with an error | Unchanged | Unchanged | The field has `ring-field-error`, and the tooltip gives the reason |

## Behavior

- Delay: the tooltip appears 600ms after the pointer rests on the target. If the pointer moves to another target while a tooltip is showing or within 300ms after it closes, show the new tooltip at once, with no delay.
- Show it with the same delay when keyboard focus (`:focus-visible`) enters the target. Don't show it for focus that comes from a mouse click.
- Closing: close at once when the pointer leaves the target, or on a click, a key press (including Esc), a scroll, or when the window loses focus. The tooltip doesn't receive the pointer.
- Make a disabled button with `aria-disabled="true"` instead of `disabled` so that it receives the pointer and focus (same as `Button`, `IconButton`, and `ClearButton`).
- aria: the tooltip has `role="tooltip"` and an `id`, and the target has `aria-describedby`. For an icon-only button, `aria-label` is the name, and the tooltip adds the shortcut to the same name. Also give the shortcut through the target's `aria-keyshortcuts`.
- Don't use the browser's default `title` tooltip. Draw every `title` attribute in the drafts with this tooltip.

## Writing

- Write the name as what happens on a click: "가사 지우기", "사이드바 접기". For a toggle button, write the state that a click leads to, not the current state: when it is on, "본 화면 출력 끄기 (모니터 2)".
- Put the shortcut after the name, as text: "F2", "Ctrl Z".
- Write a reason as one sentence about what is wrong, with no period: "라이브러리에 같은 제목의 곡이 있습니다", "배경 파일을 찾을 수 없음". Don't write long instructions for the fix.
- Don't repeat a name that is already visible on the target.

## Implementation notes

- `<Tooltip content="가사 지우기" shortcut="F2" sub="라이브러리 곡 슬라이드 4개, 10월 20일 수정" placement="bottom"><ClearButton … /></Tooltip>` or `useTooltip(ref, { content, shortcut })`.
- Draw tooltips in one layer for the whole app (a portal, `z-tooltip`), and keep one timer for the delay and the 300ms grace period.
- Position from the target's `getBoundingClientRect()`, with a gap of 6, a flip (below → above), and an 8px push from the edges.
- Classes: `ll-tooltip`, `ll-tooltip__key`, `ll-tooltip__sub`.

## Changes from the drafts

- The drafts all use the browser `title` tooltip (ShowH, Bible, CueTake "되돌리기 Ctrl Z", the 지우기 buttons, Compact "사이드바 접기", ImportText, ImportSave, ImportEdit "라이브러리에 같은 제목의 곡이 있습니다", Problems "미디어 파일 없음", "배경 파일을 찾을 수 없음"). The app replaces them with this tooltip. Nothing new needs to be drawn on the boards.
