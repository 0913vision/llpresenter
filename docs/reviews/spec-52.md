Review range: `feat/spec/import-items...feat/spec/save-template`

# Review request: `spec-52`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/save-template`, stacked on spec-51
  (`feat/spec/import-items`)
- Base commit: spec-51's head, named in the request message
- Review round: 1
- Task: M3-P4, part 2 of 2 for P4b: 지금 예배를 틀로 저장
- Code owners: prep for `src/renderer/src/prep/services/` (no prep member; lead
  exception for P4); shell for `src/renderer/src/show/ServiceOrderHeader*`

## What changed and why

Spec 05 "Saving the current service as a 틀": save a copy of the current service
as a new 틀 named after it, keeping every item as it is, and ask when a 틀 with
that name exists.

- **Saving.** `useSaveTemplate` reads the 틀 list and, when no 틀 has the open
  service's name, sends `service.saveAsTemplate` with that name. Main copies
  every item with new ids and keeps slots as slots, and the 틀's time comes from
  the service's time, all in main. A saved 틀 shows the information card "‘주일
  예배’ 틀로 저장됨", which closes after 6 seconds (spec 08).
- **Name taken.** The confirmation `SaveTemplatePrompt` is ui's `AlertDialog`
  with the spec's title "‘주일 예배’ 틀이 이미 있습니다. 덮어쓸까요?" and 취소,
  새 틀로 저장, and 덮어쓰기. 새 틀로 저장 saves under the first free name, such
  as 주일 예배 2. 덮어쓰기 saves the new 틀 first and then deletes the old one
  (`template.delete`), so a failure never loses the 틀 the operator had; this is
  the overwrite agreed in the P4 contract answer. The buttons wait while a save
  is on its way.
- **Failures.** A failed list read or a refused or rejected save reports 틀로
  저장할 수 없음; an old 틀 that can't be deleted after overwriting reports 기존
  틀을 지울 수 없음. Rejected calls are logged (`settle`, now shared in
  `serviceEdits.ts`).
- **Entries.** 지금 예배를 틀로 저장 ends the service picker, and it is the
  button under the source list of the 새 예배 dialog, as spec 05 and the gallery
  show. Both are unavailable with no open service (열린 예배 순서가 없습니다)
  and while a save is on its way. The 새 예배 dialog's list follows the 틀 list
  (spec-49), so the new 틀 shows up there.

## Decisions I made (for the lead to confirm)

1. 덮어쓰기 is the primary button, last, as the spec lists the buttons. Enter
   overwrites; Esc cancels.
2. 새 틀로 저장 uses the next free name instead of a second 틀 with the same
   name, so the two stay apart in the lists.
3. The success card. Spec 05 says nothing about feedback, and with no dialog the
   operator would otherwise see nothing happen from the picker.

## Changes outside my paths

- `src/renderer/src/show/ServiceOrderHeader.test.tsx` (shell): the picker's
  command list and the unavailable command with no service. The header itself
  doesn't change; the command comes from `useServiceActions`.

## Validation

| Command or test                                                                                       | Result                 |
| ----------------------------------------------------------------------------------------------------- | ---------------------- |
| `npm run typecheck`                                                                                   | Pass                   |
| `npx --no-install vitest run --no-fsModuleCache src/renderer/src/prep/services src/renderer/src/show` | Pass, 431 tests        |
| `npx --no-install eslint --max-warnings 0 src/renderer/src/prep/services src/renderer/src/show`       | Pass                   |
| `npx --no-install prettier --check src/renderer/src/prep/services src/renderer/src/show`              | Pass                   |
| GitHub CI (`npm run verify`)                                                                          | In the request message |

Tests: saving with no name taken and the card; the prompt for a taken name and
새 틀로 저장 skipping a taken 주일 예배 2; 덮어쓰기 saving and then deleting;
취소 sending nothing; a refused save, a failed list read, and an old 틀 left
behind; saving from the 새 예배 dialog with the new 틀 showing in its list; and
the command unavailable with no open service.

No Electron process, visible window, soak, or memory measurement was started.
