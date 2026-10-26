# M3 check3 user-check smoke

Current user tag: `m3-check3`, commit
`9bde04fd51ba782d80fbed8dc01770baa269e219`, version `0.16.0`. On October 26,
20:27 to 20:36 KST, QA detached the tag, ran npm ci and build, and used a fresh
sample copy at `D:/llp-dev/qa/m3-check3-data`, port 5189, CDP 15189 and
`LLP_TEST_WINDOWS=offscreen`. No app code or API was patched. All launch/driver
scripts passed node syntax checks before use.
[Check3 evidence](evidence/check3.json) preserves observations. The save marker
retains the earlier helper's literal check2 wording; the launch commit and
check3 data folder establish this retest's build.

| Check                                        | Result  | Observation                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh startup                                | Pass    | No recovery dialog or problems; six source rows; outputs off.                                                                                                                                                                                                                |
| M3-C2-1 quit after outputs                   | Pass    | Two launches created main/stage output pages and hidden muted audio page, enabled then disabled both outputs and requested normal close. Both main PIDs exited, launch wrappers returned zero and CDP became unavailable with no remaining targets. No Task Manager cleanup. |
| M3-C1-1 real Windows file lock               | Pass    | FileShare.Read lock on copied service. Changed first-song memo and closed. Control stayed open with 저장할 수 없음. Released lock and retried; latest memo reached disk and process exited zero. Restart showed same memo.                                                   |
| Bible Tab completion in 진행                 | Pass    | 창 plus Tab becomes 창세기; 베 shows three book candidates. ArrowDown followed by Tab selects 베드로전서. Book-name completion does not require text for those books; sample verse text remains John only.                                                                   |
| Bible Tab completion in 준비                 | Pass    | 항목 추가, 성경 구절: 요 plus Tab becomes 요한복음.                                                                                                                                                                                                                          |
| Screen properties                            | Pass    | Mounted editable name/kind/method/always-on-top/margin/offset controls. Real CDP keyboard insertion and Enter saved QA3 main in the list. Earlier DOM-setter attempts did not establish a save and were excluded. Physical placement and stacking remain user checks.        |
| Template rename/delete                       | Pass    | From 새 예배 source context menu, renamed a copied runtime template, confirmed delete and observed removal. Repository fixture unchanged.                                                                                                                                    |
| Past-service actions                         | Pass    | Source context menu mounts rename and delete; delete correctly unavailable for the currently open service. Mutation of another past service was not rerun in this short pass.                                                                                                |
| Stage tab                                    | Pass    | Mounted 무대 화면 layout selector, timer selector and message controls. Broad stage rendering evidence remains the check2 run below.                                                                                                                                         |
| Text song import                             | Blocked | TextImportDialog exists but has no production caller/import; File/Edit/View menus remain inert in shell/MenuBar.tsx. No user entry point in this tag. Sheet lists unavailable instead of an impossible step.                                                                 |
| Hidden audio window                          | Pass    | audio=muted page exists and is disposed on quit. Sound is intentionally not available.                                                                                                                                                                                       |
| Native second screen/cards/AOT/saving dialog | Blocked | User-only physical screen and transient-dialog checks retained in sheet; offscreen checks do not establish them.                                                                                                                                                             |

M3-C2-1 is fixed in check3. Its check2 failure and evidence below are
historical. No new major finding arose in this focused pass. This is not a full
milestone sign-off or a repeat of every check2 row.

## Historical check2 smoke

# M3 user check smoke report

Current user tag: `m3-check2`, commit
`ca4b745cbd1821f3a1ae789097d14315d23c3284`, version `0.15.0`. Retested October
26 from 19:41 KST. `npm ci` and build passed detached in QA's own worktree.
Restored only later QA fixture paths from the member branch. Used fresh
`D:\llp-dev\qa\m3-check2-data`, port 5189, offscreen windows and CDP 15189. No
app source, built code or Electron API was patched.

The lead received C2-1 and authorized continuing with a documented Task Manager
workaround if no check3 tag is ready around 20:30. This prepares a user check;
it does not sign off the milestone. The copible task was cancelled; no
comparison document or copied implementation is included.

## Check2 results

| Case                                | Result  | Evidence and limits                                                                                                                                                               |
| ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh sample startup                | Pass    | Six rows, three songs, empty problem list, no recovery dialog, outputs off. Invented lookup fixture loads.                                                                        |
| C1-1 actual locked file             | Pass    | FileShare.Read refuses atomic replacement. Close stays open with 저장할 수 없음. Release and retry saves newest memo and exits 0. No force close.                                 |
| C1-1 restart                        | Pass    | Memo equals retry marker; no recovery dialog, outputs off.                                                                                                                        |
| C1-2 old handshake cleanup          | Pass    | Former could not stop the close handshake error absent. C2-1 is a different cleanup path.                                                                                         |
| Quit after output creation          | Fail    | C2-1 below. Control closes; main and two output pages remain over one minute. Only recorded QA process tree terminated after evidence capture.                                    |
| M2 navigation                       | Pass    | CDP Ctrl Down twice, Ctrl Up, Ctrl L open expected songs with live slide unchanged. C selects chorus; next at last slide stays there. Preview switch leaves live state unchanged. |
| Main and stage rendering            | Pass    | Hidden main contains current lyrics; stage contains current/next labels and lyrics plus clock. Main video advances about 0.51 s, no decoder error. No physical scan-out claim.    |
| Bible field and panel               | Pass    | Reference previews three invented sentences without output. Final verse plus next remains at verse 18.                                                                            |
| New service and template save       | Pass    | Blank name unavailable. Template creates six rows. Saving current service adds a named template to list.                                                                          |
| Other-service import                | Pass    | Five checked source rows appended to current seven-row service. Source retained, new IDs. An earlier automation click hit the background toolbar and is excluded as evidence.     |
| Prep Bible quick add                | Pass    | 성경 구절 mode inserts normalized 요한복음 3:16-18 row. Full service-Bible playback/settings not established.                                                                     |
| Quick rename and delete             | Pass    | Rename persists, delete removes only quick row.                                                                                                                                   |
| Quick pointer reorder               | Pass    | CDP mouse drag moves first row after timer; saved ID order changes, live state unchanged.                                                                                         |
| Quick target submenu                | Pass    | 타이머 submenu lists saved timer; choosing it appends timer row.                                                                                                                  |
| Stage controls                      | Pass    | Layout and timer selectors set live override/ID. Quick row starts timer. Default stage layout visibly exists in hidden DOM.                                                       |
| Screen preview and pattern          | Pass    | Preview mounts; pattern adds selected main ID, 화면 내용 removes it, returning to Show leaves it off. Physical picture remains user check.                                        |
| Monitor number cards                | Blocked | Intentionally suppressed offscreen; real location, lifetime and focus are user checks.                                                                                            |
| Fullscreen always on top            | Blocked | Native stacking suppressed offscreen. Optional windowless helper configures copied sample for physical user check.                                                                |
| Media information and preview       | Pass    | 0:12, 1280×720, 1.1MB shown; raw size 1,123,968 bytes. Preview advances with no decoder error.                                                                                    |
| Media import backend                | Pass    | Validated files API completes VP8 import, rejects text WebM with 재생할 수 없는 형식; invalid item absent and refusal card appears.                                               |
| Native chooser and reveal           | Blocked | Buttons exist; guards log offscreen refusal. End-to-end file picker and Explorer are user checks.                                                                                 |
| Media property edit/delete          | Pass    | Stop/fit persist end=stop, fit=fit. Imported duplicate deleted; original media retained.                                                                                          |
| Playlist create/rename/delete       | Pass    | Empty list created, inline rename persisted, deletion removes list while keeping media.                                                                                           |
| Viewport sizes                      | Pass    | 1280×720, 1600×900, 2560×1440 CSS viewports have no horizontal overflow. No Windows scaling or detailed clipping claim.                                                           |
| Screen properties / stage editor    | Blocked | Not mounted. Existing layouts and output preview available.                                                                                                                       |
| Template/past-service rename/delete | Blocked | spec-53 merged after tag, per lead correction. Excluded from steps.                                                                                                               |
| Audio output                        | Blocked | Not wired to a window in tag, per lead.                                                                                                                                           |
| Optional display setup helper       | Pass    | Syntax and ESLint checked. Windowless isolated-copy run assigns non-primary display and fullscreen/always-on-top; tracked sample unchanged.                                       |
| Transient saving dialog             | Blocked | Fast saves show none; lock test reaches failed-saving dialog. User may observe 저장 중 during slow save, without inducing failure.                                                |

See [check2.json](evidence/check2.json) for recorded observations and the retry
result, and [check2-close.log](evidence/check2-close.log) for actual shutdown
failures. Short-lived missing-layout warnings occur during settings reads;
steady stage output subsequently includes its layout.

## Check2 urgent finding: M3-C2-1

Major, output owner. On `m3-check2` at
`ca4b745cbd1821f3a1ae789097d14315d23c3284` (version `0.15.0`), normal close
after creating output windows leaves Electron and two hidden output pages alive
for more than one minute. Reported immediately before completing qa-11.

1. Start the tag offscreen with a fresh sample. Select a song and enable main
   and stage output, then disable both. Other smoke actions also ran; a minimal
   fresh-run reproduction has not yet been performed.
2. Request normal close. At `2026-10-26T10:50:39.706Z`, main logs
   `could not stop the outputs before quitting`,
   `TypeError: Object has been destroyed`.
3. At `19:51:36 KST` and afterwards, main PID `40128` still exists and CDP still
   lists the main and stage output pages, without a control page. Both outputs
   and the test-pattern list were off immediately before closing.
4. The built stack points to `connectPatternControl` cleanup reading
   `control.webContents.isDestroyed()` after the control BrowserWindow is
   destroyed. `startOutputs.stop` invokes its stop callbacks before
   `outputs.dispose`, without isolating a throwing callback. This explains a
   path that skips output disposal; attribution is from the built source.

Expected: normal close disposes all outputs and exits. Actual: the control
disappears but output pages and the main process remain. QA terminates only its
own recorded process tree after capturing evidence. No visible windows opened.

The separate C1-1 locked-file reproduction **passes** on check2: the app stays
open with 저장할 수 없음, releases and retries successfully, persists the latest
memo, and exits 0 before any output windows have been created. Restart retains
that memo, has no recovery dialog, and starts with outputs off. C1-2's former
close-handshake error is absent; C2-1 is a different output cleanup path.

## Historical check1 baseline

Check1 is superseded. Its original failures and evidence remain below; current
check2 outcomes are above.

## Build and environment

- Tag: `m3-check1`, peeled commit `d7e7c928ad97ba6f40dcee33367a0dfc09c18bcc`,
  version `0.14.0`.
- October 26, 2026, Windows, Electron `44.9.3`, Node `24.20.0`.
- Detached tag in QA's own worktree. `npm ci` and `npm run build`: Pass.
- Built app launched directly with the local Electron executable, without
  modifying app source, built output, preload, or Electron APIs.
- `LLP_TEST_WINDOWS=offscreen`, `LLP_DEV_PORT=5189`, CDP `15189`.
- Copied sample: `D:\llp-dev\qa\m3-check1-data`. Every app window stayed hidden.
- Reported monitor: 1920 x 1080, scale factor 1. No physical display check.
- Runtime helper scripts passed `node --check` before use.
- A fresh continuation copy under the same assigned data folder completed the
  remaining checks. Its viewport starts at 1858 x 1080 CSS pixels, DPR 1.
- The exact `npm run preview` command was also run with offscreen mode and
  `LLP_SMOKE_EXIT_MS=1200`: it rebuilds and starts the tagged app, logs smoke
  ok, then returns exit 0. C1-2 remains in its shutdown log.

## Check1 results

| Case                            | Result  | Evidence and limits                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sample startup                  | Pass    | Six service rows, three songs, two media, five quick rows, no recovery dialog, empty problem list, outputs off.                                                                                                                                                                                                           |
| New service                     | Pass    | Template creates six rows with new IDs and becomes current. Empty name marks Create unavailable. Past-service creation excludes the unchecked final slot and copies five rows with new IDs. Blank service creates no rows. A source switch clears exclusions. Live state unchanged. Original service reopened afterwards. |
| M2 grid and keys                | Pass    | First song has ten slides. Click outputs its video background and first slide. Space, Right, Page Down, Left, Page Up produce positions 1, 2, 3, 2, 1. DOM-dispatched key events exercise renderer handlers.                                                                                                              |
| Clear                           | Pass    | F2 clears slide; Ctrl Z leaves it cleared. F1 clears all layers. Default clear undo is hidden.                                                                                                                                                                                                                            |
| Song navigation                 | Pass    | CDP key events for Ctrl Down twice, Ctrl Up, Ctrl L open second song, third song, second song, first live song. Output slide unchanged. C selects the first chorus at position 2. Next on the last slide stays at position 9.                                                                                             |
| Slot quick add                  | Pass    | Selecting the final song slot and choosing 평안의 저녁 from 항목 추가 fills that row with the same item ID. Live passage unchanged.                                                                                                                                                                                       |
| Bible field and panel           | Pass    | Typing 요 3:16-18 previews three numbered invented sentences without output. Enter outputs verse 16, supplies verse 17 as next, and adds recent history. Saved Bible quick row outputs the first verse. These are explicitly labelled original QA sentences, not Scripture.                                               |
| Saved quick rows                | Pass    | Song outputs its default arrangement's first slide. Macro clears slide. Timer toggles running then paused. Black row has aria-disabled=true.                                                                                                                                                                              |
| Screen settings                 | Pass    | Screen, Look, stage layout lists and monitor arrangement render. Selecting 현재와 다음 opens no editor. Properties panel is empty in this tag.                                                                                                                                                                            |
| Stage layout editor             | Blocked | Not mounted in the tag. Only the saved layout list is reachable.                                                                                                                                                                                                                                                          |
| Monitor number cards            | Blocked | Button accepts a click, but startOutputs deliberately substitutes a no-op window factory in offscreen mode. No physical card verified.                                                                                                                                                                                    |
| Always on top                   | Blocked | Sample has true for main and false for stage. Offscreen mode suppresses native window raising. Screen properties editor is not mounted.                                                                                                                                                                                   |
| Main output switch              | Pass    | Header toggle sets main and canonical ID on, reports window placement, then sets both off. Actual visible picture and native stacking not checked.                                                                                                                                                                        |
| Hidden main and stage renderers | Pass    | Both contain the first song's lyrics. Active video advances by about 0.51 seconds between samples and has no media error. This does not establish stage-specific layout rendering or physical scan-out.                                                                                                                   |
| Image background                | Pass    | Third song selects the image's media ID. Preview selection leaves live state unchanged.                                                                                                                                                                                                                                   |
| Last Bible verse                | Pass    | Outputting verse 18 and pressing next leaves position 2 and label 3:18. No automatic song transition.                                                                                                                                                                                                                     |
| Viewport sizes                  | Pass    | CDP CSS viewport emulation at 1280 x 720, 1600 x 900, 2560 x 1440: no page horizontal overflow, positive panel sizes. Not a Windows scale or detailed visual clipping check.                                                                                                                                              |
| Video import backend            | Pass    | Existing validated media.import files API imports the original VP8 clip, observes complete, and stores duration 12 s, size 1,123,968 bytes, 1280 x 720. Invalid text .webm reaches failed with 재생할 수 없는 형식 and is absent from the media list.                                                                     |
| Import through UI               | Blocked | ShowMediaPanel hard-codes 가져오기 unavailable. Duration is visible on the tile; file-size properties UI is not mounted. Backend result does not establish a user-accessible import flow.                                                                                                                                 |
| Fast normal close and restart   | Pass    | A newly typed memo survives immediate close and restart, exit 0. Close finishes before the 300 ms saving-dialog delay.                                                                                                                                                                                                    |
| Save failure on close           | Fail    | M3-C1-1, major: locked service file causes write failure, but normal close exits and loses the latest memo.                                                                                                                                                                                                               |
| Close cleanup logging           | Fail    | M3-C1-2, minor: exit logs could not stop the close handshake before quitting, TypeError: Object has been destroyed. Both exits return 0.                                                                                                                                                                                  |

## M3-C1-1: normal close loses a memo after a disk write failure

- Severity: major, unsaved edit lost without selecting force close.
- Area: close flush, service-item memo, main content persistence.
- Suggested owners: data and prep, coordinated by the lead.
- Expected: spec 08, Closing while edits are still being saved. Failed saving
  keeps the app open with 저장할 수 없음 and 다시 시도. Only 강제로 닫기
  authorizes dropping an edit.

Reproduction on the copied data only:

1. Save the first song item's memo as `M3 close flush smoke memo`, close, and
   reopen the same data. The memo is present.
2. Hold the current service file open for read with Windows FileShare.Read,
   preventing replacement by the atomic-save rename. The temporary lock expires
   after 55 seconds or an explicit release flag. This changes no system setting.
3. In 준비, select 새벽을 여는 노래. Set its memo to `M3 locked save retry memo`
   and click the control window's normal 닫기 button in the same renderer task.
   No force-close command is sent.
4. Observe the process exit. Release the test file handle and inspect the
   service and its newest recovery copy.

Actual evidence:

- At `2026-10-26T07:00:53.639Z` and `.920Z`, main logs
  `could not persist a content file`, EPERM at the rename into the current
  service file.
- At `.922Z`, shutdown logs the separate close-handshake cleanup error. Electron
  exits with code 0. The retained file handle is subsequently released.
- The service and recovery copy `2026-10-26T07-00-53.334Z.json` both contain the
  earlier `M3 close flush smoke memo`. Neither contains the latest memo.
- CDP's awaited post-close inspection never returns because the target closes.
  No claim is made about a fleeting dialog before destruction. The observable
  failure is exit and loss of the edit without force-close selection.

Suggested regression: fail the service-item atomic write during the close flush;
verify the window remains open, retains the newest memo, and saves that memo
after the write becomes available and the operator retries.

## Evidence retained locally

Ignored QA files: `.llp/m3-evidence.jsonl`, `.llp/m3-electron.log`,
`.llp/m3-close.jsonl`, and syntax-checked `.llp/m3-*.mjs` helpers. Runtime copy
retains the original persisted memo and recovery copies. No visible app, soak,
native window recorder, or full local verify was run. The continuation launch
also exited normally and its test outputs were off before exit.

Reviewable extracts are committed as [check1.json](evidence/check1.json) and
[check1-close.log](evidence/check1-close.log). The JSON retains observed sample
startup, source choices, slot fill, CDP key results, output DOM/video samples,
viewport measurements, and terminal import results. The log contains the actual
save-failure and shutdown messages for C1-1 and C1-2. Full local records retain
the source expressions and the unabridged runtime log.

## Possible check3 follow-up

If the lead publishes check3 around 20:30, retest only quit after creating and
disabling outputs, then update the clone tag and known-problem wording. Broader
check2 evidence remains pinned to check2. Native monitor cards and always-on-top
remain user checks.
