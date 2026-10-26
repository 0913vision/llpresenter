# Review request: `data-51`

- Team member: data (Claude session)
- Branch: `feat/data/analysis-contract`, stacked on data-50
  (`feat/data/media-relink`)
- Base commit: the data-50 head; the request message gives the range, the head
  commit, and its CI run.
- Related brief: `docs/briefs/data.md`; request from `.llp/task.md`, M3-P6a part
  3, analysis and thumbnails (`docs/decisions.md`, "Media analysis runs in a
  hidden renderer, not the utility process"). Part 3 is split into four requests
  of at most about 800 lines, as the lead asked: this contract and serving
  (data-51), the analyser in main with the importer (data-52), the hidden window
  and its page (data-53), and the thumbnail cache (data-54).

## What changed and why

The decision runs video and audio analysis in a hidden renderer that decodes
with Chromium, as the output windows play. That page needs a way to read a file
and a shape for what it answers. This request adds both, and nothing calls them
yet.

1. **The job and the reply** (`src/shared/schema/mediaAnalysis.ts`). Main sends
   the page an `AnalysisJob`: the URL to read, the kind, and the thumbnail size
   to draw, if any. The page answers an `AnalysisReply`: the duration, the pixel
   size, and a JPEG data URL; or why the decoder refused the file, as one of the
   media error codes (`aborted`, `network`, `decode`, `unsupported`) with its
   message. The reply comes from a renderer, so `parseAnalysisReply` checks it:
   a finite duration of at least 0, whole positive pixels, a JPEG data URL of at
   most `MAX_THUMBNAIL_DATA_URL_LENGTH` (512 KB), and a message of at most
   `MAX_ANALYSIS_MESSAGE_LENGTH` (500) characters.
2. **Lending a file** (`src/main/media/analysisFiles.ts`,
   `src/shared/media.ts`). A file being imported has no media id yet, and a file
   imported in place may be outside the media folders, so the media URL can't
   reach it. Main lends the page one file at a time
   (`MAX_LENT_ANALYSIS_FILES`, 1) under a random token:
   `llp-media://analysis/<token>`, which stops working when the analysis gives
   it back.
3. **Serving it with CORS** (`src/main/windows/mediaResponse.ts`,
   `mediaProtocol.ts`). Drawing a frame from another origin taints the canvas,
   so a thumbnail needs a CORS request. The media scheme becomes `corsEnabled`,
   and the analysis route answers with `Access-Control-Allow-Origin: *`, with
   ranges as before. The library route is unchanged and sends no CORS header. A
   token nobody lent and a lent file that is gone answer 404 and are logged.
4. **The thumbnail crop** (`src/shared/coverCrop.ts`). The middle of a picture
   with the target's aspect ratio, as the tiles' `object-fit: cover` shows it.
   Main uses it for images and the page for video frames.

## Changed files

- `src/shared/schema/mediaAnalysis.ts` and `.test.ts` (new): the job and the
  reply.
- `src/shared/coverCrop.ts` and `.test.ts` (new): the crop.
- `src/shared/media.ts` and `.test.ts`: `analysisUrl` and
  `analysisTokenFromUrl`.
- `src/main/media/analysisFiles.ts` and `.test.ts` (new): the loans.
- `src/main/windows/mediaResponse.ts` and `.test.ts`, `mediaProtocol.ts`: the
  analysis route and the scheme privilege.
- `docs/reviews/data-51.md`: this request.

## Changes outside my paths

- `src/main/windows/mediaResponse.ts`, `mediaProtocol.ts` (output): the analysis
  route and `corsEnabled`. Output windows still request library media without
  CORS, so their requests don't change.
- `src/main/media/` (prep, no member): P6a's folder, given to data by the lead.

## Shared contract changes (additive)

- `AnalysisJob`, `AnalysisReply`, `parseAnalysisReply`, and the caps in
  `src/shared/schema/mediaAnalysis.ts`; `analysisUrl` and
  `analysisTokenFromUrl`; `coverCrop`, `PixelSize`, and `Crop`.
- The `llp-media` scheme gains the `corsEnabled` privilege.

## Checks run

| Command or test                                    | Result                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                                | Pass                                       |
| Vitest (`--no-fsModuleCache`) on the changed areas | Pass: 49 tests in 5 files                  |
| `npx --no-install eslint` on the changed files     | Pass                                       |
| `npm run format:check`                             | Pass                                       |
| `npm run verify`                                   | GitHub CI on the head commit (see request) |

Tests: a full reply and an empty one, unknown fields dropped, a refusal with its
reason, and each rejected value (negative or infinite duration, zero or
fractional pixels, a PNG or oversized data URL, an unknown reason, an oversized
message); the crop of a 16:9, a tall, and a wide picture; the analysis URL read
back and kept apart from media URLs; one loan at a time, a released token that
stops working, and a new token for the next loan; the lent file served with a
range and CORS from outside the media folders, a token nobody lent, a handler
without loans, and a lent file that is gone.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (the page's
      reply)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (a loan ends with its analysis)
- [x] Caches and lists have size caps (one loan; the reply's thumbnail and
      message)
- [x] An exception in the output path doesn't stop the output (the library route
      is unchanged)
- [x] Only what's needed re-renders (control window): no renderer change
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly (about 190 lines of code and 210 of tests)
- [ ] Measured performance values (when relevant): not relevant

## Decisions I made (for the lead to confirm)

1. A token route instead of the media id, because a file being imported isn't in
   the media list until after its analysis, and a file imported in place can be
   outside the media folders.
2. CORS for any origin on the analysis route only. The page's origin differs
   between the dev server and the built app, and a token is random and lives for
   one analysis.
3. Thumbnails are JPEG data URLs from the page, which `executeJavaScript` can
   return as a string, rather than binary over a preload: the page then needs no
   preload and no IPC channel (data-53).

## Where to look

- `src/main/windows/mediaResponse.ts`: the analysis route next to the library
  route.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (9a1f22f6): reviewer (Codex, codex3) Approve. Nit for data-52: the 416
  response in `src/main/windows/mediaResponse.ts:89` drops `extraHeaders`, so an
  unsatisfiable analysis range loses its CORS header; include them and add an
  analysis-range test. Lead Approve after reading the loan route: a random UUID
  token, one file at a time, released after the analysis, and
  `Access-Control-Allow-Origin` only on that route. Rebased by the lead onto
  local `main` without conflicts; typecheck passes.

## Team member's reply

1.
