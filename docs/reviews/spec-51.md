Review range: `feat/spec/new-service...feat/spec/import-items`

# Review request: `spec-51`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/import-items`, stacked on spec-50 (`feat/spec/new-service`)
- Base commit: spec-50's head, named in the request message
- Review round: 2
- Task: M3-P4, part 1 of 2 for P4b: the 다른 예배에서 가져오기 dialog
- Code owners: prep for `src/renderer/src/prep/services/` (no prep member; lead
  exception for P4); shell for `src/renderer/src/show/ServiceOrderHeader*`

## What changed and why

Spec 05 "Importing from another service" and P4's acceptance: 가져오기 appends
the checked items with their headers.

- **Dialog.** `ImportItemsDialog` is ui's `Dialog` at size `l` and height 700,
  like 새 예배: the source list without 빈 예배 on the left and the "예배 순서"
  tree on the right. Song rows show their 구성 name (spec-48). It can't be
  dismissed while an import is on its way (round 2).
- **Sources.** The 틀 and the services other than the open one. The first 틀 is
  chosen, or the newest other service when there is no 틀. Picking a source
  checks nothing, also on a return to a source (spec 05). With no source at all,
  the box says 가져올 틀이나 예배 순서가 없습니다. A failed list read offers
  다시 시도 (spec-49).
- **가져오기.** It is unavailable while nothing is checked (tooltip 항목을
  골라야 가져올 수 있습니다), while the open service is read-only (읽기 전용
  예배 순서에는 가져올 수 없습니다), and while an import is on its way. It sends
  `service.importItems` for the open service with the checked ids in order; main
  appends copies with new ids and adds the headers of picked items, and the open
  service updates through main's change, as any edit does. No live command is
  sent. A refused or rejected import reports 항목을 가져올 수 없음 and keeps the
  dialog; `write-failed` counts as done.
- **Entry.** `useServiceActions` now holds the picker's service commands and
  their dialogs, so shell's header only spreads its entries and renders its
  dialogs: 새 예배, then 다른 예배에서 가져오기, which is unavailable with no
  open service (tooltip 열린 예배 순서가 없습니다).

## Round 2 response

취소, Esc, and the close button now wait while an import is on its way, so the
dialog stays mounted until main answers: a success closes it, and a failure
shows its card with the dialog still open. 가져오기 shows the busy state as
unavailable meanwhile. A test holds an import open, presses 취소, the close
button, and Esc without closing, and then lets the import finish and close. The
새 예배 dialog had the same gap (spec-50's decision 4, merged), so it waits the
same way now, with the same kind of test; that replaces the decision.

## Decisions I made (for the lead to confirm)

1. The open service isn't offered as a source: importing a service into itself
   would only double its items, and spec 05 calls the sources "another service".
2. The dialog has no bottom bar, since spec 05 names none for 가져오기.
3. Only the service picker opens the dialog, as for 새 예배; 파일 > 다른
   예배에서 가져오기 needs the 파일 menu.

## Changes outside my paths

- `src/renderer/src/show/ServiceOrderHeader.tsx` (shell): the picker's service
  commands now come from `useServiceActions`, with tests in
  `ServiceOrderHeader.test.tsx` for both commands and the unavailable 가져오기.

## Validation

| Command or test                                                                                       | Result                 |
| ----------------------------------------------------------------------------------------------------- | ---------------------- |
| `npm run typecheck`                                                                                   | Pass                   |
| `npx --no-install vitest run --no-fsModuleCache src/renderer/src/prep/services src/renderer/src/show` | Pass, 422 tests        |
| `npx --no-install vitest run --no-fsModuleCache src/renderer/src/prep/services` (round 2)             | Pass, 56 tests         |
| `npx --no-install eslint --max-warnings 0 src/renderer/src/prep/services src/renderer/src/show`       | Pass                   |
| `npx --no-install prettier --check src/renderer/src/prep/services src/renderer/src/show`              | Pass                   |
| GitHub CI (`npm run verify`)                                                                          | In the request message |

Tests: the first 틀 with nothing checked, no 빈 예배, the open service left out,
and 가져오기 unavailable with its tooltip; checking a header with no items and
an item and importing them in order to the open service with no live command;
nothing checked after picking a source and after returning to one, and an import
from a past service; a refused and a rejected import keeping the dialog with the
card; a read-only service; no source at all; and the picker's two commands
opening and cancelling their dialogs, with 가져오기 unavailable when no service
is open.

No Electron process, visible window, soak, or memory measurement was started.
