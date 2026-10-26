# M3 hands-on UX pass

Ten findings: one major functional defect, three major availability gaps, three
minor issues and three cosmetic/design findings. No unplanned crash, output
interruption or data loss was observed. This is an audit of the snapshot below,
not a release sign-off. The major findings were reported to the lead during the
run. The availability gaps are existing unmounted interfaces, not newly
established regressions. M3-UX-10 is a separately reproduced playlist-renaming
defect and should be routed to prep before the next check build.

## Build and method

- Audited local main: `266ced522555a4d069d595913238f2179d5c8470` (version
  `0.17.0`).
- Run: October 27, 2026, 01:09 to 01:32 KST, with controlled restarts; playlist
  focus follow-up 01:37 to 01:38 KST on the same built snapshot.
- Detached checkout in qa's own worktree, `npm run build`, then the built
  Electron entry. No app source, dependency or configuration change.
- `LLP_TEST_WINDOWS=offscreen`, `LLP_DEV_PORT=5189`, fresh copy of
  `docs/qa/m3-check/sample` in an ignored QA data folder. All native windows
  were checked as hidden. No window was shown on the user's desktop.
- Control content size 1920 x 1080 CSS pixels, DPR 1. Native output captures
  retain the sample's 960 x 540 window or 1920 x 1080 capture size.
- CDP pointer movement and mouse press/release drove controls. CDP text
  insertion and key events drove fields, Escape, Tab and Enter. A field's text
  was selected through the DOM before replacement because native Ctrl A
  selection was unreliable in the hidden test window. That harness limitation is
  not reported as a product shortcut defect.
- Element counts, CDP DOM counters and collected JS heap were sampled at a
  matching Show state. Screenshots are unedited PNG captures. Only the supplied
  invented QA text appears in them; no external lyrics or Bible text was used.

The original sample first failed Bible loading (M3-UX-02). To continue, only the
ignored copy was converted to the current container using its own invented
sentences. Text-import dialogs used a temporary main-process clipboard _reader_
fixture, restored after each use; the system clipboard was never written. The
conditional Look deletion dialog used a dependency macro added only to the
ignored data copy. These follow-ups do not establish that the original sample or
a native file/clipboard workflow passed.

## Issues

Severity follows [MILESTONES](../MILESTONES.md): blocker means output stops,
data loss or crash; major means a required feature cannot be used; minor means a
working feature has a flaw; cosmetic means a design-system difference. M3-UX-07
is explicitly a design-rule conflict, not a code/spec mismatch.

| ID       | Screen                                | Steps                                                                                                                                                                      | Expected                                                                                                                                                                                                                        | Actual                                                                                                                                                                                                                                                                                                                                                           | Screenshot                                                                                                                                                        | Severity                  | Owner               |
| -------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------- |
| M3-UX-01 | 진행, 진행 도구                       | Open 표시 중, 오디오, 타이머, 공지, 소품 and 매크로, return to another tab, then open each again.                                                                          | Each visible tab exposes its available controls, or is clearly unavailable. Audio, timer, prop and macro controls have PP counterparts [PP-SHOW]. 표시 중 and 공지 are local spec controls.                                     | All six selected tab panels have empty HTML, including no empty-state actions. Existing runtime timers and the sample macro cannot be edited from these tabs. 무대 and 메시지 are separate working panels.                                                                                                                                                       | [Timer](m3-ux/tool-timer.png), [macro](m3-ux/tool-macro.png), [all eight captures](m3-ux/README.md#show-tools)                                                    | major                     | tools               |
| M3-UX-02 | Sample, 진행 and 준비 Bible entry     | Make an untouched fresh copy of the tracked m3-check sample. Start this snapshot and enter the sample reference in the Bible field.                                        | The sample intended for a check build supplies a loadable invented translation, or its compatible build/container is made explicit.                                                                                             | `bible/sample.llbible` is schema 1 JSON; the current loader expects the schema 2 chunk container and logs `Invalid Bible header byte length`. 진행 says 사용할 수 없는 역본입니다. The provided sample cannot exercise the Bible flow on this main. This is fixture compatibility, not evidence that a valid translation fails.                                  | [Unavailable sample](m3-ux/bible-sample-unavailable.png)                                                                                                          | minor                     | qa, coordinate data |
| M3-UX-03 | 화면 설정, 무대 배치                  | Select 현재와 다음 in 무대 배치, select a screen, then select the layout again.                                                                                            | Open the stage canvas and selected-element properties required by spec 06. PP has an editable stage layout [PP-STAGE].                                                                                                          | Selection changes but the center remains 배치; 출력 미리보기 and 속성 become empty. There is no canvas, new-layout action or element editor. The 무대 tab can select an existing layout but cannot author one.                                                                                                                                                   | [Selected layout](m3-ux/stage-layout-selected.png)                                                                                                                | major                     | screens             |
| M3-UX-04 | 화면 설정, Look                       | Select 평상시 in Look, select a screen and return to the Look. Also add a new Look and select its row.                                                                     | Show the per-screen layer matrix and style controls required by spec 06. PP exposes per-audience-screen layer controls [PP-LOOK].                                                                                               | Look rows can be created and renamed, but selecting one leaves no Look editor. The normal 배치 area stays, while properties and preview are empty. No layer or lyric-style controls can be used.                                                                                                                                                                 | [Selected Look](m3-ux/look-selected.png)                                                                                                                          | major                     | screens             |
| M3-UX-05 | Menu bar                              | Click 편집, 창 and 도움말 twice each.                                                                                                                                      | An enabled menu trigger opens its commands. Until implemented, it should be visibly unavailable instead of claiming an operable menu. This is a common-sense recommendation, not a sourced PP equivalence claim.                | All three look like enabled peers, expose `aria-haspopup=menu`, but keep `aria-expanded=false` and produce no menu or action.                                                                                                                                                                                                                                    | [Menu bar after 편집](m3-ux/menu-edit.png)                                                                                                                        | minor                     | shell               |
| M3-UX-06 | 화면 설정, 속성                       | Select any configured screen and compare the property group/field edges with the 속성 header.                                                                              | Start panel content on the shared 14px panel-inset line and keep controls inside both edges [DS].                                                                                                                               | Panel and every property group/name start at x=1436, while its header starts at x=1450. Name fields and segmented controls reach the panel's right edge. The missing inset makes this panel visually unlike the prepared-service/media property panels.                                                                                                          | [Properties](m3-ux/screen-properties-0.png), [capture panel](m3-ux/screen-properties-1.png)                                                                       | cosmetic                  | screens             |
| M3-UX-07 | 진행 and 준비, slide-size slider      | Inspect and point at the slide-size track under either grid.                                                                                                               | Resolve the global minimum clickable area of 22 x 22 against the Slider component's explicit 16px hit height. Suggested common-sense default: retain the small visual knob but enlarge the invisible hit area to at least 22px. | The actual range input is 120 x 16. This follows the detailed Slider README and token, while conflicting with the global minimum. No drag malfunction is claimed, and PP's numeric target size was not found.                                                                                                                                                    | [Show grid footer](m3-ux/01-show.png), [song editor footer](m3-ux/prep-song-editor.png)                                                                           | cosmetic, design conflict | ui                  |
| M3-UX-08 | 진행 preview, toolbar and output menu | In 화면 설정 keep the sample's window/capture methods, rename 본 화면 to UX 본 화면, then return to 진행 and inspect the large-preview caption.                            | Names/targets presented as current output information follow the saved screen document. Role names can remain separate if intentional; the actual output destination must be accurate.                                          | The screen edit persists, but 진행 keeps the fixed default names and says 모니터 2 for a window. The same static source lists 모니터 3 and NDI for the other preview destinations. A single-monitor test machine is falsely shown as targeting a second monitor. This row concerns displayed routing information; no wrong physical output routing was observed. | [Saved screen name](m3-ux/screen-renamed.png), [stale preview](m3-ux/show-after-screen-rename.png)                                                                | minor                     | shell               |
| M3-UX-09 | 화면 설정, Look deletion confirmation | With a noncurrent Look referenced by a macro, right-click its row, select 삭제, cancel and repeat.                                                                         | A confirmation title is a complete polite Korean question under the design-system writing rule [DS], consistent with the other delete dialogs.                                                                                  | Title is 새 Look 삭제?, a terse fragment. Dependency names and cancellation work, but the wording differs from the standard used by song, media and service deletion. Suggested title: ‘새 Look’ Look을 삭제할까요?                                                                                                                                              | [Look confirmation](m3-ux/dialog-look-delete-dependent.png)                                                                                                       | cosmetic                  | screens             |
| M3-UX-10 | 준비, media and audio playlists       | Create a media playlist, finish its initial name, then select its row. Right-click the row and choose 이름 바꾸기. Repeat twice for media and twice for an audio playlist. | Keep the inline name field open and focused until the operator types a new name and commits or cancels.                                                                                                                         | Input mounts and receives focus, then loses focus after 0.1 to 0.3ms and unmounts without further operator input. After the 190ms settle interval only the global search and tile-size inputs remain. Both playlist kinds reproduce twice. Initial naming during creation works; renaming an existing playlist through its menu cannot be used.                  | [Media rename](m3-ux/playlist-rename-disappears-media.png), [audio rename](m3-ux/playlist-rename-disappears-audio.png), [focus sequence](m3-ux/measurements.json) | major                     | prep                |

## Code and design evidence

All code links below are pinned to the tested snapshot. They support the
observations, rather than replacing the hands-on checks.

- M3-UX-01:
  [src/renderer/src/show/ShowToolsPanel.tsx:75](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/renderer/src/show/ShowToolsPanel.tsx#L75).
  Only 무대 and 메시지 mount a body. See [spec 04](../spec/04-show.md) for the
  local tool inventory.
- M3-UX-02:
  [src/main/bible/chapterFile.ts:66](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/main/bible/chapterFile.ts#L66).
  The tracked sample was read without modification; its first bytes are JSON,
  not a four-byte header length. The loader rejects the prefix before reading
  any chapter text. A converted ignored copy passed lookup and Tab completion in
  both entry surfaces.
- M3-UX-03:
  [src/renderer/src/screens/LookLists.tsx:23](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/renderer/src/screens/LookLists.tsx#L23),
  [src/renderer/src/shell/Workspace.tsx:249](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/renderer/src/shell/Workspace.tsx#L249).
  Selecting a layout updates selection; there is no stage authoring surface in
  the workspace switch.
- M3-UX-04:
  [src/renderer/src/screens/looks/LookPanel.tsx:41](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/renderer/src/screens/looks/LookPanel.tsx#L41),
  [src/renderer/src/shell/Workspace.tsx:249](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/renderer/src/shell/Workspace.tsx#L249).
  The list implements lifecycle actions; the workspace has no Look matrix/style
  editor. The required surfaces are in
  [spec 06](../spec/06-settings.md#look-editor).
- M3-UX-05:
  [src/renderer/src/shell/MenuBar.tsx:84](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/renderer/src/shell/MenuBar.tsx#L84).
  The inert trigger has menu semantics but no handler.
- M3-UX-06:
  [src/renderer/src/screens/ScreenProperties.tsx:356](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/renderer/src/screens/ScreenProperties.tsx#L356),
  [src/renderer/src/ui/PropertyRow.module.css:1](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/renderer/src/ui/PropertyRow.module.css#L1).
  The shared property component supplies row/group layout; this panel's caller
  does not add a panel inset.
  [PropertyRow](../../design/system/project/components/PropertyRow/README.md)
  does not itself promise an outer inset, so this is assigned to the screen
  composition rather than a shared-row defect.
- M3-UX-07:
  [src/renderer/src/ui/Slider.module.css:16](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/renderer/src/ui/Slider.module.css#L16),
  [Slider anatomy](../../design/system/project/components/Slider/README.md#anatomy)
  and the global
  [spacing rule](../../design/system/project/README.md#spacing-and-sizes)
  explicitly disagree on the hit height. The report asks for reconciliation.
- M3-UX-08:
  [src/renderer/src/shell/screens.ts:15](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/renderer/src/shell/screens.ts#L15),
  [src/renderer/src/show/PreviewPanel.tsx:24](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/renderer/src/show/PreviewPanel.tsx#L24).
  Preview labels/targets are built from the fixed summaries rather than the
  edited screen document.
- M3-UX-09:
  [src/renderer/src/screens/looks/LookPanel.tsx:229](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/renderer/src/screens/looks/LookPanel.tsx#L229).
  The conditional confirmation interpolates the short fragment. The
  question-form rule is under [DS].
- M3-UX-10:
  [src/renderer/src/prep/media/MediaListPanels.tsx:101](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/renderer/src/prep/media/MediaListPanels.tsx#L101),
  [src/renderer/src/ui/Menu.tsx:420](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/renderer/src/ui/Menu.tsx#L420),
  [src/renderer/src/ui/ListRow.tsx:488](https://github.com/0913vision/llpresenter/blob/266ced522555a4d069d595913238f2179d5c8470/src/renderer/src/ui/ListRow.tsx#L488).
  Selecting rename mounts the auto-focused field in the same update that closes
  the menu. Menu cleanup focuses the old row; the field's blur commits its
  unchanged value and clears renaming. The observed focus sequence is consistent
  with this path. Defer entering rename until menu focus restoration finishes,
  as the Look list already does, or otherwise prevent that restoration from
  ending the edit. Suggested regression check: choose rename from each playlist
  menu, wait for cleanup, type a changed name, commit and verify persistence.

## Coverage and limits

All three workspaces and every Show Tools tab were selected twice, with the
additional repeated-switch exercise below. The media view and library editor
were also inspected. Empty or unreachable areas are reported explicitly; a
visited tab is not counted as a working feature.

| Area                 | Hands-on coverage                                                                                                                                                                                                                                 | Result/evidence                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 진행                 | Service rows selected back and forth 20 times; slides output; clear controls; quick launch; large preview choice; live versus selected state                                                                                                      | Selection, slides and clearing work. [Show](m3-ux/01-show.png), [live](m3-ux/show-live.png). See M3-UX-01 and 08 for gaps.                                                                                                                                        |
| 준비                 | Service-item view and source song editor; arrangement creation/name dialog; library title/initial-consonant search; background/settings and memo; create empty service                                                                            | Source editor and filtered library render. [Service item](m3-ux/02-prep.png), [source editor](m3-ux/prep-song-editor.png), [search](m3-ux/library-search.png). No external text used.                                                                             |
| 화면 설정            | Each of three screen rows twice; name edit saved; window/capture properties; test-pattern toggle; Look add/rename/menu; stage list                                                                                                                | Existing screen properties save; test pattern shows. [Screens](m3-ux/03-screens.png), [test pattern](m3-ux/screens-test-pattern.png). Editors unavailable as recorded above.                                                                                      |
| 진행 도구            | All eight tabs twice; stage message preset/send/lower; layout and timer menus; select/clear timer; message create/edit/delete confirmation, target controls, send/clear                                                                           | 무대 and 메시지 function. [Stage](m3-ux/tool-stage.png), [message](m3-ux/message-live.png). Six empty tabs are M3-UX-01.                                                                                                                                          |
| Top menus            | 파일, 편집, 보기, 출력, 창, 도움말 opened twice; file-import submenu, view commands and output list inspected                                                                                                                                     | 파일, 보기 and 출력 open; three inert peers are M3-UX-05. [Menus](m3-ux/README.md#menus).                                                                                                                                                                         |
| Other menus/popovers | Service picker/row, quick add and timer/macro target submenus, quick-row edit, toolbar Look, background/arrangement choices, label choices/context, library delete, media/playlist context, stage selects, global/library search, Bible quick add | Reachable menus render and dismiss. No second product's undocumented timing was guessed. [Index](m3-ux/README.md).                                                                                                                                                |
| Bible                | Original sample attempt; then converted ignored fixture, 진행 lookup and Tab completion, 준비 quick-add lookup and Tab completion                                                                                                                 | Original fails M3-UX-02. Follow-up passes with invented fixture. [Proceeding field](m3-ux/bible-panel-valid-fixture.png), [Prep field](m3-ux/prep-bible-valid-fixture.png). This is not a comparison with copible.                                                |
| Media                | Video/image selection; properties/info; preview play/pause; media deletion confirmation; media/audio playlist creation; playlist rename/delete confirmation                                                                                       | Preview plays; duration, resolution and size display. Existing playlist rename fails M3-UX-10. [Media view](m3-ux/04-prep-media.png), [properties](m3-ux/media-properties.png), [info](m3-ux/media-info-with-preview.png). Native reveal/import is blocked below. |
| Output               | Actual hidden main, stage and capture windows rendered; stage current/next text visible; outputs on/off, then quit                                                                                                                                | [Main](m3-ux/output-main.png), [stage](m3-ux/output-stage.png), [capture](m3-ux/output-broadcast.png). No physical monitor or audible-output claim.                                                                                                               |

The following dialog forms were each opened and closed twice. Deletion and
overwrite checks were cancelled, not executed. The empty-service and fixture
creation mentioned above affected only the disposable QA copy.

| Dialog                         | Result                                                                                                                                          | Screenshot                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 새 예배                        | Opens, source tree renders, Escape closes and returns focus to opener                                                                           | [New service](m3-ux/dialog-new-service.png)                                                                                |
| 다른 예배에서 가져오기         | Opens and shows source tree, cancels                                                                                                            | [Import](m3-ux/dialog-import-items.png)                                                                                    |
| 틀 name/delete                 | Nested dialogs open; Escape closes only the top dialog, then parent                                                                             | [Rename](m3-ux/dialog-template-rename.png), [delete](m3-ux/dialog-template-delete.png)                                     |
| 지난 예배 name/delete          | Rename opens; current-service deletion is correctly unavailable; opening another service permits the original's confirmation, cancelled twice   | [Rename](m3-ux/dialog-service-rename.png), [delete](m3-ux/dialog-past-service-delete-correct.png)                          |
| Save template conflict         | First save created a test template; later conflict opened twice and cancelled                                                                   | [Conflict](m3-ux/dialog-save-template-conflict.png)                                                                        |
| Quick launch rename            | Opens, cancels                                                                                                                                  | [Quick name](m3-ux/dialog-quick-rename.png)                                                                                |
| Arrangement name               | Add creates a draft arrangement name immediately, name dialog opens and cancels                                                                 | [Arrangement](m3-ux/dialog-arrangement.png)                                                                                |
| Label rename/key/delete        | Each opens twice through label popup context menu, cancels                                                                                      | [Rename](m3-ux/dialog-label-rename.png), [key](m3-ux/dialog-label-key.png), [delete](m3-ux/dialog-label-delete.png)        |
| Message add/edit/delete        | Add form cancelled twice; separate QA template created; edit/delete each cancelled twice                                                        | [Add](m3-ux/dialog-message-template.png), [edit](m3-ux/dialog-message-edit.png), [delete](m3-ux/dialog-message-delete.png) |
| Library song delete            | Confirms use in one service; cancels                                                                                                            | [Song deletion](m3-ux/dialog-library-delete.png)                                                                           |
| Media/playlist delete          | Each confirmation opens and cancels twice                                                                                                       | [Media](m3-ux/dialog-media-delete.png), [playlist](m3-ux/dialog-playlist-delete.png)                                       |
| Referenced Look delete         | Runtime data fixture supplies macro reference; confirmation/cancel works twice; title issue is M3-UX-09                                         | [Look deletion](m3-ux/dialog-look-delete-dependent.png)                                                                    |
| Text import preview            | Temporary reader fixture, preview opens/cancels twice; separate follow-up enters draft editor                                                   | [Preview](m3-ux/dialog-text-import.png)                                                                                    |
| Imported-song conflict/discard | Existing title supplied by reader fixture; save conflict and change-selection discard prompt each open/cancel twice                             | [Conflict](m3-ux/dialog-imported-song-conflict.png), [discard](m3-ux/dialog-imported-song-discard.png)                     |
| Output recovery                | Two deliberate terminations of the identity-checked hidden QA process; first restored prior slide, second Start fresh returned all layers empty | [Restore](m3-ux/dialog-recovery-1.png), [fresh](m3-ux/dialog-recovery-2.png)                                               |
| Save failure on close          | Disposable service file locked twice. Each attempt keeps memo/control open; release plus retry saves the exact marker and quits                 | [First](m3-ux/save-failed-1.png), [second](m3-ux/save-failed-2.png). Both pass.                                            |

Limits, not product failures:

- Native file choosers and 파일 위치 열기 were invoked, but the deliberate
  offscreen guards refuse them. Picker content, actual Explorer behavior and
  native media import must be checked by the user. File-text import logs its
  expected unavailable-dialog failure; the fixture preview test is separate.
- Real second-monitor routing, monitor number cards on a real screen, native
  always-on-top/full-screen behavior, visible title-bar minimize/maximize and
  audio playback cannot be established by hidden windows. Do not claim passes.
- The short 저장 중 intermediate view was not captured at 35ms in either
  locked-file test; both reached 저장할 수 없음 correctly. A slow real disk's
  transient saving view remains a user check.
- No Preferences route is mounted; inert menus are M3-UX-05. No stage element
  properties or Look editor dialogs can be reached because their editors are
  absent. These are availability gaps, not skipped successful steps.
- The pass used a small supplied library and DPR 1. It does not replace a
  multi-hour soak, a large-library check, other scaling factors or real-screen
  visual inspection.

## Repetition, memory and motion

Twenty rounds of 진행 -> 준비 -> 화면 설정 -> 진행 produced 60 workspace
changes. Then service song rows were alternated 20 times. At every checkpoint,
the same settled Show selection was measured after explicit GC. All retained DOM
counters were flat; the JS heap rose gradually, with smaller increments toward
the end. This short sample does not prove a leak or prove long-run memory
stability.

| Point     | UI elements | DOM nodes | Documents | JS listeners | Used JS heap, bytes |
| --------- | ----------- | --------- | --------- | ------------ | ------------------- |
| before-gc | 517         | 1941      | 40        | 870          | 7131028             |
| round-5   | 517         | 1941      | 40        | 870          | 7564328             |
| round-10  | 517         | 1941      | 40        | 870          | 7763908             |
| round-15  | 517         | 1941      | 40        | 870          | 7868000             |
| round-20  | 517         | 1941      | 40        | 870          | 7937208             |
| after-gc  | 517         | 1941      | 40        | 870          | 8097028             |

No menu, dialog or running UI animation remained at those checkpoints. Body text
resolved to Pretendard Variable 16/22 and the local font was loaded. All three
workspaces stayed at a 1920 x 1080 document with no page overflow.
Output-relative thumbnail text was not misclassified as general UI text.

Toolbar/list hover samples reached their final background after about 100ms,
matching the 100ms token; menu row transition was `none` and its highlight
changed immediately. No lag was observed in those probes. Timing includes CDP
overhead and is not a strict latency benchmark.

With a video already playing on the actual main output, five additional
workspace round trips preserved the slide and advanced the same video from 1.904
to 4.892 seconds. The output emitted no `loadedmetadata`, `emptied`,
`animationstart` or `transitionrun` event during that window. No fade replay or
video restart was observed. This evidence concerns actual output; initial
mounting of a preview was not treated as a new live trigger.

Two native process-memory samples are preserved too. Three output renderer
processes were created between them, so they are not a matching leak baseline.
Their development/offscreen GPU allocation is not a release-memory budget.

Raw numeric checkpoints, output-continuity samples, fixture labels and both save
results are in [measurements.json](m3-ux/measurements.json). The screenshot
[index](m3-ux/README.md) identifies each retained capture. Harness misses (wrong
selector, a still-closed menu or a Promise logged before awaiting it) were
corrected and were not counted as app defects.

## Reference checks

These official sources were read on October 27, 2026. They support only the
narrow claims above; local navigation and unsupported precision are not
attributed to ProPresenter.

- [PP-SHOW]: Renewed Vision,
  [What are Show Controls?](https://support.renewedvision.com/hc/en-us/articles/4412263446035-What-are-Show-Controls)
  identifies the operational audio/Props/Messages/Timers/Stage area in 7.5 and
  Macros in 7.6. It does not establish our extra 표시 중/공지 tabs.
- [PP-STAGE]: Renewed Vision,
  [Using a Stage Screen to its Full Potential](https://support.renewedvision.com/hc/en-us/articles/360041407794-Using-a-Stage-Screen-to-its-Full-Potential)
  describes opening the layout editor, creating layouts, adding elements and
  changing their position/attributes.
- [PP-LOOK]: Renewed Vision,
  [Using Looks to Show Different Screen Content](https://support.renewedvision.com/hc/en-us/articles/360041407174-Using-Looks-to-Show-Different-Screen-Content-in-ProPresenter)
  describes choosing layers per audience screen. It is used for that behavior,
  not a claim about an exact historical screenshot or every PP7 patch.
- [DS]: Local [design system](../../design/system/project/README.md), especially
  panel-inset, spacing/click area, writing, typography and motion. Detailed
  component exceptions are identified where they conflict with general rules.

[PP-SHOW]:
  https://support.renewedvision.com/hc/en-us/articles/4412263446035-What-are-Show-Controls
[PP-STAGE]:
  https://support.renewedvision.com/hc/en-us/articles/360041407794-Using-a-Stage-Screen-to-its-Full-Potential
[PP-LOOK]:
  https://support.renewedvision.com/hc/en-us/articles/360041407174-Using-Looks-to-Show-Different-Screen-Content-in-ProPresenter
[DS]: ../../design/system/project/README.md
