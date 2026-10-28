# Switch

A 30×18 switch that turns on or off a setting that applies the moment you click it. Use it in setting rows in Preferences, 화면 설정 (Screen settings), the Look editor, the stage layout, media properties, and text import settings.

## Where to use

- Preferences: 오류 보고 보내기, 켤 때 화면 출력, 출력 중 절전 막기, 하드웨어 가속, 자동 백업, 절 번호, 자동 확인
- 화면 설정: 항상 위, 절전 막기, 알파 채널
- Look editor: 그림자, 외곽선 / on/off settings in the stage layout and media properties (소리 켜기)
- The settings row of text import: 이름표 인식 (detect labels)

## Where not to use

- Picking several things (items to import, states to restore): use `Checkbox`.
- A choice in a dialog that applies only after you click [확인]: use `Checkbox`.
- Large controls that change the current output state, such as turning on screen output: that is the screen output button on the toolbar (`ToolbarButton`).

## Anatomy

- Track: 30×18, radius `radius-full`. Off `line-strong`, on `accent-fill`.
- Thumb: 14×14 circle, `text`, inset `space-2` inside the track. When on, it moves 12px to the right.
- Motion: track color and thumb position 100ms ease-out. Under `prefers-reduced-motion`, it changes at once.
- In a property row, put it at the left end of the control cell of `PropertyRow` (name on the left, switch at the start of the control cell). Don't push it to the right end of the control cell. Its left edge must line up with the dropdowns and text fields in other rows.
- Name + switch row `ll-switch-row`: for places where several controls line up horizontally, such as a settings row. Name `label` (14/20) `text-2`, 10px from the switch.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Switch | 18 | - | Only one size |
| Property row | 36 (panel) / 38 (window) | Name `label` 14/20 `text-2` | Preferences, 화면 설정, Look, stage, media |
| Name + switch | 18 | `label` 14/20 `text-2` | Text import settings row |

## States

| State | Background (track) | Thumb | Other |
| --- | --- | --- | --- |
| Off | `line-strong` | `text`, left | `aria-checked="false"` |
| On | `accent-fill` | `text`, right | `aria-checked="true"` |
| Hover | Unchanged | Unchanged | |
| Focus | Same | Same | outline 2px `accent`, offset 1px (rounded around the track) |
| Disabled | `bg-control` | `text-off`, position unchanged | Name also `text-off`. Don't lower the opacity. Reason in a tooltip |

## Behavior

- A click or unmodified Space toggles it. Modified Space passes on without toggling. The new value is saved and applied at once.
- A click on the name also toggles it (`label for`, or wrapping it in `label`).
- In 진행, clicking the switch or its name keeps keyboard focus where it was. Tab still focuses the switch and Space toggles it. 준비 and dialogs retain native label focus behavior.
- The left and right arrows don't toggle it. Tab stops at each switch.
- aria: `button[role="switch"][aria-checked]`. Link the name to the name text of the row (`label for` or `aria-labelledby`).

## Writing

- Write the name as a short description of what happens when it is on: "항상 위", "절전 막기", "오류 보고 보내기", "이름표 인식". Don't add endings such as "~을 사용" (use ~) or "~ 여부" (whether ~).
- Don't write "켜짐" (on) or "꺼짐" (off) as text next to the switch.

## Implementation notes

- `<Switch checked onChange label="항상 위" />`. In a property row, `<PropertyRow label="항상 위"><Switch checked /></PropertyRow>`.
- Markup: `button.ll-switch[role=switch][aria-checked]` (the thumb is `::after`). Wrap a name row in `label.ll-switch-row`.
- Classes: `ll-switch`, `ll-switch-row`.

## Changes from the drafts

- Tracks that are on in Prefs, Shortcuts, Screens, ScreensNDI, Looks, StageEditor, Media, ImportText: #3d8bf0 (`accent`) → `accent-fill`.
- Thumbs on the same boards: #fff → `text` (#ececec).
