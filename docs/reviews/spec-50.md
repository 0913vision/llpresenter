Review range: `feat/spec/service-sources...feat/spec/new-service`

# Review request: `spec-50`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/new-service`, stacked on spec-49
  (`feat/spec/service-sources`), which is stacked on spec-48
- Base commit: spec-49's head, named in the request message
- Review round: 2
- Task: M3-P4, part 3 of 3 for 새 예배 (P4a): the dialog, its create flow, and
  its entry in the service picker
- Code owners: prep for `src/renderer/src/prep/services/` (no prep member; lead
  exception for P4); shell for `src/renderer/src/show/ServiceOrderHeader*`

## What changed and why

Spec 05 "New service" and P4's acceptance: creating from a 틀 copies the checked
items with new ids and makes the new service current without an output command,
and 만들기 is unavailable while the name is empty.

- **Dialog.** `NewServiceDialog` is ui's `Dialog` at size `l` and height 700, as
  the gallery's 새 예배 example: the source list (spec-49) on the left, the
  "예배 순서" box (spec-48) on the right, and 이름, 날짜, and 시간 in the bottom
  bar. 취소 and 만들기 are in the footer.
- **Defaults.** The first 틀 is chosen when there is one, else 빈 예배. Choosing
  a 틀 or a past service checks every item; 빈 예배 leaves the box empty. The
  name is the source's name, or 새 예배 for 빈 예배; the date is today; the time
  is the 틀's time, the past service's time, or the current hour for 빈 예배. A
  name or time the operator chose stays when they pick another source.
- **만들기.** It is unavailable while the trimmed name is empty, with the
  tooltip 이름을 적어야 만들 수 있습니다, also for Enter, and while the source
  loads or a create is on its way. It sends `service.create` with the trimmed
  name, `날짜T시간`, and no 틀, then, when items are checked,
  `service.importItems` from the 틀 or past service with the checked ids in
  order (main adds their headers and gives every copy a new id, as
  `contentStore.test.ts` "appends imported items in source order with new ids"
  covers), then `service.open` and `applyService`, as the service picker does.
  No live command is sent.
- **Failures.** Each step fails on its own (round 2). A refused or rejected
  create reports 새 예배를 만들 수 없음 and keeps the dialog. A refused or
  rejected import deletes the new, empty service again (it isn't the current
  one, so main allows it) and reports the same card, so nothing is left behind.
  If that delete fails too, the empty service is opened, the dialog closes, and
  the card says 새 예배에 항목을 가져올 수 없음. A service that can't be opened
  (no answer, or a rejected call) closes the dialog and reports 새 예배를 열 수
  없음; the service is in the list. Every failure after the create closes the
  dialog, so a retry never makes a second service. `write-failed` counts as
  made, since main keeps the edit and saves it later. Rejected calls are logged.
- **Entry.** The service picker ends with 새 예배 after a separator (none when
  no service is listed), as the ServiceSwitch board shows. It closes the menu
  and opens the dialog. Notices go to the same `onProblem` the picker uses.

## Round 2 response

1. **Selection.** Choosing a source clears the operator's changes, so every item
   is checked again, also on a return to a source they changed (spec 05). A test
   unchecks an item in the 틀, picks 빈 예배, returns to the 틀, and finds the
   item checked.
2. **Failures by phase.** The create keeps the new id through its steps, and
   each step's rejection is caught on its own (`settle`), as above. Tests: a
   rejected import deletes the new service and keeps the dialog; a refused
   import whose delete is rejected opens the empty service and closes with its
   card; a rejected open closes with its card after one create.
3. spec-49's retry is wired: while a list read has failed, the left list offers
   다시 시도. A test fails the 틀 list once and retries it.

## Decisions I made (for the lead to confirm)

1. The create flow uses `service.create` with no 틀 and then
   `service.importItems`, so only the checked items come along (agreed in the P4
   contract answer).
2. A failed import deletes the new service, or opens it when the delete fails
   too, as above.
3. Only the service picker opens the dialog in this request. 파일 > 새 예배 and
   a shortcut need the 파일 menu, which is inert in shell today.
4. 취소 stays available while a create is on its way. The dialog closes, and the
   service main makes still becomes current when it opens.

## Changes outside my paths

- `src/renderer/src/show/ServiceOrderHeader.tsx` (shell): the 새 예배 item at
  the end of the picker and the dialog mount, with a test in
  `ServiceOrderHeader.test.tsx`.

## Validation

| Command or test                                                                                                     | Result                 |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `npm run typecheck`                                                                                                 | Pass                   |
| `npx --no-install vitest run --no-fsModuleCache src/renderer/src/prep src/renderer/src/show src/renderer/src/shell` | Pass, 757 tests        |
| `npx --no-install eslint --max-warnings 0 src/renderer/src/prep/services src/renderer/src/show`                     | Pass                   |
| `npx --no-install prettier --check src/renderer/src/prep/services src/renderer/src/show`                            | Pass                   |
| GitHub CI (`npm run verify`)                                                                                        | In the request message |

Tests: the defaults from the first 틀 (all checked, name, date, time, list
rows); creating from the 틀 with one item unchecked (the create and import
edits, the open, the current service, no live command); 만들기 unavailable for a
blank name, for a click and Enter, with its tooltip; 빈 예배 with the current
hour and no import; a past service with its time and items; a typed name kept
across sources; every item checked again on a return to a source; a refused or
rejected import deleting the new service and keeping the dialog; a failed delete
opening the empty service; a refused create; `write-failed` going on; an open
that answers nothing or is rejected closing with its card; the retry line; and
the picker ending with 새 예배, opening and cancelling the dialog.

No Electron process, visible window, soak, or memory measurement was started.
