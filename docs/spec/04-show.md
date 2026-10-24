# 04. The 진행 workspace

진행 (Show) is the workspace for the live service. The operator outputs by
clicking 장 (see 03). This document defines what each 진행 panel shows and does.
Layout and sizes follow the design system and the `ShowH` and `Compact` boards.

Terms: 장 (slide), 예배 순서 (service order), 구성 (arrangement), 이름표
(label), 본 화면 (main screen), 무대 화면 (stage screen), 방송 자막 (broadcast
captions), 진행 도구 (show tools), 퀵 실행 (quick launch), 소품 (prop), 공지
(notice), 메시지 (message), 타이머 (timer), 매크로 (macro), 라이브러리
(library), 준비 (Prep workspace). See 01.

## Layout

| Column | Panels, top to bottom                                            | Source                   |
| ------ | ---------------------------------------------------------------- | ------------------------ |
| Left   | 예배 순서 (takes the remaining height), 퀵 실행 (content height) | `ShowH`, `Layout` README |
| Center | 장 panel (remaining height), media strip (when open)             | `ShowH`, `Layout` README |
| Right  | Preview, clear row, 진행 도구 (remaining height, at least 240)   | `ShowH`, `Layout` README |

- 진행 has no 라이브러리. Its left column holds the 예배 순서 and 퀵 실행.
- Dragging column widths, remembering them per size class, and shrinking the
  preview when the window is too short follow the design system `Layout`
  document.

Source: `Main` decisions "진행 화면은 절충안" and "작업 공간 세 개", product log
(진행 screen direction).

## 예배 순서 panel

### Header

- The tab name "예배 순서", followed by the current service name and a down
  arrow (the service switcher). Clicking it opens the service list (see "Service
  list").
- 항목 추가 (add item, plus icon) at the right opens the quick add popover. It
  works as in 준비 (see 05).

### List

| Row           | Shows                                                                                            | Clicking it                                                             |
| ------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Header        | Group name, for example 예배 전 (before service), 찬양 (praise), 말씀 (sermon), 마무리 (closing) | Nothing. Headers can't be selected.                                     |
| Song          | Song icon, song title                                                                            | Selects the row and opens the song's 장 in the 장 panel, in 구성 order. |
| Bible passage | Book icon, passage name, for example 요한복음 3장 16절                                           | Selects the row and opens the passage's 장 in the 장 panel.             |
| Media         | Video icon, media name, for example 예배 전 카운트다운                                           | Selects the row and opens one media tile in the 장 panel (proposal).    |
| 공지          | 공지 icon, 공지 set name, for example 주일 광고                                                  | Selects the row and opens the 공지 images as 장 (proposal).             |
| Slot          | Icon of the accepted kind, name, dashed box                                                      | Selects the row and leaves the 장 panel empty (proposal).               |

- Clicking a row only selects it. The operator outputs by clicking a 장 in the
  장 panel.
- In the list, the up and down arrow keys move between rows (skipping headers).
  Home and End go to the first and last row. ← → Space Page Up Page Down still
  output the next and previous 장 while the list has focus (10, focus
  precedence).
- Ctrl ↓ and Ctrl ↑ select the next and previous item that can output and open
  it in the 장 panel, without outputting (다음 항목, 이전 항목; decided, 10).
- 진행 rows don't show details such as the 장 count (`ShowH`). 준비 rows do (see
  05).

### Row states

| State     | When                                                                                   | Look                                                   |
| --------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Selected  | The item open in the 장 panel                                                          | Selected row background                                |
| On output | The live 장 came from this item                                                        | LIVE badge at the right                                |
| Done      | The item started at least once since launch and sits above the current item (proposal) | Dim text                                               |
| Problem   | Something is wrong, for example the song is missing or the background file is missing  | Amber warning icon after the name, reason in a tooltip |

### Starting an item and its start 매크로

- An item starts at the moment the item that the live 장 comes from changes.
  Moving between 장 of the same item doesn't start it. Neither does clicking a
  장 of the same item again after a lyrics clear (proposal).
- If the item that starts has a start 매크로, run the 매크로 before drawing the
  장 (see 03 and 07).

### Editing the 예배 순서 in 진행

- In 진행, the operator can also drag rows to reorder them and add items with
  항목 추가 (proposal: the header has an 항목 추가 button).
- No board shows the row's right-click menu. Version 1 has "준비에서 열기" (open
  in 준비) and "삭제" (delete) (proposal). Delete works without confirmation,
  and the edit undo (Ctrl Z in 준비) restores the item (proposal).
- Deleting or moving the item that is on output doesn't change the output.

Source: `ShowH`, `Compact`, `Problems` (warning icon), `ListRow` README, `Panel`
README, `Main` decision "구성대로 진행".

## Service list

- Clicking the current service name in the 예배 순서 header opens the list right
  below it.
- A search field ("검색", search) sits at the top. Each keystroke filters the
  list by name.
- The list shows one row per 예배 순서, latest date first, with the name and a
  date such as "11월 1일" (November 1). The current service has a check mark. 틀
  (templates) aren't in this list.
- Below the list are 새 예배 (new service), 다른 예배에서 가져오기 (import from
  another service), and 지금 예배를 틀로 저장 (save the current service as a
  틀). See 05.
- Choosing another service makes it the current service at once. There is no
  confirmation, even during output.
  - The output doesn't change. The live 장, background, and 소품 stay on the
    screens until the operator clicks a 장 in the new service.
  - If the live 장 came from an item that isn't in the new service, no row shows
    the LIVE badge.
  - The app remembers the last opened service and opens it on the next launch
    (환경설정 option "시작할 때: 마지막 예배 열기").

Source: `ServiceSwitch`, `Main` decision "예배 순서 바꾸기", `Panel` README
(service switcher), `Menu` README, design system principle 6 (opening another
service needs no confirmation), product log version 63.

## 장 panel

### Header

- Left: the item name (song title) and a position. If the item in the 장 panel
  is the current item, show "live 장 position / total", for example "2 / 9".
  Otherwise, show the 장 count, for example "9장" (proposal).
- Right (song items): the background select. It shows a small image and the name
  of the item's background (the override, or the song's default background).
  Changing it saves the new media as the item's background override (proposal).
  If the item is on output, the new background goes out at once (proposal).
- If the background file is missing, an amber icon (tooltip "배경 파일을 찾을 수
  없음", background file not found) and a 다시 연결 (relink) button show before
  the select. See 08.

### 장 grid

- For a song item, the grid shows the 장 in the order of the chosen 구성. A 장
  that appears several times in the 구성 gets several tiles. In the board, a
  song with 4 장 has a 구성 of 9 tiles.
- A tile is a 16:9 picture with an 이름표 band below it. The picture shows only
  the 장's lines, not the song's background. The band shows the position in the
  sequence (from 1) and the 이름표 name, painted in the 이름표 color. Without an
  이름표, the band shows only the number.
- Clicking a tile outputs that 장 at once (see 03). The live tile has a red
  ring: only that tile, not other tiles of the same 장. The selected tile has a
  blue ring.
- The thumbnail size slider in the footer sets the number of columns (2 to 8).
  The default depends on the size class (narrow 3, regular 4, wide 6). Save the
  operator's value per size class.
- Other item kinds:
  - Bible passage: the Bible 장 (see "Bible passages").
  - Media: one media tile. Clicking it outputs that media to the media layer
    (proposal).
  - 공지: the images of the 공지 set, laid out like 장. Clicking one starts the
    공지 from that image (proposal; same behavior as the 공지 tab).
  - Header, slot: no tiles.

### Keyboard

The shortcut part of 10 is decided (2026-10-25): shortcuts follow ProPresenter
where it has a key or a behavior, and 10's choice applies where no ProPresenter
source was found.

| Key                    | Action                          | Basis                                                                         |
| ---------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| ↑, ↓ (grid has focus)  | Move the selected tile by a row | `SlideThumbnail` README, narrowed by 10 (focus precedence rule 5)             |
| Enter (grid has focus) | Output the selected tile        | `SlideThumbnail` README                                                       |
| →, Space, Page Down    | Output the next 장              | Follows ProPresenter for → and Space; Page Down for presentation remotes (10) |
| ←, Page Up             | Output the previous 장          | Follows ProPresenter for ←; Page Up for presentation remotes (10)             |
| 이름표 jump key        | Output that 이름표's 장         | Follows ProPresenter's group hot keys (10)                                    |

- → ← Space Page Up Page Down output the next and previous 장 even while the 장
  grid or the 예배 순서 list has focus, as ProPresenter does after a click on a
  slide. The grid keeps only ↑, ↓, and Enter (10, "Focus precedence").
- A mouse click in 진행 moves keyboard focus only to a text field, the 장 grid,
  or the 예배 순서 list. A click on any other button or tile, such as a 매크로
  or a 소품, leaves keyboard focus where it was (10). So after a click on a 장,
  focus is on the 장 grid and Space outputs the next 장, and after a click on a
  매크로, Space still outputs the next 장 instead of running the 매크로 again.
- Next and previous are the tiles after and before the live 장 in the current
  item's sequence. If there is no live 장, or the item open in the 장 panel
  isn't the current item, next outputs the first tile of the item in the 장
  panel (decided, no ProPresenter source found; 10).
- On the last tile, next does nothing (decided, no ProPresenter source found;
  10). Moving into the next item would start it and run its start 매크로. To
  move on, the operator picks the next item (다음 항목, Ctrl ↓) and presses →. A
  환경설정 > 진행 setting that lets next move into the next item is part of 10's
  settings proposal, which is still open. On the first tile, previous does
  nothing (proposal).
- An 이름표 jump key outputs the first tile with that 이름표 after the live 장
  in the current item's sequence. If none follows, it outputs the first tile
  with that 이름표 in the sequence (proposal: guessed from ProPresenter group
  hot keys).
- Live commands run once per key press and ignore key repeat (decided, 10).
- These keys don't work while a text field has focus (10, focus precedence).

### Editing a song that is on output

If the operator edits the lyrics of a song on output in 준비, the output screens
don't change until the next 장 goes out (proposal). The tiles in the 장 panel
change at once.

Source: `ShowH` (장 grid, 9 tiles in 구성 order, background select), `Problems`
(missing background file and 다시 연결), `SlideThumbnail` README, `Slider`
README, `Main` decision "구성대로 진행".

## Preview panel

ProPresenter's main window has one Preview window at the top right. It shows the
output of one screen, chosen with the arrow below it (Audience or Stage), and
the clear buttons sit next to it (ProPresenter 7.5 user guide, pp. 24 to 25).
This app shows the three screens at once, one large and two small (`ShowH`), and
each preview follows ProPresenter's rule: it shows what goes out.

### What a preview shows

- Each preview shows what that screen's output window draws now: every layer,
  drawn by the same rendering code with the current Look, the lyric style or
  stage layout, and the transitions (03). ProPresenter's Preview window likewise
  shows the output (guide p. 24).
- While a screen's output window restarts after a crash, or is held at the
  restart limit, the window draws the screen's empty picture, and so does its
  preview (08). The preview draws the live content again when the window draws
  it again.
- The one exception is an output that the operator turned off: its preview keeps
  the picture (see "Layout and states").
- A preview follows the live output, never the selection. A click on a 장
  outputs it (03), so the previews change at the same moment as the outputs.
  Moving the selected tile with the keyboard, opening another 예배 순서 item in
  the 장 panel, or opening the Bible panel changes no preview until something
  goes out. ProPresenter has no step between choosing a slide and showing it: a
  click shows the slide, and the active slide is outlined in the grid (guide pp.
  12, 70).
- No preview shows the next 장 as a separate picture. The next 장 appears only
  where the stage layout has a next lyrics element: on the 무대 화면 and in its
  preview (03, "무대 화면 and stage layouts"). ProPresenter does the same: Next
  Slide is a stage layout object (guide p. 41), and its main window has no next
  slide preview (guide pp. 24 to 26).
- A layer that the current Look hides on a screen doesn't show in that screen's
  preview (03, "Looks"). For example, the default Look shows only the background
  and the lyrics on the 방송 자막 (03), so its preview shows no 공지, 소품, or
  메시지. A Look that turns those layers on for the 방송 자막 shows them there
  and in its preview.
- Previews draw at the 미리보기 rate, 30 fps by default (03). A dissolve can
  look less smooth than on the output; the content is the same.

### Clears in the previews

- A clear removes its layer from the previews at the same moment as from the
  outputs, at once (03). The other layers stay. For example, after 가사 (F2) the
  본 화면 preview shows the background without the lyrics.
- When every layer of a screen is clear, its preview shows the empty picture:
  black (`output-black`) for the 본 화면 and the 무대 화면, and green for the
  방송 자막. The 무대 화면 keeps the stage layout elements that no clear
  touches: the clock, the 타이머, and the stage message (03, "Clear buttons and
  shortcuts").
- 되돌림 (Ctrl Z) brings the layer back in the previews and the outputs
  together.
- The clear buttons show which layers have something to clear (`ClearButton`
  README). ProPresenter turns a clear button red when its layer has content
  (guide p. 25); this app shows it with brightness, because red is only for 출력
  (design system README).

### Layout and states

- The panel shows one of the three screens large and the other two small. The
  small ones are always in the order 본 화면, 무대 화면, 방송 자막, without the
  large one. ProPresenter shows one screen at a time; the small previews are
  this app's addition for several screens (product log, 2026-10-24).
- Clicking a small preview makes it large and moves the large one to the small
  row, with no transition. The large preview isn't clickable. The app remembers
  which screen was large.
- The caption under the large preview shows the screen name, the target (모니터
  2, 캡처용 창), and at the right end the name of the lyric style that applies
  to that screen now (for the 무대 화면, the stage layout name). The design
  system calls this spot the "Look name", but the board values are "기본",
  "현재와 다음", and "하단 자막" (open question).
- A screen whose output is off keeps its picture and keeps following the live
  state, so the operator sees what goes out when the output turns on again (03,
  `PreviewFrame` README). Its name is dim.
- A screen with a lost monitor, or an output window held at the restart limit,
  has an amber outline (08). Tooltips give the reasons.
- A background that froze because its file is missing shows the same still frame
  as the output, with the marks in 08.
- The 방송 자막 frame has a green background.

Source: `ShowH`, `PreviewFrame` README, `Problems`, ProPresenter 7.5 user guide
(S4 in 10: Preview window pp. 24 to 26, Grid View p. 12, triggering slides p.
70, stage layout objects p. 41).

## Clear row

The row holds 모두 (all), 가사 (lyrics), 미디어 (media), 소품, 오디오 (audio),
메시지, 공지, a separator, and 되돌림 (undo), in that order. 03 defines the
behavior.

## 진행 도구

The tabs are 표시 중 (Showing), 오디오 (Audio), 무대 (Stage), 타이머, 메시지,
공지, 소품, and 매크로, in that order. The 표시 중 tab shows the number of rows
after its name, and hides it at 0.

### 표시 중 (Showing)

- The tab groups by screen (본 화면, 무대 화면, 방송 자막) and lists one row for
  each thing showing on that screen now.
- A row has a kind icon and kind name (가사, 배경, 메시지, 소품, 공지, 무대,
  시계), the content (song title with "2 / 9", media name, 메시지 text, 소품
  name, 공지 set name with "3 / 6", stage message text, clock time), a time at
  the right (playback position "0:12" for a background, time left "0:42" for a
  메시지), and a 내리기 (take down) button.
- As in the board, audience screens list lyrics, background, 메시지, 소품, and
  공지. The 무대 화면 lists the stage message and the clock. The 무대 화면's
  lyrics elements don't get rows.
- A background that shows as a still because its file is missing gets a pause
  icon, with the tooltip "배경 영상 파일을 찾을 수 없어 정지 화면으로 표시 중"
  (background video file not found, showing a still). See 08.
- 내리기 takes down only the thing in that row (proposal):
  - Lyrics: same as the lyrics clear (F2). Background: same as the media clear
    (F3).
  - 메시지: takes that 메시지 down from all its target screens. 소품: turns that
    소품 off. 공지: stops the 공지 and takes it down. 무대: takes the stage
    message down.
  - Clock: the Look decides it, so the row has no 내리기 button.
  - A 내리기 counts as the last clear, and undo restores it (proposal).

### 오디오 (Audio)

- Top: the audio playlist select (for example 예배 전 음악, pre-service music),
  the track count ("5곡", 5 tracks), and 반복 (repeat, a toggle that loops the
  playlist).
- Middle: the track list (number, title, duration). The playing track shows a
  sound wave icon instead of its number. Clicking a row plays that track at once
  (proposal).
- Bottom: the playing track name and position ("1:24 / 3:42"), a playback bar
  (view only), 이전 (previous), 재생 (play) or 일시 정지 (pause), 다음 (next),
  페이드 아웃 (fade out), and a volume slider.
- When a track ends, the next one plays. When the last track ends, the list
  starts over if 반복 is on, and stops otherwise (proposal).
- 페이드 아웃 lowers the sound over 3 seconds and then stops (proposal).
- Volume changes live while the operator drags. It applies only to the audio
  layer, not to the sound of background videos (proposal).
- Sound plays on the Windows default output device (proposal).
- The audio clear (F5) stops playback (see 03).

### 무대 (Stage)

- 무대 화면 row: the stage screen name and the stage layout select ("현재와
  다음"). Changing it changes only the stage screen's current layout (see 03).
- 타이머 row: the 타이머 to show in the stage layout's 타이머 element (the board
  shows "시계 11:24") (proposal).
- Stage message: a text field, a LIVE badge while the message is on, 내리기
  (take down), and 보내기 (send). 보내기 or Enter sends the text to the 무대
  화면 (Enter is a proposal). A new message replaces the previous one.
- Preset chips: 후렴 한 번 더 (chorus once more), 마지막 후렴 (last chorus),
  처음부터 (from the top), 천천히 (slowly), 조금 빠르게 (a bit faster), 5분 남음
  (5 minutes left), 마무리 (wrap up). Clicking a chip sends its text at once
  (proposal). The chip that is on shows in the on-output color.
- Store the presets in the app-wide settings (`stagePresets` in `messages.json`,
  see 02). No board shows where to add or edit them (open question).

### 타이머

- One row per 타이머: an icon, the name and kind ("10:30까지" until 10:30,
  "35분" 35 minutes, "10:30부터" since 10:30, "시계" clock), a large value, 시작
  (start) or 일시 정지 (pause), and 처음으로 (reset). The clock has no buttons.
- Behavior by kind (proposal):
  - Until a time (`countdownTo`): once started, counts the time left until the
    set time.
  - Fixed duration (`countdown`): once started, counts down from the duration.
    Pause stops it, and start resumes it. Past 0, it shows the overrun with a
    leading "-".
  - Since a time (`elapsedFrom`): counts the time since the set time.
  - 처음으로 resets to the start value and stops.
- Values under an hour show as "minutes:seconds", and longer values as
  "hours:minutes:seconds" (proposal).
- 타이머 keep running regardless of clears. They show in 소품 text and in the
  stage layout's 타이머 element.
- No board shows where to add or edit a 타이머 (open question). Version 1 has a
  plus button in the tab and a right-click menu on each row (rename, change kind
  and time, delete) (proposal).

### 메시지

- The template list: icon, name, and the sentence with its blanks shown as
  chips. Choosing a template shows one field per blank below it (the board shows
  "차량 번호" with "12가 3456").
- 보낼 화면 (send to): chips for 모든 화면 (all screens), 본 화면, 무대, and
  방송 자막, each a toggle. Turning on 모든 화면 turns the others off, and
  turning on any other turns 모든 화면 off (proposal).
- 표시 시간 (display time): 계속 (until cleared), 30초, 1분, 2분.
- Below, a preview of the finished sentence and 보내기 (send). If a blank is
  empty or no screen is chosen, 보내기 is unavailable, with the reason in a
  tooltip (proposal).
- Sending puts the 메시지 on the 메시지 layer of the target screens and replaces
  the previous 메시지 on those screens (see 03). When the display time ends, it
  comes down by itself. The 표시 중 tab shows the time left.
- No board shows where to add or edit templates (open question). Version 1 uses
  a plus button in the tab and a right-click menu (edit, delete) to set the name
  and sentence (proposal).

### 공지

- Top: the 공지 set select (for example 주일 광고), the image count ("6장"), the
  interval ("8초"), 반복 (repeat), and 일시 정지 (pause) or 재생 (play).
- Middle: the grid of 공지 images. The image that is showing has a red ring.
- Bottom: 보낼 화면 chips (본 화면, 무대, 방송 자막).
- Clicking an image shows it at once on the 공지 layer of the target screens,
  and then advances to the next image at each interval. After the last image,
  the set starts over if 반복 is on, and otherwise stays on the last image
  (proposal).
- 일시 정지 stops advancing and keeps the current image.
- Changing the target screens while a 공지 runs applies at once (proposal).
- The 공지 clear (F7) stops the 공지 and takes it down.
- No board shows where to create a 공지 set or add images (open question).
  Version 1 has a plus button in the tab that makes a 공지 set from a media
  image playlist. Clicking the interval value changes it (proposal).

### 소품

- A grid of 소품 tiles: the 소품's picture, name, and target screen name. A 소품
  that is on has a red ring.
- Clicking a tile turns it on. Clicking again turns it off (proposal). Several
  소품 can be on at the same time.
- The 소품 clear (F4) turns every 소품 off.
- No board shows where to create or edit a 소품 (open question). Version 1 has a
  plus button in the tab and a right-click menu to set the name, content (image
  or text), and target screens (proposal).

### 매크로

The tab shows the collection select (for example 주일 예배) with the count
("8개"), the grid and list views, the 매크로 tiles, and a 새 매크로 (new 매크로)
tile at the end. See 07.

Source: `Overlays` (eight tabs), `ShowH` (표시 중), `Problems` (still
background), `Macros`, `ClearButton` README, `MacroTile` README, `StatusMarks`
README (count badge).

## 퀵 실행

### Panel

- Header: "퀵 실행" and 퀵 실행 추가 (add, plus icon).
- Tool row: the Bible passage field (book icon, placeholder "요 3:16, 창
  1:1-5"). See "Bible passages".
- List: one row per item, with a kind icon and a name. Rows show no shortcuts.

### Clicking an item

Clicking a row runs it at once. A toggle item keeps a red bar at the left of its
row while it's on. Clicking it again turns it off.

| Kind          | Example in the board              | Clicking it                                                                                                                                                    | Toggle             |
| ------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Bible passage | 요한복음 3장 16절                 | Opens the passage in the Bible panel and outputs its first 장 (proposal).                                                                                      | No                 |
| Song          | 주 하나님 지으신 모든 세계        | Opens the song in the 장 panel with the default 구성 and outputs its first 장 (proposal). Doesn't add it to the 예배 순서 or change the background (proposal). | No                 |
| Black screen  | 검은 화면                         | Turns on or off a built-in 소품 that covers every audience screen with black (proposal).                                                                       | Yes                |
| 소품          | 로고 화면 (logo screen)           | Turns that 소품 on or off.                                                                                                                                     | Yes                |
| 타이머        | 시작 카운트다운 (start countdown) | Starts that 타이머, or pauses it if it's running (proposal).                                                                                                   | Yes, while running |
| 매크로        |                                   | Runs that 매크로 (proposal).                                                                                                                                   | No                 |

- The board's 축도 (benediction, 장 icon) is read as a short song made in the
  라이브러리 (proposal, open question).
- The black screen sits on the 소품 layer, so the 소품 clear (F4) also takes it
  down (proposal).

### Adding and editing (proposal)

No board shows how to add a 퀵 실행 item (open question). Version 1 works like
this:

- 퀵 실행 추가 opens a menu: add the item in the 장 panel (a song or Bible
  passage), 소품 (submenu), 타이머 (submenu), 매크로 (submenu), 검은 화면.
- The operator can also drag song and Bible passage rows from the 예배 순서 into
  퀵 실행.
- Dragging rows reorders them. The right-click menu has rename and delete.
- Version 1 has no 퀵 실행 shortcuts (see 09).

Source: `ShowH`, `Compact`, `Problems`, `Bible` (퀵 실행 list), `ListRow` README
(퀵 실행 on state), `Main` decisions "퀵 실행은 목록" and "단축키", product log
(퀵 실행 shortcuts deferred).

## Media strip

- The toolbar's 미디어 (Media) button opens and closes the strip. It starts open
  in regular and wide windows, and closed in narrow windows or when the window
  is shorter than 900. When the operator opens or closes it, the app remembers
  that.
- Header: "미디어", the media playlist select (for example 배경 영상, background
  videos), and 가져오기 (import). 가져오기 opens a file dialog and adds the
  chosen files to the media list and the current playlist (proposal; the same
  import as in the media view, see 05).
- Tiles sit in one row and scroll horizontally. A tile shows the picture, the
  duration (with a loop icon when it loops), and the name.
- Clicking a tile outputs that media as the background at once (see 03). The
  current background tile has a red ring.
- A tile whose file is missing shows hatching and an amber icon. Clicking it
  opens a file dialog to relink the file (see 08). A tile that is still copying
  can't be clicked.

Source: `ShowH`, `Problems`, `MediaTile` README, `Layout` README.

## Bible passages

### Finding a passage

- The operator types a reference such as "요 3:16-18" in the 퀵 실행 Bible
  field.
- Suggestions open below the field. The "구절" (passages) group lists books that
  start with the typed text, with the range and verse count (요한복음 3:16-18,
  요한일서, 요엘). The "최근" (recent) group lists recent passages (창세기
  1:1-5, 시편 23:1-6). The up and down arrow keys move through them. A click or
  Enter chooses one.
- As soon as the text is a valid reference, the Bible panel opens in place of
  the 장 panel in the center column.
- References can use the full book name or its abbreviation, with
  "chapter:verse", "chapter:verse-verse", "chapter:verse-chapter:verse", or a
  whole chapter (proposal). The grammar and the book matching are in 02
  ("Reference grammar", "What comes from copible").

### Bible panel

- Header: the passage ("요한복음 3:16-18") and the 장 count ("3장").
- Settings row: the translation select (개역한글) with 역본 추가 (add
  translation), 나누기 (split: 한 장에 한 절 one verse per 장, 두 절씩 two
  verses, 길이에 맞춤 fit to length), 참조 (reference: 장마다 every 장), 절 번호
  (verse numbers), and 역본 이름 (translation name).
  - Fit to length fills each 장 with verses up to the 환경설정 option 한 장 최대
    줄 수 (maximum lines per 장) (proposal).
  - 참조 decides where the reference (3:16) appears. The board shows only
    "장마다". The reference text draws at the 환경설정 option 출처 위치
    (reference position, bottom right) (proposal).
  - Turning on 역본 이름 appends the translation name after the reference
    (proposal).
  - 역본 추가 opens the Bible page of 환경설정 (proposal).
- Bible 장 grid: each 장 shows its verse numbers and text, and the band shows
  the number and the reference ("3:16"). Clicking a tile outputs that 장 at
  once. The next and previous keys work within the passage.
- 화면별 보기 (per-screen view, "1 / 3"): shows how the selected 장 looks on the
  본 화면 and the 방송 자막, with the screen name, target, and style name.
- Buttons: 앞 절 추가 (add the previous verse), 뒤 절 추가 (add the next verse),
  예배 순서에 넣기 (add to the 예배 순서), and 바로 띄우기 (show now, outputs
  the selected 장; the primary button).
- 예배 순서에 넣기 inserts a Bible passage item after the selected 예배 순서
  item. If the selected row is a Bible passage slot, the passage fills it
  (proposal).
- Enter in the passage field does the same as 바로 띄우기. If the suggestion
  list points to a different row, Enter first chooses that suggestion (proposal:
  reconciles the `TextField` document, which says Enter shows the passage, with
  the board, which says the operator checks the preview before showing it; open
  question).
- If the reference isn't valid, the field shows an error ring with the reason in
  a tooltip, for example "알아볼 수 없는 구절입니다" (passage not recognized)
  (proposal).
- Bible 장 go to the lyrics layer and draw with the current Look's lyric style
  (proposal). Whether the board's 본 화면 style name "말씀" (sermon) is a style
  only for Bible passages is an open question.
- A passage that the operator outputs or adds to the 예배 순서 goes to the front
  of the recent list (up to 10, proposal).
- Choosing a row in the 예배 순서 closes the Bible panel and returns to the 장
  panel (proposal).

Source: `Bible`, `TextField` README (퀵 실행 field), `Prefs` 성경 (Bible),
`Main` board guide (성경 구절 띄우기), product log (copible, offline).

## Toolbar search (proposal)

No board shows where search results appear (open question). Version 1 works like
this:

- In 진행, typing in the toolbar search field opens a list of 라이브러리 songs
  below the field, matched by title, lyrics, or initial consonants.
- Choosing a song opens it in the 장 panel with the default 구성. It isn't added
  to the 예배 순서. Clicking its 장 outputs them.
- In 준비, choosing a result selects the song in the 라이브러리 and opens the
  song editor (see 05).

## Narrow windows (width 1280 to 1599)

The features are the same. Only the layout differs.

| Element             | Narrow window                                                                                                                                                                                                            | Source                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| Toolbar             | Height 40, names to the right of icons, 미디어 as an icon only, search field 280                                                                                                                                         | `Compact`, `Toolbar` README      |
| Columns             | Left 220, right 360                                                                                                                                                                                                      | `Layout` README                  |
| Media strip         | Starts closed                                                                                                                                                                                                            | `Compact`                        |
| 장 grid             | 3 columns by default                                                                                                                                                                                                     | `Compact`                        |
| Clear row           | Icons only (names in tooltips), 모두 is 1.4 times as wide                                                                                                                                                                | `Compact`, `ClearButton` README  |
| 진행 도구 tabs      | 표시 중, 무대, and 더 보기 (more). 더 보기 opens a menu with 오디오, 타이머, 메시지, 공지, 소품, and 매크로. Choosing one shows that tab's content, with 더 보기 shown as the active tab (proposal).                     | `Compact`, `Layout` README       |
| Small previews      | A row with 64 px pictures, name and target on two lines                                                                                                                                                                  | `Compact`, `PreviewFrame` README |
| 퀵 실행 Bible field | Small field, placeholder "요 3:16"                                                                                                                                                                                       | `Compact`                        |
| 예배 순서 header    | Adds 사이드바 접기 (collapse sidebar). Clicking it collapses the left column. A button at the edge of the collapsed column expands it again (proposal). The app remembers the collapsed state per size class (proposal). | `Compact`                        |

Source: `Compact`, `Main` board guide (진행 화면 1366×768), design system README
(window sizes and layout), `Layout` README.

## Keyboard summary for 진행

Decided on 2026-10-25. The full command list, where each command works, and how
keys are changed are in 10, "Shortcut system".

| Key                                              | Action                                                          | Basis                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| →, Space, Page Down                              | Next 장                                                         | Follows ProPresenter; Page Down for presentation remotes                 |
| ←, Page Up                                       | Previous 장                                                     | Follows ProPresenter; Page Up for presentation remotes                   |
| Ctrl ↓, Ctrl ↑                                   | Select the next or previous item (다음 항목, 이전 항목)         | No ProPresenter source found                                             |
| Ctrl L                                           | Open the item of the live 장 (출력 중인 항목 열기)              | Follows ProPresenter (Show Triggered Presentation)                       |
| Alt →, Alt ←                                     | Next or previous background in the media strip's playlist       | Follows ProPresenter (Next and Previous Background)                      |
| F1 to F7                                         | Clear all, lyrics, media, 소품, audio, 메시지, 공지             | Follows ProPresenter                                                     |
| Ctrl Z                                           | 되돌림 (undo the last clear)                                    | Follows ProPresenter (Undo)                                              |
| Ctrl 1                                           | Audience screen outputs (본 화면 and 방송 자막) on or off       | Follows ProPresenter (Toggle Output Screens)                             |
| Ctrl 2                                           | 무대 화면 output on or off                                      | Follows ProPresenter (Toggle Stage Display Screens)                      |
| Alt S, Ctrl M, Ctrl Shift C, Ctrl Shift P, Alt C | The 무대, 메시지, 타이머, and 소품 tabs, and the action palette | Follows ProPresenter                                                     |
| Ctrl Alt B                                       | The Bible field in 퀵 실행                                      | Follows ProPresenter (Open Bibles Mode)                                  |
| 이름표 jump key (a bare letter or digit)         | That 이름표's 장                                                | Follows ProPresenter (group hot keys); no default keys                   |
| A key set for a Look, 소품, 매크로, or 타이머    | That object's command                                           | No default keys; follows ProPresenter's Key Mappings for 소품 and 매크로 |
