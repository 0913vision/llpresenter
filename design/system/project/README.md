LoveLight Presenter is an app that sends lyrics, Bible verses, and announcements to several screens during a service. The operator watches the service from a dark room and changes the screens with one click. Every rule in this system exists so that this one click is never wrong.

The app has one theme, dark. All values are in `tokens.json`, and each CSS variable has the same name as its token (`--bg-panel`). Component classes start with `ll-` and live in `components/bundle.css`.

## Principles

1. **The screens come first.** Keep the UI dark and quiet. The brightest things on screen must be the 출력 (output) preview and the thumbnails. Pick UI surfaces only from the gray steps between `bg-app` and `bg-control-hover`.
2. **Follow ProPresenter.** Give a feature that ProPresenter also has the same place and the same behavior as in ProPresenter (a click on a 슬라이드 (slide) outputs it at once, the F1 to F7 지우기 (clear) actions, Look, song 구성 (arrangement), screen configuration, stage layout editing, the right-click menu on macros, 예배 순서 (service order) 틀 (template), autosave). When you do something differently, have a reason, and write that reason in this document or in the draft report.
3. **Show state with shape and color.** Don't add text, chips, or dots that describe a state. Mark something live only with a `ring-live` outline or a LIVE badge, a problem only with a `warning` icon or outline, and a value that can't be saved only with `ring-field-error`. Put the detailed reason in a tooltip.
4. **Use red only for 출력.** Use `live` only for what is on the screens right now. Use `accent` for selection and keyboard focus, `accent-fill` for the surface of a primary button, `warning` for problems, and an `ok` dot for a healthy state. Don't use red for warnings or deletion.
5. **Put emphasis in one place.** Give each window or dialog one primary button, at the far right of the footer. Make every other button a secondary or ghost button.
6. **Stay safe during a service.** Make the controls that affect 출력 (thumbnails, 지우기, screen output) large, and keep them in the same place. An optional clear undo button restores the last 지우기; its visibility setting is off by default and it has no default shortcut. Ctrl Z is edit undo and never restores a clear. Make actions that cut 출력 (turning off screen output, opening another 예배 순서) undoable without a confirmation dialog too, and show a confirmation dialog only for actions that can't be undone (overwriting, deleting).
7. **Keep it dense but readable.** The default row height is `size-row` (30px), and the default text is `body` (13px). Start all text and grids in a panel at the left `panel-inset` (14px) line.

## Color

### Surfaces

Surfaces stack from bottom to top. A surface on top is one step lighter than the one below it. Don't put a control on a surface of the same color.

| Level | Token | Where to use |
| --- | --- | --- |
| Base | `bg-app` | Window, the 4px gap between panels, menu bar, toolbar, status bar |
| Sunken | `bg-sunken`, `bg-well` | Preview name band, text fields, search fields, segmented control track |
| Panel | `bg-panel` | All panels |
| Dialog | `bg-dialog`, `bg-inset` | Dialogs and the list boxes inside them |
| Raised | `bg-raised` | Menus, popovers, tooltips, notifications, the selected toolbar tab |
| Control | `bg-control`, `bg-control-hover` | Secondary buttons, dropdowns, 지우기 buttons that are on / their hover and pressed states |

- Separate panels with a 4px `bg-app` gap instead of a border. Use a 1px `line` only to divide sections inside a panel.
- Give floating surfaces (menus, dialogs, notifications) both a 1px `line-strong` border and a shadow (`shadow-popover`, `shadow-dialog`).

### Text

- Use `text` for primary text and icons, `text-2` for secondary text and ghost button icons, `text-3` for counts, dates, and shortcuts, and `text-off` for things that are off or disabled.
- Use `text-3` only on `bg-panel`, `bg-dialog`, and `bg-raised`. On `bg-control` its contrast is 4.3:1, so use `text-2` or brighter.
- Don't use `text-off` for text that must be read. Use it only to show an off state.
- Text on filled surfaces: use `text-on-fill` on `accent-fill` and `live`, `text-on-label` on 이름표 (label) colors and macro tiles, and `text-on-selection` for secondary text on `selection`.

### Two blues

- `accent` (#3d8bf0) is the line blue. Use it for focus rings, `ring-selected` on a selected thumbnail, text field focus, and drop position marks.
- `accent-fill` (#2a70dc) is the surface blue. Use it for primary buttons and for checkboxes and switches that are on. It is darker than `accent` so that white text reads at 4.7:1. For the hover and pressed states of a primary button, go one step darker with `accent-fill-hover`.
- A selected row in a list has a `selection` background and `text` text.

### Status

| State | Token | Shape |
| --- | --- | --- |
| Live | `live` | 3px `ring-live` on thumbnails and backgrounds, LIVE badge, the dot on a screen output button that is on |
| Problem | `warning`, `warning-tint` | Icon, outline, notification |
| Healthy | `ok` | 6px dot in the status bar |
| Value that can't be saved | `live` | `ring-field-error` on the text field, and a tooltip |

### 이름표 colors

- An 이름표 is the name of a 슬라이드, such as 1절 (verse 1), 프리코러스 (pre-chorus), or 후렴 (chorus). It has the color that the user picked in the 이름표 list: `label-teal`, `label-green`, `label-yellow`, `label-orange`, `label-rose`, `label-violet`, `label-slate`, `label-gray`, or none (`label-none`).
- Paint the whole band under a thumbnail and the 구성 chip in that color, and write the text in `text-on-label`. With no color, use `label-gray` text on a `label-none` background.
- Store 이름표 colors in the app's 이름표 list, not in song files.

### Output screen colors

- The background of an output screen is `output-black`, and the capture window for 방송 자막 (broadcast captions) is `chroma`. Don't use either as a UI color.
- Look and the lyric style decide the text, colors, and backgrounds inside the output screens. The tokens of this system don't.

### Contrast

| Pair | Contrast |
| --- | --- |
| `text` / `bg-panel` | 14.4:1 |
| `text-2` / `bg-control` | 6.9:1 |
| `text-3` / `bg-panel` | 5.1:1 |
| `text-3` / `bg-raised` | 4.5:1 |
| `text-on-fill` / `accent-fill` | 4.7:1 |
| `text-on-fill` / `live` | 4.9:1 |
| `text-on-label` / 이름표 colors | 6.1:1 or higher |
| `warning` / `bg-panel` | 7.7:1 |
| `accent` (focus ring) / `bg-control-hover` | 3.7:1 |
| `line-control` (checkbox border) / `bg-dialog` | 3.2:1 |

## Typography

Date fields use the [Calendar](components/Calendar/README.md) popover. Its
250px width, 30px day cells and 24px weekday row follow the current type scale.
The design card covers selection, today, focus and disabled year boundaries.

The app uses one typeface, Pretendard Variable (`fonts/PretendardVariable.woff2`, OFL). Ship the file with the app, and don't replace it with a system font.

| Style | Size/line height/weight | Where to use |
| --- | --- | --- |
| `heading` | 20/28/600 | Confirmation dialog titles, Preferences page titles |
| `title` | 16/22/600 | Dialog headers, the song title in a panel header |
| `body` | 16/22/400 | Lists, menus, text fields, md buttons |
| `body-strong` | 16/22/600 | Names to emphasize, md primary buttons |
| `label` | 14/20/400 | sm buttons, dropdowns, property names |
| `label-strong` | 16/22/600 | Panel tabs, sm primary buttons |
| `band` | 16/22/600 | 이름표 bands on thumbnails, 구성 chips |
| `caption` | 14/20/400 | Counts, dates, status bar, second lines |
| `caption-strong` | 16/22/600 | List group headers, 지우기 button names |
| `toolbar-label` | 14/20/400 | Toolbar button names |
| `micro` | 12/16/400 | LIVE badge |

- Use `font-variant-numeric: tabular-nums` for numbers that must line up, such as counts, times, and 슬라이드 numbers.
- Truncate a name that doesn't fit on one line with an ellipsis, and show the full name in a tooltip. Don't wrap lyrics or song titles onto two lines (two-line list items and macro names are the only exceptions).
- M3 live-check proposal: grow general UI text one step, from body 14/20 to
  16/22 and labels/captions 12/16 to 14/20. Pretendard and weights stay the same.
  Only the LIVE badge keeps the compact 12/16 `micro` style.
- Keep the minimum window at 1280x720 without horizontal page scrolling.
  Single-line list/menu rows and standard control heights stay fixed; their
  new line heights still fit. Two-line rows grow from 44 to 52px, and count
  badges/keycaps from 18 to 22px. Lists scroll vertically rather than shrinking
  the text. Long labels retain ellipsis and tooltips.
- These are UI sizes. Lyrics inside thumbnails and output previews keep their
  output-relative scale; `thumb-lyrics` stays 4.4cqw/1.45/700.
- The service-order name keeps its separately chosen 16/22/600 component
  style (header A); it doesn't grow with the general `heading` token.
- Don't create other sizes outside this table.
- In code, set a style with its shorthand variable, for example `font: var(--type-label);`. Each style has one (`--type-<style>`). The global classes (`.label` and the rest) are for the previews.

## Spacing and sizes

### Stage layout smart guides

The future stage editor uses [SmartGuides](components/SmartGuides/README.md)
for temporary alignment to canvas/element edges and centers. `guide` aliases
`accent`; `size-guide-line` is 1 CSS pixel and `size-guide-snap` is 6 viewport
CSS pixels, independent of canvas zoom. Lines appear and disappear immediately,
are hidden while Alt bypasses snapping and never enter the saved/output layout.
The separate 20px document grid remains available; a matching guide wins on its
axis. See the component README and reference card before implementing M3-O3.

### General spacing

- Pick every spacing value from the `space-*` tokens. The base is a 4px unit, but use 2, 6, 10, and 14px only where they are already used.
- Use `panel-gap` (4px) between panels and at the window edges, `panel-inset` (14px) inside panels, and `dialog-inset` (16px) inside dialogs.

| Height | Token | Where to use |
| --- | --- | --- |
| 22 | `size-control-xs` | Segments, chips |
| 26 | `size-control-sm` | Buttons, dropdowns, and icon buttons in panels |
| 28 | `size-row-menu` | Menu items |
| 30 | `size-control-md`, `size-row` | Buttons and text fields in dialogs and Preferences, list rows |
| 34 | `size-panel-header` | Panel headers |
| 44 | `size-dialog-header` | Dialog headers |
| 48 | `size-toolbar-button` | Toolbar buttons |
| 52 | `size-row-double`, `size-clear-button`, `size-dialog-footer` | Two-line list items, 지우기 buttons, dialog footers |

- Buttons and text fields come in two sizes only: sm (26) and md (30). Use sm in panels, and md in dialogs, Preferences, and the toolbar search field. Don't make 24, 28, or 32px buttons.
- Don't make a clickable area smaller than 22×22.

## Corners, borders, and shadows

| Token | Value | Where to use |
| --- | --- | --- |
| `radius-xs` | 2 | Small graphics inside buttons, progress bars |
| `radius-sm` | 3 | Segments, chips, badges, keycaps, checkboxes |
| `radius-md` | 4 | Buttons, text fields, thumbnails, menu items |
| `radius-lg` | 5 | Panels, toolbar buttons, two-line list items, notifications |
| `radius-xl` | 6 | Menus, popovers, tooltips |
| `radius-2xl` | 8 | Dialogs |
| `radius-tile` | 14 | Macro tiles |

- Don't make the corner radius of an inner element larger than that of its outer element.
- Don't use shadows on panels. Use shadows only on floating surfaces.
- Draw selected and live items with an outer ring (`ring-selected` 2px, `ring-live` 3px) instead of a border, so that their size doesn't change.

## Icons

- Icons come from Phosphor Icons in the Regular weight (MIT license). Only play and pause use Fill. The 86 icons in use and their original names are in `assets/Icons/README.md`. If you need an icon that isn't in the list, pick it from the same Phosphor Regular set.
- Icons are painted with a mask, so they follow the text color (`<span class="ll-i ll-i-14 ll-i-song"></span>`). Don't give an icon its own color. Only status icons (warning) use `warning`.
- Sizes: 12 (dropdown arrows, check marks), 14 (inside buttons and menus), 16 (list rows, default), 18 (toolbar, 지우기 buttons), 24 (confirmation dialogs), 28 (macro tiles).
- Always give an icon-only button a tooltip and an `aria-label`.
- Don't use emoji or decorative images.
- There is no logo yet. In the menu bar, write "LoveLight" in Pretendard 700.

## States and motion

| State | Display |
| --- | --- |
| Hover | `bg-raised` for ghost buttons and rows, `bg-control-hover` for filled controls, `bg-toolbar-hover` for toolbar buttons |
| Pressed, on | `bg-control-hover` and `text` |
| Selected | `selection` in lists, `ring-selected` on thumbnails and tiles |
| Keyboard focus | 2px `accent` ring with a 1px offset. `ring-field-focus` for text fields |
| Disabled | `text-off` for text and icons, no hover. Don't lower the opacity |
| Live | `ring-live`, LIVE badge, `live` dot |
| Problem | `warning` icon or outline, reason in a tooltip |

- Show the keyboard focus ring only on `:focus-visible`. Don't show it when the user clicks with the mouse.
- In the 진행 workspace, a mouse click moves keyboard focus only into a text field, the 슬라이드 grid, or the 예배 순서 list. A click on any other button, toggle, segmented control, slider, tab, or tile does its job and leaves keyboard focus where it was; Tab still moves focus to it. So Space and → after a click on a 매크로 or a 소품 still go to 다음 슬라이드 instead of pressing that control again. In 준비 and 화면 설정, a click focuses as usual.
- Background changes for hover and pressed take 100ms ease-out, menus and tooltips fade over 120ms, and dialogs fade over 160ms. Don't add any other motion. In code, use the tokens `--motion-hover`, `--motion-popover`, and `--motion-dialog` (for example `transition: background-color var(--motion-hover)`).
- Don't add UI motion to the output screens. Look and the settings decide the transitions when a 슬라이드 or a background changes.
- Under `prefers-reduced-motion`, set all UI motion to 0.
- Notification cards appear, replace and close immediately. Their operational
  state must stay legible without a fade or translation; controls still use
  `motion-hover`. See the Notification README for placement and alignment.
- Menu row backgrounds are an exception to hover motion: entering and leaving
  a row changes its highlight immediately. Menu appearance and submenu timing
  remain the separate behaviors documented in `Menu`.

## Window sizes and layout

Sizes are CSS pixels after Windows display scaling is applied. A 1920×1080 screen at 125% is 1536×864, and at 150% it is 1280×720. The drafts are drawn for 1920×1080 at 100%.

| | Narrow window | Regular window | Wide window |
| --- | --- | --- | --- |
| Window width | 1280–1599 | 1600–2399 | 2400 or more |
| Toolbar | `size-toolbar-compact` 40, name to the right of the icon | `size-toolbar` 56, name under the icon | Same as regular |
| Left column | `col-left-compact` 220 | `col-left` 280 | `col-left-wide` 320 |
| Right column | `col-right-compact` 360 | `col-right` 480 | `col-right-wide` 560 |
| Default thumbnail columns | 3 | 4 | 6 |
| Media strip | Starts closed | Starts open | Starts open |
| 진행 도구 (show tools) tabs | 표시 중 (showing), 무대 (stage), 더 보기 (more) | All 8 | All 8 |
| Small previews | A row with 64px thumbnails | Two 16:9 previews | Two 16:9 previews |
| 지우기 buttons | Icon only (only "모두" (all) has a name) | Icon and name | Icon and name |

- The minimum window size is `window-min-width` × `window-min-height` (1280×720).
- The center column takes all remaining width. Its minimum width is `col-center-min` (560).
- The user can drag the 4px gap between columns to change the width of the left column (200–400) and the right column (320–720). The window size ranges set only the defaults. Remember the widths that the user changes separately for each range.
- If the window is less than 900 high, the media strip starts closed. The 진행 도구 panel doesn't shrink below a height of 240.
- Dialogs keep their width tokens (`dialog-s/m/l/xl`). If the window is narrower than that, a dialog is the window width − 32 wide. Its maximum height is the window height − 64, and only its body scrolls. The maximum height of a menu is the window height − 16.
- Output windows (본 화면 (main screen), 무대 화면 (stage screen), 방송 자막) are separate windows and draw at the native resolution of their monitor. The rules above don't apply to them.
- The three workspaces (진행 (Show), 준비 (Prep), 화면 설정 (Screen settings)) use the same three-column frame. The library exists only in 준비, and the left column of 진행 holds the 예배 순서 and 퀵 실행 (quick launch).

## Writing

- Write button names as short nouns or verbs: 출력, 지우기, 저장 (save), 가져오기 (import), 덮어쓰기 (overwrite), 새로 시작 (start over), 복구 (recover), 만들기 (create). Don't add "~하기" to a button name.
- Write the title of a confirmation dialog as one question in 합니다체: "‘만복의 근원 하나님’ 곡이 이미 있습니다. 덮어쓸까요?" (A song named ‘만복의 근원 하나님’ already exists. Overwrite it?) The buttons answer that question.
- Don't put explanatory text on screen. Examples removed from the drafts: "넣을 위치" (insert position), "방금 실행" (just ran), "같은 제목" (same title), "원본을 따름" (follows the source), "파일 없음 1" (1 missing file). Show state with shape and color, and reasons in tooltips.
- Write only the name and the shortcut in a tooltip: "가사 지우기  F2". Don't end it with a period. Write a sentence only to give the reason for a problem: "모니터 2를 찾을 수 없습니다" (Can't find monitor 2).
- For errors and problems, say what went wrong, and offer the fix as a button ("모니터 다시 찾기", "다시 가져오기"). Don't apologize.
- Formats: date "10월 25일 일요일", time "오전 11:00", 슬라이드 position "2 / 9", counts "슬라이드 9개" and "항목 12개", duration "0:42", screen status "60fps".
- Keep 장 for Bible chapters: "창세기 1장" and "요한복음 3장 16절". A Bible item's slide count still uses "슬라이드 2개"; it is separate from its chapter and verse reference. Keep unrelated words such as 저장 (save), 장치 (device), and 가장자리 (edge).

### Glossary

| Use | English gloss | Don't use | Meaning |
| --- | --- | --- | --- |
| 출력 | output | 송출, 라이브 | Sending content to the screens |
| 슬라이드 | slide | 장 (for a slide) | One screen of lyrics or other content; Bible chapter numbers keep 장 |
| 예배 순서 | service order | 재생목록, 플레이리스트, 큐시트 | The list of items in one service |
| 구역 | section | 머리글 | A named group in the 예배 순서; its stored item kind remains `header` |
| 틀 | template | 템플릿 | A 예배 순서 that you use to create a new 예배 순서 |
| 구성 | arrangement | 편곡, 어레인지먼트 | A named 슬라이드 order saved in a song (기본, 주일용, 짧게) |
| 이름표 | label | 그룹, 태그 | The name of a 슬라이드, such as 1절, 프리코러스, or 후렴 |
| 지우기 | clear | 삭제 (for 출력), 클리어 | Taking content off the screens. Only removing a file or an item is "삭제" (delete) |
| 본 화면, 무대 화면, 방송 자막 | main screen, stage screen, broadcast captions | 메인, 스테이지, 송출 화면 | The three output screens |
| Look | Look | 룩, 레이아웃 | A set that decides which layers each screen shows |
| 진행 도구 | show tools | 쇼 컨트롤 | The group of tabs at the bottom right of the 진행 workspace |
| 퀵 실행 | quick launch | 단축 목록 | Frequently used items at the bottom left of the 진행 workspace |
| 소품, 공지, 메시지, 타이머 | prop, notice, message, timer | Props, 배너 | Layers placed over the lyrics |
| 라이브러리 | library | 곡 목록, DB | Where the source songs are kept |
| 매크로 | macro | 스크립트 | A button that runs several actions at once |

## Implementation notes

- The preparation song editor uses body 16/22 lyrics, caption 14/20 numbers, and 22px `LabelTag` pickers. Its Reflow layout has 14px insets, 16px gaps, an 18px number gutter, a 120px `size-editor-label` column, and a 2px accent bar on the active block. Lyrics edit without field chrome. The label popup uses `size-menu-max` (320px) so the persistent nine-color row and its name fit; names truncate in the remaining space.

- Load `tokens.css` first in the app, and use only `var(--token-name)` in component CSS. Don't write values directly.
- Follow `components/bundle.css` and each component document for component classes and state attributes. Express state with `aria-pressed`, `aria-selected`, `aria-checked`, `aria-expanded`, `aria-invalid`, `disabled`, and `data-state` instead of classes.
- Open the window without the Windows title bar. The menu bar (30px) also serves as the title bar, and the window control buttons are at its right end.
- Follow the operating system setting for display scaling. Don't add a separate zoom inside the app.
- Output windows are separate from the UI window and don't use the components of this system.
