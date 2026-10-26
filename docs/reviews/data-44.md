# Review request: `data-44`

- Team member: data (Claude session)
- Branch: `feat/data/close-flush`
- Base commit (`main`): `146547d3`
- Last code commit: `c2d3d945`; the request message gives the head commit and
  its CI run.
- Related brief: `docs/briefs/data.md`; request from `.llp/task.md`, "Claude
  takeover (from the lead, 08:10)", item 2 (the close handshake end to end on
  data-37's contract), plus the two data-45 nits.

## What changed and why

The song editor keeps up to one second of typing in the control window. Before
this request, closing the window or quitting dropped that typing: data-37
defined the flush handshake, but nothing used it.

1. **Close policy, in one place** (proposal). `closeStepAfter(outcome)` in
   `src/shared/closePolicy.ts` decides what happens after the flush: a refused
   flush keeps the window open with a warning that offers 그래도 닫기, so a
   draft is never dropped silently; a flushed editor, no reply within
   `APP_FLUSH_LIMITS.timeoutMs` (5 s), a malformed reply, or a lost renderer
   closes. Main and the control window both call it, so a different answer from
   the user changes this one function. It is marked as a proposal in its TSDoc,
   as the lead asked; the user hasn't confirmed it yet.
2. **Main** (`src/main/windows/controlClose.ts`). `registerControlClose`
   prevents the control window's `close` until the window answers
   `app:flush-request`. One request is pending at a time; a close and a quit
   that arrive together join it. Only replies from the control window's own web
   contents count, and only for the pending request id; others are logged and
   ignored. The 5 s timer, the IPC listeners, and the window listeners are
   released on an answer, on the bound, on a lost renderer, and on disposal.
   After a refusal, `app:close-anyway` from the control window closes it without
   another flush; at any other time it is ignored.
3. **Quit** (`src/main/shutdown.ts`). `ShutdownCoordinator.confirmWith` adds a
   check that runs before any save step. Main sets it to the control window's
   flush, so the editor's last typing is submitted while the data store is still
   open. False cancels the quit and the app keeps running; a check that throws
   counts as true, so the app still quits. Repeated quit requests join the
   pending check.
4. **Control window** (`src/renderer/src/prep/editor/closeFlush.ts`).
   `answerCloseFlush` answers each request with `SongEditorStore.flush()` (true
   when no editor was opened), counts a throwing flush as false and logs it, and
   reports the warning 편집 내용 저장 실패 with the action 그래도 닫기 when the
   policy says so. `ControlSession` starts it with the window and stops it on
   disposal, and the warning uses the host's existing notice stack.
5. **data-45 nits.** The registry drops the effects that a skipped child
   deferred (it truncates the effect list in `reject` and in the catch), and the
   `SliceContext.defer` TSDoc says that an effect must not dispatch
   synchronously.

## Changed files

- `src/shared/closePolicy.ts` and `.test.ts`: the outcome type and the policy.
- `src/shared/ipc.ts`: `Channels.appCloseAnyway` and `LlpApi.app.closeAnyway`.
- `src/preload/index.ts` and `.test.ts`: send close-anyway without a payload.
- `src/shared/testing/fakeLlpApi.ts` and `.test.ts`: the new default.
- `src/main/windows/controlClose.ts` and `.test.ts`: the main handshake.
- `src/main/shutdown.ts` and `.test.ts`: the confirmation check before saving.
- `src/main/index.ts` and `index.wiring.test.ts`: register the handshake,
  confirm quits with it, and dispose it on shutdown.
- `src/renderer/src/prep/editor/closeFlush.ts`, `.test.ts`, `index.ts`, and
  `README.md`: the editor's answer and the warning.
- `src/renderer/src/control/controlSession.ts`, `controlSession.test.ts`, and
  `PrepMount.test.tsx`: start and stop the answer, and no editor start after a
  close flush; the end-to-end renderer tests.
- `src/renderer/src/prep/editor/songEditorStore.ts`, `songSession.ts`, and
  `songEditorStore.test.ts` (round 2): stop editing during and after the close
  flush.
- `src/main/live/slice.ts`, `sliceRegistry.ts`, and `sliceRegistry.test.ts`: the
  data-45 nits.
- `docs/reviews/data-44.md`: this request.

## Changes outside my paths

- `src/main/windows/`, `src/main/index.ts`, `src/main/index.wiring.test.ts`,
  `src/main/live/` (output): the handshake is main's close wiring, as the
  request names it, and the nits are in the live registry. The new module
  exports a `register...` function, and its call and disposal are in `index.ts`
  and the wiring test, following "File ownership".
- `src/main/shutdown.ts` (no owner listed; output owns the wiring around it):
  the quit must ask before the save steps close the data store.
- `src/renderer/src/prep/editor/` (prep, no member): the editor's reply, as the
  request names it.
- `src/renderer/src/control/` (shell): the window session owns the editor store
  and the notice stack, so it starts and stops the answer. Without it, a window
  that never opened the editor would leave every close waiting 5 s.

## Shared contract changes (additive)

- `app:close-anyway`, `LlpApi.app.closeAnyway(): void`. It carries no payload,
  so there is nothing to validate; main checks the sender and that a refusal is
  outstanding.
- `FlushOutcome`, `CloseStep`, and `closeStepAfter` in
  `src/shared/closePolicy.ts`.

## Checks run

| Command or test                                    | Result                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                                | Pass                                       |
| Vitest (`--no-fsModuleCache`) on the changed areas | Pass: 1,723 tests in 118 files             |
| `npx eslint` on the changed files                  | Pass                                       |
| `npm run format:check`                             | Pass                                       |
| `npm run verify`                                   | GitHub CI on the head commit (see request) |

The test areas were `src/renderer/src/prep`, `control`, and `shell`,
`src/main/windows`, `src/main/index*`, `src/main/shutdown*`, `src/main/live`,
`src/shared`, and `src/preload`. No app, window, or dialog was started.

Tests for each path:

- Main: a flushed reply closes; a refusal keeps the window open until 그래도
  닫기 from the control window (not before the refusal, not from another
  window); the next close after a refusal asks again; no reply closes at exactly
  5 s with no timer left; replies from another window, for another id, or
  malformed are ignored; a close and a quit share one request; a lost renderer
  or a failed send closes at once; disposal settles the request and removes
  every listener.
- Quit: the check runs before any step; false keeps the app running and a later
  quit asks again; repeated quits share one check; a throwing check quits; in
  the wiring, the check runs before the first step and the handshake is disposed
  after the data store closes.
- Control window: a typed but unsent lyric (no edit sent yet) is submitted
  before the reply `true`, through the real editor and session; a refusal
  replies `false`, shows 편집 내용 저장 실패 in the host's stack, and 그래도
  닫기 sends close-anyway and dismisses it; a throwing flush is logged and
  refused; disposal removes the subscription.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (replies with
      `parseAppFlushDone` and the pending id; close-anyway has no payload)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released
- [x] Caches and lists have size caps (one pending request)
- [x] An exception in the output path doesn't stop the output (no output path
      change; a failing check or flush still lets the app quit)
- [x] Only what's needed re-renders (control window)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not relevant

## Decisions I made (for the lead to confirm)

1. **The 그래도 닫기 policy (proposal).** Implemented as the task states; the
   rule lives only in `closeStepAfter`.
2. **The flush bound comes before the save limit.** The quit check can take up
   to 5 s before the 3 s save limit starts, so a quit with an unanswering window
   takes at most about 10 s with the log flush. Folding the check into the save
   limit would leave the data store less than its 3 s.
3. **Close-anyway closes the window, and that quits the app**, as any control
   window close does now. A refusal during a quit cancels the quit; 그래도 닫기
   then closes the window, which quits.
4. **Warning text.** 편집 내용 저장 실패 follows the existing notice titles (곡
   저장 실패, 구성 변경 실패), with the `warning` icon, and 그래도 닫기 uses the
   `x` icon of the title bar's 닫기. The editor's own failure cards, such as 곡
   저장 실패, are unchanged and can show beside it.
5. Branch tag `feat`: the close and quit paths behave differently now.

## Where to look

- `src/main/windows/controlClose.ts`: the pending request, the sender and id
  checks, and every release path.
- `src/main/shutdown.ts`: the `confirming` phase and that a cancelled quit
  returns to `running`.
- `src/renderer/src/control/PrepMount.test.tsx`: the typed but unsent edit.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1.

## Round 2 reply

1. [P1] `closeFlush.ts:61`, the editor stayed writable during and after the
   flush. Fixed in
   `fix(prep): stop editing from the close flush until a refusal restarts it`.
   `SongEditorStore.flush()` now stops every edit before it flushes: each
   session refuses lyric, title, background, and arrangement edits, the store
   refuses label and arrangement operations, and the snapshot reports `busy`, so
   the editor's fields turn read-only with the existing 저장 중 reason. A
   refused or throwing flush restarts editing; after a successful flush, editing
   stays stopped until the window closes, which matches main caching the
   confirmation. `ControlSession` also refuses to start an editor while a close
   flush runs or after it succeeded, so a window that answered without an editor
   can't open one and lose its typing. Regressions: the store ignores typing and
   a new arrangement during the flush and after `true`, and accepts typing again
   after `false` (`songEditorStore.test.ts`); through the mounted editor, after
   the reply `true` the lyric field is read-only and a late change sends no edit
   (`PrepMount.test.tsx`); a session without an editor starts none after its
   reply (`controlSession.test.ts`).

## Round 3 reply

1. Removed the TSDoc from the private `ControlSession.flushBeforeClose`
   (`style(shell): drop the doc comment of a private session method`).
2. Rebased onto `main` at `146547d3` (after ui-31 to ui-36). ui-31 had moved
   session creation into `SongEditorStore.sessionFor` and added
   `SongSession.clean` and `setArrangementSlides`; the rebase passes
   `editingStopped` from `sessionFor`, so sessions that a 예배 순서 item
   attaches stop too, keeps both getters, and gates `setArrangementSlides` like
   the other edits. The store regression now also checks that a 구성's order
   can't change during or after a successful flush and can after a refusal.
3. ui-32 and ui-33 added `ServiceItemStore` to `ControlSession`; its disposal
   joins the close flush's release, and its new `SongSession.copyArrangement` is
   gated like the other edits. Its 예배 순서 edits are sent at once, and its
   song edits go through the stopped sessions, so the close flush covers it.
