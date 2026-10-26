Review range: `c7912cfa...feat/spec/rename-delete`

# Review request: `spec-53`

- Team member: `spec` (Codex, continuing the Claude implementation)
- Branch: `feat/spec/rename-delete`, rebased onto local `main` after spec-51 and
  spec-52 merged
- Base commit: `c7912cfa6553958336c56b9ff29705dd2e891bdb`
- Review round: 3
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
  The window's pending writes track the whole action, including the rename's
  document read, so closing waits for its result and stops new actions.
- **Lists.** The dialogs follow the lists (spec-49), so a renamed or deleted row
  updates at once. A chosen source that is deleted falls back to the first 틀
  (or 빈 예배, or nothing for 가져오기), and a chosen source whose row changes
  (a rename, or another item count) is read again, so the name default and the
  tree follow it. Automatic choices keep their source id until it disappears; a
  rename that reorders the list preserves the selected source and checks.

## Decisions I made (for the lead to confirm)

1. The menu is on the source rows of the two dialogs, not on the rows of the
   service picker. The picker is ui's `Menu`, whose items can't open a menu of
   their own; adding that is a ui change. Every service is in the 새 예배
   dialog's 지난 예배 group, so each can be renamed or deleted there.
2. Rename uses a dialog, not an in-place field: ui's `ListRow` has no editing
   state.

## Changes outside my paths

`src/renderer/src/prep/services/` belongs to prep. The lead's P4 exception
covers these service dialogs and their regression tests. No shared contract or
other owner's implementation changed in rounds 2 or 3.

## Validation

| Round 3 check                                                                              | Result                                         |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `npm run typecheck`                                                                        | Pass                                           |
| `npx --no-install vitest run --no-fsModuleCache src/renderer/src/prep/services`            | Pass, 9 files and 78 tests                     |
| ESLint on `useImportItems.ts` and `ImportItemsDialog.test.tsx`                             | Pass                                           |
| `npx --no-install prettier --check src/renderer/src/prep/services docs/reviews/spec-53.md` | Pass                                           |
| GitHub CI (`npm run verify`)                                                               | Head run URL and result in the request message |

Round 1's services and show run passed 441 tests. The full round 3 verify runs
on GitHub only.

Tests: renaming a 틀 and a past service with the whole document and revision; a
refused rename keeping its dialog; deleting a 틀 after asking, and the dialog
falling back; the open service's 삭제 unavailable; the chosen 틀 read again
after a rename across the sort order, preserving unchecked items; the close
flush waiting for both template and service rename reads and writes; refusing
new rename reads after closing starts; and the delete prompt waiting while its
edit is on its way.

No Electron process, visible window, soak, or memory measurement was started.

## Team member's reply

1. `useNewService` now stores an automatic choice in `chosen`, including a
   fallback after deletion. `listedSource` keeps that id until its row
   disappears. The regression starts with two templates, renames the default so
   it sorts after the other, and checks its updated name, selected row, original
   tree, and an unchecked item. It fails without the fix by showing the other
   template's name and tree.
2. `useSourceActions` now runs the entire action through
   `pendingWritesOf(api).run`, with a refused or unsuccessful action returning
   false. This covers the rename's read and write on the same API used by the
   close flush. For both templates and services, the tests defer the read, begin
   closing, verify the flush still waits after the read completes, and finish
   the write before the flush succeeds. Separate tests confirm a close already
   in progress prevents new reads and writes. All five regression cases fail
   without the fixes.
3. Round 3: `useImportItems` now stores the automatic source in `chosen`, using
   the same rule as `useNewService`. Its regression starts with two templates,
   checks two items in the default, and renames it so it sorts after the other
   template. The original id stays selected, its checked and unchecked items
   stay unchanged, and importing sends that id with exactly the checked items.
   The test fails without the fix because the renamed template loses its
   selection.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex, codex5): Request changes: the automatically selected source
  moved when a rename changed the sort order, and rename's read and write
  bypassed the close gate.
- Round 2 (Codex, codex5): Request changes: the same moving fallback in the
  import dialog.
- Round 3 (787772b7): reviewer (Codex, codex5) Approve. Lead Approve; the menu
  lives on the 새 예배 dialog's rows (lead decision). Round 1 was written by the
  Claude 진행 member and rounds 2 and 3 by its Codex successor. Rebased by the
  lead onto local `main` without conflicts; typecheck passes. M3-P4c is
  complete, so all of P4 is in.
