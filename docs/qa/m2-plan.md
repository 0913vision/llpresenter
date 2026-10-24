# M2 test plan

This plan describes how QA tests milestone M2 (Vertical slice) after the lead
freezes it as the tag `m2`. It builds on the M1 plan (`docs/qa/m1-plan.md`): the
test environment, the safety rules, the procedures, the way results are
recorded, and the severity guide are the same unless this plan says otherwise.
The results go into `docs/qa/m2-report.md`, and the evidence goes into
`docs/qa/m2/`.

## Scope

In scope, from the M2 task table in `docs/MILESTONES.md`:

- The main-process file store: atomic writes, autosave, recovery copies,
  backups, and the song library and services read through the schemas (data).
- Output windows: one per screen, display detection, connect and disconnect,
  relaunch after a crash, and the output toggles (output-1).
- A 장 over a looping background video on the 본 화면 (output-2).
- The 진행 workspace: the 예배 순서 list, the 장 panel with thumbnails, click to
  output, the previews, and the 지우기 row with F1 to F7 and undo (shell).
- The remaining shared components in the gallery: SlideThumbnail, PreviewFrame,
  ClearButton, LabelChip, KeyCap, PropertyRow, MediaTile, MacroTile,
  Notification, and LabelColorPicker (ui).
- The soak recording on the app side and the first UI tests (devops).
- A regression run of the M1 cases that M2 code touches.

Out of scope, because `docs/PLAN.md` puts them in phase 3 (M3):

- The 출력 상태 복구 (output state recovery) dialog, Looks and the Look editor,
  the 무대 화면 layout, the 방송 자막 capture window, the 진행 도구 tabs, 퀵
  실행, the media strip, Bible passages, the 준비 workspace, and 화면 설정.
- Adding songs and items through the UI. In M2, a song reaches a 예배 순서
  through a service file prepared on disk (see [Fixture](#fixture)).
- The notification host that shows cards on screen. M2 ships the `Notification`
  component (G48) and the main-process events. Where a case expects a card, M2
  checks the event and the log, and the card part is marked "(card: M3)".

Where an M2 case meets one of these (for example, the recovery record that the
dialog will read), the case checks only what M2 builds and says so.

## What changes from the M1 plan

### Safe launching

Nothing may appear on the user's screen, so every run in this plan except K22,
X20, and SK3 starts Electron only through QA's own launchers:

- **The app** starts through the QA launcher: a small wrapper app that patches
  Electron and then loads the build's main process unchanged. Every window it
  shows is fully transparent, click-through, unfocusable, and out of the task
  bar and Alt+Tab, on the primary work area. Calls to `dialog.*`, `focus`,
  `maximize`, `minimize`, `setFullScreen`, and `setAlwaysOnTop` are recorded,
  not applied. This replaces the offscreen placement of the M1 plan, which
  didn't hold at the monitor's full size and made the viewport 16×8 px larger
  than the window.
- **The gallery** runs on `LLP_DEV_PORT=5189 npm run gallery` (plain Vite, no
  Electron), and the gallery and card pages open in QA's invisible viewer.
- **Soak runs** start the build through the QA launcher with the variables in
  `scripts/README.md` "`npm run soak`" (`LLP_SOAK_RECORD`, `LLP_SOAK_EXIT_MS`,
  and a new `LLP_USER_DATA`), wait until the app quits by itself, and judge the
  record with `npm run soak -- --minutes <n> --judge <record.jsonl>`.
- QA never runs `npm run soak` without `--judge`, `npm run dev`,
  `electron-vite dev` (with or without `--rendererOnly`), or `electron .`: each
  starts Electron with visible windows.
- After every run, QA checks that no Electron process from its folders is left.

### Fake monitors

Output windows go full screen on real monitors. So the QA launcher replaces what
Electron's `screen` module reports with the real primary monitor plus fake
monitors to its right, where no real monitor is on this computer today. The
windows on them are invisible anyway:

| Monitor | Bounds (DIP)                                  | Role                                           |
| ------- | --------------------------------------------- | ---------------------------------------------- |
| Primary | The real monitor (1920×1080 at x 0 here)      | Control monitor (holds the main window)        |
| FM2     | Starts at the primary's right edge, 1920×1080 | 본 화면                                        |
| FM3     | Right of FM2, 1920×1080                       | 무대 화면                                      |
| FM4     | Right of FM3, 2560×1440 DIP                   | A 3840×2160 monitor at 150%, for scaling cases |

- The launcher emits `display-removed`, `display-added`, and
  `display-metrics-changed` on the fake list to simulate unplugging, plugging
  in, and a resolution change.
- It turns `setFullScreen(true)` into a resize of the window's content to the
  fake monitor's bounds and records the call, because Windows would otherwise
  move a full screen window onto a real monitor.
- This checks the app's logic and drawing, not Windows' handling of a real
  unplug. The cases marked "with the user" cover that on real hardware.

### Cases with the user

Three checks need the real second monitor, so they show windows on the user's
screen and need the user's time. The lead arranges them with the user at the M2
freeze, after the fake-monitor runs pass. For these runs only, the main window
shows on the user's primary monitor. These are the steps for the user, in
Korean:

**K22: 실제 모니터에 전체 화면 출력**

1. 두 번째 모니터를 켜 두고, 그 모니터에 있는 다른 창은 옮겨 주십시오.
2. QA가 시험용 앱을 첫 번째 모니터에 띄웁니다.
3. 도구 모음의 "본 화면" 단추를 눌러 출력을 켭니다.
4. 두 번째 모니터 전체에 배경 영상과 가사가 나오고, 작업 표시줄이나 창 테두리가
   보이지 않는지 확인합니다.
5. 장을 몇 개 눌러 보고, F2, F3, F1, Ctrl Z를 차례로 눌러 화면이 지워지고
   되살아나는지 봅니다.
6. "본 화면" 단추를 다시 눌러 출력을 끄고, 두 번째 모니터에 아무것도 남지
   않았는지 확인합니다.

**X20: 모니터 케이블을 뽑았다 다시 꽂기**

1. K22의 1번부터 3번까지 하고, 장 하나를 눌러 가사와 배경 영상이 나오게 합니다.
2. 두 번째 모니터의 영상 케이블을 뽑습니다.
3. 출력이 첫 번째 모니터의 창으로 옮겨 와 끊기지 않고 계속 나오는지, 도구 모음의
   "본 화면" 단추가 주황색 경고 표시로 바뀌는지 봅니다.
4. 10초쯤 뒤에 케이블을 다시 꽂습니다.
5. 출력이 두 번째 모니터의 전체 화면으로 돌아가고, 단추가 원래대로 돌아오는지
   봅니다.

**SK3: 두 모니터에서 60분 연속 출력**

1. 두 번째 모니터를 한 시간 동안 쓰지 않을 시간을 정해 주십시오. 컴퓨터는 전원에
   연결해 둡니다.
2. QA가 시험을 시작하면, 두 번째 모니터에 반복 배경 영상이 나오고 5초마다 장이
   바뀝니다.
3. 처음 1분과 마지막 1분 동안, 영상이 끊기거나 멈칫하는 곳이 있는지 봐 주십시오.
4. 그 사이에는 앱을 만지지 않으셔도 됩니다. 끝나면 QA가 결과를 알려 드립니다.

### Test media

The repository holds no video files, and QA installs no programs. QA makes its
own test media with the browser's `MediaRecorder` in QA's invisible viewer and
keeps it in `D:\llp-dev\qa\media`, never in the repository:

| File              | Content                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `loop-1080p.webm` | 10 s, 1920×1080, 30 fps, VP9: a frame counter, a moving bar, and a color that changes each second |
| `loop-1080p.mp4`  | The same in H.264, if Chromium's recorder offers it here (record whether it does)                 |
| `loop-4k.webm`    | 10 s, 3840×2160, for load                                                                         |
| `short-2s.webm`   | 2 s, for many loop points in a short run                                                          |
| `still.png`       | A 1920×1080 still with a grid                                                                     |

The frame counter lets QA see a gap or a jump at the loop point in a sequence of
output captures: every loop must go from the last frame number to the first with
no black frame and no repeated run.

### Fixture

The data store reads the songs and the 예배 순서 from the data folder under
`LLP_USER_DATA` at startup. P-library writes this fixture there before each
launch, through the M1 serializers, so every file is valid by construction:

| File                          | Content                                                                                                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `곡\<song ID>.llsong`         | Hymn 1 (만복의 근원 하나님, public domain) in 4 장 with the 이름표 1절, 프리코러스, 후렴, and none, as in the spec 02 sample; the 구성 주일용 (1, 2, 3, 4, 2, 3, 4, 3, 4) and 짧게 (1, 2, 3, 4); background `loop-1080p.webm` |
| `설정\media.json`             | The test media of [Test media](#test-media), each with a new ID, `end` loop, `fit` fill                                                                                                                                       |
| `예배\<service ID>.llservice` | 주일 예배, 2026-11-01T11:00: a header 찬양, the song item with the 구성 주일용, and a slot `song` 찬양                                                                                                                        |
| `app.json`                    | `lastServiceId` pointing at that service                                                                                                                                                                                      |

Variants for single cases: a second song item with the same background (R9), an
item with a background override and a song without a background (R10), a song
with 1 to 12 lines per 장 (R4), unknown fields at every level (F8), and a
service with 200 items and a song with 150 장 (P12).

### New procedures

| Procedure                   | What it does                                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-library                   | Writes the [Fixture](#fixture) (or one of its variants) into the data folder under `LLP_USER_DATA` before launch.                                                                                         |
| P-output(screen)            | Attaches CDP to that screen's output window and reads what it draws: the text, its box and computed style, the video elements and their `currentTime`, and a screenshot through `Page.captureScreenshot`. |
| P-frames(screen, s)         | Records `requestAnimationFrame` deltas in the output window for `s` seconds, and counts frames over 20 ms and over 50 ms.                                                                                 |
| P-unplug(FM) and P-plug(FM) | Removes or adds a fake monitor and emits the event.                                                                                                                                                       |
| P-crash(screen)             | Kills the output window's renderer process (`taskkill /F` on `webContents.getOSProcessId()`), or calls `forcefullyCrashRenderer()`.                                                                       |
| P-latency                   | Dispatches a click on a thumbnail through CDP and stamps the time in the control window; a `MutationObserver` in the output window stamps the time the text changes; both use `performance.timeOrigin`.   |

## Coverage

| Acceptance criterion (`docs/MILESTONES.md`)                                                                                                                    | Cases               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| One song file goes from the library into a 예배 순서, shows as thumbnails in 진행, and a click shows its lyrics over a looping background video on the 본 화면 | L1 to L8, R1 to R14 |
| F1 to F7 clear the right layers, and undo restores the last clear                                                                                              | K1 to K22           |
| 60 minutes of continuous output on two monitors shows no stutter and no memory growth                                                                          | SK1 to SK6          |
| The app recovers when an output window is force-quit, when a monitor is unplugged, and when the app itself is force-quit                                       | X1 to X20           |
| Tasks beyond the criteria                                                                                                                                      | V, F, O, P, G, U, M |

## Test cases

### V. Checks

- **V1 M1 checks again**
  - Steps: Run M1 cases V1 to V10 and V14 to V16 on a clean clone at `m2`.
  - Expected: As in M1. The unit suite, now larger, still finishes in under 1
    minute.
  - Source: `docs/MILESTONES.md`; `docs/TECH.md` "Tests".
- **V2 UI tests stay off the screen**
  - Steps: Run the UI tests that devops added, as `npm run verify` and CI run
    them.
  - Expected: No window appears on the user's screen and no window takes focus
    while they run. They pass on the clean clone and on CI.
  - Source: M2 task (devops); `CLAUDE.md` ("Never let a window or an error
    dialog appear on the user's screen").

### F. File store

Sources for the whole section: `docs/spec/02-data.md` "Folder layout", "Save
rules", and "Schema versions and migration"; `docs/TECH.md` "Storage".

- **F1 Folders under `LLP_USER_DATA`**
  - Steps: Start with an empty `LLP_USER_DATA`, then list it.
  - Expected: Both the app data folder and the data folder live under it (`곡\`,
    `예배\`, `틀\`, `설정\`, `.복구 사본\`, and `app.json`, `logs\`,
    `recovery\`, as far as M2 creates them). Nothing is written to the real
    Documents folder.
  - Source: spec 02 "Folder layout" (the `LLP_USER_DATA` rule).
- **F2 Files named by ID**
  - Steps: P-library, start, change the song title (or the service name) through
    the M2 UI or a store command.
  - Expected: The file keeps its `<ID>.llsong` name.
  - Source: spec 02 ("Name each file by its ID").
- **F3 Missing settings files**
  - Steps: Start with no settings files.
  - Expected: The files that M2 reads are created with the spec 02 defaults and
    parse with the M1 schemas.
  - Source: spec 02 ("On first launch, create any missing file").
- **F4 Autosave after a burst**
  - Steps: Make 20 changes 50 ms apart, then watch the file.
  - Expected: One write within 0.5 s after the last change, holding the last
    change. The status bar's save time changes when the write finishes.
  - Source: spec 02 "Autosave"; `StatusBar` README.
- **F5 Pending writes on quit**
  - Steps: Make a change and quit at once (P-quit within 100 ms).
  - Expected: The change is on disk after the quit.
  - Source: spec 02 ("Before the app quits, write everything that is pending").
- **F6 Atomic writes under force-quit**
  - Steps: Watch the song folder (`fs.watch`). 50 times, change a song and
    P-kill at a real write stage, in turn: (a) when the temporary file appears,
    (b) when it has its full size, and (c) right after the rename, when the song
    file changes. Then start again. If no temporary file ever shows, record how
    the store writes and kill at the moment the song file changes. The report
    records which stage each kill actually interrupted, and marks a stage
    blocked when the watcher can't hit it reliably.
  - Expected: The song file always parses and holds either the old or the new
    content, never empty or partial. After a kill at (c), it holds the new
    content. A leftover temporary file doesn't break the next start and isn't
    read as a song.
  - Source: spec 02 "Atomic writes" (temporary file, flush, rename);
    `CLAUDE.md`.
- **F7 Overlapping writes run in order**
  - Steps: Change the same file 100 times as fast as possible.
  - Expected: The file ends with the last change.
  - Source: spec 02 ("The later content must win").
- **F8 Unknown fields on write**
  - Steps: P-library with unknown fields at every level of the song and service
    files; change one known field; read the files.
  - Expected: Every unknown field is still there, unchanged.
  - Source: spec 02 "Unknown fields"; `CLAUDE.md`.
- **F9 Recovery copies**
  - Steps: Change a song every minute for 12 minutes, then list
    `.복구 사본\<kind>\<ID>\`.
  - Expected: At most one copy per 5 minutes, at most 10 copies (the
    `backupCopies` default), the oldest deleted first, and each copy parses.
  - Source: spec 02 "Recovery copies".
- **F10 Automatic backup**
  - Steps: Start twice on the same day, then once with `lastBackupAt` set to
    yesterday, with no output on. Then start with the backup location on a drive
    that doesn't exist.
  - Expected: One backup folder per day, at launch, holding the song, service,
    틀, and settings folders and no media, at most 30 kept. A missing location
    skips the backup, logs it, and raises the warning event (card: M3), without
    a dialog.
  - Source: spec 02 "Automatic backup".
- **F11 A broken file is skipped**
  - Steps: Put a broken song file, a song with a wrong `format`, and a song with
    a newer `schemaVersion` in `곡\`, next to good ones; start.
  - Expected: The app starts, the good songs load, each broken file is logged
    once and left untouched, one warning event is raised (card: M3), and the
    newer file opens read-only.
  - Source: spec 02 "Schema versions and migration"; spec 08 "Problem states".
- **F12 Save failure**
  - Steps: Make a song file read-only, change the song; make it writable and
    trigger 다시 시도 (or the next change).
  - Expected: The content stays in memory, the save time doesn't change, the
    failure is logged and raises the "저장할 수 없음" warning event (card: M3),
    no dialog opens, and output isn't affected. The retry writes the file.
  - Source: spec 02 "Save failures".
- **F13 Saving never stalls output**
  - Steps: During P-frames(main, 60), write a 10 MB song file 30 times.
  - Expected: The output keeps drawing through every write (no gap in the frame
    record). Frames over 50 ms and the frame counts with and without the writes
    are recorded as observations, since the sources set no number for them.
  - Source: spec 02 ("Saving must never stall output or input"); spec 08.

### L. Library to 예배 순서 to 진행

Sources: MILESTONES criterion 1; `docs/spec/04-show.md` "예배 순서 panel" and
"장 panel"; `SlideThumbnail` README.

- **L1 The song reaches the 예배 순서**
  - Steps: P-library, start.
  - Expected: The app opens the fixture service (`lastServiceId`). The 예배 순서
    list shows the header 찬양, a row with the song icon and the title 만복의
    근원 하나님, and the slot. The files on disk are unchanged by the start,
    unknown fields included.
  - Source: MILESTONES; spec 02 "Service file".
- **L2 Rows and keyboard**
  - Steps: A service with headers, two songs, and a slot. Click rows, use Up,
    Down, Home, and End.
  - Expected: Headers can't be selected and are skipped. A click only selects
    and opens the item's 장 in the 장 panel. Rows show no 장 count in 진행.
  - Source: spec 04 "List"; `ListRow` README.
- **L3 Thumbnails in 구성 order**
  - Steps: Select the song item with the 구성 `주일용` (1, 2, 3, 4, 2, 3, 4, 3,
    4), then with no 구성, then with a 구성 name the song doesn't have.
  - Expected: 9 tiles in that order, with a tile for each repeat; then the file
    order; then the file order again.
  - Source: spec 04 "장 grid"; spec 02 (song item `arrangement`).
- **L4 Tile content**
  - Steps: Inspect each tile.
  - Expected: A 16:9 canvas with only the 장's lines (no background), line
    breaks as stored, text 4.4% of the canvas width, and a 24px band with the
    position (from 1) and the 이름표 name in the 이름표 color; without an
    이름표, only the number on `label-none`. `aria-label` is "number 이름표,
    first line".
  - Source: spec 04; `SlideThumbnail` README.
- **L5 Header**
  - Steps: Look at the 장 panel header with the item on output and not on
    output.
  - Expected: The title and "live position / total" ("2 / 9") for the current
    item, "9장" for another item.
  - Source: spec 04 "Header".
- **L6 Thumbnail size**
  - Steps: Move the slider in each size class; restart.
  - Expected: 2 to 8 columns (right end 2, left end 8), defaults 3, 4, and 6 by
    class, the value saved per class.
  - Source: spec 04; `SlideThumbnail` README; spec 02 `app.json` `columns`.
- **L7 Edits show at once in the grid**
  - Steps: Change the song file's lines through the store while its item is
    open.
  - Expected: The tiles change at once; the output doesn't change until the next
    장 goes out.
  - Source: spec 04 "Editing a song that is on output".
- **L8 A missing song**
  - Steps: Delete the song file that an item points to; start.
  - Expected: The row shows the amber warning icon with the tooltip "곡을 찾을
    수 없습니다", the item has no 장, and nothing else breaks.
  - Source: spec 08 "Problem states".

### O. Output windows

Sources: `docs/spec/03-output.md` "Screens and output windows" and "Turning
screen outputs on and off"; `docs/briefs/output.md`; `ToolbarButton` README.

- **O1 Turning on**
  - Steps: Click 본 화면 on the toolbar.
  - Expected: Its window appears full screen on its assigned fake monitor at
    that monitor's resolution, without taking focus; the button shows the live
    dot and the tooltip "본 화면 출력 끄기 (모니터 2)".
  - Source: spec 03; `ToolbarButton` README.
- **O2 Turning off keeps the window and the state**
  - Steps: Output a 장, turn the output off, then on again. Repeat 200 times
    with P-counters.
  - Expected: Off hides the window and keeps it (the same window and renderer
    process come back). On shows the same 장 at once. The preview keeps the
    picture while off. Window count and memory stay flat.
  - Source: spec 03; output brief task 1.
- **O3 Each screen on its monitor**
  - Precondition: the build lists a 무대 화면 screen. M2's default screen source
    has only the 본 화면; if the build reads `설정\screens.json`, the fixture
    adds one with the 본 화면 on FM2 and the 무대 화면 on FM3. QA asserts the
    two screens in the toolbar and in `llp.live.get()` first; without them, O3,
    X5, and the 무대 화면 part of SK2 are blocked.
  - Steps: Turn on 본 화면 and 무대 화면.
  - Expected: Each window covers its own fake monitor, and turning one on or off
    doesn't touch the other.
  - Source: spec 03; spec 08.
- **O4 Unassigned or absent monitor at launch**
  - Steps: Start with the default screens and only the primary monitor, then
    with the primary monitor and FM2.
  - Expected: The default rule holds (본 화면 on the second monitor, if any);
    with no monitor for a screen, turning it on follows the lost monitor rules
    (X cases) instead of opening on the control monitor in full screen.
  - Source: output brief task 1; spec 03 "Lost monitors".
- **O5 No focus and no cursor**
  - Steps: Turn outputs on while typing in a control window field; move the
    pointer over an output window (CDP mouse events).
  - Expected: The control window keeps keyboard focus; the cursor is hidden over
    a full screen output.
  - Source: spec 03 (proposal).
- **O6 Always on top and prevent sleep**
  - Steps: Read `isAlwaysOnTop()` of each full screen output, and check that a
    power save blocker runs while any output is on (main process inspector).
  - Expected: Both on with the defaults, and the blocker stops when every output
    is off.
  - Source: spec 03; spec 02 (`alwaysOnTop`, `preventSleep` defaults).
- **O7 Nothing on an output but output**
  - Steps: Throw an error in an output window's page (CDP), hover it, and try to
    open its menu or a tooltip.
  - Expected: No dialog, menu, tooltip, or error text; the last picture stays;
    the error is logged.
  - Source: spec 03 "Rules for output windows"; spec 08.
- **O8 Window-method close is off**
  - Steps: For a screen in window mode (after X1), close its window with its
    close button.
  - Expected: That screen's output turns off; the window is hidden, not
    destroyed.
  - Source: spec 03 (proposal).
- **O9 Startup state**
  - Steps: Start with `showOnLaunch` false, then true.
  - Expected: All outputs off, then all on. Whether outputs were on is never
    saved.
  - Source: spec 03; spec 02.
- **O10 Ctrl 1 and Ctrl 2**
  - Steps: Press Ctrl 1 with all off, with only 본 화면 on, and with all on;
    press Ctrl 2.
  - Expected: Ctrl 1 turns the audience outputs (본 화면, 방송 자막) on
    together, turns them all on when they're mixed, and off when all are on;
    Ctrl 2 toggles the 무대 화면. If spec 10 changes these keys before the
    freeze, the case follows it.
  - Source: spec 03 (proposal); `docs/decisions.md` 2026-10-25 (shortcuts follow
    ProPresenter).
- **O11 Output IPC is validated**
  - Steps: From an output window's page, send malformed messages on every
    channel it has (as in M1 D17).
  - Expected: Dropped and logged; nothing changes; output windows can't change
    the live state at all except through the commands the spec allows.
  - Source: `CLAUDE.md` ("Windows hold copies only"); `docs/TECH.md`.

### R. Rendering a 장 over a looping video

Sources: `docs/spec/03-output.md` "Outputting a 장", "Background media", and
"Previews and frame rate"; `docs/briefs/output.md` task 2; `docs/TECH.md`
"Media" and "Memory".

- **R1 The 장 over the video**
  - Steps: P-library with the song's default background `loop-1080p.webm`. Turn
    on 본 화면 and click 장 2.
  - Expected: The 본 화면 shows the lines of 장 2 over the playing video, and
    the tile has the red ring (only that tile, not other tiles of the same 장).
  - Source: MILESTONES criterion 1; spec 04 "장 grid".
- **R2 Within one frame**
  - Steps: P-latency, 100 clicks on random tiles.
  - Expected: Record the median and the 95th percentile. Target: the text
    changes within one frame (about 17 ms) of the click.
  - Source: `docs/TECH.md` "Performance".
- **R3 Lyric style**
  - Steps: Read the text's computed style at 1920×1080 and on FM4.
  - Expected: The default 평상시 Look's 기본 style (Pretendard 700, size 84 at
    1920×1080, line height, centered as spec 02 and the `Looks` board give
    them), scaled by the screen's resolution: on FM4 the text is 168 physical
    pixels (twice 84), whatever the monitor's scale factor.
  - Source: spec 03 "Drawing text"; spec 02 "Lyric style".
- **R4 Line breaks and fit**
  - Steps: Output 장 with 1, 4, 8, and 12 lines, one 300-character line, and
    lines with no spaces.
  - Expected: Line breaks as stored; a long line wraps at word boundaries; when
    lines exceed the maximum or overflow, the font shrinks until everything
    fits; the 장 is never split or cut off.
  - Source: spec 03 "Drawing text".
- **R5 A blank 장**
  - Steps: Output a 장 with no lines.
  - Expected: It becomes the live 장 and draws nothing on the lyrics layer.
  - Source: spec 03.
- **R6 The live 장 again**
  - Steps: Click the live tile again.
  - Expected: No redraw (no DOM change, no transition).
  - Source: spec 03 (proposal).
- **R7 Transitions**
  - Steps: Capture frames while changing 장 and backgrounds.
  - Expected: 장 dissolve over about 0.2 s, backgrounds over about 0.5 s; clears
    happen at once.
  - Source: spec 03 "Transitions" (proposal).
- **R8 Seamless loop**
  - Steps: Play `short-2s.webm` for 10 minutes and capture the frame counter at
    each loop point (P-output screenshots, 60 per second around each loop).
  - Expected: No black frame, no frozen run longer than one source frame, and no
    jump other than last to first, at every one of about 300 loop points.
  - Source: spec 03 "Playback"; `docs/TECH.md` "Media".
- **R9 Same background keeps playing**
  - Steps: Two song items with the same background: output a 장 of the first,
    wait 5 s, output a 장 of the second; then move between 장 of one item.
  - Expected: The video's `currentTime` keeps rising with no restart.
  - Source: spec 03 "Song item background rules".
- **R10 Background rules**
  - Steps: Items with a different background, with an override, and with none.
  - Expected: A different background switches; the override wins over the song's
    default; an item with none keeps the current background.
  - Source: spec 03 "Song item background rules".
- **R11 Playback properties**
  - Steps: Set `end` stop, a range, speed 0.5 and 2, each `fit`, sound on with a
    volume, and an image.
  - Expected: Each applies as spec 03 says; stop holds the last frame; the image
    shows as a still with its fit.
  - Source: spec 03 "Playback"; spec 02 media `props`.
- **R12 A missing or broken video**
  - Steps: Delete the playing file; then output a song whose background file is
    missing; then use a file that isn't a video.
  - Expected: The last frame stays as a still, never black; a missing background
    on output keeps the current background; the marks show as spec 08 says (as
    far as M2 has them); logged, no dialog.
  - Source: spec 08 "Missing media file".
- **R13 A fixed number of video elements**
  - Steps: P-counters; output 500 장 changes and 100 background changes;
    P-counters.
  - Expected: At most three video elements per output window at any time (two
    for the loop and one for the next background); finished videos have no
    `src`; DOM nodes, listeners, and memory return to the baseline.
  - Source: `docs/TECH.md` "Memory"; `CLAUDE.md` ("Create as little as possible
    per slide").
- **R14 Previews use the same drawing**
  - Steps: Compare the 진행 large preview with a capture of the 본 화면 scaled
    to the same width, and read the preview's frame rate.
  - Expected: The same picture (line breaks, positions); the preview draws at
    about 30 fps (`previewFps`).
  - Source: spec 03 "Previews and frame rate".

### K. Clears and undo

Sources: `docs/spec/03-output.md` "Clearing and undo"; `ClearButton` README;
`docs/spec/04-show.md` "Clear row".

- **K1 to K7 Each key clears its layer**
  - Steps: For each of F1 (모두), F2 (가사), F3 (미디어), F4 (소품), F5
    (오디오), F6 (메시지), and F7 (공지): fill the layers, assert in
    `llp.live.get()` that the key's layer has content (the precondition), then
    press the key. Check the output windows, the previews, and `llp.live.get()`.
    The fixtures that fill the layers: lyrics through a click on a 장 of the
    fixture song (`slide.show`), media through the fixture background
    (`media.show`), and 메시지 through `message.show`. M2 has no command that
    fills 소품, 오디오, or 공지; if the build adds one (a live command or a 진행
    control), the case uses it, and otherwise F4, F5, and F7 are blocked, never
    passed on an empty layer.
  - Expected: Only that key's layer goes (all of them for F1), on every screen
    at once, with no confirmation and no message. After F2 there is no live 장.
  - Source: MILESTONES criterion 2; spec 03 table.
- **K8 The same with the buttons**
  - Steps: Repeat K1 to K7 with the 지우기 buttons.
  - Expected: The same results.
  - Source: `ClearButton` README.
- **K9 Bright and dim**
  - Steps: Watch each button's state as layers fill and clear.
  - Expected: Bright (`bg-control`) with something to clear, dim
    (`bg-control-off`, `aria-disabled`, `data-state="off"`) with nothing; a dim
    button and its key do nothing and push no undo; 모두 is bright while any
    layer has something.
  - Source: `ClearButton` README; spec 03.
- **K10 Within one frame**
  - Steps: P-latency for F2 and F1, 100 times each.
  - Expected: Record the times. Target: the output reflects the clear within one
    frame.
  - Source: output brief task 2.
- **K11 What clears don't touch**
  - Steps: Press F1 with outputs on and a current item.
  - Expected: Outputs stay on, the current item stays, and the Look doesn't
    change.
  - Source: spec 03.
- **K12 Keys work everywhere**
  - Steps: Press F1 to F7 with focus in the 예배 순서, in the 장 grid, in the
    toolbar search field, with a dialog and a confirmation dialog open, with a
    menu open, and in each workspace.
  - Expected: Every key clears in every case. → and ← don't move 장 while a text
    field has focus.
  - Source: spec 03; spec 01; `Dialog` and `AlertDialog` READMEs; spec 08.
- **K13 Undo restores the last clear**
  - Steps: Output a 장 and a background, press F2, then Ctrl Z; F3, then Ctrl Z;
    F1, then Ctrl Z.
  - Expected: Each undo brings back exactly what the clear took: the same 장
    (same item and position) as the live 장, the same background from its
    position at the clear, and everything for 모두.
  - Source: MILESTONES criterion 2; spec 03 "Undo".
- **K14 One level only**
  - Steps: F2, F3, then Ctrl Z twice.
  - Expected: The first Ctrl Z restores the media cleared by F3. The second does
    nothing, and 되돌림 shows "nothing to undo". (The reducer at the time of
    writing keeps 20 levels, so this case may fail.)
  - Source: spec 03 ("After an undo, there is nothing left to undo (one level
    only)"); `ClearButton` README ("one step only").
- **K15 New content ends the undo**
  - Steps: F2, click another 장, then Ctrl Z. Then F3, a new background, Ctrl Z.
  - Expected: Neither undo brings back the cleared content, because something
    new went to that layer.
  - Source: spec 03 (proposal: "undo must never cover something new").
- **K16 Undo undoes only clears**
  - Steps: Click a 장, turn an output off, then Ctrl Z.
  - Expected: Nothing changes.
  - Source: spec 03.
- **K17 The 되돌림 button**
  - Steps: Watch 되돌림 before and after a clear and after an undo; use it with
    the mouse.
  - Expected: `bg-toolbar-hover` always; `text` when there is something to undo,
    `text-off` when not; its tooltip "되돌리기 Ctrl Z".
  - Source: `ClearButton` README.
- **K18 Tooltips and names**
  - Steps: Hover each button; read the ARIA tree.
  - Expected: "모두 지우기 F1" and the like, `aria-label`, `aria-keyshortcuts`,
    and `role="group"` named "지우기".
  - Source: `ClearButton` README.
- **K19 Narrow row**
  - Steps: Look at the row in a narrow window.
  - Expected: 40 high, icons only, 모두 1.4 times as wide, names in tooltips.
  - Source: `ClearButton` README; spec 04 "Narrow windows".
- **K20 Random sequences**
  - Steps: 10,000 random commands (장, media, clears, undo, outputs) through the
    IPC, comparing the state after each with a QA model of the spec rules.
  - Expected: No crash, the state always valid, and every difference from the
    model listed.
  - Source: `docs/TECH.md` "Tests" ("random command sequences don't break the
    state").
- **K21 Undo history is capped**
  - Steps: 10,000 clears in a row; P-counters.
  - Expected: Memory stays flat (the undo history has a cap).
  - Source: `CLAUDE.md` ("Cap the size of every cache and list").
- **K22 Real full screen, with the user**
  - Steps: With the user, turn on 본 화면 on the real second monitor, output 장,
    use F1 to F7 and Ctrl Z, and turn it off.
  - Expected: The same as K1 to K13 on a real monitor; the window covers the
    whole monitor, with no task bar or border; nothing remains on the monitor
    after off.
  - Source: MILESTONES.

### P. 진행 workspace

Sources: `docs/spec/04-show.md`; `PreviewFrame`, `SlideThumbnail`, and `Layout`
READMEs.

- **P1 Selected and live rings**
  - Steps: Select a tile with the arrows, then click another.
  - Expected: Blue `ring-selected` on the selected tile, red `ring-live` on the
    live one, live over selected, and the focus ring outside both.
  - Source: spec 04; `SlideThumbnail` README.
- **P2 Grid and list keys**
  - Steps: Tab into the 장 grid, then press ↑, ↓, Enter, ←, →, Space, Page Up,
    and Page Down. Then do the same in the 예배 순서 list, with Home and End.
  - Expected: Tab enters the grid once. In the grid, ↑ and ↓ move the selection
    and Enter outputs the selected tile; ←, →, Space, Page Up, and Page Down are
    the live keys of P3 even with the grid in focus. The list keeps ↑, ↓, Home,
    End, and Enter and passes the same live keys on.
  - Source: spec 10 "Focus precedence" rule 5 (decided, follows ProPresenter),
    which narrows the `SlideThumbnail` README and spec 04 "Keyboard".
- **P3 Next and previous**
  - Steps: Press →, Space, and Page Down, and then ← and Page Up: with no live
    장, from the middle, on the last tile, and on the first tile. Open another
    item in the 장 panel while a 장 of the first item is live, and press →. Hold
    → (one press and repeats). Press → with the toolbar search field in focus,
    after a mouse click on a toolbar button, and with Tab focus on a toolbar
    button (then Space). Press Ctrl ↓, Ctrl ↑, and Ctrl L.
  - Expected: →, Space, and Page Down output the next tile; ← and Page Up the
    previous one. With no live 장, next outputs the first tile of the open item.
    On the last tile, next does nothing (장 넘기기 default 멈춤); on the first
    tile, previous does nothing. With another item open, → outputs that item's
    first tile. A held → moves one 장 (repeats are ignored). In the search field
    the keys stay in the field. A mouse click on a toolbar button doesn't take
    keyboard focus, so Space still moves on; with Tab focus on a button, Space
    presses it. Ctrl ↓ and Ctrl ↑ select the next and previous item that can
    output (skipping headers and slots) without output; Ctrl L opens the live
    item in the 장 panel.
  - Source: spec 10 "Command list" (다음 장, 이전 장, 다음 항목, 이전 항목, 출력
    중인 항목 열기), "Ignore key repeat", "Focus precedence", and the 장 넘기기
    setting (all decided).
- **P4 LIVE badge and current item**
  - Steps: Output 장 from two items in turn; clear lyrics.
  - Expected: The LIVE badge follows the item the live 장 came from. After F2
    the badge goes, and the item stays the current item (spec 01 terms), so the
    next → continues in it.
  - Source: spec 04 "Row states"; spec 01 terms.
- **P5 Done rows**
  - Steps: Start items 1, 2, and 3 in turn.
  - Expected: Items above the current one that started since launch show dim
    text (`data-state="done"`).
  - Source: spec 04 (proposal); `ListRow` README.
- **P6 Previews**
  - Steps: Click each small preview; restart.
  - Expected: One large and two small, the small ones in the order 본 화면, 무대
    화면, 방송 자막 without the large one; the swap has no transition; the large
    one isn't clickable; the choice survives a restart (`previewBig`).
  - Source: spec 04 "Preview panel"; `PreviewFrame` README.
- **P7 Preview states**
  - Steps: Turn outputs off and on; unplug a fake monitor.
  - Expected: Off keeps the picture with a dim name and a `line-strong` frame; a
    lost monitor gives a `warning` frame and target; tooltips give the reasons;
    the 방송 자막 frame is green.
  - Source: `PreviewFrame` README.
- **P8 Caption**
  - Steps: Read the large preview's caption.
  - Expected: Screen name, target with the monitor icon, and the lyric style
    name at the right end (open question 11 in `docs/spec/README.md`).
  - Source: spec 04; `PreviewFrame` README.
- **P9 Short windows**
  - Steps: At 1280×720 and 1536×864, measure the right column.
  - Expected: 진행 도구 keeps at least 240 and the preview shrinks, keeping
    16:9, centered (306, 68, and 240 at 1280×720).
  - Source: `Layout` README "Anatomy".
- **P10 Narrow forms**
  - Steps: Run P1 to P9 at 1366×768.
  - Expected: The narrow forms from spec 04 "Narrow windows" that M2 builds
    (clear row, small previews as 64px rows, 3 columns).
  - Source: spec 04 "Narrow windows".
- **P11 Workspace switches**
  - Steps: Output a 장, then switch to 준비 and 화면 설정 and back.
  - Expected: The output doesn't change; the 진행 selection and grid come back
    as they were.
  - Source: spec 01; spec 08.
- **P12 Long lists stay fast**
  - Steps: A service with 200 items and a song with 150 장; scroll and click.
  - Expected: Only the visible rows and tiles render (`CLAUDE.md`, virtualize
    long lists). Long tasks over 50 ms and the DOM node count are recorded as
    observations.
  - Source: `CLAUDE.md` ("virtualize long lists"); `docs/TECH.md`.

### X. Failure recovery

Sources: MILESTONES criterion 4; `docs/spec/03-output.md` "Lost monitors" and
"When an output window crashes"; `docs/spec/08-problems.md`.

- **X1 Unplug during output**
  - Steps: 무대 화면 on FM3 with a 장 and a playing video; P-unplug(FM3). If M2
    assigns only the 본 화면, use it on FM2 and expect the same words with 본
    화면 and 모니터 2.
  - Expected: The output moves into a window on the control monitor and keeps
    drawing; the 장 and the video position don't break; the toolbar button shows
    the amber dot and icon with the tooltip "무대 화면: 모니터 3을 찾을 수
    없습니다"; the status bar shows "무대 화면 창으로 표시 중"; the preview
    frame is amber; the main process raises the disconnect event for the warning
    "무대 모니터 연결 끊김" with "모니터 3 → 창으로 표시 중" (card: M3).
  - Source: spec 03; spec 08 "Lost monitor".
- **X2 Replug**
  - Steps: After X1, P-plug(FM3).
  - Expected: The output returns to full screen on FM3; the toolbar and status
    bar return to normal; the main process raises the reconnect event for "무대
    모니터 다시 연결됨" (card, its replacing the warning, and its 6-second
    close: M3).
  - Source: spec 03; `Notification` README.
- **X3 The notification actions (M3)**
  - Steps: In X1, click 창 보기, then 모니터 다시 찾기 (with FM3 back in the
    fake list but no event). Runs with the M3 notification host.
  - Expected: 창 보기 brings the fallback window to the front (recorded, not
    focused on the user's screen); 모니터 다시 찾기 reads the list again and
    returns to full screen.
  - Source: spec 03.
- **X4 Off output, unplug**
  - Steps: Unplug FM2 with 본 화면 off; then turn it on.
  - Expected: No disconnect event at the unplug; turning on follows X1.
  - Source: spec 03 (proposal).
- **X5 Other screens unaffected**
  - Steps: With O3's precondition met, unplug FM3 with both outputs on.
  - Expected: Only the 무대 화면 moves to a window; the 본 화면 frame counts
    stay the same.
  - Source: spec 03.
- **X6 The "off" setting**
  - Steps: Set the screen's `onDisconnect` to `"off"`; unplug.
  - Expected: The output turns off and the same warning event is raised (card:
    M3).
  - Source: spec 03 (proposal).
- **X7 Resolution change**
  - Steps: Emit `display-metrics-changed` with FM2 at 1280×720, then at
    3840×2160 and 150%.
  - Expected: The window fits the new bounds; the text scales with the new
    resolution.
  - Source: spec 03 "Finding monitors".
- **X8 Finding the saved monitor**
  - Steps: Restart with FM2's ID changed but its name and resolution the same;
    then with only its position the same.
  - Expected: The screen finds its monitor by name and resolution, then by
    position.
  - Source: spec 03 (proposal).
- **X9 Rapid unplug and replug**
  - Steps: 50 unplug and replug pairs 100 ms apart.
  - Expected: The end state matches the last event; no stray windows; window
    count and memory flat; the events end in the state of the last one (one card
    per monitor: M3).
  - Source: spec 08 "Notifications" (same cause replaces).
- **X10 Output window crash**
  - Steps: P-crash(main) with a 장 and a video showing.
  - Expected: Within 1 second, the window is back on the same target with the
    same 장 and background, the video continuing from its position; a log entry;
    no warning event.
  - Source: spec 08 "Output window crash".
- **X11 Three crashes in a minute**
  - Steps: P-crash(main) three times within one minute.
  - Expected: Restarts stop and the warning event for "본 화면 출력 창을 다시
    띄울 수 없음" is raised (the card and its 다시 시도: M3).
  - Source: spec 08 (proposal).
- **X12 Crash while off**
  - Steps: P-crash on a hidden output window.
  - Expected: It comes back hidden, and turning it on shows the current state.
  - Source: spec 08.
- **X13 Control window crash**
  - Steps: Crash the control window with outputs on (M1 S4).
  - Expected: The outputs keep their picture and frame rate; the control window
    reloads and shows the same state.
  - Source: spec 08 "Control window crash".
- **X14 App force-quit during output**
  - Steps: Outputs on, a 장 and a video showing, a change saved; P-kill.
  - Expected: Every output window closes with the app (no orphan processes); the
    next start opens the last service; every change saved 0.5 s before the kill
    is on disk; the app starts with outputs off and no dialog (the recovery
    dialog is M3).
  - Source: MILESTONES criterion 4; spec 08 "Crash and restart".
- **X15 Recovery record**
  - Steps: While the app runs, read `recovery\live.json` and
    `recovery\session.lock`; change the output state (turn an output on, output
    a 장, change the background) and read the record again after 1.5 s; then
    P-kill, and on another run quit cleanly.
  - Expected: `docs/PLAN.md` phase 2 requires the record, so a missing or stale
    record fails. While the app runs, `session.lock` exists and `live.json`
    parses with the spec 02 fields for what M2 outputs: `savedAt`, `outputs`
    (equal to the live state), `serviceId` and `itemId`, `slide` (song, 구성
    name, position), and `media`. Each change shows in the record within about 1
    s (spec 02 allows batching to once per second). After P-kill, `session.lock`
    remains and `live.json` holds the last state. After a clean quit,
    `session.lock` is gone. The recovery dialog that reads the record is M3.
  - Source: spec 02 "What isn't saved, and the recovery record"; `docs/PLAN.md`
    phase 2.
- **X16 Force-quit during a save**
  - Steps: M1 C18 and F6 with outputs on.
  - Expected: As there; outputs come back off after the start.
  - Source: `docs/TECH.md` "Verification" (failure tests).
- **X17 Deleted media during output**
  - Steps: Delete the playing video file.
  - Expected: As R12.
  - Source: `docs/TECH.md` "Verification".
- **X18 Broken song file**
  - Steps: Break the open song's file on disk while the app runs, then restart.
  - Expected: The running app keeps its copy; the restart skips the file as F11
    says.
  - Source: `docs/TECH.md` "Verification".
- **X19 Exceptions in the output path**
  - Steps: Through CDP, make the output page's render throw for one state (for
    example a state with a broken field sent by a test hook, if one exists),
    then send a good state.
  - Expected: The last good picture stays, the error is logged, the next good
    state draws.
  - Source: `CLAUDE.md` ("An exception in the output path must never stop the
    output").
- **X20 Real unplug, with the user**
  - Steps: With the user, run X1 and X2 by unplugging and replugging the real
    second monitor's cable during output.
  - Expected: As X1 and X2, and nothing appears on the wrong monitor.
  - Source: MILESTONES criterion 4.

### SK. Soak

Sources: MILESTONES criterion 3; `docs/TECH.md` "Memory" and "Verification";
`scripts/README.md` "`npm run soak`".

- **SK1 The app writes the record**
  - Steps: A 5-minute soak run as "Safe launching" describes, then
    `npm run soak -- --minutes 5 --judge <record.jsonl>`.
  - Expected: The record follows the format in `scripts/README.md` (one sample
    per line, `main`, `control`, `gpu`, and `output:<screen id>` processes, and
    each output's fps), and the judge reads it.
  - Source: M2 task (devops); `scripts/README.md`.
- **SK2 60 minutes on fake monitors**
  - Steps: A 60-minute soak run as "Safe launching" describes, with the 본 화면
    on FM2 (and the 무대 화면 on FM3 if O3's precondition is met), the looping
    video, and a 장 change every 5 seconds; P-frames(main) for the last 10
    minutes; P-counters at the start and the end; then
    `npm run soak -- --minutes 60 --judge <record.jsonl>`.
  - Expected: The judge passes (no memory growth in any process). DOM nodes and
    video elements in the output windows are the same at the start and the end.
    The median fps (the judge warns under 58) and frames over 50 ms are recorded
    as observations.
  - Source: MILESTONES criterion 3.
- **SK3 60 minutes on two real monitors, with the user**
  - Steps: As SK2 with the real second monitor and, if the user has one, a
    third, at a time the user picks.
  - Expected: As SK2, and no visible stutter at the loop points (the user
    watches the first and last minutes).
  - Source: MILESTONES criterion 3; `docs/PLAN.md` phase 2.
- **SK4 4K load**
  - Steps: SK2 for 20 minutes with `loop-4k.webm` on FM4, judged with
    `npm run soak -- --minutes 20 --judge <record.jsonl>`.
  - Expected: The judge passes. The fps and memory are recorded.
  - Source: `docs/TECH.md` "Media".
- **SK5 Clears and outputs in the soak**
  - Steps: A 30-minute run that also presses a random clear and undo every 10
    seconds and toggles an output every minute, judged with
    `npm run soak -- --minutes 30 --judge <record.jsonl>`.
  - Expected: The judge passes.
  - Source: `docs/TECH.md` ("keep memory and performance flat over hours of
    use").
- **SK6 The status bar fps**
  - Steps: Compare the status bar's fps with P-frames during SK2; throttle the
    output's CPU (CDP `Emulation.setCPUThrottlingRate`) for 5 s.
  - Expected: Under throttling, the status turns to a warning after 2 s of more
    than 10% below 60 fps and back to normal 2 s after the throttling ends, with
    no flicker (`StatusBar` README). The difference between the status bar's fps
    and P-frames is recorded as an observation.
  - Source: `StatusBar` README; spec 03 "Previews and frame rate".

### G. Gallery, M2 components

Sources: `docs/MILESTONES.md` M2 task (ui); each component's README. The general
cases G1 to G16 of the M1 plan run again on the whole gallery. Each case below
has parts (a), (b), and (c) as in the M1 plan.

- **G40 SlideThumbnail**
  - (a) Lyrics 장 and media 장; default, hover, selected, live, focus, and
    missing media file (alone and with live).
  - (c) `listbox` and `option` with roving Tab, arrows, Enter and Space;
    `data-state` values; `aria-label` "number 이름표, first line"; text at 4.4%
    of the canvas width with stored line breaks; 2 to 8 columns.
- **G41 PreviewFrame**
  - (a) Default and narrow; output on, small cell hover and focus, output off,
    monitor missing; the chroma frame.
  - (c) A small cell swaps with the large one at once; the large one isn't a
    button; `aria-label` "무대 화면 크게 보기" (with the reason when it has a
    state); `data-state`; focus order of the small cells.
- **G42 ClearButton**
  - (a) Each of the eight buttons; something to clear, hover and pressed,
    nothing to clear, undo available, nothing to undo, focus; the narrow row.
  - (c) As K9, K17, and K18.
- **G43 LabelChip**
  - (a) Chip, insert, small 이름표, picker 이름표, color swatch; default, hover
    (colored and none), selected, live, focus, dragging, insert hover and
    pressed, menu open.
  - (c) Horizontal `listbox`; arrows select; Alt with ← or → moves a chip;
    Delete removes it from the 구성; insert has `aria-label="장 넣기"`; the
    picker has `aria-haspopup` and `aria-expanded`; the 2px gap before rings.
- **G44 KeyCap**
  - (a) Key, combination, text shortcut; default, changed, conflict, none,
    recording.
  - (c) Keys are `kbd`; the conflict icon has the tooltip text as its
    `aria-label`; a changed row has `aria-description="바꾼 단축키"`; in the
    recording field Esc cancels and Backspace removes.
- **G45 PropertyRow**
  - (a) Panel row, window row, group name, value; default and control disabled.
  - (c) A click on the name focuses the control and toggles a switch or
    checkbox; Tab skips names and values; groups don't collapse.
- **G46 MediaTile**
  - (a) Grid and strip tiles; video looping, video once, image; default, hover,
    selected, live, focus, missing file, copying.
  - (c) `listbox` and `option`; arrows and Enter; a copying tile is
    `aria-disabled`; `data-state` values; the progress bar's role and value.
- **G47 MacroTile**
  - (a) Tile, new 매크로, list row; default, hover, last run, selected, focus,
    scheduled; list row hover and selected.
  - (c) `listbox` and `option`; Enter and Space run; Shift F10 and the Menu key
    open the right-click menu; `aria-label` with the schedule ("예배 시작,
    10:30에 실행"); `data-state="last-run"`; no `live` color anywhere.
- **G48 Notification**
  - (a) Warning and information cards, the narrow width, a stack of three, close
    states, action buttons.
  - (c) `role="alert"` and `role="status"`; the information card closes after 6
    s and its timer pauses under the pointer or focus; no focus taken; Esc
    doesn't close it; it shows above a dialog's scrim and its buttons work
    there; a fourth card closes the oldest information card; the same cause
    replaces its card.
- **G49 LabelColorPicker**
  - (a) 이름표 color row (none and eight colors) and macro color row; default,
    hover, selected, focus.
  - (c) `radiogroup` and `radio` with `aria-checked` and the color names (청록,
    초록, 노랑, 주황, 분홍, 보라, 남색, 회색, 없음); Tab enters once on the
    selected color; ← and → select at once; a click applies and keeps the menu
    open.

### U. UI tests

- **U1 What they cover**
  - Steps: Read the UI test list.
  - Expected: At least the core flows that `docs/TECH.md` names for phase 2:
    opening a song, output, and clearing.
  - Source: `docs/TECH.md` "Stack" (UI tests) and "Verification".
- **U2 They catch a break**
  - Steps: In the clean clone, break the click-to-output path (for example, make
    the thumbnail's click do nothing) and run the UI tests; restore.
  - Expected: A UI test fails.
  - Source: `docs/TECH.md` "Verification".

### M. M1 regression

- **M1 Regression run**
  - Steps: Rerun M1 cases W1 to W4, W9, W10, C2 to C5, C11, C14, C19, S1, S2,
    S5, and D17 at `m2`.
  - Expected: As in M1.
  - Source: `docs/qa/m1-plan.md`.

## Order of work

1. V, then F and L on the build.
2. O, R, and K on fake monitors.
3. X, then SK2 overnight or while other cases run (it needs no attention).
4. P, G, U, and M.
5. The three cases with the user (K22, X20, SK3), when the lead has arranged
   them.

Blocker and major bugs go to the lead at once.
