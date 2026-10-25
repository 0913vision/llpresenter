Review range: `918ec65...feat/spec/service-panel-editing`

# Review request: `spec-25`

- Team member: `spec`
- Branch: `feat/spec/service-panel-editing`
- Base commit: `918ec65`
- Review round: 1
- Task: `.llp/task.md`, M3-S1a service panel, second slice
- Stack: started on spec-24, then rebased onto main after its approval
- Ownership exception: renderer shell, show, control, and state paths for S1a

## What changed and why

Mounted the main-owned service header and list in both 진행 and 준비. Rows
retain their LIVE and problem indicators and existing selection behavior.
Right-click offers 삭제 immediately, without confirmation. In 진행, 준비에서
열기 passes the item to the workspace host and switches to 준비 without output.
Headers remain outside keyboard selection and support the deletion menu.

The focused service list handles Ctrl Z, Ctrl Y, and Ctrl Shift Z through
spec-24's editing engine. This never invokes clear undo. History survives
workspace remounts through a weak API-to-editor association. Pending operations
reject duplicate activation; read-only lists cannot be changed. The displayed
document still changes only through main's service projection.

Panels report failures to the host. App owns one bounded notification list and
one NotificationStack, uses `addNotice` and `removeNotice`, and passes lasting
warning height to the workspace's right column. Panels mount no local stack.

## Spec-24 nits

- Request failures now retain the thrown error's message in the returned result.
- Order snapshots compare structurally, including unknown nested fields, without
  depending on object key order. Regression coverage checks reordered keys and
  an independently changed item field. The engine's TSDoc states that later
  changes to an item's own fields make undo or redo refuse with `stale`.

## Remaining S1a work

To keep review slices near the requested size, native reorder and library-drop
wiring follow in spec-26. Their implementation is staged separately, together
with their interaction tests. Done states, 준비 details, the slide header, and
`item.start` are still assigned follow-up work. S1b remains outside this task.
The service picker waits for the lead's data-33 merge announcement.

## Checks run

| Check                                    | Result                                                      |
| ---------------------------------------- | ----------------------------------------------------------- |
| Editing engine tests, including the nits | Pass: 15 tests                                              |
| Panel, workspace, and App tests          | Pass: 71 tests in four files                                |
| Renderer TypeScript check                | Pass                                                        |
| Changed-file ESLint and Prettier         | Pass                                                        |
| `git diff --check`                       | Pass                                                        |
| Local full verify                        | Not run, per the lead's rule                                |
| GitHub branch CI                         | Exact submitted HEAD's run URL and result are in the report |

Interaction coverage checks deletion and edit undo/redo in both workspaces,
unchanged live output after deleting its item, history across workspace
remounts, read-only deletion, host error reporting and dismissal, and opening in
준비. Existing selection, row rendering, layout, and clear-key tests remain
green. No Electron process, visible window, soak, or memory measurement was
started.

## Where to look

- `show/ServiceOrderList.tsx` and `show/useServiceOrderEditing.ts`: edit
  dispatch, scoped shortcuts, pending requests, and host handoffs.
- `shell/Workspace.tsx` and `control/App.tsx`: shared list and notification
  host.
- `state/serviceOrderEdits.ts`: the two approved spec-24 nits and regression
  tests.

The request report records the exact submitted HEAD's green CI URL and result
without introducing another unverified commit for CI metadata.
