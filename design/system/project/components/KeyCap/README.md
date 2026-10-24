# KeyCap

A small box that shows a shortcut as a key. Use it in the shortcut table in Preferences. In tooltips and menus, write the shortcut as text without a box.

## Where to use

- The shortcut cells of the shortcut table in Preferences > 단축키 (Shortcuts) (다음 장 → Space, 되돌리기 Ctrl Z, 지우기 (clear) F1~F7)
- Marking a shortcut conflict (평상시 and 출력 켜기 are both Ctrl 1)
- Text shortcuts: tooltips ("되돌리기 Ctrl Z"), the right side of menu items

## Where not to use

- Inside tooltips and menus: don't draw key boxes. Write the shortcut as text only (`ll-tooltip__key` of `Tooltip`, `ll-menu__meta` of `Menu`).
- F1~F7 on the 지우기 buttons of the 진행 (Show) workspace: don't put keys inside the buttons. Show them only in tooltips (`ClearButton`).
- Inside a button name: don't mix a shortcut into a button name, as in "Ctrl Z로 되돌리기". Show it in a tooltip.

## Anatomy

- Key `ll-key` (`kbd`): height 18px, minimum width 22px, horizontal padding `space-6`, radius `radius-sm`, background `bg-control`, text `caption-strong` (11px, 600) with an 18px line height, `text`, centered, tabular numbers.
- Combination `ll-keys`: the keys that make up one shortcut (Ctrl, Z). Gap between keys `space-4`. Don't use a plus sign (+).
- Shortcut list `ll-key-list`: when one command has two or more shortcuts (→, Space). Gap between combinations `space-10`.
- Conflict icon `ll-key-warn`: `warning` 14px in `warning`, 10px after the combination. Reason in a title tooltip ("출력 켜기와 겹침").
- None `ll-key-empty`: "없음" (none) when there is no shortcut, `label` (12/16) `text-3`.
- Recording a key: put a `TextField` sm (width 160, placeholder "키 입력", focus ring) in place of the keys. That row has a `selection` background.
- Text shortcut `ll-key-text`: no box, `text-3`, tabular numbers, no wrapping. The size follows the surrounding text (12px in tooltips, 11px in menus). In a tooltip, keep it 8px from the name. Separate keys with one space (like "되돌리기 Ctrl Z" in the drafts): Ctrl Z, Alt 2, F1, Space, →. Don't use "+".

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Key | 18 | `caption-strong` 11/600 | Shortcut table |
| Combination | 18 | Same | Gap between keys 4 |
| Text shortcut | Text height | Tooltip `label` 12/16, menu `caption` 11/14, `text-3` | Tooltips, menus |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Default | `bg-control` | `text` | |
| Changed shortcut | `selection` | `text` | `ll-keys[data-state="changed"]`. A shortcut that differs from the default. Don't add a dot or text |
| Conflict | `bg-control` | `text`, followed by a `warning` icon | `ll-keys[data-state="warning"]`: 1px `warning` around the combination with a 2px offset. Reason in the icon's tooltip. If a shortcut is both changed and in conflict, show only the conflict |
| None | - | "없음" in `text-3` | |
| Recording a key | Row `selection` | `TextField` sm in focus | Takes the next combination the user presses |

## Behavior

- A key is a display that can't be pressed. To change a shortcut, double-click its row or press Enter to open the key recording field.
- In the key recording field, Esc cancels, Backspace removes the shortcut, and any other combination becomes the shortcut. If the combination is already in use, both rows show a conflict.
- When the user hovers over the conflict icon, a tooltip says what it conflicts with.
- aria: write keys with `kbd`. Give the conflict icon an `aria-label` with the same text as the tooltip. Give the row of a changed shortcut `aria-description="바꾼 단축키"`.

## Writing

- Write key names exactly as Windows does: Ctrl, Alt, Shift, Space, Enter, Esc, F1, and → ← ↑ ↓ for arrows. Don't translate them into Korean.
- Write a conflict tooltip as one line, "<명령>과 겹침": "출력 켜기와 겹침", "평상시와 겹침".

## Implementation notes

- `<KeyCombo keys={['Ctrl', 'Z']} state="changed | warning" conflictWith="출력 켜기" />`, `<KeyList combos={[['→'], ['Space']]} />`
- Build text shortcuts with one function, `formatShortcut(['Ctrl', 'Z']) === 'Ctrl Z'`, so that tooltips, menus, and the shortcut table use the same names.
- Markup: `span.ll-key-list > span.ll-keys[data-state] > kbd.ll-key` + `[span.ll-key-warn[title] > span.ll-i.ll-i-warning]`
- Classes: `ll-key`, `ll-keys`, `ll-key-list`, `ll-key-warn`, `ll-key-empty`, `ll-key-text`.

## Changes from the drafts

- Prefs, Shortcuts keys: background #2f2f2f → `bg-control`, horizontal padding 5 → 6, gap between keys in a combination 3 → 4.
- Shortcuts changed shortcut: 6px blue dot after the command name → dot removed, key background `selection`.
- Shortcuts conflict icon: gap from the combination 14 → 10.
- Shortcuts none: #6e6e6e → `text-3`. Key recording field: height 24 → 26.
