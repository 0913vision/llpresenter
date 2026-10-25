# Review request: data-39

- Team member: data
- Branch: `feat/data/macro-runner`
- Base: `140563b48f9c8ddbbee451642f0196ce3621fdb6` (`main`)
- Review range: `140563b4...feat/data/macro-runner`
- Request: `.llp/task.md`, "Next (from the lead, 04:50)", M3-T3a.
- Final commit and final HEAD CI URL/result accompany the review request.

## What changed and why

`macro.run` and `item.start` now enter the O0 live registry through a new
`slices/macros.ts`. The runtime reads the current validated settings, media
catalog, and open service. It expands nested macro actions in list order and
submits one `live.batch` through the same registry dispatcher. It does not
publish intermediate state. The existing batch reducer groups clears into one
undo entry; the three-clear integration test observes one batch, one version
change, one notification, and one undo restoring every cleared layer.

The action registry has handlers for Look, stage layout, clear all, clear layer
or one prop, background media, prop on/off/toggle, a filled message template,
notice, audio play/fade/stop, audio playlist, timer start/pause/reset, and
another macro. A constructed command passes the shared live-command schema
before it enters the plan. Toggle projection follows earlier prop actions and
clears, including nested runs, and validates the active-prop cap before changing
the projection. Compilation never changes the live state.

An action with a missing target is skipped using `MissingLiveTargetError` and
reported with `reason: 'missing-target'`, its macro/action location, and target.
Later actions still run. Unknown actions, invalid values, cycles, and limits
also produce bounded diagnostics. Commands whose live slice is not implemented
remain in the batch and use the existing unsupported-command path. Those tests
use explicit registries rather than assuming production support is absent.

The current `MacroPlan` is available as `MacroRunner.lastRun` and
`MacroRegistration.lastRun`. It contains the flattened commands and preflight
problems; only one latest plan is retained. Runtime reduction errors continue
through the existing live-store diagnostics. No renderer status channel or
macro-tab UI is added in this execution slice.

### Loops and bounds

A macro already in the current chain is skipped immediately. Four distinct
frames are allowed, counting the root as one; a fifth is skipped. A sibling can
run the same nested macro again after that frame has returned. These are the two
separate loop guards in spec 07.

| Resource                                             | Bound                                      |
| ---------------------------------------------------- | ------------------------------------------ |
| Actions visited per run, including nested references | 256                                        |
| Commands in the one flattened batch                  | 256                                        |
| Problems retained per run                            | 256, message text at most 200 characters   |
| Rendered macro message                               | 4,000 characters, checked during expansion |
| Macros / collections in the file                     | 1,000 / 200                                |
| Actions per macro / IDs per collection               | 256 / 1,000                                |
| Message values / target screens per action           | 200 / 200                                  |

The expansion budget reports a limit instead of continuing unbounded work.
Message rendering checks the template and emitted prefix before building a large
result. File reads and edits apply the new list caps through the existing schema
boundary, keeping unknown fields and the existing fallback behavior.

### Startup, item starts, and O8

`registerMacros({store, data, log})` waits for settings, media, and content to
load, attaches the runtime, and runs `runOnStartup` entries once in file order.
It yields between startup macros. Item starts find their macro on the currently
open service, including after `service.open`, and run before a following slide
inside the same outer batch. Legacy item macro strings are checked through the
public schema-layer `parseMacroId` helper before use.

Per the lead's approved O8 boundary, register with `launch: 'restore'` to skip
startup macros during recovery. `registration.startFresh()` runs them after the
user chooses start fresh; concurrent calls share one in-flight startup sequence.
Restore does not call that port. O8's recovery wiring remains its follow-up.
Failed data initialization is logged and an explicit fresh run rejects instead
of silently succeeding. Disposal detaches only its own runtime, stops remaining
startup work, and prevents late loading from attaching again.

### Why the approved live-file edits are needed

O0 discovers the new slice automatically, so no central command list or registry
discovery edit is needed. Its context could not supply the asynchronously opened
media catalog, current service lookup, or a disposable runtime connection.
`LiveStore.connectMacros` and the optional context port supply just that
connection. `SliceContext.apply` is widened from `SingleLiveCommand` to
`LiveCommand` so the slice can submit its single batch. The underlying registry
dispatcher already accepted `LiveCommand`; no dispatch implementation changes.

## Changed files

- `src/main/macros/actionRegistry.ts`, `actions.ts`, `catalog.ts`, `types.ts`:
  typed action registry, current catalog, mappings, and bounded report types.
- `src/main/macros/compiler.ts`, `compiler.test.ts`: ordered expansion, target
  checks, loops, budgets, unsupported handlers, and prop projection.
- `src/main/macros/messageText.ts`, `messageText.test.ts`: literal blank
  substitution, missing values, and bounded expansion.
- `src/main/macros/runner.ts`, `runner.test.ts`: registry execution, missing
  targets, one batch/notification/undo, item starts, and connection lifetime.
- `src/main/macros/register.ts`, `register.test.ts`, `testing.ts`: startup,
  fresh/restore port, late disposal, current-service integration, and fixtures.
- `src/main/store/register.ts`, `register.test.ts`: expose the content promise
  for current item lookup and test it against the loaded service.
- `src/shared/schema/macros.ts`, `macroLimits.test.ts`:
  file/action/member/value/ target caps and exact/over-cap cases.
- `src/shared/schema/ids.ts`: nonthrowing macro-ID helper.
- `src/main/live/slices/macros.ts` (**output, approved new file**): the O0 shim
  for macro and item execution.
- `src/main/live/store.ts` (**output, approved minimal exception**): runtime
  field, identity-safe connection/release, and context injection.
- `src/main/live/slice.ts` (**output, approved minimal exception**): typed
  optional port and the batch-capable child dispatcher signature.
- `src/main/index.ts` (**output, approved exception**): only the import,
  register call after output setup, and shutdown disposal before data closes.
- `src/main/index.wiring.test.ts` (**output, approved exception**): matching
  mock/reset and registration/disposal wiring check.
- `docs/reviews/data-39.md`.

## Checks run

The first CI run passed typecheck, lint, full test coverage, and build, but
failed formatting of `compiler.test.ts`. The whitespace was corrected and
checked with Prettier's cache disabled. The final run accompanies the request.

| Check                                                                        | Result                                          |
| ---------------------------------------------------------------------------- | ----------------------------------------------- |
| Focused Vitest, including existing live/registry/batch and real store wiring | 12 files, 148 tests passed                      |
| Registration tests after exposing the last plan                              | Six tests passed                                |
| `npm run typecheck`                                                          | Passed after rebase                             |
| ESLint on changed and approved TypeScript files                              | Passed, including final registration change     |
| `npm run format` and `git diff --check`                                      | Passed                                          |
| Rebase onto latest main                                                      | Completed without conflicts                     |
| Local full verify                                                            | Not run, per lead instruction                   |
| GitHub full verification                                                     | Final HEAD URL and result accompany the request |

No dependency, visible window, dialog, soak, or memory measurement was started.
Tests use invented messages, macro names, and media metadata. The entry-wiring
test mocks Electron. New slice discovery uses `--no-fsModuleCache` in local
focused tests; no shared cache setting is changed.

## Verdicts (recorded by the lead at merge)

- Round 1 (Claude, trial-97): Request changes: the pre-callback move, resize,
  and always-on-top events were missing, and the "keep directly behind" row had
  no exact state; two nits.
- Round 2 (0bf8642b): reviewer (Claude, trial-97) Approve. Nit for the next qa
  document: name the topmost primary rectangle (0, 0, 1920, 1080) and its
  possible overlap with the control window. Lead Approve, with the lead's
  reading of "keep directly behind" (placed directly behind and never raised by
  the app). Bug M2-9 (centering 31 DIP off the work area) goes to output.
  Written by the Codex session that took over qa's work. Rebased by the lead
  onto local `main` without conflicts.

## Team member's reply

Rebased onto main after output-25. The three conflicts retain both the screen
resync and macro ports, output's settings input, and macro
registration/disposal. Overlay reader ownership and `normalizeOutputFlags`
remain as implemented by output-25. A new regression test checks that releasing
the macro connection leaves the screen resync and settings reader working.
Affected test results and the rebased HEAD's green CI accompany the report. Per
the lead, the review nits are carried into data-40.

Affected verification after this rebase: 11 files and 130 tests passed,
including output startup/flag normalization, screen settings, overlay reader
lifetime, macro transactions, and entry wiring. Typecheck, scoped ESLint, and
cache-disabled formatting checks passed.
