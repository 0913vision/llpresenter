# Shortcut audit, October 26, 2026

Scope: the implemented control window and its menus, compared with the decided
version 1 rows in spec 10. Checked the current Windows column of
[S1, Keyboard Shortcuts in ProPresenter](https://support.renewedvision.com/hc/en-us/articles/360042123293-Keyboard-Shortcuts-in-ProPresenter)
on October 26. S1 still supports the adopted defaults below. Spec 10's explicit
exceptions and today's clear-toggle decision take precedence.

Baseline: local main `a25e2af2`. Statuses below describe that baseline, before
the fixes listed under Requests. This audit does not claim that every command in
ProPresenter belongs in this app.

## Implemented keys

| Area and source                                                                          | Implemented behavior                                                                                                                                                     | Result                                                                                                                            |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `show/shortcuts.ts`                                                                      | Right/Space/Page Down next, Left/Page Up previous; Ctrl Down/Up select adjacent items; Ctrl L reveals live; configured bare label letters/digits, with Num Lock handling | Matches decided navigation. Popup, field, IME, held-output-key, drag, and focus rules have tests.                                 |
| `show/clearKeys.ts`, `show/clear.ts`                                                     | F1 through F7 map to the seven decided layers across workspaces                                                                                                          | S1 defaults match. Output owns the new toggle behavior. No changes here.                                                          |
| `shell/uiZoomKeys.ts`                                                                    | Ctrl plus/minus/0, with numpad equivalents                                                                                                                               | Decided UI zoom exception. These are not ProPresenter's editor font-size/canvas-fit commands.                                     |
| `prep/editor/editorKeys.ts`, `SongBlock.tsx`                                             | Ctrl Z/Y/Shift Z; Ctrl Shift N new slide; Ctrl Enter split; empty-line Enter and boundary editing                                                                        | Undo/redo and new-slide defaults match S1; split is the app's decided addition. Physical command codes and IME guard are present. |
| `show/ServiceOrderList.tsx`                                                              | Ctrl Z/Y/Shift Z order edits; Delete in 준비; rename field retains its text keys                                                                                         | Extra Ctrl Shift Y incorrectly redoes. Delete is absent in 진행. See conflicts/missing keys.                                      |
| `ui/LabelChip.tsx`                                                                       | Alt Left/Right reorder; Delete removes; bare arrows/Home/End select                                                                                                      | Decided chip behavior. These Alt arrows are local to the chip strip, not background output.                                       |
| `ui/ListRow.tsx`, `TileList.tsx`, `Checkbox.tsx`, `roving.ts` and windowed list wrappers | Arrow/Home/End selection, single tab stop, workspace-specific Enter/Space activation                                                                                     | Focus navigation, not app accelerators. Preserves the spec 10 show-mode exceptions.                                               |
| `ui/Menu.tsx`, `menuKeys.ts`, `menuButton.ts`                                            | Popup arrows, typeahead, Enter/Space, Esc, submenu navigation                                                                                                            | Popup keys work; top-level Alt/F10 activation is missing.                                                                         |
| `ui/TextField.tsx`, `NumberField.tsx`, `Slider.tsx`, dialogs and rename fields           | Native editing, Esc, Enter, Tab cycle, bounded number/slider changes                                                                                                     | Fixed control keys. No F2 rename shortcut.                                                                                        |
| `show/tools/StageMessage.tsx`, `MessageTab.tsx`; Bible input; import dialogs             | Contextual Enter sends/runs the primary action; IME guards                                                                                                               | Existing context-specific commands. No app-wide aliases.                                                                          |
| `show/quick/QuickEditing.tsx`, `MessageEditing.tsx`, `ui/TileList.tsx`                   | ContextMenu/Shift F10 on applicable tiles                                                                                                                                | Explicit handlers here; native context-menu fallback on other lists still needs app verification.                                 |
| Native browser text fields                                                               | Ctrl X/C/V/A/Z/Y and plain paste where supported by Chromium                                                                                                             | Native field editing is not an app command dispatcher. Lists do not uniformly implement Ctrl A/C/V.                               |

No production Electron menu accelerator table, `globalShortcut`, or
`before-input-event` dispatcher exists. `windows/control.ts` removes the native
menu, including reload and zoom roles. The renderer menu's `meta` displays a
hint only; it does not bind a key. `shortcuts.json` has validation/storage, but
there is no runtime registry applying its overrides to these hard-coded
handlers. The recorder/gallery does not establish a working settings window.

## Missing decided defaults

Each row has a default in spec 10, rather than merely a command ID with no
assigned key. S1 provides the defaults except where the table says otherwise.

| Command ID                                         | Decided default           | Baseline gap and existing target                                                                                        |
| -------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `workspace.show`                                   | Ctrl S                    | No handler. Existing 진행 workspace. Imported-editor save takes precedence.                                             |
| `workspace.prep`                                   | Ctrl E, Ctrl R            | No handler. Existing 준비 workspace.                                                                                    |
| `workspace.screens`                                | Ctrl Alt 1                | No handler. Existing 화면 설정 workspace.                                                                               |
| `workspace.media`                                  | Ctrl Shift V              | No handler. Existing media visibility actions. Plain paste must win inside text fields.                                 |
| `workspace.looks`                                  | Ctrl Shift 1              | No handler. Look list exists; actual O2 editor is frozen and absent. Do not pretend opening a list opens that editor.   |
| `workspace.stage`                                  | Ctrl 4                    | No handler. Stage layout list exists; O3 editor is frozen and absent.                                                   |
| `search.focus`                                     | Ctrl F                    | No handler. Toolbar search exists but is disabled in 화면 설정.                                                         |
| `library.newSong`                                  | Ctrl N                    | No handler. Existing library create action in 준비.                                                                     |
| `import.textFile`                                  | Ctrl Shift I              | No handler. Existing File import flow.                                                                                  |
| `service.revealLibrary`                            | Ctrl Alt L                | No handler. Existing item document/song read and library-selection request.                                             |
| `output.audience`, `output.stage`                  | Ctrl 1, Ctrl 2            | No handler. Existing main-owned output commands. Audience must group main and captions; stage stays separate.           |
| `media.nextBackground`, `media.previousBackground` | Alt Right, Alt Left       | No handler. Existing media playlist/strip output. Must not steal chip movement.                                         |
| `tools.stage`                                      | Alt S                     | No handler. Existing stage tab.                                                                                         |
| `tools.timers`                                     | Ctrl Shift C              | No handler. Tab exists; its timer UI is incomplete and owned by tools.                                                  |
| `tools.messages`                                   | Ctrl M                    | No handler. Existing message tab.                                                                                       |
| `tools.props`                                      | Ctrl Shift P              | No handler. Tab exists; prop body is incomplete.                                                                        |
| `bible.focus`                                      | Ctrl Alt B                | No handler. Existing Bible panel.                                                                                       |
| `tools.actionPalette`                              | Alt C                     | No handler and no action-palette surface. Needs its owner/lead to define the implementation unit.                       |
| `edit.duplicate`                                   | Ctrl D                    | No handler in 화면 설정 or the macro tab. Existing context-menu duplication is not an accelerator.                      |
| `edit.delete`                                      | Delete                    | Only some lists implement it. 진행 order, library, and screens do not consistently support it.                          |
| `import.save`                                      | Ctrl S in imported editor | Button exists, but no key handler. App-specific decided exception, not S1.                                              |
| `app.preferences`                                  | Ctrl comma                | No handler and no preferences window. Settings pages/recorder components alone are not a destination.                   |
| `app.quit`                                         | Ctrl Q                    | No handler. Existing window-close protocol includes output confirmation and close flush.                                |
| Fixed menubar access                               | Alt, F10                  | No top-level keyboard focus/activation. No Alt plus letter access keys are intended. App convention, not an S1 default. |

## Conflicts and deliberate differences

- Ctrl S is the show-workspace key except in the imported editor, where it
  saves. A global show handler must yield there and while a modal is open.
- Ctrl Shift V opens media except in a text field, where plain paste owns it.
- Alt arrows move arrangement chips locally. Background navigation is only a
  진행 command and must respect a focused component's cancellation.
- Ctrl Shift Y is currently accepted by service-order redo. Spec 10 permits Ctrl
  Y and Ctrl Shift Z; S1's Windows redo is Ctrl Y.
- Ctrl Alt L must require a selected service song, read it safely, and switch to
  its library song without changing output. Ctrl L continues to reveal live.
- UI zoom deliberately owns Ctrl 0 and Ctrl plus/minus. Stage-only slide output,
  editor canvas fit, and text font-size aliases must not steal them.
- F1 is not Help, F2 is not Rename, and Ctrl Z is not Clear Undo. Today's F1
  through F7 toggles remain output's work.
- Active IME, shortcut recording, an open popup/modal, or a drag must block new
  workspace/command accelerators. Non-editing Ctrl/Alt commands can pass through
  ordinary fields. Repeats must not recreate dialogs or repeatedly toggle state.
- S1-only printing, font/style editing, external services, and stage-only slide
  commands have no adopted version 1 default here. Their absence is not a bug.
- Bare label shortcuts, Space/Page navigation, Ctrl Up/Down, chip movement, Ctrl
  Enter splitting, and UI zoom keep the explicit decided app behavior.

## Commands without default keys

The following decided IDs have no default shortcut in spec 10. A missing key
binding is therefore expected: `show.first/last`, `service.switcher/quickAdd`,
`clear.undo`, `stage.hideMessage`, per-screen output and preview commands,
`screens.redetect/showFallbackWindow`, `look.*`,
`tools.showing/audio/notices/macros`, audio controls, notice pause/resume, timer
commands, macro/prop commands, service creation/import/save-as-template,
clipboard import, arrangement actions, media import/relink/playlist creation,
screen identification, new Look/stage layout/element commands, logs/about, and
minimize/maximize. Their underlying menus/buttons vary in implementation status;
assigning speculative default keys would create a new mismatch. `quick.*` and
PowerPoint import are later.

## Requests

- spec-60: wire existing workspace defaults and the 보기 menu, with popup/IME/
  drag precedence and plain-paste/imported-save exceptions. App evidence and
  final validation go in its review record.
- spec-61: focus/select the existing toolbar search with Ctrl F and open the
  existing text-file import flow with Ctrl Shift I, including the menu hint.
- Next: search/file/library actions; imported save; output toggles and quit;
  existing show tabs/Bible/background navigation; menubar access and local
  editing conflicts. Keep each review range small and check it in the app.
- Blocked destinations: preferences, action palette, O2/O3 editors, unfinished
  tools, and runtime custom mapping integration need owner coordination rather
  than silently binding the key to a different action.
