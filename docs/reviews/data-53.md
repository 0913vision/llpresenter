# Review request: `data-53`

- Team member: data (Claude session)
- Branch: `feat/data/analysis-window`, stacked on data-52
  (`feat/data/analysis-main`, round 2)
- Base commit: the data-52 head; the request message gives the range, the head
  commit, and its CI run.
- Related brief: `docs/briefs/data.md`; request from `.llp/task.md`, M3-P6a part
  3, third of four (`docs/reviews/data-51.md` lists the split): the hidden
  window and its page.

## What changed and why

data-52 left opening the analysis page as a `TODO`, so video and audio joined
the media list without their duration. This request adds the page and the hidden
window that runs it (`docs/decisions.md`, "Media analysis runs in a hidden
renderer"), so imports read them with the decoders the output windows play with.

1. **The page** (`src/renderer/analysis.html`, `src/renderer/src/analysis/`). A
   third renderer entry with no UI. It defines `window.analyseMedia(job)`, which
   reads one file and answers the data-51 reply:
   - video: the metadata gives the duration and the pixel size; for a thumbnail
     it seeks to `THUMBNAIL_FRAME_SECONDS` (1 s), or half way through a shorter
     video, and draws the middle of that frame on a canvas as a JPEG at
     `THUMBNAIL_QUALITY` (0.8);
   - audio: the duration;
   - images that main can't read: the pixel size and the thumbnail. A media
     error answers its code as the reason, with the decoder's message. Elements
     load the file with CORS (data-51), so the canvas isn't tainted, and each
     element's source is removed afterwards so the decoder lets go of the file.
     The page's CSP allows only its own script and the media scheme.
2. **The window** (`src/main/media/analysisPage.ts`). `openAnalysisPage` opens a
   window that is never shown or focused and stays out of the taskbar, sandboxed
   with context isolation and without a preload, and blocks navigation and new
   windows. Main calls `analyseMedia` with `executeJavaScript`, which answers
   the page's promise; data-52's analyser checks the reply, times it out, and
   closes the window when idle or on disposal. A page that can't load closes its
   window and rejects; a renderer process that stops is logged, and the
   analyser's timeout replaces it.
3. **Wiring** (`src/main/media/register.ts`, `src/main/windows/page.ts`,
   `electron.vite.config.ts`). The backend opens the page on demand instead of
   refusing, and the build gains the `analysis` page.

## Changed files

- `src/renderer/analysis.html`, `src/renderer/src/analysis/main.ts`,
  `analyseMedia.ts`, and `.test.ts` (new): the page.
- `src/main/media/analysisPage.ts` and `.test.ts` (new): the window.
- `src/main/media/register.ts`: opens the page.
- `src/main/windows/page.ts`, `electron.vite.config.ts`: the `analysis` page.
- `docs/reviews/data-53.md`: this request.

## Changes outside my paths

- `src/renderer/src/analysis/` and `src/renderer/analysis.html` (ui): a page
  with no UI that only main uses; the decision puts analysis in a renderer.
- `src/main/windows/page.ts` and `electron.vite.config.ts` (output, devops): the
  page name and the build input.

## Shared contract changes

None. The page answers data-51's `AnalysisReply`.

## Checks run

| Command or test                                    | Result                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                                | Pass                                       |
| Vitest (`--no-fsModuleCache`) on the changed areas | Pass: 104 tests in 11 files                |
| `npx --no-install eslint` on the changed files     | Pass                                       |
| `npm run format:check`                             | Pass                                       |
| `npm run verify`                                   | GitHub CI on the head commit (see request) |

Tests, with jsdom elements whose media properties and events the tests set: a
video's facts and a thumbnail one second in, with the crop, CORS, and the source
released; a short video's frame half way through; a video without a picture or a
known length, with no seek; no thumbnail when none is asked for; a decoder error
cut to the message cap; a failed seek; audio; an image and its crop; an image
that can't decode; a canvas without a 2D context. The window: its options
without a preload, the page it loads, a job run through `executeJavaScript`,
closing once, a stopped renderer logged, and a page that can't load closing its
window.

Not covered by these tests: jsdom has no decoder and no canvas, and this session
doesn't open windows. These behaviors are covered only by the video import check
on the m3-check1 sheet, in the user's build:

1. The build emits `analysis.html`, and the hidden window loads it with its CSP
   allowing its module script and the media scheme.
2. `executeJavaScript` returns the value of `analyseMedia`'s promise.
3. A window that is never shown still decodes: a video's `loadedmetadata` and
   `seeked` events fire.
4. The duration and pixel size Chromium reports for real video and audio files
   join the media item on import.
5. A file Chromium can't play (for example, an unsupported codec) fails its
   import with the reason, and its copy is removed.
6. A frame loaded with CORS draws on the canvas without tainting it, so
   `toDataURL` succeeds. data-54 shows this as the tile's thumbnail.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (the reply, in
      data-52's analyser)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (each element's listeners end when it
      settles, and its source is removed; the window closes when idle)
- [x] Caches and lists have size caps (the reply's caps, data-51)
- [x] An exception in the output path doesn't stop the output (no output change)
- [x] Only what's needed re-renders (control window): no control window change
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly (about 300 lines of code and 320 of tests)
- [ ] Measured performance values (when relevant): not measured (see the
      behaviors only the m3-check1 sheet covers)

## Decisions I made (for the lead to confirm)

1. No preload: `executeJavaScript` calls the page's one function and returns its
   promise's value, so the hidden window has no IPC surface at all.
2. The thumbnail frame is 1 second in, which skips a fade from black at the
   start, or half way through a shorter video.
3. `backgroundThrottling` is off so a hidden page still runs its timers and
   media events at full speed.

## Where to look

- `src/renderer/src/analysis/analyseMedia.ts`: the order of events for a video
  and the element release.
- `src/main/media/analysisPage.ts`: the window's options.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex, codex5): Request changes: page startup had no deadline, and
  the window couldn't be destroyed while it loaded.
- Round 2 (eea62b0c): reviewer (Codex, codex5) Approve, no findings. Restacked
  after data-52's round 3 with its own commits unchanged. Lead Approve. Real
  decoding is covered only by the m3-check1 built-app check, as the request
  lists. Rebased by the lead onto local `main` without conflicts; typecheck
  passes.

## Team member's reply

1.

## Round 1 reply

1. [P2] `analysisPage.ts:35`, startup had no deadline and the window couldn't
   close while it loaded. Fixed with data-52's round 1, which puts one deadline
   over opening the page and running the job and gives `openPage` an abort
   signal that aborts whenever analysis gives up on the page (a timeout, idle
   time, or disposal). Here, in
   `fix(media): destroy the analysis window when analysis gives up on it, also while it loads`,
   `openAnalysisPage` takes that signal: it destroys the window at any time,
   also while the page loads, and a load the signal ends rejects at once. A
   signal that aborted before opening loads nothing. Listeners on the signal end
   with the load and with `close`. Regressions: a load that never settles, then
   the signal, rejects and destroys the window; an opened window is destroyed by
   the signal; an aborted signal loads nothing. Queue recovery is data-52's
   regression: the page that never opens times out, and the next file opens a
   new page and is read.
