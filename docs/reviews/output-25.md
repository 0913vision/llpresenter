# Review request: `output-25`

- Team member: `output`
- Branch: `feat/output/live-screen-settings`
- Base: `afe945cdf77ee9ded74c29ffc1567b893c84e8fe` (M2 frozen, 0.14.0)
- Range: `afe945c...feat/output/live-screen-settings`
- Scope: M3-O9a saved screen subscriptions and sleep lifecycle.
- Round 2: fallback and all review nits addressed; code CI passed.
- Code head: `2ee381658a904fae5ba6ba1cd241045df7eadf0e`
- Code CI:
  [40230819966](https://github.com/0913vision/llpresenter/actions/runs/40230819966),
  **success**, including the complete GitHub Windows verify job.

## Changes

The backend now reads saved `screens.json` through D2 and subscribes to screen
and preference changes. Method, monitor, capture resolution and always-on-top
changes update the existing output window and page. Settings changed while an
output is off also reach its first native window. A failed read keeps the last
good configuration; startup and subscriptions stop safely on disposal. When the
settings reader is refused or fails to open, a warning identifies the fallback
to `createDefaultScreenSource`. Its built-in main output remains usable,
including queued commands, repeated off/on, frame reports and retries. An
intentionally empty saved screen list still removes the configured outputs.

Data-36's fixed UUIDs identify outputs regardless of screen order, kind or
method. The existing toolbar aliases update together with the canonical UUID in
one live-state broadcast. The renderer uses the shared exact-ID-first resolver.
Retry requests and frame reports use canonical IDs; status replies also include
compatible aliases. Removed frame reports are pruned.

Deleting a screen or switching it to unsupported NDI destroys its output and
clears its active flags, including when no monitor remains. NDI cannot be turned
on. The existing single `prevent-display-sleep` blocker protects both display
and system while any output is on, and releases after the last output turns off
or is removed, or on shutdown. No new power preference is introduced. The
output-21 fallback behavior and its deadlines are unchanged.

The data-38 `screen.settings.apply` command accepts only `screenId`. Resync
reads the saved screen through D2, warns for missing IDs, and coalesces refresh
work into one microtask after the live transaction. Extra proposed settings are
stripped by the shared boundary parser. Resync cannot apply temporary settings
or overwrite a batch result. The command leaves live history unchanged; the
queued refresh reads the latest live state. Disposal releases its store callback
and prevents queued work from reaching windows.

## Changed files

- `src/main/outputs/{settingsScreens,identity}.ts`: capped saved screen feed,
  method defaults, legacy alias keys, subscription and late-start cleanup.
- `src/main/outputs/defaultScreens.ts`: retained safety fallback; remove the
  obsolete TODO and describe its actual monitor selection behavior.
- `src/main/outputs/{start,manager,outputWindow,screens,frameRates}.ts`: live
  application, retained native windows, deletion cleanup, status routing and
  bounded frame-rate cache.
- `src/main/live/slices/outputs.ts`: atomic canonical and alias flags, missing
  target handling and removal of obsolete keys.
- `src/main/live/{slice,store}.ts` and `slices/screenSettings.ts`: disposable
  main-process resync callback and command handler.
- `src/main/live/overlays.ts`: document its sole ownership of the store's
  settings reader, with an integration regression in `outputs/start.test.ts`.
- `src/main/index.ts` and `index.wiring.test.ts`: D2 settings promise wiring.
- `src/renderer/src/render/screenIdentity.ts` and its test: stable identity
  while methods, kinds and order change.
- `src/main/outputs/{start,settingsScreens,frameRates}.test.ts`: settings,
  placement, wake-lock and resource lifecycle regressions using fakes.
- `src/main/outputs/electronWindow.test.ts`: output-24 nit, native capture
  background must equal the design system's `chroma` token.

There is no shared or preload change. The permitted test-only
`screenCommands.test.ts` patch was dropped because data-37 landed it first.

## Verification

- GitHub Windows full verify passed at the code head linked above. The first
  data-38 run
  [40228008084](https://github.com/0913vision/llpresenter/actions/runs/40228008084)
  passed coverage, build, typecheck and formatting, but failed lint on a missing
  brace in the new test. The brace was corrected, then formatting and targeted
  lint were rerun before the successful push.
- After rebasing onto data-38, 180 tests across 14 relevant files passed in 3.94
  seconds. Typecheck, targeted ESLint, Prettier and whitespace checks passed.
- Both alias regressions failed against the actual old output reducer and
  renderer resolver. The old resolver selected the stage UUID for `main` after
  method changes; the old reducer omitted the canonical UUID. Corrected files
  were restored in `finally`, then the relevant suite passed.
- Tests cover queued startup commands, configuration changed before the first
  window, in-place method/device/resolution/always-on-top changes, one state
  broadcast, last-output sleep release with no monitors, NDI rejection, capped
  settings, last-good reads, frame cache pruning and disposal of subscriptions,
  IPC handlers, monitor watchers, windows and wake locks.
- Electron and IPC are mocked in the new integration test. No local Electron,
  visible window, full verify, soak or memory run was started. Full verify is
  delegated to GitHub Windows CI.

## Scope and review focus

Per the lead's data-38 merge instruction, resync is included in this request.
Review the transaction boundary, saved-only reads and resource cleanup. The
subsequent close handshake is separate. No shared contract or dependency is
introduced here; the deferred soak and real HDMI recheck remain for daytime.

## Round 2 reply

1. A null reader or rejected settings load now warns and selects the retained
   built-in screen source. Its monitor choice remains available through display
   updates, and default IDs route frame reports and retries to the actual
   window. The stale default-source TODO is removed and its TSDoc is corrected.
   Both failure modes have source and end-to-end fake-window regressions.
2. `startOverlays` is the sole owner of `LiveStore.connectSettings`. Output
   startup only subscribes to the reader. An integration regression starts both
   lifecycles, asserts one attachment and proves that stopping outputs leaves
   the reader usable until overlays stop.
3. The screen slice now documents the deferred, idempotent resync with a NOTE:
   saved-ID validation runs now, window refresh is coalesced after reduction,
   and pure `applyCommand` has no callback that can schedule windows. Existing
   batch and disposal regressions still pass.
4. The temporary `outputs/identity` import remains as requested, with a NOTE
   identifying data's planned move beside `resolveOutputScreen` in shared code.
5. `normalizeOutputFlags` is extracted from startup. It uses each active
   screen's own aliases, so the legacy default screen also works without a
   settings reader.

Round 2 fast checks: 203 tests across 16 relevant files passed in 5.60 seconds,
plus typecheck, targeted ESLint after formatting, Prettier and whitespace
checks. All five fallback and reader-ownership regressions failed against the
actual round 1 source/start implementations, which were restored in `finally`;
the corrected suite then passed. No Electron process or full verify ran locally.

## Verdicts (recorded by the lead at merge)

- Round 1 (Claude, trial-97): Request changes: with no readable settings the
  screen list was empty and no output could turn on; nits.
- Round 2 (5190d4b): reviewer (Claude, trial-97) Approve: the built-in default
  screens stand in when settings cannot be read (lead decision), tested end to
  end. Nits for output-26: keep the order of `startOverlays` and the screens
  source in `src/main/index.ts` with a NOTE or a test that fails when swapped;
  `live/slices/outputs.ts:4` is later work, so a TODO, not a NOTE; let tests
  pass the `settingsScreens.ts` fallback explicitly. Lead Approve. Written by
  the Codex session that took over output's work. Rebased by the lead onto local
  `main` without conflicts. M3-O9a is complete.
