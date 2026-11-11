# 03. Output

This document defines the output windows, turning screen outputs on and off,
layers and stacking order, outputting 슬라이드 and backgrounds, clearing and
undo, the 방송 화면, the 무대 화면, handling a lost monitor, and recording the
output state. The main process owns the output state (see 01). Every behavior in
this document is a command that the main process handles.

Terms: 출력 (output), 지우기 (clear), 슬라이드 (slide), 예배 순서 (service
order), 이름표 (label), 청중 화면 (main screen), 무대 화면 (stage screen), 방송
화면 (broadcast captions), 그래픽 (prop), 메시지 (message), 타이머 (timer),
매크로 (macro), 진행 도구 (show tools), 퀵 실행 (quick launch), 진행 (Show
workspace), 준비 (Prep workspace), 화면 설정 (Screen settings workspace).

## Screens and output windows

Each screen has one output window. Output windows don't use design system
components. They draw at the screen's own resolution.

| Method         | Name in 화면 설정 | Window                                                                                                                                                               | Version 1 | Source                            |
| -------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------- |
| Full screen    | 전체 화면         | A borderless window that covers the assigned monitor.                                                                                                                | Yes       | `Screens`                         |
| Window         | 창                | A normal, resizable window on the control monitor. Used to check output without a monitor, and when a monitor is lost.                                               | Yes       | `Screens`, `Problems`             |
| Capture window | 캡처용 창         | A window at a set resolution (default 1920 x 1080) that isn't tied to a monitor. The background is chroma key green (`chroma`). OBS picks it up with window capture. | Yes       | `Screens`, product log 2026-10-23 |
| NDI            | NDI               | No window. Sends over the network with an alpha channel.                                                                                                             | M4        | `ScreensNDI`                      |

Rules for output windows:

- Never show dialogs, tooltips, notifications, or menus in an output window. If
  an error happens in an output window, log it and keep the last good picture.
- Showing an output or changing its settings never takes focus. The mouse
  pointer stays visible over every output, including when 항상 위 is on. Output
  windows accept mouse clicks, which bring them to the front (user decision,
  m3-check3, including M3-C3-9).
- A clicked output forwards its keys to the control window's existing handlers,
  so clear keys and slide navigation keep working without bringing control to
  the front or changing its focus.
- 항상 위 defaults off for every screen method. On reveal, raise the output once
  without taking focus. Other windows may cover it afterwards; clicking the
  output raises it again. No background keeper raises an output while 항상 위 is
  off (user decision, m3-check3).
- Changing 항상 위 changes only that output window's stacking. It never
  re-enters full screen, moves or resizes the picture, raises the control window
  or changes its focus (user decision, M3-C3-9).
- If 항상 위 (always on top) is on, keep the full screen window above other
  windows. While any output is on, prevent display sleep and system sleep
  (fixed; see 10).
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
  right and y px down (negative values move it left and up). What moves past the
  screen edge isn't drawn, and the empty area is the screen's empty color
  (proposal).
  - 위치 미세 조정 counts pixels of a 1920 x 1080 reference picture, scaled to
    whatever draws the picture, the same rule as lyric sizes (lead decision,
    October 26). One unit holds for the whole picture, a preview or a lost
    monitor's window is an exact scaled copy, a resolution change keeps the same
    share of the picture, and no pixel size has to be reported. On a 4K output
    one step moves two real pixels.
  - Previews of a screen draw its picture with the correction, as the screen
    shows it (proposal).

Source: `Screens`, `ScreensNDI`, design system README (output windows draw at
native resolution), `docs/TECH.md` (output windows show no dialogs).

## Turning screen outputs on and off

The 청중 화면, 무대, and 방송 화면 buttons at the right of the toolbar turn each
screen's output on and off. There is no confirmation.

| State           | Meaning                                                                                                      | Toolbar button           | Tooltip                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------ | ---------------------------------------------------------------------------- |
| On              | The output window shows and draws content.                                                                   | Red dot                  | "청중 화면 출력 끄기 (모니터 2)" (turn off main screen output, monitor 2)    |
| Off             | The output window is hidden.                                                                                 | No dot, dim label        | "청중 화면 출력 켜기 (모니터 2)" (turn on main screen output)                |
| Monitor missing | The output is on, but the app can't find the monitor, so it shows in a window instead (see "Lost monitors"). | Amber dot and amber icon | "청중 화면: 모니터 2를 찾을 수 없습니다" (main screen: can't find monitor 2) |

- The text in parentheses is the output target name from 화면 설정, for example
  모니터 2 (monitor 2), 캡처용 창, or NDI.
- A screen added in 화면 설정 follows its group: it starts on when the group
  button is on and off when it is off. A screen without its own layout in a 테마
  shows what the first screen of its kind shows (12).
- Clicking a button in the monitor missing state turns the output off.
- Turning an output off keeps the output state (the live 슬라이드, background,
  그래픽, and so on). Turning it back on shows that content at once. While the
  output is off, the preview keeps showing the same picture.
- Prepare the current live picture at the off output's size when its content
  changes. Load a live video paused and decode its first frame, without audio or
  a loop spare. Once that frame is ready, stop readiness sampling, animation and
  clock updates; an off output does not keep decoding or drawing. Replace the
  prepared picture when live content changes and release superseded media. On
  enable, retain the prepared player and seek to the main-owned live media's
  current position before revealing the current frame, without a dissolve. An on
  capture window keeps drawing even when another window covers it.
- At launch, create and load every configured non-NDI output window as soon as
  screen settings arrive, even when all output switches are off. Keep them
  hidden without taking focus or showing on a monitor. The first turn-on uses
  that same window, as later turn-ons do; preloading does not enable an output
  or acquire the display wake lock.
- While a hidden native output waits for its decoded, laid-out frame to paint,
  request a one-pixel page capture to wake the compositor without showing the
  window. Keep only one request in flight and discard the image. Stop requesting
  once the renderer confirms its painted frame; do not capture visible or
  offscreen test windows. A timer may request painting when animation frames
  stall, but a timer or capture alone cannot declare the output ready. A
  temporarily unavailable hidden compositor retries without an error-level log.
  On Windows, prepare native fullscreen while hidden before accepting the
  painted frame, so the first reveal does not introduce a fullscreen resize.
- Size hidden outputs before they are needed. Reveal a complete current frame
  without a dissolve. An output requested on must never remain hidden
  indefinitely: if preparation has not completed within 1.5 seconds, reveal what
  is drawn and log the fallback once for that window (lead rule from the
  m3-check3 review, October 27). Missing monitor information uses the configured
  disconnect fallback rather than blocking preparation forever. A deadline
  reveal does not acknowledge startup preparation. Keep reporting readiness
  until main accepts the first complete current frame.
- Once a frame is ready at its current size, stop per-frame readiness checks.
  Static lyrics do not update DOM or styles. Clock and timer ticks update only
  elements whose displayed value changed, without rewriting identical
  attributes.
- Off means the output window is hidden (proposal: ProPresenter turns audience
  and stage screens off from the Preview window, S4 p. 24, and doesn't say what
  an off screen shows). The capture window is hidden too.
- Screens have three roles: 청중 화면 (audience), 방송 화면 (broadcast), and
  무대 화면 (stage). Each toolbar button, each 출력 menu row, and each shortcut
  command turns on and off only the screens of its own role. Ctrl 1 turns the
  청중 화면 outputs on and off together, Ctrl 2 turns the 무대 화면 outputs on
  and off (decided; follows ProPresenter's Toggle Output Screens and Toggle
  Stage Display Screens, S1; S4 p. 172 for Ctrl 1), and 방송 화면 has its own
  command with no default key. If some outputs of a role are on and some off,
  the shortcut turns them all on (proposal). Turning on 청중 화면 leaves 방송
  화면 as it is.
- Don't save whether outputs are on. At launch, if the 환경설정 option 켤 때
  화면 출력 (output on launch, default off) is on, turn every screen output on.
  Otherwise start with all outputs off. After a crash, the answer to the output
  state recovery dialog comes first (see 08).

Source: `ToolbarButton` README, `PreviewFrame` README (output off), `Main`
decision "화면 출력 버튼", `Prefs` (켤 때 화면 출력), `Shortcuts` (출력 켜기
Ctrl 1, 무대 출력 켜기 Ctrl 2), `Recovery`.

## Layers and stacking order

### Slides items

A 빈 슬라이드 or 광고 item sends its selected slide through the same live slide
path as a song. Text fills 현재 가사 and the following text slide fills 다음
가사. An 광고 text slide's name fills 슬라이드 이름 on every screen. Picture
slides have no text or name: their photo fills the 미디어 element, using its
frame and 맞춤. Returning to text restores the item's 배경, or clears the
previous slide picture when the item has no 배경. The picture and slide content
change together in one live transaction.

가사 지우기 (F2) leaves a slide picture in 미디어. Sending a text slide later
removes that picture even while the lyrics layer is empty. A background chosen
after the picture stays, including when it uses the same image file.

Thumbnails share the theme text sources and theme picture renderer used by
previews, including the picture's fit and the saved element order.

The live 테마 lays out every screen (12). A screen draws, from the bottom up:

1. The elements of its 테마, from the bottom of the element list to the top (12,
   "Drawing a screen"). 배경, 미디어, 현재 가사, and the other elements are
   placed by the 테마, so their order is the element list order.
2. 그래픽, then 메시지, above the elements, each only on the screens it was sent
   to (see "Where 메시지, 그래픽, and stage messages go"). A 테마 can't hide
   them.

- With nothing live and no 대기 화면 element, the screen shows its 빈 화면 색:
  black (`output-black`) by default, and chroma key green for the 방송 화면
  capture window (12, "Empty screens").
- Audio is a layer without a picture. It exists only as a unit for clearing.
- Only while no 테마 composition exists (before `themes.json` is read), the
  output draws the legacy layers: background media, lyrics in the 기본 text
  style, and the stage message. Once a 테마 composition exists, the legacy
  content layers draw nothing.

Source: `Outputs`, `ClearButton` README, design system README (output
colors), 12.

## Outputting a 슬라이드

### When the operator clicks a 슬라이드

1. The 슬라이드 becomes the live 슬라이드. There is always one live 슬라이드 or
   none.
2. If the 슬라이드 comes from a different 예배 순서 item, that item starts. If
   it has a start 매크로, the 매크로 runs first, and the 슬라이드 then draws
   over the result, for example a clear (proposal: this order makes the 슬라이드
   go out after the 매크로). The item's 테마 applies to every screen in the same
   batch (12, "Which 테마 applies"). The control window sends the item start
   (`item.start`) and the 슬라이드 output together as one batch (01), so the
   start 매크로's result, the 테마, and the 슬라이드 reach the screens in one
   change (proposal).
3. For a song item, the app sets the background (see "Song item background
   rules").
4. The 슬라이드 draws in the 현재 가사 element of every screen whose 테마 has
   one. If the lyrics layer was cleared, it shows again.

- Clicking the live 슬라이드 again doesn't redraw it (proposal).
- A 슬라이드 output from outside the 예배 순서 (퀵 실행, Bible passage, toolbar
  search) doesn't start a 예배 순서 item. The LIVE badge in the 예배 순서
  disappears (proposal).

### Drawing text

- Draw the 슬라이드's lines with the text properties of the 테마's 현재 가사
  element: font, weight, size, color, line spacing, horizontal alignment,
  vertical position, shadow, and outline (12, "Element properties").
- Line breaks are exactly as stored. A line wider than the area wraps at word
  boundaries (proposal).
- Keep the theme font size while the wrapped text fits the element frame. Shrink
  only when its width or height overflows that frame. Never split a lyric slide.
  The same rule applies to thumbnails and previews.
- A blank 슬라이드 (no lines) can be the live 슬라이드. It draws nothing in the
  현재 가사 element (proposal).
- Text sizes are for a 1920 x 1080 screen. Scale them to the screen resolution
  (proposal): every px value of the element (size, outline width, shadow blur
  and distance) is multiplied by the smaller of (screen width / 1920) and
  (screen height / 1080).
- The text area is the element's frame. The lines sit at the top, middle, or
  bottom of the area (세로 위치), each line aligned left, center, or right (가로
  정렬).
- Use the full frame height for text fitting. The stored `maxLines` value
  controls Bible splitting at the configured theme size (04), not the height
  budget for lyrics or other text. The theme editor names it 성경 분할 줄 수.
- Wrapping breaks between words; Hangul words aren't broken inside
  (`word-break: keep-all`, as in the design system's thumbnails). A single word
  wider than the area breaks anywhere (proposal).
- Shrink to fit: draw at the largest whole px size, no larger than the element's
  size, at which the wrapped lines fit both the width and the allowed height.
  The size goes down to 1 px if it must (proposal; output-2 builds it this way).
  So every line fits, and nothing is cut or runs past the frame, except in the
  overflow case: when the lines don't fit even at 1 px, the text draws at 1 px
  and may run past the frame.
- The operator gets no warning for a 슬라이드 that shrinks a lot. The previews
  in 진행 and the song editor's preview in 준비 show the size it really draws at
  (04, 05), so a 슬라이드 that is too long shows there before it goes out
  (proposal).
- The October 28 decision gives the lyric outline a width and color, and the
  shadow a blur, distance, angle, opacity, and color. These are properties of
  the text elements of a 테마 (12). Until M3-X2 activates the staged stored
  fields, the existing switches draw the provisional defaults: a 3 px black
  outline and an 8 px blur, 4 px distance down and to the right, 60 % opacity,
  black shadow (user decision, October 28: follow ProPresenter's controls).

### Transitions

Transitions play on output and its live preview in 진행. Every editing preview
(준비, song and slide editors, and the theme editor) redraws immediately,
including text, selection, theme and transition-setting changes. Editing never
replays an effect or sends output commands (05).

- Each incoming slide's own transition wins over the output defaults. Otherwise,
  changing item identity uses `output.transition.between` (dissolve, 0.5 s),
  while navigating within the same item uses `.within` (none). This applies to
  songs, Bible, sermon, blank slides, and announcements on every screen kind.
  Jumping backwards or to another slide of the same item still uses `within`.
- Effects are none, dissolve, push, and wipe. Push moves both old and new pages
  in the chosen direction. Wipe keeps their positions fixed and replaces the old
  page across a hard moving edge. Both have left, right, up, and down
  directions. Times range from 0.1 to 10 seconds, including a manually chosen
  four-second title slide. None keeps its time but does not animate.
- The same compositor timing drives dissolve, push, and wipe. A running effect
  retains its selected duration; settings changes apply at the next slide. A new
  slide interrupts the previous effect, reusing two pages. Clearing, standby,
  and disposal cancel their animations.
- Lyric elements (current and next lyrics, reference, slide name and number,
  current and next labels) follow the slide effect. When a new slide changes its
  item, song or theme background, the background and text share one effect,
  duration and start time after the incoming picture is ready. An unchanged
  background keeps its player and position without restarting or flashing.
  Independent media cues retain the media transition, including a cue that
  changes the theme. A whole-composition transition has no second child effect.
- Clears retain their own instant/fade behavior. Messages and other text
  elements retain their 0.2-second dissolve.

Source: `ShowH` (clicking a 슬라이드 changes all three previews), `Main`
decisions "출력은 누르면 바로" and "구성대로 진행", 12 (text element
properties), `SlideThumbnail` README (line breaks as written), design system
README (states and motion).

## Background media

### Ways to output a background

| Way                                                 | Result                                                                   | Source                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------- |
| Click a 슬라이드 of a song item                     | That item's background (the override, or the song's default background). | `Main` decision "라이브러리와 예배 순서는 따로" |
| Click a tile in the 진행 media strip                | Clear slide text and show that media alone, in one transaction.          | `MediaTile` README                              |
| Double-click a tile in the media view               | Clear slide text and show that media alone, in one transaction.          | `MediaTile` README                              |
| 매크로 action "배경 미디어" (background media)      | Set the background only; keep the current slide text.                    | `Macros`                                        |
| Click the 슬라이드 of a media item in the 예배 순서 | Clear slide text and show that media alone, in one transaction.          | `ShowH` (예배 전 카운트다운)                    |

### Song item background rules

- If the item of the clicked 슬라이드 has a background that differs from the
  current background, switch to it.
- If it's the same media as the current background, don't restart it. Keep
  playing. When songs with the same background follow each other, the background
  never breaks.
- Each item shows its own background. No item background means no background
  media: only the theme's own background color or picture remains. This applies
  to songs, slides, Bible passages, library sources, and Quick execution.
- Publish an item start, its background choice, and the selected slide in one
  transaction. A failed refresh uses that source's cached background choice,
  never an unrelated previous item's media.
- Repeated slides with the same background keep the existing playback time.
- A background-only macro choice remains while navigating inside the current
  song item. It is not inherited by the next item, which uses its own
  background. Selecting no background for a live item removes its background
  immediately.
- A theme change keeps the outgoing picture until incoming text and media can
  draw. Prime the incoming page at zero opacity, dissolve it over the opaque
  outgoing page, and then release the old page. Do not fade new child layers
  from empty underneath this whole-page dissolve. A retained background player
  keeps its decoder and playback position across compositions.

### Playback

- Play a video with its media properties: 끝나면 (at the end: loop or stop),
  구간 (range start and end), 속도 (speed), 맞춤 (fit: fit, fill, or stretch),
  소리 켜기 (sound on), and 음량 (volume).
- Loop seamlessly in the current video element without preloading another copy
  of the same background. Keep two reusable players for background changes;
  retain the outgoing picture until the incoming frame is ready, then release
  the outgoing source after the transition.
- With stop at the end, hold the last frame (proposal).
- Show an image as a still, with its fit setting.
- When several screens show the same background, each screen plays it
  separately, but they start at the same moment (proposal).
- The 테마's 배경 element decides where and how the background media draws. A
  screen with no 배경 element shows no background media (12).
- If the file is missing or can't play, follow "Media file missing" in 08.

Source: product log (lyrics over a looping background video), `Media` (end,
range, speed, fit, sound), `Problems`.

## Clearing and undo

### Clear buttons and shortcuts

The clear row in the right column of 진행, and the shortcuts, clear the screens.
The clear happens without confirmation on every screen. The default is at once.
Each F1 to F6 key and each macro clear action has its own fade choice and
duration (user decision, m3-check3). An absent choice, disabled fade or zero
duration clears at once; an enabled fade uses its configured duration, capped at
30 seconds. Key options belong to `preferences.clearKeys`; macro actions carry
`transition`. Macro clears use their own options and do not inherit key options.

| Shortcut | Button         | What it clears                                                           |
| -------- | -------------- | ------------------------------------------------------------------------ |
| F1       | 모두 (all)     | Every layer below that has something to clear                            |
| F2       | 가사 (lyrics)  | The live 슬라이드 (lyrics layer). After this, there is no live 슬라이드. |
| F3       | 미디어 (media) | Background media and media items (media layer)                           |
| F4       | 그래픽         | Every 그래픽 that is on                                                  |
| F5       | 오디오 (audio) | Audio that is playing, at once by default or with its configured fade    |
| F6       | 메시지         | Every 메시지 that is showing                                             |

- The order and keys follow ProPresenter's current shortcuts: F1 all, F2 lyrics,
  F3 media, F4 props, F5 audio, F6 messages (S1). The 7.5 guide still lists F3
  as Clear Background and F6 as Clear Logo (S4 pp. 25 to 26).
- Clears don't touch: whether outputs are on, the live 테마, 타이머 (they keep
  running), the stage message (proposal: the stage message comes down from the
  진행 도구 무대 tab), and the current item in the 예배 순서.
- F1 to F6 and their buttons toggle: the first press clears the target, and the
  next press restores what that same key cleared. Each key retains one capture;
  F1 restores every layer it actually cleared without replacing other restored
  layers (user decision, m3-check3).
- Any new output content resets all key captures, so the next press clears
  again. Output switches, 테마 changes and transport pause/resume do not send
  new content. Captures are temporary and are not restored after app recovery.
- A fade clears the logical live layer immediately while its outgoing picture or
  audio fades. Restoring or replacing that content cancels its outgoing fade.
  Cleared video holds its current frame; restoring resumes from the captured
  clear position. A slide clear fades stage lyrics and labels, leaving stage
  clocks, timers and messages alone. Fade metadata is temporary and does not
  recover after restarting the app.
- A button is bright when it can clear content or restore its capture. A
  captured key shows its pressed state and the tooltip changes to 복원. It is
  dim and does nothing only when it can do neither. Content that the 테마 has no
  element for still counts as something to clear.
- 모두 has something to clear while any layer has something.
- Don't show a message after a clear.
- F1 to F6 work wherever the focus is: in every workspace, in the 환경설정
  window, with a dialog or a confirmation dialog open, and while a text field
  has focus. The only exception is the key field on the 단축키 page while it
  records (decided; 10, focus precedence).
- Ctrl Z only undoes edits. It never restores cleared output (decided, M2 check
  1 row 8; 10).
- The 지우기 (take down) button on each row of the 진행 도구 표시 중 (Showing)
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
  a clear like ProPresenter was unsupported. The m3-check3 user decision above
  adds per-key toggle restore; re-triggering a slide also shows it again. The
  toggle is a user rule, not a documented ProPresenter behavior.
- The clear row shows a separator and 되돌리기 after 메시지 while a clear can be
  brought back, and hides both when there is nothing to bring back. No
  preference controls it. The command `clear.undo` has no default key; Ctrl Z
  never calls it.
- The button undoes the last clear, including 모두. It shows again what those
  layers held just before the clear:
  - Lyrics: the same 슬라이드 becomes the live 슬라이드 again.
  - Media: the same media plays again from the position at the moment of the
    clear (proposal).
  - 그래픽: the same ones turn on again.
  - 메시지: the same 메시지 shows again with the display time it had left
    (proposal).
  - Audio: the same track plays again from the position at the moment of the
    clear (proposal).
- After an undo, there is nothing left to undo (one level only).
- Taking down a single message or prop from 표시 중 is also a clear. Undo
  restores its captured content and targets. Only that message's remaining
  lifetime resumes; messages that stayed up keep expiring normally. Taking down
  a stage message records its text for undo. Sending new stage text ends that
  stage-message undo, so it never replaces a newer message.
- If new content goes to a cleared layer (a new 슬라이드, a new background, a
  new 메시지), that clear can no longer be undone (proposal: undo must never
  cover something new).
- Undo only undoes clears. It doesn't undo clicking a 슬라이드, turning outputs
  on or off, or changing the 테마.
- Ctrl Z is the edit undo in text fields and editable lists, including 예배 순서
  edits in 진행. It does nothing where there is no edit to undo (10).

Source: M2 check 1 feedback rows 7 and 8, S1 (Edit Undo), S21 (clear controls),
`ClearButton` README and `ShowH` (earlier clear row), `Main` decision "다중
레이어 지우기는 v1에서 뺌", `Dialog` README, `AlertDialog` README. The feedback
supersedes the drafts' Ctrl Z binding and always-visible undo button.

## Where 메시지, 그래픽, and stage messages go

| Content       | Sent to                                                            | Layer                               | Controlled from               |
| ------------- | ------------------------------------------------------------------ | ----------------------------------- | ----------------------------- |
| 메시지        | Chosen screens (모든 화면 all screens, 청중 화면, 무대, 방송 화면) | 메시지                              | 진행 도구 메시지 tab (see 04) |
| 그래픽        | The screens set for each 그래픽                                    | 그래픽                              | 진행 도구 그래픽 tab, 퀵 실행 |
| Stage message | 무대 화면                                                          | The 무대 메시지 element of the 테마 | 진행 도구 무대 tab            |

- A screen shows one 메시지 at a time. Sending a new 메시지 to the same screen
  replaces the previous one (proposal).
- Several 그래픽 can be on at the same time (proposal).
- A 메시지 with a set display time comes down by itself when the time ends.
- The built-in 기본 메시지 style is a band across the top of the screen (user
  decision, November 3): full width, black at 72% behind white text of weight
  600, centered. The text is 5% of the screen height per line, with padding of
  1.6% of the height above and below and 4% of the width at the sides, at most
  two lines and then an ellipsis. All sizes scale with the screen like every
  other output element, and the band fades with the 메시지 layer as before. It
  applies on every kind of screen whose 메시지 스타일 is 기본 (06). The 무대
  메시지 of the 무대 화면 is not a 메시지 and keeps the 테마 element (04). Where
  the screen's background is the chroma key green (a 캡처용 창 screen whose 테마
  background or empty color is `#00B140`), the band is opaque black instead, so
  a keyer leaves a clean band rather than a half-keyed dark green box. A saved
  메시지 style draws as before, as text in its own font, size, and position.

Source: `Overlays`, `ShowH` (target screens in the showing list), product log
(메시지 to specific screens or all screens).

## 방송 화면

- The app doesn't broadcast. It makes only the 방송 화면 screen. OBS takes it
  and lays it over the camera picture.
- The default themes draw their built-in broadcast look over the screen's
  background, including the glass box and section card where appropriate (12).
- NDI omits the screen background and the legacy media-kind caption band; the
  built-in broadcast look retains its box and card. OBS needs a compatible
  version, DistroAV, and the NDI Runtime. Network controls and the display
  layout receiver count remain later work (09).
- NDI hardware acceleration is optional and off by default until the church PC
  confirms shared-texture output has no tearing. When enabled, shared GPU
  textures go to the sender utility; if unavailable, the output uses the bitmap
  path and shows one notice without changing the saved option. A GPU utility
  crash first falls back to the bitmap sender, not the capture window.
- An unavailable NDI Runtime is remembered until the method is toggled or the
  app restarts.

Source: product log (2026-10-23 capture window, 2026-10-24 NDI preferred with
the window as fallback), `Main` decision "방송 화면은 NDI로", `Screens`,
`ScreensNDI`, `Outputs`.

## 무대 화면

The live 테마 lays out the 무대 화면 like the other screens (12). The 시계,
타이머, 무대 메시지, and 메모 elements show there as the 테마 places them. 무대
메시지 and 메모 are offered only on the 무대 화면.

- The control window sends the next 슬라이드 with the live one, from the
  sequence it already walks, and main checks it like the rest of the command
  (lead decision, October 26). If the item deck changes while a 슬라이드 is
  live, the 다음 가사 and 다음 이름표 elements update with the next 슬라이드
  sent.

Source: `Overlays` 무대 tab, 12.

## Lost monitors

### Finding monitors

- Read the monitor list at launch, and again whenever a monitor connects,
  disconnects, or changes resolution or arrangement.
- Number monitors from 1, left to right and top to bottom (proposal: the app
  can't read the Windows display numbers). The monitor that holds the main
  window shows as "컨트롤" (control) in the 화면 설정 display layout.
- At launch and after monitor changes, if no screen has any saved monitor,
  assign the first full screen 청중 화면 to the first monitor other than the
  control window's monitor, and the first full screen 무대 화면 to the next
  monitor when one is available. Save the assignment silently and update 화면
  설정 and the output targets immediately. Preserve window, capture and NDI
  methods. Any saved assignment, even to a disconnected monitor, prevents this
  automatic assignment; never move an operator-assigned screen.
- On Windows, after a successful identity query, first match a unique saved EDID
  manufacturer, product and meaningful serial. A missing or ambiguous serial
  match stays missing, even if a look-alike has its former display ID or
  position. Without a serial, match the saved device path. These identities are
  read asynchronously at launch and after topology changes settle, without
  opening a window or blocking startup.
- If identity is not available yet, unsupported, failed or timed out, use the
  existing display ID and heuristic matching for all saved assignments, even
  those with identity. Log the unknown state once per episode as a warning. Keep
  a matched fullscreen output fullscreen while reading identity, including when
  its ID, rectangle and scale remain unchanged after a topology event; retain
  the verified previous target ahead of a reused saved ID. Refine the assignment
  after a successful query; a confirmed mismatch is then missing. Limit each
  query to five seconds, with no polling or rapid failure retries; a later
  settled topology event can trigger a fresh query.
- Assignments saved without identity retain display ID, previous match, monitor
  name and physical pixel size, then position matching. Compare pixel sizes
  using both the saved and current scale, allowing integer-DIP rounding. Weak
  matches must be unique and never take the control monitor or another output's
  monitor.
- Screen rows and preview captions use the currently matched monitor's number,
  including while output is off or in a control-conflict fallback; use the saved
  number only while its monitor is missing. The status bar gives the control
  conflict reason, for example “모니터 1에 컨트롤 창이 있어 창으로 표시 중”.
- When a monitor's resolution or position changes, fit the full screen output
  window to the new bounds.

### When a monitor disconnects during output

When the monitor of a full screen output that is on disconnects, immediately
disable always on top for the affected output window and place it directly
behind the control window without activating either window. Move the control
window directly above the output window without activation (proposal, pending
the user's confirmation on October 26). This happens on the disconnect event
itself, before the 300 ms monitor-list settle wait. The settle wait only plans
placement; the relocated full screen output stays behind the control window
while monitors settle.

1. If the screen's 연결이 끊기면 (when disconnected) setting is 창으로 바꾸기
   (switch to a window), after the settle wait move the same output into a
   window on the control monitor and keep drawing. Content and playback position
   don't break.
   - Place the fallback directly behind the control window without taking focus
     and with always on top disabled, including when only one monitor remains.
     After placement, the app never raises it automatically or restores this
     window order when the operator switches windows.
   - Size it to 960 x 540 DIP, shrunk to fit when needed, and center it on the
     control monitor's work area.
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

When the same monitor connects again and the output is still on, move the output
window back to full screen on that monitor. If the screen's 항상 위 setting is
on, restore always on top so the output is above the control window; otherwise
keep always on top off. Return the toolbar and status bar to normal, and turn
the warning notification into the information notification "무대 모니터 다시
연결됨" (stage monitor reconnected). It closes after 6 seconds.

If disconnect handling turned the output off (`onDisconnect: off`), reconnection
keeps it off until the operator turns it on. Replace the existing disconnect
warning with “무대 모니터 다시 연결됨” (using the screen's name), with “출력
꺼짐” in the detail, for 6 seconds. Do not show, focus or raise the output
window. An output turned off manually during fallback also stays off; an output
already off before disconnect produces no new notification on reconnection.

- If the output of that screen is off when its monitor disconnects, don't show a
  notification. If the operator then turns the output on, follow steps 1 to 3
  (proposal).
- A monitor that disconnects or connects never affects the other screens'
  outputs.

Source: `Problems`, `Notification` README, `ToolbarButton` README, `StatusBar`
README, `PreviewFrame` README, `Screens` (연결이 끊기면: 창으로 바꾸기), and the
user's fallback-window decision of October 25.

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

- Control-window previews, screen tiles, preparation previews, slide thumbnails,
  theme editor canvases, and song background controls show video as its cached
  media-bin thumbnail, using the element's fit. They never create a video
  element or decode the video. Their theme layout, text, and live position
  indicator still follow the output state.
- Only real outputs play video automatically. The media properties player shows
  the cached thumbnail until the operator presses its play button; only then
  does it load and play the file locally.
- Image media keeps its original file in previews, preserving portrait content
  and transparency. Cached video thumbnails are never substituted for images.
  Theme video countdowns in live previews read main's media progress, without a
  decoder or a separate playback clock.
- While every output is off, hide the operator's video progress row and stop its
  progress publications. Resume with main's current position when an output
  turns on; this does not change the saved live media or its playback clock.
- Output windows aim for 60 fps. While moving, each second they measure their
  actual frame rate and report it to the main process. Static pictures send
  health reports without a measured FPS instead. The status bar shows a rate
  only while it is measured. If the rate stays more than 10% below the target
  for 2 seconds, the status turns to a warning. After 2 seconds back at the
  target, it returns to normal (`StatusBar` README).

An enabled output with a static picture checks its health once a second without
requesting animation frames or inventing a measured FPS. Its FPS is unavailable
and a previous low-FPS warning is cleared. Frame-rate sampling runs while the
output prepares its reveal, plays video, runs a transition or JavaScript fade,
or animates clock/timer text. Discrete clock/timer updates without animation do
not keep the sampler running between updates. Returning to motion starts a new
measurement period, excluding idle time. Motion events wake sampling promptly;
the health check also rechecks motion once a second. Ending motion reports idle
health at once, so repeated short animations still supply signs of life without
waiting for a full FPS measurement period. Missing-monitor status is independent
of these reports. A moving output that stops supplying frames gets no synthetic
heartbeat, preserving the existing silent-renderer recovery.

Source: `PreviewFrame` README, `Prefs` (미리보기 30fps), `StatusBar` README,
`docs/TECH.md` performance.
