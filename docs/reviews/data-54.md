# Review request: `data-54`

- Team member: data (Claude session)
- Branch: `feat/data/thumbnails`, on `main` after data-52 and data-53
- Base commit: the data-53 head; the request message gives the range, the head
  commit, and its CI run.
- Related brief: `docs/briefs/data.md`; request from `.llp/task.md`, M3-P6a part
  3, last of four (`docs/reviews/data-51.md` lists the split): the thumbnail
  cache and its route.

## What changed and why

Media tiles show a thumbnail (spec 05, "Media"), and thumbnails live in
`cache\`, where they can be deleted and made again (spec 02, "Media"). data-53
draws them; this request keeps and serves them.

1. **The cache** (`src/main/media/thumbnailCache.ts`). One JPEG per media id in
   `cache\thumbnails` in the app data folder, written atomically
   (`writeFileAtomically` now takes bytes). It keeps at most
   `MAX_CACHED_THUMBNAILS` (2,000) and removes the least recently used past
   that; at launch, the files' modification times give the order. Other files in
   the folder are left alone. A file it can't read, write, or remove is logged,
   never thrown.
2. **Making them** (`src/main/media/thumbnails.ts`). `Thumbnails` answers a
   media id's thumbnail from the cache, or makes it through analysis with a
   thumbnail asked for, so a deleted cache rebuilds as tiles ask. Requests for
   the same id share one analysis, and at most `MAX_THUMBNAILS_IN_PROGRESS`
   (200) are made at once. Audio has none. A file analysis refused isn't tried
   again until its path changes (one note per media id, at most the media list
   cap); one that was only unavailable, such as after a timeout, is tried again.
   It follows the media list: a changed file, such as after 다시 연결, or a
   removed item drops the thumbnail, and one made for a file that changed
   meanwhile is dropped too.
3. **Serving them** (`src/shared/media.ts`,
   `src/main/windows/mediaResponse.ts`). `llp-media://thumbnail/<id>` answers
   the thumbnail with `Cache-Control: no-cache`, so a relinked file's new
   thumbnail replaces the old one when a tile asks again, and 404 when there is
   none. `thumbnailUrl` is the address tiles use (P6b).
4. **Imports** (`src/main/media/mediaImporter.ts`). Analysis asks for the
   thumbnail, and the importer keeps it once the item joined the list.
5. **Wiring** (`src/main/media/analysis.ts`, `register.ts`,
   `src/main/index.ts`). `startMediaAnalysis` builds the loans, the analyser,
   and the thumbnails as one `MediaAnalysis` of plain functions. Main shares it
   with the media scheme (loans and thumbnails) and the backend (analysis and
   import thumbnails), and stops it after the backend, which no longer owns the
   analyser.

## Changed files

- `src/main/media/thumbnailCache.ts`, `thumbnails.ts`, `analysis.ts`, and their
  tests (new).
- `src/main/store/atomicWrite.ts` and `.test.ts`: bytes.
- `src/shared/schema/ids.ts`: `parseMediaId`.
- `src/shared/media.ts` and `.test.ts`: `thumbnailUrl` and `thumbnailIdFromUrl`.
  The test's analysis token (data-51) and thumbnail id are now low-entropy ids
  such as `00000000-0000-4000-8000-000000000001`, after a secret scanner flagged
  the random sample UUID (lead).
- `src/shared/schema/mediaFiles.test.ts`: the same for its id (data-50).
- `src/main/windows/mediaResponse.ts` and `.test.ts`: the thumbnail route.
- `src/main/media/mediaAnalyser.ts`: a thumbnail is a `Uint8Array`.
- `src/main/media/mediaImporter.ts`, `register.ts`, and their tests: import
  thumbnails and the shared analysis.
- `src/main/index.ts` and `index.wiring.test.ts`: `startMediaAnalysis`.
- `docs/reviews/data-54.md`: this request.

## Changes outside my paths

- `src/main/windows/mediaResponse.ts` and its test (output): the route.
- `src/main/index.ts` and its wiring test (output): the shared analysis and its
  disposal.
- `src/main/media/` (prep, no member): P6a's folder, given to data by the lead.

## Shared contract changes (additive)

- `thumbnailUrl` and `thumbnailIdFromUrl`: `llp-media://thumbnail/<id>`.
- `parseMediaId`.

## Checks run

| Command or test                                    | Result                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                                | Pass                                       |
| Vitest (`--no-fsModuleCache`) on the changed areas | Pass: 203 tests in 23 files                |
| `npx --no-install eslint` on the changed files     | Pass                                       |
| `npm run format:check`                             | Pass                                       |
| `npm run verify`                                   | GitHub CI on the head commit (see request) |

Tests: bytes written atomically; the cache keeping, finding, and evicting the
least recently used past the cap, reading an earlier launch's files oldest first
while ignoring other files, removing, starting without a folder, and a folder it
can't write; a thumbnail made once and reused, requests sharing one analysis,
none for audio, an unknown or malformed id, or a refused path, a refused file
tried again only after its path changes, an unavailable one tried again, a
changed file or a removed item dropping it, one made for a file that changed
meanwhile not kept, an import thumbnail saved, and disposal; the URL read back
and kept apart; the route's file, headers, 404, and a failure; an import keeping
its thumbnail; the registration passing analysis through; the factory keeping a
thumbnail where the route finds it; the wiring sharing one analysis and stopping
it after the backend.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (the media id
      in a thumbnail URL and in a cached file's name)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the media list subscription)
- [x] Caches and lists have size caps (2,000 thumbnails, 200 in progress, the
      refused notes at the media list cap)
- [x] An exception in the output path doesn't stop the output (the library route
      is unchanged)
- [x] Only what's needed re-renders (control window): no renderer change
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly (about 420 lines of code and 450 of tests)
- [ ] Measured performance values (when relevant): not measured; a real
      thumbnail is data-53's check 6 on the m3-check1 sheet

## Decisions I made (for the lead to confirm)

1. 2,000 thumbnails, about 40 MB at 20 KB each, covers a large library's visible
   tiles without growing with the media list's 10,000 cap.
2. Thumbnails are made when a tile asks, not by a background pass over the whole
   list, so a deleted cache costs work only for the tiles on screen.
3. `no-cache` instead of a versioned URL: tiles keep one address per media id.
4. A refused file isn't retried until its path changes, so a broken file doesn't
   run the decoder every time its tile renders.

## Where to look

- `src/main/media/thumbnails.ts`: following the media list and the race with a
  file that changes while its thumbnail is made.
- `src/main/media/thumbnailCache.ts`: the eviction order.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1.

## Round 1 reply

All three in
`fix(media): check cached thumbnails against their files and items`.

1. [P2] `thumbnailCache.ts:46`, a deleted cache file stayed in the cache. A
   lookup now checks the file and forgets an entry whose file is gone, so the
   thumbnail is made again. Regression: the cache folder deleted after a
   thumbnail was kept answers nothing, and the thumbnail is kept again at the
   same path.
2. [P2] `thumbnails.ts:58`, a cache hit skipped the media list. A thumbnail,
   cached or not, now needs an item in the list now, with a picture (not audio)
   and a path the library accepts. Regression: a prefilled cache answers nothing
   for an unknown item, audio, or a refused path, and answers the current
   video's thumbnail without analysis.
3. [P2] `mediaImporter.ts:299`, an import's thumbnail could outlive a relink or
   delete during the admission's save. The importer passes the file the
   thumbnail was made from, and `Thumbnails.save` keeps it only while the item
   still has that file, checked again after the write, as thumbnails made on
   request already were. Regressions: a save for an older file keeps nothing; a
   file that changes during the write drops the thumbnail; and an import whose
   item is relinked while its admission is still saving keeps no thumbnail (a
   real `Thumbnails` behind the importer).

## Round 2 reply

1. [P2] `thumbnailCache.ts:50`, a lookup took its entry out before checking the
   file, so a concurrent lookup missed it and a removal in between found nothing
   to delete, after which the lookup put the stale entry back. Fixed in
   `fix(media): keep a thumbnail's entry during its check and order work per id`:
   a lookup keeps the entry while it checks the file and answers nothing if the
   entry left meanwhile, and the lookups, writes, and removals of one media id
   run one after another (only ids with work in flight are queued). Regressions:
   three concurrent lookups all answer the file; a removal asked during a lookup
   deletes the file and the entry for good. Both fail without the fix.
