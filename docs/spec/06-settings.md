# 06. Settings

This document covers the 화면 설정 (Screen settings) workspace (screens, display
layout, test pattern, output method, Look editor, stage layout editor), the
환경설정 (Preferences) window, and shortcuts.

Terms: 출력 (output), 슬라이드 (slide), 이름표 (label), 본 화면 (main screen),
무대 화면 (stage screen), 방송 자막 (broadcast captions), 진행 도구 (show
tools), 퀵 실행 (quick launch), 소품 (prop), 공지 (notice), 메시지 (message),
타이머 (timer), 라이브러리 (library), 진행 (Show workspace). See 01.

The full shortcut system and a proposal for the 환경설정 pages are in
[10-shortcuts-and-settings.md](10-shortcuts-and-settings.md). Its shortcut part
was decided on 2026-10-25; "Shortcuts" below states the decided rules and points
to 10 for the full command list. Its settings part is still a proposal, so this
document stays the spec for settings. The settings sections that 10 would
replace say so in a note.

## The 화면 설정 workspace

### Layout and navigation

| Column | Content                                                                                                                               | Source                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Left   | The 화면 (screens) panel and the Look panel. In the stage layout editor, the 무대 배치 (stage layouts) panel and the 무대 화면 panel. | `Screens`, `Looks`, `StageEditor` |
| Center | Display layout and output preview, the Look editor, or the layout editor                                                              | `Screens`, `Looks`, `StageEditor` |
| Right  | Properties of the selected screen or stage layout element                                                                             | `Screens`, `StageEditor`          |

- The boards don't show how the operator moves between screens, Looks, and stage
  layouts. Version 1 stacks three panels in the left column (화면, Look, 무대
  배치). Selecting a row switches the center and right columns to the matching
  editor (proposal, open question).
- The boards mark the current Look and the stage layout in use with a "사용 중"
  (in use) chip. The design system forbids status chips. Mark them in the way
  the design system allows (open question).
- Changes in 화면 설정 save at once. Changes that affect what is on output (Look
  edits, screen properties) apply to the output at once (proposal).

Source: `Screens`, `Looks`, `StageEditor`, `Main` board guide (화면 설정, Look
편집, 무대 화면 배치 편집).

## Screens

### Screen list

- Two groups, 청중 (audience) and 무대 (stage). Each row shows an icon (본 화면
  and 무대 화면 use monitor icons, 방송 자막 uses the capture icon), the name,
  the target (모니터 2, 캡처용 창), and a health dot.
- 화면 추가 (add screen, plus icon) is in the board. Version 1 keeps exactly
  three screens (see 01, open question).
- Selecting a screen shows its display layout, output preview, and properties.

### Display layout

- One box per monitor, sized by its resolution and placed like the Windows
  display arrangement. Each box shows the monitor number (large and faint), the
  assigned screen, the resolution, and the monitor name.
- The monitor that holds the main window reads "컨트롤" (control), with dim
  text. The monitor of the selected screen is highlighted.
- A separate box shows targets without a monitor, such as the 방송 자막 capture
  window, with its resolution.
- 모니터 번호 표시 (show monitor numbers) shows a large number on each physical
  monitor for 3 seconds, so the operator can match boxes to monitors (proposal
  for the duration). Each number shows in a borderless window above everything,
  output windows included, and never takes focus or the mouse (proposal).
  - Look (lead decision, October 26; no board draws it): a 240 x 240 square at
    the centre of each monitor, sized in device-independent pixels so a monitor
    at 150% shows it at the same physical size. The square is `--output-black`
    and holds only the monitor number, the same number as the monitor's display
    layout box, in `--text-on-fill`, `--font-ui` at 160 px, weight 700 with
    tabular figures as the box draws its number. ui can restyle it through the
    design system.
  - A number never covers a shown 방송 자막 capture window. When the centre
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
  chooses 화면 내용 or leaves 화면 설정 (proposal).
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
    the content is back at once. Clears and 되돌림 don't touch it, only a saved
    screen can show it, and it never comes back after a restart (proposal).
  - So a pattern never stays on a projector during a service, the app also hides
    every pattern when the main window closes, crashes, or reloads, and hides a
    screen's pattern when its output turns off (lead decision, October 26).
- The caption shows the screen name, the target and monitor name ("모니터 2
  EPSON 프로젝터"), and the resolution and refresh rate ("1920×1080 60Hz").

### Screen properties

Note: the proposal in 10 would remove the 절전 막기 row (fixed on while any
output is on). 항상 위 defaults off for every method and can be enabled in the
screen's properties (user decision, m3-check3).

| Group              | Row                                   | Control                                                                           | Behavior                                                                                                                                                   |
| ------------------ | ------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 화면 (screen)      | 이름 (name)                           | Text field                                                                        | Screen name. Toolbar labels and tooltips use it.                                                                                                           |
| 화면               | 종류 (kind)                           | 청중 or 무대                                                                      | 무대 screens use a stage layout. 청중 screens use a lyric style (proposal).                                                                                |
| 출력 (output)      | 방식 (method)                         | 전체 화면, 창, 캡처용 창, NDI                                                     | See 03. In version 1, NDI shows as unavailable, with the reason in a tooltip (proposal).                                                                   |
| 출력               | 장치 (device)                         | Select with the monitor name as a detail ("모니터 2 EPSON 프로젝터")              | The monitor for full screen.                                                                                                                               |
| 출력               | 해상도 (resolution)                   | Select                                                                            | For full screen, shows the monitor's resolution and can't change (proposal). For the capture window, offers 1920×1080, 1280×720, and 3840×2160 (proposal). |
| 출력               | 주사율 (refresh rate)                 | Read-only value ("60Hz")                                                          |                                                                                                                                                            |
| 안정성 (stability) | 연결이 끊기면 (when disconnected)     | Select: 창으로 바꾸기 (switch to a window), and turning the output off (proposal) | See 03.                                                                                                                                                    |
| 안정성             | 항상 위 (always on top)               | Switch                                                                            | Default off. Changes only this output's stacking, without taking focus or moving any window. See 03, M3-C3-9 (user decision).                              |
| 안정성             | 절전 막기 (prevent sleep)             | Switch                                                                            | See 03.                                                                                                                                                    |
| 보정 (correction)  | 가장자리 여백 (edge margin)           | Number field (%)                                                                  | See 03.                                                                                                                                                    |
| 보정               | 위치 미세 조정 (position fine-tuning) | Two number fields (x, y)                                                          | See 03.                                                                                                                                                    |

### NDI properties (later)

The `ScreensNDI` board shows the NDI version of the properties. Version 1
doesn't build them (see 09), but keeps the data fields (see 02).

| Group              | Row                                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 출력               | 방식: NDI, 소스 이름 (source name, "LOVELIGHT 방송 자막"), 해상도, 프레임 수 (frame rate, 30fps), 알파 채널 (alpha channel), 미리보기 배경 (preview background: 초록 green, 검정 black, 체크 무늬 checkerboard) |
| 네트워크 (network) | 보낼 곳 (network interface, "이더넷 192.168.0.12"), NDI 그룹 (NDI group, "public")                                                                                                                              |

The display layout box of an NDI target shows "보내는 중 수신 1" (sending, 1
receiver), and the status bar shows "방송 자막 NDI 30fps".

### Preview background of the 방송 자막

The in-app preview of the 방송 자막 is green by default. The `ScreensNDI` board
puts the choice of 초록, 검정, and 체크 무늬 in the NDI properties. In version
1, with the capture window, the preview stays green (proposal).

Source: `Screens`, `ScreensNDI`, `PropertyRow` README, `Select` README, product
log version 56.

## Look editor

Note: the proposal in 10 would add rows to the lyric style properties (굵기,
글자 간격, outline and shadow details, 출처 위치).

### Layout

- Left: the Look list with Look 추가 (add Look). The current Look is marked.
- Center header: "Look", the Look name, the current mark, and 복제 (duplicate).
- One card per screen. A card shows the screen icon, name, and target, a preview
  of that screen with this Look, and a layer checklist:

| Screen    | Layer rows (check boxes)                                                                           |
| --------- | -------------------------------------------------------------------------------------------------- |
| 본 화면   | 배경 미디어 (background media), 가사 (lyrics, with a lyric style select), 공지, 소품, 메시지       |
| 무대 화면 | 배경 미디어, 가사 (with a stage layout select), 시계 (clock), 무대 메시지 (stage message), 메시지  |
| 방송 자막 | 배경 (background, with a color select, 초록), 가사 (with a lyric style select), 공지, 소품, 메시지 |

- Below the cards: the 가사 스타일 (lyric style) section, with a segmented
  control for the styles (기본, 현재와 다음, 하단 자막), a style preview, and a
  two-column property grid:

| Property                         | Control                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------- |
| 글꼴 (font)                      | Select. Pretendard is bundled. Installed system fonts are also listed (proposal). |
| 글자색 (text color)              | Color swatch and hex value. Clicking opens a color picker (proposal).             |
| 크기 (size)                      | Number field                                                                      |
| 줄 간격 (line spacing)           | Number field                                                                      |
| 가로 정렬 (horizontal alignment) | 왼쪽 (left), 가운데 (center)                                                      |
| 세로 위치 (vertical position)    | 위 (top), 가운데 (middle), 아래 (bottom)                                          |
| 최대 줄 수 (maximum lines)       | Number field                                                                      |
| 여백 (margin)                    | Number field (%)                                                                  |
| 그림자 (shadow)                  | Switch                                                                            |
| 외곽선 (outline)                 | Switch                                                                            |

### Behavior

- Every change saves at once. Changes to the current Look apply to the output at
  once (proposal).
- A lyric style is shared. Editing it changes every Look that uses it.
- The color select of the 방송 자막 background offers 초록 (`chroma`), 검정
  (black), and 미디어 (show the background media) (proposal; the board shows
  only 초록).
- Look 추가 creates "새 Look" (new Look) as a copy of the current Look
  (proposal). 복제 creates "<name> 복사본" (copy) (proposal).
- The right-click menu of a Look row has 이름 바꾸기 (rename) and 삭제 (delete).
  The current Look can't be deleted. Deleting a Look that a 매크로 uses asks in
  a confirmation dialog (proposal).
- No board shows how to add, rename, or delete a lyric style (open question).
  Version 1 adds a right-click menu to the style segments, with 새 스타일 (new
  style), 이름 바꾸기, and 삭제. A style that a Look uses can't be deleted
  (proposal).

Source: `Looks`, `Main` board guide (Look 편집), `Checkbox` README,
`PropertyRow` README, `Switch` README.

## Stage layout editor

### Layout

- Left: the 무대 배치 list (a small schematic of each layout, the name, and a
  mark for the layout in use) with 새 배치 (new layout). Below it, the 무대 화면
  panel: the screen name, the target, a health dot, and the 배치 (layout)
  select. 03 defines what that select changes.
- Center: a header with the layout name and size ("현재와 다음 1920×1080") and
  요소 추가 (add element, a menu of element kinds). The 16:9 canvas with the
  elements. The selected element has eight handles. A bottom bar has X, Y, W, H
  fields, 비율 고정 (keep aspect ratio), 격자에 맞추기 (snap to grid), and the
  canvas zoom ("53%"). 화면에 맞춤 has no default key; Ctrl 0 resets UI zoom
  (10; M2 check 1 row 11).
- Right: the 요소 (element) properties: the element name and 요소 삭제 (delete
  element). The 내용 (content) group: 이름 (name), 내용 종류 (content kind, a
  select such as 현재 슬라이드, current 슬라이드), and 보여 줄 것 (what to show:
  글자 text, 그림 image, 메모 memo). Then the tabs 모양 (appearance) and 글자
  (text). The 글자 tab has 글꼴, 굵기 (weight), 크기, 글자색, 가로 정렬, 세로
  정렬, 줄 간격, and 크기 자동 맞춤 (auto-fit size).
- Clock elements also offer 시계 형식: 24시간 (default) or 12시간. The latter
  shows 오전/오후 with the 12-hour time, including noon and midnight. It changes
  only that element's display; the wall clock and other clocks are unaffected.

### Element kinds

| Kind in the 요소 추가 menu (proposal names) | Content                           |
| ------------------------------------------- | --------------------------------- |
| 현재 가사 (current lyrics)                  | The live 슬라이드                 |
| 다음 가사 (next lyrics)                     | The next 슬라이드 in the sequence |
| 현재 이름표 (current 이름표)                | The live 슬라이드's 이름표        |
| 다음 이름표 (next 이름표)                   | The next 슬라이드's 이름표        |
| 시계 (clock)                                | Current time                      |
| 타이머                                      | A 타이머 value                    |
| 무대 메시지 (stage message)                 | The stage message                 |

### Behavior

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
- While editing, elements show the live content if there is any, and sample text
  otherwise (proposal).
- Every change saves at once. If the layout is on the 무대 화면 now, the change
  applies to the output at once (proposal).
- 새 배치 creates an empty 1920 x 1080 layout named "새 배치" (proposal). The
  right-click menu of a layout row has 복제, 이름 바꾸기, and 삭제. A layout
  that a Look uses can't be deleted (proposal).
- No board shows the content of the 모양 tab (open question). Version 1 offers a
  background color and opacity for the element box (proposal).

Source: `StageEditor`, `Main` board guide (무대 화면 배치 편집), `IconButton`
README (비율 고정, 격자에 맞추기), `SegmentedControl` README.

## 환경설정 window

Note: the proposal in 10 would replace the page list and most rows of this
table. See "What this proposal would replace" in 10.

- 환경설정 is a separate window with its own title bar ("환경설정") and a close
  button. It opens from 파일 > 환경설정.
- The left list has the pages 일반 (general), 출력 (output), 라이브러리, 성경
  (Bible), 가져오기 (import), 단축키 (shortcuts), and 업데이트 (updates).
- Switches and selects apply at once and save (`Switch` README). 02 lists the
  stored fields.

| Page       | Group                                | Row                                                                                                                                                                    | Control and behavior                                                                                                                                             | Source                                            |
| ---------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 일반       | 앱 (app)                             | 언어 (language)                                                                                                                                                        | Select. Version 1 offers only 한국어 (Korean).                                                                                                                   | `Prefs`                                           |
| 일반       | 앱                                   | 시작할 때 (on launch)                                                                                                                                                  | Select. Version 1 offers only 마지막 예배 열기 (open the last service) (proposal).                                                                               | `Prefs`                                           |
| 일반       | 저장 (saving)                        | 자동 저장 (autosave)                                                                                                                                                   | Not in version 1. Saving happens on every change (open question).                                                                                                | `Prefs`                                           |
| 일반       | 저장                                 | 복구 사본 (recovery copies)                                                                                                                                            | Number field with the unit 개, default 10. See 02.                                                                                                               | `Prefs`                                           |
| 일반       | 보고 (reports)                       | 오류 보고 보내기 (send error reports), 사용 통계 보내기 (send usage statistics)                                                                                        | Not in version 1. `docs/TECH.md` keeps crash records on this computer, and no server exists (proposal, open question).                                           | `Prefs`                                           |
| 출력       | 시작 (launch)                        | 켤 때 화면 출력 (output on launch)                                                                                                                                     | Switch, default off. See 03.                                                                                                                                     | `Prefs`                                           |
| 출력       | 안정성                               | 출력 중 절전 막기, 출력 창 항상 위, 화면 연결이 끊기면                                                                                                                 | Defaults for new screens. Each screen has its own values in 화면 설정 (proposal, open question).                                                                 | `Prefs`                                           |
| 출력       | 성능 (performance)                   | 하드웨어 가속 (hardware acceleration)                                                                                                                                  | Switch, default on. Takes effect on the next launch (proposal).                                                                                                  | `Prefs`                                           |
| 출력       | 성능                                 | 미리보기 (preview)                                                                                                                                                     | Select: 15fps, 30fps (default), 60fps (proposal for the options). See 03.                                                                                        | `Prefs`                                           |
| 라이브러리 | 위치 (locations)                     | 곡 (songs), 미디어 (media)                                                                                                                                             | Read-only path field with a folder icon, and 바꾸기 (change), which opens a folder dialog. See 02.                                                               | `Prefs`, `TextField` README                       |
| 라이브러리 | 백업 (backup)                        | 자동 백업 (automatic backup)                                                                                                                                           | Switch, default on. See 02.                                                                                                                                      | `Prefs`                                           |
| 라이브러리 | 백업                                 | 백업 위치 (backup location)                                                                                                                                            | Read-only path field and 바꾸기.                                                                                                                                 | `Prefs`                                           |
| 라이브러리 | 백업                                 | 보관 (keep)                                                                                                                                                            | Number field with the unit 개, default 30.                                                                                                                       | `Prefs`                                           |
| 라이브러리 | 백업                                 | 마지막 백업 (last backup)                                                                                                                                              | Read-only value ("오늘 07:58", today 07:58) and 지금 백업 (back up now).                                                                                         | `Prefs`                                           |
| 성경       | 설치된 역본 (installed translations) | One row per installed translation: name, language, size, a 기본 (default) tag, and a more menu                                                                         | The more menu offers 기본으로 (make default) only. Prepared translation files arrive with app updates. 기본으로 changes the default translation at once; see 02. | User decision, 2026-10-26; `Prefs` installed list |
| 성경       | 표시 (display)                       | 절 번호 (verse numbers)                                                                                                                                                | Switch, default on.                                                                                                                                              | `Prefs`                                           |
| 성경       | 표시                                 | 한 슬라이드 최대 줄 수 (maximum lines per 슬라이드)                                                                                                                    | Number field with the unit 줄, default 4.                                                                                                                        | `Prefs`                                           |
| 성경       | 표시                                 | 출처 위치 (reference position)                                                                                                                                         | Select, default 오른쪽 아래 (bottom right). Other options: 왼쪽 아래 (bottom left), 숨김 (hidden) (proposal).                                                    | `Prefs`                                           |
| 가져오기   | txt                                  | 슬라이드 나누기, 이름표, 첫 줄, 글자 인코딩                                                                                                                            | Selects. Defaults for text import. See 05.                                                                                                                       | `Prefs`                                           |
| 가져오기   | pptx                                 | 슬라이드 하나 (one slide), 배경 이미지 가져오기 (import background images)                                                                                             | Later (see 09). Version 1 hides this group (proposal).                                                                                                           | `Prefs`                                           |
| 단축키     |                                      |                                                                                                                                                                        | See "Shortcuts".                                                                                                                                                 | `Shortcuts`                                       |
| 업데이트   | 버전 (version)                       | 현재 버전 (current version)                                                                                                                                            | Read-only value.                                                                                                                                                 | `Prefs`                                           |
| 업데이트   | 버전, 받기 (receiving)               | 마지막 확인 and 지금 확인 (check now), 자동 확인 (check automatically), 채널 (channel: 정식 stable, 미리 보기 preview), 예배 중에는 미루기 (postpone during a service) | Not in version 1. `docs/TECH.md` says the app never updates itself and the user installs new versions, and the installer comes later (proposal, open question).  | `Prefs`                                           |

Source: `Prefs`, `PropertyRow` README, `MenuBar` README (secondary window title
bar), `docs/TECH.md` operating rules.

M2 check 1 updates the proposal in 10 with 일반 > UI 확대 (default 100%, Ctrl +,
Ctrl -, Ctrl 0) and 진행 > 지우기 되돌리기 단추 보이기 (proposal, default off).
The zoom scales control windows; it never changes output rendering. These rows
supersede the earlier omission from this window.

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
- A table with the columns 명령 (command) and 단축키 (shortcut), grouped as in
  10's command list, with a group for 이름표 jump keys. Editing a jump key here
  edits the 이름표 list (05). Each Look, 소품, 매크로, and 타이머 has its own
  row under its group.
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
- If two commands share a combination, or two 이름표 share a jump key, both rows
  show an amber outline and a warning icon. The icon's tooltip reads "(명령)과
  겹침" (conflicts with the command), for example "출력 켜기와 겹침".
- While a conflict exists, the binding that existed first keeps the key. The
  other one doesn't run on that key until the operator resolves the conflict
  (decided, 10).

### Where shortcuts work and default keys

10 defines them: the focus precedence (which control gets a key first), the
reserved keys, conflicts, the stored key format, and the full command list with
default keys.

- The board shows 평상시 as Ctrl 1, 설교 as Alt 2, and 광고 as Alt 3. These are
  examples of changed shortcuts, and the Ctrl 1 example shows a conflict with
  출력 켜기.
- The board also shows a 퀵 실행 group (검은 화면 Ctrl B, 로고 화면 with no
  shortcut). The product log defers 퀵 실행 shortcuts, so version 1 leaves out
  this group (see 09, open question).

Source: `Shortcuts`, `Prefs`, `KeyCap` README, `SegmentedControl` README (filter
counts), `ClearButton` README, `Main` decision "단축키", product log (퀵 실행
shortcuts deferred), 10.
