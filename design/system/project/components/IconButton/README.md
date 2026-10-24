# IconButton

A square ghost button with only an icon. Use it for adding in panel headers, 내리기 (take down) at the end of list rows, closing dialogs, and small on/off tools.

## Where to use

- Right side of panel headers: 항목 추가, 새 곡, 퀵 실행 추가, 구성 추가, 새 매크로 (sm)
- End of list rows: 내리기 in the 표시 중 (showing) list of 진행 도구 (show tools), 라이브러리 곡 열기 (sm)
- On/off tools (`aria-pressed`): 반복 (repeat) in audio, 비율 고정 (lock aspect ratio) and 격자에 맞추기 (snap to grid) in the stage layout (sm)
- 더 보기 (more) that opens a menu (`aria-expanded`) (sm)
- 닫기 (close) in dialog headers (md)

## Where not to use

- A group that picks one of two, such as grid view and list view: use the icon segments of SegmentedControl.
- The toolbar: ToolbarButton. The window control buttons in the menu bar (46×30): MenuBar.
- Don't make icon buttons with a filled background. Make an important command that runs at once on a click a Button with a text label.
- The dashed cell that puts a 장 (slide) into an empty slot isn't this component.

## Anatomy

- Size: sm `size-control-sm` (26×26), md `size-control-md` (30×30). The icon is `size-icon-16` in both sizes.
- Corner radius `radius-md` (4px), no background, icon `text-2`.
- In a panel header, place it inside the header's `space-8` right padding. With several buttons, the gap is `space-4`.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| sm | `size-control-sm` 26×26 | Icon 16 `text-2` | Panel headers, list rows, tools in panels |
| md | `size-control-md` 30×30 | Icon 16 `text-2` | 닫기 in dialog headers, tools in dialogs |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Default | None | `text-2` | |
| Hover | `bg-raised` | `text-2` | 100ms ease-out |
| Pressed | `bg-control-hover` | `text` | |
| On (`aria-pressed="true"`), menu open (`aria-expanded="true"`) | `bg-control-hover` | `text` | Stays the same on hover |
| Focus | Unchanged | Unchanged | `outline: 2px solid accent`, offset 1px, on keyboard focus only |
| Disabled | None | `text-off` | No hover. Give the reason in a tooltip |

## Behavior

- Enter and Space press the button. An on/off button toggles `aria-pressed` on each press.
- The button has no text, so always give it an `aria-label`. The tooltip shows the same name, followed by the shortcut if there is one (닫기 Esc).
- Keep the name of an on/off button the same in both states (반복). `aria-pressed` reports whether it is on.
- Give a button that opens a menu `aria-haspopup="menu"` and `aria-expanded`.
- When the button is disabled, use `aria-disabled="true"` so that the tooltip still shows.
- Let Tab reach a button at the end of a list row, but stop event propagation so that it doesn't clash with a click on the row.

## Writing

- Write `aria-label` and tooltips as short nouns or verbs: 항목 추가, 새 곡, 내리기, 닫기, 반복, 격자에 맞추기, 비율 고정.
- Don't include words like "버튼" (button) or "클릭" (click).

## Implementation notes

```jsx
<IconButton icon="plus" label="항목 추가" />
<IconButton icon="loop" label="반복" pressed={loop} onPressedChange={setLoop} />
<IconButton icon="more" label="메뉴" menu expanded={open} />
<IconButton icon="x" label="닫기" size="md" shortcut="Esc" />
```

- props: `icon`, `label` (aria-label and tooltip), `size` `'sm'` (default) | `'md'`, `pressed` (makes it an on/off button), `expanded` and `menu` (a button that opens a menu), `shortcut` (shortcut appended to the tooltip), `disabled`.
- Classes: `ll-iconbtn`, `ll-iconbtn--md`. The icon is `<span class="ll-i ll-i-<key>" aria-hidden="true">`, and the button sets its size to 16.

## Changes from the drafts

- NewService, ServiceImport: dialog 닫기 28×28 → 30×30 (md).
- PrepService, NewService, ServiceImport, AddSongs, Media: 28×28 buttons in panels (라이브러리 곡 열기 and others) → 26×26.
- ShowH, Overlays: 내리기 icon 14px `text-3` → 16px `text-2`.
- Overlays: 반복 on state, #ececec with no background → `bg-control-hover` + `text`.
- StageEditor: 비율 고정, 격자에 맞추기 28×28 icon 14 → 26×26 icon 16. On background #262626 → `bg-control-hover`, off icon #8c8c8c → `text-2`.
- Prefs, Bible, Problems: icon of 26×26 buttons #8c8c8c → `text-2`.
- Compact: sidebar collapse 24×24 #8c8c8c → 26×26 `text-2`.
