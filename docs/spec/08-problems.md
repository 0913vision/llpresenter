# 08. Problems and recovery

This document defines how the app shows and handles problems: a lost monitor, a
missing media file, a crashed output window, and a crash with the 출력 상태 복구
(output state recovery) dialog. It also defines notification behavior and what
must never happen during a service.

Terms: 출력 (output), 지우기 (clear), 장 (slide), 예배 순서 (service order), 본
화면 (main screen), 무대 화면 (stage screen), 방송 자막 (broadcast captions),
소품 (prop), 공지 (notice), 메시지 (message), 매크로 (macro), 진행 도구 (show
tools). See 01.

## Problem states

| Problem                    | Where it shows                                                                                                                         | What keeps working                                      | How the operator fixes it                                                                 | Source                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------- |
| Output monitor lost        | Toolbar button (amber dot and icon), status bar ("무대 화면 창으로 표시 중"), amber outline on the preview frame, warning notification | The output continues in a window on the control monitor | 모니터 다시 찾기 (find monitor again), 창 보기 (show window), or reconnecting the monitor | `Problems`                       |
| Media file missing         | Media tile, background select in the 장 panel header, 예배 순서 row, 표시 중 row                                                       | The output holds a still frame                          | Clicking the tile, or 다시 연결 (relink)                                                  | `Problems`, `MediaTile` README   |
| Output window crashed      | Log file. A notification only if the restart fails (proposal).                                                                         | The main process opens the window again                 | Automatic                                                                                 | `docs/TECH.md` process structure |
| Control window crashed     | Nothing on the outputs                                                                                                                 | The outputs keep their picture                          | The main process reloads the control window (proposal)                                    | `docs/TECH.md`                   |
| App crashed                | 출력 상태 복구 dialog at the next launch                                                                                               | Songs, services, and settings are already saved         | 복구 (restore) or 새로 시작 (start fresh)                                                 | `Recovery`                       |
| Frame rate dropped         | Status bar, amber dot and text ("방송 자막 41fps")                                                                                     | Output continues                                        | None in the UI. The cause needs a fix in the app.                                         | `StatusBar` README               |
| Save failed                | Warning notification "저장할 수 없음" (can't save) (proposal)                                                                          | The content stays in memory                             | 다시 시도 (try again)                                                                     | 02                               |
| File can't be read         | Warning notification, and a log entry                                                                                                  | The app skips that file and keeps running               | Fix or remove the file                                                                    | `docs/TECH.md` storage           |
| Song of an item is missing | Warning icon on the 예배 순서 row, tooltip "곡을 찾을 수 없습니다" (song not found). The item has no 장 (proposal).                    | Other items                                             | Fill the item again or delete it                                                          | Proposal                         |

## Lost monitor

03 defines the behavior. In short:

1. The output moves into a window on the control monitor, if the screen's 연결이
   끊기면 (when disconnected) setting is 창으로 바꾸기 (switch to a window).
2. The toolbar, the status bar, and the preview frame show the problem.
3. A warning notification appears:

| Part    | Content                                                      |
| ------- | ------------------------------------------------------------ |
| Icon    | Plug icon, amber                                             |
| Title   | "무대 모니터 연결 끊김" (stage monitor disconnected)         |
| Time    | "11:24"                                                      |
| Detail  | "모니터 3 → 창으로 표시 중" (monitor 3, showing in a window) |
| Actions | 모니터 다시 찾기 (find monitor again), 창 보기 (show window) |

4. When the monitor comes back, the output returns to full screen on it, and the
   card turns into the information notification "무대 모니터 다시 연결됨" (stage
   monitor reconnected), which closes after 6 seconds.

Source: `Problems`, `Notification` README, `ToolbarButton` README.

## Missing media file

### Detecting it

- Check that the file exists when the app loads the media list, and again when a
  file fails to play (proposal for the launch check).

### Showing it

| Place                                                | Look                                                                        | Tooltip                                                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Media tile (media strip, media view)                 | Hatched frame with an amber file icon. The picture and duration are hidden. | "파일을 찾을 수 없습니다: D:\예배 미디어\배경\따뜻한 빛.mp4" (file not found, with the path)             |
| Background select in the 장 panel header             | Amber file icon before the name, and a 다시 연결 button                     | "배경 파일을 찾을 수 없음" (background file not found)                                                   |
| 예배 순서 row                                        | Amber warning icon after the name                                           | "미디어 파일 없음" (media file missing)                                                                  |
| 장 thumbnail with an image (for example 공지 images) | Hatched canvas with an amber file icon                                      | The path, as above                                                                                       |
| 표시 중 row and preview of a background that froze   | Pause icon                                                                  | "배경 영상 파일을 찾을 수 없어 정지 화면으로 표시 중" (background video file not found, showing a still) |

- A missing media file doesn't open a notification card. It shows in place
  (`Notification` README).
- Don't add text such as "파일 없음" (file missing) under a tile.

### Output

- If the file disappears while it plays, keep the last frame on the screens as a
  still. The output never turns black because of a missing background.
- If the file is missing when the operator outputs it, keep the current
  background unchanged, and show the problem marks (proposal).

### Relinking

- Clicking a missing tile, choosing 다시 연결 in its right-click menu, or
  clicking the 다시 연결 button opens a file dialog.
- The chosen file replaces the path of that media ID. Every song and item that
  uses the media ID works again.
- If that media is the current background, playback starts again from the
  beginning (proposal).

Source: `Problems`, `MediaTile` README, `SlideThumbnail` README, `ListRow`
README, `Notification` README.

## Output window crash

- When an output window's renderer process dies (`render-process-gone`), the
  main process opens the window again on the same target within 1 second and
  sends it the current output state (proposal for the time). A background plays
  again from its current position (proposal).
- Write a log entry. Don't show a notification if the restart works (proposal).
- If the same output window dies 3 times within one minute, stop restarting it
  and show the warning notification "본 화면 출력 창을 다시 띄울 수 없음" (can't
  reopen the main screen output window) with 다시 시도 (try again) (proposal).
- Output windows never show error UI of their own. On a drawing error, they keep
  the last good picture.

## Control window crash (proposal)

- If the control window's renderer process dies, the main process reloads it and
  sends the current state. The output windows aren't affected, because the main
  process owns the output state.
- Changes that had already reached the main process are saved. An imported song
  that wasn't saved yet is lost.

Source: `docs/TECH.md` process structure and quality rules.

## Crash and restart: 출력 상태 복구

### Detecting a crash

At launch, if `recovery\session.lock` still exists, the last exit was a crash
(see 02).

### What the app does

1. Open the last service as it was. Songs, services, and settings were saved on
   every change, so there is nothing else to recover.
2. Keep every screen output off (standby). The status bar shows "대기"
   (standby), and the toolbar output buttons show the off state. Ignore the 켤
   때 화면 출력 (output on launch) option until the operator answers.
3. Open the 출력 상태 복구 dialog at once.

### The dialog

| Part    | Content                                                                                       |
| ------- | --------------------------------------------------------------------------------------------- |
| Icon    | History icon                                                                                  |
| Title   | "출력 상태 복구" (output state recovery)                                                      |
| Detail  | "비정상 종료 10월 25일 오전 11:26" (abnormal exit, with the time of the last recovery record) |
| Group   | "복구할 상태" (states to restore), with three check rows, all checked by default              |
| Buttons | 새로 시작 (start fresh) and 복구 (restore, primary). There is no cancel button.               |

| Row                                        | Value example                     | Restores                                                                                                                                                |
| ------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 화면 출력 (screen output)                  | "본 화면, 무대 화면, 방송 자막"   | Turns on the outputs that were on.                                                                                                                      |
| 마지막 장 (last 장)                        | "<song title> 2 / 9"              | The live 장 (same item and position) and its background (proposal for the background).                                                                  |
| 표시 중이던 항목 (items that were showing) | "메시지 1, 소품 1, 무대 메시지 1" | 소품, 메시지 (with the display time they had left, proposal), the stage message, the 공지 (from the image it showed), and the stage layouts (proposal). |

- Hide a row that has nothing to restore (proposal). If the record has nothing
  at all to restore, don't show the dialog, and launch normally (proposal).
- With every row unchecked, 복구 is unavailable.
- Enter is 복구. Esc is 새로 시작. The dialog has no close button, and clicking
  outside it doesn't close it.
- F1 to F7 still work while the dialog is open.
- Timers and audio aren't restored (proposal; see 02).

### After the answer

- 복구: apply the checked rows in this order: outputs on, the live 장 and its
  background, then the items that were showing. Don't run the restored item's
  start 매크로, and don't run startup 매크로 (proposal).
- 새로 시작: start with an empty output state. Apply 켤 때 화면 출력 as on a
  normal launch, and run startup 매크로 (proposal).
- Then delete the old recovery record and create a new `session.lock`.
- If the item of the last 장 no longer exists, hide the 마지막 장 row
  (proposal).

Source: `Recovery`, `AlertDialog` README, `Checkbox` README, `Main` decision
"복구는 출력 상태만", product log versions 61 and 62.

## Notifications

### Where and how they show

- Cards appear at the top right, below the toolbar, as wide as the right column.
  The newest card is on top. At most three cards show. When a fourth comes, the
  oldest information card closes first.
- A new card about the same cause (the same screen or monitor) replaces the old
  card instead of stacking. For example, "disconnected" turns into
  "reconnected".
- A warning card has an amber icon and an amber bar at its left edge. It stays
  until the problem is fixed or the operator closes it.
- An information card closes after 6 seconds. The timer pauses while the pointer
  or focus is on the card, and starts over when they leave.
- While a warning card shows, the right column moves down by the card height, so
  the preview stays visible. Information cards float without moving the column.
- Closing a warning card leaves the problem marks on the toolbar and status bar.
  Clicking the screen's text in the status bar reopens the card.
- Cards never take focus, never make a sound, and don't close with Esc. They
  show above dialogs, and their buttons work while a dialog is open.

### Writing

- The title is a noun phrase without a period, for example "무대 모니터 연결
  끊김".
- The time is 24-hour without seconds, for example "11:24".
- The detail line states the current state, for example "모니터 3 → 창으로 표시
  중".
- Up to two action buttons, named with verbs, for example "모니터 다시 찾기" and
  "창 보기".
- No apologies, exclamations, or explanations.

### What uses notifications in version 1

| Event                                         | Kind        |
| --------------------------------------------- | ----------- |
| Output monitor disconnected                   | Warning     |
| Output monitor reconnected                    | Information |
| Save failed (proposal)                        | Warning     |
| A file can't be read and was skipped          | Warning     |
| Backup location unavailable (proposal)        | Warning     |
| An output window can't be reopened (proposal) | Warning     |

Don't use notifications for problems of one item (they show in place) or for the
results of the operator's own actions.

Source: `Notification` README, `Problems`, `StatusBar` README, design system
writing rules.

## What must never happen during a service

- Never show a dialog, notification, tooltip, menu, or mouse cursor on an output
  window. Keep full screen outputs above other windows, so that no system window
  covers them (항상 위, on by default).
- Never ask for confirmation before an action that affects the output. Never
  block F1 to F7: they work with a dialog open and with a text field focused.
- Never depend on the network. Bible texts, fonts, and icons are bundled. Media
  are local files.
- Never install an update, restart the app on its own, or show an update prompt
  while any output is on. Version 1 has no updater. `docs/TECH.md` says the user
  installs new versions by hand, and not on the day of a service or the day
  before.
- Never let saving, backups, imports, media analysis, or search indexing stall
  the output. Do them asynchronously or in a helper process. Don't run automatic
  backups during a service.
- Never change the output because of a workspace switch, a service switch, or
  the 환경설정 window. In 화면 설정, only the test pattern, which the operator
  turns on, changes an output.
- Never let the display sleep or a screen saver start while an output is on
  (절전 막기, prevent sleep).
- Never lose an output because a monitor disconnects. Fall back to a window.
- Never turn an output black because a background file is missing. Hold the last
  frame.
- Never change the output without an action by the operator, except for actions
  the operator set up in advance: start 매크로, startup 매크로, 메시지 display
  times, 공지 rotation, and media that ends.
- Never show Windows toast notifications from the app (proposal).

Source: design system principle 6, `Dialog` and `ClearButton` READMEs (F1 to F7
always work), `Screens` (항상 위, 절전 막기), `Prefs` (출력 중 절전 막기),
`docs/TECH.md` principles and operating rules, product log (stability first,
offline).
