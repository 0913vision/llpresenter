# M3 user check smoke report

Status: check1 baseline completed. Major bug M3-C1-1 was reported immediately
and the lead assigned it, with C1-2, to data's `fix/data/close-write-failure`.
The user will run `m3-check2`, which the lead plans to tag around 19:50 KST on
October 26. Check2 has not been tested yet. The [Korean sheet](../m3-check.md)
is a draft for that tag. Final qa-11 is due by 20:45 after the retest. This
report does not sign off check1 for user use.

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

## Check2 retest pending

After the lead publishes `m3-check2`, check out that exact tag detached, run
`npm ci` and build again, copy the sample to a new QA data folder, and repeat
the applicable flow. Recheck C1-1 with an isolated file lock only in QA,
followed by release and retry. The user must not induce that failure. Check C1-2
on normal close, verify the saved memo on restart, and inspect the new tag for
mounted screen properties, stage layout/rendering, media import/metadata, and
quick rename/delete. Update user steps only for features actually reachable in
it. Monitor cards and native always-on-top remain physical user checks.
