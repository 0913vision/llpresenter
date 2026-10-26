# PropertyRow

A row that places one name and one control side by side in a property field or a settings screen, and the group that holds those rows. Use it for item settings, 화면 설정 (Screen settings), the Look editor, stage layouts, media properties, and Preferences.

## Where to use

- Property panels in the right column (480, 360 in a narrow window): item settings (PrepService), properties in 화면 설정 (Screens, ScreensNDI), stage layout elements (StageEditor), media properties (Media)
- Property grids on the center editing surface: text properties in the Look editor (two columns)
- Every settings row in the Preferences window

## Where not to use

- Lists (예배 순서 (service order), library, shortcut table): use list rows.
- Horizontal input rows at the bottom of a dialog (name, date, and time in a new service, the settings row in text import): lay the name and the control side by side with `space-10` between them. Don't align the name column width.
- A list where each row is a checkbox choice (output state recovery): that is the row with a value in `Checkbox`.

## Anatomy

- Group `ll-prop-group`: top `space-12`, bottom `space-8`, a 1px `line` below. The last group has no line.
- Group name `ll-prop-group__title`: `caption-strong` (16/22/600), `text-3`, bottom `space-4`. If it needs a leading icon, use 12px, 6px from the name (메모).
- Row `ll-prop`: name cell + control cell, vertically centered.
- Name `ll-prop__label`: `label` (14/20), `text-2`. Write it as `label for` so that it connects to the control.
- Control cell `ll-prop__control`: the remaining width. Gap between the items inside it `space-8`. Place md controls (`size-control-md` 30) in it: `TextField`, `Select` (`--block`), `SegmentedControl` (`--fill`), `Switch`, `Slider` (`--block`), number field + unit.
- Value `ll-prop__value`: a read-only value. `body` (16/22), `text-2`, tabular numbers, truncated with an ellipsis when it overflows (주사율 60Hz, 현재 버전 1.0.0, 마지막 백업 오늘 07:58). For a value that reads like a name (the source song name), use `ll-prop__value--primary` for `text`. An icon in front of a value is 14px `text-3` (`link` for the source song).
- Extra information after the value `ll-prop__meta`: `label` (14/20) `text-3` (라이브러리).
- An action after a value, such as 라이브러리 곡 열기 (`IconButton` sm, `open` icon), sits at the right end of the control cell (`margin-left: auto`). In code: `PropertyValue` `action`.
- Put a multi-line control (메모) under the group name at the full cell width, without a name cell. If a multi-line control really needs a name cell, use `ll-prop--top` to align the name with the first line.

### Name cell width rules

The place where the row sits sets the name cell width. Don't set it separately for each screen.

| Placement | Name cell | Gap between name and control | Row height | Control cell |
| --- | --- | --- | --- | --- |
| Panel (right column 480, 360, Look editor grid) | 84px | `space-12` | 36px or more | Remaining width |
| Window (Preferences) | 168px | `space-16` | 38px or more | Up to 340px |

- A panel's 84px fits names up to "위치 미세 조정" and "연결이 끊기면" on one line in 14px text. Don't wrap a name that overflows onto two lines. Shorten the name.
- When you place two columns on a wide surface, as in the Look editor, use `ll-prop-cols` with `space-24` between the columns. Rows inside a column follow the panel rule (84px).

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Panel row | 36 | Name `label` 14/20 `text-2` | Property panels, Look grid |
| Window row `ll-props--window` | 38 | Same | Preferences |
| Group name | 22 | `caption-strong` 16/22/600 `text-3` | All groups |
| Value | 22 | `body` 16/22 `text-2` | Read-only values |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Default | Transparent (panel background) | Name `text-2`, value `text-2` | The row itself has no hover |
| Control disabled | Transparent | Name `text-off`, the control follows its own rules | If the control cell contains `disabled`, the CSS changes the name to match. Reason in the control's tooltip |

## Behavior

- A click on the name moves focus to its control, and toggles a switch or checkbox (`label for`).
- The tab order runs top to bottom, and left to right within a row. Tab doesn't stop on name or value text.
- Group names don't collapse or expand. When many groups make the content long, only the panel body scrolls.

## Writing

- Write names as short nouns: "배경", "시작할 때", "연결이 끊기면", "가장자리 여백". Don't add a question mark or "설정".
- Write group names in one or two words: "원본", "이번 예배", "출력", "안정성", "보정", "백업".
- Don't add a description to value text. Add only the unit (60Hz, 4.3MB).

## Implementation notes

- `<PropertyGroup title="이번 예배"><PropertyRow label="배경"><Select block … /></PropertyRow></PropertyGroup>`
- `<Properties variant="panel | window">` sets the name cell width and the row height. Don't pass a width from the screen side.
- A row with only a value, such as `<PropertyRow label="주사율" value="60Hz" />`, draws `ll-prop__value`.
- Markup: `div.ll-props[.ll-props--window] > div.ll-prop-group > p.ll-prop-group__title + div.ll-prop > label.ll-prop__label + span.ll-prop__control`
- Classes: `ll-props`, `ll-props--window`, `ll-prop-cols`, `ll-prop-group`, `ll-prop-group__title`, `ll-prop`, `ll-prop--top`, `ll-prop__label`, `ll-prop__control`, `ll-prop__value`, `ll-prop__value--primary`, `ll-prop__meta`.

## Changes from the drafts

- Screens, ScreensNDI properties: name cell 112 → 84.
- Media properties: name cell 96 → 84.
- PrepService 이번 예배 row height 40 → 36.
- Looks text properties: row 38 → 36, removed the bottom line on every row, gap between the two columns 28 → 24.
- Group dividers (PrepService, Screens, ScreensNDI, StageEditor, Media, Prefs): #262626 → `line`.
- Group padding: Screens, ScreensNDI, StageEditor, Media 12/6 → 12/8, Prefs 14/8 → 12/8.
- Control height in every property field 28 → 30 (the `TextField` and `Select` documents say the same).
