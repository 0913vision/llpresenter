# Review request: `data-52`

- Team member: data (Claude session)
- Branch: `feat/data/analysis-main`, on `main` after data-50 and data-51
- Base commit: `main` (da5096c8); the request message gives the range, the head
  commit, and its CI run.
- Related brief: `docs/briefs/data.md`; request from `.llp/task.md`, M3-P6a part
  3, second of four (`docs/reviews/data-51.md` lists the split): the analyser in
  main and the importer's analysis.

## What changed and why

Spec 05 ("Behavior", 가져오기) reads each imported file's duration after the
copy, and a file that can't play shows its reason. The decision
(`docs/decisions.md`, "Media analysis runs in a hidden renderer") reads video
and audio in a hidden page and measures images in main. This request adds the
part in main and the importer's use of it; the page itself is data-53.

1. **The analyser** (`src/main/media/mediaAnalyser.ts`). `MediaAnalyser`
   analyses one file at a time from a queue of at most `MAX_QUEUED_ANALYSES`
   (200, one import batch). It lends the file to the page (data-51), runs the
   job, and checks the reply. The page opens on demand and closes after
   `ANALYSIS_IDLE_CLOSE_MS` (30 s) with nothing to read. A file gets
   `ANALYSIS_TIMEOUT_MS` (20 s): past that, the page closes, since its decoder
   may be stuck, and the next file opens a new one. An analysis ends as `read`
   (the facts), `cant-play` (the decoder's refusal and its reason), or
   `unavailable` (a timeout, a failed page, a malformed reply, a full queue, or
   a cancel). A request's abort signal stops waiting at once. Disposal answers
   the running and waiting analyses and closes the page, so quitting never waits
   for a stuck decoder.
2. **Images in main** (`src/main/media/measureImage.ts`). `nativeImage` measures
   an image and, when asked, draws the middle of it at `THUMBNAIL_SIZE` (320 by
   180, the 16:9 tile frame) as a JPEG. An image it can't read, such as WebP, or
   one that throws, goes to the page instead.
3. **Imports** (`src/main/media/mediaImporter.ts`). After the copy, a job
   reports `analysing` and analyses its file. A file the decoders refuse fails
   with a reason for the tile's tooltip (재생할 수 없는 형식, 손상되어 재생할 수
   없는 파일, 읽을 수 없는 파일), and its copy is removed. A file analysis
   couldn't read joins the list without its facts, and is logged. Otherwise the
   duration and the pixel size join the item. A cancel during analysis works
   like one during the copy. The thumbnail isn't asked for yet: it needs the
   cache (data-54).
4. **Wiring** (`src/main/media/register.ts`, `src/main/index.ts`). One
   `AnalysisFiles` is shared by the media scheme, which serves the loans, and
   the backend, which lends them. The backend's stop disposes the analyser
   before it cancels the imports. Until data-53, opening the page is a `TODO`
   that refuses, so video and audio join without their duration, as they do
   today, and images are measured.
5. **A data-51 nit** (codex3, moved here). A refused analysis range (416)
   dropped the CORS header, so the page couldn't read the refusal. It keeps the
   header now (`src/main/windows/mediaResponse.ts`).

## Changed files

- `src/main/media/mediaAnalyser.ts`, `measureImage.ts`, and their tests (new).
- `src/main/media/mediaImporter.ts` and `.test.ts`: the analysis step.
- `src/main/media/register.ts` and `.test.ts`: the analyser.
- `src/main/index.ts` and `index.wiring.test.ts`: the shared loans.
- `src/main/windows/mediaResponse.ts` and `.test.ts`: the data-51 nit.
- `docs/reviews/data-52.md`: this request.

## Changes outside my paths

- `src/main/index.ts` and its wiring test (output): the loans for `serveMedia`
  and the backend.
- `src/main/windows/mediaResponse.ts` and its test (output): the nit.
- `src/main/media/` (prep, no member): P6a's folder, given to data by the lead.

## Shared contract changes

None. `analysing` is data-25's phase.

## Checks run

| Command or test                                    | Result                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                                | Pass                                       |
| Vitest (`--no-fsModuleCache`) on the changed areas | Pass: 161 tests in 17 files                |
| `npx --no-install eslint` on the changed files     | Pass                                       |
| `npm run format:check`                             | Pass                                       |
| `npm run verify`                                   | GitHub CI on the head commit (see request) |

Tests: an image measured in main without the page; a video read in the page from
a lent file that is given back; images main can't read or that throw sent to the
page; the decoder's refusal; one file at a time in order; the page closed
exactly at the idle time and a new one opened after; disposal answering the
running and waiting files and closing the page; a timeout closing the page and
the next file opening a new one; a malformed reply, a failed run, and a page
that can't open, then a working one; a cancel while waiting, and an aborted
request; the queue cap; `nativeImage` measuring, cropping, scaling, and
answering null; an import's `analysing` report, its facts in the item without
the thumbnail, a refused file failing with its copy removed, an unread file
added without facts, and a cancel during analysis; the registration measuring an
imported image; the wiring serving the backend's loans; a refused analysis range
keeping its CORS header.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (the page's
      reply, data-51)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (abort listeners, the idle and timeout
      timers, loans, and the page)
- [x] Caches and lists have size caps (200 waiting analyses, one loan)
- [x] An exception in the output path doesn't stop the output (no output change)
- [x] Only what's needed re-renders (control window): no renderer change
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly (about 390 lines of code and 490 of tests)
- [ ] Measured performance values (when relevant): not measured; the page's
      decoding time is data-53's

## Decisions I made (for the lead to confirm)

1. A file analysis couldn't read joins the list without its facts rather than
   failing: a timeout on a slow disk or a page that failed to open says nothing
   about the file. Only the decoder's refusal fails the import.
2. 20 seconds per file and 30 seconds of idle time: long enough for a large
   video on a slow disk, short enough that a stuck decoder doesn't hold the
   queue.
3. `analysing` reports 100 percent, the finished copy; analysis has no progress
   of its own.
4. The reasons are short Korean phrases like data-49's, and the decoder's own
   message goes only to the log.

## Where to look

- `src/main/media/mediaAnalyser.ts`: the queue, the timeout, the idle close, and
  disposal.
- `src/main/media/mediaImporter.ts`: the analysis step between the copy and the
  commit boundary.

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

Both in
`fix(media): bound opening the analysis page and unwind an analysis on disposal`.

1. [P2] `mediaAnalyser.ts:225`, a page that never opened blocked the queue. One
   deadline now covers opening the page and running the job. When it passes, the
   page is given up and the next file opens a new one. Opening takes an abort
   signal, aborted whenever analysis gives up on a page (after a timeout, when
   idle, or on disposal), so the window can be destroyed while it still loads;
   data-53 does that on the window side. Regression: a page that never opens
   times out, its signal aborts, the file is given back, and the next file opens
   a new page and is read.
2. [P2] `mediaAnalyser.ts:167`, disposal left the running analysis going. The
   running analysis now has an abort controller that disposal aborts: its
   deadline ends at once and clears its timer, the file is given back, and a
   page that opens afterwards is never run, only closed. Regressions: disposal
   while the page opens (the caller answered, the open signal aborted, no timer
   left, the file given back, and the late page closed without a run) and while
   the page runs (no timer left, the file given back). The three new tests fail
   without the fix.
