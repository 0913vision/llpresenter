# Review request: `spec-4`

- Team member: `spec`
- Branch: `docs/spec/bible-format`, from `main` (not stacked)
- Base commit (`main`): `63d0dbc`
- Shared files changed: none
- Last commit: see the commit that adds this file
- Related request: the lead's message of October 25 (M3-W1, first part)

## What changed and why

A read-only look at the user's copible repository found that it has no offline
Bible text and no file format: it fetches 개역개정 live from the Korean Bible
Society website. The spec assumed copible's offline data. This change records
the finding and replaces the assumption with a proposal, without any Bible text.

1. **`docs/spec/02-data.md`, "Bible translations"** (rewritten):
   - "What comes from copible": the finding, and what this app reuses (the
     66-book metadata shape, book matching with es-hangul, reference parsing)
     and doesn't (the live fetching).
   - "Book metadata": the bundled table of the 66 books; verse counts come from
     each translation, because versification differs.
   - "Translation file (`.llbible`)": one JSON file per translation with
     `format`, `schemaVersion`, `id`, `name`, `shortName`, `language`, `source`,
     and `books[].chapters[]` of verse strings; rules for unchanged text,
     omitted verses, missing books, validation on read, read-only use, size and
     loading, and 역본 추가.
   - "Reference grammar": whole chapters, single verses, ranges in one chapter
     and across chapters, the Korean 장 and 절 form, clamping, the normalized
     `ref`, and book names in the translation's language.
   - "Candidate text sources": seven rows for 개역한글 and KJV (CrossWire
     `KorRV`, Korean Wikisource, crizin/bible-db, scrollmapper, eBible.org),
     each with where, the copyright or license as the source states it, and the
     format; the copyright status of both translations with sources; and a
     proposal for the user's choice. Nothing was downloaded.
   - "Dependency proposal: es-hangul": version, license, size, and why; marked
     as needing a `docs/decisions.md` entry and the lead's approval first.
2. **`docs/spec/README.md`, open question 4:** rewritten to the finding; the
   open parts are the text source and whether bundled files may be committed.
3. **`docs/spec/04-show.md`:** the line "Reuse the reference parsing logic from
   copible" now points to the grammar in 02.

`docs/TECH.md` ("To be decided": "Bible data format and porting the copible
logic") is the lead's file, so I left it as it is.

## Changed files

| File                     | Change                                          |
| ------------------------ | ----------------------------------------------- |
| `docs/spec/02-data.md`   | "Bible translations" rewritten                  |
| `docs/spec/README.md`    | Open question 4 rewritten (the table re-padded) |
| `docs/spec/04-show.md`   | One line points to 02                           |
| `docs/reviews/spec-4.md` | New. This review request.                       |

## Checks run

| Command or test           | Result                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`          | Pass: typecheck 8.7 s, lint 44.1 s, format:check 12.7 s, test:coverage 87.7 s (21 files, 185 tests), build 10.0 s; 163.2 s in all |
| Middle dots and em dashes | None in the changed files (checked with `grep -c`)                                                                                |
| Bible text in the change  | None; the JSON example uses "..." for all text                                                                                    |

## Decisions I made (for the lead to confirm)

1. The file format is our own JSON (`.llbible`), with verse text arrays per
   chapter and an attribution object, rather than an existing format such as
   USFM or OSIS. Converting those belongs to a build-time script.
2. The bundled translation files stay out of git and are built from a pinned
   source file at build time (open question in 02 and the README).
3. The proposed sources: KJV from eBible.org; 개역한글 from the CrossWire
   `KorRV` module, compared with crizin/bible-db before use.
4. References on a 장 use book names in the translation's language (John 3:16
   for KJV).

## Where to look

- Whether the copyright statements in the source table match their sources.
- Whether the file format and its validation rules are enough for the tools
  member (M3-T4a) to build the loader and the conversion script.
