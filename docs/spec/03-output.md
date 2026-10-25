# 03. Output

This document defines the output windows, turning screen outputs on and off,
layers and Looks, outputting 슬라이드 and backgrounds, clearing and undo, the
방송 자막, the 무대 화면, handling a lost monitor, and recording the output
state. The main process owns the output state (see 01). Every behavior in this
document is a command that the main process handles.

Terms: 출력 (output), 지우기 (clear), 슬라이드 (slide), 예배 순서 (service
order), 구성 (arrangement), 이름표 (label), 본 화면 (main screen), 무대 화면
(stage screen), 방송 자막 (broadcast captions), 소품 (prop), 공지 (notice),
메시지 (message), 타이머 (timer), 매크로 (macro), 진행 도구 (show tools), 퀵
실행 (quick launch), 진행 (Show workspace), 준비 (Prep workspace), 화면 설정
(Screen settings workspace).

## Screens and output windows

Each screen has one output window. Output windows don't use design system
components. They draw at the screen's own resolution.

| Method         | Name in 화면 설정 | Window                                                                                                                                                               | Version 1      | Source                            |
| -------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------- |
| Full screen    | 전체 화면         | A borderless window that covers the assigned monitor.                                                                                                                | Yes            | `Screens`                         |
| Window         | 창                | A normal, resizable window on the control monitor. Used to check output without a monitor, and when a monitor is lost.                                               | Yes            | `Screens`, `Problems`             |
| Capture window | 캡처용 창         | A window at a set resolution (default 1920 x 1080) that isn't tied to a monitor. The background is chroma key green (`chroma`). OBS picks it up with window capture. | Yes            | `Screens`, product log 2026-10-23 |
| NDI            | NDI               | No window. Sends over the network with an alpha channel.                                                                                                             | Later (see 09) | `ScreensNDI`                      |

Rules for output windows:

- Never show dialogs, tooltips, notifications, or menus in an output window. If
  an error happens in an output window, log it and keep the last good picture.
- A full screen output window never takes focus and hides the mouse cursor
  (proposal). The main window always receives keyboard input.
- If 항상 위 (always on top) is on, keep the full screen window above other
  windows. If 절전 막기 (prevent sleep) is on, prevent display sleep and system
  sleep while that screen's output is on.
- 가장자리 여백 (edge margin, %) shrinks the whole picture toward the center by
  that amount. 위치 미세 조정 (position fine-tuning, x and y in px) moves the
  whole picture by that amount (proposal: these values correct projector
  overscan and offset).
- The capture window must keep drawing when other windows cover it. OBS can't
  capture a minimized window, so the capture window has no minimize button
  (proposal).
- Closing a window-method output window with its close button is the same as
  turning that screen's output off (proposal).
- Changing a screen's method, monitor, or resolution while its output is on
  moves or resizes the window at once and keeps drawing the live content. A
  screen switched to 창 opens a 960 x 540 window centered on the control
  monitor, like the window for a lost monitor (proposal).
- 가장자리 여백 m % scales the picture to (100 − 2m) % of the screen and centers
  it, so m % of the width stays empty on each side and m % of the height at the
  top and bottom. 위치 미세 조정 then moves the scaled picture by x px to the
  right and y px down, in the screen's own pixels (negative values move it left
  and up). What moves past the screen edge isn't drawn, and the empty area is
  the screen's empty color (proposal).

Source: `Screens`, `ScreensNDI`, design system README (output windows draw at
native resolution), `docs/TECH.md` (output windows show no dialogs).

## Turning screen outputs on and off

The 본 화면, 무대, and 방송 자막 buttons at the right of the toolbar turn each
screen's output on and off. There is no confirmation.

| State           | Meaning                                                                                                      | Toolbar button           | Tooltip                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------ | -------------------------------------------------------------------------- |
| On              | The output window shows and draws content.                                                                   | Red dot                  | "본 화면 출력 끄기 (모니터 2)" (turn off main screen output, monitor 2)    |
| Off             | The output window is hidden.                                                                                 | No dot, dim label        | "본 화면 출력 켜기 (모니터 2)" (turn on main screen output)                |
| Monitor missing | The output is on, but the app can't find the monitor, so it shows in a window instead (see "Lost monitors"). | Amber dot and amber icon | "본 화면: 모니터 2를 찾을 수 없습니다" (main screen: can't find monitor 2) |

- The text in parentheses is the output target name from 화면 설정, for example
  모니터 2 (monitor 2), 캡처용 창, or NDI.
- Clicking a button in the monitor missing state turns the output off.
- Turning an output off keeps the output state (the live 슬라이드, background,
  소품, and so on). Turning it back on shows that content at once. While the
  output is off, the preview keeps showing the same picture.
- Off means the output window is hidden (proposal: ProPresenter turns audience
  and stage screens off from the Preview window, S4 p. 24, and doesn't say what
  an off screen shows). The capture window is hidden too.
- Shortcuts: Ctrl 1 turns the audience screen outputs (본 화면 and 방송 자막) on
  and off together, and Ctrl 2 turns the 무대 화면 output on and off (decided;
  follows ProPresenter's Toggle Output Screens and Toggle Stage Display Screens,
  S1; S4 p. 172 for Ctrl 1). If some of those outputs are on and some off, the
  shortcut turns them all on (proposal).
- Don't save whether outputs are on. At launch, if the 환경설정 option 켤 때
  화면 출력 (output on launch, default off) is on, turn every screen output on.
  Otherwise start with all outputs off. After a crash, the answer to the output
  state recovery dialog comes first (see 08).

Source: `ToolbarButton` README, `PreviewFrame` README (output off), `Main`
decision "화면 출력 버튼", `Prefs` (켤 때 화면 출력), `Shortcuts` (출력 켜기
Ctrl 1, 무대 출력 켜기 Ctrl 2), `Recovery`.

## Layers and stacking order

A screen draws the layers below, from the bottom up. With nothing on any layer,
the screen is black (`output-black`). The 방송 자막 capture window is green, as
its Look's background setting says.

| Order (bottom first) | Layer                                         | Audience screens           | 무대 화면                          |
| -------------------- | --------------------------------------------- | -------------------------- | ---------------------------------- |
| 1                    | Media (background media)                      | Yes                        | Yes, when the Look turns it on     |
| 2                    | Lyrics                                        | Drawn with the lyric style | Drawn by the stage layout elements |
| 3                    | 공지                                          | Yes                        | No (proposal)                      |
| 4                    | 소품                                          | Yes                        | No (proposal)                      |
| 5                    | Stage layout clock, 타이머, and stage message | No                         | Yes                                |
| 6                    | 메시지                                        | Yes                        | Yes, when the Look turns it on     |

- The order follows the layer list order of the `Looks` board: background media,
  lyrics, 공지, 소품, 메시지.
- Audio is a layer without a picture. It exists only as a unit for clearing.
- The 무대 화면 card in the `Looks` board has no 공지 or 소품 rows. So the 무대
  화면 never draws 공지 or 소품 (proposal).

Source: `Looks`, `Outputs`, `ClearButton` README, design system README (output
colors).

## Looks

### What a Look decides

A Look is an app-wide setting. For each screen, it decides:

- Whether each layer shows: background media, lyrics, 공지, 소품, 메시지, and
  for the 무대 화면 also the clock and the stage message.
- The lyric style of an audience screen, for example 기본 (default) on the 본
  화면 and 하단 자막 (lower third) on the 방송 자막.
- The stage layout of the 무대 화면, for example 현재와 다음 (current and next).
- Whether the background layer shows a solid color instead of media, for example
  "배경: 초록" (background: green) on the 방송 자막.

A Look never changes what is in the output state. It only decides how each
screen shows that content.

### Changing the Look

- The toolbar's Look button shows the current Look's name. Clicking it opens the
  list of Looks. Choosing one applies it to every screen at once. The current
  Look has a check mark.
- The 매크로 action "Look 바꾸기" (change Look) and user-defined shortcuts also
  change the Look (see 10; there are no defaults). Put a Look change in an
  item's start 매크로 to change the look per service or per item.
- The change happens at once, without a transition (proposal).
- Save the current Look in settings, and start with it on the next launch
  (proposal).

### Visibility rule

Something shows on a screen only if both of these are true (proposal):

- It was sent to that screen. 슬라이드 and backgrounds go to every screen.
  메시지, 공지, and 소품 go only to their chosen screens (see 04).
- The current Look turns that layer on for that screen.

- Hiding by a Look isn't clearing. The content stays in the output state, its
  clear button stays in the "something to clear" state, and changing the Look
  shows it again (proposal).
- Edits to the current Look in 화면 설정 apply to the output at once (our
  design: the Looks pane shows the live Look at the top and saves a preset with
  Save, S4 pp. 37 to 38, but no ProPresenter source says whether edits apply
  live).

Source: `Looks`, `Main` decision "설정은 앱 전체에 하나", `ShowH` (toolbar
"평상시"), `ToolbarButton` README (Look menu), `Shortcuts` (Look group).

## Outputting a 슬라이드

### When the operator clicks a 슬라이드

1. The 슬라이드 becomes the live 슬라이드. There is always one live 슬라이드 or
   none.
2. If the 슬라이드 comes from a different 예배 순서 item, that item starts. If
   it has a start 매크로, the 매크로 runs first, and the 슬라이드 then draws
   over the result, for example a new Look or a clear (proposal: this order
   makes the 슬라이드 go out with the new Look). The control window sends the
   item start (`item.start`) and the 슬라이드 output together as one batch (01),
   so the start 매크로's result and the 슬라이드 reach the screens in one change
   (proposal).
3. For a song item, the app sets the background (see "Song item background
   rules").
4. The 슬라이드 draws on the lyrics layer of every screen. If the lyrics layer
   was cleared, it shows again.

- Clicking the live 슬라이드 again doesn't redraw it (proposal).
- A 슬라이드 output from outside the 예배 순서 (퀵 실행, Bible passage, toolbar
  search) doesn't start a 예배 순서 item. The LIVE badge in the 예배 순서
  disappears (proposal).

### Drawing text

- Draw the 슬라이드's lines with the lyric style: font, weight, size, color,
  line spacing, horizontal alignment, vertical position, margin, shadow, and
  outline.
- Line breaks are exactly as stored. A line wider than the area wraps at word
  boundaries (proposal).
- If the 슬라이드 has more lines than the style's maximum lines, or the text
  overflows the area, shrink the font until all lines fit (proposal). Never
  split the 슬라이드.
- A blank 슬라이드 (no lines) can be the live 슬라이드. It draws nothing on the
  lyrics layer (proposal).
- Lyric style sizes are for a 1920 x 1080 screen. Scale them to the screen
  resolution (proposal): every px value of the style (size, outline width,
  shadow blur and distance) is multiplied by the smaller of (screen width
  / 1920) and (screen height / 1080).
- The text area is the screen minus the margin: `margin` % of the screen width
  on the left and right, and `margin` % of the screen height at the top and
  bottom (proposal). The lines sit at the top, middle, or bottom of the area
  (`vAlign`), each line aligned left or centered (`align`).
- The area may hold `maxLines` lines at the style's size: the text block may be
  as tall as `maxLines` × size × `lineHeight`, and never taller than the area
  (proposal).
- Wrapping breaks between words; Hangul words aren't broken inside
  (`word-break: keep-all`, as in the design system's thumbnails). A single word
  wider than the area breaks anywhere (proposal).
- Shrink to fit: draw at the largest whole px size, no larger than the style's
  size, at which the wrapped lines fit both the width and the allowed height.
  The size goes down to 1 px if it must (proposal; output-2 builds it this way).
  So every line fits, and nothing is cut or runs past the margins, except in the
  overflow case: when the lines don't fit even at 1 px, the text draws at 1 px
  and may run past the margins.
- The operator gets no warning for a 슬라이드 that shrinks a lot. The previews
  in 진행 and the song editor's preview in 준비 show the size it really draws at
  (04, 05), so a 슬라이드 that is too long shows there before it goes out
  (proposal).
- Until the user decides open decisions entry 26 (outline and shadow detail),
  the switches draw fixed values from 10's defaults: an outline of 3 px, black,
  and a shadow with 8 px blur, 4 px distance down and to the right, 60 %
  opacity, black (proposal).

### Transitions

- The design system says that Looks and settings decide the transitions when a
  슬라이드 or background changes. No board shows where to set them, and the
  media properties 전환 (transition) tab has no content (open question).
- Version 1 defaults (proposal): 슬라이드 dissolve in 0.2 seconds, backgrounds
  dissolve in 0.5 seconds, Look changes and clears happen at once.

Source: `ShowH` (clicking a 슬라이드 changes all three previews), `Main`
decisions "출력은 누르면 바로" and "구성대로 진행", `Looks` (lyric style
fields), `SlideThumbnail` README (line breaks as written), design system README
(states and motion).

## Background media

### Ways to output a background

| Way                                                 | Result                                                                   | Source                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------- |
| Click a 슬라이드 of a song item                     | That item's background (the override, or the song's default background). | `Main` decision "라이브러리와 예배 순서는 따로" |
| Click a tile in the 진행 media strip                | That media becomes the background at once.                               | `MediaTile` README                              |
| Double-click a tile in the media view               | That media becomes the background at once.                               | `MediaTile` README                              |
| 매크로 action "배경 미디어" (background media)      | The set media becomes the background.                                    | `Macros`                                        |
| Click the 슬라이드 of a media item in the 예배 순서 | That media goes to the media layer (proposal).                           | `ShowH` (예배 전 카운트다운)                    |

### Song item background rules

- If the item of the clicked 슬라이드 has a background that differs from the
  current background, switch to it.
- If it's the same media as the current background, don't restart it. Keep
  playing. When songs with the same background follow each other, the background
  never breaks.
- If the item has no background, keep the current background (proposal).
- These never change the background: moving between 슬라이드 in the same item,
  and 슬라이드 from 퀵 실행 or a Bible passage (proposal).

### Playback

- Play a video with its media properties: 끝나면 (at the end: loop or stop),
  구간 (range start and end), 속도 (speed), 맞춤 (fit: fit, fill, or stretch),
  소리 켜기 (sound on), and 음량 (volume).
- Loop seamlessly (`docs/TECH.md` media: alternate two video elements).
- With stop at the end, hold the last frame (proposal).
- Show an image as a still, with its fit setting.
- When several screens show the same background, each screen plays it
  separately, but they start at the same moment (proposal).
- A screen whose Look sets a color for the background layer, such as the 방송
  자막, draws that color instead of the background media.
- If the file is missing or can't play, follow "Media file missing" in 08.

Source: product log (lyrics over a looping background video), `Media` (end,
range, speed, fit, sound), `Looks` (방송 자막 background green), `Problems`.

## Clearing and undo

### Clear buttons and shortcuts

The clear row in the right column of 진행, and the shortcuts, clear the screens.
The clear happens at once, with no confirmation, on every screen.

| Shortcut | Button         | What it clears                                                           |
| -------- | -------------- | ------------------------------------------------------------------------ |
| F1       | 모두 (all)     | Every layer below that has something to clear                            |
| F2       | 가사 (lyrics)  | The live 슬라이드 (lyrics layer). After this, there is no live 슬라이드. |
| F3       | 미디어 (media) | Background media and media items (media layer)                           |
| F4       | 소품           | Every 소품 that is on                                                    |
| F5       | 오디오 (audio) | Audio that is playing (proposal: fades out within 0.5 seconds)           |
| F6       | 메시지         | Every 메시지 that is showing                                             |
| F7       | 공지           | The 공지, and stops its rotation                                         |

- The order and keys follow ProPresenter's current shortcuts: F1 all, F2 lyrics,
  F3 media, F4 props, F5 audio, F6 messages, F7 announcements (S1). The 7.5
  guide still lists F3 as Clear Background and F6 as Clear Logo (S4 pp. 25 to
  26).
- Clears don't touch: whether outputs are on, the current Look, 타이머 (they
  keep running), stage layouts, the stage message (proposal: the stage message
  comes down from the 진행 도구 무대 tab), and the current item in the 예배
  순서.
- A button is bright when its layer has something to clear and dim when it has
  nothing. A dim button, or its shortcut, does nothing. Content hidden by a Look
  still counts as something to clear.
- 모두 has something to clear while any layer has something.
- Don't show a message after a clear.
- F1 to F7 work wherever the focus is: in every workspace, in the 환경설정
  window, with a dialog or a confirmation dialog open, and while a text field
  has focus. The only exception is the key field on the 단축키 page while it
  records (decided; 10, focus precedence).
- Ctrl Z only undoes edits. It never restores cleared output (decided, M2 check
  1 row 8; 10).
- The 내리기 (take down) button on each row of the 진행 도구 표시 중 (Showing)
  tab takes down only that one thing (see 04).

### Clearing several layers at once

Version 1 has no button that clears a chosen set of layers at once
(ProPresenter's Clear Groups, S3 and S7, called "다중 레이어 지우기" in this
project). Build it as a 매크로 with several clear actions. If needed, set that
매크로 as the start 매크로 of a 예배 순서 item. See 07.

### Undo

- 되돌리기 (clear undo) is our optional extension. No checked ProPresenter
  source documents undoing a clear: S1 lists Undo under Edit, and S21 describes
  the clear controls without clear undo. The previous claim that Ctrl Z restores
  a clear like ProPresenter was unsupported. To show cleared lyrics again, the
  operator re-triggers the slide (M2 check 1 row 8).
- 환경설정 > 진행 > 지우기 되돌리기 단추 보이기 controls the button. It is off
  by default (proposal pending user confirmation; M2 check 1 row 7; 10). Turning
  it on adds a separator and 되돌리기 after 공지 in the clear row. When nothing
  can be restored, the button is dim and does nothing. The command `clear.undo`
  has no default key; Ctrl Z never calls it.
- The optional button undoes the last clear, including 모두. It shows again what
  those layers held just before the clear:
  - Lyrics: the same 슬라이드 becomes the live 슬라이드 again.
  - Media: the same media plays again from the position at the moment of the
    clear (proposal).
  - 소품 and 공지: the same ones turn on again. A 공지 resumes rotating from the
    image it showed (proposal).
  - 메시지: the same 메시지 shows again with the display time it had left
    (proposal).
  - Audio: the same track plays again from the position at the moment of the
    clear (proposal).
- After an undo, there is nothing left to undo (one level only).
- If new content goes to a cleared layer (a new 슬라이드, a new background, a
  new 메시지), that clear can no longer be undone (proposal: undo must never
  cover something new).
- Undo only undoes clears. It doesn't undo clicking a 슬라이드, turning outputs
  on or off, or changing the Look.
- Ctrl Z is the edit undo in text fields and editable lists, including 예배 순서
  edits in 진행. It does nothing where there is no edit to undo (10).

Source: M2 check 1 feedback rows 7 and 8, S1 (Edit Undo), S21 (clear controls),
`ClearButton` README and `ShowH` (earlier clear row), `Main` decision "다중
레이어 지우기는 v1에서 뺌", `Dialog` README, `AlertDialog` README. The feedback
supersedes the drafts' Ctrl Z binding and always-visible undo button.

## Where 메시지, 공지, 소품, and stage messages go

| Content       | Sent to                                                          | Layer                                         | Controlled from               |
| ------------- | ---------------------------------------------------------------- | --------------------------------------------- | ----------------------------- |
| 메시지        | Chosen screens (모든 화면 all screens, 본 화면, 무대, 방송 자막) | 메시지                                        | 진행 도구 메시지 tab (see 04) |
| 공지          | Chosen screens (본 화면, 무대, 방송 자막)                        | 공지                                          | 진행 도구 공지 tab            |
| 소품          | The screens set for each 소품                                    | 소품                                          | 진행 도구 소품 tab, 퀵 실행   |
| Stage message | 무대 화면                                                        | The stage message element of the stage layout | 진행 도구 무대 tab            |

- A screen shows one 메시지 at a time. Sending a new 메시지 to the same screen
  replaces the previous one (proposal).
- One 공지 set runs at a time. Starting another set replaces the previous one
  (proposal).
- Several 소품 can be on at the same time (proposal).
- A 메시지 with a set display time comes down by itself when the time ends.

Source: `Overlays`, `ShowH` (target screens in the showing list), product log
(메시지 and 공지 to specific screens or all screens).

## 방송 자막

- The app doesn't broadcast. It makes only the 방송 자막 screen. OBS takes it
  and lays it over the camera picture.
- In version 1, the method is the capture window. It's a window without a
  monitor. It fills its background with chroma key green (`chroma`) and draws
  the lyrics in the lower third style. OBS picks it up with window capture and a
  chroma key.
- The in-app preview of the 방송 자막 also has a green background.
- The default Look card for the 방송 자막 shows only the background (green) and
  the lyrics (하단 자막). It hides 공지, 소품, and 메시지.
- The target method is NDI with an alpha channel, which needs no chroma key. The
  capture window is the fallback for setups without NDI. NDI comes after version
  1 (see 09). The 화면 설정 boards and the other boards already label the 방송
  자막 target "NDI" (open question).

Source: product log (2026-10-23 capture window, 2026-10-24 NDI preferred with
the window as fallback), `Main` decision "방송 자막은 NDI로", `Screens`,
`ScreensNDI`, `Looks`, `Outputs`.

## 무대 화면 and stage layouts

### What the 무대 화면 draws

The 무대 화면 draws the elements of the current stage layout:

| Element (`kind`)                | Draws                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Current lyrics (`currentSlide`) | The lines of the live 슬라이드. Empty after a lyrics clear.                                                    |
| Next lyrics (`nextSlide`)       | The 슬라이드 after the live 슬라이드 in the current item's sequence. Empty after the last 슬라이드 (proposal). |
| Current 이름표 (`currentLabel`) | The live 슬라이드's 이름표 name (the board shows "프리코러스").                                                |
| Next 이름표 (`nextLabel`)       | The next 슬라이드's 이름표 name (the board shows "다음 후렴", next chorus).                                    |
| Clock (`clock`)                 | The current time, for example "11:24" (24-hour, proposal).                                                     |
| 타이머 (`timer`)                | The value of the 타이머 chosen in the 진행 도구 무대 tab (the board shows "예배 경과 00:54", proposal).        |
| Stage message (`stageMessage`)  | The stage message sent from the 무대 tab.                                                                      |

- For a 슬라이드 element, 보여 줄 것 (what to show) decides the content. 글자
  (text) draws the lines. 그림 (image) draws a scaled copy of the picture on the
  본 화면 (proposal). 메모 (memo) draws the current item's memo (proposal, open
  question).
- An element with 크기 자동 맞춤 (auto-fit size) on shrinks its font until the
  text fits its box.
- The Look's 무대 화면 card turns the clock, the stage message, 메시지, and
  background media on and off. Turning lyrics off empties the current lyrics,
  next lyrics, and 이름표 elements (proposal).

### Which stage layout applies (proposal, open question)

Three places choose a stage layout: the Look's 무대 화면 card, the 배치 (layout)
select in the stage layout editor, and the 무대 화면 select in the 진행 도구
무대 tab. Version 1 resolves them like this:

| Place                                                                                              | Effect                                                                            | Saved |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----- |
| The current Look's 무대 화면 card                                                                  | The base layout. When the Look changes, the layout changes to that Look's layout. | Yes   |
| The 무대 화면 배치 select in the stage layout editor                                               | Edits the current Look's 무대 화면 card value.                                    | Yes   |
| The select in the 진행 도구 무대 tab, and the 매크로 action "무대 화면 배치" (stage screen layout) | Changes only the current output, until the next Look change.                      | No    |

Source: `StageEditor`, `Overlays` 무대 tab, `Looks` 무대 화면 card, `Main` board
guide (stage layout editor), `Main` "프로프리젠터와 다른 점" (Looks also turn
stage layers on and off).

## Lost monitors

### Finding monitors

- Read the monitor list at launch, and again whenever a monitor connects,
  disconnects, or changes resolution or arrangement.
- Number monitors from 1, left to right and top to bottom (proposal: the app
  can't read the Windows display numbers). The monitor that holds the main
  window shows as "컨트롤" (control) in the 화면 설정 display layout.
- To find a screen's saved monitor, match the operating system display ID first,
  then the monitor name and resolution, and then the position (proposal).
- When a monitor's resolution or position changes, fit the full screen output
  window to the new bounds.

### When a monitor disconnects during output

When the monitor of a full screen output that is on disconnects, immediately
disable always on top for the affected output window and send it to the back of
the window order, behind every other window, without taking focus. This happens
on the disconnect event itself, before the 300 ms monitor-list settle wait
(`DISPLAY_SETTLE_MS`). The automatic fallback operation must not raise the
control window or any other window. The settle wait only plans placement; the
relocated full screen output stays behind every other window while monitors
settle.

1. If the screen's 연결이 끊기면 (when disconnected) setting is 창으로 바꾸기
   (switch to a window), after the settle wait move the same output into a
   window on the control monitor and keep drawing. Content and playback position
   don't break.
   - Keep the fallback at the back of the window order without taking focus and
     with always on top disabled, including when only one monitor remains.
   - Use `placement.ts`'s `OUTPUT_WINDOW_SIZE` (960 x 540 DIP, shrunk to fit
     when needed), centered on the control monitor's work area.
2. That screen's toolbar button shows the monitor missing state (amber dot and
   icon). The status bar shows "무대 화면 창으로 표시 중" (stage screen showing
   in a window). The screen's frame in the preview gets an amber outline.
3. Show the warning notification "무대 모니터 연결 끊김" (stage monitor
   disconnected). Its detail line reads "모니터 3 → 창으로 표시 중", and its
   actions are 모니터 다시 찾기 (find monitor again) and 창 보기 (show window).
   - 모니터 다시 찾기: read the monitor list again at once, and match the saved
     monitor again.
   - 창 보기: bring the fallback window to the front.

If the screen's 연결이 끊기면 setting is to turn the output off instead, turn
that screen's output off and show the same warning notification (proposal).

When the same monitor connects again, move the output window back to full screen
on that monitor, return the toolbar and status bar to normal, and turn the
warning notification into the information notification "무대 모니터 다시 연결됨"
(stage monitor reconnected). It closes after 6 seconds.

- If the output of that screen is off when its monitor disconnects, don't show a
  notification. If the operator then turns the output on, follow steps 1 to 3
  (proposal).
- A monitor that disconnects or connects never affects the other screens'
  outputs.

Source: `Problems`, `Notification` README, `ToolbarButton` README, `StatusBar`
README, `PreviewFrame` README, `Screens` (연결이 끊기면: 창으로 바꾸기),
[2026-10-25 fallback-window decision](../decisions.md#2026-10-25-a-fallback-output-window-goes-behind-the-control-window).

## When an output window crashes

If an output window's renderer process dies, the main process loads the page
again in the same window and sends it the current output state, so it draws the
same picture again. After 3 crashes in 60 seconds, the window shows the screen's
empty picture and the main process retries after a cool-down. See 08.

## Recording and restoring the output state

- The main process writes the output state to the recovery record each time it
  changes (see 02).
- After a crash, the app opens the last service as it was. The output state
  recovery dialog asks whether to restore the screen outputs, the last 슬라이드,
  and the items that were showing. Until the operator answers, every screen
  stays in standby (off). See 08.

## Previews and frame rate

- The previews in 진행 and 준비 show a scaled copy drawn by the same rendering
  code as the output windows. They draw at the 환경설정 미리보기 (preview) rate,
  30 fps by default, to lighten the load (proposal).
- Output windows aim for 60 fps. Each second, they measure their actual frame
  rate and report it to the main process. The status bar shows the value. If the
  rate stays more than 10% below the target for 2 seconds, the status turns to a
  warning. After 2 seconds back at the target, it returns to normal (`StatusBar`
  README).

Source: `PreviewFrame` README, `Prefs` (미리보기 30fps), `StatusBar` README,
`docs/TECH.md` performance.
