Review range: `feat/spec/media-strip-mount...feat/spec/library-source`

# Review request: `spec-39`

- Team member: `spec`
- Branch: `feat/spec/library-source`
- Base: spec-38, stacked until its approval
- Task: M3-S1b library source state on data-40's merged contract
- Ownership exception: shell's renderer paths

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

## Changed files

- `src/renderer/src/state/show.ts`: separate source state, tile selector,
  guarded output, and source-aware metadata/navigation helpers.
- `src/renderer/src/show/SlideGrid.tsx` and `SlidePanel.tsx`: consume the source
  tiles and title without creating a fake service row.
- `src/renderer/src/show/useLibrarySongSync.ts`: scoped projection refresh and
  feed disposal.
- `src/renderer/src/shell/Workspace.tsx`: mount the source feeds with 진행.
- `src/renderer/src/state/showLibrary.test.tsx`: source/grid integration,
  unchanged service/output on open, command order, removed-tile regression,
  stale output, deleted/failed reads, revision guards, and feed disposal.
- `docs/reviews/spec-39.md`: this request.

## Validation

Scoped tests pass: 60 tests in four state/workspace files. Renderer TypeScript,
changed-file ESLint, Prettier, and `git diff --check` also pass. No Electron
process, visible window, soak, or memory measurement is started. Full verify
runs only in GitHub CI. The final rebased HEAD and its successful CI URL
accompany the request.

No shared, preload, main, prep, or UI source is changed, and no dependency is
added. Toolbar result UI and the remaining narrow layout follow separately.
