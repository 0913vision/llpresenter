Review range: `6f8724fd...feat/spec/toolbar-search-results`

# Review request: `spec-40`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/toolbar-search-results`
- Base commit: `6f8724fd`, main after the Claude takeover status
- Review round: 1
- Task: M3-S1b toolbar search results in 진행, plus the spec-39 nit
- Code owner for the renderer paths: shell

## What changed and why

The toolbar now shows bounded D4 search results below its field. Main supplies
title-first ordering and Hangul initial matching; a lyrics match shows its first
matching line. The toolbar asks for at most 20 results, as spec 04 requires, and
also bounds the rendered reply. Search runs again when a song changes.

Down starts at the first result and stops at the last; Up from no result starts
at the last and stops at the first. Enter opens the chosen song through
`library.showSong` and spec-39's separate library source state. Focus stays in
the field, with an active descendant and a visible selected row. Korean
composition owns its keys and is searched only after confirmation. Esc keeps the
shared field's clear-then-blur behavior. Pointer selection, focus leaving the
field, and outside pointers close the popup without changing output.

Choosing a result adds no service item and sends no live command. Clicking a
slide in the opened source uses spec-39's guarded output. Old query replies,
superseded source reads, changed view selections, and unmounted reads are
ignored. A missing source or a failed read keeps the current view and reports
through the app's one notice host. A search failure has its own short state,
distinct from no results. Every feed and the outside pointer listener are
released.

The search hook is split into a reply hook (bounded search, song change refresh,
stale reply guards) and a chooser hook (source read, supersede rules). The
component keeps the key movement in a pure `nextPointed` function and renders
each result with a small `ResultRow`.

Codex wrote this branch on spec-39 round 1 and never sent it. I rebased it onto
`main`, moved the library imports to `state/showLibrary`, pointed the toolbar
layout test at the search rules' new module, split the long hook and component,
and added the missing tests.

## Carried spec-39 nit

`readSongBackgrounds` in `state/showOutput.ts` is now `withinLookupTimeout`,
because it bounds both the service background read and the library song read.
Its own commit, `refactor(shell)`, with no behavior change.

## Changes outside my paths

These renderer paths are kept by shell:

- `src/renderer/src/shell/Toolbar.tsx` and `.module.css`: use the search host
  and remove the old inert field and its styles.
- `src/renderer/src/shell/ToolbarSearch.tsx` and `.module.css`: field, bounded
  result popup, keyboard and pointer behavior, token-based styling. The result
  DOM belongs to this host; no attributes are added to UI-owned DOM.
- `src/renderer/src/shell/useToolbarSearch.ts`: bounded reads, composition and
  lifetime guards, source selection, problem reporting.
- `src/renderer/src/shell/ToolbarSearch.test.tsx`: mounted app selection and
  output, source failures, stale query and source replies, the cap, composition
  and Esc, key movement, outside pointer, song change refresh, cleanup.
- `src/renderer/src/shell/Toolbar.layout.test.ts`: reads the search width and
  shrink rules from `ToolbarSearch.module.css`, where they moved.
- `src/renderer/src/state/show.ts`, `showLibrary.ts`, `showOutput.ts`: the
  rename above.

This review document is in my own path.

## Validation

| Command or test                                                                         | Result                    |
| --------------------------------------------------------------------------------------- | ------------------------- |
| `npm run typecheck`                                                                     | Pass                      |
| `npx vitest run src/renderer/src/shell src/renderer/src/state src/renderer/src/control` | Pass, 301 tests, 29 files |
| `npx eslint --max-warnings 0` on the changed files                                      | Pass                      |
| `npx prettier --check` on the changed files                                             | Pass                      |
| GitHub CI (`npm run verify`)                                                            | In the request message    |

Tests use invented text, a fake API, and a mocked output renderer. No Electron
process, visible window, soak, or memory measurement was started.

## Where to look

- `useToolbarSearch.ts`: the two version counters. The reply counter drops older
  searches inside one query; the chooser counter drops a source read after a new
  choice, a new query, an open item or slide change, or unmount.
- `ToolbarSearch.tsx`: blur and outside pointer both close the popup; neither
  sends a command.

## Remaining S1b work

준비's toolbar handoff into P1's library panel follows as spec-42. Until then,
the 준비 toolbar field is unavailable with the reason in a tooltip, and the
library panel's own search stays available. The narrow window layout follows as
spec-43. No shared, preload, main, prep, or UI source is changed here, and no
dependency is added.
