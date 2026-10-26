# Review request: `spec-54`

- Team member: `spec` (Codex)
- Branch: `feat/spec/file-menu`
- Base commit and review range: in the request message, after rebasing onto
  local `main`
- Review round: 1
- Task: shell's File menu, lead-authorized restart item 2

## What changed and why

The File menu now opens the same service actions as the service picker: 새 예배,
다른 예배에서 가져오기, and 지금 예배를 틀로 저장. It reuses
`useServiceActions`, so the existing unavailable reasons, save conflict prompt,
source menus, and service dialogs apply. Closing the menu leaves the chosen
dialog mounted. App routes failures to the shared notification stack.

The 가져오기 submenu has the text-file and clipboard entries and unavailable
PowerPoint entry from spec 01. `MenuBar.onImportText(source)` is the mount point
for P5's host flow. It receives `file` or `clipboard`; selecting either closes
both menus. Until the host supplies that callback, the text entries are
unavailable with a tooltip. Main currently has ui-44's preview dialog, which
hands an unsaved draft to a host. Ui is building the imported editor and entry
flow; this request doesn't implement that flow or invoke a preview with nowhere
to send its draft.

File and Output share their trigger behavior, including Down-arrow opening.

## Changes outside my paths

- Shell-owned `src/renderer/src/shell/MenuBar.tsx` and `FileMenu.test.tsx`:
  implement and test the menu under the lead's explicit item 2 assignment.
- Shell-owned `src/renderer/src/control/App.tsx` and its test: send menu-action
  failures to `session.report` and verify they appear in the shared stack.

No shared contracts or prep implementation changed.

## Validation

Local commands, counts, and exact-head GitHub CI are in the request message.
Only focused checks run locally. Full verify runs on GitHub.

Tests cover opening and cancelling 새 예배 by mouse and keyboard, unavailable
service actions without an open service, importing checked items, saving a 틀,
file/clipboard mount callbacks, the unavailable import entries, failure notices
in App, and existing Output-menu behavior. No Electron process or file picker
was started.

## Decisions and follow-up

Ui can supply the P5 callback when its host flow lands. The unavailable entries
make its absence visible without starting a partial import. Other File-menu
commands and the other inert menus remain outside this request. Output Looks and
P4 decisions in spec 05 are the next two authorized requests.
