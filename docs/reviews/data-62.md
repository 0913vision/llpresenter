# Review request: `data-62`

- Team member: data
- Branch: `docs/data/bible-chunks`
- Base commit: `cfef1e6c` on local `main`; the report supplies the final range,
  head and CI URL.
- Related brief: `docs/briefs/data.md` and the user's October 26
  [Bible decision](../decisions.md#2026-10-26-bible-reference-autocomplete-first-chunked-bible-files).

## What changed and why

The Bible specification required loading whole translation JSON files and
offered in-app installation and removal. The user now requires prepared
translations delivered with app updates and chapter-based reads behind the
existing lookup API. This request defines the file contract and updates all four
requested settings descriptions before the reader and converter changes.

Schema version 2 has a four-byte little-endian header length, a UTF-8 JSON
header with metadata and chapter offsets, and one UTF-8 JSON array per chapter.
Relative byte offsets avoid a dependency on serialized header size. Verse slots
preserve omitted verses. Header validation needs only the prefix, header and
file size; lookup validates references before reading needed chapters at their
positions. Broken files are skipped with one warning, including late chapter
failures, and disposal cannot refill an index or cache.

The cache is global across translations and least recently used, with both
`BIBLE_CHAPTER_CACHE_LIMIT = 32` and
`BIBLE_CHAPTER_CACHE_MAX_BYTES = 8,388,608`. Header and chapter reads each have
a named 1MiB bound. Offset validation rejects gaps, overlaps, arithmetic outside
safe integers and spans outside the file. The build-time converter accepts
legacy v1 JSON and writes v2 atomically to a different destination.

The installed translation list retains 기본으로. The Bible panel and settings
inventory follow the update-delivered catalog. This request changes no runtime
code or lookup IPC contract and adds no Bible text.

## Changed files and ownership

- `docs/spec/02-data.md`: container version, framing, offsets, validation,
  positioned reads, cache limits, atomic conversion and update-only catalog.
- `docs/spec/04-show.md`: installed translation select in the Bible panel.
- `docs/spec/06-settings.md`: installed list with 기본으로 only.
- `docs/spec/10-shortcuts-and-settings.md`: matching settings inventory row.
- `docs/reviews/data-62.md`: this request.

The four specification files belong to spec. The lead explicitly assigned these
changes to data in the October 26 request.

## Checks

| Check                                                                 | Result                                       |
| --------------------------------------------------------------------- | -------------------------------------------- |
| Prettier on changed Markdown                                          | Pass                                         |
| `git diff --check`                                                    | Pass                                         |
| Search for the removed translation controls and whole-file-load rules | Pass                                         |
| Invented chapter block UTF-8 byte count                               | 32, matching the example index               |
| Runtime unit tests                                                    | Not applicable: specification-only request   |
| `npm run format` and `npm run format:check`                           | Pass                                         |
| Full `npm run verify`                                                 | GitHub CI on the request head; URL in report |

Reader and converter requests will add executable coverage for Unicode byte
offsets, header-only startup, positioned reads and partial reads, malformed
headers and blocks, corruption reported once, cache bounds and eviction,
disposal, preservation of invented verse slots and atomic write failures.

## Decisions I made for review

1. Length-prefix the header so startup can read its exact byte span without
   reading chapter data. Use offsets relative to the first chapter byte so the
   converter need not solve self-referential header lengths.
2. Encode each chapter as a JSON string array plus LF, retaining v1 verse
   indexing and omitted-verse representation. Keep book grouping in the header
   so the existing canonical metadata still validates chapter counts.
3. Use version 2 for the new container and retain v1 as conversion input. The
   running app reads prepared files without converting or rewriting them.
4. Set a 32-chapter, 8MiB LRU budget shared by all translations, with 1MiB
   header and chapter limits. These are implementation bounds, not measured
   results.

## Verdicts (recorded by the lead at merge)

- Round 1 (e818bae4): reviewer (Codex, codex2) Approve. Lead Approve; the spec
  now follows the user's decision of October 26: chunked translation files (a
  header with a chapter offset table, then one block per chapter; launch reads
  headers, lookups read chapters into a capped cache), translations prepared in
  advance and updated with the app, no 역본 추가 or 삭제. Rebased by the lead
  onto local `main` without conflicts.

## Team member's reply

1.
