# Review request: `data-45`

- Team member: data (Claude session taking over from the Codex member)
- Branch: `feat/data/whole-dispatch-reject`
- Base commit (`main`): `6f8724fd`
- Last code commit: `8cc7c117`; the request message gives the head commit and
  its CI run.
- Related brief: `docs/briefs/data.md`; request from `.llp/task.md`, "Claude
  takeover (from the lead, 08:10)", item 1, which carries the data-42 round 3
  follow-up and nit.

## What changed and why

The data-42 round 3 verdict asked for two changes on the output path.

1. **Reject the whole dispatch** (required). The registry reduces a command and
   all of its children, then checks the final state once against the live state
   schema and the byte budget, as before. When that check fails, the whole
   dispatch is now rejected: the history and the last good state stay as they
   were, listeners are not notified, one `invalid-overlay` diagnostic names the
   top-level command, and none of the effects deferred during the reduction run.
   The per-child retry, which re-reduced the dispatch and checked the full state
   after every changing child, is gone together with the `checkChildren` flag
   and the nested-call counter. A missing target inside a batch or 매크로 still
   skips only that child (spec 01), because a slice reports it by throwing
   before the final check.
2. **Split the screen resync** (nit). `SliceInputs.resyncScreen` becomes a
   `ScreenSettingsPort` with `requireSaved(screenId)`, a synchronous check that
   a saved screen has the id, and `queueRefresh()`, which the slice calls only
   through `context.defer`. A rejected dispatch therefore queues no refresh, and
   the registry no longer needs the per-dispatch memo (`replayableInputs`) that
   kept a retry from calling the port twice. The saved screen source still
   coalesces refreshes into one microtask, because screen listeners dispatch
   live commands and must not run inside the dispatch that queued them.

`SliceContext.defer` is now required. The registry always supplied it, and the
macro runner's fallback that ran an observation at once when it was missing is
removed, so every effect outside the live state goes through one path. The macro
runner defers its `lastRun` report and warnings as before; when the dispatch is
rejected, they are dropped with it.

## Measurements

Short CPU measurement on this computer (Windows, Node v24.20.0, Intel Core
i7-7700K at 4.20 GHz, shared with other sessions), with the harness in
`scripts/bench/liveAdmission.test.ts`: seven samples after two warm-ups, median
of the per-sample mean. "Before" is `main` at `6f8724fd` with this branch's
first commit (the harness case only); "after" is the head of this branch. The
new case dispatches a 256-child `live.batch` on the heavy legal state (3,699,811
byte frame): 255 alternating `output.set` children for `main`, then one that
adds a 201st canonical output, so the final check fails. The harness asserts one
`invalid-overlay` diagnostic per dispatch and that the extra output never lands,
so the work can't disappear in either run.

| State       | Operation                    | Before ms | After ms |
| ----------- | ---------------------------- | --------: | -------: |
| Heavy legal | Failing 256-child batch      |  1,533.49 |     1.07 |
| Heavy legal | Passing 256-child batch      |      6.10 |     6.81 |
| Heavy legal | Single dispatch              |      6.01 |     6.74 |
| Heavy legal | Preload parser per broadcast |      0.46 |     0.40 |
| Typical     | 256-child batch              |      0.09 |     0.10 |
| Typical     | Single dispatch              |    0.0088 |   0.0108 |

The failing batch ranged from 1,519.97 to 1,589.64 ms before and from 0.71 to
1.19 ms after. The passing paths run the same code as before (the bench connects
no screen port), so their differences are shared-machine variation. This failure
is caught by the schema's output cap; a failure that only the byte budget
catches costs one schema check and one budget count, about one heavy single
dispatch, instead of one per changing child.

To rerun in PowerShell:

```powershell
$env:LLP_LIVE_BENCH = '1'
$env:LLP_LIVE_BENCH_PHASE = 'data45-after'
npx vitest run --no-fsModuleCache scripts/bench/liveAdmission.test.ts
Remove-Item Env:LLP_LIVE_BENCH
Remove-Item Env:LLP_LIVE_BENCH_PHASE
```

The harness now writes `.llp/live-admission-<phase>.json` for any phase name,
instead of the two fixed data-42 file names.

## Changed files

- `src/main/live/sliceRegistry.ts`: one reduction, one final check, whole
  rejection; no retry and no resync memo.
- `src/main/live/slice.ts`: `ScreenSettingsPort`; `SliceInputs.screenSettings`
  replaces `resyncScreen`; `SliceContext.defer` is required.
- `src/main/live/slices/screenSettings.ts`: check now, refresh through `defer`.
- `src/main/live/store.ts`: `connectScreenSettings` takes the port.
- `src/main/live/README.md`: the final check and whole rejection.
- `src/main/outputs/settingsScreens.ts`: `requireSaved` and `queueRefresh`
  replace `resync`; the source implements the port.
- `src/main/outputs/start.ts`: connects the screen source as the port.
- `src/main/macros/runner.ts`: uses `context.defer` directly.
- Tests: `src/main/live/limits.test.ts`, `sliceRegistry.test.ts`,
  `src/main/macros/runner.test.ts`, `src/main/outputs/settingsScreens.test.ts`.
- `scripts/bench/liveAdmission.test.ts`: the failing heavy batch case and the
  phase file name.
- `docs/reviews/data-45.md`: this request.

## Changes outside my paths

Every code change is outside data's paths; none touches `src/shared/` or
`src/preload/`.

- `src/main/live/` and `src/main/outputs/` (output): the requested change is the
  live registry's admission path and the screen resync port it calls, and the
  output start wiring that connects that port.
- `src/main/macros/` (tools): `defer` became required, so the runner's fallback
  for a missing `defer` is dead code; the test now expects a rejected dispatch
  to drop the macro report.
- `scripts/bench/` (devops): the before and after measurement the lead asked
  for. The case is opt-in and skipped in normal runs, as before.

## Checks run

| Command or test                                                 | Result                                     |
| --------------------------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                                             | Pass                                       |
| `npx vitest run src/main/live src/main/macros src/main/outputs` | Pass: 319 tests in 28 files, bench skipped |
| `npx eslint` on the changed files                               | Pass                                       |
| `npm run format:check`                                          | Pass                                       |
| `npm run verify`                                                | GitHub CI on the head commit (see request) |

Run the local tests with `--no-fsModuleCache` in this worktree: with the cache,
Vite's eager slice glob came back stale and 29 unrelated tests failed with an
unhandled `live.batch`.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released
- [x] Caches and lists have size caps (the deferred effects keep their cap; the
      resync memo is gone)
- [x] An exception in the output path doesn't stop the output (a rejected
      dispatch keeps the last good state; a failing deferred effect is still
      reported and doesn't undo the admitted state)
- [x] Only what's needed re-renders (a rejected dispatch broadcasts nothing)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [x] Measured performance values (when relevant): see "Measurements"

## Decisions I made (for the lead to confirm)

1. The rejected dispatch's own child diagnostics (for example a missing target)
   are still reported, followed by the one diagnostic for the whole dispatch, so
   the log explains both. Its deferred effects (macro reports, screen refreshes)
   are dropped, since nothing of that dispatch happened.
2. Commit tags: `feat` for the rejection, because it changes what a batch with a
   failing final state does; `refactor` for the port split, whose only behavior
   difference is that a rejected dispatch no longer queues an idempotent screen
   refresh.
3. Spec 01 says a missing target skips one action and the rest run; that still
   holds. It doesn't say what happens when the combined result of valid actions
   exceeds the live state limits. Spec may want to add "the whole batch is
   dropped and logged" there; I didn't edit `docs/spec/`.

## Shared contract change requests

None. `src/shared/` and `src/preload/` are unchanged.

## Where to look

- `src/main/live/sliceRegistry.ts`, `run`: the single check and the rejected
  result, and that `selectAttempt` runs effects only for an admitted or
  unchanged dispatch.
- `src/main/live/limits.test.ts`: a nested batch with a 매크로, a screen resync,
  and an output over the cap is rejected whole, with one schema check for a
  failing 256-child batch nested in a 매크로.
- `src/main/outputs/settingsScreens.ts`: `requireSaved` has no side effect and
  `queueRefresh` still coalesces into one microtask.

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
