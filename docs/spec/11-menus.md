# Menus and popovers

What every menu and popover in the app shows and does. Menus follow ProPresenter
(PP) 7 as of March 2026; the PP screens were checked in Renewed Vision support
articles and tutorial videos, cited by link and time. The look of a menu (sizes,
colors, states) is in the `Menu` README of the design system; this file sets the
rows. Status: Now (exists), New (build), Off (disabled row for a PP feature we
lack), Moved, Removed.

## Shared rules

- **Purpose:** A menu acts on the one thing that was clicked (a 매크로, a 소품,
  a 슬라이드), or adds one kind of thing. Rows are grouped by what they do, in
  ProPresenter (PP) order. Nothing else goes into a menu: no palettes, no search
  fields, no settings rows.
- **Reference:** PP 7 as of March 2026 (Renewed Vision support articles and
  tutorial videos). Where PP has the same menu, use its rows, groups, and order.
  Where no PP screen could be found, the section says "Not seen in PP" and
  follows the list-row rule below.
- **Rows PP has and we lack:** Show them as disabled rows (text-off, no hover,
  tooltip "아직 없는 기능"), so the menu keeps its final shape and the feature
  can be built later (decided 2026-10-30).
- **Hide or disable:** Hide a row that does not apply to this object (PP hides
  Edit Action and Remove Actions on a 매크로 with no actions). Disable a row
  that applies but cannot run now (붙여넣기 with an empty clipboard).
- **Look:** Measured from PP and scaled to our 16px text: width 276 (or wider
  for long rows), vertical padding 6, radius 12, row 28, highlight inset 5 with
  radius 9, text starts 28 from the menu edge, separator 1px
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
  or a kind (동작 편집, 동작 빼기: <대상>, the kinds in 동작 추가). 삭제 has the
  trash icon in the 슬라이드, 소품, and 매크로 menus and none in the 라이브러리
  menu, as in PP. Icon 18 at the text start, its text at 55. In a group where
  some rows have icons, rows without one (이름 바꾸기) start their text at 55
  too. Phosphor Regular, the same set as the app.
- **Delete:** 삭제 is the last row, in its own group or at the end of the
  clipboard group as PP has it, in normal text color. Rules for confirmation
  stay as they are.
- **Wording:** 이름 바꾸기 everywhere (not 이름 변경). A row that opens a dialog
  or asks for more input ends with "…" as in PP (수정…, 전환 효과…).
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
  look. Five lists that have no name get one: MacroActionDialog 동작, 대상, 무대
  화면, 표시 시간; PropDialog 내용 종류 and 이미지; NoticeCreateDialog 이미지
  재생목록; 출처 위치; the two 굵기 lists.

## Menus

### 매크로 오른쪽 클릭

- Where: 진행 도구 > 매크로 (MacroPanel)
- Opens: Right-click, Menu key, or Shift F10 on a 매크로 tile or row.
- Purpose: Act on this one 매크로.
- PP: PP macro right-click (https://www.youtube.com/watch?v=08NRxdDFdHc at 3:20
  and 3:20 with actions;
  https://support.renewedvision.com/hc/en-us/articles/4402663090323).

| Group | Row                      | Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Status                                                                                                                                                                                 |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 모음에 추가 ›            | Submenu of all collections; one that already holds this 매크로 shows ✓ and is disabled; then a separator and 새 모음 (PP Add To, seen on props at 1:57). Picking one adds the 매크로 to it.                                                                                                                                                                                                                                                                                                                                                                                                             | New                                                                                                                                                                                    |
| 1     | 모음으로 옮기기 ›        | Same list; the shown collection shows ✓ and is disabled; then 새 모음 (PP Move To, seen on props at 1:56). Picking one moves the 매크로 out of the shown collection. Disabled while the tab shows 모든 매크로.                                                                                                                                                                                                                                                                                                                                                                                          | New                                                                                                                                                                                    |
| 2     | 이름 바꾸기              | Puts the name into rename mode.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Now                                                                                                                                                                                    |
| 2     | 색 바꾸기                | Opens the color popover (the 8 macro colors) at the tile. Replaces the color row at the bottom of the menu.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | New                                                                                                                                                                                    |
| 2     | 아이콘 바꾸기            | Opens the icon grid.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Now                                                                                                                                                                                    |
| 2     | 시작할 때 실행           | Turns run-at-startup on or off; ✓ when on. The tile keeps its clock mark.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Now                                                                                                                                                                                    |
| 3     | 동작 추가 ›              | Submenu of action kinds in PP order: 지우기 ›, Look 바꾸기 ›, 무대 화면 배치 ›, 슬라이드 출력 대상 › (off), 타이머 ›, 소품 ›, 메시지 ›, 공지 ›, 배경 미디어 ›, 오디오 ›, 오디오 재생 목록 ›, 외부 장치 신호 › (off), 오디오 입력 › (off), 비디오 입력 › (off), 매크로 ›, 녹화와 방송 › (off), then 동작 팔레트. 모두 지우기 and 레이어 지우기 move under 지우기 ›. Each kind opens its targets; picking one appends the action. 무대 화면 배치 has no submenu, as PP Stage: it adds the action and opens its popover (one layout per stage screen), and it is disabled when the 매크로 already has one. | Now                                                                                                                                                                                    |
| 3     | 미디어 동작 추가…        | PP: adds a media action from a file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Off                                                                                                                                                                                    |
| 4     | 동작 편집: <대상> ›      | One row per action, with the kind icon (for example "동작 편집: 찬양" for a Look action). Submenu: that kind's choices with ✓ on the current one (which Look, which timer and operation)                                                                                                                                                                                                                                                                                                                                                                                                                | 동작 빼기: <대상>                                                                                                                                                                      | <종류> 열기… (for example Look 편집…). PP Edit Action (Actions video 2:36). Replaces 동작 편집 › and its popover. Hidden when the 매크로 has no actions. | New |
| 4     | 동작 빼기: <대상>        | With exactly one action: one row with the kind icon, right under its 동작 편집 row; removes it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | New                                                                                                                                                                                    |
| 5     | 동작 빼기 ›              | With two or more actions: submenu of the actions, each with its kind icon                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 모두 빼기. Picking one removes it. Hidden when there are none. PP switches between the two forms the same way (Actions video 2:52 and 2:53; Remove All in the Looks setup video 5:25). | Now                                                                                                                                                      |
| 6     | 속성…                    | PP Inspector….                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Off                                                                                                                                                                                    |
| 7     | 잘라내기, 복사, 붙여넣기 | PP clipboard rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Off                                                                                                                                                                                    |
| 7     | 복제                     | Adds "<name> 복사본" after it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Now                                                                                                                                                                                    |
| 8     | 삭제                     | Confirms, then deletes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Now                                                                                                                                                                                    |
| -     | 실행                     | Removed: a click runs the 매크로, and PP has no such row.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Removed                                                                                                                                                                                |

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

| Group    | Row                                   | Does                                                                                    | Status                                                                                                                                                                                                                                                                                             |
| -------- | ------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| head     | 제목 "매크로 모음" and + at the right | + adds a collection and puts its name into rename mode.                                 | New                                                                                                                                                                                                                                                                                                |
| list     | 모든 매크로                           | Always first. Shows every 매크로. Cannot be renamed or deleted.                         | Now                                                                                                                                                                                                                                                                                                |
| list     | <모음 이름>                           | Shows that collection. The current row is filled blue; no check, no count.              | Now                                                                                                                                                                                                                                                                                                |
| list     | Reorder                               | Drag a collection row to reorder (PP 7.16 video 7:00, a collection dragged to the top). | New                                                                                                                                                                                                                                                                                                |
| row menu | 복제 (off), 이름 바꾸기               | 삭제                                                                                    | Right-click on a collection row, by the list-row rule. Deleting keeps the 매크로. 모든 매크로 shows the rows disabled. PP renames a new collection inline right after + (7.16 video 5:18) and the support article says "right-click the collection and select Rename"; the full menu was not seen. | Moved |

- Replaces the Select with 이름 바꾸기 and 삭제 at the bottom.

### 슬라이드 오른쪽 클릭

- Where: 진행 > 슬라이드 grid
- Opens: Right-click, Menu key, or Shift F10 on a slide.
- Purpose: Act on this one slide.
- PP: PP slide right-click (https://www.youtube.com/watch?v=08NRxdDFdHc at
  1:58).

| Group | Row                                                | Does                                                                   | Status                   |
| ----- | -------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------ |
| 1     | 빠른 편집                                          | PP Quick Edit.                                                         | Off                      |
| 1     | 슬라이드 편집                                      | Opens 준비 at this slide, like 준비에서 열기 on a 예배 순서 item.      | New                      |
| 2     | 사용 안 함                                         | PP Disable.                                                            | Off                      |
| 3     | 테마 ›, 전환 효과…, 단축키…, 다음 타이머로 넘기기… | PP Themes, Transitions, Hot Key, Go to Next Timer.                     | Off                      |
| 4     | 동작 추가 ›, 미디어 동작 추가…                     | PP slide actions. With actions, PP adds "동작 빼기: <대상>" rows here. | Off                      |
| 5     | 이름표 ›                                           | PP Group (Arrangements video 0:55): 편집… (off)                        | 이름표 없음 (PP Ungroup) | every 이름표 with its color swatch, ✓ on the current one | 이름표 설정…. The same list as the 이름표 popover. | Off |
| 5     | 슬라이드 이름 ›                                    | PP Label.                                                              | Off                      |
| 6     | 글자 모양 복사, 글자 모양 붙여넣기                 | PP Copy and Paste Text Style.                                          | Off                      |
| 7     | 잘라내기, 복사, 붙여넣기, 삭제                     | PP clipboard rows.                                                     | Off                      |

- There is no slide menu today; this adds it.

### 소품 오른쪽 클릭

- Where: 진행 도구 > 소품 (PropTab)
- Opens: Right-click, Menu key, or Shift F10 on a 소품 tile.
- Purpose: Act on this one 소품.
- PP: PP prop right-click (https://www.youtube.com/watch?v=L3dR7Evm-hA at 1:58;
  https://support.renewedvision.com/hc/en-us/articles/55744290679315).

| Group | Row                                         | Does                                                                            | Status |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| 1     | 모음에 추가 ›, 모음으로 옮기기 ›            | PP prop collections (submenus as on a 매크로). We have no prop collections yet. | Off    |
| 2     | 수정…                                       | Opens the 소품 dialog.                                                          | Now    |
| 2     | 전환 효과…                                  | PP Transitions.                                                                 | Off    |
| 2     | 자동 지우기 ›                               | PP Auto-Clear: 안 함 ✓, 5, 10, 15, 20, 30, 45, 60초 후, 직접 입력….             | Off    |
| 3     | 잘라내기, 복사, 붙여넣기, 복제, 이름 바꾸기 | PP clipboard rows and Rename.                                                   | Off    |
| 4     | 삭제                                        | Deletes the 소품.                                                               | Now    |

- PP also has a Prop Collections popover in the panel header (title, +,
  collections; 1:22). It comes with prop collections; until then the header has
  no collection button.

### 타이머 줄 오른쪽 클릭

- Where: 진행 도구 > 타이머 (TimerRowMenu)
- Opens: Right-click, Menu key, or Shift F10 on a timer row.
- Purpose: Act on this one timer.
- PP: Not seen in PP (27 videos, 156 articles). Rows follow the list-row rule,
  taken from the PP Look preset, playlist, and prop menus.

| Group | Row         | Does               | Status |
| ----- | ----------- | ------------------ | ------ |
| 1     | 복제        | List-row rule.     | Off    |
| 1     | 이름 바꾸기 | Rename mode.       | Now    |
| 2     | 삭제        | Deletes the timer. | Now    |

- Start, pause, and reset stay on the row buttons, as PP keeps them on the timer
  row.

### 메시지 틀 오른쪽 클릭

- Where: 진행 도구 > 메시지 (MessageEditing)
- Opens: Right-click, Menu key, or Shift F10 on a template.
- Purpose: Act on this one 메시지 틀.
- PP: Not seen in PP (27 videos, 156 articles). Rows follow the list-row rule,
  taken from the PP Look preset, playlist, and prop menus.

| Group | Row         | Does                                    | Status |
| ----- | ----------- | --------------------------------------- | ------ |
| 1     | 수정…       | Opens the 메시지 틀 editor.             | Now    |
| 2     | 복제        | List-row rule.                          | Off    |
| 2     | 이름 바꾸기 | Today the name is changed inside 수정…. | Off    |
| 3     | 삭제        | Deletes the template.                   | Now    |

### 공지 세트 오른쪽 클릭

- Where: 진행 도구 > 공지 (NoticeEditing)
- Opens: Right-click, Menu key, or Shift F10 on the 공지 세트 select.
- Purpose: Act on the shown 공지 세트.
- PP: Not seen in PP (27 videos, 156 articles). Rows follow the list-row rule,
  taken from the PP Look preset, playlist, and prop menus.

| Group | Row         | Does             | Status |
| ----- | ----------- | ---------------- | ------ |
| 1     | 복제        | List-row rule.   | Off    |
| 1     | 이름 바꾸기 | Rename mode.     | Now    |
| 2     | 삭제        | Deletes the set. | Now    |

### 퀵 실행 추가

- Where: 진행 도구 > 퀵 실행 (QuickEditing)
- Opens: Click + 퀵 실행 추가.
- Purpose: Add one thing to 퀵 실행.
- PP: Our own feature; PP has none.

| Group | Row                                  | Does                                          | Status |
| ----- | ------------------------------------ | --------------------------------------------- | ------ |
| 1     | 현재 항목 추가                       | Adds the current item; its name at the right. | Now    |
| 2     | 소품 ›, 타이머…, 매크로 ›, 검은 화면 | Adds that kind.                               | Now    |

- 타이머 opens a dialog, so it reads 타이머….

### 퀵 실행 항목 오른쪽 클릭

- Where: 진행 도구 > 퀵 실행
- Opens: Right-click on a row.
- Purpose: Act on this one row.
- PP: Our own feature.

| Group | Row         | Does             | Status |
| ----- | ----------- | ---------------- | ------ |
| 1     | 이름 바꾸기 | Rename mode.     | Now    |
| 1     | 삭제        | Removes the row. | Now    |

### 항목 추가 (+)

- Where: 예배 순서 panel header (QuickAdd)
- Opens: Click + 항목 추가.
- Purpose: Add one item that is not a song.
- PP: PP playlist + menu
  (https://support.renewedvision.com/hc/en-us/articles/360050786794;
  https://support.renewedvision.com/hc/en-us/articles/55789101197587).

| Group | Row                                       | Does                                                                                                                                                                                                 | Status |
| ----- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1     | 구역 추가                                 | Adds a 구역 header (PP New Header).                                                                                                                                                                  | Now    |
| 1     | 자리 표시 추가, 큐 추가                   | PP New Placeholder, New Cue.                                                                                                                                                                         | Off    |
| 2     | 미디어 ›                                  | Submenu of media, as today.                                                                                                                                                                          | Now    |
| 2     | 성경 구절…                                | Opens the 성경 구절 dialog.                                                                                                                                                                          | Now    |
| 2     | 공지 ›                                    | Submenu of 공지 sets.                                                                                                                                                                                | Now    |
| 2     | 비디오 스트림 항목…, 오디오 스트림 항목…  | PP stream items.                                                                                                                                                                                     | Off    |
| -     | Search field and the 라이브러리 song list | Leaves this menu once songs can come in from the 라이브러리 right-click (예배 순서에 추가) and from the toolbar 곡 검색 with Ctrl Enter, as in PP. Until then (M3) it stays on top, above 다른 항목. | Moved  |

### 예배 순서 항목 오른쪽 클릭

- Where: 예배 순서 list (ServiceOrderList)
- Opens: Right-click on an item or 구역 row.
- Purpose: Act on this one item.
- PP: PP playlist item right-click: song (5 hacks video 3:35, Windows), header
  (Playlist Templates video 1:33; First Playlist video 4:43), placeholder
  (1:39), stream item
  (https://support.renewedvision.com/hc/en-us/articles/55789101197587). All
  start Hide Item | Add to ›.

| Group  | Row                                             | Does                                                                                                                                                                             | Status |
| ------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1      | 항목 숨기기                                     | PP Hide Item.                                                                                                                                                                    | Off    |
| 1      | 다른 예배에 추가 ›                              | PP Add to: services under the heading 지난 예배, the open one ✓ and disabled.                                                                                                    | Off    |
| song   | 구성 ›                                          | Song items: the song's 구성 with ✓ on the one this item uses; picking one sets it for this item (PP Arrangement, 3:37 and 4:00). The same choice as the item's 구성 setting row. | New    |
| song   | 출력 대상 ›                                     | PP Destination.                                                                                                                                                                  | Off    |
| song   | 슬라이드 편집, 크기 바꾸기 ›                    | PP Edit, Resize.                                                                                                                                                                 | Off    |
| song   | 가사 편집                                       | Opens the song in 준비 (PP Reflow). Replaces 준비에서 열기 on song items.                                                                                                        | Moved  |
| other  | 준비에서 열기                                   | Items that are not songs, 진행 only (ours).                                                                                                                                      | Now    |
| header | 색 바꾸기                                       | 구역 rows only (PP Change Color on a header).                                                                                                                                    | Off    |
| 3      | 복사 (Ctrl C), 붙여넣기 (Ctrl V), 복제 (Ctrl D) | PP clipboard rows; the Windows build shows the keys at the right.                                                                                                                | Off    |
| 3      | 이름 바꾸기                                     | 구역 and other items (PP Rename on headers, placeholders, streams; a song item has none).                                                                                        | Now    |
| 3      | 삭제                                            | Removes the item from the service. No icon, as in PP.                                                                                                                            | Now    |
| song   | 라이브러리에서 보기                             | Selects the song in the 라이브러리 (PP Show in Library).                                                                                                                         | New    |
| song   | 묶음으로 내보내기…, 그림으로 내보내기…          | PP Export as Bundle, Export as Images.                                                                                                                                           | Off    |

- Groups follow PP: 숨기기 and 추가 | 구성 and 출력 대상 | 편집 rows | clipboard
  and 삭제 | 라이브러리와 내보내기.

### 예배 순서 고르기

- Where: 예배 순서 header (ServiceOrderHeader)
- Opens: Click the service name.
- Purpose: Open another service; start a new one.
- PP: PP playlist sidebar and LIBRARY + menu
  (https://support.renewedvision.com/hc/en-us/articles/40377194830995;
  https://support.renewedvision.com/hc/en-us/articles/4408670102419).

| Group | Row                                           | Does                                                                                | Status |
| ----- | --------------------------------------------- | ----------------------------------------------------------------------------------- | ------ |
| list  | 검색 and the services with dates              | As today.                                                                           | Now    |
| cmd   | 새 예배…                                      | Opens the 새 예배 dialog (it already offers 틀).                                    | Now    |
| cmd   | 다른 예배에서 가져오기, 지금 예배를 틀로 저장 | Moved: to 파일 > 가져오기 > 다른 예배… and to the service right-click (틀로 저장…). | Moved  |

### 예배 오른쪽 클릭

- Where: 예배 순서 고르기 list
- Opens: Right-click on a service row.
- Purpose: Act on this one service.
- PP: PP playlist right-click
  (https://support.renewedvision.com/hc/en-us/articles/40377194830995).

| Group | Row            | Does                                    | Status |
| ----- | -------------- | --------------------------------------- | ------ |
| 1     | 이름 바꾸기    | Rename mode.                            | New    |
| 1     | 틀로 저장…     | Saves it as a 틀.                       | Moved  |
| 2     | 내보내기, 인쇄 | PP Export, Print.                       | Off    |
| 3     | 복제           | PP Duplicate.                           | Off    |
| 3     | 삭제           | Deletes the service (not the open one). | Now    |

### 라이브러리 곡 오른쪽 클릭

- Where: 준비 > 라이브러리 (LibraryPanel)
- Opens: Right-click on a song row.
- Purpose: Act on this one song.
- PP: PP presentation right-click
  (https://support.renewedvision.com/hc/en-us/articles/360041344234).

| Group | Row                                                     | Does                                                                                                                                            | Status |
| ----- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1     | 예배 순서에 추가 ›                                      | Submenu under the heading 예배 순서: services, newest first. Picking one appends the song.                                                      | New    |
| 1     | 라이브러리로 옮기기 ›                                   | PP Move to.                                                                                                                                     | Off    |
| 2     | 구성 ›                                                  | PP Arrangement (Arrangements video 3:08): the song's 구성, ✓ on the one it uses. We pick 구성 per 예배 순서 item, so a song-level choice waits. | Off    |
| 2     | 출력 대상 ›                                             | PP Destination.                                                                                                                                 | Off    |
| 3     | 슬라이드 편집, 크기 바꾸기 ›                            | PP Edit (slide editor), Resize.                                                                                                                 | Off    |
| 3     | 가사 편집                                               | Opens the song in 준비 (PP Reflow).                                                                                                             | New    |
| 4     | 복사, 붙여넣기, 복제                                    | PP clipboard rows, with icons (Arrangements video 3:08).                                                                                        | Off    |
| 4     | 이름 바꾸기                                             | No icon, text aligned with the icon rows.                                                                                                       | Off    |
| 4     | 삭제                                                    | No icon, as in PP. Confirms, then deletes.                                                                                                      | Now    |
| 5     | 탐색기에서 보기, 묶음으로 내보내기…, 그림으로 내보내기… | PP Show in Finder, Export as Bundle, Export as Images.                                                                                          | Off    |

### 이름표 팝오버

- Where: 준비 editor (LabelMenu)
- Opens: Click the label tag, 새 그룹, or Ctrl G.
- Purpose: Pick the 이름표 of a group; add one.
- PP: PP slide Group submenu (Arrangements video 0:55 and 1:07): Edit… | Ungroup
  | groups with color swatches | Settings. Colors are set in Settings > Groups,
  not in the menu.

| Group | Row           | Does                                                                                                                       | Status |
| ----- | ------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1     | 편집…         | PP Edit….                                                                                                                  | Off    |
| 1     | 이름표 없음   | Removes the 이름표 (PP Ungroup).                                                                                           | Now    |
| 2     | <이름표>      | Every 이름표 with its color swatch; ✓ in the left padding on the current one.                                              | Now    |
| 3     | 새 이름표     | Turns into a name field.                                                                                                   | Now    |
| 3     | 이름표 설정…  | Opens a dialog that lists every 이름표 with its name, color, and 삭제 (PP Settings > Groups, with a color list per group). | New    |
| -     | <이름> 색 row | Removed from the popover; colors move to 이름표 설정….                                                                     | Moved  |

- The right-click menu on a 이름표 row (이름표 관리) gives quick 색 바꾸기, 이름
  바꾸기, and 삭제 without opening 이름표 설정….

### 이름표 관리

- Where: 이름표 popover row
- Opens: Right-click a label row.
- Purpose: Act on this one 이름표.
- PP: Not seen in PP as a menu. PP edits groups in Settings > Groups (name,
  color list, delete; Arrangements video 1:02). Rows follow the list-row rule
  plus the color that PP keeps per group.

| Group | Row         | Does                                                                                         | Status |
| ----- | ----------- | -------------------------------------------------------------------------------------------- | ------ |
| 1     | 색 바꾸기   | Opens the same color popover as 매크로 색 바꾸기 (8 colors and 없음); applies to every song. | New    |
| 2     | 이름 바꾸기 | Renames it in every song.                                                                    | Now    |
| 3     | 삭제        | Deletes it.                                                                                  | Now    |

- No 복제: PP groups have no duplicate.

### 구성 고르기

- Where: 준비 song editor and 예배 순서 item (구성 Select)
- Opens: Click the 구성 select.
- Purpose: Pick the 구성; make or edit one.
- PP: PP arrangement popup (Arrangements video 2:11 and 3:11): ✓ Master, other
  arrangements | New Arrangement…, Edit Arrangements….

| Group | Row        | Does                                                                                                          | Status |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------- | ------ |
| 1     | 기본       | Alone above a separator (PP Master, 5 hacks video 3:10); ✓ when current.                                      | Now    |
| 2     | <구성>     | The song's other 구성; ✓ on the current one.                                                                  | Now    |
| 3     | 새 구성…   | Asks for a name (PP shows a small name field with 취소 and 확인).                                             | Now    |
| 3     | 구성 편집… | Opens the 구성 strip in 준비 for this song (PP Edit Arrangements… on macOS, Manage Arrangements… on Windows). | New    |

- Today 새 구성 has an icon and no "…"; both follow PP now.

### 구성 관리

- Where: 준비 구성 strip
- Opens: Right-click a 구성 segment.
- Purpose: Act on this one 구성.
- PP: Not seen in PP (27 videos, 156 articles). Rows follow the list-row rule,
  taken from the PP Look preset, playlist, and prop menus.

| Group | Row         | Does                                                        | Status |
| ----- | ----------- | ----------------------------------------------------------- | ------ |
| 1     | 복제        | Copies the 구성 as "<이름> 복사본". Allowed on 기본 too.    | Off    |
| 1     | 이름 바꾸기 | Disabled for 기본 (tooltip "기본 구성은 바꿀 수 없습니다"). | Now    |
| 2     | 삭제        | Disabled for 기본.                                          | Now    |

### 미디어 오른쪽 클릭

- Where: 미디어 view (MediaView)
- Opens: Right-click on a media tile.
- Purpose: Act on this one media file.
- PP: PP media bin item right-click (Media Inspector video 0:25): Inspector…,
  Transitions… | Behavior ›, Scaling ›, Alpha Type › | Playback, Loop, End
  Behavior › | Next Cue › | Cut, Copy, Paste, Duplicate, Rename, Delete | Show
  in Finder, Clean Up By ›.

| Group | Row                                   | Does                                                                 | Status |
| ----- | ------------------------------------- | -------------------------------------------------------------------- | ------ |
| 0     | 다시 연결…                            | Only when the file is missing; first row (ours).                     | Now    |
| 1     | 속성…, 전환 효과…                     | PP Inspector, Transitions.                                           | Off    |
| 2     | 동작 방식 ›, 크기 맞춤 ›, 알파 종류 › | PP Behavior, Scaling, Alpha Type.                                    | Off    |
| 3     | 재생 방식 ›, 반복 방식 ›, 끝날 때 ›   | PP Playback, Loop, End Behavior.                                     | Off    |
| 4     | 다음 큐 ›                             | PP Next Cue.                                                         | Off    |
| 5     | 잘라내기, 복사, 붙여넣기, 복제        | PP clipboard rows with icons.                                        | Off    |
| 5     | 이름 바꾸기                           | No icon.                                                             | Off    |
| 5     | 재생목록에서 빼기                     | Only inside a playlist (ours), right before 삭제.                    | Now    |
| 5     | 삭제                                  | Trash icon, as in PP. Deletes.                                       | Now    |
| 6     | 탐색기에서 보기, 정리 기준 ›          | PP Show in Finder, Clean Up By.                                      | Off    |
| -     | 복사 멈추기                           | While the file is being copied, the menu holds only this row (ours). | Now    |

- Audio files in a 오디오 playlist follow the PP audio item menu (same video
  0:26): 탐색기에서 보기 (off), 재생 방식 › (off), 효과음으로 지정 (off) | 속성…
  (off), 이름 바꾸기 (off) | 삭제.

### 재생목록 오른쪽 클릭

- Where: 미디어 and 오디오 playlist list
- Opens: Right-click a playlist row.
- Purpose: Act on this one playlist.
- PP: PP media playlist right-click (support article screenshot, 2026).

| Group | Row         | Does                          | Status |
| ----- | ----------- | ----------------------------- | ------ |
| 1     | 통신에 사용 | PP Select for Communications. | Off    |
| 2     | 이름 바꾸기 | Rename.                       | Now    |
| 2     | 복제        | PP Duplicate.                 | Off    |
| 2     | 삭제        | Delete.                       | Now    |

### Look 메뉴

- Where: Toolbar Look button (LookMenu)
- Opens: Click Look.
- Purpose: Pick the live Look.
- PP: PP toolbar Look menu (Announcement Layer video 0:37; blog image): Look
  names with ✓ on the live one | Edit Looks….

| Group | Row         | Does                                                              | Status |
| ----- | ----------- | ----------------------------------------------------------------- | ------ |
| 1     | <Look 이름> | ✓ on the current Look (fixes the check that is always off today). | Now    |
| 2     | Look 편집…  | Opens 화면 설정 at Looks.                                         | New    |

### Look 오른쪽 클릭

- Where: 화면 설정 > Look list
- Opens: Right-click a Look.
- Purpose: Act on this one Look.
- PP: PP look preset right-click (Audience Looks video 1:15): Make Live |
  Duplicate, Rename, Delete.

| Group | Row         | Does                                                                                      | Status |
| ----- | ----------- | ----------------------------------------------------------------------------------------- | ------ |
| 1     | 지금 적용   | Makes this the live Look (PP Make Live), the same as picking it in the toolbar Look menu. | New    |
| 2     | 복제        |                                                                                           | Now    |
| 2     | 이름 바꾸기 | Was 이름 변경.                                                                            | Now    |
| 2     | 삭제        | Disabled for the live Look.                                                               | Now    |

- No icons and no separator before 삭제, as in PP.

### 가사 스타일 오른쪽 클릭

- Where: 화면 설정 > Look > 가사 스타일 tabs
- Opens: Right-click a style tab.
- Purpose: Act on this one style.
- PP: PP theme right-click (Rename Theme, Delete Theme).

| Group | Row         | Does                                           | Status  |
| ----- | ----------- | ---------------------------------------------- | ------- |
| 1     | 이름 바꾸기 |                                                | Now     |
| 1     | 삭제        | Disabled when in use.                          | Now     |
| -     | 새 스타일   | Removed from the menu; the + button makes one. | Removed |

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

| Group | Row               | Does                                                                                          | Status |
| ----- | ----------------- | --------------------------------------------------------------------------------------------- | ------ |
| 1     | 이름 바꾸기       |                                                                                               | Now    |
| 1     | 삭제              | Hidden when the group has one screen.                                                         | Now    |
| 1     | 사용 안 함 / 사용 | Turns this screen's output off or on (the same switch as the per-screen check in 출력 today). | New    |

### 무대 배치 고르기

- Where: 진행 도구 > 무대, one select per stage screen (StageTab)
- Opens: Click the select under a stage screen name.
- Purpose: Pick the layout this stage screen shows.
- PP: PP Stage panel layout popup (Stage Displays video 3:45; Interface Overview
  1:52): Edit Selected Layout… | layouts with thumbnails, ✓ on the current one.

| Group | Row               | Does                                                                    | Status |
| ----- | ----------------- | ----------------------------------------------------------------------- | ------ |
| 1     | 선택한 배치 편집… | Opens 화면 설정 > 무대 at this layout.                                  | New    |
| 2     | <배치>            | Each layout with a small thumbnail of its layout; ✓ on the current one. | New    |

- Today it is a plain name list.

### 무대 배치 오른쪽 클릭

- Where: 화면 설정 > 무대
- Opens: Right-click a layout.
- Purpose: Act on this one layout.
- PP: Not seen in PP (27 videos, 156 articles). Rows follow the list-row rule,
  taken from the PP Look preset, playlist, and prop menus.

| Group | Row         | Does                          | Status |
| ----- | ----------- | ----------------------------- | ------ |
| 1     | 복제        |                               | Now    |
| 1     | 이름 바꾸기 | Was 이름 변경.                | Now    |
| 2     | 삭제        | Disabled when a Look uses it. | Now    |

- Already matches the rule; only the wording and the separator change.

### 파일

- Where: Menu bar
- Opens: Click 파일.
- Purpose: Make, bring in, and save out files.
- PP: PP File menu (support article, 2026).

| Group | Row               | Does                                                                                  | Status                                |
| ----- | ----------------- | ------------------------------------------------------------------------------------- | ------------------------------------- |
| 1     | 새 곡             | PP New Presentation.                                                                  | Off                                   |
| 1     | 새 예배           |                                                                                       | Now                                   |
| 1     | 새 라이브러리     |                                                                                       | Off                                   |
| 1     | 가져오기 ›        | 텍스트 파일… (Ctrl Shift I), 라이브러리… (off), 미디어…, 클립보드 텍스트…, 다른 예배… | MultiTracks… (off), SongSelect… (off) | PowerPoint를 슬라이드로…, 그림으로…, 개체와 글자로… (off). | Now |
| 2     | 내보내기 ›        |                                                                                       | Off                                   |
| 2     | 예배를 틀로 저장… | Was 지금 예배를 틀로 저장.                                                            | Moved                                 |
| 3     | 인쇄…             |                                                                                       | Off                                   |

- No icons in menu bar menus (PP has none).

### 보기

- Where: Menu bar
- Opens: Click 보기.
- Purpose: Switch workspace and open tools.
- PP: PP View menu (support article, 2026).

| Group | Row                                                                                 | Does                                                        | Status |
| ----- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------ |
| 1     | 진행 (Ctrl S), 슬라이드 편집기 (off), 준비 (Ctrl R), 성경 (off)                     | Ctrl E keeps opening 준비 until a slide editor exists.      | Now    |
| 2     | 이어서 진행                                                                         | PP Continuous Playlist.                                     | Off    |
| 3     | 슬라이드 보기 ›                                                                     |                                                             | Off    |
| 4     | 오디오, 무대, 타이머, 메시지, 공지, 소품, 매크로                                    | Opens that 진행 도구 tab.                                   | New    |
| 5     | 타임코드 (off), 미디어 (Ctrl Shift V), 캘린더 (off), 동작 팔레트, 테스트 화면 (off) |                                                             | Now    |
| 6     | 미리보기 ›                                                                          |                                                             | Off    |
| 7     | 전체 화면                                                                           |                                                             | Off    |
| -     | 화면 설정                                                                           | Moved to 출력 as 화면 설정… (Ctrl Alt 1), as in PP Screens. | Moved  |

### 출력

- Where: Menu bar
- Opens: Click 출력.
- Purpose: Turn outputs on or off and change what they show.
- PP: PP Screens menu (support article, 2026).

| Group     | Row                                                             | Does                                  | Status |
| --------- | --------------------------------------------------------------- | ------------------------------------- | ------ |
| 본 화면   | 출력 끄기 / 출력 켜기, Look: <현재> ›, Look 편집…               |                                       | New    |
| 무대 화면 | 출력 끄기 / 출력 켜기, <무대 모니터>: <배치> ›, 무대 배치 편집… |                                       | New    |
| 2         | 화면 설정…                                                      | Ctrl Alt 1.                           | Moved  |
| 3         | 방송 자막 켜기, 방송 설정… (off)                                |                                       | New    |
| -         | <화면> 경고 보기                                                | Last row, only while a warning holds. | Now    |
| -         | Per-screen checks                                               | Moved to 화면 설정 (사용 안 함).      | Moved  |

### 곡 검색 결과

- Where: Toolbar 검색 (ToolbarSearch)
- Opens: Type in 검색 or Ctrl F.
- Purpose: Find a song and open or add it.
- PP: PP Quick Search (support article).

| Group | Row                                     | Does                                    | Status |
| ----- | --------------------------------------- | --------------------------------------- | ------ |
| list  | Results                                 | As today.                               | Now    |
| foot  | Enter 열기, Ctrl Enter 예배 순서에 추가 | Footer hints and the Ctrl Enter action. | New    |

## Unchanged except for the shared look

- 배경 선택 and 기본 배경 pickers
- 더 보기 tab overflow
- 성경 구절 추천
- 그룹 넣기 / 슬라이드 넣기
- 가져오기 설정
- 틀 and past-service rows in dialogs
- 다른 화면 출력
- 글꼴
- 날짜 선택
