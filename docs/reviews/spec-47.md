Review range: `574e7369...feat/spec/recovery-dialog`

# Review request: `spec-47`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/recovery-dialog`
- Base commit: `574e7369`
- Review round: 1
- Task: M3-S2b, the 출력 상태 복구 dialog on output-30's recovery answer
- Code owner: shell (`src/renderer/src/control/recovery/` and `App.tsx`)

## What changed and why

Spec 08 "Crash and restart" asks, after a crash, which output state to bring
back. output-30 (merged) holds the outputs off and the startup 매크로 after a
crash, and answers `recovery.summary()`, `recovery.apply({savedAt, rows})`, and
`recovery.startFresh()`. This request adds the dialog that asks.

- **Dialog.** `RecoveryDialog` uses ui's `AlertDialog` with the `history` icon,
  the title 출력 상태 복구, the detail line 비정상 종료 and the record's local
  time ("10월 25일 오전 11:26"), and a 복구할 상태 group of `CheckRow`s, as the
  design system's AlertDialog README and gallery show. It lists only the rows
  main offers, in main's order, all checked at first: 화면 출력 (the screen
  names), 마지막 슬라이드 (title and "2 / 9"), and 표시 중이던 항목 (메시지,
  소품, 무대 메시지, 공지, 무대 배치 with their counts, zero counts left out).
  Enter is 복구 and Esc is 새로 시작; focus starts on 복구; with no row checked,
  복구 is unavailable (its tooltip says no state is chosen), also for Enter.
  Both buttons and the rows wait while an answer is on its way.
- **Answer.** `useRecovery` reads the offer once (`null` shows nothing, so a
  record with nothing to restore launches normally, as output-30 does). 복구
  sends the checked rows with the offer's `savedAt`; 새로 시작 sends
  `startFresh()`. A success or `unavailable` closes the dialog. `stale` or
  `invalid-selection` (main keeps waiting) reads the offer again and shows its
  rows. `apply-failed` closes the dialog and reports 출력 상태 복구 실패 on the
  app's notice list. A request that fails (the channel rejects) keeps the dialog
  so the operator can answer again, and reports the same card.
- **F1 to F7** keep working: ui's modal lets them pass, and the app's capture
  listener clears; a mounted test presses F1 with the dialog open.
- `RecoveryPrompt` mounts it in `App` next to the notification stack.

## Decisions I made (for the lead to confirm)

1. How each answer failure behaves, as above. Spec 08 doesn't say; the rule
   keeps main's waiting state and the dialog in step, and never leaves the app
   in standby with no way to answer.
2. 표시 중이던 항목 names stage layouts 무대 배치, the term spec 06 and 10 use.
   output-30 offers that count as 0 until M3-O5.
3. The status bar's 대기 during the dialog (spec 08 "What the app does") isn't
   in S2b's scope; the status bar shows output state today, all off.

## Changes outside my paths

None. `src/renderer/src/control/recovery/` and `App.tsx` are shell's.

## Validation

| Command or test                                                     | Result                 |
| ------------------------------------------------------------------- | ---------------------- |
| `npm run typecheck`                                                 | Pass                   |
| `npx --no-install vitest run --no-fsModuleCache src/renderer`       | Pass, 1,701 tests      |
| `npx --no-install eslint --max-warnings 0 src/renderer/src/control` | Pass                   |
| `npx --no-install prettier --check src/renderer/src/control`        | Pass                   |
| GitHub CI (`npm run verify`)                                        | In the request message |

Tests: the row texts and their order, the local time in morning, noon, midnight,
and evening; the dialog's checked rows, focus, Enter with a row unchecked, Esc,
복구 unavailable with none checked, and the busy state; and the mounted app: no
dialog for no offer, 복구 with the offer's `savedAt` and rows, 새로 시작, a
stale answer showing the new offer's rows, apply-failed closing with the card, a
rejected request keeping the dialog with the card, and F1 during the dialog.

No Electron process, visible window, soak, or memory measurement was started.
