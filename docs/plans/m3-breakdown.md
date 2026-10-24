# M3 breakdown (proposal)

This plan splits milestone M3 (`docs/MILESTONES.md`), which is phase 3 of
`docs/PLAN.md` (the prep, output, and tools bundles), into tasks that the lead
can turn into briefs. It's a proposal: the lead decides the owners, the new
members, and the ownership changes it asks for.

## How the split works

- **One owner per task, one or two review requests per task.** A task that needs
  two requests names the split.
- **No two tasks touch the same files.** Every task lists the paths it owns.
  Tasks of the same owner run one after another, stacked, so they can share a
  folder; tasks of different owners never share a path.
- **Contracts first.** `src/shared/` and `src/preload/` belong to data
  (`CLAUDE.md`, "Team member rules"). Every new command, type, or IPC channel
  lands in a small data request (M3-D1) before the task that uses it.
- **Registries instead of shared switch statements.** Where several tasks add
  cases to one dispatcher (the live reducer, the layer renderer, the action
  kinds), the first task turns it into a registry, so later tasks add files
  instead of editing one file (`docs/TECH.md`, principle 4).
- **Mount requests.** When a task's component has to appear inside another
  owner's file (a panel in the 진행 layout, a menu item in the menu bar, a
  module in `src/main/index.ts`), the task exports it, and the owner of that
  file mounts it in one line. "Mount points" lists them.
- **Open questions stay apart.** Parts that depend on the open settings
  questions of `docs/spec/10-shortcuts-and-settings.md` (10 to 18) are marked
  "Waits on" and kept in separate tasks or behind one constant, so a decision
  changes one place.

## Owners and new members

| Owner         | M3 area                                                                                 | Tasks                         | Requests (estimate) |
| ------------- | --------------------------------------------------------------------------------------- | ----------------------------- | ------------------- |
| data          | Contracts, app-wide settings stores, text import conversion, search index               | M3-D1 to M3-D4                | 5 to 6              |
| output        | Live state for Looks, overlays, audio, and recovery; rendering on the output screens    | M3-O4 to M3-O8, M3-X1, M3-X2b | 6 to 8              |
| screens (new) | The 화면 설정 workspace: screens, the Look editor, the stage layout editor              | M3-O1 to M3-O3, M3-X2a        | 3 to 5              |
| shell         | The 진행 workspace around the 장 panel, the toolbar, notifications, the recovery dialog | M3-S1, M3-S2                  | 3                   |
| prep (new)    | The 준비 workspace: library, song editor, item settings, service dialogs, import, media | M3-P1 to M3-P6                | 8 to 10             |
| tools (new)   | The 진행 도구 tabs, 매크로, 퀵 실행, and Bible passages                                 | M3-T1 to M3-T4                | 7 to 8              |
| ui            | Design system follow-ups from spec-1 and spec-2                                         | M3-U1                         | 1                   |
| devops        | UI tests and the soak test for M3                                                       | M3-V1                         | 2                   |
| qa            | The M3 test plan and its run                                                            | M3-Q1                         | 1 plus the report   |
| spec          | Spec updates for decided items, answers to members' spec questions                      | M3-W1                         | 1 to 2              |

Where a new member helps most:

1. **prep.** The 준비 workspace is the largest bundle (05 is the longest spec
   file) and has no owner today. Without a new member, ui takes it after M3-U1,
   and M3-P5 and M3-P6 move to the end of M3.
2. **tools.** The 진행 도구 tabs, 매크로, 퀵 실행, and Bible are independent of
   each other and of 준비. Without a new member, shell takes them after M3-S1,
   which roughly doubles shell's M3 length.
3. **screens.** output already owns the most stability-critical code (live
   state, output windows, rendering). Moving the 화면 설정 UI to its own member
   keeps output on the main process and the renderer. Without a new member,
   output takes M3-O1 to M3-O3 last.

`docs/PLAN.md` caps parallel work sessions at three. With the members above, the
lead runs them in the waves under "Order".

## Ownership changes this plan needs

| Path                                                         | Proposed owner | Why                                                                       |
| ------------------------------------------------------------ | -------------- | ------------------------------------------------------------------------- |
| `src/renderer/src/prep/`                                     | prep           | New: the 준비 workspace (`docs/PLAN.md` folder structure)                 |
| `src/renderer/src/screens/`                                  | screens        | New: the 화면 설정 workspace                                              |
| `src/renderer/src/show/tools/`, `show/quick/`, `show/bible/` | tools          | Carved out of shell's `show/`, so that tools and shell never share a path |
| `src/main/search/`                                           | data           | New: the search index                                                     |
| `src/main/import/`                                           | data           | New: import conversion                                                    |
| `src/main/media/`                                            | prep           | New: media copy, analysis in the utility process, missing file checks     |
| `src/main/macros/`                                           | tools          | New: 매크로 execution                                                     |
| `src/main/bible/`                                            | tools          | New: translation files and reference parsing                              |
| `src/main/live/` slices, `src/renderer/src/render/` layers   | output         | Unchanged owner; M3-O4 turns both into registries                         |

## Task list

| ID     | Task                                                      | Owner   | Requests                                                                | Wave                           |
| ------ | --------------------------------------------------------- | ------- | ----------------------------------------------------------------------- | ------------------------------ |
| M3-D1  | Contracts for M3                                          | data    | 2 (D1a 준비 and content, D1b live and tools)                            | A                              |
| M3-D2  | App-wide settings stores                                  | data    | 1 or 2                                                                  | A                              |
| M3-D3  | Text and clipboard import conversion                      | data    | 1                                                                       | B                              |
| M3-D4  | Search index                                              | data    | 1                                                                       | A                              |
| M3-U1  | Design system follow-ups                                  | ui      | 1                                                                       | A                              |
| M3-O1  | 화면 설정: screens, display layout, test pattern          | screens | 1 or 2                                                                  | B                              |
| M3-O2  | Look editor                                               | screens | 1                                                                       | C                              |
| M3-O3  | Stage layout editor                                       | screens | 1                                                                       | C                              |
| M3-O4  | Looks and lyric styles on the output                      | output  | 2 (registries first)                                                    | B                              |
| M3-O5  | 무대 화면 rendering                                       | output  | 1                                                                       | C                              |
| M3-O6  | Overlay layers: 메시지, 공지, 소품, stage message, 타이머 | output  | 2                                                                       | C                              |
| M3-O7  | Audio playback                                            | output  | 1                                                                       | C                              |
| M3-O8  | Output state recovery                                     | output  | 1                                                                       | D                              |
| M3-S1  | 진행 workspace completion                                 | shell   | 2 (S1a 예배 순서 and 장 panel, S1b toolbar, media strip, narrow layout) | B                              |
| M3-S2  | Notifications, problem marks, and the recovery dialog     | shell   | 1                                                                       | D                              |
| M3-P1  | 라이브러리 and search                                     | prep    | 1                                                                       | B                              |
| M3-P2  | Song editor                                               | prep    | 2 (P2a blocks and 이름표, P2b header, 구성, preview)                    | B, C                           |
| M3-P3  | 예배 순서 item settings and adding items                  | prep    | 2                                                                       | C                              |
| M3-P4  | Service dialogs and 틀                                    | prep    | 1                                                                       | C                              |
| M3-P5  | Text import flow                                          | prep    | 1                                                                       | D                              |
| M3-P6  | Media view and media import                               | prep    | 2 (P6a main/media, P6b media view)                                      | D                              |
| M3-T1  | 진행 도구 tabs: 표시 중, 무대, 메시지, 공지, 소품         | tools   | 2                                                                       | B, C                           |
| M3-T2  | 진행 도구 tabs: 오디오, 타이머                            | tools   | 1                                                                       | D                              |
| M3-T3  | 매크로                                                    | tools   | 2 (T3a execution, T3b tab and palette)                                  | C, D                           |
| M3-T4  | 퀵 실행 and Bible passages                                | tools   | 2 (T4a Bible data, T4b panels)                                          | B, D                           |
| M3-X1  | 메시지 style                                              | output  | 1                                                                       | Waits on open question 13      |
| M3-X2a | Lyric style additions in the Look editor                  | screens | 1                                                                       | Waits on open questions 16, 17 |
| M3-X2b | Lyric style additions on the output                       | output  | 1                                                                       | Waits on open questions 16, 17 |
| M3-V1  | UI tests and soak for M3                                  | devops  | 2                                                                       | C, D                           |
| M3-Q1  | M3 test plan and run                                      | qa      | 1                                                                       | A, then after the freeze       |
| M3-W1  | Spec updates                                              | spec    | 1 or 2                                                                  | A                              |

## Tasks

Each task lists its scope, the spec sections it implements, its owned paths,
what it depends on, and acceptance criteria that QA can test. "Spec" numbers are
the files in `docs/spec/`.

### M3-D1 Contracts for M3 (data)

- **Scope:** the commands, types, and IPC channels that every other M3 task
  needs, landed before them.
  - D1a, 준비 and content: song edits (title, background, blocks, 이름표, 구성),
    service and 틀 edits (items, order, item settings, create, import items,
    save as 틀, rename, delete), library search request and result, text import
    result, media list edits (import, playlists, properties, relink, delete),
    and the drag payload for songs dropped on the 예배 순서.
  - D1b, live and tools: Look change, stage layout override, stage message, 소품
    on and off, 공지 start, pause, and stop, 메시지 send (exists) with targets
    and display time, 타이머 start, pause, and reset, audio play, pause, next,
    previous, fade out, and volume, 매크로 run, item start, and the settings
    change events that windows subscribe to.
- **Spec:** 01 (command path), 02 (file formats), 03, 04, 05, 07.
- **Owned paths:** `src/shared/`, `src/preload/`.
- **Depends on:** M1 data-1 to data-4 (schemas, live commands).
- **Acceptance:** every new command and IPC message has a schema and a test for
  valid and invalid input; the preload exposes typed functions only; a command
  sent from the renderer with a wrong shape is dropped and logged, never
  applied.

### M3-D2 App-wide settings stores (data)

- **Scope:** load, validate, save, and broadcast every app-wide settings file in
  02: `screens.json`, `looks.json` (Looks and lyric styles),
  `stage-layouts.json`, `macros.json`, `quick.json`, `messages.json`,
  `notices.json`, `props.json`, `timers.json`, `labels.json`, `bible.json`, and
  the media list. Create missing files with the 02 defaults on first launch.
- **Spec:** 02 "App-wide settings", "Save rules", "Schema versions and
  migration".
- **Owned paths:** `src/main/store/` (settings modules next to the M2 file
  store).
- **Depends on:** M2 file store (atomic writes, recovery copies), M3-D1.
- **Acceptance:** a first launch creates every file with the 02 defaults; an
  edit survives a restart; a broken file is skipped with a notification event
  while the others load; unknown fields survive a save; a change reaches every
  open window within one second.

### M3-D3 Text and clipboard import conversion (data)

- **Scope:** turn a `.txt` file or clipboard text into a song draft: encoding
  (BOM, UTF-8, CP949 fallback), title rules, 장 나누기 (빈 줄, 줄 바꿈, 기호
  with "/"), 한 장에 N, 이름표 detection from bracket lines, trimming. No file
  is written; the draft goes to the import dialog (M3-P5).
- **Spec:** 05 "Text import" ("Reading the text").
- **Owned paths:** `src/main/import/`.
- **Depends on:** M3-D1 (import result type).
- **Acceptance:** sample files in UTF-8 with and without a BOM, UTF-16, and
  CP949 give the same 장; each split option gives the expected count; "[후렴]"
  sets the next 장's 이름표 and never becomes a lyric line; a file's title is
  its file name, and clipboard text uses the first line when 첫 줄 is 제목.

### M3-D4 Search index (data)

- **Scope:** an in-memory index of titles, lyrics, and Hangul initial
  consonants, updated when a song changes, built off the main thread or in
  chunks.
- **Spec:** 05 "Search", 04 "Toolbar search"; `docs/TECH.md` (storage,
  performance).
- **Owned paths:** `src/main/search/`.
- **Depends on:** M2 song library, M3-D1 (search request and result).
- **Acceptance:** "ㅁㅂㅇ" finds 만복의 근원 하나님; title matches come before
  lyric matches, each in title order; a query over 3,000 generated songs answers
  within 50 ms (proposal budget, measured in a test); an edited song is found by
  its new words at once.

### M3-U1 Design system follow-ups (ui)

- **Scope:** the design system changes that spec-1 decided and spec-2 proposes:
  the number field step rule (0.1 steps for seconds), buttons and tiles in 진행
  that don't take keyboard focus on a mouse click, the 진행 keys of the 장 grid
  (`SlideThumbnail` README), and the key names Page Up, Page Down, Home, End,
  and Delete (`KeyCap`).
- **Spec:** 10 "Focus precedence", "Design system note: number field steps"
  (spec-2), "Follow-up work".
- **Owned paths:** `src/renderer/src/ui/`, `design/system/`.
- **Depends on:** spec-1 merged; the step rule needs spec-2.
- **Acceptance:** ↑ in a 0.1-step field turns 0.2 into 0.3 (never
  0.30000000000000004); clicking a button in 진행 leaves keyboard focus where it
  was, while Tab still focuses it; the gallery shows the new states.

### M3-O1 화면 설정: screens, display layout, test pattern (screens)

- **Scope:** the 화면 설정 workspace frame and the screens part: the screen
  list, the display layout boxes, 모니터 번호 표시, the output preview with 화면
  내용 and 테스트 패턴, and the screen properties.
- **Spec:** 06 "The 화면 설정 workspace", "Screens"; 03 "Screens and output
  windows"; 10 "Screens (화면 설정)" inventory.
- **Owned paths:** `src/renderer/src/screens/` (except `looks/` and `stage/`).
- **Depends on:** M2 displays and output windows, M3-D2 (`screens.json`).
- **Waits on:** open question 10 (prevent sleep). The screen properties leave
  out the 절전 막기 row; output prevents sleep while any output is on.
- **Acceptance:** assigning a monitor moves that screen's output there within a
  second; 테스트 패턴 shows on the real output and returns to the content when
  the operator picks 화면 내용 or leaves 화면 설정; 모니터 번호 표시 shows the
  numbers for 3 seconds; changing 가장자리 여백 or 위치 미세 조정 moves the
  picture at once; the capture window takes the chosen resolution.

### M3-O2 Look editor (screens)

- **Scope:** the Look list (add, duplicate, rename, delete with the rules in
  06), the per-screen cards with layer check boxes and style or layout selects,
  and the lyric style section with the rows that 06 defines.
- **Spec:** 06 "Look editor"; 10 "Looks" and "Lyric styles and fonts" inventory,
  except the rows in M3-X2a.
- **Owned paths:** `src/renderer/src/screens/looks/`.
- **Depends on:** M3-O1 (workspace frame), M3-D2 (`looks.json`), M3-O4 (the
  output draws the styles).
- **Acceptance:** toggling a layer for the current Look changes that screen's
  output at once; the current Look can't be deleted; a style used by a Look
  can't be deleted; every row stores the value and range in the 10 inventory.

### M3-O3 Stage layout editor (screens)

- **Scope:** the 무대 배치 list, the canvas with handles, X, Y, W, H, 비율 고정,
  격자에 맞추기 (20 px), zoom, 요소 추가, and the element properties (내용,
  모양, 글자 tabs), with the arrow key and Delete keys of 06.
- **Spec:** 06 "Stage layout editor"; 10 "Stage layouts" inventory.
- **Owned paths:** `src/renderer/src/screens/stage/`.
- **Depends on:** M3-O1, M3-D2 (`stage-layouts.json`), M3-O5 (the 무대 화면
  draws the layout).
- **Acceptance:** dragging and resizing snap to 20 px with 격자에 맞추기 on;
  arrows move the element 1 px and Shift arrows 10 px; editing the layout on the
  무대 화면 updates that output at once; 새 배치 creates "새 배치" at 1920
  × 1080.

### M3-O4 Looks and lyric styles on the output (output)

- **Scope:** turn the live reducer into slice reducers and the renderer into a
  layer registry (first request); then the current Look in the live state, Look
  switching, the visibility rule, and drawing 장 text with the lyric style: font
  with the Pretendard fallback, weight, size scaled from 1080, line spacing,
  alignment, vertical position, maximum lines with shrink to fit, margin,
  shadow, outline, and the 방송 자막 background color.
- **Spec:** 03 "Looks", "Drawing text", "Layers and stacking order"; 10 "Lyric
  styles and fonts" (font rules).
- **Owned paths:** `src/main/live/` (slices), `src/renderer/src/render/` (layer
  registry and the text layer).
- **Depends on:** M2 rendering, M3-D1b (Look change), M3-D2 (`looks.json`).
- **Waits on:** open question 12 (transitions): use the fixed 03 defaults from
  one transition constant until the user decides.
- **Acceptance:** picking a Look changes all three screens at once with no
  transition; content hidden by a Look still counts as something to clear; a 장
  that overflows shrinks and never splits; text keeps its proportions on a 1280
  × 720 and a 3840 × 2160 output; a missing font draws with Pretendard.

### M3-O5 무대 화면 rendering (output)

- **Scope:** draw the stage layout elements (current and next lyrics, current
  and next 이름표, clock, 타이머, stage message) with auto-fit, and apply the
  stage layout priority rule.
- **Spec:** 03 "무대 화면 and stage layouts".
- **Owned paths:** `src/renderer/src/render/stage/`, the stage slice in
  `src/main/live/`.
- **Depends on:** M3-O4 (registries), M3-D1b (stage message, layout override),
  M3-D2 (`stage-layouts.json`).
- **Acceptance:** next lyrics shows the next tile in 구성 order and is empty
  after the last; the clock shows 24-hour time; the layout chosen in the 무대
  tab lasts until the next Look change; turning lyrics off in the Look empties
  the lyric and 이름표 elements.

### M3-O6 Overlay layers (output)

- **Scope:** live state and rendering for 메시지 (targets, display time), 공지
  (rotation, interval, loop, pause, targets), 소품 (several at once, targets),
  the stage message, and 타이머 (state in the main process; output windows
  compute the shown value from the start time, so no message per second).
- **Spec:** 03 "Where 메시지, 공지, 소품, and stage messages go", "Clearing and
  undo"; 04 "타이머".
- **Owned paths:** the overlay and timer slices in `src/main/live/`,
  `src/renderer/src/render/overlays/`.
- **Depends on:** M3-O4, M3-D1b, M3-D2.
- **Waits on:** open question 13 (메시지 appearance): draw 메시지 with one fixed
  default style until M3-X1; open question 12 as in M3-O4.
- **Acceptance:** a 메시지 with 30초 comes down after 30 seconds and only on its
  targets; a 공지 advances at its interval and stays on the last image without
  반복; F4, F6, and F7 clear and undo restores, with the 메시지 time left;
  타이머 keep running through clears; a 60-minute soak with all overlays shows
  no memory growth.

### M3-O7 Audio playback (output)

- **Scope:** play audio playlists (order, repeat, next, previous, fade out,
  transition, volume) where a control window reload can't stop them. Proposal: a
  hidden audio window owned by output, like the output windows.
- **Spec:** 04 "오디오"; 03 "Clearing and undo" (F5).
- **Owned paths:** an audio window in `src/main/windows/`, the audio slice in
  `src/main/live/`, `src/renderer/src/render/audio/`.
- **Depends on:** M3-D1b (audio commands), M3-D2 (media list).
- **Acceptance:** tracks play in order and repeat with 반복; F5 fades out within
  0.5 seconds and undo resumes from the same position; reloading the control
  window doesn't stop the audio; audio plays on the Windows default device until
  the M4 device setting exists.

### M3-O8 Output state recovery (output)

- **Scope:** crash detection with `session.lock`, standby at launch after a
  crash, and applying the checked rows in order (outputs, live 장 and
  background, items that were showing), without running start or startup 매크로.
- **Spec:** 08 "Crash and restart"; 02 "What isn't saved, and the recovery
  record".
- **Owned paths:** `src/main/live/recovery/`.
- **Depends on:** M2 recovery record, M3-O6 (overlays to restore), M3-S2 (the
  dialog).
- **Acceptance:** after the app is force-quit during output, it restarts with
  every output off and the dialog open; 복구 restores what was checked; 새로
  시작 starts empty and runs startup 매크로; F1 to F7 work while the dialog is
  open; a record with nothing to restore launches normally without the dialog.

### M3-S1 진행 workspace completion (shell)

- **Scope:**
  - S1a: the 예배 순서 panel for both workspaces (LIVE badge, done and problem
    states, drag to reorder, delete with edit undo, the 준비 details, the drop
    target for library songs), the header with the service list popover (search,
    entries that open the M3-P4 dialogs), item start through the item start
    command (which runs the start 매크로 in the main process), 다음 항목 and
    이전 항목, and the 장 panel header (position, background select, relink
    button for a missing file).
  - S1b: the toolbar Look menu, toolbar search results (진행 opens the song in
    the 장 panel; 준비 selects it in the 라이브러리), the media strip, and the
    narrow window layout (더 보기 tabs, collapsing the left column).
- **Spec:** 04 (except 진행 도구, 퀵 실행, Bible passages), 01 "Toolbar", 05
  "예배 순서 panel in 준비".
- **Owned paths:** `src/renderer/src/shell/`, `src/renderer/src/show/` (except
  `tools/`, `quick/`, `bible/`), `src/renderer/src/control/` (except the M3-S2
  folders), `src/renderer/src/state/`.
- **Depends on:** M2 진행 workspace, M3-D1a, M3-D2, M3-D4 (search).
- **Acceptance:** clicking a 장 of another item starts it and runs its start
  매크로 before the 장 draws; the LIVE badge follows the live 장; reordering and
  deleting items never changes the output; a narrow window (1366 × 768) shows
  the 더 보기 tabs and collapses the left column; choosing a search result opens
  the song without adding it to the 예배 순서.

### M3-S2 Notifications, problem marks, and the recovery dialog (shell)

- **Scope:** the notification stack with the rules of 08 (where, how many, how
  long, replace by cause, never take focus), the version 1 notifications, the
  problem marks for missing media in 진행, and the 출력 상태 복구 dialog wired
  to M3-O8.
- **Spec:** 08 "Notifications", "Missing media file", "Crash and restart: 출력
  상태 복구".
- **Owned paths:** `src/renderer/src/control/notifications/`,
  `src/renderer/src/control/recovery/`.
- **Depends on:** M2 display events, M3-O8 (restore), M3-D2 (file skipped
  events).
- **Acceptance:** unplugging a monitor shows "무대 모니터 연결 끊김" with its
  two actions, and reconnecting turns it into the information card that closes
  after 6 seconds; at most three cards show; a missing background file shows the
  amber marks and the relink button; the recovery dialog's Enter is 복구 and Esc
  is 새로 시작.

### M3-P1 라이브러리 and search (prep)

- **Scope:** the 라이브러리 panel (Korean order, count, 새 곡, delete with the
  confirmation), the search field on the index, and dragging songs to the 예배
  순서.
- **Spec:** 05 "라이브러리".
- **Owned paths:** `src/renderer/src/prep/library/`.
- **Depends on:** M3-D1a, M3-D4, M3-S1a (drop target).
- **Acceptance:** "ㅁㅂㅇ" filters to 만복의 근원 하나님; Esc clears the field
  and Esc on an empty field leaves it; 새 곡 creates "새 곡" (then "새 곡 2")
  and focuses the title; deleting a song asks with the number of services that
  use it, and those items then show the problem mark.

### M3-P2 Song editor (prep)

- **Scope:**
  - P2a: blocks with the editing rules of 05 (Enter, split on an empty line,
    merge with Backspace, paste with blank lines), the 이름표 chip and menu
    (list, colors, new 이름표, rename, jump key, delete), undo and redo.
  - P2b: the header (title field with its errors, 기본 배경 select, the two
    tags), the 구성 row (segments, add, rename, delete, with item updates), the
    preview with the screen segmented control, and the 장 list.
- **Spec:** 05 "Song editor".
- **Owned paths:** `src/renderer/src/prep/editor/`.
- **Depends on:** M3-D1a, M3-D2 (`labels.json`), M2 ui components.
- **Acceptance:** Enter on an empty line splits the block, and every 구성 keeps
  pointing at the same 장; a color change in the 이름표 menu recolors that
  이름표 in every song at once; an empty or duplicate title shows the error ring
  and isn't saved; renaming a 구성 updates the items that use it.

### M3-P3 예배 순서 item settings and adding items (prep)

- **Scope:** the item panel (구성 select, chip strip with drag, Alt ← and Alt →,
  Delete, 장 넣기), the 항목 설정 panel (background override, start 매크로,
  memo), the center panels for Bible, media, 공지, header, and slot items, and
  quick add (search, other items, slots).
- **Spec:** 05 "예배 순서 item settings", "Adding items to the 예배 순서".
- **Owned paths:** `src/renderer/src/prep/service/`.
- **Depends on:** M3-S1a, M3-P1 (drag source), M3-D1a.
- **Acceptance:** chips with 기본 chosen are read-only with the reason in a
  tooltip; Alt → moves the selected chip one place; quick add inserts at the end
  of the selected group; dropping a song on a song slot fills it.

### M3-P4 Service dialogs and 틀 (prep)

- **Scope:** 새 예배 (빈 예배, 틀, 지난 예배, the check tree, name, date, time),
  다른 예배에서 가져오기, 지금 예배를 틀로 저장 with the overwrite confirmation,
  and rename and delete for services and 틀.
- **Spec:** 05 "New service", "Importing from another service", "Saving the
  current service as a 틀".
- **Owned paths:** `src/renderer/src/prep/services/`.
- **Depends on:** M3-D1a, M3-S1a (the service list opens these dialogs).
- **Acceptance:** creating from a 틀 copies the checked items with new IDs and
  makes the new service current without changing the output; 가져오기 appends
  the checked items with their headers; 만들기 is unavailable while the name is
  empty; the current service can't be deleted.

### M3-P5 Text import flow (prep)

- **Scope:** the 텍스트 가져오기 dialog (option bar, title, preview grid,
  버리기, 편집), the imported song editor mode (버리기, 저장, no autosave), and
  the duplicate title dialog (덮어쓰기, 새 곡으로 저장, 취소).
- **Spec:** 05 "Text import" ("Import dialog", "Editing an imported song").
- **Owned paths:** `src/renderer/src/prep/import/`.
- **Depends on:** M3-D3, M3-P2 (the editor's imported mode), and a mount of the
  파일 > 가져오기 items in the menu bar (shell).
- **Acceptance:** changing an option updates the preview at once; 편집 opens the
  draft in 준비 and nothing is saved before 저장; 덮어쓰기 keeps the existing
  song ID; 새 곡으로 저장 appends " (2)"; leaving an unsaved draft asks first.

### M3-P6 Media view and media import (prep)

- **Scope:**
  - P6a, `src/main/media/`: copy into the media folder with progress, analysis
    in the utility process (duration, thumbnail, playability), the missing file
    check at launch, relink, and relinking the other files of the same old
    folder.
  - P6b, the media view: library and playlists, grid and list, the properties
    tab with the rows of the 10 inventory, the 정보 tab, the preview player,
    import, drop from Explorer, and the right-click menu.
- **Spec:** 05 "Media view"; 08 "Missing media file"; 10 "Media properties"
  inventory.
- **Owned paths:** `src/main/media/`, `src/renderer/src/prep/media/`.
- **Depends on:** M3-D1a, M3-D2 (media list), the utility process (devops or
  output for its wiring).
- **Waits on:** open questions 14 (sound of new videos) and 15 (copy on import).
  Build with the proposal (copy on, sound off) from one constant each; the
  switches come with the M4 settings window.
- **Acceptance:** a copying tile shows progress and can't be clicked; a file
  that can't play shows the warning icon with the reason; a missing file shows
  hatching, and relinking one file relinks the others from the same old folder;
  property changes apply live to media on output.

### M3-T1 진행 도구 tabs: 표시 중, 무대, 메시지, 공지, 소품 (tools)

- **Scope:** the five tabs with their behavior in 04, including 내리기 rows that
  count as the last clear, the stage message field and presets, 메시지 templates
  with blanks and targets, 공지 sets, the 소품 grid, and the minimal editors 04
  proposes (plus buttons and right-click menus).
- **Spec:** 04 "진행 도구" (표시 중, 무대, 메시지, 공지, 소품).
- **Owned paths:** `src/renderer/src/show/tools/` (showing, stage, messages,
  notices, props).
- **Depends on:** M3-D1b, M3-D2, M3-O6 (the output draws them), and a mount of
  the tab panel in the 진행 layout (shell).
- **Waits on:** open question 13 for anything that styles a 메시지.
- **Acceptance:** 보내기 is unavailable while a blank is empty or no screen is
  chosen; turning on 모든 화면 turns the other targets off; clicking a 소품
  again turns it off; 내리기 on a 메시지 row takes it down from all its targets,
  and undo brings it back.

### M3-T2 진행 도구 tabs: 오디오, 타이머 (tools)

- **Scope:** the 오디오 tab (playlist select, track list, transport, fade out,
  volume, 반복) and the 타이머 tab (rows by kind, start, pause, reset, the
  minimal editor).
- **Spec:** 04 "오디오", "타이머"; 10 "Other objects" (타이머 rows).
- **Owned paths:** `src/renderer/src/show/tools/` (audio, timers).
- **Depends on:** M3-O7, M3-O6 (timer state), M3-D1b.
- **Acceptance:** clicking a track plays it at once; 페이드 아웃 lowers the
  sound over 3 seconds and stops; a countdown past 0 shows the overrun with "-";
  values under an hour show as minutes:seconds.

### M3-T3 매크로 (tools)

- **Scope:**
  - T3a, `src/main/macros/`: run the actions in order through the command path,
    skip missing targets, stop loops (skip a running 매크로, depth 4), count all
    clears of one run as one undo, run startup 매크로 after a normal launch or
    새로 시작, and run the start 매크로 when an item starts. The action kinds
    are a registry.
  - T3b, the 매크로 tab: collections, grid and list views, tile states, the 새
    매크로 tile, the right-click menu, action add, edit, and remove, and the
    action palette.
- **Spec:** 07.
- **Owned paths:** `src/main/macros/`, `src/renderer/src/show/tools/` (macros).
- **Depends on:** M3-D1b (매크로 run, item start), M3-D2 (`macros.json`), the
  commands each action sends.
- **Acceptance:** a 매크로 whose Look was deleted runs its other actions and
  shows the problem mark; a 매크로 that runs itself stops at depth 4; undo after
  a 매크로 with three clear actions restores all three layers; startup 매크로
  don't run after 복구.

### M3-T4 퀵 실행 and Bible passages (tools)

- **Scope:**
  - T4a, `src/main/bible/`: translation files (개역한글, KJV), the reference
    parser ported from copible, verse lookup offline, recent passages.
  - T4b: the 퀵 실행 panel (kinds, toggles, add menu, drag from the 예배 순서,
    rename, delete) and the Bible field and panel (suggestions, translation,
    나누기, 참조, 절 번호, 역본 이름, 장 grid, per-screen view, the buttons).
- **Spec:** 04 "퀵 실행", "Bible passages"; 02 "Bible translations".
- **Owned paths:** `src/main/bible/`, `src/renderer/src/show/quick/`,
  `src/renderer/src/show/bible/`.
- **Depends on:** M3-D1, M3-D2 (`quick.json`, `bible.json`), and mounts of the
  퀵 실행 panel and the Bible panel in the 진행 layout (shell).
- **Waits on:** open question 17 (Bible reference options): build every, first
  only, and none from 02; add "last only" if the user decides so. README open
  question 4 (the copible data format) must be answered before T4a.
- **Acceptance:** "요 3:16-18" opens 요한복음 3:16-18 with 3 장; an unknown
  reference shows the error ring with the reason; Enter does the same as 바로
  띄우기; 검은 화면 toggles and F4 takes it down; the recent list keeps 10
  passages.

### M3-X1 메시지 style (output)

- **Waits on:** open question 13. Once decided: the 메시지 style rows, where
  they are chosen, and their rendering. Until then, M3-O6 draws 메시지 with one
  fixed default.

### M3-X2a Lyric style additions in the Look editor (screens)

- **Waits on:** open questions 16 (outline and shadow detail) and 17 (the Bible
  reference position in the lyric style). Once decided: those rows in the Look
  editor, in `src/renderer/src/screens/looks/`. Until then, M3-O2 builds the
  switches that 06 defines.

### M3-X2b Lyric style additions on the output (output)

- **Waits on:** the same questions. Once decided: drawing those rows, in
  `src/renderer/src/render/`. Until then, M3-O4 draws the switches that 06
  defines.

### M3-V1 UI tests and soak for M3 (devops)

- **Scope:** Playwright flows for the M3 features as they land (text import to
  save, new service from a 틀, library search, Look change, 매크로 run, 메시지
  with a display time, recovery after a force-quit), and the soak test extended
  with overlays and audio.
- **Owned paths:** `test/`, `scripts/` (soak).
- **Depends on:** the tasks it tests; it grows request by request.
- **Acceptance:** the flows run in `npm run verify` or a separate UI test
  command without opening windows on the user's screen; the 60-minute soak with
  overlays and audio reports per-process memory and output fps and fails on
  growth.

### M3-Q1 M3 test plan and run (qa)

- **Scope:** `docs/qa/m3-plan.md` from these acceptance criteria and the spec,
  then the run on the `m3` tag and the report.
- **Owned paths:** `docs/qa/`.

### M3-W1 Spec updates (spec)

- **Scope:** update 02, 03, 04, and 06 for the decided shortcut part of 10, move
  the answered README open questions, and answer members' spec questions during
  M3. When the user decides open questions 10 to 18, update 10 and the affected
  task notes here.
- **Owned paths:** `docs/spec/`, `docs/plans/`.

## Order

The lead starts tasks in waves as M2 work frees people. Within a wave, tasks of
different owners run in parallel; tasks of one owner run in the order listed.

| Wave | Tasks                                                                                 | Starts when                               |
| ---- | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| A    | M3-D1, M3-D2, M3-D4, M3-U1, M3-Q1 (plan), M3-W1                                       | Each owner's M2 work is merged            |
| B    | M3-O1, M3-O4, M3-S1a, M3-P1, M3-P2a, M3-T1 (first tabs), M3-T4a, M3-D3                | The contracts they use (M3-D1) are merged |
| C    | M3-O2, M3-O3, M3-O5, M3-O6, M3-O7, M3-S1b, M3-P2b, M3-P3, M3-P4, M3-T1, M3-T3a, M3-V1 | Their wave B dependencies are merged      |
| D    | M3-O8, M3-S2, M3-P5, M3-P6, M3-T2, M3-T3b, M3-T4b, M3-V1                              | Their wave C dependencies are merged      |

The longest chains, which set the length of M3:

1. M3-D1 → M3-D2 → M3-O4 → M3-O6 → M3-O8 and M3-S2 (recovery).
2. M3-D1 → M3-S1a → M3-P3 (item settings need the 예배 순서 panel).
3. M3-D3 and M3-P2 → M3-P5 (import needs the converter and the editor).

## Mount points

Each mount is one line in the owner's file, requested when the component is
ready.

| Component                                  | Built by          | Mounted by | Where                                               |
| ------------------------------------------ | ----------------- | ---------- | --------------------------------------------------- |
| 진행 도구 tab panel                        | tools             | shell      | The right column of 진행                            |
| 퀵 실행 panel                              | tools             | shell      | The left column of 진행                             |
| Bible panel                                | tools             | shell      | The center column of 진행, in place of the 장 panel |
| 준비 panels (library, editor, item, media) | prep              | shell      | The 준비 workspace frame                            |
| Service dialogs                            | prep              | shell      | Opened from the service list popover                |
| 파일 > 가져오기 items                      | prep              | shell      | The menu bar                                        |
| 화면 설정 panels                           | screens           | shell      | The 화면 설정 workspace frame                       |
| New main-process modules (`register...`)   | data, prep, tools | output     | `src/main/index.ts`                                 |

## Open questions for the lead

| #   | Question                                                                      | What this plan assumes                                                           |
| --- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Add the prep, tools, and screens members?                                     | Yes for prep and tools; screens if output's M2 work runs late.                   |
| 2   | Carve `show/tools/`, `show/quick/`, and `show/bible/` out of shell's `show/`? | Yes, for tools.                                                                  |
| 3   | Where does audio play?                                                        | A hidden audio window owned by output, so a control window reload can't stop it. |
| 4   | The copible Bible data format (README open question 4)                        | M3-T4a waits for it.                                                             |
| 5   | Who wires the utility process for media analysis?                             | output (it owns `src/main/index.ts`), on prep's request.                         |
| 6   | Search budget of 50 ms for 3,000 songs                                        | A proposal; the lead or the user may set another number.                         |
