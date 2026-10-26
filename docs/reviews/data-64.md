# Review request: `data-64`

- Team member: data
- Branch: `feat/data/bible-chunk-library`
- Base commit: `57d28dc5` on local `main`, including the approved `data-63`.
  Final range and CI are in the member report.
- Related requests: approved chunked-file specification `data-62` and file
  primitives `data-63`.

## What changed and why

This second reader slice adds a header catalog and the bounded chapter cache.
The next request connects this catalog to the existing lookup session and
removes its whole-file loader. No renderer or IPC contract changes here.

`loadBibleChapterLibrary` indexes installed files in order and rejects unsafe
file names and duplicate identities. It reads headers through the file reader
from `data-63`, skips broken files and warns once per file for that library
load. Headers support reference validation without chapter reads.

`BibleChapterLibrary.chapter` reads only a requested chapter on a cache miss.
The global LRU shares `BIBLE_CHAPTER_CACHE_LIMIT = 32` and
`BIBLE_CHAPTER_CACHE_MAX_BYTES = 8,388,608` across translations. Hits refresh
recency. Validated blocks are charged by their indexed source-byte lengths;
insertion evicts until both limits hold. A late read or validation failure
invalidates that translation, removes all its cached chapters and warns once.
Other translations remain available. Clearing the library releases indexes and
cached text and prevents pending reads from publishing text or warnings.

## Changes outside my paths

All four TypeScript files are in `src/main/bible`, owned by tools. The user
explicitly assigned the chunked Bible reader to data. `chapterCache.ts` and
`chapterLibrary.ts` implement the catalog/cache lifecycle; their tests use
invented text only. No dependencies, app launches or Bible texts are added.

## Checks

- Targeted cache and library tests: 14 passed.
- Node TypeScript check and ESLint on changed TypeScript: pass.
- Formatting, diff checks and exact-head GitHub CI: final results in report.

Coverage includes the shared count/byte limits, hit refresh, replacement byte
accounting, cache release, cross-translation eviction, no chapter IO at index
load, cached reads after file removal, invalid coordinates without IO,
corruption invalidation and one warning, unaffected translations, unsafe paths,
duplicate identities, broken headers and pending success/failure after clear.

## Decisions I made for review

1. Keep catalog/cache ownership separate from passage parsing. The following
   integration preserves the lookup API while using this indexed catalog.
2. A failed chapter invalidates the file for the current library load. Only a
   new catalog load may reconsider it; repeated lookups cannot repeat warnings
   or serve previously cached chapters from the broken file.
3. Share one LRU across every installed translation, rather than granting each
   translation a separate memory budget.

## Team member's reply

1.
