Review range: `6f04e76...feat/spec/search-index`

# Review request: `spec-19`

- Team member: `spec`
- Branch: `feat/spec/search-index`, from `main` (not stacked)
- Base commit (`main`): `6f04e76`
- Code commit: `9e9f39a`
- Review round: 2
- Task: `.llp/task.md`, M3-D4 Search index
- Ownership exception: new `src/main/search/` and the main-side registration and
  event wiring for the merged `library:search` contract.

## What changed and why

The existing library search contract now has a main-process implementation.
Titles, lyric lines, and their Hangul initials are indexed in memory. Queries
reuse normalized text and a maintained title order; they do not read files,
rebuild the index, or sort the library.

The rules match spec 05 Search:

- Normalize both query and indexed text with Unicode NFC, lowercase, and
  whitespace removal. A whitespace-only query matches nothing.
- Pure queries using the 19 Hangul initials search title and line initials.
  Double initials remain distinct: for example, `ㄱ` does not match `ㄲ`. Mixed
  syllable/initial queries remain literal text queries.
- Title matches precede lyric matches, each in Korean numeric title order
  (`Intl.Collator('ko', {numeric: true})`). Equal titles use song ID as a stable
  tie-break. A song appears only once.
- Lyric matches return the first matching original line. The original query is
  echoed without normalization, as the merged contract requires.
- Empty queries enumerate songs in title order, subject to the response cap.

`ㅁㅂㅇ` finds the title and lyrics of the required public-domain example,
`만복의 근원 하나님`.

## Building, updates, and lifetime

Initial indexing runs in batches of 25 songs and yields with `setImmediate`
between batches. Each batch computes normalized fields and inserts entries in
sorted order. A test confirms that another event-loop callback runs before a
3,000-song build completes. Content is exposed only after this first build, so
edits cannot be overwritten by a later initial-build batch.

The existing content event sink updates the changed song before broadcasting its
change. Replacement removes old words and repositions the title immediately;
deletion removes the entry. Creating, editing, and deleting songs through the
real store are covered by a registration integration test, with no wait or
rebuild before the next search.

There is one map entry and one ordered reference per song. Updates replace
entries instead of retaining old generations. Query candidates and replies are
bounded. Shutdown removes the IPC handler, ignores a queued read that completes
after disposal, awaits pending content writes, and clears the index in the
cleanup finalizer. No watcher, worker, external dependency, or periodic timer
was introduced.

## IPC and bounds

`library:search` validates requests with the merged `parseLibrarySearchRequest`.
A malformed request is logged and rejected. A request received during startup
waits for the existing content load and index; an unavailable store returns an
empty result with the original query. Unexpected search errors are logged and
reject that request, preserving the cause.

The default result limit is **50** and the maximum is **200**, both read from
the merged data-26 contract's `LIBRARY_SEARCH_LIMITS`. The index's separate
100-result constant is removed. A smaller limit, such as the toolbar's 20, is
honored. The shared parser fills the default for an omitted limit and rejects
IPC requests above the maximum; a direct index call defensively clamps to that
same maximum. No shared schema, preload, or wire shape changed in this request.

## Performance

The test generates 3,000 songs with shuffled titles and invented lyric text. It
measures the first query and subsequent lyric/no-match queries separately, and
asserts that each finishes within 50 ms.

| Query                                | Local measured time | Matches returned |
| ------------------------------------ | ------------------- | ---------------- |
| First title-initial query `ㅅㅎㅊㅇ` | 0.035 ms            | 50               |
| Lyric query `shared refrain`         | 0.728 ms            | 50               |
| No-match query                       | 1.662 ms            | 0                |

The same test separately measures the full chunked index build from just before
calling the builder until its promise resolves: **49.857 ms** for 3,000 songs.
Fixture generation and file loading are excluded; batch construction and
event-loop yields are included. This is below the lead's 100 ms threshold, so
the build remains before content-store and open-service-feed creation. Content
is still gated behind the build, preventing song edits from racing startup.

The query timings above exclude that build. The 50 ms query assertion also runs
in branch CI. Local evidence: `.llp/spec19/round2-focused-final.log`.

## Round 2 response

1. Rebased onto main with data-26 merged. Replaced the local result-limit
   constant with the shared default and maximum. Tests use those constants for
   title, lyric, and empty queries, small and maximum limits, and defensive
   clamping. IPC tests cover the shared default, the accepted maximum, and
   rejection above it.
2. Added and recorded the separate 3,000-song build measurement above. At 49.857
   ms, the conditional change to build after `feed.refresh()` is not required.
   The existing startup gate continues to exclude concurrent edits.

## Checks run

| Check                                                      | Result                                                                       |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Index, search IPC, real-store registration, content events | Pass: 4 files, 55 tests                                                      |
| Node TypeScript check (`tsconfig.node.json`)               | Pass                                                                         |
| Changed-file ESLint                                        | Pass                                                                         |
| Changed-file Prettier and `git diff --check`               | Pass                                                                         |
| Local full `npm run verify`                                | Not run, per the CI workflow                                                 |
| GitHub branch CI                                           | Exact submitted HEAD's run URL and result are recorded in the request report |

Coverage includes normalization, initial consonants and double initials, mixed
queries, numeric/title-first ordering, first original lyric line, rename
reordering and ties, replacement/deletion/clear, all limit cases, chunk
yielding, the measured query budget, malformed requests, startup waiting,
missing stores, handler cleanup, failed search isolation, and immediate
real-store updates.

## Changed files

- `src/main/search/songIndex.ts` and `songIndex.test.ts`.
- `src/main/search/register.ts` and `register.test.ts`.
- `src/main/store/register.ts` and its tests: index readiness, search handler,
  song event wiring, and shutdown cleanup.
- `docs/reviews/spec-19.md`.

This branch was created from main after the spec-18 request, then rebased onto
main at `6f04e76`. A fully green CI run of the exact submitted HEAD is required;
the temporary GPU exception has ended. The request report records the run URL
and result without creating another unverified commit afterward.
