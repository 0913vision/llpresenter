# Review request: `spec-63`

- Team member: `spec` (Codex)
- Branch: `fix/spec/alphabetic-search`
- Base, range, and exact-head CI: see the request message
- Review round: 1
- Task: October 27 user decision, qa-12 P03 library search ordering

## What changed and why

Title hits previously displaced alphabetically earlier lyric hits. The shared
main-process search now walks its existing title-sorted index once, collecting
all matching songs together and stopping at the requested limit. Korean numeric
collation and stable ID tie-breaking remain the same. Title/lyric match metadata
and the first matching lyric line are preserved.

For a query 찬송, the mixed result now places 가나다 and 나무 (lyric hits)
before 찬송 2 and 찬송 10 (title hits). A limit of two returns the first two in
that same order. All renderer search surfaces consume this one result order.

This follows the recorded user decision and the current
[Renewed Vision Quick Search article](https://support.renewedvision.com/hc/en-us/articles/9808905773715-How-to-Use-Quick-Search-within-ProPresenter),
which documents alphabetical library results. Specs 04/05 and the shared request
comment now describe that ordering. No IPC fields or schema validation change.

## Validation

All 25 index/registration regressions pass, covering mixed matches and
truncation, preservation of lyric details, numeric title ordering, equal-title
ID ties, rename/update/ delete behavior, Hangul initials, normalization, and the
existing 3000-song latency/yield check. Typecheck, scoped ESLint, production
build, formatting and diff checks pass. CI is pending (API 403); the lead checks
the exact pushed head.

## Checked in the app

Built and ran the actual Electron main/preload and renderer with
`LLP_TEST_WINDOWS=offscreen`, port 5193, isolated invented song files, and
CDP 9517. The driver passed `node --check` before launch. No product APIs were
mocked. All owned app/server processes were stopped afterward.

- [Toolbar search](spec-63/toolbar-search.png),
  [library search](spec-63/library-search.png), and
  [QuickAdd](spec-63/quick-add-search.png) show the same mixed alphabetical
  result. The toolbar retains the first matching lyric line. Actual search IPC
  with limit two returns 가나다 and 나무.
- After ten warm-up round trips, selected the first and last toolbar results
  back and forth twenty times with the same query. Reopened and closed QuickAdd
  twice. Live layers were unchanged and no renderer exception occurred.
- At baseline, ten rounds, and twenty rounds, elements stayed at 405, DOM nodes
  at 1450, documents at 27, and listeners at 379. Collected heap was 5,565,428,
  5,648,396, and 5,708,384 bytes, a bounded increase of about 140 KiB over this
  short sample. Raw data is in [measurements](spec-63/measurements.json).

An earlier harness loop erased/retyped the query each time and increased the
native editing DOM counters. The final selection exercise keeps the query,
blurs/refocuses the field, and measures at matching closed-list selections.
QuickAdd initially needed a wait for the asynchronous song results rather than
its already-visible other-item commands; that harness wait was corrected.

## Changes outside my paths

- `src/main/search/` and tests: prep-owned shared index used by toolbar,
  library, and QuickAdd. The lead explicitly assigned P03 to this member.
- `src/shared/schema/librarySearch.ts`: data-owned comment only, correcting the
  old title-first description; payload shape and validation are unchanged.
- `docs/spec/04-show.md`, `05-prep.md`, and this review record belong to this
  member.
