# Review request: `data-48`

- Team member: data (Claude session)
- Branch: `feat/data/saving-dialog`, stacked on data-44
  (`feat/data/close-flush`)
- Base commit: the data-44 head; the request message gives the range, the head
  commit, and its CI run.
- Related brief: `docs/briefs/data.md`; the lead's message of 10:55 and the user
  decision in `docs/decisions.md`, "Closing the app while edits are still being
  saved".

## What changed and why

The user chose a 저장 중 dialog, as editors such as VS Code hold their window
while they save, instead of the lead's proposal of a "편집 내용 저장 실패" card
with 그래도 닫기 (data-44).

1. **The dialog** (`src/renderer/src/control/SavingDialog.tsx`). An
   `AlertDialog` with the saved icon and no body text: title "저장 중" while the
   flush runs, "저장할 수 없음" after a refusal, with 강제로 닫기 and 다시 시도.
   다시 시도 is the primary button; it is unavailable while saving, so Enter
   never drops an edit (the design system's disabled buttons stay focusable, and
   focus starts on the primary one). 강제로 닫기's tooltip gives the
   consequence: "저장하지 못한 편집은 사라집니다". Esc does nothing.
2. **When it shows** (`src/renderer/src/control/closeFlush.ts`). `CloseFlush`
   replaces data-44's `answerCloseFlush` and holds the dialog's state: it
   answers main's flush request, shows 저장 중 only when the flush takes longer
   than `SAVING_DIALOG_DELAY_MS` (300 ms), so a normal close never flashes it,
   and keeps it until main closes the window after a successful flush. A refusal
   shows 저장할 수 없음 at once. 다시 시도 asks main to close again
   (`window.control('close')`), which runs the whole handshake again; 강제로
   닫기 sends `app.closeAnyway()`.
3. **강제로 닫기 during the flush** (`src/main/windows/controlClose.ts`). Main
   honored close-anyway only after a refusal. It now also ends a running flush
   as the new outcome `forced`, which closes, so the operator can leave a slow
   save. No reply within 5 s still closes without the dialog (data-44).
4. **Policy wording.** `closeStepAfter` loses "(proposal)" and cites the user
   decision; the rule itself is unchanged.
5. **Spec.** Spec 08 gets "Closing while edits are being saved".

## Changed files

- `src/shared/closePolicy.ts` and `.test.ts`: the `forced` outcome and the
  decision's wording.
- `src/shared/ipc.ts`: the `closeAnyway` TSDoc (강제로 닫기, also during a
  flush).
- `src/main/windows/controlClose.ts` and `.test.ts`: close-anyway during a
  running flush.
- `src/preload/index.test.ts`: the test name.
- `src/renderer/src/control/closeFlush.ts` and `.test.ts`: the answer and the
  dialog state (new).
- `src/renderer/src/control/SavingDialog.tsx` and `.test.tsx`: the dialog (new).
- `src/renderer/src/control/controlSession.ts`, `App.tsx`, and
  `PrepMount.test.tsx`: own and render it; the refused-draft test now goes
  through the dialog.
- `src/renderer/src/prep/editor/closeFlush.ts` and `.test.ts` (removed),
  `index.ts`, and `README.md`.
- `docs/spec/08-problems.md`: the dialog.
- `docs/reviews/data-48.md`: this request.

## Changes outside my paths

- `src/renderer/src/control/` (shell): the window session owns the dialog and
  the app renders it.
- `src/renderer/src/prep/editor/` (prep): data-44's answer moves out of the
  editor, which keeps only its `flush()`.
- `src/main/windows/` (output): close-anyway during a flush.
- `docs/spec/08-problems.md` (spec): the lead asked for the spec change in this
  request.

## Shared contract changes

- `FlushOutcome` gains `forced`; `closeAnyway` is also honored during a flush.
  Both are additive: the channel and its payload are unchanged.

## Checks run

| Command or test                                    | Result                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                                | Pass                                       |
| Vitest (`--no-fsModuleCache`) on the changed areas | Pass: 1,638 tests in 109 files             |
| `npx eslint` on the changed files                  | Pass                                       |
| `npm run format:check`                             | Pass                                       |
| `npm run verify`                                   | GitHub CI on the head commit (see request) |

Tests: no dialog when the flush ends within the delay, and no timer left; 저장
중 at exactly the delay and kept after a successful reply; 저장할 수 없음 at
once on a refusal or a throwing flush (logged); 다시 시도 shows 저장 중 at once,
asks main to close, and answers the next request; 강제로 닫기; dispose releases
the subscription and the timer; the dialog's titles, the disabled and focused
다시 시도 while saving, the focused 다시 시도 after a refusal, and 강제로 닫기's
tooltip; through the mounted editor, a refused flush shows the dialog and no
warning card, 다시 시도 and 강제로 닫기 reach the API; main closes at once on
강제로 닫기 during a flush and a close and a quit waiting on it both resolve.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released
- [x] Caches and lists have size caps
- [x] An exception in the output path doesn't stop the output (no output change)
- [x] Only what's needed re-renders (control window): the dialog reads one
      external store and renders nothing while hidden
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not relevant

## Decisions I made (for the lead to confirm)

1. The title changes to "저장할 수 없음" after a refusal, the term spec 02 and
   08 use for a save failure; the decision says only that the modal stays and
   offers 다시 시도.
2. 다시 시도 is always shown, disabled while saving, so the button row doesn't
   jump and Enter is safe. Once the dialog is visible, 다시 시도 shows 저장 중
   at once, without the delay.
3. 다시 시도 goes through main (`window.control('close')`) instead of flushing
   in the window and then forcing the close, so main stays the one place that
   decides; a refusal during a quit cancelled that quit, and the retried close
   quits the app as any control window close does.
4. 강제로 닫기 also works while the flush is still running, not only after a
   refusal.
5. The saved icon, as the dialog is about saving.

## Where to look

- `src/renderer/src/control/closeFlush.ts`: the delay, the state changes, and
  the release.
- `src/main/windows/controlClose.ts`, `handleCloseAnyway`.
- `docs/spec/08-problems.md`, "Closing while edits are being saved".

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (63e8ff43): reviewer (Codex, codex4) Approve, no findings, as a review
  stacked on data-44. Restacked several times after data-44's rounds and
  spec-45; `git range-diff` shows only import context lines changed in its shell
  commit, the other five identical. Lead Approve; the dialog follows the user's
  decision of October 26 (a "저장 중" modal with 강제로 닫기). Rebased by the
  lead onto local `main` without conflicts; typecheck passes.

## Team member's reply

1.
