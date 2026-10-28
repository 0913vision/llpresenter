# 04. The 진행 workspace

진행 (Show) is the workspace for the live service. The operator outputs by
clicking 슬라이드 (see 03). This document defines what each 진행 panel shows and
does. Layout and sizes follow the design system and the `ShowH` and `Compact`
boards.

Terms: 슬라이드 (slide), 예배 순서 (service order), 구성 (arrangement), 이름표
(label), 본 화면 (main screen), 무대 화면 (stage screen), 방송 자막 (broadcast
captions), 진행 도구 (show tools), 퀵 실행 (quick launch), 소품 (prop), 공지
(notice), 메시지 (message), 타이머 (timer), 매크로 (macro), 라이브러리
(library), 준비 (Prep workspace). See 01.

## Layout

| Column | Panels, top to bottom                                            | Source                   |
| ------ | ---------------------------------------------------------------- | ------------------------ |
| Left   | 예배 순서 (takes the remaining height), 퀵 실행 (content height) | `ShowH`, `Layout` README |
| Center | 슬라이드 panel (remaining height)                                | `ShowH`, `Layout` README |
| Right  | Preview, clear row, 진행 도구 (remaining height, at least 240)   | `ShowH`, `Layout` README |

- The shared bottom 미디어 bin sits below the workspace columns when open; its
  own playlists, content and properties are described below.
- 진행 has no 라이브러리. Its left column holds the 예배 순서 and 퀵 실행.
- Dragging column widths, remembering them per size class, and shrinking the
  preview when the window is too short follow the design system `Layout`
  document.

Source: `Main` decisions "진행 화면은 절충안" and "작업 공간 세 개", product log
(진행 screen direction).

## 예배 순서 panel

### Header

- The open service's name replaces the generic visible label, followed by a down
  arrow (M2 check 1, chosen alternative A). Keep the 34px header and the
  component's 16/22 semibold name, even when the general heading style changes
  to 18/24. The menu bar keeps the service name too.
- The panel's accessible name stays "예배 순서". A long service name ends in an
  ellipsis and shows in full on hover. With no service open, the header shows
  "예배 순서" without a down arrow.
- Clicking the name opens the service picker described under "Service list".
- 항목 추가 (add item, plus icon) at the right opens the quick add popover. It
  works as in 준비 (see 05).

### List

| Row            | Shows                                                                                            | Clicking it                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Section (구역) | Group name, for example 예배 전 (before service), 찬양 (praise), 말씀 (sermon), 마무리 (closing) | Selects the section as the target for 항목 추가; the 슬라이드 panel stays empty.    |
| Song           | Song icon, song title                                                                            | Selects the row and opens the song's 슬라이드 in the 슬라이드 panel, in 구성 order. |
| Bible passage  | Book icon, passage name, for example 요한복음 3장 16절                                           | Selects the row and opens the passage's 슬라이드 in the 슬라이드 panel.             |
| Media          | Video icon, media name, for example 예배 전 카운트다운                                           | Selects the row and opens one media tile in the 슬라이드 panel (proposal).          |
| 공지           | 공지 icon, 공지 set name, for example 주일 광고                                                  | Selects the row and opens the 공지 images as 슬라이드 (proposal).                   |

- Clicking a row only selects it. The operator outputs by clicking a 슬라이드 in
  the 슬라이드 panel.
- A 구역 can be empty and remains visible and selectable. The operator can add
  it with 구역 추가 (new row 새 구역), rename it, or remove it. 항목 추가 adds
  into the selected section, or the section containing the selected item; with
  no selection, it appends to the service. See 05.
- In the list, the up and down arrow keys move between sections and item rows.
  Home and End go to the first and last row. ← → Space Page Up Page Down still
  output the next and previous 슬라이드 while the list has focus (10, focus
  precedence).
- Ctrl ↓ and Ctrl ↑ select the next and previous item that can output and open
  it in the 슬라이드 panel, without outputting (다음 항목, 이전 항목; decided,
  10).
- 진행 rows don't show details such as the 슬라이드 count (`ShowH`). 준비 rows
  do (see 05).

### Row states

| State     | When                                                                                   | Look                                                   |
| --------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Selected  | The item open in the 슬라이드 panel                                                    | Selected row background                                |
| On output | The live 슬라이드 came from this item                                                  | LIVE badge at the right                                |
| Done      | The item started at least once since launch and sits above the current item (proposal) | Dim text                                               |
| Problem   | Something is wrong, for example the song is missing or the background file is missing  | Amber warning icon after the name, reason in a tooltip |

### Starting an item and its start 매크로

- An item starts at the moment the item that the live 슬라이드 comes from
  changes. Moving between 슬라이드 of the same item doesn't start it. Neither
  does clicking a 슬라이드 of the same item again after a lyrics clear
  (proposal).
- If the item that starts has a start 매크로, run the 매크로 before drawing the
  슬라이드 (see 03 and 07).

### Editing the 예배 순서 in 진행

- In 진행, the operator can also drag rows to reorder them and add items with
  항목 추가 (proposal: the header has an 항목 추가 button).
- No board shows the row's right-click menu. Version 1 has "준비에서 열기" (open
  in 준비) and "삭제" (delete) (proposal). Delete works without confirmation,
  and Ctrl Z or 편집 > 실행 취소 restores the item (proposal). Both always run
  edit undo and never restore cleared output (M2 check 1 row 8; 03, 10).
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
- Remaining work (prep, M3-P4): below the list, add 새 예배 (new service), 다른
  예배에서 가져오기 (import from another service), and 지금 예배를 틀로 저장
  (save the current service as a 틀). These three actions are not implemented
  yet. See 05.
- Choosing another service makes it the current service at once. There is no
  confirmation, even during output.
  - The output doesn't change. The live 슬라이드, background, and 소품 stay on
    the screens until the operator clicks a 슬라이드 in the new service.
  - If the live 슬라이드 came from an item that isn't in the new service, no row
    shows the LIVE badge.
  - The app remembers the last opened service and opens it on the next launch
    (환경설정 option "시작할 때: 마지막 예배 열기").

Source: `ServiceSwitch`, `Main` decision "예배 순서 바꾸기", `Panel` README
(service switcher), `Menu` README, design system principle 6 (opening another
service needs no confirmation), product log version 63.

## 슬라이드 panel

### Header

- Left: the item name (song title) and a position. If the item in the 슬라이드
  panel is the current item, show "live 슬라이드 position / total", for example
  "2 / 9". Otherwise, show the 슬라이드 count, for example "슬라이드 9개"
  (proposal).
- Right (song items): the background select. It shows a small image and the name
  of the item's background (the override, or the song's default background).
  Changing it saves the new media as the item's background override (proposal).
  If the item is on output, the new background goes out at once (proposal).
- If the background file is missing, an amber icon (tooltip "배경 파일을 찾을 수
  없음", background file not found) and a 다시 연결 (relink) button show before
  the select. See 08.

### 슬라이드 grid

- For a song item, the grid shows the 슬라이드 in the order of the chosen 구성.
  A 슬라이드 that appears several times in the 구성 gets several tiles. In the
  board, a song with 4 슬라이드 has a 구성 of 9 tiles.
- A tile is a 16:9 picture with an 이름표 band below it. The picture shows only
  the 슬라이드's lines, not the song's background. The band shows the position
  in the sequence (from 1) and the 이름표 name, painted in the 이름표 color.
  Without an 이름표, the band shows only the number.
- Clicking a tile outputs that 슬라이드 at once (see 03). The live tile has a
  red ring: only that tile, not other tiles of the same 슬라이드. In 진행, don't
  draw a keyboard focus border around thumbnails, including after arrow
  navigation. Keep keyboard focus and activation behavior. In 준비, keep the
  blue keyboard focus border so selection can move before an edit (decided, M2
  check 1 row 3).
- The footer has a continuous size slider and a synchronized % field (M2 check 1
  row 9). The proposed range is 50% to 200%, step 1 percentage point for typing
  and keyboard adjustment, default 100%. Pointer dragging changes the size
  smoothly without snapping to a column count. At 100%, the baseline fits narrow
  3, regular 4, or wide 6 columns; thumbnails retain their scaled width when the
  number of columns changes. Save the percentage per size class, not a column
  count. 10 defines the mapping, storage, and reasons.
- Other item kinds:
  - Bible passage: the Bible 슬라이드 (see "Bible passages").
  - Media: one media tile. Clicking it outputs that media to the media layer
    (proposal).
  - 공지: the images of the 공지 set, laid out like 슬라이드. Clicking one
    starts the 공지 from that image (proposal; same behavior as the 공지 tab).
  - Section (구역): no tiles.

### Keyboard

The shortcut part of 10 is decided (2026-10-25): shortcuts follow ProPresenter
where it has a key or a behavior, and 10's choice applies where no ProPresenter
source was found.

| Key                    | Action                          | Basis                                                                                         |
| ---------------------- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| ↑, ↓ (grid has focus)  | Move the selected tile by a row | `SlideThumbnail` README, narrowed by 10 (focus precedence rule 5)                             |
| Enter (grid has focus) | Output the selected tile        | `SlideThumbnail` README                                                                       |
| →, Space, Page Down    | Output the next 슬라이드        | Follows ProPresenter for → (S1) and Space (S4 p. 70); Page Down for presentation remotes (10) |
| ←, Page Up             | Output the previous 슬라이드    | Follows ProPresenter for ← (S1); Page Up for presentation remotes (10)                        |
| 이름표 jump key        | Output that 이름표's 슬라이드   | Follows ProPresenter's group hot keys (S4 pp. 58, 176; 10)                                    |

- → ← Space Page Up Page Down output the next and previous 슬라이드 even while
  the 슬라이드 grid or the 예배 순서 list has focus, as ProPresenter does after
  a click on a slide (S4 p. 70). The grid keeps only ↑, ↓, and Enter (10, "Focus
  precedence").
- A mouse click in 진행 moves keyboard focus only to a text field, the 슬라이드
  grid, or the 예배 순서 list. A click on any other button or tile, such as a
  매크로 or a 소품, leaves keyboard focus where it was (10). So after a click on
  a 슬라이드, focus is on the 슬라이드 grid and Space outputs the next 슬라이드,
  and after a click on a 매크로, Space still outputs the next 슬라이드 instead
  of running the 매크로 again.
- Next and previous are the tiles after and before the live 슬라이드 in the
  current item's sequence. If there is no live 슬라이드, or the item open in the
  슬라이드 panel isn't the current item, next outputs the first tile of the item
  in the 슬라이드 panel (decided, no ProPresenter source found; 10).
- On the last tile, next does nothing (decided, no ProPresenter source found;
  10). Moving into the next item would start it and run its start 매크로. To
  move on, the operator picks the next item (다음 항목, Ctrl ↓) and presses →. A
  환경설정 > 진행 setting that lets next move into the next item is part of 10's
  settings proposal, which is still open. On the first tile, previous does
  nothing (proposal).
- An 이름표 jump key outputs the first tile with that 이름표 after the live
  슬라이드 in the current item's sequence. If none follows, it outputs the first
  tile with that 이름표 in the sequence (proposal: ProPresenter's hot keys jump
  to a slide, S4 pp. 58 and 176, but no ProPresenter source says which
  occurrence of a repeated group).
- Live commands run once per key press and ignore key repeat (decided, 10).
- These keys don't work while a text field has focus (10, focus precedence).

### Editing a song that is on output

If the operator edits the lyrics of a song on output in 준비, the output screens
don't change until the next 슬라이드 goes out (proposal). The tiles in the
슬라이드 panel change at once.

Source: `ShowH` (슬라이드 grid, 9 tiles in 구성 order, background select),
`Problems` (missing background file and 다시 연결), `SlideThumbnail` README,
`Slider` README, `Main` decision "구성대로 진행".

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
- A preview follows the live output, never the selection. A click on a 슬라이드
  outputs it (03), so the previews change at the same moment as the outputs.
  Moving the selected tile with the keyboard, opening another 예배 순서 item in
  the 슬라이드 panel, or opening the Bible panel changes no preview until
  something goes out. ProPresenter has no step between choosing a slide and
  showing it: a click shows the slide, and the active slide is outlined in the
  grid (guide pp. 12, 70).
- No preview shows the next 슬라이드 as a separate picture. The next 슬라이드
  appears only where the stage layout has a next lyrics element: on the 무대
  화면 and in its preview (03, "무대 화면 and stage layouts"). ProPresenter does
  the same: Next Slide is a stage layout object (guide p. 41), and its main
  window has no next slide preview (guide pp. 24 to 26).
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
- The optional 되돌리기 button brings the cleared layers back in the previews
  and the outputs together (03). Ctrl Z only undoes edits.
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
메시지, and 공지, in that order. When 지우기 되돌리기 단추 보이기 is on, append
a separator and 되돌리기 (undo); the default is off (proposal). 03 defines the
behavior. Ctrl Z never undoes a clear.

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
  - Individual message, prop and stage-message rows use `overlay.clear` with a
    `message` and `messageId`, `prop` and `propId`, or `stage-message` target.
    Message and prop IDs are lowercase UUID v4 values. Legacy single-item layers
    with older IDs use the existing whole-layer clear. Missing rows do nothing
    and preserve the previous clear's undo. Only the removed message's remaining
    display time pauses until undo; other messages keep their deadlines. Clears
    within one batch share one undo entry. A following whole-message clear
    pauses every restored message's lifetime.

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
- A track is identified by its audio playlist and its position in that playlist,
  so the same file can appear twice in one playlist (proposal).
- A 매크로's 오디오 action plays one media ID on its own, outside any playlist
  (07). That track is identified by its media ID alone. It plays once and stops
  at its end; 반복 doesn't apply. 이전 starts it again from the beginning, 다음
  stops it, and 일시 정지 and 재생 work as for a playlist track. The bottom of
  the tab shows its name and position, and no row of the track list is marked
  (proposal). A 매크로's 오디오 재생 목록 action plays that playlist from its
  first track, as a playlist track.
- 이전 (previous) plays the track before the current one; on the first track it
  starts that track again. 다음 (next) plays the next track; on the last track
  it starts the first track if 반복 is on, and stops otherwise (proposal).
- 일시 정지 (pause) keeps the position, and 재생 (play) resumes from it. 재생
  with nothing paused plays the first track of the selected playlist (proposal).
- 반복 is saved with the playlist (`audioPlaylists[].loop`, 02).
- 페이드 아웃 lowers the sound over 3 seconds and then stops (proposal).
- Volume changes live while the operator drags. It applies only to the audio
  layer, not to the sound of background videos (proposal). The range is 0 to
  100, it starts at 100 at launch, and it isn't saved: it's part of the output
  state (proposal).
- Sound plays on the Windows default output device (proposal).
- The audio clear (F5) stops playback (see 03).

### 무대 (Stage)

- 무대 화면 row: the stage screen name and the stage layout select ("현재와
  다음"). Changing it changes only the stage screen's current layout (see 03).
- 타이머 row: the 타이머 to show in the stage layout's 타이머 element (the board
  shows "시계 11:24") (proposal). The choice belongs to the current output: a
  Look change keeps it, it isn't saved, and deleting that 타이머 clears it (lead
  decision, October 26).
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

- Each timer has its own ID, configuration and running state. Starting, stopping
  or resetting one timer never changes another. 퀵 실행, the timer tab, 소품
  tokens and the stage timer picker refer to that same timer by ID; the operator
  sees its name (user decision from the October 26 check).
- One row per 타이머: an icon, the name and kind ("10:30까지" until 10:30,
  "35분" 35 minutes, "경과" elapsed, "시계" clock), a large value, 시작 (start)
  or 일시 정지 (pause), and 처음으로 (reset). The clock has no buttons.
- Behavior by kind:
  - Every kind but the clock starts with 시작 and pauses with 일시 정지; the
    button switches between the two (follows ProPresenter 7, whose Start button
    toggles between Start and Stop: Renewed Vision support article 360050782494
    on ProPresenter 7 timers).
  - 처음으로 stops the 타이머 and returns it to its settings (follows
    ProPresenter 7, where Reset returns the timer to its settings: same
    article).
  - Fixed duration (`countdown`): counts down from the duration while it runs.
  - Until a date and time (`countdownTo`): the operator chooses a calendar date
    and a local 24-hour time. While running, it counts toward that fixed target,
    including tomorrow or a later date. Starting it does not replace the target
    date with the start date (user decision, October 27).
  - Both countdown kinds have 0 지나면: 계속 or 멈춤. 계속 counts below zero
    with a leading "-". 멈춤 stops at zero, holds zero and clears the running
    state. Starting a finished fixed-duration countdown starts again from its
    full duration; 처음으로 restores its configured value without starting.
    Existing records without the option keep 계속, the current default (10).
    This replaces the earlier always-overrun rule (user decision, October 27,
    following ProPresenter's Overrun option).
  - Elapsed (`elapsed`): counts up from a nonnegative start value, like a
    stopwatch. The operator enters the start value as a duration. A stopped
    timer starts at that value; pausing holds it and resuming continues from the
    held value. 처음으로 returns to the configured start value. Changing the
    wall clock does not change the counted duration (user decision, October 27,
    following ProPresenter's Elapsed Time).
  - Older time-of-day elapsed records (`elapsedFrom`) keep their meaning and
    show as 시각 경과, distinct from 경과. They count from the recorded time of
    day, with a leading "-" before it. New 경과 timers use a start duration.
  - Before they start, `countdownTo` and `elapsedFrom` show their value as of
    the moment they are drawn, without counting, so a row is never blank; a
    paused one keeps the value it had when it paused (lead decision, October 26;
    the article doesn't say what these timers show before they start).
  - Clock (`clock`): the current time as 24-hour "HH:mm:ss". It has no buttons
    (lead decision, October 26; a format choice is later work).
- Fixed-duration countdown and elapsed duration count on main's monotonic clock:
  the time it has counted never goes down, even when the computer's clock is
  corrected (lead decision, October 26).
- `countdownTo` and `elapsedFrom` show the time to or since the set time by the
  wall clock, including after a correction of the computer's clock, so a
  "10:30까지" countdown reaches 0 when the clock in the room reads 10:30 (lead
  decision, October 26).
- Dated `countdownTo` timers retain their configured date across midnight.
  Earlier `countdownTo` records with no date and legacy `elapsedFrom` records
  retain the start-day anchor, including while paused. The editor adds an
  explicit date when the operator edits an undated countdown-to. Pausing holds
  the shown value; resuming a date/time target reads the current wall clock
  against that target.
- Values under an hour show as "minutes:seconds", and longer values as
  "hours:minutes:seconds" (proposal).
- 타이머 keep running regardless of clears. They show in 소품 text and in the
  stage layout's 타이머 element.
- Adding a timer from 퀵 실행 creates a new fixed-duration countdown after
  asking for minutes and seconds. Its initial name is 타이머 1, 타이머 2, and so
  on, using an unused number. The row's 이름 바꾸기 changes that timer's name
  too, so the 무대 tab and stage layout picker show the renamed timer. Those
  pickers continue selecting the existing timer; they do not create one.
- The quick row is a start/reset control for its timer's kind. A stopped
  duration countdown starts at its duration; a date/time countdown starts toward
  its target; an elapsed timer starts at its start value. A paused timer
  resumes. Clicking a running timer resets it to its configured stopped value.
  The quick row does not pause. The separate timer-tab pause and 처음으로
  controls above remain available (user decision from the October 26 check).
- No board shows where to add or edit a 타이머 (open question). Version 1 has a
  plus button in the tab and a right-click menu on each row (rename, change kind
  and time, delete) (proposal).
- Removing a timer definition releases its running or paused state immediately
  and frees its live-timer slot. The stage picker clears a removed selection;
  other timer runs remain unchanged.
- Deleting a definition also removes known quick timer rows linked to that ID in
  the same edit. Unrelated rows, unknown fields and prop text are preserved.
  Prop tokens for a missing timer render empty, as before. The edit requires
  writable timer settings and, when linked rows must change, writable quick
  settings. A refused edit removes nothing.
- Renaming in the timer tab updates that timer and the names of its linked quick
  rows together. It preserves the ID, configuration, current run and stage/prop
  references. A standalone timer can be renamed without a quick row.
- The timer editor offers countdown duration, countdown date/time, elapsed start
  duration and clock. Countdown editors include 0 지나면. Invalid dates, times
  or durations use an error ring and tooltip and block saving.

Source for Overrun and elapsed start-value behavior:
[Setting up Timers in ProPresenter 7](https://support.renewedvision.com/hc/en-us/articles/360050782494-Setting-up-Timers-in-ProPresenter-7).
Explicit calendar-date selection is the October 27 user decision. See qa-12 rows
T03, T07 and T09.

### 메시지

- The template list: icon, name, and the sentence with its blanks shown as
  chips. Choosing a template shows one field per blank below it (the board shows
  "차량 번호" with "12가 3456").
- 보낼 화면 (send to): chips for 모든 화면 (all screens), 본 화면, 무대, and
  방송 자막, each a toggle. Turning on 모든 화면 turns the others off, and
  turning on any other turns 모든 화면 off (proposal).
- 표시 시간 (display time): 계속 (until cleared), 30초, 1분, 2분.
- Choosing a template sets the chips and the display time from the template's
  defaults (`targets`, `duration`, 02). Changes in the tab apply to that send
  only and don't change the template (proposal).
- Both defaults are optional in the file. A template without `targets` starts
  with 모든 화면 on, and one without `duration` starts with 계속, the same as
  `null` (proposal). A 메시지 sent from such a template uses those values, so a
  valid template always gives the same controls and the same send command.
- 모든 화면 sends to every screen at the moment of sending (proposal).
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

- Top: the 공지 set select (for example 주일 광고), the image count ("슬라이드
  6개"), the interval ("8초"), 반복 (repeat), and 일시 정지 (pause) or 재생
  (play).
- Middle: the grid of 공지 images. The image that is showing has a red ring.
- Bottom: 보낼 화면 chips (본 화면, 무대, 방송 자막).
- Clicking an image shows it at once on the 공지 layer of the target screens,
  and then advances to the next image at each interval. After the last image,
  the set starts over if 반복 is on, and otherwise stays on the last image
  (proposal).
- 일시 정지 stops advancing and keeps the current image.
- Changing the target screens while a 공지 runs applies at once (proposal).
- The interval, 반복, and the target screens are part of the 공지 set
  (`notices.json`, 02). Changing them in the tab saves them to the set and
  applies them to a running 공지 at once (proposal).
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
- A timer row shows its current value in place, using the same formatter and
  kind rules as the timer tab. A running non-clock row keeps the red bar. A
  finished 멈춤 countdown holds zero with the bar off until started or reset.
- Older quick rows keep their timer kind when separated into independent
  definitions. They are not converted to fixed-duration countdowns:
  - `countdownTo` shows time to its configured target. A legacy undated target
    uses the run's start day, or today before starting. A stopped row draws its
    value once; clicking starts it and clicking while running resets it. Reset
    keeps an explicit date and returns an undated target to today's reference.
    Its 0 지나면 choice applies while running.
  - `elapsedFrom` shows signed time since its configured local `HH:mm`, using
    the run's start day, or today before starting. A stopped row draws once;
    clicking starts it, and clicking while running resets to today's reference.
    This remains 시각 경과, distinct from duration-based 경과.
  - `elapsed` shows its configured start value while stopped, counts up when
    started and returns to that value on another click while running.
  - `clock` always shows the current `HH:mm:ss`. Clicking has no effect and
    never shows a running bar. It retains its ID and stage/prop references.
- For each non-clock kind, clicking a paused quick row resumes it without
  changing its held duration or target anchor. The timer tab's 처음으로 control
  remains available to reset a paused or finished timer.

### Clicking an item

Clicking a row runs it at once. A toggle item keeps a red bar at the left of its
row while it's on. Clicking it again turns it off.

| Kind          | Example in the board       | Clicking it                                                                                                                                                                | Toggle                                |
| ------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Bible passage | 요한복음 3장 16절          | Opens the passage in the Bible panel and outputs its first 슬라이드 (proposal).                                                                                            | No                                    |
| Song          | 주 하나님 지으신 모든 세계 | Opens the song in the 슬라이드 panel with the default 구성 and outputs its first 슬라이드 (proposal). Doesn't add it to the 예배 순서 or change the background (proposal). | No                                    |
| Black screen  | 검은 화면                  | Turns on or off a built-in 소품 that covers every audience screen with black (proposal).                                                                                   | Yes                                   |
| 소품          | 로고 화면 (logo screen)    | Turns that 소품 on or off.                                                                                                                                                 | Yes                                   |
| 타이머        | 타이머 1                   | Starts or resumes its own timer according to its kind. Clicking a running timer resets it; a clock click has no effect (see the kind rules above).                         | Yes, while running; never for a clock |
| 매크로        |                            | Runs that 매크로 (proposal).                                                                                                                                               | No                                    |

- The board's 축도 (benediction, 슬라이드 icon) is read as a short song made in
  the 라이브러리 (proposal, open question).
- The black screen sits on the 소품 layer, so the 소품 clear (F4) also takes it
  down (proposal).

### Adding and editing (proposal)

No board shows how to add a 퀵 실행 item (open question). Version 1 works like
this:

- 퀵 실행 추가 opens a menu: add the item in the 슬라이드 panel (a song or Bible
  passage), 소품 (submenu), 타이머, 매크로 (submenu), 검은 화면.
- 타이머 opens a duration dialog with minutes and seconds. Both are whole
  numbers, minutes are nonnegative, seconds run from 0 to 59, and the total must
  be positive. An invalid value has the design system error ring and a reason in
  its tooltip; it blocks adding. Cancel creates nothing.
- Confirming creates a new `countdown` timer and its quick row together; it
  never adds a second control for an existing timer. Another addition always
  creates another timer, even if its duration matches. It uses the name 타이머
  1, 타이머 2, and so on; 이름 바꾸기 renames the timer and its row together.
  These replace the earlier existing-timer submenu and pause toggle (user
  decision from the October 26 check).
- The operator can also drag song and Bible passage rows from the 예배 순서 into
  퀵 실행.
- Dragging rows reorders them. The right-click menu has rename and delete.
- Version 1 has no 퀵 실행 shortcuts (see 09).

Source: `ShowH`, `Compact`, `Problems`, `Bible` (퀵 실행 list), `ListRow` README
(퀵 실행 on state), `Main` decisions "퀵 실행은 목록" and "단축키", product log
(퀵 실행 shortcuts deferred).

## Shared bottom 미디어 bin

- One 미디어 (Media) toggle shows or hides the same bottom bin in 진행 and 준비.
  It does not switch workspaces or replace the song/item editor. The workspace
  columns remain above it. The bin has its own left playlist column, center
  media content, and right preview/properties area (05).
- Use the authoritative
  [Layout height allocation](../../design/system/project/components/Layout/README.md#shared-media-bin-height):
  reserve 440 CSS px for the upper workspace and one `panel-gap` between rows.
  For work-area height `H >= 612px` (with the current 4px gap), the bin gets
  `min(300px, 40% of H, H - 444px)`, with a 168px minimum. The 300px cap is
  twice `size-media-strip-tile`. Below that threshold, keep 440px above and
  168px below and scroll the work area vertically, with the bars outside it. The
  editor, preview and 진행 도구 remain reachable. At the minimum 1280x720 window
  with 100% app UI zoom, a saved-open bin gets 178px and the upper workspace
  440px; do not restore it closed or shrink panels below their minimums. Long
  bin content scrolls inside panel bodies, with fixed headers and footers, and
  never increases the bin height.
- The toggle is a panel visibility control, visually distinct from the 진행 and
  준비 workspace switch. ui owns its styling and design-system tokens.
- A saved open or closed `mediaStrip` choice applies in both workspaces and wins
  over size defaults, including a saved open choice in a narrow window. With no
  saved choice, the bin starts open in regular and wide windows at least 900 DIP
  high, and closed otherwise.
  - Measure height in DIP by multiplying the CSS viewport height by the current
    UI zoom factor: 750 CSS px at 120% zoom is 900 DIP. Toggling saves the
    choice; resizing or changing UI zoom does not overwrite it.
- Switching between 진행 and 준비 keeps the bin's visibility, chosen playlist
  and selected media. Hiding and reopening it in the same window retains the
  chosen playlist and selection. Its player pauses and releases media while
  hidden. None of these navigation actions changes live output.
- Playlists, importing, file drops, preview, selected-item properties and file
  information live inside the bin in both workspaces. The full structure and
  copy/relink rules are in 05, "Shared bottom 미디어 bin". There is one 가져오기
  action; it opens immediately in the last import folder (02).
- Keep the existing workspace activation rules during this layout move: clicking
  a playable tile in 진행 selects it, updates its bin properties and outputs
  that media as the background at once (03). In 준비, one click only selects;
  double-clicking outputs (05). Selection and LIVE marks are distinct. A copying
  tile cannot output; a missing tile offers 다시 연결 (08).

Source: the user's October 26 decision, "Media lives in one bottom 미디어 bin"
in
[decisions](../decisions.md#2026-10-26-decisions-from-the-m3-check3-user-check).
Renewed Vision's
[interface documentation](https://support.renewedvision.com/hc/en-us/articles/360041345954-Understanding-The-ProPresenter-User-Interface)
(S21 in 10, checked October 26) documents the toolbar Media toggle, bottom Media
Bin and its left playlist column. Sharing that bin with 준비 and keeping
properties inside it are this app's user decision; the source does not establish
that ProPresenter's Edit mode has the same behavior.

## Bible passages

### Finding a passage

- The 퀵 실행 Bible input has four fields, 책, 장, 시작절, and optional 끝절
  (user decision, October 26). 책 occupies the first row; the three number
  fields share the next row so they also fit the narrow workspace. The same
  component is used in 준비 항목 추가 성경 구절.
- 책 lists every containment match in canonical order, using Korean full and
  short names by jamo, English names and codes, and IME-off QWERTY input (02).
  Nothing is highlighted initially. Forward Tab completes an exact match or a
  sole candidate to the full name and moves to 장. With several candidates and
  no exact match, Tab stays until an arrow-key selection is made. The selected
  book wins when the operator explicitly points to one. A click or Enter selects
  a suggestion before any output.
- Forward Tab moves through valid 장, 시작절, and 끝절. 장 ranges from 1 to the
  book's chapter count, 시작절 from 1 to the chapter's last verse, and 끝절 from
  시작절 to the last verse. An empty 끝절 means one verse. Changing 시작절
  clears 끝절. Invalid values block Tab and mark the affected fields with the
  error ring and a short Korean tooltip reason, with no adjacent sentence.
  Lookup clamps an oversized 끝절 to the chapter's last verse; Enter also
  normalizes the displayed end. A reversed end blocks lookup. Shift Tab keeps
  backward navigation and IME composition keeps its keys.
- Suggestions open below 책. The 책 group lists all matching books, without the
  former eight-book cap. 최근 lists up to ten stored passages. Choosing a recent
  clears the manual fields and previews its original stored range, including
  whole chapters and cross-chapter ranges. Enter then outputs that selected
  passage. Editing any field starts a new manual reference.
- As soon as the fields form a valid reference, the Bible panel opens in place
  of the 슬라이드 panel in the center column.
- Enter from any field outputs the current valid passage, as 바로 띄우기 does. A
  pending lookup, invalid reference, repeated Enter, or composition Enter cannot
  output. The four fields build a range within one chapter; stored references
  and recent passages retain the full grammar in 02.
- 준비 항목 추가 성경 구절 opens a small 성경 구절 dialog with the same fields.
  Enter inserts the current passage item using the opening's default translation
  and verse-number preference. 추가 performs the same insertion; it is disabled
  without a current valid lookup. 취소 forgets the opening and its pending
  replies. No passage is output from this dialog.

### Bible panel

- Header: the passage ("요한복음 3:16-18") and the 슬라이드 count ("슬라이드
  3개").
- Settings row: the installed translation select (개역한글), 나누기 (split: 한
  슬라이드에 한 절 one verse per 슬라이드, 두 절씩 two verses, 길이에 맞춤 fit
  to length), 참조 (reference: 슬라이드마다 every 슬라이드), 절 번호 (verse
  numbers), and 역본 이름 (translation name).
  - The installed translation and 절 번호 controls change this preview only;
    they do not change the defaults, saved items, or live output. A translation
    lookup retains the range and selected verse when available. If the selected
    verse is omitted, choose the next available verse, or the last one when no
    later verse remains. A failed or superseded lookup keeps the old preview.
  - Fit to length fills each 슬라이드 with verses up to the 환경설정 option 한
    슬라이드 최대 줄 수 (maximum lines per 슬라이드) (proposal).
  - 참조 decides where the reference (3:16) appears. The board shows only
    "슬라이드마다". The reference text draws at the 환경설정 option 출처 위치
    (reference position, bottom right) (proposal).
  - Turning on 역본 이름 appends the translation name after the reference
    (proposal).
- Bible 슬라이드 grid: each 슬라이드 shows its verse numbers and text, and the
  band shows the number and the reference ("3:16"). Clicking a tile outputs that
  슬라이드 at once. The next and previous keys work within the passage.
- 화면별 보기 (per-screen view, "1 / 3"): shows how the selected 슬라이드 looks
  on the 본 화면 and the 방송 자막, with the screen name, target, and style
  name.
- Buttons: 앞 절 추가 (add the previous verse), 뒤 절 추가 (add the next verse),
  예배 순서에 넣기 (add to the 예배 순서), and 바로 띄우기 (show now, outputs
  the selected 슬라이드; the primary button).
- 앞 절 추가 and 뒤 절 추가 extend the preview's range by one verse, using its
  translation's chapter counts. They can cross chapters within the book,
  following
  [ProPresenter's adjacent-verse controls](https://support.renewedvision.com/hc/en-us/articles/360041347594-Using-Bibles-in-ProPresenter).
  The selected verse and verse-number option stay; extension alone does not
  output, edit the 예배 순서, or add recent history. A book boundary stops the
  extension. A failed or superseded lookup leaves the preview unchanged. Enter
  from the unchanged reference fields outputs the expanded preview; editing a
  field starts a new lookup from those fields.
- 예배 순서에 넣기 inserts a Bible passage item into the selected section or the
  section containing the selected 예배 순서 item, following 항목 추가's
  insertion rule (05). An empty section stays as the passage's section row.
- Enter in the passage field does the same as 바로 띄우기. If the suggestion
  list points to a different row, Enter first chooses that suggestion (proposal:
  reconciles the `TextField` document, which says Enter shows the passage, with
  the board, which says the operator checks the preview before showing it; open
  question).
- If the reference isn't valid, the field shows an error ring with the reason in
  a tooltip, for example "알아볼 수 없는 구절입니다" (passage not recognized)
  (proposal).
- Bible 슬라이드 go to the lyrics layer and draw with the current Look's lyric
  style (proposal). Whether the board's 본 화면 style name "말씀" (sermon) is a
  style only for Bible passages is an open question.
- A passage that the operator outputs or adds to the 예배 순서 goes to the front
  of the recent list (up to 10, proposal). A passage that is already in the list
  (same reference and translation) moves to the front instead of appearing
  twice, and the oldest one drops off past 10 (proposal).
- The 책 suggestions list all matching books in canonical order (창세기 first),
  bounded by the 66 books.
- Choosing a row in the 예배 순서 closes the Bible panel and returns to the
  슬라이드 panel (proposal).

Source: `Bible`, `TextField` README (퀵 실행 field), `Prefs` 성경 (Bible),
`Main` board guide (성경 구절 띄우기), product log (copible, offline).

## Toolbar search (proposal)

No board shows where search results appear (open question). Version 1 works like
this:

- In 진행, typing in the toolbar search field opens a list of 라이브러리 songs
  below the field, matched by title, lyrics, or initial consonants with the
  rules of 05 "Search". The list shows at most 20 songs in alphabetical title
  order, including lyric matches (October 27 user decision, P03). A lyrics match
  shows its first matching line under the title (proposal).
- Choosing a song opens it in the 슬라이드 panel with the default 구성. It isn't
  added to the 예배 순서. Clicking its 슬라이드 outputs them.
- In 준비, choosing a result selects the song in the 라이브러리 and opens the
  song editor (see 05).

## Narrow windows (width 1280 to 1599)

The features are the same. Only the layout differs.

| Element             | Narrow window                                                                                                                                                                                                            | Source                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| Toolbar             | Height 40, names to the right of icons, 미디어 as an icon only, search field 280                                                                                                                                         | `Compact`, `Toolbar` README      |
| Columns             | Left 220, right 360                                                                                                                                                                                                      | `Layout` README                  |
| Media strip         | Starts closed with no saved choice; a saved open choice wins                                                                                                                                                             | `Compact`                        |
| 슬라이드 grid       | 3 columns by default                                                                                                                                                                                                     | `Compact`                        |
| Clear row           | Icons only (names in tooltips), 모두 is 1.4 times as wide                                                                                                                                                                | `Compact`, `ClearButton` README  |
| 진행 도구 tabs      | 표시 중, 무대, and 더 보기 (more). 더 보기 opens a menu with 오디오, 타이머, 메시지, 공지, 소품, and 매크로. Choosing one shows that tab's content, with 더 보기 shown as the active tab (proposal).                     | `Compact`, `Layout` README       |
| Small previews      | A row with 64 px pictures, name and target on two lines                                                                                                                                                                  | `Compact`, `PreviewFrame` README |
| 퀵 실행 Bible field | Small fields, placeholders 책, 장, 시작절, 끝절                                                                                                                                                                          | `Compact`                        |
| 예배 순서 header    | Adds 사이드바 접기 (collapse sidebar). Clicking it collapses the left column. A button at the edge of the collapsed column expands it again (proposal). The app remembers the collapsed state per size class (proposal). | `Compact`                        |

Source: `Compact`, `Main` board guide (진행 화면 1366×768), design system README
(window sizes and layout), `Layout` README.

## Keyboard summary for 진행

Decided on 2026-10-25. The full command list, where each command works, and how
keys are changed are in 10, "Shortcut system".

| Key                                              | Action                                                          | Basis                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| →, Space, Page Down                              | Next 슬라이드                                                   | Follows ProPresenter (S1; S4 p. 70); Page Down for presentation remotes           |
| ←, Page Up                                       | Previous 슬라이드                                               | Follows ProPresenter (S1); Page Up for presentation remotes                       |
| Ctrl ↓, Ctrl ↑                                   | Select the next or previous item (다음 항목, 이전 항목)         | No ProPresenter source found                                                      |
| Ctrl L                                           | Open the item of the live 슬라이드 (출력 중인 항목 열기)        | Follows ProPresenter (Show Triggered Presentation, S1)                            |
| Alt →, Alt ←                                     | Next or previous background in the shared media bin's playlist  | Follows ProPresenter (Next and Previous Background, S1)                           |
| F1 to F7                                         | Clear all, lyrics, media, 소품, audio, 메시지, 공지             | Follows ProPresenter (S1)                                                         |
| Ctrl Z                                           | 실행 취소 (edit undo for the 예배 순서 or a text field)         | M2 check 1 row 8; never restores cleared output (03, 10)                          |
| Ctrl 1                                           | Audience screen outputs (본 화면 and 방송 자막) on or off       | Follows ProPresenter (Toggle Output Screens, S1; S4 p. 172)                       |
| Ctrl 2                                           | 무대 화면 output on or off                                      | Follows ProPresenter (Toggle Stage Display Screens, S1)                           |
| Alt S, Ctrl M, Ctrl Shift C, Ctrl Shift P, Alt C | The 무대, 메시지, 타이머, and 소품 tabs, and the action palette | Follows ProPresenter (S1)                                                         |
| Ctrl Alt B                                       | The Bible field in 퀵 실행                                      | Follows ProPresenter (Open Bibles Mode, S1)                                       |
| 이름표 jump key (a bare letter or digit)         | That 이름표's 슬라이드                                          | Follows ProPresenter (group hot keys, S4 pp. 58, 176); no default keys            |
| A key set for a Look, 소품, 매크로, or 타이머    | That object's command                                           | No default keys; follows ProPresenter's Key Mappings for 소품 and 매크로 (S2, S3) |
