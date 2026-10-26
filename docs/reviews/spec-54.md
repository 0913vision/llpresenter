# Review request: `spec-54`

- Team member: `spec` (Codex)
- Branch: `feat/spec/file-menu`
- Base commit and review range: in the request message, after rebasing onto
  local `main`
- Review round: 2
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

File and Output share one active menu and trigger behavior, including Down-arrow
opening. Hovering another heading switches the popup. Its first click keeps that
destination open. The menu's outside catcher starts below the menubar so the
headings receive pointer events, and Escape restores the destination's heading
focus.

## Changes outside my paths

- Shell-owned `src/renderer/src/shell/MenuBar.tsx` and `FileMenu.test.tsx`:
  implement and test the menu under the lead's explicit item 2 assignment.
- Shell-owned `src/renderer/src/control/App.tsx` and its test: send menu-action
  failures to `session.report` and verify they appear in the shared stack.
- UI-owned `src/renderer/src/ui/Menu.tsx`: menubar-anchored popups leave the
  heading strip outside their catcher and restore focus to their own anchor.
- Shell-owned `MenuBarSwitching.test.tsx`: both-direction hover and first-click
  switching, catcher geometry and resize cleanup, submenu removal, and closing.

No shared contracts or prep implementation changed.

## Validation

Round 2 focused tests: 53 tests across MenuBar, menu switching, File menu, App,
and the shared UI Menu. Commands, other results, and exact-head GitHub CI are in
the request message. Only focused checks run locally. Full verify runs on
GitHub.

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

## Team member's reply

1. MenuBar now owns the single active File/Output menu. Pointer entry switches
   that menu, and the first click after a hover switch keeps the destination
   open; clicking its heading again closes it. Menu's outside catcher starts
   below the hosting menubar, updates on resize, and releases its listener on
   close. Thus the headings receive pointer events directly. Menubar menus
   restore focus to the destination anchor after closing. Regression tests cover
   hover and first-click switching in both directions, one open popup, expanded
   states, Escape focus, the catcher bounds and resize cleanup, clearing an old
   submenu, and closed-menu hover behavior.
