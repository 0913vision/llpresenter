Review range: `feat/spec/library-source...feat/spec/toolbar-search-results`

# Review request: `spec-40`

- Team member: `spec`
- Branch: `feat/spec/toolbar-search-results`
- Base: spec-39, stacked until its approval
- Task: M3-S1b toolbar search in 진행
- Ownership exception: shell's renderer paths

## What changed and why

The toolbar now shows bounded D4 search results below its field. Main supplies
title-first ordering and Hangul initial matching; a lyrics match shows its first
matching line. The toolbar asks for at most 20 results, as spec 04 requires, and
also bounds the rendered reply. Search refreshes when a song changes.

Down starts at the first result, Up moves through results, and Enter opens the
chosen source through library.showSong and spec-39's separate source state.
Focus stays in the field, with an active descendant and visible selected row.
Korean composition owns its keys and is searched only after confirmation. Esc
keeps the shared field's clear-then-blur behavior. Pointer selection, focus
leaving the field, and outside clicks close the popup without changing output.

Choosing a result adds no service item and sends no live command. Clicking a
slide in the opened source uses spec-39's guarded output. Old query replies,
superseded source reads, changed view selections, and unmounted reads are
ignored. A missing source or failed read preserves the current view and reports
through the app's one notice host. Search failure has its own short state,
distinct from no results. Every feed and outside-pointer listener is released.

## Changed files

- `src/renderer/src/shell/Toolbar.tsx` and `.module.css`: use the search host
  and remove its old inert search field styles.
- `src/renderer/src/shell/ToolbarSearch.tsx` and `.module.css`: field, bounded
  result popup, keyboard/pointer behavior, and token-based styling. The result
  DOM belongs to this host; no imperative attributes are added to UI-owned DOM.
- `src/renderer/src/shell/useToolbarSearch.ts`: bounded reads, composition and
  lifetime guards, source selection, and problem reporting.
- `src/renderer/src/shell/ToolbarSearch.test.tsx`: mounted app selection/output,
  source failures, stale query/source responses, cap, composition/Esc, and
  resource cleanup.
- `docs/reviews/spec-40.md`: this request.

## Validation

Scoped tests pass: 32 tests across four toolbar/app files. Renderer TypeScript,
changed-file ESLint, Prettier, and `git diff --check` also pass. Tests use
invented text, a fake API, and a mocked output renderer. No Electron process,
visible window, soak, or memory measurement is started. Full verify runs only on
GitHub. Final HEAD and successful CI URL accompany the request.

## Remaining S1b work

Preparation's toolbar search needs a selection handoff into P1's LibraryPanel,
which is outside the current shell exception. That workspace keeps the field
unavailable with its reason in a tooltip until the lead authorizes that small
integration. Its existing library panel search remains available.

The narrow sidebar and 더 보기 tabs remain separate. Media visibility and
collapsed-state saving wait for data-41. No shared, preload, main, prep, or UI
source is changed here, and no dependency is added.
