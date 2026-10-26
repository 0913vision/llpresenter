Review range: `feat/spec/save-template...feat/spec/rename-delete`

# Review request: `spec-53`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/rename-delete`, stacked on spec-52
  (`feat/spec/save-template`)
- Base commit: spec-52's head, named in the request message
- Review round: 1
- Task: M3-P4c, rename and delete for 틀 and 예배 순서
- Code owner: prep for `src/renderer/src/prep/services/` (no prep member; lead
  exception for P4)

## What changed and why

Spec 05 "Saving the current service as a 틀": version 1 adds a right-click menu
with 이름 바꾸기 and 삭제; delete asks in a confirmation dialog, and the current
service can't be deleted. P4's acceptance: the current service can't be deleted.

- **Menu.** A right click on a 틀 or 지난 예배 row in the 새 예배 and 다른
  예배에서 가져오기 dialogs (or the context menu key while the row has focus)
  opens a menu with 이름 바꾸기 and 삭제. 삭제 is unavailable for the open
  service, with the tooltip 열린 예배 순서는 삭제할 수 없습니다; main refuses it
  too.
- **이름 바꾸기.** A small dialog (ui `Dialog` size `s`) with the 이름 field,
  filled with the current name. 바꾸기 is unavailable while the trimmed name is
  empty (tooltip 이름을 적어야 바꿀 수 있습니다) or unchanged. It reads the 틀
  or service and sends `template.update` or `service.update` with the whole
  document, the new name, and the revision it read, so main refuses it as stale
  if the document changed in between. A refusal reports 이름을 바꿀 수 없음 and
  keeps the dialog.
- **삭제.** ui's `AlertDialog` asks "‘주일 예배’ 틀을 삭제할까요?" (or "예배
  순서를"), with 취소 and 삭제. It sends `template.delete` or `service.delete`;
  a refusal reports 삭제할 수 없음.
- **While it works.** The rename and delete dialogs can't be dismissed while
  their edit is on its way, as spec-51 round 2 settled for the service dialogs.
- **Lists.** The dialogs follow the lists (spec-49), so a renamed or deleted row
  updates at once. A chosen source that is deleted falls back to the first 틀
  (or 빈 예배, or nothing for 가져오기), and a chosen source whose row changes
  (a rename, or another item count) is read again, so the name default and the
  tree follow it.

## Decisions I made (for the lead to confirm)

1. The menu is on the source rows of the two dialogs, not on the rows of the
   service picker. The picker is ui's `Menu`, whose items can't open a menu of
   their own; adding that is a ui change. Every service is in the 새 예배
   dialog's 지난 예배 group, so each can be renamed or deleted there.
2. Rename uses a dialog, not an in-place field: ui's `ListRow` has no editing
   state.

## Changes outside my paths

None.

## Validation

| Command or test                                                                                       | Result                 |
| ----------------------------------------------------------------------------------------------------- | ---------------------- |
| `npm run typecheck`                                                                                   | Pass                   |
| `npx --no-install vitest run --no-fsModuleCache src/renderer/src/prep/services src/renderer/src/show` | Pass, 441 tests        |
| `npx --no-install eslint --max-warnings 0 src/renderer/src/prep/services src/renderer/src/show`       | Pass                   |
| `npx --no-install prettier --check src/renderer/src/prep/services`                                    | Pass                   |
| GitHub CI (`npm run verify`)                                                                          | In the request message |

Tests: renaming a 틀 and a past service with the whole document and revision; a
refused rename keeping its dialog; deleting a 틀 after asking, and the dialog
falling back; the open service's 삭제 unavailable; the chosen 틀 read again
after a rename; and the delete prompt waiting while its edit is on its way.

No Electron process, visible window, soak, or memory measurement was started.
