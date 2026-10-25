Review range: `3d8a38b...feat/spec/bible-data`

# Review request: `spec-21`

- Team member: `spec`
- Branch: `feat/spec/bible-data`, from `main` (not stacked)
- Base commit (`main`): `3d8a38b`
- Code and measurement commit: `e70c1c6`
- Review round: 2
- Task: `.llp/task.md`, M3-T4a Bible data
- Ownership exception: new `src/main/bible/` only

## What changed and why

Main now has an offline Bible-data API for loading installed translations,
matching book names, resolving references, and maintaining recent passages. Both
`요 3:16-18` and `요 3장 16-18절` resolve to `요한복음 3:16-18` with three
verses. Unknown or invalid references return a reason instead of throwing or
reading the network.

The requested shared file contract was delivered by data-29 and merged at
`f05634e`. This implementation imports `BibleTranslationFile` and
`parseBibleTranslation`; it does not change shared contracts or preload.

## Loading and lifetime

`loadBibleLibrary({folder, translations, onProblem})` takes the installed
`Translation` entries from the existing settings contract. It reads their
`.llbible` files asynchronously, in order, through the merged parser. Main then
checks each book's chapter count against the 66-book table and checks that verse
strings already have the required trimmed form. Validation yields to the event
loop between books. The shared JSON/schema parser remains synchronous.

Each rejected file emits one `FileError` through `onProblem`, the main-side
notification hook, and loading continues with the next translation. This
includes missing files, unsupported names, non-regular files, structural schema
failures, chapter counts, untrimmed verses, and installed-ID mismatches.
Duplicate installed IDs keep the first entry and report the duplicate.

Valid files stay in memory, preserving unknown fields and original verse text.
Lookup never reads disk. The loader does not rewrite translations, and
`BibleLibrary.clear()` releases its entries. No watcher, timer, worker, network
request, or new dependency was introduced.

## Round 2 response: full-size parse budget

The new performance test generates one complete translation with all 66 books
and their real chapter counts, totaling 1,189 chapters. It distributes 31,102
invented verses across those chapters. The serialized UTF-8 file is **4,607,273
bytes**, within the requested 4 to 5 MB range.

The timer surrounds a single `parseBibleTranslation` call, including JSON
parsing and the shared Valibot/file-format validation. Fixture generation,
serialization, disk I/O, and main-side chapter-count checks are outside this
parse measurement.

| Measurement                                   | Time      |
| --------------------------------------------- | --------- |
| Initial isolated full-file parse              | 11.662 ms |
| Full-file parse in the final focused test run | 17.863 ms |
| Main-thread budget                            | 100 ms    |

Both measurements are below the lead's threshold, so the synchronous shared
parser stays in place. The conditional worker change is not required. The test
checks file size, book and chapter counts, the total verse count, successful
parsing, and a parse time below 100 ms. The same budget assertion runs in CI.
Evidence: `.llp/spec21/round2-parse-baseline.log` and
`.llp/spec21/round2-focused-final.log`.

## Book matching

The table contains all 66 books, their four names, testament, and chapter
counts. Metadata facts and matching flow were checked read-only against
`D:\programming\copible\src\data\bible-metadata.js`, `bible-search.js`, and
`BibleSearchForm.js`, as required by the decision and spec 02.

Matching first prefers an exact full or abbreviated Korean or English name.
Otherwise it compares normalized text and decomposed Hangul letters, including
an alternative made from Korean QWERTY key mappings. This supports unfinished
syllables and IME-off input without an additional package. `창`, `창세`, and
`ckd` complete to 창세기. Several matches remain choices in canonical order,
capped at eight. Partial matching follows copible's substring behavior: `베`
offers 에베소서, 베드로전서, and 베드로후서. Exact `요` selects 요한복음.

## Reference rules

- Accept whole chapters, one verse, same-chapter ranges, and cross-chapter
  ranges in colon or Korean syntax. Optional spaces and `~` are supported; mixed
  syntax, nonpositive numbers, and unsafe integers are rejected.
- Resolve exact book names or a unique partial match; an ambiguous name returns
  suggestions and a reason. Missing books, chapters, start verses, unavailable
  translations, and reversed ranges also return reasons.
- Clamp an excessive end verse to the last verse of its chapter. Normalize equal
  endpoints to one verse and equal endpoint chapters to a short range. Preserve
  cross-chapter ranges even when their verse numbers coincide.
- Keep omitted verses as empty strings in the loaded file, skip them in the
  returned passage, and retain original verse numbers and the requested span. A
  single omitted verse or an entirely omitted span returns the omitted-verse
  reason.
- Store normalized references with the full Korean book name. Display uses
  Korean for a `ko` language tag and English otherwise, including KJV.

## Recent passages and integration boundary

`recentPassages` bounds and deduplicates existing history when it is read.
`rememberPassage` moves a successfully resolved passage to the front after
output or insertion, deduplicating by normalized reference plus translation.
Both return at most ten entries and preserve existing unknown fields without
mutating the input.

These are main-side APIs within the granted `src/main/bible/` scope. The caller
supplies the folder and installed settings, connects `onProblem` to
notifications, and persists the returned recent list through settings. Startup
registration, renderer panels, and their IPC bridge are integration work for the
consuming task; this request does not add them.

## Checks run

| Check                                                        | Result                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Bible loader, matching, reference, recents, and parse budget | Pass: 5 files, 72 tests                                                      |
| Node TypeScript check (`tsconfig.node.json`)                 | Pass                                                                         |
| Changed-file ESLint                                          | Pass                                                                         |
| Changed-file Prettier and `git diff --check`                 | Pass                                                                         |
| Local full `npm run verify`                                  | Not run, per the CI workflow                                                 |
| GitHub branch CI                                             | Exact submitted HEAD's run URL and result are recorded in the request report |

Tests cover every metadata name, required lookup examples, all grammar forms,
normalization round trips, endpoints, omitted verses, ambiguity, IME-off keys,
invalid-file events, identity checks, text preservation, disk-free lookups,
cleanup, and recent-list limits. All verse fixtures are invented; no Bible text
was crawled or added. No app window, soak, or memory measurement was started.
Local evidence: `.llp/spec21/round2-focused-final.log`.

## Changed files

- New `src/main/bible/`: metadata, matching, references, loader, recents, and
  their tests with invented fixtures.
- `docs/reviews/spec-21.md`.

The branch was rebased onto main at `3d8a38b` before the final push. A fully
green CI run of the submitted HEAD is required. Its URL and result are recorded
in the request report, avoiding another unverified commit for CI metadata.
