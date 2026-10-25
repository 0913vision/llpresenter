# 01. Concepts and principles

This document defines the principles that apply to every feature, the windows
and workspaces, the three screens, and the data objects and how they relate. The
behavior of each panel is in documents 03 to 08.

## Terms

This spec keeps the Korean names that the operator sees in the app. The first
column is the term as it appears in the app. After this table, the spec uses the
Korean term without a gloss. The design system README has the full glossary,
including the words the app must not use.

| Term in the app | English gloss      | Meaning                                                                                                                           |
| --------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 출력            | output             | Sending content to a screen. In prose, this spec uses the English verb "output" for this term.                                    |
| 지우기          | clear              | Taking a layer off the screens. In prose, this spec uses the English verb "clear". Deleting a file or an item is "삭제" (delete). |
| 슬라이드        | slide              | One screen of lyrics or other content.                                                                                            |
| 예배 순서       | service order      | The item list of one service. One `.llservice` file.                                                                              |
| 틀              | template           | A 예배 순서 that you use to create a new 예배 순서.                                                                               |
| 구성            | arrangement        | A named 슬라이드 order stored in a song, with repeats (기본, 주일용, 짧게).                                                       |
| 이름표          | label              | The name of a 슬라이드, such as 1절 (verse 1), 프리코러스 (pre-chorus), or 후렴 (chorus).                                         |
| 본 화면         | main screen        | The main audience screen.                                                                                                         |
| 무대 화면       | stage screen       | The screen that faces the people on stage.                                                                                        |
| 방송 자막       | broadcast captions | The lower-third caption screen that OBS picks up.                                                                                 |
| Look            | Look               | A set that decides, per screen, which layers show and which lyric style or stage layout to use.                                   |
| 진행 도구       | show tools         | The tabbed panel at the bottom right of the 진행 workspace.                                                                       |
| 퀵 실행         | quick launch       | The list of frequent items at the bottom left of the 진행 workspace.                                                              |
| 소품            | prop               | A logo, caption, or notice card that sits above the lyrics.                                                                       |
| 공지            | notice             | A rotating set of announcement images.                                                                                            |
| 메시지          | message            | A short text, such as a car number call, sent to chosen screens.                                                                  |
| 타이머          | timer              | A countdown, elapsed time, or clock.                                                                                              |
| 라이브러리      | library            | The collection of source songs.                                                                                                   |
| 매크로          | macro              | A button that runs several actions at once.                                                                                       |
| 진행            | Show               | The workspace for the live service.                                                                                               |
| 준비            | Prep               | The workspace for preparing songs and 예배 순서.                                                                                  |
| 화면 설정       | Screen settings    | The workspace for screens, Looks, and stage layouts.                                                                              |

This spec also uses these English terms:

| Term             | Meaning                                                                                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current service  | The open 예배 순서. Its name shows in the middle of the menu bar.                                                                                                                                                                  |
| Output state     | Everything the main process holds about what is on the screens now: which outputs are on, the current Look, the live 슬라이드, the background, 소품, 메시지, the stage message, the 공지, audio, 타이머 state, and the last clear. |
| Live 슬라이드    | The 슬라이드 on the lyrics layer now. There is one live 슬라이드 or none.                                                                                                                                                          |
| Current item     | The 예배 순서 item that the live 슬라이드 came from. It stays the current item after a clear of the lyrics layer, until a 슬라이드 from another item goes out (proposal).                                                          |
| Start an item    | The moment the current item changes to another item. Start macros run at this moment (see 04 and 07).                                                                                                                              |
| During a service | While at least one screen output is on (proposal).                                                                                                                                                                                 |
| Recovery record  | The file where the main process writes the output state at short intervals. The app uses it to restore the output state after a crash (see 02 and 08).                                                                             |
| Sequence         | The order of 슬라이드 in the 슬라이드 panel. For a song item, this is the order of the chosen 구성.                                                                                                                                |

## What the product is

LoveLight Presenter is a Windows desktop app that outputs lyrics, Bible verses,
공지, and 메시지 to several screens during the services of one church. It uses
Electron, electron-vite, React, TypeScript, Zustand, and Pretendard. The
operator watches the service from a dark room and changes the screens with one
click.

The app must do these four things:

- Show different content on each monitor.
- Step through lyrics one 슬라이드 at a time over a looping background video.
- Use a different text layout on each monitor.
- Send 메시지 and 공지 to specific screens or to all screens.

Stability and smooth operation come before the number of features.

The app doesn't do these things:

- Broadcast streaming or recording. OBS streams. The app only makes the 방송
  자막 screen that OBS picks up. The UI never uses the word "송출" (broadcast).
  Sending content to a screen is always "출력".
- Musician features, such as chords, transposition, or arrangement versions for
  players.

Source: product log (2026-10-23 product philosophy, 2026-10-24 decisions),
`Main` decisions, design system README glossary.

## Principles that affect behavior

### The main process owns the output state

- Keep one output state, in the main process.
- The control window and the output windows never change the output state
  directly. They send commands (a type and a payload) to the main process. The
  main process handles the commands one at a time in the order it receives them,
  and then sends the new state to every window.
- Output windows only draw the state they receive. If the control window freezes
  or reloads, the output windows keep their picture.
- Undo of a clear, the recovery record, macro runs, and shortcuts all go through
  the same command path. The same command gives the same result, wherever it
  comes from.
- A command whose type the main process doesn't know, or whose payload fails its
  schema, is dropped and logged, and the state doesn't change (`CLAUDE.md`:
  validate every value from outside the process). A command that names something
  that no longer exists, such as a deleted Look or 소품, is dropped and logged
  the same way. Inside a 매크로 or a batch, that one action is skipped and the
  rest run (07).
- Each new state carries a number that rises by one with every change. A window
  that receives a state with a lower number than the one it already has ignores
  it (proposal).
- A batch (`live.batch`) is a list of commands that the main process applies in
  order as one change: it sends one new state, so the screens change once. A
  매크로 run and an item start with its first 슬라이드 go as one batch (03, 07)
  (proposal).

Source: product log ("How to apply": main-process-owned live state),
`docs/TECH.md` process structure.

### A click outputs at once

- When the operator clicks a 슬라이드, a media tile, a 소품, a 공지 image, a 퀵
  실행 item, or a 매크로, the app outputs or runs it at once, without asking.
  The app has no cue-then-take mode.
- Actions that affect the output (clicking a 슬라이드, clearing, turning a
  screen output on or off, opening another 예배 순서) never show a confirmation
  dialog. The operator fixes a mistake with undo, by clicking again, or by
  turning the output back on.
- Show a confirmation dialog only for actions that you can't undo, such as
  overwriting or deleting.

Source: `Main` decision "출력은 누르면 바로", design system principle 6, product
log version 61.

### Saving is automatic

- Save songs, 예배 순서, 틀, app-wide settings, and the media list on every
  change. The app has no save button. The 파일 (File) menu has no save, open, or
  recent services items.
- One exception: an imported song enters the 라이브러리 only when the operator
  finishes editing it and clicks 저장 (Save). See 05.
- The output state isn't saved in these files. The main process writes it to the
  recovery record. After a crash, the app asks only about the output state. See
  02 and 08.

Source: `Main` decisions "저장은 자동" and "복구는 출력 상태만", product log
versions 61 and 63.

### Red is only for output

- Red (`live`) marks only what is on the screens now: the live 슬라이드, the
  current background, 소품 and 공지 that are on, the dot on an output toggle
  that is on, the LIVE badge in the 예배 순서, a 퀵 실행 row that is on, and the
  stage message.
- Selection is blue, problems are amber, and healthy state is a green dot. Clear
  buttons, delete menu items, and problem notifications don't use red. The
  design system makes one exception: the error ring on a field whose value can't
  be saved.
- Compute "on output" from the output state, and have the UI draw red only from
  that value. Don't mix "selected" and "on output" into one value.

Source: design system principle 4 and state table, `Main` decision "빨강은
출력에만".

### No explanatory text in the UI

- Don't add explanatory sentences, status chips, help paragraphs, or example
  chips. Show state with shape and color (rings, outlines, icons, brightness).
  Put reasons in tooltips.
- Show state only for exceptions. Don't mark every healthy row.
- Don't show "done" messages such as "저장했습니다" (Saved) or "지웠습니다"
  (Cleared). The time in the status bar shows the last save. A clear button that
  turns to its "nothing to clear" state shows a clear.
- Only events that the app must report on its own, such as a lost output
  monitor, appear as notification cards. See 08.

Source: design system principle 3 and writing rules, product log versions 56
and 61.

### Windows only

- Version 1 runs only on Windows. The target is Windows 10 or later (proposal).
- The main window has no Windows title bar. The menu bar also serves as the
  title bar.
- All base sizes are CSS pixels after Windows display scaling. UI zoom scales
  the control windows from that base, independently of output rendering (10;
  decided in M2 check 1, row 11).
- Shortcuts are matched by physical key, so they work with the Korean IME on,
  and their names are written in English as Windows writes them: Ctrl, Alt,
  Shift, Page Up (decided, 10).

Source: design system README (implementation notes, window sizes), `KeyCap`
README.

### No network during a service

- Every feature that a service needs works without the internet. The app bundles
  the Bible texts, fonts, and icons. Media are files on this computer.
- Features that need the network aren't needed for a service. If they fail,
  nothing else is affected.
- During a service, don't check for or install updates, and don't run large
  backups. See 08.

Source: product log (offline Bible data preferred), `docs/TECH.md` principle 5.

### Follow ProPresenter

- Put a feature that ProPresenter also has in the same place, with the same
  behavior. The table below lists the differences.
- This spec says "like ProPresenter" only where a source says so, and names the
  source (README, "Sources"). Where no source was found, it says so, or calls
  the behavior "our design".

| Topic                 | ProPresenter                                                                                                                                         | LoveLight Presenter                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Services and settings | A playlist holds items that reference presentations (S4 p. 17). Screens (p. 32), Looks (p. 37), stage layouts (p. 40), and macros (S5) are app-wide. | Same.                                                                                                |
| New service           | New Playlist from Template, with headers and placeholders (S19, 7.10 and later).                                                                     | Same. A new service can also start from a past service (our design).                                 |
| Choosing a service    | The Libraries and Playlists list on the upper left (S4 p. 17).                                                                                       | A list that opens from the service name in the 예배 순서 header (our design).                        |
| Output                | Clicking a slide outputs it at once (S4 p. 70).                                                                                                      | Same.                                                                                                |
| Song arrangements     | A song stores several named arrangements, and the playlist stores which one each item uses (S4 pp. 80 to 81).                                        | Same. The 예배 순서 item picks one.                                                                  |
| Stage screen          | Looks apply only to audience screens (S4 p. 37). Each stage screen gets a layout from the Stage Layout Editor (p. 40).                               | Looks also turn stage layers on and off (our design). The layout comes from the stage layout editor. |
| Clearing              | Per-layer clears (S4 p. 25) and, since 7.7, Clear Groups (S3, S7).                                                                                   | Seven per-layer clears. To clear several layers at once, use a 매크로.                               |
| Broadcast output      | NDI output screens (S4 p. 32).                                                                                                                       | NDI is the goal, with the capture window as fallback. Version 1 ships the capture window (see 09).   |
| Macro editing         | A macro's actions are edited from its right-click menu (S5). The Action Palette adds actions to slides (S4 p. 83).                                   | The same right-click menu, plus an action palette for 매크로 (our design).                           |
| Bible                 | A separate Bible view (S4 pp. 16, 138).                                                                                                              | Search directly in the 퀵 실행 field (our design).                                                   |
| Crash                 | Saves every change automatically (S20).                                                                                                              | Same. On restart, only the output state is restored (our design).                                    |
| Small screens         | The ^ button hides the Libraries and Playlists section (S4 p. 18), and the Media Bin can be hidden (p. 10). No source on a layout for small windows. | A separate layout for 1366 x 768 that collapses the left column (our design).                        |
| Camera input          | Video inputs (USB, Thunderbolt, SDI, NDI, Syphon) are registered in Preferences > Input (S4 pp. 177 to 180).                                         | Added later the same way (see 09).                                                                   |

Source: `Main` "프로프리젠터와 다른 점", design system principle 2, product log
("follow the reference strictly").

## Windows

| Window             | Count        | Role                                       | Details                   |
| ------------------ | ------------ | ------------------------------------------ | ------------------------- |
| Main window        | 1            | Menu bar, toolbar, workspaces, status bar  | This document, 04, 05, 06 |
| Output window      | 1 per screen | Draws the 본 화면, 무대 화면, or 방송 자막 | 03                        |
| Preferences window | 1            | 환경설정 (Preferences) and shortcuts       | 06, 10                    |

- The main window's minimum size is 1280 x 720. Size classes (narrow, regular,
  wide) and column widths follow the design system `Layout` document.
- Only one instance of the app runs at a time (proposal). Launching it again
  brings the existing main window to the front. For development, a different app
  data folder (`LLP_USER_DATA`) allows a separate instance. See
  `docs/WORKFLOW.md`.
- Dialogs and confirmation dialogs open only inside the main window, below the
  menu bar. Nothing ever opens over an output window. See 08.

Source: design system README (window sizes), `Layout`, `Dialog`, and `MenuBar`
READMEs, `Prefs`.

### Menu bar

- From the left: the app name "LoveLight", the menus (파일 File, 편집 Edit, 보기
  View, 출력 Output, 창 Window, 도움말 Help), the current service name in the
  middle, and the window buttons at the right end. The service name in the
  middle isn't clickable.
- The 파일 menu has these items: 새 예배 (New service), 다른 예배에서 가져오기
  (Import from another service), 지금 예배를 틀로 저장 (Save current service as
  template), 가져오기 (Import, submenu: 텍스트 파일 Text file, 클립보드 텍스트
  Clipboard text, PowerPoint 파일 PowerPoint file), 내보내기 (Export, submenu),
  and 환경설정 (Preferences).
  - In version 1, the PowerPoint file item shows as unavailable, with the reason
    in a tooltip (proposal).
  - No source lists the items of the Export submenu. Version 1 leaves out the
    Export item (proposal, open question).
- No source lists the items of the other menus. Version 1 has only these items
  (proposal, open question):

  | Menu          | Items                                                                                                                      |
  | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
  | 편집 (Edit)   | Undo, redo, cut, copy, paste, delete                                                                                       |
  | 보기 (View)   | 진행, 준비, 화면 설정, 미디어 (Media), UI 확대, UI 축소, UI 확대 초기화; 화면 배치 초기화 with confirmation (proposal; 10) |
  | 출력 (Output) | 본 화면, 무대 화면, 방송 자막 output on or off (with check marks), separator, list of Looks (check on the current Look)    |
  | 창 (Window)   | Minimize, maximize, 환경설정                                                                                               |
  | 도움말 (Help) | Version information, open the log folder                                                                                   |

- Menu keyboard behavior follows the design system `MenuBar` and `Menu`
  documents.

Source: `ImportMenu`, `MenuBar` README, `Menu` README, product log version 63
(no save, open, or recent services in the 파일 menu).

### Toolbar

The toolbar has the same buttons in the same places in every workspace.

| Position | Button                                                           | Behavior                                                                                                              |
| -------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Left     | 진행, 준비, 화면 설정                                            | Switch workspaces.                                                                                                    |
| Left     | 미디어 (Media)                                                   | In 진행, opens and closes the media strip (see 04). In 준비, opens and closes the media view (see 05, open question). |
| Center   | Search field "곡, 가사, 초성" (song, lyrics, initial consonants) | Searches the 라이브러리 (see 04 and 05).                                                                              |
| Right    | Look (shows the current Look name)                               | Opens the Look menu. Choosing a Look applies it at once (see 03).                                                     |
| Right    | 본 화면, 무대, 방송 자막                                         | Turns that screen's output on or off (see 03).                                                                        |

Source: `ShowH`, `Toolbar` README, `ToolbarButton` README, `Media`.

### Status bar

- Left: the time of the last save, for example "23:41 저장됨" (saved at 23:41).
  It changes each time an autosave finishes.
- Right: the output health of the 본 화면, 무대 화면, and 방송 자막, in that
  order, for example "본 화면 60fps" or "무대 화면 창으로 표시 중" (stage screen
  showing in a window). A screen whose output is off shows only its name. While
  the output state recovery dialog is open, the status reads "대기" (standby).
  See 08.
- Nothing is clickable, with one exception: if the operator closed a warning
  notification, clicking that screen's text reopens the notification. See 08.

Source: `StatusBar` README, `Notification` README, `Problems`, `ScreensNDI`.

## The three workspaces

All three workspaces use the same three-column frame (left, center, right). The
라이브러리 exists only in 준비.

| Workspace | Left column                   | Center column                                                    | Right column                                            | Details |
| --------- | ----------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- | ------- |
| 진행      | 예배 순서, 퀵 실행            | 슬라이드 panel, media strip                                      | Preview, clear row, 진행 도구                           | 04      |
| 준비      | 예배 순서, 라이브러리         | Song editor or 예배 순서 item. With 미디어 on, the media view.   | Preview and 슬라이드 list, or preview and item settings | 05      |
| 화면 설정 | Screens, Looks, stage layouts | Display layout and output preview, Look editor, or layout editor | Properties                                              | 06      |

- Switching workspaces never changes the output.
- All three workspaces share the current service. The 예배 순서 panels in 진행
  and 준비 show the same 예배 순서.
- F1 to F7 work in every workspace, even with a dialog open (10, focus
  precedence). Ctrl Z only undoes edits. Clear undo has no default key and its
  optional button is hidden by default (proposal; 03, 10; M2 check 1 rows 7 and
  8). The `ClearButton` README needs the same scope and button update.
- The app always opens in the 진행 workspace (proposal).

Source: `Main` decision "작업 공간 세 개", design system README (window sizes
and layout), `ClearButton` README, `Dialog` README, product log (2026-10-24
workspaces).

## The three screens

| Screen    | Kind     | Version 1 output method                                         | Toolbar name | Example in the boards                                    |
| --------- | -------- | --------------------------------------------------------------- | ------------ | -------------------------------------------------------- |
| 본 화면   | Audience | Full screen (monitor)                                           | 본 화면      | Monitor 2, lyric style "기본" (default)                  |
| 무대 화면 | Stage    | Full screen (monitor)                                           | 무대         | Monitor 3, stage layout "현재와 다음" (current and next) |
| 방송 자막 | Audience | Capture window with green background. NDI comes later (see 09). | 방송 자막    | Lyric style "하단 자막" (lower third)                    |

- The app doesn't use a lobby screen.
- Make the screen list data that can grow, but version 1 has exactly these three
  screens (proposal, open question: the 화면 설정 board has an "add screen"
  button).
- Each screen draws the same output state differently, using the layers and
  lyric style (or stage layout for the 무대 화면) of the current Look. See 03.

Source: `Main` decisions "화면 세 개" and "방송 자막은 NDI로", product log
(2026-10-24: no lobby, NDI preferred), `Screens`, `Outputs`.

## Data objects and how they relate

### Objects

| Object                         | Meaning                                                                                                           | Stored in                                | Referenced by                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------- |
| 라이브러리 song                | The source of the lyrics. Title, 슬라이드 list, default background, 구성 list.                                    | One `.llsong` file per song              | Song ID                             |
| 슬라이드                       | One screen of content. An optional 이름표 and a list of lines.                                                    | Inside the song file                     | 슬라이드 number in the song, from 1 |
| 이름표                         | The name of a 슬라이드. Has a color and a jump key.                                                               | App-wide 이름표 list                     | Name (string)                       |
| 구성                           | A named 슬라이드 order stored in the song, with repeats. "기본" (default) is the file order and isn't stored.     | Inside the song file                     | 구성 name                           |
| 예배 순서                      | The item list of one service. Name, date, items.                                                                  | One `.llservice` file per service        | Service ID                          |
| 예배 순서 item                 | Header, song, slot, Bible passage, media, or 공지.                                                                | Inside the service file                  | Item ID (proposal)                  |
| 틀                             | A 예배 순서 used to create a new one. It can hold slot items.                                                     | One `.llservice` file per 틀             | 틀 ID                               |
| Media                          | One video, image, or audio file and its playback properties.                                                      | Media list                               | Media ID                            |
| Media playlist, audio playlist | A list of media.                                                                                                  | Media list                               | Playlist ID                         |
| Screen                         | One output target (본 화면, 무대 화면, 방송 자막).                                                                | App-wide settings                        | Screen ID                           |
| Look                           | Per screen: which layers show, and the lyric style (or stage layout for the 무대 화면).                           | App-wide settings                        | Look ID                             |
| Lyric style                    | The look of the text on a 슬라이드: font, size, color, alignment, margins.                                        | App-wide settings                        | Lyric style ID                      |
| Stage layout                   | The arrangement of elements on the 무대 화면 (current lyrics, next lyrics, 이름표, clock, 타이머, stage message). | App-wide settings                        | Stage layout ID                     |
| 매크로                         | A button that runs several actions. Grouped into collections.                                                     | App-wide settings                        | 매크로 ID                           |
| 퀵 실행 item                   | A frequent item on the 진행 workspace (a verse, a song, a black screen, a logo).                                  | App-wide settings                        | Item ID                             |
| 메시지 template                | A 메시지 sentence with blanks, such as "{차량 번호}" (car number).                                                | App-wide settings                        | Template ID                         |
| 공지 set                       | A list of 공지 images that advance in turn.                                                                       | App-wide settings                        | Set ID                              |
| 소품                           | An element above the lyrics, such as a logo, a caption, or a notice card.                                         | App-wide settings                        | 소품 ID                             |
| 타이머                         | Time left until a set time, a fixed duration, time since a set time, or a clock.                                  | App-wide settings                        | 타이머 ID                           |
| Bible translation              | A bundled Bible text.                                                                                             | Translation files in the app data folder | Translation ID                      |

### Relations

- A song item in a 예배 순서 points to a 라이브러리 song by song ID. It picks
  one 구성 stored in that song, by name. If it picks none, it uses the default
  구성.
- A song item also holds its own background override (a media ID), a 매크로 to
  run when the item starts, and a memo.
- Edits to a song's lyrics, 이름표, default background, or 구성 show at once in
  every 예배 순서 that uses the song. A 예배 순서 never copies a song.
- A 슬라이드 holds its 이름표 by name. The app looks up the color and jump key
  in the app-wide 이름표 list. A name that isn't in the list draws with no
  color.
- Songs and 예배 순서 refer to media only by media ID. File paths exist only in
  the media list.
- A Look holds, for each screen ID, the visibility of each layer and a lyric
  style ID (or a stage layout ID for the 무대 화면).
- 매크로 actions refer to Looks, media, 소품, 메시지 templates, 공지 sets,
  타이머, audio playlists, stage layouts, and other 매크로 by ID.
- A 퀵 실행 item points to a song, a Bible passage, a 소품, a 타이머, or a
  매크로. See 04.

### What belongs to a service, a song, or the app

| Per service (`.llservice`)            | Per song (`.llsong`)             | One for the whole app                     |
| ------------------------------------- | -------------------------------- | ----------------------------------------- |
| Service name, date and time           | Title                            | Screens                                   |
| Items and their order                 | 슬라이드 (이름표 name, lines)    | Looks, lyric styles                       |
| The 구성 name each song item picks    | Default background               | Stage layouts                             |
| Background override of each song item | 구성 (names and 슬라이드 orders) | 매크로 and collections                    |
| Start 매크로 of each song item        |                                  | 퀵 실행                                   |
| Memo of each song item                |                                  | 메시지 templates, 공지 sets, 소품, 타이머 |
|                                       |                                  | 이름표 list (name, color, jump key)       |
|                                       |                                  | 환경설정, shortcuts, Bible translations   |
|                                       |                                  | Media list and playlists                  |

- To make one service look different from another, keep several Looks and switch
  them with the start 매크로 of an item.
- The version 62 idea of storing screens, Looks, and 매크로 inside the service
  file isn't used.

Source: `Main` decisions "라이브러리와 예배 순서는 따로", "설정은 앱 전체에
하나", and "곡 구성은 프리셋", `Main` notes on `.llsong` and `.llservice`,
product log versions 61 and 63, design system README (이름표 colors).

### Layers

Output screens draw stacked layers. 03 defines the stacking order and the
clears.

| Layer                    | Content                                        | Cleared by                                  |
| ------------------------ | ---------------------------------------------- | ------------------------------------------- |
| Media (background media) | Looping background video, image, or media item | F3 미디어                                   |
| Lyrics                   | The live 슬라이드 (lyrics or Bible verse)      | F2 가사                                     |
| 공지                     | Images from a 공지 set                         | F7 공지                                     |
| 소품                     | Logo, caption, notice card                     | F4 소품                                     |
| 메시지                   | Text made from a 메시지 template               | F6 메시지                                   |
| Audio                    | Audio playback (no picture)                    | F5 오디오                                   |
| Clock, stage message     | Elements that exist only on the 무대 화면      | 내리기 (Take down) in the 무대 tab (see 04) |

Source: `Looks`, `ShowH` (clear row), `ClearButton` README, `Overlays`.
