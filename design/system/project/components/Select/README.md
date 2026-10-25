# Select

A dropdown button that shows the current value and, when clicked, opens a menu of choices. Use it to pick one of a fixed set, such as the default background, 구성 (arrangement), language, device, or date and time.

## Where to use

- The default background (따뜻한 빛) in the header of the 진행 (Show) workspace and of imported song editing, the 구성 (주일용) in the 준비 (Prep) workspace
- Background and 시작할 때 (on start, a macro) in item settings
- Device, resolution, and 연결이 끊기면 (when disconnected) in 화면 설정 (Screen settings) / font in the Look editor / content type in the stage layout
- Every choice row in Preferences (language, 시작할 때, autosave, 슬라이드 (slide) splitting, source position)
- The date (11월 1일 일요일) and time (오전 11:00) of a new service
- The Bible version (개역한글) and reference (슬라이드마다) for Bible verses

## Where not to use

- When there are 2 to 4 choices and all have short names: use `SegmentedControl` (청중/무대, 반복/멈춤).
- A menu button that runs commands (더 보기, 매크로 추가): give `IconButton` or `Button` `aria-haspopup="menu"`.
- A switch button with a transparent background and only an arrow, like the service name in a panel header: that is `ll-panel__switch` of `Panel`.
- The Look picker on the toolbar (평상시): that is `ToolbarButton`.
- The list after it opens: `Menu` (`ll-menu`) draws it. Select draws only the button.

## Anatomy

- Background `bg-control`, radius `radius-md`, text `text`. Don't use #262626 (`bg-raised`) dropdowns.
- md: height `size-control-md` (30), text `body` (13/18), left padding `space-10`, right padding `space-8`. The left padding is narrower than on a button so that the text starts where it does in a text field (TextField).
- sm: height `size-control-sm` (26), text `label` (12/16), left padding `space-8`, right padding `space-6`.
- Value `ll-select__value`: takes the remaining width and truncates with an ellipsis when it overflows.
- Extra info `ll-select__meta`: 8px after the value, md `label` (12/16) / sm `caption` (11/14), color `text-2`. It sits on `bg-control`, so don't use `text-3`. Examples: 곡 기본값, 매크로, EPSON 프로젝터.
- Arrow `ll-select__chevron`: `down` 12px (`size-icon-12`), `text-3`, 8px from the element before it. It is a mark, not text, so it passes 3:1 even on `bg-control` (4.3:1, and 3.8:1 on the hover background).
- Leading icon `ll-select__icon`: md 16px, 8px from the text, left padding `space-10` / sm 14px, 6px from the text, left padding `space-8`. Color `text-2`. Date `cal`, time `clock`, Bible version `translate`.
- Leading media `ll-select__media`: 36×20, `radius-xs`, `object-fit: cover`, 8px from the text. Left padding equals the top and bottom padding: md 5px / sm 3px.
- Leading macro color tile `ll-select__tile`: 20×20, `radius-md`, background in the 이름표 (label) color of that macro, inner icon 14px `text-on-label`. Padding is the same as for media.
- Width: fits the content inside headers, and fills the control cell in property fields and Preferences (`ll-select--block`).

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| sm | 26 | `label` 12/16 | Panel headers (default background, 구성), Bible verse settings row (Bible version, reference) |
| md | 30 | `body` 13/18 | Property fields, Preferences, dialogs (new service date and time) |
| Leading media | sm, md | Same | Where you pick a background |
| Leading color tile | md | Same | Where you pick a macro |
| Leading icon | sm, md | Same | Date, time, Bible version |
| Extra info | sm, md | One step smaller than the value | Source of the value or device name |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Default | `bg-control` | Value `text`, extra info and leading icon `text-2`, arrow `text-3` | |
| Hover | `bg-control-hover` | Same | 100ms ease-out |
| Pressed | `bg-control-hover` | Same | |
| Open | `bg-control-hover` | Same | `aria-expanded="true"`. Stays until the menu closes |
| Focus | `bg-control` | Same | outline 2px `accent`, offset 1px (keyboard only) |
| Disabled | `bg-control` | All `text-off` | No hover, the media image stays as is. Reason in a tooltip |

## Behavior

- A media lead can show an image or a muted video's first frame. React callers use `lead: {kind: 'media', src, mediaType: 'video'}` for a video. It loads metadata without autoplay and releases the source on change or unmount; the 36x20 frame is unchanged.
- A click, Enter, Space, or the down arrow opens the menu. Open the menu below the button, aligned to its left edge, and don't make the menu narrower than the button.
- In the menu, put a check mark in the cell before the current value (`Menu` rule). Choosing a value closes the menu and returns focus to the button. Esc closes it without choosing.
- The date button opens a calendar popover (`aria-haspopup="dialog"`). All others use `aria-haspopup="listbox"`.
- aria: `aria-expanded`. If the only visible name is the value, also write what is being chosen in `aria-label` (for example, "기본 배경 따뜻한 빛").

## Writing

- Write only the current value on the button. Don't write words such as "선택하세요" (Please select) or "고르기" (Choose). With no value, write "없음" (None).
- Write extra info as a short noun that says where the value came from: "곡 기본값", "매크로". Don't write a sentence.
- Write dates like "11월 1일 일요일" and times like "오전 11:00", in the same format as the rest of the app.

## Implementation notes

- `<Select size="sm" value="따뜻한 빛" media={thumbUrl} options={backgrounds} />`
- `<Select size="md" block value="찬양" tile={{ color: 'teal', icon: 'song' }} meta="매크로" />`
- `<Select size="md" icon="cal" value="11월 1일 일요일" popup="dialog" />`
- Markup: `button.ll-select[.ll-select--sm][.ll-select--block] > [img.ll-select__media | span.ll-select__tile | span.ll-i.ll-select__icon] + span.ll-select__value + [span.ll-select__meta] + span.ll-i.ll-i-down.ll-select__chevron`. The CSS sets the left padding for each leading element with `:has()`.
- Classes: `ll-select`, `ll-select--sm`, `ll-select--block`, `ll-select__value`, `ll-select__meta`, `ll-select__chevron`, `ll-select__icon`, `ll-select__media`, `ll-select__tile`, `ll-select__tile--<color>`.
- Use the `Menu` component for the menu.

## Changes from the drafts

- Dropdowns in Prefs, Screens, ScreensNDI, Looks, StageEditor, PrepService: background #262626 → `bg-control`, height 28 → 30 (PrepService was already 30), left 10 unchanged, arrow 14 → 12.
- PrepService background: media 40×24 → 36×20, left 3 → 5. 시작할 때: color tile 22×22 radius 5 → 20×20 `radius-md`, left 4 → 5. Extra info in both rows #8c8c8c → `text-2`.
- Extra info for the Screens device (EPSON 프로젝터) #8c8c8c → `text-2`.
- NewService date and time: background #262626 → `bg-control`, a 12px arrow added where there was none, icon 14 #8c8c8c → 16 `text-2`, left/right 8/10 → 12/8.
- ShowH, Reflow, ImportEdit default background (sm): arrow 14 → 12. Compact default background: height 24 → 26, media 32×18 → 36×20, gap 6 → 8.
- Bible version: icon #8c8c8c → `text-2`, arrow 14 → 12, right 8 → 6. Reference (슬라이드마다): height 24 → 26, background #262626 → `bg-control`, left/right 8/6 → 10/6.
