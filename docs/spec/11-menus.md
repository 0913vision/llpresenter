# Menus and popovers

What every menu and popover in the app shows and does. Menus follow ProPresenter
(PP) 7 as of March 2026; the PP screens were checked in Renewed Vision support
articles and tutorial videos, cited by link and time. The appearance of a menu
(sizes, colors, states) is in the `Menu` README of the design system; this file
sets the rows. Status: Now (exists), New (build), Off (disabled row for a PP
feature we lack), Moved, Removed.

## Shared rules

- **Purpose:** A menu acts on the one thing that was clicked (a 매크로, a
  그래픽, a 슬라이드), or adds one kind of thing. Rows are grouped by what they
  do, in ProPresenter (PP) order. Nothing else goes into a menu: no palettes, no
  search fields, no settings rows.
- **Reference:** PP 7 as of March 2026 (Renewed Vision support articles and
  tutorial videos). Where PP has the same menu, use its rows, groups, and order.
  Where no PP screen could be found, the section says "Not seen in PP" and
  follows the list-row rule below.
- **Rows PP has and we lack:** Show them as disabled rows (text-off, no hover,
  tooltip "이번 버전에서는 쓸 수 없음"), so the menu keeps its final shape and
  the feature can be built later (decided 2026-10-30).
- **Hide or disable:** Hide a row that does not apply to this object (PP hides
  Edit Action and Remove Actions on a 매크로 with no actions). Disable a row
  that applies but cannot run now (붙여넣기 with an empty clipboard).
- **Appearance:** Measured from PP and scaled to our 16px text: width 276 (or
  wider for long rows), vertical padding 6, radius 12, row 28, highlight inset 5
  with radius 9, text starts 28 from the menu edge, separator 1px
  rgba(255,255,255,0.11) with 6 above and below and 18 from each side, border
  inset 1px rgba(255,255,255,0.2) plus outer 1px rgba(0,0,0,0.6) and shadow 0 12
  32 rgba(0,0,0,0.55), text weight about 460, hover accent-fill with white text,
  the parent of an open submenu rgba(255,255,255,0.13).
- **Check:** A ✓ (14px) sits in the left padding, 10 from the edge. Text never
  moves, and no row keeps an empty leading slot.
- **Submenu:** A › (about 6x11) 19 from the right edge. Targets in a submenu may
  be grouped under gray headings (13px, weight 600, text-3), as PP does for Add
  To.
- **Icons:** Only where PP has them in that menu: 잘라내기 (scissors), 복사
  (copy), 붙여넣기 (clipboard), 복제 (plus-square), and rows that name an action
  or a kind (동작 편집, 동작 삭제: <대상>, the kinds in 동작 추가). 삭제 has the
  trash icon in the 슬라이드, 그래픽, and 매크로 menus and none in the
  라이브러리 menu, as in PP. Icon 18 at the text start, its text at 55. In a
  group where some rows have icons, rows without one (이름 바꾸기) start their
  text at 55 too. Phosphor Regular, the same set as the app.
- **Delete:** 삭제 is the last row, in its own group or at the end of the
  clipboard group as PP has it, in normal text color.
- **Delete rule (user decision, November 2):** As editing programs do, a delete
  that Ctrl Z can undo happens at once with no question. A delete that cannot be
  undone asks first in the app's AlertDialog with 삭제 as the confirm button,
  and the question says where the thing is used when other places use it ("이
  곡은 예배 2곳에서 씁니다"). Undoable today: 예배 순서 항목 and 구역 (the 예배
  순서 history), and 슬라이드, 그룹, and 구성 순서 in the 곡 편집 window (its
  history until 저장). Asking: 곡, 테마 (always, with where it is used or the
  default of a kind), 매크로, 매크로 모음, 그래픽, 타이머, 공지, 메시지 틀,
  이름표, 오버레이, 미디어, 재생목록, 예배, 템플릿, 화면, 퀵 실행 항목, and 구성
  (from 준비). Not covered: 단축키 지우기 and 재생목록에서 빼기 (a removal that
  keeps the thing itself) ask nothing and have no undo; the lead decides whether
  they get an undo.
- **Wording:** 이름 바꾸기 everywhere (not 이름 변경). A row that opens a dialog
  or asks for more input ends with "…" as in PP (수정…, 전환 효과…).
- **Window commands:** A command that opens a window ends with "…" and has one
  label everywhere it is offered: 곡 편집…, 순서 편집…, 환경설정…, 화면 설정….
  The library menu, the 진행 and 준비 row menus, the slide menus, and the
  buttons that open the same window use that one label (`windowCommandLabels`).
- **Row actions in a footer:** When a list keeps a row's actions in a bar below
  it (the 단축키 page's 기본값으로 and 지우기), the row's right-click and Menu
  key menu offers the same actions.
- **Copy names:** Every copy is named `<name> 복사본`, then `<name> 복사본 2`,
  `3`, … when that name is taken. A copy of a copy is named from the original
  (`찬양 복사본` copies to `찬양 복사본 2`). 매크로 복제, 테마 복제, the 테마
  and 곡 다른 이름으로 저장 suggestions, and the 템플릿 saved beside one of the
  same name all follow it (`copyName`; B25 rule 5).
- **Reordering:** A list the operator can arrange (the 예배 순서, the 퀵 실행
  list, the 매크로 모음 list, the 이름표 chips, and the 순서 편집 tokens) moves
  a row by one behavior: a press moves 4 pixels before it becomes a drag, the
  drop place is drawn as one insertion line (a marker before a chip), Esc puts
  the row back, and Alt ↑ and Alt ↓ move the focused row by one place (Alt ← and
  Alt → for chips). Each list keeps its own write (B25 rule 6; 10).
- **Two-row menus:** No separator between the only two rows.
- **List-row rule:** For a named thing in a list whose PP menu we could not see,
  use the shape PP gives such things (Look preset: Make Live | Duplicate,
  Rename, Delete; playlist: Rename, Save As… | Duplicate, Delete; prop: Edit…, …
  | Duplicate, Rename | Delete): its own command first (수정…, 지금 적용) |
  복제, 이름 바꾸기 | 삭제. No icons. 복제 is a disabled row where we cannot
  copy yet. A built-in thing that cannot change (기본 구성, 모든 매크로) shows
  the same rows disabled with the reason in the tooltip.
- **Keyboard:** The Menu keyboard rules stay (arrows, Home, End, Enter, Space,
  Esc, type-ahead, Menu key and Shift F10).
- **Select lists:** The 34 Select dropdowns keep their options and take the same
  appearance. Five lists that have no name get one: MacroActionDialog 동작,
  대상, 무대 화면, 표시 시간; PropDialog 내용 and 이미지; NoticeCreateDialog
  이미지 재생목록; 출처 위치; the two 굵기 lists.

## 복제 by kind

Every list whose right-click menu has 복제 copies the one thing that was
clicked. The copy gets a new id and the copy name (`copyName`, above), lands
right after the original, and is selected where the list has a selection. 편집 >
복제 and Ctrl D (`edit.duplicate`) run the same handler as the row where that
list has the focus, and the row and the key give the same reason when they can't
run. A copy that would pass the list's cap is refused with the cap's reason, as
adding one is (the row is disabled with that reason); a locked list gives its
lock reason first. A copy never holds live state: no running timer, no 공지 in
progress, nothing on output.

| Kind            | The copy holds                                                                               | Not copied       | Notes                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 메시지 문구     | name, text, icon, targets, duration                                                          |                  |                                                                                                                                               |
| 공지 세트       | the images in order, interval, 반복, target screens                                          | the running 공지 | The copy lists the same media ids.                                                                                                            |
| 그래픽          | content (image or text and its style), target screens                                        | whether it is on |                                                                                                                                               |
| 타이머          | kind and its time fields (duration, time and date, start value, 0 지나면)                    | the run          | A new timer has its own run and its own live-timer slot.                                                                                      |
| 퀵 실행 항목    | name and what it opens (song, Bible passage, 그래픽, 매크로, 검은 화면) with the same ref    |                  | A row of a 타이머 gets its own new 타이머 definition (the copy name on both), so the two rows never share one; the 타이머 is copied first.    |
| 매크로 모음     | name and the same 매크로 (a 매크로 may be in several collections)                            |                  | The 매크로 are not copied.                                                                                                                    |
| 매크로          | name, icon, color, actions, 시작할 때 실행                                                   |                  | Built earlier.                                                                                                                                |
| 테마            | all screens' layouts                                                                         |                  | Built earlier.                                                                                                                                |
| 라이브러리 곡   | title, groups and their slides, 이름표, 구성, default background                             |                  | A new song file; the title takes the copy name against the library's titles.                                                                  |
| 예배 순서 항목  | its own settings: 테마, 배경, 메모, 시작할 때, 구성, its own order (`customOrder`), 오버레이 | what is live     | One undo step (10, "Focus precedence"). A 구역 copies the whole section with its items, as one step, since moving a header moves its section. |
| 미디어          | the entry: name, kind, properties (fit, end, sound)                                          | the file         | A second entry on the same file; deleting one keeps the file and the other (08).                                                              |
| 미디어 재생목록 | name and the same media ids                                                                  | the media        |                                                                                                                                               |
| 예배 (list row) | the whole 예배 순서 with its items and settings                                              |                  | A new service file named with the copy name; the list keeps the open service open.                                                            |

## Menus

### 매크로 오른쪽 클릭

- Where: 진행 도구 > 매크로 (MacroPanel)
- Opens: Right-click, Menu key, or Shift F10 on a 매크로 tile or row.
- Purpose: Act on this one 매크로.
- PP: PP macro right-click (https://www.youtube.com/watch?v=08NRxdDFdHc at 3:20
  and 3:20 with actions;
  https://support.renewedvision.com/hc/en-us/articles/4402663090323).

| Group | Row                      | Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Status                                                                                                                                                                                 |
| ----- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 모음에 추가 ›            | Submenu of all collections; one that already holds this 매크로 shows ✓ and is disabled; then a separator and 새 모음 (PP Add To, seen on props at 1:57). Picking one adds the 매크로 to it.                                                                                                                                                                                                                                                                                                                                  | New                                                                                                                                                                                    |
| 1     | 모음으로 옮기기 ›        | Same list; the shown collection shows ✓ and is disabled; then 새 모음 (PP Move To, seen on props at 1:56). Picking one moves the 매크로 out of the shown collection. Disabled while the tab shows 모든 매크로.                                                                                                                                                                                                                                                                                                               | New                                                                                                                                                                                    |
| 2     | 이름 바꾸기              | Puts the name into rename mode.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Now                                                                                                                                                                                    |
| 2     | 색 바꾸기                | Opens the color popover (the 8 macro colors) at the tile. Replaces the color row at the bottom of the menu.                                                                                                                                                                                                                                                                                                                                                                                                                  | New                                                                                                                                                                                    |
| 2     | 아이콘 바꾸기            | Opens the icon grid.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Now                                                                                                                                                                                    |
| 2     | 시작할 때 실행           | Turns run-at-startup on or off; ✓ when on. The tile keeps its clock mark.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Now                                                                                                                                                                                    |
| 3     | 동작 추가 ›              | Submenu of action kinds in PP order: 지우기 ›, 테마 바꾸기 ›, 슬라이드 출력 대상 › (off), 타이머 ›, 그래픽 ›, 메시지 ›, 공지 ›, 배경 미디어 ›, 오디오 ›, 오디오 재생 목록 ›, 외부 장치 신호 › (off), 오디오 입력 › (off), 영상 입력 › (off), 매크로 ›, 녹화와 방송 › (off), then 동작 팔레트. 지우기 › lists 모두 지우기 and then each layer (가사, 미디어, 공지, 그래픽, 메시지, 오디오) directly, with no 레이어 지우기 level in between: newer than PP (B5). Each kind opens its targets; picking one appends the action. | Now                                                                                                                                                                                    |
| 3     | 미디어 동작 추가…        | PP: adds a media action from a file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Off                                                                                                                                                                                    |
| 4     | 동작 편집: <대상> ›      | One row per action, with the kind icon (for example "동작 편집: 찬양" for a theme action). Submenu: that kind's choices with ✓ on the current one (which theme, which timer and operation)                                                                                                                                                                                                                                                                                                                                   | 동작 삭제: <대상>                                                                                                                                                                      | <종류> 열기… (for example 테마 편집…). PP Edit Action (Actions video 2:36). Replaces 동작 편집 › and its popover. Hidden when the 매크로 has no actions. | New |
| 4     | 동작 삭제: <대상>        | With exactly one action: one row with the kind icon, right under its 동작 편집 row; removes it.                                                                                                                                                                                                                                                                                                                                                                                                                              | New                                                                                                                                                                                    |
| 5     | 동작 삭제 ›              | With two or more actions: submenu of the actions, each with its kind icon                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 모두 삭제. Picking one removes it. Hidden when there are none. PP switches between the two forms the same way (Actions video 2:52 and 2:53; Remove All in the Looks setup video 5:25). | Now                                                                                                                                                      |
| 6     | 속성…                    | PP Inspector….                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Off                                                                                                                                                                                    |
| 7     | 잘라내기, 복사, 붙여넣기 | PP clipboard rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Off                                                                                                                                                                                    |
| 7     | 복제                     | Adds "<name> 복사본" after it ("<name> 복사본 2", 3, … when taken).                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Now                                                                                                                                                                                    |
| 8     | 삭제                     | Confirms, then deletes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Now                                                                                                                                                                                    |
| -     | 실행                     | Removed: a click runs the 매크로, and PP has no such row.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Removed                                                                                                                                                                                |

- With several 매크로 selected, the menu acts on all of them (PP 7.16 video
  5:57, Add To on four macros). Rows that need one 매크로 (이름 바꾸기, 동작
  편집) are hidden then.
- PP 7.16 (2024) shows 동작 편집 › as one submenu when there are two or more
  actions; the March 2026 build shows one row per action. We follow 2026.

### 매크로 모음 팝오버

- Where: 진행 도구 > 매크로, header button (MacroView)
- Opens: Click the collection button (shows the current name and ⌄).
- Purpose: Pick which collection the tab shows; add a collection.
- PP: PP Macro Collections popover (https://www.youtube.com/watch?v=08NRxdDFdHc
  at 2:16).

| Group    | Row                                   | Does                                                                                                                                                  | Status                                                                                                                                                                                                                                                                                             |
| -------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| head     | 제목 "매크로 모음" and + at the right | + adds a collection at once, named 새 모음 (with a number when that name is taken), and selects it; 이름 바꾸기 changes the name: newer than PP (B9). | New                                                                                                                                                                                                                                                                                                |
| list     | 모든 매크로                           | Always first. Shows every 매크로. Cannot be renamed or deleted.                                                                                       | Now                                                                                                                                                                                                                                                                                                |
| list     | <모음 이름>                           | Shows that collection. The current row is filled blue; no check, no count.                                                                            | Now                                                                                                                                                                                                                                                                                                |
| list     | Reorder                               | Drag a collection row to reorder (PP 7.16 video 7:00, a collection dragged to the top).                                                               | New                                                                                                                                                                                                                                                                                                |
| row menu | 복제, 이름 바꾸기                     | 삭제                                                                                                                                                  | Right-click on a collection row, by the list-row rule. Deleting keeps the 매크로. 모든 매크로 shows the rows disabled. PP renames a new collection inline right after + (7.16 video 5:18) and the support article says "right-click the collection and select Rename"; the full menu was not seen. | Moved |

- Replaces the Select with 이름 바꾸기 and 삭제 at the bottom.

### 슬라이드 오른쪽 클릭

- Where: 진행 and 준비 thumbnail grids (item view and song editor).
- Opens: Right-click, Menu key, or Shift F10 on a slide.
- Purpose: Act on this one slide.
- PP: PP slide right-click (https://www.youtube.com/watch?v=08NRxdDFdHc at
  1:58).

| Group | Row                                                | Does                                                                                                                       | Status |
| ----- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1     | 빠른 편집                                          | PP Quick Edit.                                                                                                             | Off    |
| 1     | 곡 편집…                                           | Opens the 곡 편집 window (05) with this slide selected and scrolled into view, like 곡 편집… on a 예배 순서 song item.     | New    |
| 2     | 사용 안 함                                         | PP Disable.                                                                                                                | Off    |
| 3     | 테마 ›, 전환 효과…, 단축키…, 다음 타이머로 넘기기… | PP Themes, Transitions, Hot Key, Go to Next Timer.                                                                         | Off    |
| 4     | 동작 추가 ›, 미디어 동작 추가…                     | PP slide actions. With actions, PP adds "동작 삭제: <대상>" rows here.                                                     | Off    |
| 5     | 이름표 ›                                           | 이름표 없음, every 이름표 with its color swatch and current check, then 이름표 관리…. The same list as the 이름표 popover. | Off    |
| 5     | 슬라이드 이름 ›                                    | PP Label.                                                                                                                  | Off    |
| 6     | 글자 모양 복사, 글자 모양 붙여넣기                 | PP Copy and Paste Text Style.                                                                                              | Off    |
| 7     | 잘라내기, 복사, 붙여넣기, 삭제                     | PP clipboard rows.                                                                                                         | Off    |

- All three grids share one row set (`slideMenuEntries`); the 순서 편집 window
  adds only the 오버레이 rows after it, as 준비's right column does. In 준비,
  단축키… opens the source slide's key recorder in the song editor, opening that
  editor first from an item. The separate key bar is removed. Unsupported
  actions remain disabled; read-only sources disable key editing with their
  reason (October 31 B22).

### 그래픽 오른쪽 클릭

- Where: 진행 도구 > 그래픽 (PropTab)
- Opens: Right-click, Menu key, or Shift F10 on a 그래픽 tile.
- Purpose: Act on this one 그래픽.
- PP: PP prop right-click (https://www.youtube.com/watch?v=L3dR7Evm-hA at 1:58;
  https://support.renewedvision.com/hc/en-us/articles/55744290679315).

| Group | Row                                   | Does                                                                                     | Status |
| ----- | ------------------------------------- | ---------------------------------------------------------------------------------------- | ------ |
| 1     | 모음에 추가 ›, 모음으로 옮기기 ›      | PP prop collections (submenus as on a 매크로). We have no prop collections yet.          | Off    |
| 2     | 수정…                                 | Opens the 그래픽 dialog.                                                                 | Now    |
| 2     | 전환 효과…                            | PP Transitions.                                                                          | Off    |
| 2     | 자동 지우기 ›                         | PP Auto-Clear: 안 함 ✓, 5, 10, 15, 20, 30, 45, 60초 후, 직접 입력….                      | Off    |
| 3     | 잘라내기, 복사, 붙여넣기, 이름 바꾸기 | PP clipboard rows and Rename.                                                            | Off    |
| 3     | 복제                                  | Copies the 그래픽 (see "복제 by kind"). Ctrl D does the same with the focus on the tile. | Now    |
| 4     | 삭제                                  | Deletes the 그래픽.                                                                      | Now    |

- PP also has a Prop Collections popover in the panel header (title, +,
  collections; 1:22). It comes with prop collections; until then the header has
  no collection button.

### 타이머 줄 오른쪽 클릭

- Where: 진행 도구 > 타이머 (TimerRowMenu)
- Opens: Right-click, Menu key, or Shift F10 on a timer row.
- Purpose: Act on this one timer.
- PP: Not seen in PP (27 videos, 156 articles). Rows follow the list-row rule,
  taken from the PP Look preset, playlist, and prop menus.

| Group | Row         | Does                               | Status |
| ----- | ----------- | ---------------------------------- | ------ |
| 1     | 복제        | List-row rule; see "복제 by kind". | Now    |
| 1     | 이름 바꾸기 | Rename mode.                       | Now    |
| 2     | 삭제        | Deletes the timer.                 | Now    |

- Start, pause, and reset stay on the row buttons, as PP keeps them on the timer
  row. The reset command is named 처음으로 on the row, in macro action choices,
  and in the macro action editor.

### 메시지 문구 오른쪽 클릭

- Where: 진행 도구 > 메시지 (MessageEditing)
- Opens: Right-click, Menu key, or Shift F10 on a template.
- Purpose: Act on this one 메시지 문구.
- PP: Not seen in PP (27 videos, 156 articles). Rows follow the list-row rule,
  taken from the PP Look preset, playlist, and prop menus.

| Group | Row         | Does                                    | Status |
| ----- | ----------- | --------------------------------------- | ------ |
| 1     | 수정…       | Opens the 메시지 문구 editor.           | Now    |
| 2     | 복제        | List-row rule; see "복제 by kind".      | Now    |
| 2     | 이름 바꾸기 | Today the name is changed inside 수정…. | Off    |
| 3     | 삭제        | Deletes the template.                   | Now    |

### 공지 세트 오른쪽 클릭

- Where: 진행 도구 > 공지 (NoticeEditing)
- Opens: Right-click, Menu key, or Shift F10 on the 공지 세트 select.
- Purpose: Act on the shown 공지 세트.
- PP: Not seen in PP (27 videos, 156 articles). Rows follow the list-row rule,
  taken from the PP Look preset, playlist, and prop menus.

| Group | Row         | Does                               | Status |
| ----- | ----------- | ---------------------------------- | ------ |
| 1     | 복제        | List-row rule; see "복제 by kind". | Now    |
| 1     | 이름 바꾸기 | Rename mode.                       | Now    |
| 2     | 삭제        | Deletes the set.                   | Now    |

### 퀵 실행 추가

- Where: 진행 도구 > 퀵 실행 (QuickEditing)
- Opens: Click + 퀵 실행 추가.
- Purpose: Add one thing to 퀵 실행.
- PP: Our own feature; PP has none.

| Group | Row                                    | Does                                          | Status |
| ----- | -------------------------------------- | --------------------------------------------- | ------ |
| 1     | 현재 항목 추가                         | Adds the current item; its name at the right. | Now    |
| 2     | 그래픽 ›, 타이머…, 매크로 ›, 검은 화면 | Adds that kind.                               | Now    |

- 타이머 opens a dialog, so it reads 타이머….

### 퀵 실행 항목 오른쪽 클릭

- Where: 진행 도구 > 퀵 실행
- Opens: Right-click on a row.
- Purpose: Act on this one row.
- PP: Our own feature.

| Group | Row         | Does                                 | Status |
| ----- | ----------- | ------------------------------------ | ------ |
| 1     | 복제        | Copies the row (see "복제 by kind"). | Now    |
| 1     | 이름 바꾸기 | Rename mode.                         | Now    |
| 1     | 삭제        | Removes the row.                     | Now    |

### 항목 추가 (+)

- Where: 예배 순서 panel header (QuickAdd)
- Opens: Click + 항목 추가.
- Purpose: Add one item that is not a song.
- PP: PP playlist + menu
  (https://support.renewedvision.com/hc/en-us/articles/360050786794;
  https://support.renewedvision.com/hc/en-us/articles/55789101197587).

| Group | Row                                       | Does                                                                                                                   | Status  |
| ----- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------- |
| 1     | 구역 추가                                 | Adds a 구역 header (PP New Header).                                                                                    | Now     |
| 1     | 자리 표시 추가, 빈 항목 추가              | PP New Placeholder, New Cue.                                                                                           | Off     |
| 2     | 미디어 ›                                  | Submenu of media, as today.                                                                                            | Now     |
| 2     | 성경 구절…                                | Opens the 성경 구절 dialog.                                                                                            | Now     |
| 2     | 공지 ›                                    | Submenu of 공지 sets.                                                                                                  | Now     |
| 2     | 영상 스트림 항목…, 오디오 스트림 항목…    | PP stream items.                                                                                                       | Off     |
| -     | Search field and the 라이브러리 song list | Removed from this menu. Songs come from 라이브러리 right-click (예배 순서에 추가) and toolbar 곡 검색 with Ctrl Enter. | Removed |

### 예배 순서 항목 오른쪽 클릭

- Where: 예배 순서 list (ServiceOrderList)
- Opens: Right-click on an item or 구역 row.
- Purpose: Act on this one item.
- PP: PP playlist item right-click: song (5 hacks video 3:35, Windows), header
  (Playlist Templates video 1:33; First Playlist video 4:43), placeholder
  (1:39), stream item
  (https://support.renewedvision.com/hc/en-us/articles/55789101197587). All
  start Hide Item | Add to ›; this app omits the unavailable Add to row.

| Group  | Row                                    | Does                                                                                                                                                                             | Status |
| ------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1      | 항목 숨기기                            | PP Hide Item.                                                                                                                                                                    | Off    |
| song   | 구성 ›                                 | Song items: the song's 구성 with ✓ on the one this item uses; picking one sets it for this item (PP Arrangement, 3:37 and 4:00). The same choice as the item's 구성 setting row. | New    |
| song   | 출력 대상 ›                            | PP Destination.                                                                                                                                                                  | Off    |
| song   | 순서 편집…                             | 준비 only: opens the 순서 편집 window for this item (05).                                                                                                                        |
| song   | 곡 편집…                               | Opens the song in the 곡 편집 window (05; PP Reflow). Replaces 준비에서 열기 on song items.                                                                                      | Moved  |
| other  | 준비에서 열기                          | Items that are not songs, 진행 only (ours).                                                                                                                                      | Now    |
| header | 색 바꾸기                              | 구역 rows only (PP Change Color on a header).                                                                                                                                    | Off    |
| 3      | 복사 (Ctrl C), 붙여넣기 (Ctrl V)       | PP clipboard rows; the Windows build shows the keys at the right.                                                                                                                | Off    |
| 3      | 복제 (Ctrl D)                          | Copies the item, or the whole 구역 with its items for a 구역 row, as one undo step (see "복제 by kind"). Ctrl D does the same in 준비 with the focus on the list.                | Now    |
| 3      | 이름 바꾸기                            | 구역 rows (PP Rename on headers). A song, 성경, 미디어, or 공지 item has no name of its own (it shows its source's name), so its row stays disabled as Later.                    | Now    |
| 3      | 삭제                                   | Removes the item from the service. No icon, as in PP.                                                                                                                            | Now    |
| song   | 라이브러리에서 보기                    | Selects the song in the 라이브러리 (PP Show in Library).                                                                                                                         | New    |
| song   | 묶음으로 내보내기…, 이미지로 내보내기… | PP Export as Bundle, Export as Images.                                                                                                                                           | Off    |

- Groups: 숨기기 | 구성 and 출력 대상 | 곡 편집… | clipboard and 삭제 |
  라이브러리와 내보내기. In 준비, 순서 편집… and 곡 편집… follow 구성 › in its
  group (05, B20).

### 예배 순서 고르기

- Where: 예배 순서 header (ServiceOrderHeader)
- Opens: Click the service name.
- Purpose: Open another service; start a new one.
- PP: PP playlist sidebar and LIBRARY + menu
  (https://support.renewedvision.com/hc/en-us/articles/40377194830995;
  https://support.renewedvision.com/hc/en-us/articles/4408670102419).

| Group | Row                                                 | Does                                                                                      | Status |
| ----- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------ |
| list  | 검색 and the services with dates                    | As today.                                                                                 | Now    |
| cmd   | 새 예배…                                            | Opens the 새 예배 dialog (it already offers 템플릿).                                      | Now    |
| cmd   | 다른 예배에서 가져오기, 지금 예배를 템플릿으로 저장 | Moved: to 파일 > 가져오기 > 다른 예배… and to the service right-click (템플릿으로 저장…). | Moved  |

### 예배 오른쪽 클릭

- Where: 예배 순서 고르기 list
- Opens: Right-click on a service row.
- Purpose: Act on this one service.
- PP: PP playlist right-click
  (https://support.renewedvision.com/hc/en-us/articles/40377194830995).

| Group | Row              | Does                                                   | Status |
| ----- | ---------------- | ------------------------------------------------------ | ------ |
| 1     | 이름 바꾸기      | Rename mode.                                           | New    |
| 1     | 템플릿으로 저장… | Saves it as a 템플릿.                                  | Moved  |
| 2     | 내보내기, 인쇄   | PP Export, Print.                                      | Off    |
| 3     | 복제             | PP Duplicate. A new service file (see "복제 by kind"). | Now    |
| 3     | 삭제             | Deletes the service (not the open one).                | Now    |

### 라이브러리 곡 오른쪽 클릭

- Where: 준비 > 라이브러리 (LibraryPanel)
- Opens: Right-click on a song row.
- Purpose: Act on this one song.
- PP: PP presentation right-click
  (https://support.renewedvision.com/hc/en-us/articles/360041344234).

| Group | Row                                                                       | Does                                                                                                                                                                                                                    | Status |
| ----- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1     | 예배 순서에 추가                                                          | Appends the song to the end of the open 예배 순서 at once; the row is disabled with its reason when none is open or it is read-only: newer than PP (B8), no services submenu.                                           | Now    |
| 2     | 구성 ›                                                                    | PP Arrangement (Arrangements video 3:08): the song's 구성, ✓ on the one it uses. We pick 구성 per 예배 순서 item, so a song-level choice waits.                                                                         | Off    |
| 2     | 출력 대상 ›                                                               | PP Destination.                                                                                                                                                                                                         | Off    |
| 3     | 곡 편집…                                                                  | Opens the song in the 곡 편집 window (05; PP Reflow).                                                                                                                                                                   | New    |
| 4     | 복사, 붙여넣기                                                            | PP clipboard rows, with icons (Arrangements video 3:08).                                                                                                                                                                | Off    |
| 4     | 복제                                                                      | Copies the song (see "복제 by kind"); Ctrl D with the focus on the list.                                                                                                                                                | Now    |
| 4     | 이름 바꾸기                                                               | No icon, text aligned with the icon rows. Opens a 곡 이름 바꾸기 dialog with the title rule of the 곡 편집 title field (not empty, at most 200 characters, no other song has it); off for a song a newer version wrote. | Now    |
| 4     | 삭제                                                                      | No icon, as in PP. Confirms, then deletes.                                                                                                                                                                              | Now    |
| 5     | 탐색기에서 보기 (now), 묶음으로 내보내기… (off), 이미지로 내보내기… (off) | PP Show in Finder, Export as Bundle, Export as Images. 탐색기에서 보기 names only the song id; main finds the file.                                                                                                     |        | Off |

### 이름표 팝오버

- Where: 준비 editor (LabelMenu)
- Opens: Click the label tag, 새 그룹, or Ctrl G.
- Purpose: Pick the 이름표 of a group or open the shared catalog manager.
- PP: PP slide Group submenu (Arrangements video 0:55 and 1:07): Edit… | Ungroup
  | groups with color swatches | Settings. Colors are set in Settings > Groups,
  not in the menu.

| Group | Row          | Does                                                                                   | Status |
| ----- | ------------ | -------------------------------------------------------------------------------------- | ------ |
| 1     | 이름표 없음  | Removes the 이름표 (PP Ungroup).                                                       | Now    |
| 2     | <이름표>     | Every 이름표 with its color swatch; ✓ in the left padding on the current one.          | Now    |
| 3     | 이름표 관리… | Opens the shared catalog dialog with editable names, palettes, deletion, and creation. | Now    |

- The picker has no inline creation, disabled 편집… row, or row context menu.

### 이름표 관리

- Where: 이름표 picker
- Opens: 이름표 관리….
- Purpose: Manage the shared catalog in one dialog.
- PP: Not seen in PP as a menu. PP edits groups in Settings > Groups (name,
  color list, delete; Arrangements video 1:02). Rows follow the list-row rule
  plus the color that PP keeps per group.

Each row has an editable name, the shared palette (none and eight colors), and
삭제. Names and colors save immediately. Renaming rewrites matching names in
every song; deleting only removes the catalog definition and keeps song names.
Keep scope tooltips on these controls. The palette's name is accessible without
repeating it visibly beside the name field.

새 이름표 at the footer's left adds a uniquely named row and selects its name
for editing. It does not assign the label to a group. 닫기 is the only footer
completion action (October 31 B22 user decision).

- No 복제: PP groups have no duplicate.

### 구성 고르기

- Where: 준비 song editor and 예배 순서 item (구성 Select)
- Opens: Click the 구성 select.
- Purpose: Pick the 구성; make or edit one.
- PP: PP arrangement popup (Arrangements video 2:11 and 3:11): ✓ Master, other
  arrangements | New Arrangement…, Edit Arrangements….

| Group | Row          | Does                                                                                   | Status |
| ----- | ------------ | -------------------------------------------------------------------------------------- | ------ |
| 1     | 기본         | Alone above a separator (PP Master, 5 hacks video 3:10); ✓ when current.               | Now    |
| 2     | <구성>       | The song's other 구성; ✓ on the current one.                                           | Now    |
| 3     | 새 구성…     | Asks for a name (PP shows a small name field with 취소 and 확인).                      | Now    |
| 3     | 이름 바꾸기… | Renames the selected named 구성. 기본 is disabled with its reason.                     | Now    |
| 3     | 삭제         | Removes the selected named 구성. 기본 is disabled with its reason.                     | Now    |
| 4     | 구성 편집…   | Opens the chip editor in the song editor; from an item it opens the song editor first. | Now    |

- The song editor and item use this same dropdown at every choice count. Source
  management from an item first opens the song editor at the selected source
  slide; picking a 구성 changes only that service item (October 31 B22).

The separate segment management menu is replaced by the dropdown's management
rows. The 기본 reason is "기본 구성은 바꿀 수 없습니다".

### 미디어 오른쪽 클릭

- Where: 미디어 view (MediaView)
- Opens: Right-click on a media tile.
- Purpose: Act on this one media file.
- PP: PP media bin item right-click (Media Inspector video 0:25): Inspector…,
  Transitions… | Behavior ›, Scaling ›, Alpha Type › | Playback, Loop, End
  Behavior › | Next Cue › | Cut, Copy, Paste, Duplicate, Rename, Delete | Show
  in Finder, Clean Up By ›.

| Group | Row                      | Does                                                                                                                                    | Status |
| ----- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 0     | 다시 연결…               | Only when the file is missing; first row (ours).                                                                                        | Now    |
| 1     | 속성…                    | Opens the media properties editor (PP Inspector).                                                                                       | Now    |
| 1     | 전환 효과…               | PP Transitions.                                                                                                                         | Off    |
| 2     | 동작 ›, 맞춤 ›, 알파 ›   | PP Behavior, Scaling, Alpha Type.                                                                                                       | Off    |
| 3     | 재생 ›, 반복 ›, 끝나면 › | PP Playback, Loop, End Behavior.                                                                                                        | Off    |
| 4     | 다음 항목 ›              | PP Next Cue.                                                                                                                            | Off    |
| 5     | 잘라내기, 복사, 붙여넣기 | PP clipboard rows with icons.                                                                                                           | Off    |
| 5     | 복제                     | Copies the media entry (see "복제 by kind"); Ctrl D with the tile selected.                                                             | Now    |
| 5     | 이름 바꾸기              | No icon. Opens a 미디어 이름 바꾸기 dialog (the name must not be empty); the file keeps its name. Off for a list a newer version wrote. | Now    |
| 5     | 재생목록에서 빼기        | Only inside a playlist (ours), right before 삭제.                                                                                       | Now    |
| 5     | 삭제                     | Trash icon, as in PP. Asks first and names every use (08).                                                                              | Now    |
| 6     | 탐색기에서 보기          | PP Show in Finder. Shows the file in the file manager when it is inside the media folders.                                              | Now    |
| 6     | 정리 기준 ›              | PP Clean Up By.                                                                                                                         | Off    |
| -     | 복사 멈추기              | While the file is being copied, the menu holds only this row (ours).                                                                    | Now    |

- Audio files in a 오디오 playlist follow the PP audio item menu (same video
  0:26): 탐색기에서 보기 (now), 재생 › (off), 효과음으로 지정 (off) | 속성…
  (now, opens media properties), 이름 바꾸기 (now) | 삭제.

### 재생목록 오른쪽 클릭

- Where: 미디어 and 오디오 playlist list
- Opens: Right-click a playlist row.
- Purpose: Act on this one playlist.
- PP: PP media playlist right-click (support article screenshot, 2026).

| Group | Row         | Does                                                                                      | Status |
| ----- | ----------- | ----------------------------------------------------------------------------------------- | ------ |
| 1     | 통신에 사용 | PP Select for Communications.                                                             | Off    |
| 2     | 이름 바꾸기 | Rename.                                                                                   | Now    |
| 2     | 복제        | PP Duplicate. Copies the playlist (see "복제 by kind"); Ctrl D with the focus on its row. | Now    |
| 2     | 삭제        | Delete.                                                                                   | Now    |

### 테마 바꾸기 메뉴

- Where: Toolbar theme button (ThemeMenu), showing the confirmed live name.
- Opens: Click 테마 바꾸기 or press its assigned command.
- Purpose: Pick the live theme until the next item starts or an outside-service
  slide goes out (12). A settings edit does not confirm a live selection.

| Group | Row         | Does                                          | Status |
| ----- | ----------- | --------------------------------------------- | ------ |
| 1     | <테마 이름> | Radio check on the confirmed live theme.      | Now    |
| 2     | 테마 편집…  | After a separator, opens the theme workspace. | Now    |

### 화면 추가 (+)

- Where: 화면 설정 > 청중 or 무대 group header
- Opens: Click +.
- Purpose: Add one screen to this group.
- PP: PP Screen Configuration + menu (support article).

| Group     | Row                   | Does                                                                              | Status |
| --------- | --------------------- | --------------------------------------------------------------------------------- | ------ |
| 모니터    | <모니터 N> (해상도)   | Arrangement thumbnail with this monitor in blue. Adds a full-screen output there. | Now    |
| 창        | 새 창, 새 캡처 창     | Windowed output and capture window.                                               | Now    |
| NDI       | 새 NDI ›              | PP NDI.                                                                           | Off    |
| 자리 표시 | 새 자리 표시 ›        | PP Placeholder.                                                                   | Off    |
| 2         | 묶음…, 가장자리 합성… | PP Grouped, Edge Blend (청중 only).                                               | Off    |

### 화면 오른쪽 클릭

- Where: 화면 설정 screen list
- Opens: Right-click a screen.
- Purpose: Act on this one screen.
- PP: PP screen right-click (support article, 2026).

| Group | Row               | Does                                                                                                                                                   | Status |
| ----- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 1     | 이름 바꾸기       |                                                                                                                                                        | Now    |
| 1     | 삭제              | Disabled when it is the only screen of its kind, with the reason "마지막 청중 화면은 삭제할 수 없음. 사용 안 함으로 끌 수 있음" (방송, 무대 likewise). | Now    |
| 1     | 사용 안 함 / 사용 | Turns this screen's output off or on (the same switch as the per-screen check in 출력 today).                                                          | New    |

### 파일

- Where: Menu bar
- Opens: Click 파일.
- Purpose: Make, bring in, and save out files.
- PP: PP File menu (support article, 2026).

| Group | Row                     | Does                                                                                                                                         | Status                                |
| ----- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1     | 새 곡 (Ctrl N)          | PP New Presentation. Opens 준비 and makes a song, the same as the 라이브러리 header's plus (05). Off while the window has no app connection. | Now                                   |
| 1     | 새 예배                 |                                                                                                                                              | Now                                   |
| 1     | 새 라이브러리           |                                                                                                                                              | Off                                   |
| 1     | 가져오기 ›              | 텍스트 파일… (Ctrl Shift I), 라이브러리… (off), 미디어…, 클립보드 텍스트…, 다른 예배…                                                        | MultiTracks… (off), SongSelect… (off) | PowerPoint를 슬라이드로…, 그림으로…, 개체와 글자로… (off). | Now |
| 2     | 내보내기 ›              |                                                                                                                                              | Off                                   |
| 2     | 예배를 템플릿으로 저장… | Was 지금 예배를 템플릿으로 저장.                                                                                                             | Moved                                 |
| 3     | 인쇄…                   |                                                                                                                                              | Off                                   |

- No icons in menu bar menus (PP has none).

### 보기

- Where: Menu bar
- Opens: Click 보기.
- Purpose: Switch workspace and open tools.
- PP: PP View menu (support article, 2026).

| Group | Row                                                                           | Does                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Status |
| ----- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1     | 진행 (Ctrl S), 슬라이드 편집기 (off), 준비 (Ctrl R), 성경 (off)               | Ctrl E keeps opening 준비 until a slide editor exists.                                                                                                                                                                                                                                                                                                                                                                                                           | Now    |
| 2     | 이어서 진행                                                                   | PP Continuous Playlist. A check row that shows and flips 환경설정 > 마지막 슬라이드에서 다음 슬라이드 (on is 다음 항목, off is 정지).                                                                                                                                                                                                                                                                                                                            | Now    |
| 3     | 슬라이드 보기 ›                                                               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Off    |
| 4     | 오디오, 무대, 타이머, 메시지, 공지, 그래픽, 매크로                            | Opens its owning tool tab, including the per-item 메시지, 공지 and 그래픽 controls (04).                                                                                                                                                                                                                                                                                                                                                                         | New    |
| 5     | 타임코드 (off), 미디어 (Ctrl Shift V), 캘린더 (off), 동작 팔레트, 테스트 화면 | 미디어 toggles the shared bottom bin, using the same saved state as its header 접기 button and collapsed bar (04). 테스트 화면 is a check row: it shows the 테스트 패턴 (06) on every screen whose output is on, or takes it off them all, and is checked while all of those show it. A screen whose output is off is left alone (it has no window, and its pattern goes off with its output); the row is off with "출력이 꺼져 있습니다" while no screen is on. | Now    |
| 6     | 미리보기 ›                                                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Off    |
| 7     | 전체 화면                                                                     | A check row for the control window (PP View > Full Screen): puts it in or out of full screen and shows the state. No key, since spec 10 names none.                                                                                                                                                                                                                                                                                                              | Now    |
| -     | 화면 설정                                                                     | The workspace is now 테마 (layers icon). Screen settings move to a separate window under 출력.                                                                                                                                                                                                                                                                                                                                                                   | Moved  |

### 출력

- Where: Menu bar
- Opens: Click 출력.
- Purpose: Turn outputs on or off and change what they show.
- PP: PP Screens menu (support article, 2026).
- Groups follow the app's three screen roles, with 화면 설정… last.

| Group     | Row                                             | Does                                                                               | Status |
| --------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| 청중 화면 | 출력 끄기 / 출력 켜기, 테마 바꾸기 ›, 항목 끄기 |                                                                                    | New    |
| 무대 화면 | 출력 끄기 / 출력 켜기                           |                                                                                    | New    |
| 방송 화면 | 출력 끄기 / 출력 켜기, 방송 설정… (off)         | Same output command as the other screen groups.                                    | Now    |
| -         | <화면> 경고 보기                                | Only while a warning holds, before the final settings row.                         | Now    |
| 2         | 화면 설정…                                      | Opens or focuses the single 화면 설정 window. Last, after a separator. Ctrl Alt 1. | Moved  |
| -         | Per-screen checks                               | Moved to 화면 설정 (사용 안 함).                                                   | Moved  |

### 편집

- Where: Menu bar
- Opens: Click 편집.
- Purpose: Undo and redo, text editing, and duplicating or deleting the
  selection.
- PP: PP Edit menu on Windows. The rows and Windows keys are the "Edit Menu"
  table of S1; Key Mappings is "Edit>Key Mappings on Windows" (S2). Neither
  source shows separators or the position of Key Mappings, so the groups are
  ours (Not seen in PP). S1's four rows marked N/A on Windows (Show Spelling and
  Grammar, Check Spelling, Special Characters and Emojis, Start Dictation) are
  left out.
- Every row shows its key (`shortcutText`), so a key the operator changed in
  환경설정 shows here.
- The menu acts on what had keyboard focus when it opened (see "Which thing a
  row acts on").

| Group | Row                      | Does                                                                                                                                                                                                                                                                | Command                     | Status |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------ |
| 1     | 실행 취소 (Ctrl Z)       | PP Undo.                                                                                                                                                                                                                                                            | `edit.undo`                 | New    |
| 1     | 다시 실행 (Ctrl Y)       | PP Redo. Ctrl Shift Z also works (10).                                                                                                                                                                                                                              | `edit.redo`                 | New    |
| 2     | 잘라내기 (Ctrl X)        | PP Cut. Acts on the text field that had focus.                                                                                                                                                                                                                      | (fixed)                     | New    |
| 2     | 복사 (Ctrl C)            | PP Copy. Acts on the text field that had focus.                                                                                                                                                                                                                     | (fixed)                     | New    |
| 2     | 텍스트 스타일 복사       | PP Copy Text Style, Ctrl Alt C. Lyrics are plain lines, so there is no style (10).                                                                                                                                                                                  | None                        | Off    |
| 2     | 붙여넣기 (Ctrl V)        | PP Paste. Acts on the text field that had focus.                                                                                                                                                                                                                    | (fixed)                     | New    |
| 2     | 텍스트 스타일 붙여넣기   | PP Paste Text Style, Alt Shift V.                                                                                                                                                                                                                                   | None                        | Off    |
| 2     | 스타일 맞춰 붙여넣기     | PP Paste and Match Style, Alt V. Pasting into the song editor is always plain text (10).                                                                                                                                                                            | None                        | Off    |
| 3     | 복제 (Ctrl D)            | PP Duplicate. Runs the same handler as the 복제 row of the focused list (see "복제 by kind"); otherwise disabled with "선택한 곳에서는 쓸 수 없음". The key shows on the row while it is disabled. Where the list's own row is disabled, this row shows its reason. | `edit.duplicate`            | Now    |
| 3     | 삭제 (Delete)            | PP Delete. Runs the selected thing's own delete, with its question where the Delete rule asks one.                                                                                                                                                                  | `edit.delete`               | New    |
| 3     | 모두 선택 (Ctrl A)       | PP Select All. Acts on the text field that had focus.                                                                                                                                                                                                               | (fixed)                     | New    |
| 3     | 선택 해제 (Ctrl Shift D) | PP Deselect. Esc clears a selection here (10).                                                                                                                                                                                                                      | None                        | Off    |
| 4     | 찾기 (Ctrl F)            | PP Search. Focuses the toolbar 검색.                                                                                                                                                                                                                                | `search.focus`              | Now    |
| 5     | 단축키…                  | PP Key Mappings (S2). Opens 환경설정 at the 단축키 page, or shows that page in the window that is already open.                                                                                                                                                     | `app.preferences.shortcuts` | Now    |

Which thing a row acts on:

- 실행 취소 and 다시 실행 act on the same thing as their keys do (10, "Focus
  precedence"): in a text field, that field's own text history; otherwise the
  예배 순서 history while the 예배 순서 list had focus. Focus goes back to where
  it was before the menu opened, so the next key press continues where the
  operator was. Neither ever restores a clear (03, 10).
- Disabled with a reason when there is nothing to do: "되돌릴 편집이 없습니다"
  and "다시 실행할 편집이 없습니다". Where the focused place has no history,
  both rows are disabled with those same reasons.
- The 곡 편집 window is its own window with no menu bar; its blocks keep Ctrl Z
  and Ctrl Y (05).
- 잘라내기, 복사, 붙여넣기, and 모두 선택 are enabled only when a text field had
  focus (잘라내기 and 복사 also need a selection). Otherwise they are disabled
  with "글자 입력란에서 쓸 수 있습니다", or "선택한 글자가 없습니다" for
  잘라내기 and 복사 with nothing selected.
- 복제 and 삭제 are enabled when the focused place has a handler for the command
  (`edit.duplicate`, `edit.delete`), and disabled with "선택한 곳에서는 쓸 수
  없음" otherwise. 복제 has a handler in the lists of "복제 by kind" that are
  built (테마, 매크로, the 진행 tool lists, 라이브러리 곡, 미디어, 미디어
  재생목록, and the 예배 순서 in 준비), so it is on there with the focus on a
  row.

### 창

- Where: Menu bar
- Opens: Click 창.
- Purpose: Control the main window and open the 환경설정 window.
- PP: Not seen in PP. S1 and S2 list no Window menu on Windows, and no other
  source shows its rows. The rows follow the product decision in 01 (최소화,
  최대화, 환경설정) and the title bar buttons.

| Group | Row                | Does                                                                              | Command           | Status |
| ----- | ------------------ | --------------------------------------------------------------------------------- | ----------------- | ------ |
| 1     | 최소화             | The same as the title bar button.                                                 | `window.minimize` | New    |
| 1     | 최대화             | Maximizes the window or restores it, the same as the title bar 최대화 button.     | `window.maximize` | New    |
| 2     | 환경설정… (Ctrl ,) | Opens or focuses the single 환경설정 window (PP Open Settings, S1). Also in 파일. | `app.preferences` | New    |

- 최소화 and 최대화 have no default keys (10).
- No list of open windows: the app has one main window, and 곡 편집, 화면 설정,
  and 환경설정 each open from their own command.

### 도움말

- Where: Menu bar
- Opens: Click 도움말.
- Purpose: Version information and the log folder.
- PP: The PP 7 user guide (S4) names "Welcome to ProPresenter" in the Help menu,
  and a support page says the menu holds links to resources. No source lists its
  rows on Windows, so the rows and groups are ours (Not seen in PP).

| Group | Row            | Does                                                                                                | Command        | Status |
| ----- | -------------- | --------------------------------------------------------------------------------------------------- | -------------- | ------ |
| 1     | 시작 안내      | PP Welcome to ProPresenter. The app has no walkthrough.                                             | None           | Off    |
| 2     | 로그 폴더 열기 | Opens the log folder (`logs` in the app data folder, 02) in the file manager.                       | `app.openLogs` | Now    |
| 2     | 버전 정보      | A small dialog with the app name and version and one 확인 button, no links (the app works offline). | `app.about`    | Now    |

- PP's links to online resources are left out: the app works without the
  internet (TECH rule 5).

### 곡 검색 결과

- Where: Toolbar 검색 (ToolbarSearch)
- Opens: Type in 검색 or Ctrl F.
- Purpose: Find a song and open or add it.
- PP: PP Quick Search (support article).

| Group | Row                                          | Does                                    | Status |
| ----- | -------------------------------------------- | --------------------------------------- | ------ |
| list  | Results                                      | As today.                               | Now    |
| foot  | Enter 키로 열기, Ctrl Enter 예배 순서에 추가 | Footer hints and the Ctrl Enter action. | New    |

## Unchanged except for the shared appearance

- 배경 선택 and 기본 배경 pickers
- 더 보기 tab overflow
- 성경 구절 추천
- 이름표 넣기
- 미디어 가져오기 설정
- 템플릿 and past-service rows in dialogs
- 다른 화면 출력
- 글꼴
- 날짜 선택

The Output theme submenu uses the same radio rows, separator, and 테마 편집…
entry as the toolbar. 항목 끄기 removes only the live item from every screen,
reveals standby, and supports clear undo. It has no default key (12).
