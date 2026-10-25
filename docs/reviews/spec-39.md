Review range: `2d2b6078...feat/spec/library-source`

# Review request: `spec-39`

- Team member: `spec`
- Branch: `feat/spec/library-source`
- Base commit: `2d2b6078`, main after output-27
- Review round: 2
- Task: M3-S1b library source state on data-40's merged contract
- Code owner for the renderer paths: shell

## What changed and why

The slide panel can retain one standalone ShowLibrarySong projection alongside
the open service. It uses a library-prefixed source id, shows the projected
title and default-order tiles, and keeps service rows and stored service files
unchanged. Read-only and missing-background sources show a warning with its
reason in a tooltip. Opening the source sends no live command. This is the state
half of toolbar search; the result picker follows separately to keep the request
small.

On the first output from this source, showSong refreshes the projection through
main's checked read. The renderer validates the refreshed tile before changing
either media or lyrics, then sends the checked background and slide in order. It
never sends item.start for a library source. A later output command or a
replacement source invalidates an in-flight output. A deleted source clears only
its view. A failed fresh read or two-second timeout logs the cause and outputs
the current retained tile without changing media. The timeout is always cleared.

Service pushes preserve the separately selected library view. Song refreshes
clamp selection and drop older revisions. The retained source follows song,
label, and media changes while 진행 is mounted, ignores superseded reads, and
releases all three feeds on source replacement or unmount. Only one projection
is retained. The source can also be reopened by 출력 중인 항목 열기 while it is
still retained and live.

## Round 2 response

1. A failed or timed-out background lookup falls through to the latest retained
   projection. It validates that the requested tile still exists before sending
   slide.show, leaves media unchanged, and drops a deleted source or newer
   output request. Tests cover rejection and the two-second deadline, cache
   updates during the lookup, removed tiles, newer commands, late completion,
   and timer cleanup. An older successful reply also leaves the newer cache
   intact and uses its valid tile without applying the stale background.
2. Library source identity, projection, selectors, and output now live in
   state/showLibrary.ts, with one isLibrarySource(view, itemId) helper used by
   consumers. The shared store and delayed-output request/timeout helpers are
   separate modules so service and library output share sequencing without an
   import cycle.
3. ReadOnlyMark, SongBackgroundControl, and SlidePanel reuse the canonical
   READ_ONLY_TIP and MISSING_BACKGROUND_TIP strings from show/problemReasons.ts.
   Their displayed copy is unchanged.

## Carried spec-38 nits

Spec 02 and 04 now make a saved open or closed choice take precedence over
size/height defaults, including a saved true in a narrow window. Its mounted
test checks the actual media panel, in addition to the pressed button.

The default height threshold now uses DIP: CSS viewport height multiplied by the
applied browser zoom factor. The additive ui.getZoomFactor method reads webFrame
synchronously in preload, validates finite factors against the shared 1-to-2
zoom bounds, and logs/falls back safely on a bad native read. The factor bounds
derive from the existing zoom percentage bounds. No numeric range is duplicated,
and the new method is feat.

Tests cover 750 CSS px at 120% and 450 CSS px at 200% as 900 DIP, the lower
boundary, zoom/resize changes, and independence from operating system pixel
scaling. No default recalculation saves over an operator choice.

## Changes outside my paths

Shell keeps these renderer paths:

- `src/renderer/src/state/show.ts`: coordinate service and library output and
  source-aware navigation through the shared store and request guards.
- `src/renderer/src/state/showLibrary.ts`: retained projection, source identity
  helper, selectors, and guarded output with the cached-lyrics fallback.
- `src/renderer/src/state/showStore.ts`: shared view state with no dependency on
  either source's output implementation.
- `src/renderer/src/state/showOutput.ts`: common request invalidation and
  bounded background lookups for both service and library sources.
- `src/renderer/src/show/SlideGrid.tsx` and `SlidePanel.tsx`: consume the source
  tiles and title without creating a fake service row.
- `src/renderer/src/show/SlidePanel.module.css`: token-based warning icon color
  for a read-only source or missing background.
- `src/renderer/src/show/problemReasons.ts`, `ReadOnlyMark.tsx`, and
  `SongBackgroundControl.tsx`: one canonical copy of each existing reason,
  shared with SlidePanel.
- `src/renderer/src/show/useLibrarySongSync.ts`: scoped projection refresh and
  feed disposal.
- `src/renderer/src/shell/Workspace.tsx`: mount the source feeds with 진행.
- `src/renderer/src/state/showLibrary.test.tsx`: source/grid integration,
  unchanged service/output on open, command order, removed-tile regression,
  stale output, deleted/failed reads, revision guards, and feed disposal.
- `src/renderer/src/shell/useMediaStripVisibility.ts`: measure the height
  default in DIP using the current applied zoom factor.
- `src/renderer/src/control/MediaStripMount.test.tsx`: mounted narrow saved-true
  assertion, zoom boundaries, and resize without persistence.

Data keeps these shared and preload paths:

- `src/shared/schema/uiZoom.ts` and `.test.ts`: bounded native factor parsing
  with valid and invalid cases.
- `src/shared/ipc.ts`: additive synchronous zoom-factor method.
- `src/shared/testing/fakeLlpApi.ts`: neutral native factor default in tests.
- `src/preload/index.ts` and `.test.ts`: read/validate the native factor, log
  malformed/failed reads, and test synchronous behavior and safe fallback.

The spec 02/04 clarifications and this review document are in my own paths.

## Validation

Round 2 scoped tests pass: 129 tests in nine state, panel, and workspace files.
Both TypeScript checks, changed-file ESLint, Prettier, and `git diff --check`
also pass. No Electron process, visible window, soak, or memory measurement is
started. Full verify runs only in GitHub CI. The final rebased HEAD and its
successful CI URL accompany the request.

No main, prep, or UI source is changed, and no dependency is added. Toolbar
result UI and the remaining narrow layout follow separately.

## Verdicts (recorded by the lead at merge)

- Round 1 (Claude, trial-97): Request changes: a failed or timed-out showSong
  read swallowed the operator's output click; two nits.
- Round 2 (6dd5e687): reviewer (Claude, trial-97) Approve: a failed or timed-out
  read now outputs the retained tile and keeps the background. Nit for the next
  spec branch: rename `readSongBackgrounds` in `state/showOutput.ts:22`, which
  now bounds the library read too (for example `withinLookupTimeout`). Lead
  Approve, including the additive `ui.getZoomFactor` contract. Written by the
  Codex session that took over spec's work. Rebased by the lead onto local
  `main` without conflicts.
