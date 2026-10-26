Review range: `d7bf32c6...feat/spec/toolbar-search-results`

# Review request: `spec-40`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/toolbar-search-results`
- Base commit: `d7bf32c6`, main after the ui-30 approval
- Review round: 2
- Task: M3-S1b toolbar search results in 진행, plus the spec-39 nit
- Code owner for the renderer paths: shell

## What changed and why

The toolbar now shows bounded D4 search results below its field. Main supplies
title-first ordering and Hangul initial matching; a lyrics match shows its first
matching line. The toolbar asks for at most 20 results, as spec 04 requires, and
also bounds the rendered reply. Search runs again when a song changes.

Down starts at the first result and stops at the last; Up from no result starts
at the last and stops at the first. Down or Up reopens a closed list that has
results. The pointed result is kept by song id, so a refresh that reorders the
list keeps it, and one that drops it clears the pointer. Enter opens the chosen
song through `library.showSong`, bounded by the shared lookup timeout, and
spec-39's separate library source state. Focus stays in the field, with an
active descendant and a visible selected row. The query includes text that is
still composing, so a Korean query shows results while its last syllable is
open; composing keys stay the IME's. Esc keeps the shared field's
clear-then-blur behavior. Pointer selection, focus leaving the field, and
outside pointers close the popup without changing output.

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

## Round 2 response

1. Composition no longer hides the list or holds the search. The field value is
   searched on every change, composing or not, as P1's library panel does; the
   `isComposing` key guards stay, so a composing Down or Enter does nothing. The
   test types per-syllable compositions ('새', '새벽' and 'ㅅ', 'ㅅㅂ') and
   leaves the last one open: results show, the search gets the composing query,
   and a composing Enter chooses nothing.
2. The pointed result is a song id; the index is derived from the current
   matches. A test reorders and then drops the pointed song through a song
   change refresh.
3. Down and Up reopen the list when the query has results; the first press only
   opens it. Tested after an outside pointer closed the list.
4. The chooser's `library.showSong` read goes through `withinLookupTimeout`; a
   read past `LOOKUP_TIMEOUT_MS` (now exported from `state/showOutput.ts`)
   reports 곡 불러오기 실패 with the song name and leaves the view unchanged.
   Tested with fake timers.
5. The 준비 tooltip is a named sentence, `WORKSPACE_UNAVAILABLE_TIP`: "현재 작업
   공간에서는 검색 결과를 열 수 없습니다."
6. The notice time uses ui-30's `noticeTime()`; the branch is rebased onto
   `d7bf32c6` for it.

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
  rename above, and `LOOKUP_TIMEOUT_MS` exported for the chooser's timeout test.

This review document is in my own path.

## Validation

| Command or test                                                                         | Result                    |
| --------------------------------------------------------------------------------------- | ------------------------- |
| `npm run typecheck`                                                                     | Pass                      |
| `npx vitest run src/renderer/src/shell src/renderer/src/state src/renderer/src/control` | Pass, 306 tests, 29 files |
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

## Verdicts (recorded by the lead at merge)

- Round 1 (Claude, trial-97): Request changes: the list stayed hidden for the
  whole IME composition, so Korean queries showed no results; five nits.
- Round 2 (e46d00d4): reviewer (Claude, trial-97) Approve. Nits for the next
  spec branch: drop the period at the end of `WORKSPACE_UNAVAILABLE_TIP`
  (`ToolbarSearch.tsx:22-23`); `showOutput.ts:32` rejects with "Song lookup
  timed out" now that the helper bounds the library reads too. Lead Approve.
  Written by the Claude session that took over the 진행 work from Codex's
  unpushed branch. Rebased by the lead onto local `main` without conflicts.
