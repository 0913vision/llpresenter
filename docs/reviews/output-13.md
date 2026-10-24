# Review request: `output-13`

Review range: `6d8332f...feat/output/soak-wiring`. Check that
`src/main/index.ts` wires devops-13's soak scenario and frame rate source as its
"Wiring for output" asks, that the soak scenario stops first when the app quits,
and that nothing changes when no soak run is asked for (`LLP_SOAK_RECORD`
unset).

- Team member: `output`
- Branch: `feat/output/soak-wiring`
- Base commit (`main`): `6d8332f`
- Last commit: the commit that adds this file
- Related: devops-13 (`registerSoakScenario`, the `frameRates` source of
  `registerSoakRecorder`); devops' 20-minute soak waits on this

## Changes outside my paths

None.

## What changed and why

devops-13 added a soak scenario (it plays a background, turns the 본 화면 on,
and changes 장 every 5 s) and a frame rate field in the soak record. Both need
the main process to hand them the live store and the outputs' frame rates.

- `startOutputs` now returns `RunningOutputs`: `stop` (the old return value) and
  `frameRates`, which lists the last frame rate of each current screen that has
  reported one. `FrameRateTracker.reported(screenIds)` builds that list, in
  screen order, so a screen that was removed doesn't stay in the record.
- `index.ts` starts the soak scenario after the outputs, so the 본 화면 exists
  when the scenario turns it on, and gives the recorder `outputs.frameRates`.
  The scenario's stop is the first shutdown step, before the outputs close, so
  it changes nothing while they do.
- The scenario's commands go through `dispatchLogged(store, command, log)`, a
  new helper in `live/store.ts` that logs a listener that throws.
  `LiveStore.dispatch` drops listener errors without a callback, so the IPC
  command path and the scenario now share this helper instead of each passing
  the same callback.
- The soak lines are in `4e688b8`. `startOutputs` keeps output-11's status
  publishing; only its return value changed.

## Changed files

- `src/main/index.ts`, `src/main/index.wiring.test.ts`
- `src/main/outputs/start.ts`, `src/main/outputs/frameRates.ts`, and its test
- `src/main/live/store.ts` and its test, `src/main/ipc.ts`
- `src/main/outputs/rendererRecovery.ts`: the output-11 nit, the comment on the
  unexported `PageStatus` is now a note (`c277cae`)
- `docs/reviews/output-13.md` (new)

## Checks run

On `c277cae`, on `main` at `6d8332f`.

| Command or test  | Result                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify` | Typecheck, lint, format check, and build passed. Tests with coverage: 1,970 passed and 1 failed, the known failure on `main` since devops-13 (`scripts/soak/media.test.ts`, "ends the stalled maker and every process it started"), which devops-17 fixes                                                                                                          |
| New tests        | `index.wiring.test.ts`: the recorder gets the outputs' frame rates; the scenario's commands change the live state; the scenario stops before the outputs on quit. `frameRates.test.ts`: the reported rates of the given screens, in order, without screens that never reported. `store.test.ts`: `dispatchLogged` applies the command and logs a throwing listener |
| The real app     | Not run here; devops' 20-minute soak is the end-to-end check                                                                                                                                                                                                                                                                                                       |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes, except the known `main` failure above
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (the soak
      settings and media id, in devops-13)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the scenario's timer, as a shutdown
      step)
- [x] Caches and lists have size caps (one frame rate per current screen)
- [x] An exception in the output path doesn't stop the output (listener errors
      from the scenario's commands are logged)
- [x] Only what's needed re-renders (control window): not touched
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values: devops' soak measures them

## Decisions I made (for the lead to confirm)

1. `startOutputs` returns an object with `stop` and `frameRates`, as devops
   suggested, instead of a second function that reaches into the outputs.
2. `frameRates` lists only the current screens. The tracker keeps every screen
   it has heard from; the record should show the outputs that exist.

## Shared contract change requests

None.

## Where to look

- `src/main/index.ts`, the soak lines and the shutdown order.
- `src/main/outputs/start.ts`, `RunningOutputs`.

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
