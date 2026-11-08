# 06. Settings

This document covers the 화면 설정 (Screen settings) window (screens, display
layout, test pattern, output method), the 테마 workspace, the 환경설정
(Preferences) window, and shortcuts.

Terms: 출력 (output), 슬라이드 (slide), 이름표 (label), 청중 화면 (main screen),
무대 화면 (stage screen), 방송 화면 (broadcast captions), 진행 도구 (show
tools), 퀵 실행 (quick launch), 그래픽 (prop), 메시지 (message), 타이머 (timer),
라이브러리 (library), 진행 (Show workspace). See 01.

The full shortcut system and a proposal for the 환경설정 pages are in
[10-shortcuts-and-settings.md](10-shortcuts-and-settings.md). Its shortcut part
was decided on 2026-10-25; "Shortcuts" below states the decided rules and points
to 10 for the full command list. Its settings part is still a proposal, so this
document stays the spec for settings. The settings sections that 10 would
replace say so in a note.

## The 화면 설정 window and 테마 workspace

### Slide transition defaults

환경설정 > 출력 > 전환 has two slide rows, matching the approved transition
draft: 곡이 바뀔 때 and 곡 안에서 넘길 때. Each shows four illustrated tiles
(없음, 디졸브, 밀어내기, 닦아내기), four direction arrows, and 시간. Direction
arrows are enabled only for 밀어내기 and 닦아내기. Time stays visible, gray, and
disabled for 없음; otherwise it accepts 0.1 to 10 seconds. Defaults are 디졸브
0.5 seconds between items and 없음 within an item. The rows apply to every item
kind. The existing 배경 row remains unchanged. A slide's saved effect overrides
these defaults. Changes apply to the next transition without restarting one
already running. The old single 슬라이드 setting is replaced without migration.

### Layout and navigation

출력 > 화면 설정… (Ctrl Alt 1) opens the separate 화면 설정 window, or focuses
its existing instance. Closing it leaves the control and output windows running.
It closes with the app and remembers its normal size, position, and maximized
state in the computer-local `app.json`. A saved position on a disconnected
monitor is brought into the current work area.

화면 설정 and 환경설정 share one prepared native window and renderer. Opening
either switches that window to the requested view; it appears only after its
settings, monitor data, and fonts have drawn. The hidden view keeps its controls
prepared but stops keyboard handling, subscriptions, and preview rendering.
Leaving 화면 설정 removes its test pattern and returning starts in 화면 내용.
The screen editor keeps its saved geometry separately from the fixed preferences
dialog. Switching settles pending drafts first; canceling keeps the current
view. Closing saves, hides the window, and returns focus to its opener; a
refused save keeps it open. The same renderer and prepared controls survive
every close, including an immediate reopen. Hidden windows park their display
area empty, hide their content view, stop offscreen painting, and enable
background throttling. An explicit open restores the requested geometry, resumes
editing, disables throttling, and enables painting. After the committed data and
fonts are ready, main maps the native frame transparently and captures its
final-size content before making it opaque and focusing it. The first open uses
the same staging, so a blank native frame is never exposed. Only quitting or
losing the window releases the renderer. Inactive views still suspend their
effects and previews; every close performs its own save handshake.

| Column | 화면 설정 window                                                                      | 테마 workspace (12)                                       |
| ------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Left   | 화면 list, grouped into 청중, 방송, and 무대                                          | 테마 list, then 요소 and 요소 추가 for the current screen |
| Center | 배치 (monitor layout and 별도 창 및 미지정 화면), then 출력 미리보기 with 테스트 패턴 | The canvas of the current screen                          |
| Right  | Selected screen properties                                                            | The three screens, then the 요소 and 화면 tabs            |

- The toolbar workspace tab is 테마. The 테마 editor is specified in 12; "The
  테마 editor canvas" below holds the canvas and color rules it shares.
- The 화면 설정 window holds screens and monitors only. It has no 테마 panels.
- Its screen list uses the standard left-column width so ordinary screen names
  and targets fit together. A monitor box identifies the physical monitor first;
  the control monitor says 컨트롤, and an unused output monitor says 출력
  미지정. The preview caption shows target and signal details without repeating
  the screen name already present in the list and assignment card.
- Changes save at once and apply to output at once. Closing the window takes its
  test pattern off the output.

Source: `Screens`, `Main` board guide (화면 설정), 12.

## Screens

### Screen list

- Three groups, 청중 (audience), 방송 (broadcast), and 무대 (stage). Each row
  shows an icon (청중 화면 and 무대 화면 use monitor icons, 방송 화면 uses the
  capture icon), the name, the target (모니터 2, 캡처용 창), and a health dot.
- 화면 추가 (add screen, plus icon) is in the board. It adds a screen to its
  group; a new install starts with the three screens (see 01).
- Selecting a screen shows its display layout, output preview, and properties.

### Display layout

- One box per monitor, sized by its resolution and placed like the Windows
  display arrangement. Each box shows the monitor number (large and faint), the
  assigned screen, the resolution, and the monitor name.
- The monitor that holds the main window reads "컨트롤" (control), with dim
  text. The monitor of the selected screen is highlighted.
- A separate box shows targets without a monitor, such as the 방송 화면 capture
  window, with its resolution.
- 모니터 번호 표시 (show monitor numbers) shows a large number on each physical
  monitor for 3 seconds, so the operator can match boxes to monitors (proposal
  for the duration). Each number shows in a borderless window above everything,
  output windows included, and never takes focus or the mouse (proposal).
  - Appearance (lead decision, October 26; no board draws it): a 240 x 240
    square at the centre of each monitor, sized in device-independent pixels so
    a monitor at 150% shows it at the same physical size. The square is
    `--output-black` with `--text-on-fill` text. It holds the monitor number,
    the same number as the monitor's display layout box, with tabular figures,
    and the details below it. ui can restyle it through the design system.
  - The details follow ProPresenter's Identify, which overlays screen and output
    names with technical data (S4 p. 33; user decision, October 27, confirmed
    November 2). Each screen whose output is on that monitor gets its own square
    with the screen name, its resolution and refresh rate, and its kind and 방식
    (method). A second square on the same monitor takes the first free corner. A
    monitor with no screen on it shows its own name, resolution, and refresh
    rate.
  - A number never covers a shown 방송 화면 capture window. When the centre
    would, the number moves to the first free corner, 48 device-independent
    pixels in from the edges (top left, top right, bottom left, bottom right);
    with no free corner, that monitor shows no number (proposal).
  - Pressing it again while the numbers show keeps them and starts the 3 seconds
    over. When the monitors or the capture windows moved in between, the numbers
    show again at the new places (proposal).
- The health dot of a screen row is the design system's `ok` dot while the
  output is on and drawing at its frame rate target, an amber dot while it has a
  problem (lost monitor, low frame rate, or the restart limit; 08), and no dot
  while the output is off (proposal).
- The operator assigns a monitor with the 장치 (device) property. Dragging a
  screen onto a monitor box also assigns it (proposal).
- A monitor holds at most one full screen output. Assigning a monitor that
  another screen uses leaves that other screen unassigned, so it shows in a
  window (proposal).
- The control monitor (the monitor that holds the largest part of the main
  window) never shows a full screen output, so an output never covers the
  control window (proposal). This holds on every path:
  - The 장치 select doesn't offer the control monitor, and its display layout
    box doesn't accept a dropped screen.
  - A saved assignment isn't changed. If the main window is on the assigned
    monitor at launch, or the operator moves the main window onto it, that
    output shows in a 960 x 540 window instead, as for a lost monitor, with an
    amber mark and the tooltip "모니터 2에 컨트롤 창이 있어 창으로 표시 중"
    (proposal). When the main window leaves that monitor, the output goes back
    to full screen on it.
- A screen name that is empty or that another screen has can't be saved: the
  field shows the error ring with the reason in a tooltip, and the old name
  comes back when the field loses focus (proposal).

### Output preview

- A segmented control switches between 화면 내용 (screen content) and 테스트
  패턴 (test pattern).
- 화면 내용 shows the selected screen's current output.
- 테스트 패턴 shows color bars and a gray ramp in the preview and on that
  screen's real output (proposal: ProPresenter shows a test pattern on the
  audience screens with Show and removes it with Clear, S4 p. 45; tying it to
  this preview is our design). It returns to the content when the operator
  chooses 화면 내용 or closes the 화면 설정 window.
- The pattern (proposal): the top two thirds hold seven vertical bars at full
  strength, white, yellow, cyan, green, magenta, red, and blue; the bottom third
  holds a gray ramp in 11 steps from black to white; a 2 px white border runs
  around the picture edge, and the screen name and resolution sit in the center
  in white on black. The pattern is drawn with the screen's 가장자리 여백 and
  위치 미세 조정 applied, so the border shows where the corrected picture ends.
  - The output window prints the real pixels it covers as the resolution, for
    example "3840×2160" for a 4K monitor at 150%, and a 창 follows its window's
    size. A preview prints the screen name only, since it can't know the
    output's size (lead decision, October 26).
  - The pattern covers every layer while the layers keep playing underneath, so
    the content is back at once. Clears and 되돌리기 don't touch it, only a
    saved screen can show it, and it never comes back after a restart
    (proposal).
  - So a pattern never stays on a projector during a service, the app also hides
    every pattern when the main window closes, crashes, or reloads, and hides a
    screen's pattern when its output turns off (lead decision, October 26).
- The caption shows the target and monitor name ("모니터 2 EPSON 프로젝터"), and
  the resolution and refresh rate ("1920×1080 60Hz").

### Screen properties

There is no 절전 막기 row (fixed on while any output is on, 10). 항상 위
defaults off for every method and can be enabled in the screen's properties
(user decision, m3-check3).

| Group              | Row                                   | Control                                                                           | Behavior                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 화면 (screen)      | 이름 (name)                           | Text field                                                                        | Screen name. Toolbar labels and tooltips use it.                                                                                                                                                                                                                                                                                  |
| 화면               | 종류 (kind)                           | 청중, 방송, or 무대                                                               | The kind decides which elements the 테마 editor offers on the screen (12). A screen that still has its default name (새 청중 화면) takes the default name of its new kind when the kind changes; a name the user typed stays.                                                                                                     |
| 화면               | 메시지 스타일 (message style)         | Select: 기본 and each saved 메시지 style by name                                  | How a 메시지 sent to this screen is drawn, whatever the 테마 (12; user decision, November 2). Default 기본, the built-in style, a band across the top of the screen (03; user decision, November 3). A 메시지 showing on this screen redraws in the new style at once. Until 메시지 styles can be made, the list holds only 기본. |
| 출력 (output)      | 방식 (method)                         | 전체 화면, 창, 캡처용 창, NDI                                                     | See 03. In version 1, NDI shows as unavailable, with the reason in a tooltip (proposal).                                                                                                                                                                                                                                          |
| 출력               | 장치 (device)                         | Select with the monitor name as a detail ("모니터 2 EPSON 프로젝터")              | The monitor for full screen.                                                                                                                                                                                                                                                                                                      |
| 출력               | 해상도 (resolution)                   | Select                                                                            | For full screen, shows the monitor's resolution and can't change (proposal). For the capture window, offers 1920×1080, 1280×720, and 3840×2160 (proposal).                                                                                                                                                                        |
| 출력               | 주사율 (refresh rate)                 | Read-only value ("60Hz")                                                          |                                                                                                                                                                                                                                                                                                                                   |
| 출력               | 빈 화면 색 (empty color)              | Color swatch and hex field                                                        | Optional `emptyColor` in `screens.json`, as `#RRGGBB`. Defaults to black, or `#00B140` for 캡처용 창. The output and preview use it for empty areas, including picture correction margins. A 테마 screen's 배경색 overrides it for that 테마 (12).                                                                                |
| 안정성 (stability) | 연결이 끊기면 (when disconnected)     | Select: 창으로 바꾸기 (switch to a window), and turning the output off (proposal) | See 03.                                                                                                                                                                                                                                                                                                                           |
| 안정성             | 항상 위 (always on top)               | Checkbox                                                                          | Default off. Changes only this output's stacking, without taking focus or moving any window. See 03, M3-C3-9 (user decision).                                                                                                                                                                                                     |
| 보정 (correction)  | 가장자리 여백 (edge margin)           | Number field (%)                                                                  | See 03.                                                                                                                                                                                                                                                                                                                           |
| 보정               | 위치 미세 조정 (position fine-tuning) | Two number fields (x, y)                                                          | See 03.                                                                                                                                                                                                                                                                                                                           |

### NDI properties (later)

The `ScreensNDI` board shows the NDI version of the properties. Version 1
doesn't build them (see 09), but keeps the data fields (see 02).

| Group              | Row                                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 출력               | 방식: NDI, 소스 이름 (source name, "LOVELIGHT 방송 화면"), 해상도, 프레임 수 (frame rate, 30fps), 알파 채널 (alpha channel), 미리보기 배경 (preview background: 초록 green, 검정 black, 체크 무늬 checkerboard) |
| 네트워크 (network) | 보낼 곳 (network interface, "이더넷 192.168.0.12"), NDI 그룹 (NDI group, "public")                                                                                                                              |

The display layout box of an NDI target shows "보내는 중 수신 1" (sending, 1
receiver), and the status bar shows "방송 화면 NDI 30fps".

### Preview background of the 방송 화면

The in-app preview of the 방송 화면 is green by default. The `ScreensNDI` board
puts the choice of 초록, 검정, and 체크 무늬 in the NDI properties. In version
1, with the capture window, the preview stays green (proposal).

Source: `Screens`, `ScreensNDI`, `PropertyRow` README, `Select` README, product
log version 56.

## The 테마 editor canvas

12 specifies the 테마 workspace: the 테마 list, the 요소 list, the right column
tabs, and the element properties. This section holds the canvas and color rules
that editor uses.

### Canvas editing

- The canvas is 16:9 (1920 x 1080 reference pixels). The selected element has
  eight handles. The bottom bar has 격자에 맞추기 (snap to grid), 비율 고정
  (keep aspect ratio), and the canvas zoom. 화면에 맞춤 has no default key; Ctrl
  0 resets UI zoom (10; M2 check 1 row 11).
- Dragging an element moves it. Dragging a handle resizes it. With 비율 고정 on,
  resizing keeps the aspect ratio. With 격자에 맞추기 on, positions snap to a 20
  px grid (proposal for the grid size).
- Moving aligns element edges and centers with the canvas or other elements;
  resizing aligns the moving edge while preserving its opposite. Smart guides
  acquire within the design token's 6 viewport CSS pixels, independently of
  canvas zoom, and take precedence over the grid on their matched axis. Alt
  temporarily bypasses snapping. At most two one-pixel guide lines appear,
  disappearing immediately when the gesture ends; guides are never saved or
  rendered on output (user decision, "Smart guides in the stage layout editor").
- The arrow keys move the selected element 1 px, and Shift with an arrow key
  moves it 10 px. Delete removes it (proposal).
- 시계 elements also offer 시계 형식: 24시간 (default) or 12시간. The latter
  shows 오전/오후 with the 12-hour time, including noon and midnight. It changes
  only that element's display; the wall clock and other clocks are unaffected.

### Color picker

The text color picker opens with the current color. Its color plane and hue,
saturation and value sliders adjust a preview and hex value. Apply saves the
chosen color; cancel discards the selection. The hex field also accepts
`#RRGGBB`, commits on Enter or blur, and discards invalid input on blur.

Source: `StageEditor`, `IconButton` README (비율 고정, 격자에 맞추기),
`Checkbox` README, 12.

## 환경설정 window

- 환경설정 is a separate window with its own title bar ("환경설정") and a close
  button. It opens from 파일 > 환경설정.
- The left list has the pages 일반, 출력, 저장, 이름표, 미디어, 성경, 단축키,
  and 정보. 10 ("환경설정 window") has every row of every page: its control,
  range, default, stored field, when a change applies, and its tooltip.
- Checkboxes and selects apply at once and save (`Checkbox` README). 02 lists
  the stored fields.
- The 모니터 row on 출력 is a button, 화면 설정…, that opens the 화면 설정
  window; the monitor of each output is set there.

Source: `Prefs`, `PropertyRow` README, `MenuBar` README (secondary window title
bar), `docs/TECH.md` operating rules.

일반 > 화면 확대 is a select with the steps 100% to 200% in 10% steps, kept in
step with the keys (Ctrl +, Ctrl -, Ctrl 0) and with every other control window.
The zoom scales control windows; it never changes output rendering. Main applies
it and stores it in `app.json`.

## Shortcuts

Decided on 2026-10-25 (10, "Shortcut system"). Shortcuts follow ProPresenter
where it has a key or a behavior; where no ProPresenter source was found, 10's
choice applies. This section describes the 단축키 page; 10 has the rules and the
full command list.

### The 단축키 page

- Header: "단축키" and 모두 기본값으로 (reset all to defaults), which asks in a
  confirmation dialog because it can't be undone (10).
- A search field with the placeholder "명령, 키" (command, key), and a filter:
  전체 (all), 바꾼 것 (changed, with a count), 겹침 (conflicts, with an amber
  count).
- An empty list shows 검색 결과 없음 for a nonblank search, otherwise 바꾼
  단축키 없음 for 바꿈 or 겹친 단축키 없음 for 겹침; Up/Down leave an empty list
  unchanged.
- A table with the columns 명령 (command) and 단축키 (shortcut), grouped as in
  10's command list. Each 그래픽, 매크로, and 타이머 has its own row under its
  group. Bare letters/digits are reserved for source-slide hot keys, which are
  edited on that song's particular source slide (05), not in a global 이름표
  binding group (October 27 S26 user decision).
- A bar at the bottom shows the selected command, its default ("기본값 없음", no
  default), and the buttons 기본값으로 (reset to default) and 지우기 (remove the
  shortcut). Here 지우기 is the board's label for removing a shortcut, not a
  clear of the output.

### Editing a shortcut

- Double-clicking a row, or pressing Enter on it, opens the key field
  (placeholder "키 입력", press keys). The next key combination becomes the
  shortcut. Esc cancels. Backspace removes the shortcut. The field refuses
  reserved keys, with the reason in its tooltip (10, "Reserved keys").
- A shortcut that differs from the default shows its key caps on the selection
  background.
- If two commands share a combination, both rows show an amber outline and a
  warning icon. The icon's tooltip reads "(명령)과 겹침" (conflicts with the
  command), for example "출력 켜기와 겹침".
- While a conflict exists, the binding that existed first keeps the key. The
  other one doesn't run on that key until the operator resolves the conflict
  (decided, 10).
- Source-slide key conflicts are checked within the song's editor control (05).
  They are not global command conflicts or conflicts across songs.

### Where shortcuts work and default keys

10 defines them: the focus precedence (which control gets a key first), the
reserved keys, conflicts, the stored key format, and the full command list with
default keys.

- The board shows 평상시 as Ctrl 1, 설교 as Alt 2, and 광고 as Alt 3. These are
  examples of changed shortcuts, and the Ctrl 1 example shows a conflict with
  출력 켜기.
- The board also shows a 퀵 실행 group (검은 화면 Ctrl B, 로고 화면 with no
  shortcut). The app lists each 퀵 실행 item under a 퀵 실행 group, with no
  default key, so the board's Ctrl B is not a default (10).

Source: `Shortcuts`, `Prefs`, `KeyCap` README, `SegmentedControl` README (filter
counts), `ClearButton` README, `Main` decision "단축키", product log (퀵 실행
shortcuts deferred), 10.
