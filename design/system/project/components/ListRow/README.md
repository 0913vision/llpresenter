# ListRow

One row of a list. The base is a 30px row with a 16px type icon, a 13px name, and 11px extra information on the right. This document also covers group headers, two-line items (44px), empty slots, drop positions, and the on row of 퀵 실행 (quick launch).

## Where to use

- 예배 순서 (service order), library, 퀵 실행, the media library and playlists, the audio list
- The pick list on the left of a dialog (new service, import from another service): two-line items
- Cells of a 틀 (template) that aren't filled yet (the 예배 순서 of a new service): empty slots
- Dragging from the library into the 예배 순서: drop position line, drag ghost row

## Where not to use

- Rows with a checkbox: use the check row of `Checkbox` (`ll-check-row--list`). Its height, padding, and hover are the same as in this document. Put the empty slot box (`ll-row__slot`) inside check rows too.
- Menu items (28px): use `Menu`.
- Rows with a property name and value side by side: use `PropertyRow`.
- Don't mark the currently selected row with a check mark. Mark it with a `selection` background.

## Anatomy

- Row `ll-row`: height `size-row` (30px), horizontal padding `panel-inset` (14px), width 100%. It reaches the panel edges and has no corner radius.
  - Icon `ll-row__icon`: 16px `text-2`, `space-10` from the name.
  - Name `ll-row__title`: `body` (13/18) `text`, one line, truncated with an ellipsis.
  - Extra information `ll-row__meta`: at the right end, `caption` (11/14) `text-3`, tabular numbers. 슬라이드 (slide) count ("슬라이드 9개"), duration ("5:00"), count ("42"), 구성 (arrangement) name ("주일용").
  - Warning icon `ll-row__warn`: `warning` 14px, color `warning`. After the name, before the LIVE badge. Reason in a tooltip ("미디어 파일 없음").
  - LIVE badge: put `ll-badge ll-badge--live` of `StatusMarks` at the right end. When the badge is present, leave out the extra information.
- Group header `ll-row-group`: `caption-strong` (11/14/600) `text-3`, padding top `space-10`, left and right 14, bottom 5. It can't be clicked.
- Renaming a group header (a 구역 of the 예배 순서): a double click, 이름 바꾸기 in its right-click menu, or 구역 추가 from quick add turns the name into a `TextField`-style field in place (height `size-control-sm`, `bg-well`, `ring-field`, `ring-field-focus` while focused) with the old name selected. A new section starts as 새 구역. Enter or leaving the field saves, Esc keeps the old name, and a blank name keeps it too. In code: `ListGroup` `rename`.
- Put a list in a panel inside `ll-panel__body--list` of `Panel` (top 4, bottom 8).
- Two-line item `ll-row--double`: height `size-row-double` (44px), horizontal padding `space-10`, radius `radius-lg`. Name in `body`, with a second line `ll-row__sub` under it (`caption` `text-3`, `space-2` from the name, `space-8` between values).
  - Put it inside the pick list `ll-rowlist--inset`, which has 8px padding. One-line items in the same list (empty service) also get 10 left and right and `radius-lg`, and group headers get 10 left and right. As a result, all text in the list on the left of a dialog starts at the same 18px line from the left.
- Empty slot `ll-row__slot`: a 24px box that takes the remaining width in the row. 1px dashed `line-control`, radius `radius-md`, horizontal padding `space-6`, icon and name in `text-3`, "빈 자리" (empty slot) at the right end in `ll-row__slot-mark` (`caption`).
- Drop position `ll-row-insert`: a zero-height element placed between two rows. A 2px `accent` line (12px from left and right, 1px rounded ends) + an 8px ring dot on the left (2px `accent` border, filled with the background color). Change the dot fill with `--ll-insert-bg`. The default is `bg-panel`, and inside the list box of `Dialog` it is `bg-inset`.
- Drag ghost row `ll-row--ghost`: width 220px, background `bg-control`, 1px `accent` ring + `shadow-popover`, radius `radius-md`, padding left 10 and right 8. Over a place where it can be dropped, add a 16px `accent-fill` circle with a white 12px `plus` (`ll-row__add`) at the end. It follows the pointer and doesn't receive pointer events.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| One line | 30 | `body` 13/18 + `caption` 11/14 | 예배 순서, library, 퀵 실행, media lists |
| Group header | 29 (10 + 14 + 5) | `caption-strong` 11/14/600 `text-3` | 예배 전, 찬양, 보관함, 재생목록, 틀, 지난 예배 |
| Two lines | 44 | `body` + `caption` `text-3` | 틀 and past services in new service and import from another service |
| Empty slot | 30 (box 24) | `body` `text-3` + `caption` | 틀 items of a new service |
| Drop position | 0 (line 2, dot 8) | - | Dragging into the 예배 순서 |
| Drag ghost row | 30 | `body` | Dragging from the library |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Default | Transparent | Name `text`, icon `text-2`, extra `text-3` | |
| Hover | `bg-raised` | Unchanged | 100ms ease-out |
| Pressed | `bg-control-hover` | Extra `text-2` | |
| Focus in 준비 | Unchanged | Unchanged | outline 2px `accent`, offset −2px (inside the row) |
| Focus in 진행 | Unchanged | Unchanged | No row focus outline; selection and live marks remain |
| Selected | `selection` | Name and icon `text`, extra and second line `text-on-selection` | `aria-selected="true"`, stays the same on hover |
| Live | `selection` if selected, otherwise transparent | Unchanged | LIVE badge on the right, `data-state="live"` |
| Past item | Transparent | Name `text-3`, icon `text-off` | A 예배 순서 item that has already passed in the 진행 (Show) workspace, `data-state="done"` |
| Missing file | Unchanged | Unchanged | 14px `warning` icon after the name + tooltip |
| 퀵 실행 on | `bg-control-hover` | Name and icon `text` | 3px `live` bar inside on the left, `aria-pressed="true"` |
| Disabled | Transparent | Name, icon, and extra all `text-off` | No hover, reason in a tooltip |

## Behavior

- `ListBox workspace="show"` keeps keyboard focus without drawing the row's focus outline. Tab entry, arrow selection, and Enter still work. 준비, including the default workspace in a dialog, keeps the normal outline. Controls at a row's end keep their own focus outline in either workspace.
- A list has `role="listbox"`, and each row has `role="option"` and `aria-selected`. Tab enters the list once, on the selected row or, with none selected, the first row, and Shift Tab leaves it (the list itself never takes focus); the up and down arrows move between rows, and Home and End go to the first and last rows. Group headers are skipped (a group has `role="group"` + `aria-labelledby`).
- In the 진행 workspace, the 예배 순서 list keeps ↑, ↓, Home, End, and Enter. ←, →, Space, Page Up, and Page Down go to 다음 슬라이드 and 이전 슬라이드 even while the list has focus, as in ProPresenter. A click on a row gives the list keyboard focus, also in 진행.
- A click on a row only selects it. A 예배 순서 row opens the 슬라이드 of that item in the 슬라이드 panel. For 출력 (output), the user clicks a 슬라이드.
- A click on a 퀵 실행 row runs it at once. An item that turns on and off, such as a logo screen, reports its on state with `aria-pressed`, and a second click turns it off. While it is on, the `live` bar stays on the left.
- Dragging: moving a row more than 4px starts a drag, and the drop position line snaps to the row boundary closest to the pointer. The spot right under a group header is also a drop position. Esc cancels.
- Dropping a song on an empty slot fills that slot and turns it into a regular row.
- When a name is truncated, show the full name in a tooltip.

## Writing

- Write the name exactly as the item's name: "만복의 근원 하나님", "요한복음 3장 16절". Don't put the type in front (the icon shows the type).
- Write extra information as compact counts or durations: "슬라이드 9개", "5:00", "42". Keep chapter numbers in Bible titles, such as "요한복음 3장 16절"; a separate "슬라이드 2개" describes that item's slides. The second line of a two-line item is date, then count: "10월 25일 일요일  항목 12개".
- Don't add the state as text (no "출력 중", "완료", or "재생됨"). Show it only with the LIVE badge, color, and bars.
- Write an empty slot as the name of the type that goes there and "빈 자리": "찬양 … 빈 자리".

## Implementation notes

- `<ListRow icon="song" title="만복의 근원 하나님" meta="슬라이드 9개" selected live warning="미디어 파일 없음" />`
- `<ListRow variant="double" icon="cal" title="주일 예배" sub={['10월 25일 일요일', '항목 12개']} />`
- `<ListRow toggle pressed icon="prop" title="로고 화면" />` (퀵 실행)
- `<ListBox label="예배 순서" workspace="show" selected={id} onSelect={…}>…</ListBox>` for the 예배 순서 list of 진행; leave `workspace` out elsewhere, dialogs included.
- `<ListGroup label="찬양">…</ListGroup>`, `<ListSlot icon="song" label="찬양" />`, `<ListInsertLine />`, `<ListDragGhost icon="song" title="주 하나님 지으신 모든 세계" adding />`
- Make a row a `button` (or an element with `role="option"`), and give its state with `aria-selected`, `aria-pressed`, `disabled`/`aria-disabled`, and `data-state="live | done | warning"` (separate several values with spaces).
- Classes: `ll-rowlist`, `ll-rowlist--inset`, `ll-row`, `ll-row--double`, `ll-row--ghost`, `ll-row__icon`, `ll-row__title`, `ll-row__meta`, `ll-row__warn`, `ll-row__lines`, `ll-row__sub`, `ll-row__slot`, `ll-row__slot-mark`, `ll-row__add`, `ll-row-group`, `ll-row-insert`.

## Changes from the drafts

- ShowH, Compact 퀵 실행: background of the on row (로고 화면) #262626 → `bg-control-hover` (the on rule of ghost buttons). Off row text #cfcfcf → `text`, icon #8c8c8c → `text-2`. Right padding 12 → 14.
- Compact list rows: height 28, 12px text, icon 14, gap between icon and text 8, horizontal padding 12 → 30, 13px, 16, 10, 14. Group header padding 8 12 4 → 10 14 5. LIVE badge 15px/9px → `StatusMarks` badge.
- NewService, ServiceImport left list: empty service row 36 → 30, group header top 12 → 10.
- NewService empty slot: dashed line #4a4a4a → `line-control`.
- AddSongs drag ghost row: background rgba(42, 42, 42, 0.95) → `bg-control`, plus circle #3d8bf0 → `accent-fill`, shadow 0 8px 20px → `shadow-popover`.
