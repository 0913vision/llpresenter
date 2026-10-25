Review range: `0f5b01c...docs/spec/m2-check1`

# Review request: `spec-13`

- Team member: `spec`
- Branch: `docs/spec/m2-check1`, from `main` (not stacked)
- Base commit (`main`): `0f5b01c`
- Shared files changed: none; documents only in `docs/spec/` and this review
- Behavior/settings commit: `bf6868c`
- Separate terminology commit: `3fa94fd`
- Last commit: the commit that adds this review
- Task: `.llp/task.md`; M2 check 1 feedback rows 2, 3, and 7 to 11

## What changed and why

The M2 check exposed an unsupported clear-undo shortcut, unreadable controls,
and layout recovery gaps. This request updates the specification and records
which choices still need confirmation. It changes no app code or design files.

| Feedback                | Result                                                                                                                                                                                                                                                                                           | Where to review                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 8: Ctrl Z               | Remove the clear-undo default and every claim that it follows ProPresenter. Ctrl Z only undoes edits, including service-list edits in 진행. Operators re-trigger a cleared slide.                                                                                                                | 03 "Undo"; 04 editing and keyboard summary; 10 research, focus precedence, commands, and default map; 01 workspace rules |
| 7: optional undo button | Add 진행 > 지우기 되돌리기 단추 보이기, `preferences.json` `show.showClearUndoButton`, Boolean, default off (proposal pending user confirmation). When enabled, 되돌리기 restores all content removed by the last clear under 03's existing invalidation rules. `clear.undo` has no default key. | 03 "Undo"; 04 "Clear row"; 10 진행 table                                                                                 |
| 3: focus border         | 진행 thumbnails have no keyboard focus border; 준비 keeps it. Keyboard focus and activation still work.                                                                                                                                                                                          | 04 slide grid; 10 focus precedence                                                                                       |
| 9: slide size           | Continuous thumbnail width, synchronized % field, proposed 50% to 200%, default 100%, field/key step 1 percentage point. Baseline 100% fits 3/4/6 columns by size class. Store `layout.<sizeClass>.thumbnailScalePercent` in `app.json`, replacing column-count control.                         | 04 slide grid; 10 "Thumbnail size"; 02 local state                                                                       |
| 11: UI zoom             | Add UI 확대, UI 축소, UI 확대 초기화 (Ctrl +, Ctrl -, Ctrl 0). Proposed 100% to 200%, step 10 percentage points, default 100%, local `app.json` `uiZoomPercent`. Applies to main and 환경설정 windows; output rendering stays native.                                                            | 10 일반 table, commands, physical-key aliases, and "UI zoom and layout recovery"; 01 and 06 pointers                     |
| 10: layout reset        | Propose 보기 > 화면 배치 초기화 without a default key. Confirm before restoring main window bounds, UI zoom, all size-class column widths, and thumbnail percentages. Preserve live output and screen configuration.                                                                             | 10 "UI zoom and layout recovery"; 01 보기 menu                                                                           |
| 2: terminology          | Rename 378 slide meanings of 장 across all 11 spec files, including the glossary, to 슬라이드. Attached counts such as 9장 become 슬라이드 9개. Preserve Bible chapters and unrelated words.                                                                                                     | Separate commit `3fa94fd`; 01 glossary; 02 Bible grammar                                                                 |

The setting tables give storage, range, default, application timing, and
reasons. The slider mapping preserves tile width across row wrapping, so
changing the number of columns doesn't cause the old size jumps. UI zoom scales
the whole control UI, with scrolling when the narrow layout cannot fit.

## Sources and shortcut conflicts

- [S1, official ProPresenter shortcuts](https://support.renewedvision.com/hc/en-us/articles/360042123293-Keyboard-Shortcuts-in-ProPresenter):
  Edit Undo does not document clear undo. Editor Ctrl + and Ctrl - change text
  size. Ctrl 0 fits the editor canvas or triggers a stage-only slide in Show.
- S4, the already-cited ProPresenter 7.5 guide, p. 52: editor Zoom offers
  presets, Custom, and Fit. This concerns the canvas.
- [S21, official ProPresenter interface guide](https://support.renewedvision.com/hc/en-us/articles/360041345954-Understanding-The-ProPresenter-User-Interface),
  newly added to 10: Slide View size slider and clear controls. No app-wide UI
  zoom, interface layout reset, or clear undo was found in the checked S1, S4,
  and S21. The spec labels these as our design.

`stageEditor.fit` loses its old Ctrl 0 default but remains available as a
control and a command. Deferred stage-only output must also have no Ctrl 0
default. UI zoom owns its three keys in all control workspaces. The spec lists
Equal/Shift Equal/NumpadAdd, Minus/NumpadSubtract, and Digit0/Numpad0 aliases
and includes them in conflict checks. Active IME composition and shortcut
recording keep their precedence.

## Changed files

- Behavior/settings and terminology: `01-concepts.md`, `02-data.md`,
  `03-output.md`, `04-show.md`, `06-settings.md`,
  `10-shortcuts-and-settings.md`, and `README.md` under `docs/spec/`.
- Terminology only: `05-prep.md`, `07-macros.md`, `08-problems.md`, and
  `09-later.md` under `docs/spec/`.
- `docs/reviews/spec-13.md` (new).

## Checks run

| Check                               | Result                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run format:check`              | Pass on the rebased branch (base `0f5b01c`); all matched files use Prettier style                                                                |
| `npm run verify`                    | Not run, as instructed for documents-only work                                                                                                   |
| `git diff --check`                  | Pass                                                                                                                                             |
| Terminology audit                   | 378 replacements; Bible reference examples and unrelated word counts preserved; remaining 장 occurrences have chapter or unrelated-word meanings |
| Shortcut/settings consistency audit | Pass: clear undo unbound, edit Ctrl Z, canvas fit unbound, UI zoom keys and setting fields present                                               |
| Middle dots and em dashes           | None in all spec files and this review                                                                                                           |
| Rebase                              | Rebased once onto `main` at `0f5b01c`, no conflicts                                                                                              |

No unit tests or app launch: this request changes the specification only. The
implementation owners must test their corresponding behavior changes.

## Proposals for the lead to confirm

1. Clear undo visibility remains an opt-in setting with default off, pending the
   user's confirmation, as assigned.
2. Thumbnail size: 50% to 200%, default 100%, step 1 percentage point for
   fields/keys and continuous pointer movement. Dragging commits the nearest
   whole percentage on release.
3. UI zoom: 100% to 200%, default 100%, step 10, computer-local storage. The
   minimum preserves the base type scale; the maximum allows double size.
4. Layout reset is still a proposal. Its scope is main window bounds, zoom, and
   all column/thumbnail size classes. Proposed window bounds are 1280 x 720 DIP
   centered on the current monitor and constrained to its work area. Cancel
   changes nothing; confirmation saves through the data store.

## Implementation follow-ups outside this request

- Shell: adopt the clear-undo key removal, optional button, continuous size
  control, zoom commands, and proposed layout reset. These spec changes do not
  claim that merged code already implements them.
- UI: update matching design-system glossary, Ctrl Z guidance, focus rules,
  slider and percent field, button visibility, and zoom/type-scale drafts.
- Data: add the local fields and optional-button preference through the single
  `app.json` writer and shared contracts. Existing unknown fields stay intact;
  absent thumbnail percentage uses 100%, never a reinterpreted column count.
- Lead: reconcile any milestone/check documents outside spec ownership that
  still describe clear Ctrl Z or the old slide term.

Review the behavior/settings commit first, then the terminology commit. Table
padding and line wrapping account for much of the full-range diff.
