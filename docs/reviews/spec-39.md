Review range: `c581dd45...feat/spec/library-source`

# Review request: `spec-39`

- Team member: `spec`
- Branch: `feat/spec/library-source`
- Base commit: `c581dd45`, main after spec-38
- Review round: 1
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
its view; a failed fresh read preserves current output and logs the cause. The
existing two-second lookup timeout is reused and always cleared.

Service pushes preserve the separately selected library view. Song refreshes
clamp selection and drop older revisions. The retained source follows song,
label, and media changes while 진행 is mounted, ignores superseded reads, and
releases all three feeds on source replacement or unmount. Only one projection
is retained. The source can also be reopened by 출력 중인 항목 열기 while it is
still retained and live.

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

- `src/renderer/src/state/show.ts`: separate source state, tile selector,
  guarded output, and source-aware metadata/navigation helpers.
- `src/renderer/src/show/SlideGrid.tsx` and `SlidePanel.tsx`: consume the source
  tiles and title without creating a fake service row.
- `src/renderer/src/show/SlidePanel.module.css`: token-based warning icon color
  for a read-only source or missing background.
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

Scoped tests pass: 186 tests in seven schema, preload, state, and workspace
files. Both TypeScript checks, changed-file ESLint, Prettier, and
`git diff --check` also pass. No Electron process, visible window, soak, or
memory measurement is started. Full verify runs only in GitHub CI. The final
rebased HEAD and its successful CI URL accompany the request.

No main, prep, or UI source is changed, and no dependency is added. Toolbar
result UI and the remaining narrow layout follow separately.
