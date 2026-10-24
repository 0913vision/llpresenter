# Review request: `data-16`

Review range: `0e180a1...fix/data/service-get-rejects`

- Team member: `data`
- Branch: `fix/data/service-get-rejects`
- Base commit (`main`): `0e180a1`
- Last commit: see the commit that adds this file
- Related brief: shell's request from shell-14 (codex2 finding 2), through the
  lead: a failed `service.get()` must not look like "no 예배 순서"

What to check:

1.  `invokeChecked` in `src/preload/index.ts` logs a failed call or a malformed
    answer as before, and then rejects instead of answering a fallback.
2.  All four reads use it: `live.get`, `ui.get`, `output.getStatus`, and
    `service.get`. `service.get` still resolves `null` when the main process
    answers that no 예배 순서 is open.
3.  The TSDoc of each read in `src/shared/ipc.ts` says that it rejects on a
    failure.
4.  Every caller already handles a rejection (below), so no window changes.

## Shared changes

1.  `src/preload/index.ts`: the four reads reject, after logging, on a failed
    call or a malformed answer. They used to answer `null`, `{}`, or an empty
    live state.
2.  `src/shared/ipc.ts`: the TSDoc of the four reads.

## What changed and why

`service.get()` answered `null` both when no 예배 순서 was open and when the
read failed, so the 진행 view could clear on a failure. The lead asked to check
the other reads for the same pattern:

| Read               | Old answer on a failure | Why that was wrong                                                                                                                       | Caller's handling of a rejection                                                                    |
| ------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `service.get`      | `null`                  | Looks like "no 예배 순서"; the view clears                                                                                               | Shell logs it and keeps the view (shell-14, with a test)                                            |
| `live.get`         | an empty live state     | Version 0 with nothing on: an output window that reloads would draw an empty screen, and the control window would show nothing on output | `followLiveState` (output) logs it; `startLiveSync` (shell) ignores it; both wait for the next push |
| `ui.get`           | `{}`                    | Harmless, but the same pattern                                                                                                           | `loadUiState` (shell) logs it and starts from the defaults, as before                               |
| `output.getStatus` | `{}`                    | Looks like "no screens"                                                                                                                  | No caller yet                                                                                       |

So every read now has one rule: a real answer resolves, and a failure logs and
rejects. The pushes (`subscribe`) keep dropping a malformed push after logging
it, since a push has no caller to reject to.

## Changed files

- `src/preload/index.ts` and its test.
- `src/shared/ipc.ts`.
- `docs/reviews/data-16.md` (new).

## Checks run

`npm run verify` on the commit before this document (c5b34bb), on `main`
0e180a1: every step passed (207.1 s, steps at once).

| Command or test                    | Result                       |
| ---------------------------------- | ---------------------------- |
| `npm run typecheck`                | Passed (48.7 s)              |
| `npm run lint`                     | Passed (91.4 s)              |
| `npm run format:check`             | Passed (110.8 s)             |
| `npm test`                         | Passed as `test:coverage`    |
| `npm run build`                    | Passed (13.5 s)              |
| `npm run verify` (from phase 1 on) | Passed: every step (207.1 s) |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests: the preload tests run
      the real preload with a mocked `ipcRenderer`; a failure rejects for each
      read, and `service.get` still resolves a real `null`.
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: unchanged.
- [x] Caches and lists have size caps: nothing is kept.
- [x] An exception in the output path doesn't stop the output: an output window
      that can't read the live state keeps its picture and waits for a push.
- [x] Only what's needed re-renders (control window): no UI change.
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not measured.

## Where to look

- `src/preload/index.ts`: `invokeChecked`.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (e186235): reviewer (Codex, codex3) Approve with no findings. Lead
  Approve; `live.get`, `ui.get`, `output.getStatus`, and `service.get` log and
  reject a failed or malformed read instead of answering a fallback, and
  `service.get` still answers a real `null`. Every caller already handles a
  rejection. Rebased by the lead onto local `main` without conflicts.

## Team member's reply

1.
