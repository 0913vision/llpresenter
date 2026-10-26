# TextField

A field for typing text directly. Use it for search, Bible verses in 퀵 실행 (quick launch), names and titles, numbers, and notes.

## Where to use

- The toolbar search field (곡, 가사, 초성), library search, finding a macro action, finding a command in Shortcuts
- The Bible verse field in 퀵 실행 (요 3:16, 창 1:1-5), the verse field on the Bible verse screen
- The name of a new service, the title in text import, the title in imported song editing (inside the panel header)
- Number fields in Preferences and property fields (recovery copies, edge margin, size, line spacing), media range fields
- Notes in item settings (multiline)
- The field that records a new shortcut (key input)

## Where not to use

- Picking one of a fixed set of values: use `Select` or `SegmentedControl`.
- The search field at the top of a menu: `ll-menu__search` of `Menu` draws it.
- The lyric blocks in library song editing (Reflow): it is an editing surface where you edit text directly, without a background or border, so it isn't a text field. The editor on that screen defines it separately.
- Read-only values (refresh rate, current version, last backup): write them as the value text of `PropertyRow` (`ll-prop__value`). Don't draw them like a text field. As an exception, the folder path in Preferences is long and sometimes needs copying, so put it in a `readonly` text field (leading icon `folder`) with a [바꾸기] button next to it.

## Anatomy

- Outer field `ll-field`: background `bg-well`, radius `radius-md` (4px), text color `text`, placeholder `text-3`.
- md: height `size-control-md` (30px), horizontal padding `space-10`, text `body` (16/22).
- sm: height `size-control-sm` (26px), horizontal padding `space-8`, text `label` (14/20).
- Leading icon `ll-field__icon`: md 16px, sm 14px, color `text-3`. Gap between icon and text: md `space-8`, sm `space-6`. The search field uses the magnifier (`search`), and the Bible verse field uses the book (`book`).
- Clear-text button `ll-field__clear`: shows only when there is a value. md 22×22 (`size-control-xs`, icon 14), sm 18×18 (icon 12), 4px in from the right end, radius `radius-sm`, icon `text-3`, hover `bg-raised` + `text`.
- Number field `ll-field--num`: width 96px, value right-aligned, tabular numbers. Put the unit (개, 줄) outside the field as `ll-field-unit` (`label`, `text-3`), 8px away. Attach a unit that is part of the value, such as %, to the value.
- Prefix inside the field `ll-field__affix`: `caption` (14/20), `text-3`. Use it only when two fields sit side by side, like "시작" (start) and "끝" (end) in the media range fields.
- Title field `ll-field--title`: the song title inside a panel header (34px). Width 280px, height `size-control-sm` (26px), horizontal padding `space-8`, text `title` (18/26/600).
- Toolbar search field `ll-field--ring`: on `bg-app`, `bg-well` is barely visible, so add `ring-field`. Width 420px (280px in a narrow window), height stays md.
- Multiline `ll-textarea`: background `bg-well`, `radius-md`, padding `space-8` `space-10`, text `body` (16/22), minimum height 72px. It has no resize handle and grows with its content. Past 8 lines, it scrolls inside the field.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| md | 30 | `body` 16/22 | Dialogs, Preferences, property fields, toolbar search, search and 퀵 실행 in panels (regular window) |
| sm | 26 | `label` 14/20 | Inside panel headers, 퀵 실행 in a narrow window (1366), macro action palette, key input field |
| Search | md or sm | Same | Leading magnifier, clear-text button when there is a value |
| Number | md | `body`, right-aligned | Width 96, unit outside the field |
| Title | 26 | `title` 18/26/600 | Panel header in imported song editing |
| Multiline | 72 or more | `body` 16/22 | Notes in item settings |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Default | `bg-well` | Value `text`, placeholder and icon `text-3` | `ring-field` only on `bg-app` |
| Hover | Unchanged | Unchanged | Only the cursor changes to a text cursor |
| Focus | `bg-well` | Same | `ring-field-focus` (1px `accent` inside). Don't draw an outer ring |
| Error | `bg-well` | Same | `ring-field-error` (1px `live` inside). Reason in a `title` tooltip. The error ring stays even with focus |
| Disabled | `bg-well` | Value, placeholder, and icon all `text-off` | Don't lower the opacity. Reason in a tooltip |

## Behavior

- A click anywhere in the field (icon included) focuses the input.
- Search field: filter the results on every keystroke. Esc clears the value if there is one, and releases focus if the field is empty. The clear-text button clears the value and keeps focus in the field.
- 퀵 실행 field: Enter shows that verse. If the verse can't be recognized, show the error ring and give the reason in a tooltip.
- Number field: `step` defaults to 1 and `largeStep` defaults to ten times `step`. Choose `largeStep` as a whole multiple of `step` so repeated movement stays on the same grid. Up and down arrows add or subtract one step; Shift uses `largeStep`. Count in whole steps so 0.2 with step 0.1 becomes 0.3, without float drift. Round an off-step value or draft to the nearest whole step, apply the arrow movement, and then clamp the result to the range. With step 0.1, Arrow Down from max 0.28 and Arrow Up from min 0.12 both reach 0.2.
- Number precision follows `step`, including trailing zeroes: step 0.1 displays "0.2", step 0.05 displays "1.40", and step 1 displays "10". Keep any extra digits the actual value needs: a clamped maximum of 0.28 with step 0.1 displays "0.28", including in `aria-valuetext`. An attached suffix follows those digits ("1.00×"); an external unit stays outside ("초").
- Number typing accepts decimal digits, one ".", and a leading "-" for negative values in the range. Enter and blur round to the nearest zero-based step, then clamp to the range. Blank or invalid text restores the controlled value. `NumberField updateOn="commit"` buffers typing until Enter or blur and lets Escape cancel the draft; the default `change` mode reports valid in-range typing immediately and normalizes it at commit. IME Enter remains with the composition. Slide-size percentages retain commit mode with step 1.
- Title field: if the library has a song with the same title, show `aria-invalid="true"` and the error ring, and go to the `ImportSave` confirmation dialog on save.
- Key input field: when it gets focus, it records the next key combination pressed, F1 to F7 included, by physical key (`KeyboardEvent.code`). Esc cancels, Backspace removes the shortcut, and Tab or Shift Tab ends the recording and moves focus. A reserved key isn't recorded: the field keeps recording, shows the error ring, and gives the reason in a tooltip (see `KeyCap`). Keys with an empty `code` (한/영, 한자) aren't recorded.
- React uses `ShortcutField` for a recording session, reusing `TextField` sm with `size-field-key` (160px). Its `onRecord` and `onCancel` callbacks let the caller return to key boxes. Tab ends on blur after native focus movement, never by removing the input on keydown. See `KeyCap` for the recording API and key names.
- Tab order follows the order on screen. Take the clear-text button out of the tab order (`tabindex="-1"`). Esc does the same thing.
- aria: give a field without a visible name (search, 퀵 실행) an `aria-label`. Mark an error with `aria-invalid="true"`, and link the reason to the tooltip text with `aria-describedby`.

## Writing

- In a placeholder, write only examples or kinds of what can be entered: "곡, 가사, 초성", "요 3:16, 창 1:1-5", "제목, 가사, 초성", "키 입력". Don't write guidance sentences such as "여기에 입력하세요" (Type here).
- Don't write the error reason next to the field. Show it only in a tooltip. One sentence, facts only: "라이브러리에 같은 제목의 곡이 있습니다".
- Keep units short, one character: "개", "줄". Don't add a unit description ("개수") after the value.

## Implementation notes

- `<TextField size="md" icon="search" placeholder="곡, 가사, 초성" clearable />`
- `<TextField variant="number" value={10} unit="개" />`, `<TextField variant="title" invalid={dup} invalidReason="라이브러리에 같은 제목의 곡이 있습니다" />`
- `<NumberField value={0.2} min={0.1} max={2} step={0.1} largeStep={1} unit="초" onChange={setSeconds} />`; line-spacing and speed fields use step 0.05, default large step 0.5. Callers own ranges; these gallery examples do not decide settings defaults.
- `<TextField multiline minRows={3} maxRows={8} />` draws `textarea.ll-textarea`.
- Markup: `span.ll-field[.ll-field--sm|--num|--title|--ring|--block] > [span.ll-i.ll-field__icon] + input.ll-field__input + [button.ll-field__clear]`. Set an error with `aria-invalid="true"` on the input, and disabled with `disabled` on the input (the outer field follows through `:has()`).
- Classes: `ll-field`, `ll-field--sm`, `ll-field--num`, `ll-field--title`, `ll-field--ring`, `ll-field--block`, `ll-field__input`, `ll-field__icon`, `ll-field__clear`, `ll-field__affix`, `ll-field-unit`, `ll-textarea`.

## Changes from the drafts

- Toolbar search field (ShowH, Reflow, PrepService, Screens, and all other boards): height 32 → 30, background #1c1c1c → `bg-well` + `ring-field`, radius 5 → 4, horizontal padding 12 → 10, magnifier 14 → 16. Compact: background and radius changed the same way, text 12 → 13.
- 퀵 실행 and library search (ShowH, Bible, Problems, PrepService, Reflow, NewService, AddSongs, ServiceImport, ImportEdit, ImportSave): horizontal padding 6 → 10, gap between icon and text 10 → 8.
- AddSongsQuick search, Prefs/Shortcuts command search: icon 14 → 16, gap between icon and text 10 → 8.
- Compact 퀵 실행 28 → sm 26 (horizontal padding 6 → 8, gap 8 → 6). Macros action search 28 → sm 26 (horizontal padding 6 → 8, gap 10 → 6).
- Text fields and number fields in Prefs, Screens, ScreensNDI, Looks, StageEditor, Media, ImportText: height 28 → 30. Folder icon in the Prefs path field 14 → 16.
- Shortcuts key input field: height 24 → 26.
- PrepService notes: line height 20 → 18 (`body`).
