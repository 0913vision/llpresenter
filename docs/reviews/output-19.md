# Review request: `output-19`

- Team member: `output`
- Branch: `refactor/output/registry-bootstrap`
- Base commit (`main`): `505ab189a2241b35e8b1a6ac53395ce42db838c4`
- Code commit: `2b5d162d967fa5aa71798c63c9a4d457b8f096a5`
- Review range: `505ab18...refactor/output/registry-bootstrap`
- Related task: [M3-O0 registry bootstrap](../plans/m3-breakdown.md), wave A;
  unblocks data's D1b and D1c.
- Shared contract changes: none.
- Code CI:
  [GitHub Actions run 40189107604](https://github.com/0913vision/llpresenter/actions/runs/40189107604).
- Code CI result: failure only in the lead's known headless-runner GPU case. The
  lead explicitly permits this exception until devops-19 merges. Final head CI
  is also checked before the request.

## What changed and why

The central live reducer switched exhaustively over the whole shared command
union. Adding a future command contract would break that switch before its
implementation existed. The output renderer also constructed two fixed layers.

The main process now discovers slice modules with an eager Vite glob over
`live/slices/`. Each exports `defineSlice({commands, initial, reduce})`. Only
the listed command variants reach that slice, so extending the shared union does
not widen existing slice reducers. A Map routes a command to one owner;
duplicate command ownership or a module with no slice is a startup error.

Content, clear/undo, and output toggles retain the existing behavior. History
helpers preserve no-op identity, versioning, background timestamps, and clear
undo. LiveStore initializes from slice defaults unless an explicit starting
state is supplied. Initial layer fields merge, and the content slice initializes
only its own fields so it cannot erase a newly added layer's default.

An unsupported command returns the same history. The application dispatch path,
`dispatchLogged`, logs `unhandled live command` with its type and rejects it
before dispatch. State identity, version, undo, and listener notifications
remain unchanged. IPC schema validation and the strict LiveCommand API remain in
place.

The renderer now discovers modules in `render/layers/`. Each exports
`defineLayer({kind, order, create})`. The factory creates a persistent view with
render, optional rescale, and dispose methods. The existing background and
lyrics adapters keep their old DOM names, stacking values 0/1, media behavior,
preview mode, and scaling. No new output content is implemented.

The renderer isolates each layer's creation, draw, rescale, and disposal errors.
It still cleans up later layers after a failure and disposes an instance once.
Factories release partially acquired resources if they throw before returning.
Duplicate layer kinds, invalid stacking orders, and duplicate orders fail
registry construction rather than silently hiding one another.

## Reused work and changed files

The parked `refactor/output/registries` commit `30ba976` was inspected first.
Its history extraction, typed slice definitions, registry, and three slices were
sound and were cherry-picked onto a new branch from main. This request completes
initialization, unsupported-command logging, layers, documentation, and tests.
The parked branch itself was not rewritten.

- `src/main/live/history.ts`: existing history types and update helpers.
- `slice.ts`, `sliceRegistry.ts`, `slices.ts`, `importMeta.d.ts`: slice
  definition, routing, defaults, eager discovery, and main-process glob type.
- `slices/content.ts`, `clear.ts`, `outputs.ts`, `reducer.ts`, `store.ts`:
  existing commands split by owner, compatible reducer exports, and logging.
- `src/renderer/src/render/layer.ts`, `layerRegistry.ts`, `layers.ts`: view
  lifecycle contract, ordered registry, and eager discovery.
- `render/layers/background.ts`, `lyrics.ts`, `outputRenderer.ts`: adapters
  around the existing views and generic renderer lifecycle.
- New registry/extension tests and fixture modules in both owned folders.
- The two owned-folder READMEs explain how to add modules; this review records
  the acceptance evidence.

Existing reducer, store, renderer, background, slide, and fitting tests are
unchanged. No shared, preload, UI, workflow, or dependency files are changed.

## Acceptance evidence

The fixed fixture discovery entries use eager globs over their fixture folders.
A new slice file supplies initial state and handles a command through the real
LiveStore. Two new layer files are discovered, sorted, created, rendered,
rescaled, reused, and disposed through the real OutputRenderer. The tests
replace only the discovery entry point, with no per-module import list.
Production discovery excludes fixtures.

Additional tests cover duplicate ownership, missing exports, prototype-like
unknown names, merging layer defaults independently of module order, and all
four layer failure phases. Unsupported-command tests use Reflect to supply a
runtime type outside today's closed command union, modeling a contract that
lands before its slice. They verify retained state/version/undo, no broadcast, a
warning containing the type, and subsequent normal dispatch.

Four unsupported-command cases fail against the original reducer/store from
`722fc6e`: the old exhaustive-switch fallback returns the command as history, so
unknown types corrupt state instead of being rejected. The helper restored the
implementation in `finally`. The final focused run passes 128 tests in 10 files,
including the existing unchanged tests and 32 new cases.

## Checks run

| Check                                                        | Result                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------- |
| Targeted live/render Vitest run, excluding native node tests | 128/128 passed, 10 files, 7.02 s                                 |
| Existing reducer/store/renderer tests unchanged              | 35/35 passed; no test edits                                      |
| Unsupported-command cases on old production code             | Four expected failures                                           |
| `npm run typecheck`                                          | Passed                                                           |
| Targeted ESLint                                              | Passed                                                           |
| `npm run format`, `git diff --check`                         | Passed before commit                                             |
| Fast build                                                   | Passed; Vite expanded the main and renderer eager globs          |
| Rebase onto main                                             | Once, no conflicts, confirmed complete                           |
| Own branch push                                              | Passed; branch hook only checked commit messages                 |
| GitHub code CI                                               | Four steps passed; only the known native GPU environment failure |
| Local full `npm run verify`                                  | Not run, per the lead's updated rule                             |

The CI status script is
`node scripts/ci/status.mts refactor/output/registry-bootstrap`. The linked code
run matches code commit `2b5d162`. After recording its result, the review
document commit is pushed and its own head CI is checked too; the final request
reports that head and run URL. No source changes follow code CI.

Local ignored evidence is in `.llp/output-19/`: focused tests, typecheck, lint,
format, build, old-code regressions, and CI JSON results. No app window was
launched locally for this request. Native output tests run in GitHub CI.

### Known CI environment failure

Run
[40189107604](https://github.com/0913vision/llpresenter/actions/runs/40189107604)
passed typecheck (6.2 s), lint (44.9 s), formatting (27.3 s), and build (3.2 s).
The coverage test step failed after 113.4 s: 221 files passed and only
`src/renderer/src/render/transparentBackground.node.test.ts` failed, with 2,531
tests passed, one failed, and one skipped. All new slice/layer registry and
extension tests passed, as did the existing preview video lifecycle test.

The native pixel fixture reported two GPU process exits with code 34, followed
by `UnknownVizError` during pixel capture. The lead identifies this and the
uiZoom Electron test's GPU startup error as known GitHub runner failures because
the runners have no GPU, and permits review requests when those are the only
failures until devops-19 merges. No pixel assertion failed and the fixture
imports the image classes/CSS directly, without OutputRenderer. The pixel test
and its window setup are unchanged in this branch.

This run is recorded as a failure with the explicit environment exception. No
rerun or local full verify was used. The final document-only head's CI result is
included in the request.

## Quality checklist

- [x] GitHub CI result and the lead-approved GPU environment exception are
      reported.
- [x] Formatting passes and each new registry behavior has tests.
- [x] Existing reducer/store tests and shared command contracts stay unchanged.
- [x] No `any`, unchecked assertions, or non-null assertions.
- [x] Static module registries are bounded by committed modules; no runtime
      growth.
- [x] Persistent views, renderer observation, and media resources are disposed.
- [x] Per-layer errors cannot prevent later views from drawing or cleaning up.
- [x] No extra renderer or media element is allocated per command.
- [x] No new external data input; IPC validation remains at its existing
      boundary.
- [x] Typed definitions, named responsibilities, permitted comments, and focused
      scope.

## Decisions for the lead to confirm

- Registry discovery accepts named or default definition exports and ignores
  unrelated helper exports. At least one branded definition is required.
- Reject duplicate layer stacking orders to keep the declared order unambiguous.
- Keep the old direct reducer/store signatures and report unsupported commands
  through the application's existing logged dispatch entry.
- Use fixed fixture globs for extension tests instead of shipping test modules
  in the production registry.

## Where to look

Start with the discovery entries and defineSlice narrowing, then the store's
default initialization and logged rejection. Check the content initial fields
and the module-order regression. On the render side, check the layer contract,
factories, error isolation, and fixture lifecycle tests.

## Review: lead

## Review: reviewer

## Team member's reply
