# Review request: data-29

- Team member: data
- Branch: `feat/data/bible-contract`
- Base: `5234318452661ec630c824fd8a67f4268b00ce7f` (`main`)
- Last source commit: `584a75dcc6404163344c6725133217ddbb306644`
- Review range: `5234318...feat/data/bible-contract`
- Request: `spec-21.md` at `8f8a20f`, and `.llp/task.md`, "Insert first".

## What changed and why

Add `BibleTranslationFile` and
`parseBibleTranslation(text, file): Result<LoadedFile<BibleTranslationFile>, FileError>`
in `src/shared/schema/bibleTranslation.ts`, so M3-T4a can read `.llbible` files
through the existing file-format pipeline. This is separate from the installed
translation list in `bible.json`; its contract is unchanged.

The parser checks metadata, a nonblank lowercase branded translation ID, BCP 47
language-tag syntax, the source URL and calendar date, strictly increasing
unique book IDs from 1 to 66, and nonempty chapters of strings. Partial books
are allowed. An omitted verse is an empty string. Verse text and unknown fields
at every object level are preserved exactly, including reserved JSON keys.

The common version/migration behavior is retained. There is no serializer, IPC,
main-process loader, book metadata, download, or Bible text in this request.

## Changed files

- `src/shared/schema/bibleTranslation.ts`: requested public type and parser.
- `src/shared/schema/languageTag.ts`: BCP 47 structural validation, including
  private use, extlangs, grandfathered forms, and duplicate-subtag rejection.
- `src/shared/schema/bibleTranslation.test.ts`: invented-text fixtures and
  valid/invalid, preservation, date, and version cases.
- `src/main/import/read.ts` and `read.test.ts`: the two data-28 nits below.
- `docs/reviews/data-29.md`.

## Checks run

| Check                                                     | Result                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| `npm run typecheck`                                       | Passed                                                     |
| Targeted Vitest, translation/settings/import read and IPC | Four files, 70 tests passed                                |
| ESLint on changed TypeScript files                        | Passed                                                     |
| `npm run format` and `git diff --check`                   | Passed                                                     |
| Rebase onto latest main                                   | Already up to date                                         |
| Local full verify                                         | Not run, per lead instruction                              |
| GitHub full verification                                  | Final HEAD run URL and result accompany the review request |

No app, dialog, soak, or memory measurement was started. Fixtures contain only
invented sentences and example metadata.

## Decisions and integration boundary

- Follow the known fields and existing `TranslationId` brand requested in
  spec-21. Do not narrow or otherwise change the settings-file translation ID.
- Language tags are checked against
  [RFC 5646 syntax](https://www.rfc-editor.org/rfc/rfc5646.html#section-2.1),
  without IANA registry access or canonicalizing the supplied tag. Repeated
  variants or extension singletons and non-ASCII tag characters are invalid.
- As spec-21 requests, canonical book chapter counts and trimmed-verse checks
  belong to the main loader. The structural parser permits an empty books list
  or chapter list; that loader decides whether such a file is usable. It never
  trims, renumbers, or rewrites verses.
- `LoadedFile.access` retains the shared parser's version-compatibility meaning;
  M3-T4a enforces the app's read-only translation-file policy. This request adds
  no write API.

## Data-28 nits carried here

1. Read buffers now allocate `Math.min(info.size, TEXT_IMPORT_LIMITS.bytes) + 1`
   instead of 4 MiB for every small input. The extra byte detects growth beyond
   the size used to allocate; a changed file returns `read-failed` instead of
   silently returning a truncated prefix. The test reports an earlier file size
   to reproduce this deterministically.
2. Clipboard text containing U+FFFD now returns `decode-failed` at read time,
   matching preview's corruption policy. It is not accepted as a retained source
   only to fail on the next call.

## Verdicts (recorded by the lead at merge)

- Round 1 (93af0a9): reviewer (Claude, trial-97) Approve. Nits for the next data
  branch: `src/shared/schema/bibleTranslation.ts:29` add `v.minLength(1)` to a
  book's chapters; `:51` allow only `http:` and `https:` source URLs, with a
  test for a rejected scheme; optionally replace the hand-written BCP 47 grammar
  in `languageTag.ts` with `Intl.getCanonicalLocales`. Lead Approve. Written by
  the Codex session that took over data's work. Rebased by the lead onto local
  `main` without conflicts.

## Team member's reply

Pending review.
