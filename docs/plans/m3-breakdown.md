# M3 breakdown (proposal)

This plan splits milestone M3 (`docs/MILESTONES.md`), which is phase 3 of
`docs/PLAN.md` (the prep, output, and tools bundles), into review requests that
the lead can turn into briefs. The lead decides the final owners and briefs.

## Lead decisions in this plan

Recorded from the lead's answers of October 25:

1. **New members:** prep and tools join, starting in wave B. Whether a screens
   member joins is decided when wave B starts, by how far output's M2 work has
   come; until then the fallback stands (output takes the screens tasks last).
2. **Carve-out:** `show/tools/`, `show/quick/`, and `show/bible/` move from
   shell to tools. The ownership table in `docs/MILESTONES.md` changes at the M2
   freeze, not before.
3. **Audio:** audio plays in a hidden audio window owned by output, so a control
   window reload can't stop it. This is our design; no ProPresenter source
   describes where its audio plays.
4. **Bible data:** copible has no offline format (found in M3-W1). The format is
   spec-4 (`docs/spec/02-data.md`, "Bible translations"). M3-T4a waits for
   spec-4 and for the user's choice of text source.
5. **Utility process:** output wires it in `src/main/index.ts` on prep's
   request.
6. **Search budget:** 50 ms for a query over 3,000 songs is a lead decision that
   the user can change.

## How the split works

- **One owner per request.** Each row in "Requests" is one review request with
  one owner, its own scope, and its own dependencies.
- **No two owners touch the same file.** Every task lists the paths it owns.
  Requests of one owner run one after another, stacked, so they can share a
  folder.
- **Contracts first.** `src/shared/` and `src/preload/` belong to data
  (`CLAUDE.md`, "Team member rules"). Every new command, type, or IPC channel
  lands in a data request (M3-D1a to M3-D1c) before the request that uses it.
- **Registries before contracts.** The live reducer switches exhaustively over
  the `LiveCommand` union in `src/shared/commands.ts`, so widening the union
  would break the type check. M3-O0 turns the reducer and the layer renderer
  into registries first; M3-D1b widens the union after it.
- **Mount requests.** When a component has to appear inside another owner's
  file, its owner exports it and the file's owner mounts it in one line ("Mount
  points").
- **Acceptance per request, integration per wave.** A request's acceptance
  criteria test only what that request owns, with fakes where it needs another
  owner's part. Checks that need several requests together are "Integration
  checks", listed in the wave where all their requests are merged.
- **Open questions stay apart.** Parts that depend on the open settings
  questions of `docs/spec/10-shortcuts-and-settings.md` (10 to 18) are separate
  requests (M3-X1, M3-X2) or one constant in the request that uses them.

## Owners

| Owner               | M3 area                                                                                                  | Requests                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| data                | Contracts, app-wide settings stores, text import conversion, search index, stored fields of waiting rows | D1a, D1b, D1c, D2, D3, D4, X1a, X2a                                   |
| output              | Live registries and slices, transactions, recovery, the screen output backend, rendering, audio          | O0, O4, O5, O6a, O6b, O7, O8, O9a, O9b, O10, X1c, X2c                 |
| screens (to decide) | The 화면 설정 UI: screens, the Look editor, the stage layout editor                                      | O1, O2, O3, X1b, X2b (output takes them last if screens doesn't join) |
| shell               | The 진행 workspace around the 장 panel, the toolbar, notifications, the recovery dialog                  | S1a, S1b, S2a, S2b                                                    |
| prep (new)          | The 준비 workspace: library, song editor, item settings, service dialogs, import, media                  | P1, P2a, P2b, P3a, P3b, P4, P5, P6a, P6b                              |
| tools (new)         | The 진행 도구 tabs, 매크로, 퀵 실행, and Bible passages                                                  | T1a, T1b, T2, T3a, T3b, T4a, T4b                                      |
| ui                  | Design system follow-ups from spec-1, spec-2, and spec-5                                                 | U1                                                                    |
| devops              | UI tests and the soak test for M3                                                                        | V1a, V1b                                                              |
| qa                  | The M3 test plan, including the integration checks, and its run                                          | Q1                                                                    |
| spec                | Spec updates as decisions arrive, answers to members' spec questions                                     | W1                                                                    |

## Ownership changes this plan needs

They take effect at the M2 freeze (lead decision 2).

| Path                                                         | Proposed owner | Why                                                                   |
| ------------------------------------------------------------ | -------------- | --------------------------------------------------------------------- |
| `src/renderer/src/prep/`                                     | prep           | New: the 준비 workspace (`docs/PLAN.md` folder structure)             |
| `src/renderer/src/screens/`                                  | screens        | New: the 화면 설정 workspace                                          |
| `src/renderer/src/show/tools/`, `show/quick/`, `show/bible/` | tools          | Carved out of shell's `show/`                                         |
| `src/main/search/`, `src/main/import/`                       | data           | New: the search index and import conversion                           |
| `src/main/media/`                                            | prep           | New: media copy, analysis in the utility process, missing file checks |
| `src/main/macros/`, `src/main/bible/`                        | tools          | New: 매크로 execution, translation files and reference parsing        |

## Requests

| ID  | Owner   | Scope                                                                                                        | Depends on                                   | Wave   |
| --- | ------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ------ |
| O0  | output  | Registry bootstrap for live slices and render layers, no behavior change                                     | M2 rendering (output-2)                      | A      |
| D1a | data    | Contracts for 준비 and content                                                                               | M1 schemas                                   | A      |
| D2  | data    | App-wide settings stores                                                                                     | M2 file store, D1a                           | A      |
| D4  | data    | Search index                                                                                                 | M2 song library, D1a                         | A      |
| U1  | ui      | Design system follow-ups                                                                                     | spec-1, spec-2, spec-5 merged                | A      |
| Q1  | qa      | M3 test plan                                                                                                 | This plan                                    | A      |
| W1  | spec    | Spec updates (first parts done as spec-4 and spec-5)                                                         | None                                         | A      |
| D1b | data    | Live command contracts: content layers, Look, stage, audio, 타이머, `live.batch`, `item.start`               | O0                                           | A      |
| D1c | data    | Screen and recovery contracts: test pattern, monitor numbers, screen setting changes, the recovery interface | O0                                           | A      |
| O9a | output  | Screen output backend: window and capture methods, live screen settings, sleep prevention                    | M2 output windows, D1c, D2                   | B      |
| O9b | output  | Test pattern, monitor numbers, edge margin and offset on the output                                          | O9a                                          | B      |
| O10 | output  | Live transactions (`live.batch`)                                                                             | O0, D1b                                      | B      |
| O4  | output  | Look slice and lyric style rendering                                                                         | O0, D1b, D2                                  | B      |
| O6a | output  | 메시지, 공지, 소품, and stage message slices and layers                                                      | O0, D1b, D2                                  | B      |
| O1  | screens | 화면 설정: screens, display layout, test pattern, properties (UI)                                            | D1c, D2                                      | B      |
| S1a | shell   | 예배 순서 panel, 장 panel header, item start                                                                 | M2 진행, D1a, D1b, D2                        | B      |
| P1  | prep    | 라이브러리 and search                                                                                        | D1a, D4                                      | B      |
| P2a | prep    | Song editor: blocks and 이름표                                                                               | D1a, D2                                      | B      |
| D3  | data    | Text and clipboard import conversion                                                                         | D1a                                          | B      |
| T4a | tools   | Bible data and reference parsing                                                                             | spec-4 merged, the user's source choice, D1a | B      |
| O6b | output  | 타이머 slice                                                                                                 | O6a                                          | C      |
| O5  | output  | 무대 화면 rendering and the stage slice                                                                      | O0, D1b, D2                                  | C      |
| O7  | output  | Audio playback                                                                                               | O0, D1b, D2                                  | C      |
| O8  | output  | Output state recovery backend                                                                                | M2 recovery record, D1c, O6a                 | C      |
| O2  | screens | Look editor                                                                                                  | O1, D2                                       | C      |
| O3  | screens | Stage layout editor                                                                                          | O1, D2                                       | C      |
| S1b | shell   | Toolbar Look menu and search results, media strip, narrow layout                                             | S1a, D1b, D4                                 | C      |
| S2a | shell   | Notifications and problem marks                                                                              | M2 display events, D2                        | C      |
| P2b | prep    | Song editor: header, 구성, preview                                                                           | P2a                                          | C      |
| P3a | prep    | 예배 순서 item panel and 항목 설정                                                                           | S1a, D1a                                     | C      |
| P4  | prep    | Service dialogs and 틀                                                                                       | S1a, D1a                                     | C      |
| T1a | tools   | 진행 도구 tabs: 표시 중, 무대, 메시지                                                                        | O6a, D1b                                     | C      |
| T3a | tools   | 매크로 execution                                                                                             | D1b, O10, D2                                 | C      |
| V1a | devops  | UI tests for wave B and C flows                                                                              | The flows it tests                           | C      |
| S2b | shell   | 출력 상태 복구 dialog                                                                                        | O8, D1c, S2a                                 | D      |
| P3b | prep    | Quick add and dropping songs on the 예배 순서                                                                | P3a, P1                                      | D      |
| P5  | prep    | Text import flow                                                                                             | D3, P2b                                      | D      |
| P6a | prep    | `src/main/media/`: copy, analysis, missing files, relink                                                     | D1a, D2, the utility process (output)        | D      |
| P6b | prep    | Media view                                                                                                   | P6a                                          | D      |
| T1b | tools   | 진행 도구 tabs: 공지, 소품                                                                                   | T1a, O6a                                     | D      |
| T2  | tools   | 진행 도구 tabs: 오디오, 타이머                                                                               | O7, O6b, D1b                                 | D      |
| T3b | tools   | 매크로 tab and action palette                                                                                | T3a                                          | D      |
| T4b | tools   | 퀵 실행 panel and Bible panel                                                                                | T4a, S1a                                     | D      |
| V1b | devops  | UI tests for wave D flows, soak with overlays and audio                                                      | The flows it tests                           | D      |
| X1a | data    | 메시지 style: stored fields                                                                                  | Open question 13                             | Waits  |
| X1b | screens | 메시지 style: Look editor controls                                                                           | X1a, O2                                      | Waits  |
| X1c | output  | 메시지 style: rendering                                                                                      | X1a, O6a                                     | Waits  |
| X2a | data    | Lyric style additions: stored fields                                                                         | The 출처 위치 row of the settings proposal   | Staged |
| X2b | screens | Lyric style additions: Look editor rows                                                                      | X2a, O2                                      | Waits  |
| X2c | output  | Lyric style additions: rendering                                                                             | X2a, O4                                      | Waits  |

## Tasks

Each task lists its requests' scope, the spec sections, the owned paths, and the
acceptance criteria that QA can test without other owners' unmerged parts.
"Spec" numbers are files in `docs/spec/`.

### M3-O0 Registry bootstrap (output)

- **Scope:** replace the reducer's exhaustive `switch` with a registry of
  slices, and the renderer's fixed layers with a registry of layers, with no
  change in behavior.
- **How registration works:**
  - A slice module exports one `defineSlice({commands, initial, reduce})` value:
    the command types it handles, its initial state, and a reducer for those
    commands only.
  - The registry collects the slice modules with an eager `import.meta.glob`
    over `src/main/live/slices/` (electron-vite builds the main process with
    Vite), maps each command type to its slice, and runs one slice per command.
  - A command type that no slice handles is rejected and logged, and the state
    doesn't change. So widening `LiveCommand` in data's contracts never breaks
    the type check or a test; the command works once its slice lands.
  - Layers work the same way: `src/renderer/src/render/layers/` holds one module
    per layer, each exporting its layer kind, its stacking order (03), and its
    component.
- **Spec:** 01 (command path), 03 "Layers and stacking order"; `docs/TECH.md`
  principle 4.
- **Owned paths:** `src/main/live/`, `src/renderer/src/render/`.
- **Depends on:** M2 rendering (output-2).
- **Acceptance:** the existing reducer and store tests pass unchanged; a test
  adds a fake slice and a fake layer as new files in a fixture folder and both
  work without editing any existing file; an unknown command type is rejected,
  logged, and leaves the state and its version unchanged.

### M3-D1a, D1b, D1c Contracts (data)

- **D1a, 준비 and content:** song edits (title, background, blocks, 이름표,
  구성), service and 틀 edits (items, order, item settings, create, import
  items, save as 틀, rename, delete), library search request and result, text
  import result, media list edits (import, playlists, properties, relink,
  delete), the drag payload for songs dropped on the 예배 순서, and reading,
  editing, and subscribing to the app-wide settings files (for M3-D2).
- **D1b, live commands:** Look change, stage layout override, stage message,
  소품 on and off, 공지 start, pause, and stop, 메시지 send with targets and
  display time, 타이머 start, pause, and reset, audio play, pause, next,
  previous, fade out, and volume, 매크로 run, `item.start` (the item ID; the
  main process runs that item's start 매크로 through the 매크로 module when it
  exists), and `live.batch` (a list of commands applied as one transaction).
- **D1c, screens and recovery:** test pattern on and off per screen, show
  monitor numbers, screen setting changes applied live, and the recovery
  interface: `recovery.summary` (the rows that can be restored, from the
  recovery record), `recovery.apply` (the checked rows), and
  `recovery.startFresh`.
- **Spec:** 01 (command path), 02 (file formats), 03, 04, 05, 07, 08.
- **Owned paths:** `src/shared/`, `src/preload/`.
- **Depends on:** M1 schemas; D1b and D1c also on M3-O0.
- **Acceptance (each request):** every new command and IPC message has a schema
  and tests for valid and invalid input; the preload exposes typed functions
  only; a message with a wrong shape is dropped and logged, never applied; the
  type check passes with M3-O0's registry in place.

### M3-D2 App-wide settings stores (data)

- **Scope:** load, validate, save, and broadcast every app-wide settings file in
  02 (`screens.json`, `looks.json`, `stage-layouts.json`, `macros.json`,
  `quick.json`, `messages.json`, `notices.json`, `props.json`, `timers.json`,
  `labels.json`, `bible.json`, the media list), creating missing files with the
  02 defaults.
- **Spec:** 02 "App-wide settings", "Save rules", "Schema versions and
  migration".
- **Owned paths:** `src/main/store/`.
- **Depends on:** M2 file store, M3-D1a.
- **Acceptance:** a first launch creates every file with the 02 defaults; an
  edit survives a restart; a broken file is skipped with a notification event
  while the others load; unknown fields survive a save; a change reaches a
  subscribed window within one second.

### M3-D3 Text and clipboard import conversion (data)

- **Scope:** turn a `.txt` file or clipboard text into a song draft: encoding
  (BOM, UTF-8, CP949 fallback), title rules, 장 나누기, 한 장에 N, 이름표
  detection from bracket lines, trimming. Nothing is written.
- **Spec:** 05 "Text import" ("Reading the text").
- **Owned paths:** `src/main/import/`.
- **Depends on:** M3-D1a.
- **Acceptance:** sample files in UTF-8 with and without a BOM, UTF-16, and
  CP949 give the same 장; each split option gives the expected count; "[후렴]"
  sets the next 장's 이름표 and never becomes a lyric line; a file's title is
  its file name, and clipboard text uses the first line when 첫 줄 is 제목.

### M3-D4 Search index (data)

- **Scope:** an in-memory index of titles, lyrics, and Hangul initial
  consonants, updated when a song changes, built off the main thread or in
  chunks.
- **Spec:** 05 "Search", 04 "Toolbar search"; `docs/TECH.md`.
- **Owned paths:** `src/main/search/`.
- **Depends on:** M2 song library, M3-D1a.
- **Acceptance:** "ㅁㅂㅇ" finds 만복의 근원 하나님; title matches come before
  lyric matches; a query over 3,000 generated songs answers within 50 ms (lead
  decision 6, measured in a test); an edited song is found by its new words at
  once.

### M3-U1 Design system follow-ups (ui)

- **Scope:** the design system changes from spec-1, spec-2, and spec-5: the
  number field step rule, a mouse click in 진행 that doesn't move keyboard
  focus, the 진행 keys of the 장 grid (`SlideThumbnail`), the clear shortcut
  scope (`ClearButton`), keyboard-focus-only keys for `MacroTile` and
  `MediaTile`, and the `KeyCap` key names and reserved keys.
- **Spec:** 10 "Focus precedence", "Reserved keys", "Design system note: number
  field steps"; the ui list in `docs/reviews/spec-5.md`.
- **Owned paths:** `src/renderer/src/ui/`, `design/system/`.
- **Depends on:** spec-1, spec-2, and spec-5 merged.
- **Acceptance:** ↑ in a 0.1-step field turns 0.2 into 0.3, never
  0.30000000000000004; clicking a button in a 진행 test frame leaves keyboard
  focus where it was, while Tab focuses it; the gallery shows the new states.

### M3-O9 Screen output backend (output)

- **O9a scope:** the window method and the capture window method (a window at
  the chosen resolution with the `chroma` background, no minimize button, still
  drawing when covered), applying screen setting changes live (method, device,
  resolution, 항상 위 by method), and preventing display and system sleep while
  any output is on.
- **O9b scope:** the test pattern on a screen's real output, the monitor number
  windows (a large number on each monitor for 3 seconds, never taking focus),
  and the edge margin and position fine-tuning applied to the output picture.
- **Spec:** 03 "Screens and output windows", "Turning screen outputs on and
  off"; 06 "Screens"; 10 "Screens (화면 설정)" inventory.
- **Owned paths:** `src/main/outputs/`, `src/main/windows/`,
  `src/main/displays/`, `src/renderer/src/output/`.
- **Depends on:** M2 output windows; M3-D1c, M3-D2 (`screens.json`).
- **Waits on:** open question 10 (prevent sleep) only for whether a switch
  exists; the behavior (sleep blocked while an output is on) is built either
  way.
- **Acceptance (O9a):** switching a screen to 캡처용 창 opens a window at the
  chosen resolution with the green background, and it keeps updating while
  another window covers it; changing the device moves a full screen output to
  that monitor within a second; Windows doesn't sleep while any output is on and
  may sleep again after the last output turns off.
- **Acceptance (O9b):** the test pattern command shows color bars and a gray
  ramp on that screen's output and the content command restores it; the monitor
  number windows close after 3 seconds and never take focus; an edge margin of
  10 % shrinks the picture toward the center by 10 %.

### M3-O10 Live transactions (output)

- **Scope:** `live.batch` in the live store: the commands of one batch apply in
  order, all clears in it become one undo snapshot, a command that fails (for
  example a missing target) is skipped and logged while the rest apply, and
  listeners get one broadcast for the batch.
- **Spec:** 07 "Running a 매크로"; 03 "Undo".
- **Owned paths:** `src/main/live/` (store and a batch slice).
- **Depends on:** M3-O0, M3-D1b.
- **Acceptance:** a batch with three clears is undone by one undo that restores
  all three layers; a batch with a command for a missing target applies the
  others and logs the skipped one; a batch produces exactly one state broadcast.

### M3-O4 Look slice and lyric style rendering (output)

- **Scope:** the current Look in the live state, Look switching, the visibility
  rule, and drawing 장 text with the lyric style: font with the Pretendard
  fallback, weight, size scaled from 1080, line spacing, alignment, vertical
  position, maximum lines with shrink to fit, margin, shadow and outline as
  switches (06), and the 방송 자막 background color.
- **Spec:** 03 "Looks", "Drawing text"; 10 "Lyric styles and fonts" (font
  rules).
- **Owned paths:** `src/main/live/slices/` (Look), `src/renderer/src/render/`
  (text layer).
- **Depends on:** M3-O0, M3-D1b, M3-D2.
- **Waits on:** open question 12 (transitions): the fixed 03 defaults from one
  constant.
- **Acceptance:** a Look change command changes all three screens at once with
  no transition; content hidden by a Look still counts as something to clear; a
  장 that overflows shrinks and never splits; text keeps its proportions on a
  1280 × 720 and a 3840 × 2160 output; a missing font draws with Pretendard.

### M3-O5 무대 화면 rendering (output)

- **Scope:** the stage slice (layout override until the next Look change, stage
  message) and the stage layout elements (current and next lyrics, current and
  next 이름표, clock, 타이머, stage message) with auto-fit.
- **Spec:** 03 "무대 화면 and stage layouts".
- **Owned paths:** `src/main/live/slices/` (stage), `src/renderer/src/render/`
  (stage layers).
- **Depends on:** M3-O0, M3-D1b, M3-D2.
- **Acceptance:** next lyrics shows the next tile in 구성 order and is empty
  after the last; the clock shows 24-hour time; a layout override lasts until
  the next Look change; turning lyrics off in the Look empties the lyric and
  이름표 elements.

### M3-O6 Overlay slices and layers (output)

- **O6a scope:** live state and rendering for 메시지 (targets, display time),
  공지 (rotation, interval, loop, pause, targets), 소품 (several at once,
  targets), and the stage message, with their clears and undo.
- **O6b scope:** 타이머 state in the main process; output windows compute the
  shown value from the start time, so no message per second.
- **Spec:** 03 "Where 메시지, 공지, 소품, and stage messages go", "Clearing and
  undo"; 04 "타이머".
- **Owned paths:** `src/main/live/slices/` (overlays, timers),
  `src/renderer/src/render/` (overlay layers).
- **Depends on:** M3-O0, M3-D1b, M3-D2; O6b on O6a.
- **Waits on:** open question 13 (메시지 appearance): one fixed default style
  until M3-X1; open question 12 as in M3-O4.
- **Acceptance (O6a):** a 메시지 command with 30 seconds shows only on its
  targets and comes down after 30 seconds; a 공지 advances at its interval and
  stays on the last image without 반복; F4, F6, and F7 clear and undo restores,
  with the 메시지 time left; a 60-minute soak with all overlays shows no memory
  growth.
- **Acceptance (O6b):** a 타이머 keeps running through clears; a countdown past
  0 reports the overrun; the output shows the same value as the main process
  within one second.

### M3-O7 Audio playback (output)

- **Scope:** play audio playlists (order, repeat, next, previous, fade out,
  transition, volume) in a hidden audio window (lead decision 3).
- **Spec:** 04 "오디오"; 03 "Clearing and undo" (F5).
- **Owned paths:** `src/main/windows/` (audio window), `src/main/live/slices/`
  (audio), `src/renderer/src/render/` (audio player).
- **Depends on:** M3-O0, M3-D1b, M3-D2 (media list).
- **Acceptance:** commands play tracks in order and repeat with 반복; F5 fades
  out within 0.5 seconds and undo resumes from the same position; reloading the
  control window doesn't stop the audio; audio plays on the Windows default
  device until the M4 device setting exists.

### M3-O8 Output state recovery backend (output)

- **Scope:** crash detection with `session.lock`, standby at launch after a
  crash, and the recovery interface of M3-D1c: the summary of rows, applying the
  checked rows in order (outputs, live 장 and background, items that were
  showing) without running start or startup 매크로, and starting fresh.
- **Spec:** 08 "Crash and restart"; 02 "What isn't saved, and the recovery
  record".
- **Owned paths:** `src/main/live/recovery/`.
- **Depends on:** M2 recovery record, M3-D1c, M3-O6a (overlays to restore).
- **Acceptance:** with a recovery record and a leftover `session.lock`, launch
  keeps every output off and `recovery.summary` lists the rows that have
  something; `recovery.apply` restores the checked rows in order;
  `recovery.startFresh` starts empty; a record with nothing to restore makes the
  summary empty.

### M3-O1 화면 설정: screens (screens)

- **Scope:** the 화면 설정 workspace frame, the screen list, the display layout
  boxes, 모니터 번호 표시, the output preview with 화면 내용 and 테스트 패턴,
  and the screen properties, sending the M3-D1c commands and editing
  `screens.json` through M3-D2.
- **Spec:** 06 "The 화면 설정 workspace", "Screens"; 10 "Screens (화면 설정)"
  inventory.
- **Owned paths:** `src/renderer/src/screens/` (except `looks/` and `stage/`).
- **Depends on:** M3-D1c, M3-D2.
- **Waits on:** open question 10: the properties leave out the 절전 막기 row.
- **Acceptance:** the display layout shows one box per monitor with its number,
  name, and resolution; changing a property stores its value within the range of
  the 10 inventory; choosing 테스트 패턴 and 화면 내용 sends the test pattern
  commands, and leaving 화면 설정 sends the content command; 모니터 번호 표시
  sends its command.

### M3-O2 Look editor (screens)

- **Scope:** the Look list (add, duplicate, rename, delete with the rules in
  06), the per-screen cards with layer check boxes and style or layout selects,
  and the lyric style section with the rows of 06.
- **Spec:** 06 "Look editor"; 10 "Looks" and "Lyric styles and fonts" inventory,
  except the rows of M3-X2.
- **Owned paths:** `src/renderer/src/screens/looks/`.
- **Depends on:** M3-O1 (frame), M3-D2 (`looks.json`).
- **Acceptance:** the current Look can't be deleted; a style used by a Look
  can't be deleted; every row stores the value and range of the 10 inventory;
  the preview cards draw with the edited values.

### M3-O3 Stage layout editor (screens)

- **Scope:** the 무대 배치 list, the canvas with handles, X, Y, W, H, 비율 고정,
  격자에 맞추기 (20 px), zoom, 요소 추가, and the element properties, with the
  arrow key and Delete keys of 06.
- **Spec:** 06 "Stage layout editor"; 10 "Stage layouts" inventory.
- **Owned paths:** `src/renderer/src/screens/stage/`.
- **Depends on:** M3-O1, M3-D2 (`stage-layouts.json`).
- **Acceptance:** dragging and resizing snap to 20 px with 격자에 맞추기 on;
  arrows move the element 1 px and Shift arrows 10 px; 새 배치 creates "새 배치"
  at 1920 × 1080; edits are stored at once.

### M3-S1 진행 workspace (shell)

- **S1a scope:** the 예배 순서 panel for both workspaces (LIVE badge, done and
  problem states, drag to reorder, delete with edit undo, the 준비 details, the
  drop target for library songs), the header with the service list popover, 다음
  항목 and 이전 항목, the 장 panel header (position, background select, relink
  button), and sending `item.start` when a 장 of another item goes out.
- **S1b scope:** the toolbar Look menu (sends the Look change command), toolbar
  search results, the media strip, and the narrow window layout.
- **Spec:** 04 (except 진행 도구, 퀵 실행, Bible passages), 01 "Toolbar", 05
  "예배 순서 panel in 준비".
- **Owned paths:** `src/renderer/src/shell/`, `src/renderer/src/show/` (except
  `tools/`, `quick/`, `bible/`), `src/renderer/src/control/` (except
  `notifications/` and `recovery/`), `src/renderer/src/state/`.
- **Depends on:** S1a on M2 진행, M3-D1a, M3-D1b (`item.start`), M3-D2; S1b on
  S1a, M3-D1b, M3-D4.
- **Acceptance (S1a):** clicking a 장 of another item sends `item.start` once,
  before the 장's output command (tested with a fake command sink); the LIVE
  badge follows the live 장; reordering and deleting items never sends an output
  command; Ctrl ↓ selects the next item that can output.
- **Acceptance (S1b):** the Look menu lists the Looks with a check on the
  current one and sends the change; a narrow window (1366 × 768) shows the 더
  보기 tabs and collapses the left column; choosing a search result opens the
  song without adding it to the 예배 순서.

### M3-S2 Notifications and recovery dialog (shell)

- **S2a scope:** the notification stack with the rules of 08 (where, how many,
  how long, replace by cause, never take focus), the version 1 notifications,
  and the problem marks for missing media in 진행.
- **S2b scope:** the 출력 상태 복구 dialog: it shows `recovery.summary`, sends
  `recovery.apply` or `recovery.startFresh`, and lets F1 to F7 through.
- **Spec:** 08 "Notifications", "Missing media file", "Crash and restart: 출력
  상태 복구".
- **Owned paths:** `src/renderer/src/control/notifications/`,
  `src/renderer/src/control/recovery/`.
- **Depends on:** S2a on M2 display events and M3-D2 (file skipped events); S2b
  on M3-O8, M3-D1c, S2a.
- **Acceptance (S2a):** a monitor disconnect event shows "무대 모니터 연결 끊김"
  with its two actions, and a reconnect event turns it into the information card
  that closes after 6 seconds; at most three cards show; a missing background
  shows the amber marks and the relink button.
- **Acceptance (S2b):** the dialog lists only the rows the summary returns;
  Enter is 복구 and Esc is 새로 시작; with every row unchecked, 복구 is
  unavailable.

### M3-P1 to M3-P6 준비 workspace (prep)

- **P1, 라이브러리 and search:** the 라이브러리 panel (Korean order, count, 새
  곡, delete with the confirmation), the search field on the index, and songs as
  a drag source. Paths: `src/renderer/src/prep/library/`. Depends on D1a, D4.
  Acceptance: "ㅁㅂㅇ" filters to 만복의 근원 하나님; Esc clears the field and
  Esc on an empty field leaves it; 새 곡 creates "새 곡" (then "새 곡 2") and
  focuses the title; deleting asks with the number of services that use the
  song.
- **P2a, song editor blocks and 이름표:** the block editing rules of 05, Ctrl
  Enter and Ctrl Shift N, the 이름표 chip and menu (colors, new, rename, jump
  key, delete), undo and redo. P2b, header, 구성, preview: the title field with
  its errors, 기본 배경, the two tags, the 구성 row, the preview, the 장 list.
  Paths: `src/renderer/src/prep/editor/`. Depends on D1a, D2; P2b on P2a.
  Acceptance: Enter on an empty line splits the block, and every 구성 keeps
  pointing at the same 장; a color change recolors that 이름표 in every song; an
  empty or duplicate title shows the error ring and isn't saved; renaming a 구성
  updates the items that use it.
- **P3a, item panel and 항목 설정:** the 구성 select, the chip strip (drag, Alt
  ← and Alt →, Delete, 장 넣기), background override, start 매크로, memo, and
  the center panels for Bible, media, 공지, header, and slot items. P3b, quick
  add and drops: the quick add popover and dropping 라이브러리 songs on the 예배
  순서 and on slots. Paths: `src/renderer/src/prep/service/`. Depends on S1a,
  D1a; P3b on P3a, P1. Acceptance: chips with 기본 chosen are read-only with the
  reason in a tooltip; Alt → moves the selected chip one place; quick add
  inserts at the end of the selected group; a song dropped on a song slot fills
  it.
- **P4, service dialogs and 틀:** 새 예배, 다른 예배에서 가져오기, 지금 예배를
  틀로 저장, rename and delete. Paths: `src/renderer/src/prep/services/`.
  Depends on S1a, D1a. Acceptance: creating from a 틀 copies the checked items
  with new IDs and makes the new service current without an output command;
  가져오기 appends the checked items with their headers; 만들기 is unavailable
  while the name is empty; the current service can't be deleted.
- **P5, text import flow:** the 텍스트 가져오기 dialog, the imported song editor
  mode, the duplicate title dialog. Paths: `src/renderer/src/prep/import/`.
  Depends on D3, P2b, and a mount of 파일 > 가져오기 (shell). Acceptance:
  changing an option updates the preview at once; nothing is saved before 저장;
  덮어쓰기 keeps the existing song ID; leaving an unsaved draft asks first.
- **P6a, `src/main/media/`:** copy with progress, analysis in the utility
  process (duration, thumbnail, playability), the missing file check, relink,
  and relinking the other files of the same old folder. P6b, the media view:
  library and playlists, grid and list, properties with the rows of the 10
  inventory, the 정보 tab, the preview player, import, drop from Explorer.
  Paths: `src/main/media/`, `src/renderer/src/prep/media/`. Depends on D1a, D2,
  the utility process wired by output (lead decision 5); P6b on P6a. Waits on
  open questions 14 and 15: copy on and sound off from one constant each.
  Acceptance: a copying tile shows progress and can't be clicked; a file that
  can't play shows the warning icon with the reason; relinking one missing file
  relinks the others from the same old folder.

### M3-T1 to M3-T4 진행 도구, 매크로, 퀵 실행, Bible (tools)

- **T1a, 표시 중, 무대, 메시지 tabs; T1b, 공지, 소품 tabs:** the behavior in 04,
  including 내리기 rows that count as the last clear and the minimal editors
  (plus buttons and right-click menus). Paths: `src/renderer/src/show/tools/`.
  Depends on T1a on O6a, D1b; T1b on T1a, O6a. Acceptance: 보내기 is unavailable
  while a blank is empty or no screen is chosen; turning on 모든 화면 turns the
  other targets off; clicking a 소품 again sends its off command; each tab sends
  the D1b command shapes (tested with a fake command sink).
- **T2, 오디오 and 타이머 tabs:** transport, track list, fade out, volume, 반복;
  타이머 rows with start, pause, reset, and the minimal editor. Paths:
  `src/renderer/src/show/tools/`. Depends on O7, O6b, D1b. Acceptance: clicking
  a track sends its play command; values under an hour show as minutes:seconds;
  a countdown past 0 shows "-".
- **T3a, 매크로 execution:** run the actions in order as one `live.batch`
  (M3-O10), skip missing targets, stop loops (skip a running 매크로, depth 4),
  run startup 매크로 after a normal launch or 새로 시작, and run the start
  매크로 on `item.start`. Action kinds are a registry. Paths:
  `src/main/macros/`. Depends on D1b, O10, D2. Acceptance: a 매크로 whose Look
  was deleted runs its other actions and reports the problem; a 매크로 that runs
  itself stops at depth 4; a 매크로 with three clear actions produces one batch.
- **T3b, 매크로 tab and action palette:** collections, grid and list, tile
  states, 새 매크로, the right-click menu, action add, edit, remove, the
  palette. Paths: `src/renderer/src/show/tools/`. Depends on T3a. Acceptance:
  the right-click menu has the groups of 07; a new 매크로 joins the shown
  collection; deleting asks with the number of items that use it.
- **T4a, Bible data:** load `.llbible` files, the 66-book metadata, book
  matching, the reference grammar, recent passages. Paths: `src/main/bible/`.
  Depends on spec-4 merged, the user's choice of text source (lead decision 4),
  D1a. Acceptance: "요 3:16-18" resolves to 요한복음 3:16-18 with 3 verses; "요
  3장 16-18절" resolves the same; an unknown reference returns the reason; a
  file that fails validation is skipped with a notification event.
- **T4b, 퀵 실행 and Bible panels:** the 퀵 실행 panel (kinds, toggles, add
  menu, drag from the 예배 순서) and the Bible field and panel (suggestions,
  translation, 나누기, 참조, 절 번호, 역본 이름, 장 grid, per-screen view,
  buttons). Paths: `src/renderer/src/show/quick/`,
  `src/renderer/src/show/bible/`. Depends on T4a, S1a, and mounts in the 진행
  layout (shell). Waits on open question 17 (how often the reference shows):
  참조 offers 장마다, 첫 장만, and 없음 from 02, and 마지막 장만 only if the
  user decides so. Acceptance: Enter does the same as 바로 띄우기; the recent
  list keeps 10 passages; 검은 화면 toggles.

### M3-X1 메시지 style (waits on open question 13)

| Request | Owner   | Scope                                                                         | Owned paths                               | Depends on  | Acceptance                                                                                     |
| ------- | ------- | ----------------------------------------------------------------------------- | ----------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| X1a     | data    | The stored fields: a 메시지 style object and where a Look picks it per screen | `src/shared/schema/`                      | Question 13 | A file with the new fields parses and round-trips; a file without them gets the default style. |
| X1b     | screens | The controls in the Look editor                                               | `src/renderer/src/screens/looks/`         | X1a, O2     | Choosing a 메시지 style for one screen stores it for that screen only.                         |
| X1c     | output  | Drawing 메시지 with the chosen style                                          | `src/renderer/src/render/` (메시지 layer) | X1a, O6a    | A 메시지 sent to two screens draws with each screen's style.                                   |

### M3-X2 Lyric style additions

The October 28 decision gives the outline width and color and the shadow blur,
distance, angle, opacity, and color (open decisions entry 26). The 출처 위치
(Bible reference position) row moved into the lyric style in the open settings
proposal; it has no numbered question, and it's separate from how often the
reference shows (question 17, M3-T4b).

| Request | Owner   | Scope                                                                  | Owned paths                       | Depends on            | Acceptance                                                                                                    |
| ------- | ------- | ---------------------------------------------------------------------- | --------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------- |
| X2a     | data    | The stored fields: `outline` and `shadow` objects, `referencePosition` | `src/shared/schema/`              | The settings decision | Old files with Boolean `outline` and `shadow` migrate to the objects; the new fields round-trip.              |
| X2b     | screens | The rows in the Look editor, with the ranges of the 10 inventory       | `src/renderer/src/screens/looks/` | X2a, O2               | Each row stores values within its range; switching outline off keeps its width and color.                     |
| X2c     | output  | Drawing the outline, the shadow, and the reference position            | `src/renderer/src/render/`        | X2a, O4               | A 3 px outline and an 8 px shadow scale with the output resolution; the reference draws where the style says. |

### M3-V1 UI tests and soak (devops)

- **V1a:** Playwright flows for the wave B and C requests as they land (library
  search, song editing, 화면 설정 changes, Look change, 메시지 with a display
  time). **V1b:** wave D flows (text import to save, new service from a 틀,
  매크로 run, recovery after a force-quit) and the soak test with overlays and
  audio.
- **Owned paths:** `test/`, `scripts/` (soak).
- **Acceptance:** the flows run without opening windows on the user's screen;
  the 60-minute soak reports per-process memory and output fps and fails on
  growth.

### M3-Q1 and M3-W1 (qa, spec)

- **Q1:** `docs/qa/m3-plan.md` from the acceptance criteria and the integration
  checks below, then the run on the `m3` tag and the report. Owned paths:
  `docs/qa/`.
- **W1:** spec updates. Done so far: the Bible translation format (spec-4) and
  the decided shortcut rules in the spec files (spec-5). Next: updates as the
  user decides open questions 10 to 18, and answers to members' spec questions.
  Owned paths: `docs/spec/`, `docs/plans/`.

## Integration checks

QA runs each check once all its requests are merged. Each one tests a behavior
that spans owners.

| ID    | Wave | Requests       | Check                                                                                                                                                                                                                                                                                  |
| ----- | ---- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IC-B1 | B    | O9a, O9b, O1   | Assigning a monitor in 화면 설정 moves the output there within a second; 테스트 패턴 shows on the real output and returns on leaving 화면 설정; 모니터 번호 표시 shows numbers for 3 seconds; edge margin and offset move the picture; the capture window takes the chosen resolution. |
| IC-B2 | B    | O4, O6a        | With a Look that hides 메시지 on the 본 화면, a 메시지 sent to all screens shows on the others, and the 메시지 clear button stays bright.                                                                                                                                              |
| IC-C1 | C    | S1a, T3a       | Clicking a 장 of another item runs its start 매크로 before the 장 draws.                                                                                                                                                                                                               |
| IC-C2 | C    | S1b, O4        | The toolbar Look menu changes all three screens at once.                                                                                                                                                                                                                               |
| IC-C3 | C    | T1a, O6a       | Sending a 메시지 with 30초 from the tab shows it on its targets and takes it down after 30 seconds; 내리기 on its row takes it down and undo brings it back.                                                                                                                           |
| IC-C4 | C    | O2, O4; O3, O5 | Editing the current Look or the live stage layout changes the output at once.                                                                                                                                                                                                          |
| IC-D1 | D    | O8, S2b        | After a force-quit during output, the app starts in standby with the dialog; 복구 restores the checked rows; 새로 시작 starts empty and runs startup 매크로; F1 to F7 work while the dialog is open.                                                                                   |
| IC-D2 | D    | T2, O7         | The 오디오 tab controls playback; F5 fades out within 0.5 seconds and undo resumes.                                                                                                                                                                                                    |
| IC-D3 | D    | T3b, T3a, O10  | Undo after a 매크로 with three clear actions, run from its tile, restores all three layers.                                                                                                                                                                                            |
| IC-D4 | D    | T1b, O6a       | Clicking a 소품 again turns it off on its screens; a 공지 started from the tab rotates and F7 stops it.                                                                                                                                                                                |
| IC-D5 | D    | P5, D3, P2b    | A CP949 text file imports, opens in the editor, and saves; a duplicate title asks to overwrite.                                                                                                                                                                                        |

## Order

The lead starts requests as their dependencies merge. The waves group them by
the earliest point they can start.

| Wave | Starts when                                 | Requests                                                       |
| ---- | ------------------------------------------- | -------------------------------------------------------------- |
| A    | Each owner's M2 work is merged              | O0, D1a, D2, D4, U1, Q1, W1; then D1b and D1c after O0         |
| B    | The contracts each request needs are merged | O9a, O9b, O10, O4, O6a, O1, S1a, P1, P2a, D3, T4a              |
| C    | Their wave B dependencies are merged        | O6b, O5, O7, O8, O2, O3, S1b, S2a, P2b, P3a, P4, T1a, T3a, V1a |
| D    | Their wave C dependencies are merged        | S2b, P3b, P5, P6a, P6b, T1b, T2, T3b, T4b, V1b                 |

The longest chains, which set the length of M3:

1. O0 → D1c → O9a → O9b, then IC-B1 with O1.
2. O0 → D1b → O6a → O8 → S2b (recovery, IC-D1).
3. O0 → D1b → O10 → T3a → T3b (매크로, IC-D3).
4. D1a → D3 and P2a → P2b → P5 (import, IC-D5).

## Mount points

| Component                                  | Built by          | Mounted by | Where                                               |
| ------------------------------------------ | ----------------- | ---------- | --------------------------------------------------- |
| 진행 도구 tab panel                        | tools             | shell      | The right column of 진행                            |
| 퀵 실행 panel                              | tools             | shell      | The left column of 진행                             |
| Bible panel                                | tools             | shell      | The center column of 진행, in place of the 장 panel |
| 준비 panels (library, editor, item, media) | prep              | shell      | The 준비 workspace frame                            |
| Service dialogs                            | prep              | shell      | Opened from the service list popover                |
| 파일 > 가져오기 items                      | prep              | shell      | The menu bar                                        |
| 화면 설정 panels                           | screens           | shell      | The 화면 설정 workspace frame                       |
| New main-process modules (`register...`)   | data, prep, tools | output     | `src/main/index.ts`, including the utility process  |
