# Review request: `data-63`

- Team member: data
- Branch: `feat/data/bible-chapter-reader`
- Base commit: `1986804e` on local `main`; final head, range and CI URL are in
  the member report.
- Related request: approved `data-62` and the October 26 chunked Bible decision.

## What changed and why

This is the first reader implementation slice for the approved v2 container. It
adds the header index and chapter file IO independently of the current lookup
session. The next request connects these functions to the existing lookup API,
adds the bounded global cache and handles library invalidation. The app still
uses its existing reader until that integration lands.

`readBibleChapterFile` reads exactly the four-byte prefix and declared header,
plus file metadata. It retains no chapter text or open handle. Header lengths
are checked against the file size and 1MiB cap before allocation. Metadata uses
the same schemas as the legacy format. Validation checks version 2, installed
ID, canonical book order and chapter counts, safe offsets, contiguous spans and
exact body size. Unknown fields retain the existing schema key handling,
including prototype-like data keys.

`readBibleChapter` reads the selected chapter at its absolute position without
reading neighboring chapters. Short reads advance both buffer and file
positions; early EOF fails. Handles close in `finally` on success and failure.
Strict UTF-8 decoding rejects replacement characters and BOMs. Complete blocks
must have the indexed byte length, final LF, string array, verse count and
trimmed text within existing lookup text limits. Empty verse slots and Unicode
text are preserved. Invalid chapter coordinates fail before opening the file.

## Changes outside my paths

- `src/main/bible/chunkFormat.ts`, `chapterFile.ts` and their tests: tools owns
  this directory. The user explicitly assigned the chunked Bible reader to data.
  This request introduces its file primitives with executable coverage.
- `src/main/bible/testFiles.ts`: adds a deliberately separate test fixture
  encoder using invented sentences, shared by these tests and later lookup
  integration tests. It does not call production parsing to construct fixtures.

`src/shared/schema/bibleChunks.ts` contains the container schemas and byte/text
bounds. Canonical chapter-count validation remains beside `books.ts` in main.
The shared legacy translation schema exposes its existing metadata entries for
reuse. Its v1 parsing behavior is unchanged. There are no new dependencies, IPC
changes, app launches or committed Bible texts.

## Checks

| Check                                                    | Result                                   |
| -------------------------------------------------------- | ---------------------------------------- |
| New file/index tests and legacy translation schema tests | Pass; count in report                    |
| `npm run typecheck`                                      | Pass                                     |
| ESLint on changed TypeScript                             | Pass                                     |
| `npm run format` and `npm run format:check`              | Pass                                     |
| `git diff --check`                                       | Pass                                     |
| Full `npm run verify`                                    | GitHub CI on request head; URL in report |

Tests cover exact header-only reads, positioned Unicode chapter reads, partial
reads, early EOF, framing and allocation bounds, metadata, canonical tables,
gaps, overlaps, truncated spans, trailing bytes, invalid UTF-8 and JSON, omitted
verse slots, handle cleanup, missing files, directories and symlinks.

## Decisions I made for review

1. Separate the low-level format and file reader from library/cache lifecycle so
   this request remains small. The following integration keeps the existing
   lookup IPC contract and removes the whole-file runtime loader.
2. Reuse legacy metadata validators through an exported schema entry object;
   keep v1 parsing available for the later build-time converter.
3. Return frozen chapter arrays so a later cache cannot expose mutable text.

## Team member's reply

1.

## Verdicts (recorded by the lead at merge)

- Round 1 (114bacf6): reviewer (Codex, codex3) Approve. Lead Approve; the Bible
  reader now follows the chunked format of data-62 (headers at launch,
  positioned chapter reads, a capped cache, a broken file skipped with one
  warning) behind the same lookup API. Rebased by the lead onto local `main`
  after output-47 without conflicts; typecheck passes.
