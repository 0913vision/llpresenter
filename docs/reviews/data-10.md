# Review request: `data-10`

Review range: `f8dc565...feat/data/output-status`

- Team member: `data`
- Branch: `feat/data/output-status`
- Base commit (`main`): `f8dc565`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/data.md`; `docs/spec/08-problems.md`, "Output
  window crash" ("Restarting" and "The restart limit")

What to check:

1.  `src/shared/schema/outputStatus.ts`: the shape the lead gave, and that every
    field is checked: the placement and renderer states as closed lists, `fps`
    as `null` or a finite number from 0 to 240, `fpsLow` as a boolean, and
    screen ids that aren't empty.
2.  `src/preload/index.ts`: `getStatus` and `subscribeStatus` check every reply
    and push; a bad reply is logged and gives `{}`, and a bad push is logged and
    dropped. `retry` sends `{screenId}`.
3.  `src/shared/testing/fakeLlpApi.ts`: a test can now replace one member of a
    part and keep the other defaults, so the new members don't break output's
    `startOutput.test.ts`, which passes only `output.reportFrameRate`.

## Shared changes

All in data's paths:

1.  `src/shared/schema/outputStatus.ts` (new):
    - `OutputScreenStatus {placement, renderer, fps, fpsLow}`.
      - `placement` is `off`, `fullscreen`, `window`, or `monitorMissing`, as
        output's `OutputStatus` in `src/main/outputs/manager.ts` has it.
      - `renderer` is `running`, `restarting`, or `limited` (the restart limit
        of spec 08).
    - `OutputStatuses`: a record of every screen's status, by screen id.
    - `OutputRetryRequest {screenId}`.
    - `parseOutputStatuses` and `parseOutputRetryRequest`.
2.  `src/shared/ipc.ts`: three channels.
    - `output:status:get` (invoke, answers `OutputStatuses`).
    - `output:status:changed` (push, `OutputStatuses`).
    - `output:retry` (send, `OutputRetryRequest`).
    - `LlpApi.output` gains `getStatus()`, `subscribeStatus(listener)`, which
      returns an `Unsubscribe`, and `retry(screenId)`.
3.  `src/preload/index.ts`: the three calls, with the same checks as the live
    state and the service.
4.  `src/shared/schema/ipcPayloads.ts`: exports `FRAME_RATE_MAX` (240), so a
    frame rate report and a status share one limit.
5.  `src/shared/testing/fakeLlpApi.ts`: overrides are per member now
    (`FakeLlpApiParts`). Every test that passed whole parts still works.

## What changed and why

Spec 08 asks the control window to show a screen whose output window hit the
restart limit: the amber outline on its preview, and the notification "출력 창을
다시 띄울 수 없음" with 다시 시도. That needs the main process's view of every
output window, and a way to ask for the attempt. This request adds only the
contract; output builds the main side on it (answering `output:status:get`,
pushing `output:status:changed`, and handling `output:retry` with
`parseOutputRetryRequest`), and shell builds the status bar and the action.

- A push carries every screen's status, not one screen's change, so a window
  never has to merge partial updates and can't drift from the main process.
- The preload falls back to `{}` (no screens known) instead of a guess, so a bad
  reply never shows a screen as on.
- `fps` is `null` before a window's first report and while it is off, so a
  window can tell no report from a rate of 0.
- `fpsLow` is the main process's judgment. The spec gives no threshold yet;
  output decides it with the measurements and keeps one rule for every window.

## Changed files

- `src/shared/schema/outputStatus.ts` and its test (new),
  `src/shared/schema/ipcPayloads.ts`.
- `src/shared/ipc.ts`, `src/preload/index.ts` and its test.
- `src/shared/testing/fakeLlpApi.ts` and its test.
- `docs/reviews/data-10.md` (new).

## Checks run

`npm run verify` on the commit before this document (08dd353), on `main`
f8dc565, which now runs the steps at once:

| Command or test                    | Result                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| `npm run typecheck`                | Passed (36.5 s)                                                                         |
| `npm run lint`                     | Failed inside verify on a file it didn't find (see below); passed when run alone        |
| `npm run format:check`             | Passed (91.0 s)                                                                         |
| `npm test`                         | Passed as `test:coverage` (174.1 s)                                                     |
| `npm run build`                    | Passed (13.8 s)                                                                         |
| `npm run verify` (from phase 1 on) | Failed on the lint step only: `ENOENT ... electron.vite.config.ts.1792874585594-...mjs` |

The lint failure isn't in this change. With the steps at once, the build step
writes electron-vite's temporary `electron.vite.config.ts.<number>.mjs` next to
the config and deletes it; lint listed it and then couldn't open it.
`npm run lint` alone passed on the same commit. Reported to the lead for devops.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes: every step passed except the lint step's crash on
      the build's temporary file; lint alone passed
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema: the preload
      checks every status reply and push, and `parseOutputRetryRequest` is there
      for the main process.
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: `subscribeStatus` returns a function
      that removes the listener, and a test checks it.
- [x] Caches and lists have size caps: nothing is kept.
- [x] An exception in the output path doesn't stop the output: the preload never
      throws on bad data.
- [x] Only what's needed re-renders (control window): no UI.
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not measured.

## Decisions I made (for the lead to confirm)

1.  The status of a screen with no window yet is up to output; the contract only
    says what each value means.
2.  `fakeLlpApi` merges per member. Its TSDoc already promised that new channels
    never break existing tests, and adding members to `output` broke output's
    test without it.

## Where to look

- `src/shared/schema/outputStatus.ts`: the TSDoc of each state.
- `src/shared/testing/fakeLlpApi.ts`: the per-member merge.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (374522b): reviewer (Codex, codex3) Approve, no findings. Lead
  Approve. output builds the restart-limit card and the preview's amber outline
  on these contracts. The verify run hit the lint and build race in the new
  parallel verify, which devops fixes in devops-14. Rebased by the lead onto
  local `main` without conflicts.

## Team member's reply

1.
