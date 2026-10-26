# Menu

A floating menu. Menu bar menus, submenus, right-click menus, and popover lists that a button opens (service picker, 이름표 (label) picker) all use the same surface and 28px items.

## Where to use

- The 파일 (File), 편집 (Edit), 보기 (View), 출력 (Output), 창 (Window), and 도움말 (Help) menus in the menu bar and their submenus (파일 › 가져오기 › 텍스트 파일)
- Right-click menus (macro tiles, 예배 순서 (service order) items)
- Lists that a button opens: the service picker (search at the top), the 이름표 picker (color swatches), the list that `Select` opens

## Where not to use

- Settings with several inputs: use `Dialog`.
- Showing only a name or a reason: use `Tooltip`.
- Lists that are always visible: use `ListRow`.
- A color picker row inside a menu (이름표 colors, macro colors) is `ll-swatches--menu` from `LabelColorPicker`. The menu provides only the surface and the dividers around that row.

## Anatomy

- Surface `ll-menu`: background `bg-raised`, corner radius `radius-xl` (6px), shadow `shadow-popover` (includes a 1px `line-strong` border), padding `space-6`. The width fits the content, with a minimum of 180 and a maximum of 320 (service picker 300, macro right-click menu 240). Stacking `z-popover`.
- Item `ll-menu__item`: height `size-row-menu` (28px), horizontal padding `space-8`, corner radius `radius-md`, text `body` (16/22) `text`. Gap between parts `space-10`.
  - Leading slot `ll-menu__lead`: 14×14. A 14px icon in `text-2`, or the check mark for the current item (`check` 14px `text`). If any item in a menu uses the leading slot, give every item an empty leading slot. Then all names start on the line 32px (8 + 14 + 10) from the left of the item. A menu that doesn't need a leading slot (the 파일 menu) has none at all.
  - Name `ll-menu__label`: takes the remaining width, truncates with an ellipsis.
  - Trailing info `ll-menu__meta`: `caption` (14/20) `text-3`, tabular numbers, at least 16px from the name. Dates ("10월 25일") and shortcuts ("Ctrl Z", the text shortcut from `KeyCap`).
  - Submenu arrow `ll-menu__chevron`: `right` 12px `text-3`, at the right end.
  - 이름표 swatch `ll-menu__swatch`: 18×12, corner radius `radius-xs`, 이름표 color from `data-color`. No 이름표 is `label-none` + 1px `line-control`. Place it after the leading slot and before the name (the check mark for the current 이름표 goes in the leading slot).
- Divider `ll-menu__sep`: 1px `line-strong`, `space-4` top and bottom, `space-2` left and right.
- Group name `ll-menu__group`: `caption-strong` (16/22/600) `text-3`, padding 6 top, 8 left and right, 4 bottom (2 top when it is at the top of the menu).
- An item that switches the menu to another mode (성경 구절 in the 항목 추가 popover, which turns the search field into a reference field) keeps the menu open when it runs and puts focus back on the search field. In code: `keepsOpen` on the item.
- Search match: in a list filtered by a search, the part of an item name that matched is drawn in `body-strong` `text` (the 항목 추가 popover, `AddSongsQuick`). In code: `match` on the item.
- Search field `ll-menu__search`: at the top of the menu, height `size-control-md` (30px), background `bg-well`, `radius-md`, horizontal padding `space-8`, magnifying glass 16px `text-3`, gap to the text `space-8`, `space-4` below. Placeholder "검색". The text starts on the same line as the item names. Focus `ring-field-focus`.
- Delete item `ll-menu__item--danger`: don't give the text its own color; keep it `text`, because red is only for 출력. Put it at the bottom of the menu after a divider, and ask once more with a confirmation dialog (`AlertDialog`) for a deletion that can't be undone.
- Position
  - Menu bar menu: directly under the menu bar (30px from the top), with its left edge aligned to the menu name button.
  - Menus and popover lists that a button opens: 4px below the button, with the left edge aligned to the button. If there isn't enough room below, open 4px above the button.
  - Right-click menu: put the top-left corner of the menu at the pointer tip. If it reaches the right or bottom edge of the window, flip it to the left or up.
  - Submenu: so that its first item lines up with the parent item, submenu top = parent item top − 6. Horizontally, it overlaps the right edge of the parent menu by 4px (left = parent right − 4). If there isn't enough room on the right, open it on the left of the parent with a 4px overlap.
  - For a menu taller than the window, leave 8px at the top and bottom of the window and scroll only the item area (`ll-menu__scroll`).

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Menu bar menu | Item 28 | `body` 16/22 | 파일, 편집, 보기, 출력, 창, 도움말 |
| Submenu | Item 28 | `body`, leading icon 14 | 가져오기 › 텍스트 파일, 클립보드 텍스트, PowerPoint 파일 |
| Right-click menu | Item 28 | `body` | Macro (실행, 이름 바꾸기, 동작 추가 ›, 삭제) |
| Popover list | Search 30 + item 28 | `body` + `caption` date | Service picker |
| 이름표 menu | Item 28 | `body` + swatch 18×12 | 이름표 picker in library song editing |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Default | Transparent | Name `text`, leading slot `text-2`, trailing info and arrow `text-3` | |
| Pointed (mouse, arrow keys) | `bg-control-hover` | Trailing info and arrow `text-2` | Immediate background change, no ring or transition |
| Submenu open | `bg-control-hover` | Trailing info and arrow `text-2` | `aria-expanded="true"` on the parent item |
| Current item | Transparent | `check` 14px `text` in the leading slot | `aria-checked="true"` |
| Delete | Transparent, `bg-control-hover` when pointed | `text` | At the bottom, after a divider |
| Disabled | Transparent | Name, leading slot, trailing info, arrow `text-off` | No hover, reason in a tooltip |
| Search field focus | `bg-well` | Text `text`, magnifying glass `text-3` | `ring-field-focus` |

## Behavior

- Opening: click a menu bar name or a button, or press Enter, Space, or the Down arrow. A right-click menu opens with a right-click, Shift+F10, or the Menu key. When a menu opens, point to the first item, or focus the search field if there is one.
- Keyboard: the Up and Down arrows move between items (disabled items get pointed to but don't run). Home and End go to the first and last item. The Right arrow opens a submenu and points to its first item. The Left arrow closes a submenu. Enter and Space run the item. Esc closes one level, and Tab closes all. Typing a letter goes to the item that starts with that letter. In the search field, typed text becomes the search term, and the Down arrow moves into the list.
- Mouse: open a submenu when the pointer rests on its parent item for 150ms. While the pointer moves diagonally toward the submenu (within 300ms), don't close it even if the pointer crosses other items. If a menu bar menu is open and the pointer moves to another menu name, switch to that menu.
- A click outside the menu closes it, and that click doesn't pass through to what is underneath. Running an item closes all menus and returns focus to where the menu was opened.
- Fade in over 120ms when appearing; disappear at once when closing. Under `prefers-reduced-motion`, don't fade.
- Row backgrounds change immediately on entering and leaving. Do not apply the
  global hover transition to menu items: the previous row must lose its highlight
  as soon as the pointer or keyboard moves to another row. The submenu opening
  delay and diagonal-movement grace period remain separate behavior.
- aria: surface `role="menu"` + `aria-label`, item `role="menuitem"`, an item that picks one of several `menuitemradio`, an item that toggles on and off `menuitemcheckbox`, both with `aria-checked`. Submenu parent `aria-haspopup="menu"` + `aria-expanded`. Divider `role="separator"`, group `role="group"` + `aria-labelledby`. Disabled `aria-disabled="true"`.

## Writing

- Write an item as what it does, ending in a verb ("이름 바꾸기", "지금 예배를 틀로 저장", "다른 예배에서 가져오기"), or as the name of what it opens ("텍스트 파일", "환경설정").
- Don't add "…" even to an item that opens a dialog.
- Write shortcuts as text with spaces: "Ctrl Z", "Ctrl 1", "F2".
- Write a dangerous item as just "삭제" (delete). If it can't be undone, ask with `AlertDialog` before running it.
- Don't put explanatory text or new feature marks in a menu.

## Implementation notes

- `<Menu label="파일" items={[{ label: '새 예배' }, { type: 'separator' }, { label: '가져오기', submenu: [...] }]} />`
- `<MenuItem icon="filetext" label="텍스트 파일" meta="Ctrl Z" checked danger disabled submenu />`, `<MenuSearch placeholder="검색" />`, `<MenuSeparator />`, `<MenuGroup label="최근 예배" />`
- `<ContextMenu at={{ x, y }}>`, `<Popover anchor={ref} placement="bottom-start" offset={4}>`
- Do the position math in one place (flip, shift to stay within 8px of the window edge). A submenu starts to the right of its parent item, −4 horizontally, −6 vertically.
- Decide the leading slot per menu: if even one item has an icon or a check mark, every item gets an empty `ll-menu__lead`.
- Classes: `ll-menu`, `ll-menu__scroll`, `ll-menu__item`, `ll-menu__item--danger`, `ll-menu__lead`, `ll-menu__label`, `ll-menu__meta`, `ll-menu__chevron`, `ll-menu__swatch`, `ll-menu__sep`, `ll-menu__group`, `ll-menu__search`.

## Changes from the drafts

- ServiceSwitch service picker list: item 30 → 28.
- ImportMenu 가져오기 submenu: leading icon 16 → 14.
- Reflow 이름표 menu: item 30 → 28, check mark for the current 이름표 at the right end → leading slot, swatch after the leading slot. Divider top and bottom 6 → 4. "새 이름표" text `text-2` → `text` (icon stays `text-2`).
- Macros, ClearGroups delete: text #e07a7a → `text` (red is only for 출력).
- Macros right-click menu: width 210 → 240 (to fit the `LabelColorPicker` color row).
