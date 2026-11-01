# LoveLight design system

LoveLight Presenter sends lyrics, Bible verses, and announcements to several
screens during a service. The operator works in a dark room and changes the
screens with one click. Every rule in this system exists so that this one click
is never wrong.

- The app has one theme, dark.
- `tokens.json` holds every value. Each CSS variable has the name of its token
  (`--bg-panel`).
- Component classes start with `ll-` and live in `components/bundle.css`.
- Each component's sizes, states, and behavior are in
  `components/<name>/README.md`. This document holds the rules that apply to all
  of them.

## Principles

1. **The screens come first.** Keep the UI dark and quiet. The brightest things
   in the window are the 출력 preview and the thumbnails. UI surfaces use only
   the gray steps from `bg-app` to `bg-control-hover`.
2. **Follow ProPresenter.** A feature that ProPresenter also has goes in the
   same place and behaves the same way: a click on a 슬라이드 outputs it at
   once, the F1 to F7 지우기 actions, song 구성, screen configuration, the
   right-click menu on 매크로, 예배 순서 템플릿, and autosave. Where the app
   differs, it has a reason, written in the component document or the spec.
3. **Show state with shape and color.** Don't add text, chips, or dots that
   describe a state. A live item has a `ring-live` outline or a LIVE badge, a
   problem has a `warning` icon or outline, and a value that can't be saved has
   `ring-field-error`. The detailed reason goes in a tooltip.
4. **Red means 출력.** `live` marks only what is on the screens right now; the
   one exception is `ring-field-error`. `accent` marks selection and keyboard
   focus, `accent-fill` is the surface of a primary button, `warning` marks a
   problem, and an `ok` dot marks a healthy state. Warnings and deletion are
   never red.
5. **One emphasis per window.** Each window or dialog has one primary button, at
   the far right of its footer. Every other button is secondary or ghost.
6. **Stay safe during a service.** The controls that affect 출력 (thumbnails,
   지우기, screen output) are large and stay in the same place. An action that
   cuts 출력, such as turning off a screen output or opening another 예배 순서,
   can be undone and asks for no confirmation. Only an action that can't be
   undone, such as overwriting or deleting, asks for confirmation. The optional
   되돌림 button restores the last 지우기; it is hidden by default and has no
   default shortcut. Ctrl Z undoes edits and never restores a 지우기.
7. **Dense but readable.** Design for a 1920×1080 full-screen window. UI text is
   never smaller than 14px, `body` text is 16px, and the default row height is
   `size-row` (30px). Text and grids in a panel start at the `panel-inset`
   (14px) line.

## Color

### Surfaces

Surfaces stack from bottom to top, each one step lighter than the one below it.
Don't put a control on a surface of its own color.

| Level   | Token                            | Where to use                                                                          |
| ------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| Base    | `bg-app`                         | Window, the 4px gap between panels, menu bar, toolbar, status bar                     |
| Sunken  | `bg-sunken`, `bg-well`           | Preview name band, text fields, search fields, segmented control track                |
| Panel   | `bg-panel`                       | All panels                                                                            |
| Dialog  | `bg-dialog`, `bg-inset`          | Dialogs and the list boxes inside them                                                |
| Raised  | `bg-raised`                      | Menus, popovers, tooltips, notifications, the selected toolbar tab                    |
| Control | `bg-control`, `bg-control-hover` | Secondary buttons, dropdowns, 지우기 buttons that are on, and their hover and pressed |

- Separate panels with the 4px `bg-app` gap, not a border. A 1px `line` divides
  sections inside a panel.
- Floating surfaces (menus, dialogs, notifications) have a 1px `line-strong`
  border and a shadow (`shadow-popover`, `shadow-dialog`).

### Text

- `text` is for primary text and icons, `text-2` for secondary and disabled
  text, `text-3` for counts, dates, and shortcuts, and `text-off` for marks that
  are off or disabled.
- `text-3` meets 4.5:1 on `bg-control-hover` and darker surfaces. On
  `selection`, readable text is `text-2` or brighter.
- `text-off` is never used for readable text, including the names of controls
  that are off or disabled.
- On filled surfaces: `text-on-fill` on `accent-fill` and `live`,
  `text-on-label` on 이름표 colors and 매크로 tiles, and `text-on-selection` for
  secondary text on `selection`.

### Two blues

- `accent` (#3d8bf0) is the line blue: focus rings, `ring-selected` on a
  selected thumbnail, text field focus, and drop position marks.
- `accent-fill` (#2a70dc) is the surface blue: primary buttons, and checkboxes
  and switches that are on. It is darker than `accent` so that white text reads
  at 4.7:1. A primary button's hover and pressed states use `accent-fill-hover`.
- A selected list row has a `selection` background and `text` text.

### Status

| State                     | Token                     | Shape                                                                                            |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| Live                      | `live`                    | 3px `ring-live` on thumbnails and backgrounds, LIVE badge, the dot of a screen output that is on |
| Problem                   | `warning`, `warning-tint` | Icon, outline, notification                                                                      |
| Healthy                   | `ok`                      | 6px dot in the status bar                                                                        |
| Value that can't be saved | `live`                    | `ring-field-error` on the text field, and a tooltip                                              |

### 이름표 colors

- An 이름표 has the color the user picked in the 이름표 list: `label-teal`,
  `label-green`, `label-yellow`, `label-orange`, `label-rose`, `label-violet`,
  `label-slate`, `label-gray`, or none (`label-none`).
- The band under a thumbnail and the 구성 chip are painted in that color, with
  `text-on-label` text. With no color, they use `label-gray` text on
  `label-none`.
- 이름표 colors are stored in the app's 이름표 list, not in song files.

### Output screen colors

- An output screen's background is `output-black`, and the 방송 자막 capture
  window's is `chroma`. Neither is a UI color.
- The 테마 decides the text, colors, and backgrounds inside the output screens.
  The tokens of this system don't.

### Contrast

| Pair                                           | Contrast      |
| ---------------------------------------------- | ------------- |
| `text` / `bg-panel`                            | 14.4:1        |
| `text-2` / `bg-control`                        | 6.9:1         |
| `text-3` / `bg-control-hover`                  | 4.55:1        |
| `text-2` / `selection`                         | 4.94:1        |
| `text-on-fill` / `accent-fill`                 | 4.7:1         |
| `text-on-fill` / `live`                        | 4.9:1         |
| `text-on-label` / 이름표 colors                | 6.1:1 or more |
| `warning` / `bg-panel`                         | 7.7:1         |
| `accent` (focus ring) / `bg-control-hover`     | 3.7:1         |
| `line-control` (checkbox border) / `bg-dialog` | 3.2:1         |

## Typography

The app uses one typeface, Pretendard Variable
(`fonts/PretendardVariable.woff2`, OFL). It ships with the app and is never
replaced by a system font.

| Style            | Size/line height/weight | Where to use                                                        |
| ---------------- | ----------------------- | ------------------------------------------------------------------- |
| `heading`        | 22/30/600               | Confirmation dialog titles, Preferences page titles                 |
| `title`          | 18/26/600               | Panel titles and tabs, dialog headers, the 예배 순서 and song title |
| `body`           | 16/22/400               | Lists, menus, text fields, md buttons                               |
| `body-strong`    | 16/22/600               | Names to emphasize, md primary buttons                              |
| `label`          | 14/20/400               | sm buttons, dropdowns, property names                               |
| `label-strong`   | 16/22/600               | Strong labels, sm primary buttons                                   |
| `band`           | 16/22/600               | 이름표 bands on thumbnails, 구성 chips                              |
| `caption`        | 14/20/400               | Counts, dates, status bar, second lines                             |
| `caption-strong` | 16/22/600               | List group headers, 지우기 button names                             |
| `toolbar-label`  | 14/20/400               | Toolbar button names                                                |
| `micro`          | 14/20/400               | LIVE badge and other badges                                         |

- No other sizes. No UI text is smaller than 14px, including labels, captions,
  toolbar names, tooltips, and badges. Icons aren't text and keep their own
  sizes.
- Numbers that must line up (counts, times, 슬라이드 numbers) use
  `font-variant-numeric: tabular-nums`.
- A name that doesn't fit on one line ends in an ellipsis and shows in full in a
  tooltip. Lyrics and song titles never wrap; two-line list items and 매크로
  names are the only text on two lines.
- Lyrics inside thumbnails and output previews scale with the output, not with
  these sizes: `thumb-lyrics` is 4.4cqw/1.45/700.
- In code, set a style with its shorthand variable, for example
  `font: var(--type-label);`. The global classes (`.label` and the rest) are for
  the previews.

## Spacing and sizes

- Every spacing value is a `space-*` token. The base unit is 4px; 2, 6, 10, and
  14px appear only where they are already used.
- `panel-gap` (4px) is between panels and at the window edges, `panel-inset`
  (14px) inside panels, and `dialog-inset` (16px) inside dialogs.

| Height | Token                                                        | Where to use                                                  |
| ------ | ------------------------------------------------------------ | ------------------------------------------------------------- |
| 22     | `size-control-xs`                                            | Segments, chips                                               |
| 26     | `size-control-sm`                                            | Buttons, dropdowns, and icon buttons in panels                |
| 28     | `size-row-menu`                                              | Menu items                                                    |
| 30     | `size-control-md`, `size-row`                                | Buttons and text fields in dialogs and Preferences, list rows |
| 34     | `size-panel-header`                                          | Panel headers                                                 |
| 44     | `size-dialog-header`                                         | Dialog headers                                                |
| 48     | `size-toolbar-button`                                        | Toolbar buttons                                               |
| 52     | `size-row-double`, `size-clear-button`, `size-dialog-footer` | Two-line list items, 지우기 buttons, dialog footers           |

- Buttons and text fields come in two sizes: sm (26) in panels, and md (30) in
  dialogs, Preferences, and the toolbar search field. There are no 24, 28, or
  32px buttons.
- No clickable area is smaller than 22×22. A smaller painted shape keeps a 22px
  hit area, as the slider does with `size-slider-hit`.

## Corners, borders, and shadows

| Token         | Value | Where to use                                                |
| ------------- | ----- | ----------------------------------------------------------- |
| `radius-xs`   | 2     | Small graphics inside buttons, progress bars                |
| `radius-sm`   | 3     | Segments, chips, badges, keycaps, checkboxes                |
| `radius-md`   | 4     | Buttons, text fields, thumbnails, menu items                |
| `radius-lg`   | 5     | Panels, toolbar buttons, two-line list items, notifications |
| `radius-xl`   | 6     | Menus, popovers, tooltips                                   |
| `radius-2xl`  | 8     | Dialogs                                                     |
| `radius-tile` | 14    | 매크로 tiles                                                |

- An inner element's corner radius is never larger than its outer element's.
- Panels have no shadow. Only floating surfaces do.
- Selected and live items have an outer ring (`ring-selected` 2px, `ring-live`
  3px), not a border, so that their size doesn't change.

## Icons

- Icons are Phosphor Icons, Regular weight (MIT license). Only play and pause
  use Fill. `assets/Icons/README.md` lists the 86 icons in use with their
  original names. A new icon comes from the same Phosphor Regular set.
- Icons are painted with a mask and follow the text color
  (`<span class="ll-i ll-i-14 ll-i-song"></span>`). An icon has no color of its
  own; only status icons use `warning`.
- Sizes: 12 (dropdown arrows, check marks), 14 (inside buttons and menus), 16
  (list rows, default), 18 (toolbar, 지우기 buttons), 24 (confirmation dialogs),
  28 (매크로 tiles).
- An icon-only button has a tooltip and an `aria-label`.
- No emoji or decorative images.
- There is no logo yet. The menu bar shows "LoveLight" in Pretendard 700.

## States and motion

| State          | Display                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Hover          | `bg-raised` for ghost buttons and rows, `bg-control-hover` for filled controls, `bg-toolbar-hover` for toolbar buttons |
| Pressed, on    | `bg-control-hover` and `text`                                                                                          |
| Selected       | `selection` in lists, `ring-selected` on thumbnails and tiles                                                          |
| Keyboard focus | 2px `accent` ring with a 1px offset; `ring-field-focus` for text fields                                                |
| Disabled       | `text-2` for readable text, `text-off` for icons, no hover, no lowered opacity                                         |
| Live           | `ring-live`, LIVE badge, `live` dot                                                                                    |
| Problem        | `warning` icon or outline, reason in a tooltip                                                                         |

- The focus ring shows only on `:focus-visible`, never after a mouse click.
- In the 진행 workspace, a mouse click moves keyboard focus only into a text
  field, the 슬라이드 grid, or the 예배 순서 list. A click on any other button,
  toggle, segmented control, slider, tab, or tile does its job and leaves focus
  where it was; Tab still reaches it. So Space and → after a click on a 매크로
  or a 그래픽 still go to the next 슬라이드. In 준비 and 화면 설정, a click
  focuses as usual.
- Hover and pressed backgrounds change over 100ms ease-out (`--motion-hover`),
  menus and tooltips fade over 120ms (`--motion-popover`), and dialogs fade over
  160ms (`--motion-dialog`). There is no other motion.
- Notification cards and menu row highlights change at once, with no motion (see
  `Notification` and `Menu`).
- The output screens have no UI motion. The settings decide the transitions when
  a 슬라이드 or a background changes.
- Under `prefers-reduced-motion`, all UI motion is 0.

## Window sizes and layout

Sizes are CSS pixels after Windows display scaling. A 1920×1080 screen at 125%
is 1536×864, and at 150% it is 1280×720. Design at 1920×1080 and 100%.

|                           | Narrow window                                   | Regular window                         | Wide window          |
| ------------------------- | ----------------------------------------------- | -------------------------------------- | -------------------- |
| Window width              | 1280–1599                                       | 1600–2399                              | 2400 or more         |
| Toolbar                   | `size-toolbar-compact` 40, name beside the icon | `size-toolbar` 56, name under the icon | Same as regular      |
| Left column               | `col-left-compact` 220                          | `col-left` 280                         | `col-left-wide` 320  |
| Right column              | `col-right-compact` 360                         | `col-right` 480                        | `col-right-wide` 560 |
| Default thumbnail columns | 3                                               | 4                                      | 6                    |
| Media strip               | Starts closed                                   | Starts open                            | Starts open          |
| 진행 도구 tabs            | 표시 중, 무대, 더 보기                          | All 8                                  | All 8                |
| Small previews            | A row of 64px thumbnails                        | Two 16:9 previews                      | Two 16:9 previews    |
| 지우기 buttons            | Icon only (only 모두 has a name)                | Icon and name                          | Icon and name        |

- The three workspaces (진행, 준비, 화면 설정) share one three-column frame. The
  라이브러리 exists only in 준비; the left column of 진행 holds the 예배 순서
  and 퀵 실행.
- The minimum window is `window-min-width` × `window-min-height` (1280×720).
- The center column takes the remaining width, at least `col-center-min` (560).
- Dragging the 4px gap between columns changes the left column (200–400) and the
  right column (320–720). The window size ranges set only the defaults; the app
  remembers the user's widths separately for each range.
- Below a window height of 900, the media strip starts closed. The 진행 도구
  panel is never lower than 240.
- A dialog keeps its width token (`dialog-s/m/l/xl`). In a narrower window it is
  the window width − 32 wide. It is at most the window height − 64 high, and
  only its body scrolls. A menu is at most the window height − 16 high.
- Every workspace fits at 1920×1080 and at 1280×720: rows and controls keep
  their heights, nothing clips or scrolls the page sideways, and lists and
  property fields scroll vertically instead of shrinking text.
- Output windows (본 화면, 무대 화면, 방송 자막) are separate windows at their
  monitor's native resolution. None of these rules apply to them.

### 준비 song editor

Lyrics use `body`, numbers use `caption`, and 이름표 pickers are 22px
`LabelTag`s. The layout has 14px insets, 16px gaps, an 18px number gutter, a
120px `size-editor-label` column, and a 2px `accent` bar on the active block.
Lyrics are edited without field borders. The 이름표 popup is `size-menu-max`
(320px) wide, so the nine-color row and the name fit; the name truncates in the
remaining space.

## Writing

### Words on screen

- Button names are short nouns or verbs: 출력, 지우기, 저장, 가져오기, 덮어쓰기,
  새로 시작, 복구, 만들기. Never add "~하기".
- A confirmation dialog's title is one question in 합니다체, and the buttons
  answer it: "‘만복의 근원 하나님’ 곡이 이미 있습니다. 덮어쓸까요?"
- No explanatory text on screen, such as "넣을 위치", "방금 실행", "같은 제목",
  "원본을 따름", or "파일 없음 1". State shows as shape and color, and reasons
  in tooltips.
- A tooltip holds only the name and the shortcut, with no period:
  `가사 지우기  F2`. A sentence appears only to give the reason for a problem:
  `모니터 2를 찾을 수 없습니다`.
- An error says what went wrong and offers the fix as a button ("모니터 다시
  찾기", "다시 가져오기"). It never apologizes.

### Formats

- Date "10월 25일 일요일", time "오전 11:00", duration "0:42", screen status
  "60fps".
- A panel's item count is in its footer (`PanelFooter`), never beside its title
  or tab: the number and the unit only ("3개", "0개"), never a fraction such as
  "3 / 10". Other footer details stay, such as a media size ("3개 1.8MB") and
  controls on the right.
- The live 슬라이드 position is "current / total" ("2 / 9"); it is a position,
  not a count.
- 장 is only for Bible chapters: "창세기 1장", "요한복음 3장 16절". A Bible
  item's 슬라이드 count is "2개" in its panel footer.

### Glossary

| Term                          | English                                       | Meaning                                                                 |
| ----------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| 출력                          | output                                        | Sending content to the screens                                          |
| 슬라이드                      | slide                                         | One screen of lyrics or other content                                   |
| 예배 순서                     | service order                                 | The list of items in one service                                        |
| 구역                          | section                                       | A named group in the 예배 순서; its stored item kind is `header`        |
| 템플릿                        | template                                      | A 예배 순서 used to create a new 예배 순서                              |
| 구성                          | arrangement                                   | A named 슬라이드 order saved in a song (기본, 주일용, 짧게)             |
| 이름표                        | label                                         | The name of a 슬라이드, such as 1절, 프리코러스, or 후렴                |
| 지우기                        | clear                                         | Taking content off the screens; only removing a file or an item is 삭제 |
| 본 화면, 무대 화면, 방송 자막 | main screen, stage screen, broadcast captions | The three output screens                                                |
| 테마                          | theme                                         | A saved preset that sets what each of the three screens shows           |
| 진행 도구                     | show tools                                    | The group of tabs at the bottom right of the 진행 workspace             |
| 퀵 실행                       | quick launch                                  | Frequently used items at the bottom left of the 진행 workspace          |
| 그래픽, 공지, 메시지, 타이머  | prop, notice, message, timer                  | Layers placed over the lyrics                                           |
| 라이브러리                    | library                                       | Where the source songs are kept                                         |
| 매크로                        | macro                                         | A button that runs several actions at once                              |

## Implementation

- The app loads `tokens.css` first. Component CSS uses only `var(--token-name)`,
  never a literal value.
- Component classes and state attributes follow `components/bundle.css` and the
  component documents. State is expressed with `aria-pressed`, `aria-selected`,
  `aria-checked`, `aria-expanded`, `aria-invalid`, `disabled`, and `data-state`,
  not with classes.
- The window has no Windows title bar. The 30px menu bar serves as the title
  bar, with the window control buttons at its right end.
- Display scaling follows the operating system setting. The app has no zoom of
  its own.
- Output windows are separate from the UI window and don't use the components of
  this system.
