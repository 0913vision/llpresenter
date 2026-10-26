# M3 hands-on UX recheck

Two of the original ten findings are fixed on the audited main snapshot:
M3-UX-02 (sample Bible format) and M3-UX-10 (playlist rename focus). Eight
remain open. One additional major availability gap, M3-UX-R1, prevents using an
inserted Bible service item in either 진행 or 준비. It was reported during the
run. This is a snapshot audit, not release sign-off or evidence of when that gap
began.

## Build and method

- Tested main: `9cc36558b48d9c69c60213b44a3b22bdbaa30783`, version `0.17.0`.
- Run: October 27, 2026, 02:46 to 03:00 KST, including controlled restarts.
- Detached main in qa's worktree, `npm run build` passed. App code was read
  only. The reporting branch can have a later base without changing this pin.
- Fresh copy of the current tracked `docs/qa/m3-check/sample`, including its
  converted v2 invented Bible sentences. All edits affected the ignored copy.
- `LLP_TEST_WINDOWS=offscreen`, `LLP_DEV_PORT=5189`, hidden control content size
  1920 x 1080 CSS pixels, DPR 1. CDP drove pointer and keyboard actions. Harness
  scripts passed `node --check` before use.
- Text replacement selects the field's value through the DOM before CDP text
  insertion. Hidden-window native Ctrl A was unreliable; this is a harness
  limitation. Section headers are now selectable, so song tests locate the song
  by title rather than assuming the first row is a song.
- Conditional Look deletion used a macro reference added only to disposable
  data. Text import used a temporary clipboard reader fixture, restored before
  restart. No system clipboard write, external lyrics or Bible text was used.
- [Evidence index](m3-ux/recheck/README.md) and
  [numeric observations](m3-ux/recheck/measurements.json) accompany the raw
  PNGs. The [original audit](m3-ux-pass.md) and its captures remain unchanged.

## Findings

Severity uses [MILESTONES](../MILESTONES.md). An availability gap is major when
a required feature cannot be used. Existing empty interfaces are not attributed
to the recent fixes. Original PP comparisons and source checks remain in the
original audit; this rerun establishes the local behavior below and makes no new
claim about PP.

| ID                        | Screen                          | Steps                                                                                                                                                                        | Expected                                                                                                                          | Actual on this snapshot                                                                                                                                                                                                                                                               | Evidence                                                                                                                                                                | Severity                  | Owner                                            |
| ------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------ |
| M3-UX-01, open            | 진행 도구                       | Open each of eight tabs, leave and reopen.                                                                                                                                   | Available tabs expose their controls or clearly indicate unavailability.                                                          | 표시 중, 오디오, 타이머, 공지, 소품 and 매크로 still have empty bodies. 무대 and 메시지 work separately.                                                                                                                                                                              | [Timer](m3-ux/recheck/tool-timer.png), [all tabs](m3-ux/recheck/README.md#tools)                                                                                        | major                     | tools                                            |
| M3-UX-02, fixed           | Sample and Bible entry          | Start with the untouched current sample; enter `요 3:16-18` in 진행 and 준비. Tab-complete `요`.                                                                             | Sample loads and reference entry resolves.                                                                                        | 진행 shows three slides. 준비 finds three positions and inserts the item. Both complete to 요한복음. This does not cover selecting the saved item, which fails R1 below.                                                                                                              | [Show](m3-ux/recheck/bible/show.png), [Prep](m3-ux/recheck/bible/prep.png)                                                                                              | was minor                 | qa                                               |
| M3-UX-03, open            | 화면 설정, 무대 배치            | Select 현재와 다음, select a screen, then select the layout again, twice.                                                                                                    | Editable stage canvas and element properties per spec 06.                                                                         | Selection changes, but center stays 배치 and properties/preview are empty. The 무대 tab selects layouts without authoring them.                                                                                                                                                       | [Layout](m3-ux/recheck/stage-layout-selected.png)                                                                                                                       | major                     | screens                                          |
| M3-UX-04, open            | 화면 설정, Look                 | Select a Look after selecting a screen.                                                                                                                                      | Per-screen layer and style editor per spec 06.                                                                                    | No Look editor appears. Properties and preview are empty.                                                                                                                                                                                                                             | [Look](m3-ux/recheck/look-selected.png)                                                                                                                                 | major                     | screens                                          |
| M3-UX-05, open            | Menu bar                        | Click 편집, 창 and 도움말 twice.                                                                                                                                             | Enabled menu triggers open commands; otherwise show unavailable state.                                                            | No menu or action, despite enabled appearance and menu ARIA. 파일, 보기 and 출력 open.                                                                                                                                                                                                | [Edit](m3-ux/recheck/menu-edit.png), [Window](m3-ux/recheck/menu-window.png), [Help](m3-ux/recheck/menu-help.png)                                                       | minor                     | shell                                            |
| M3-UX-06, open            | 화면 설정, 속성                 | Select each screen and compare field/group edges with header.                                                                                                                | Shared 14px panel inset from the design system.                                                                                   | Group and name edges start at x=1436, the panel boundary, while the header is inset. Controls meet the right boundary.                                                                                                                                                                | [Properties](m3-ux/recheck/screen-properties-0.png)                                                                                                                     | cosmetic                  | screens                                          |
| M3-UX-07, open            | 진행 and 준비 grid footer       | Inspect slide-size range input.                                                                                                                                              | Resolve global minimum 22 x 22 hit area against Slider's 16px component rule.                                                     | Input remains 120 x 16. This follows the component rule but conflicts with the global minimum. No drag failure is asserted. Suggested default remains an enlarged invisible hit area.                                                                                                 | [Show](m3-ux/recheck/01-show.png), [Prep](m3-ux/recheck/prep-song-editor-second.png)                                                                                    | cosmetic, design conflict | ui                                               |
| M3-UX-08, open            | 진행 preview                    | Rename the window-method main screen in 화면 설정, then return to 진행.                                                                                                      | Current name and output destination follow saved configuration.                                                                   | Saved name changes to UX 본 화면; 진행 still shows default names and 모니터 2 for a window. This is misleading displayed routing information; physical misrouting was not observed.                                                                                                   | [Saved name](m3-ux/recheck/screen-renamed.png), [Show](m3-ux/recheck/show-after-screen-rename.png)                                                                      | minor                     | shell                                            |
| M3-UX-09, open            | Referenced Look delete          | Delete a noncurrent Look referenced by a disposable macro, cancel and repeat.                                                                                                | Complete polite Korean confirmation question, consistent with other delete dialogs.                                               | QA recheck Look 삭제? remains a fragment. Dependency and cancellation behavior work.                                                                                                                                                                                                  | [Confirmation](m3-ux/recheck/dialog-look-delete-dependent.png)                                                                                                          | cosmetic                  | screens                                          |
| M3-UX-10, fixed           | 준비 playlists                  | Rename an existing media playlist twice and an audio playlist twice through context menus, type changed names and commit.                                                    | Field stays focused until commit; changed names save.                                                                             | All four attempts retain focus and save their actual changed names in the media document.                                                                                                                                                                                             | [Media field](m3-ux/recheck/playlist-rename-media.png), [audio field](m3-ux/recheck/playlist-rename-audio.png), [saved rows](m3-ux/recheck/media-playlists-renamed.png) | was major                 | prep, data fix                                   |
| M3-UX-R1, new observation | 준비 and 진행, saved Bible item | In 준비 항목 추가 choose 성경 구절, enter `요 3:16-18`, insert it, select its service row, then switch to 진행 and select the same row. Repeat selection in both workspaces. | The inserted Bible item resolves the same three slides as ad hoc entry; 준비 provides its non-outputting Bible panel and preview. | Both attempts show 슬라이드 0개. 준비 center contains only the reference heading and preview is empty. 진행's grid has zero slides, so the saved item cannot be operated. The previous ad hoc live slide can remain in the Show preview; it is not evidence the selected item loaded. | [Prep empty](m3-ux/recheck/bible-prep-preview-empty.png), [Show empty](m3-ux/recheck/bible-show-same-item.png), [counts](m3-ux/recheck/measurements.json)               | major                     | data for Show resolution, prep for panel/preview |

## Pinned code and design evidence

The links use the tested commit, not the reporting branch's later base.

- R1:
  [showService.ts:54](https://github.com/0913vision/llpresenter/blob/9cc36558b48d9c69c60213b44a3b22bdbaa30783/src/main/store/showService.ts#L54)
  builds tiles only for song items. The Bible row at line 88 supplies its title
  without a tile path.
  [OtherItemPanel.tsx:98](https://github.com/0913vision/llpresenter/blob/9cc36558b48d9c69c60213b44a3b22bdbaa30783/src/renderer/src/prep/service/OtherItemPanel.tsx#L98)
  has an explicit Bible-panel TODO and renders a heading only.
  [ItemSidePanels.tsx:39](https://github.com/0913vision/llpresenter/blob/9cc36558b48d9c69c60213b44a3b22bdbaa30783/src/renderer/src/prep/service/ItemSidePanels.tsx#L39)
  provides a picture for songs only.
  [Spec 05](../spec/05-prep.md#예배-순서-panel-in-준비) requires Bible slide
  counts and the Bible panel without output buttons.
- UX-01:
  [ShowToolsPanel.tsx:65](https://github.com/0913vision/llpresenter/blob/9cc36558b48d9c69c60213b44a3b22bdbaa30783/src/renderer/src/show/ShowToolsPanel.tsx#L65)
  mounts bodies only for the two working tools.
- UX-03/04:
  [Workspace.tsx:245](https://github.com/0913vision/llpresenter/blob/9cc36558b48d9c69c60213b44a3b22bdbaa30783/src/renderer/src/shell/Workspace.tsx#L245)
  still has no stage or Look authoring surface.
- UX-05:
  [MenuBar.tsx:18](https://github.com/0913vision/llpresenter/blob/9cc36558b48d9c69c60213b44a3b22bdbaa30783/src/renderer/src/shell/MenuBar.tsx#L18)
  explicitly leaves the remaining menus unmounted.
- UX-06/07/09: [design system](../../design/system/project/README.md), its
  Slider component rule, measurements and the original audit establish the same
  inset, hit-area conflict and writing rule. The conditional title remains at
  [LookPanel.tsx:229](https://github.com/0913vision/llpresenter/blob/9cc36558b48d9c69c60213b44a3b22bdbaa30783/src/renderer/src/screens/looks/LookPanel.tsx#L229).

Suggested R1 regression checks: data tests should load a saved Bible item and
assert resolved tiles; prep should render its non-outputting panel and preview.
An operator integration test should insert, deselect, reselect and reopen that
item, rather than stopping after reference acceptance.

## Coverage and repeated dialogs

| Area                          | Hands-on coverage and result                                                                                                                                                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three workspaces              | Each captured at 1920 x 1080. Twenty full 진행 > 준비 > 화면 설정 > 진행 trips, plus twenty alternating song-row selections. No missing matching-state elements or accumulated dialogs.                                                                                                                  |
| 진행                          | Song grid/output, clear and restore, quick rename/add menus, ad hoc Bible reference/Tab, Look and output controls, all eight tool tabs twice. Hidden main, stage and capture windows rendered.                                                                                                           |
| 준비                          | Service item and song editor, labels and arrangement menu, library search/delete, quick-add Bible, media view, video play/pause/info, playlist creation/rename/delete confirmations.                                                                                                                     |
| 화면 설정                     | Each of three screen rows twice, properties, persisted name, test pattern, Look and layout selections. Monitor identify command invoked; real number-card appearance is not verified.                                                                                                                    |
| Recent section/search changes | Section rename retains focus and commits QA section. Adding a song with that section selected places it at the section's end. Search matching invented text returns the three titles in Korean title order. [Section](m3-ux/recheck/section-renamed.png), [search](m3-ux/recheck/alphabetic-search.png). |
| Menus                         | Six top-level triggers twice. 파일, 보기 and 출력 render; remaining three are UX-05. Service, quick-add/target, label, library, media/playlist, layout/timer and import submenus exercised.                                                                                                              |

Each dialog form below was opened and closed twice. Delete and overwrite
confirmations were cancelled. Creating an empty service and a duplicate-name
template affected only disposable data. Current-service deletion was correctly
disabled; switching to the temporary service enabled the original's real delete
confirmation, tested twice.

| Dialog forms                                   | Result and representative captures                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 새 예배, 다른 예배에서 가져오기                | Open and cancel; new-service Escape returns focus to opener. [New](m3-ux/recheck/dialog-new-service.png), [import](m3-ux/recheck/dialog-import-selected.png).                                                                                                                                                              |
| 틀 and 지난 예배 rename/delete                 | Nested dialogs open; Escape closes the top dialog. [Template name](m3-ux/recheck/dialog-template-rename.png), [template delete](m3-ux/recheck/dialog-template-delete.png), [service name](m3-ux/recheck/dialog-service-rename.png), [past-service delete](m3-ux/recheck/dialog-past-service-delete.png).                   |
| Save-template conflict                         | Duplicate-name overwrite choice opens and cancels twice. [Conflict](m3-ux/recheck/dialog-save-template-conflict.png).                                                                                                                                                                                                      |
| Quick rename, arrangement name                 | Open and cancel. [Quick](m3-ux/recheck/dialog-quick-rename.png), [arrangement](m3-ux/recheck/dialog-arrangement.png).                                                                                                                                                                                                      |
| Label rename/key/delete                        | All three open twice and cancel. [Name](m3-ux/recheck/dialog-label-rename.png), [key](m3-ux/recheck/dialog-label-key.png), [delete](m3-ux/recheck/dialog-label-delete.png).                                                                                                                                                |
| Message add/edit/delete                        | Add cancelled twice; separate invented template created; edit/delete cancelled twice; send and clear work. [Add](m3-ux/recheck/dialog-message-add.png), [edit](m3-ux/recheck/dialog-message-edit.png), [delete](m3-ux/recheck/dialog-message-delete.png).                                                                  |
| Song, media and playlist deletion              | Each confirmation opens and cancels twice, including both playlist kinds. [Song](m3-ux/recheck/dialog-library-delete.png), [media](m3-ux/recheck/dialog-media-delete.png), [media playlist](m3-ux/recheck/dialog-playlist-delete-media.png), [audio playlist](m3-ux/recheck/dialog-playlist-delete-audio.png).             |
| Referenced Look deletion                       | Dependency fixture; twice, cancelled. UX-09 remains. [Look](m3-ux/recheck/dialog-look-delete-dependent.png).                                                                                                                                                                                                               |
| Text import and imported-song conflict/discard | Reader fixture; preview, title conflict and discard each open/cancel twice. [Preview](m3-ux/recheck/dialog-text-import.png), [conflict](m3-ux/recheck/dialog-imported-song-conflict.png), [discard](m3-ux/recheck/dialog-imported-song-discard.png).                                                                       |
| Output recovery                                | Two deliberately terminated, identity-checked hidden QA processes. First restores prior slide/output state; second 새로 시작 empties all layers and outputs. These are controlled recovery fixtures, not unexpected crashes. [Restore](m3-ux/recheck/dialog-recovery-1.png), [fresh](m3-ux/recheck/dialog-recovery-2.png). |
| Close with failed save                         | Disposable service locked twice. Both retain memo and control window. Release lock, retry, exact memo persisted, process exits normally. [First](m3-ux/recheck/save-failed-1.png), [second](m3-ux/recheck/save-failed-2.png).                                                                                              |

## Counts, memory and transitions

At all six matching Show checkpoints after garbage collection: 523 elements,
1,939 DOM nodes, 37 documents and 587 JS listeners. Dialogs, menus and active
animations were zero. Used JS heap grew from 6,643,492 to 7,798,152 bytes
through the workspace and list exercise. Stable counts in this short sample do
not prove flat memory over hours; no leak-free or whole-process memory claim is
made.

| Point                    | Used JS heap bytes |
| ------------------------ | -----------------: |
| Before trips             |          6,643,492 |
| Trip 5                   |          7,154,024 |
| Trip 10                  |          7,476,864 |
| Trip 15                  |          7,579,168 |
| Trip 20                  |          7,652,880 |
| After 20 list selections |          7,798,152 |

Five additional workspace trips with live output kept the same live layers. The
output video advanced from 1.823 to 4.795 seconds without metadata reload,
emptied, animation-start or transition-run events. Captured output remained the
current song. Inactive pooled slide buffers can retain old DOM text; that alone
is not visible ghosting. [Main](m3-ux/recheck/output-main-late.png),
[stage](m3-ux/recheck/output-stage.png),
[broadcast](m3-ux/recheck/output-broadcast.png).

Toolbar hover settled by 100ms; menu highlight had no transition. A list probe
hit a selected row, so it establishes no unselected-row hover timing result. No
new replaying transition or delayed hover defect was established. Font and
alignment findings remain the specific original rows above. Attached renderer
exception listeners recorded no product exception; harness target failures were
corrected and are not classified as app bugs.

## Limits and closeout

- Offscreen guards prevent native file chooser and Explorer behavior. Native
  media import, actual file-text selection and real clipboard integration remain
  user checks. Reader-fixture preview coverage is separate.
- Real second-screen routing, physical monitor cards, always-on-top during full
  screen, native title-bar behavior and audible playback remain user checks.
- The brief 저장 중 view was not observed at 35ms in either lock test; both
  reached 저장할 수 없음. A slow real disk's intermediate dialog is not a pass.
- Screen creation in this snapshot is a foundation API, explicitly without a
  mounted creation control in screens-13. Its absent UI is not reported as a
  regression. Preferences, stage element properties and Look editor dialogs are
  unavailable. The shared native import copy choice was not end-to-end tested.
- Final close/retry succeeded. No own Electron process remained. No unplanned
  crash, observed output interruption or lost memo occurred during this pass.
- This is not milestone sign-off: UX-01, UX-03, UX-04 and R1 remain major gaps.
