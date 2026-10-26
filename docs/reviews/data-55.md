# Review request: `data-55`

- Team member: data (Claude session)
- Branch: `feat/data/media-view-store`, stacked on data-54
  (`feat/data/thumbnails`)
- Base commit: the data-54 head; the request message gives the range, the head
  commit, and its CI run.
- Related brief: `docs/briefs/data.md`; request from the lead (M3-P6b, the media
  view, in `src/renderer/src/prep/media/`, on the P6a backend and the thumbnail
  route; requests near 600 to 800 lines, grid and import first). P6b part 1 is
  split in two: this store (data-55) and the grid view with the 준비 미디어
  toggle (data-56).

## What changed and why

The media view (spec 05, "Media view") shows the media list, the files being
imported, and the files main can't find. This request adds the renderer state
behind it, with no UI yet.

1. **The store** (`src/renderer/src/prep/media/mediaLibrary.ts`). `MediaLibrary`
   reads the media list and the missing files, and follows main's pushes: a
   newer list (an older revision is ignored), each import's progress, kept per
   media id until it ends, and the missing set. `start(onProblem)` returns the
   function that releases all three listeners.
2. **Its actions.** 가져오기 opens main's dialog for a playlist and shows the
   queued files at once from the import's answer, since main pushes only from
   the copy on. 복사 멈추기 cancels a job; a job that already ended says
   nothing. 다시 연결 asks main for one missing file; a relink whose save failed
   is applied, so it says nothing. A second relink while one is open does
   nothing, so the second click of a double click doesn't ask main twice.
3. **Problems.** A failed import, a refused import, cancel, or relink, and a
   list that can't load are notices in Korean, with the file name. A failed
   import's own reason, such as 재생할 수 없는 형식 from analysis, joins the
   notice; main's English refusal messages go to the log instead.
4. **The grid's entries** (`mediaEntries.ts`). 모든 미디어 is every item in list
   order, then the files still being imported that haven't joined the list. It
   also holds the duration (0:30), size (2.1GB), and footer (7개 2.1GB) texts.
5. **A test helper** (`mediaTesting.ts`): a media API whose answers a test sets
   and whose pushes it sends, used here and by data-56.

## Changed files

- `src/renderer/src/prep/media/mediaLibrary.ts`, `mediaEntries.ts`,
  `mediaTesting.ts`, and the first two's tests (new).
- `docs/reviews/data-55.md`: this request.

## Changes outside my paths

- `src/renderer/src/prep/media/` (prep, no member): the media view's folder,
  given to data by the lead for P6b. It reads `show/mediaCopyJobs.ts` (ui)
  without changing it.

## Shared contract changes

None.

## Checks run

| Command or test                                    | Result                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                                | Pass                                       |
| Vitest (`--no-fsModuleCache`) on the changed areas | Pass: 8 tests in 2 files                   |
| `npx --no-install eslint` on the changed files     | Pass                                       |
| `npm run format:check`                             | Pass                                       |
| `npm run verify`                                   | GitHub CI on the head commit (see request) |

Tests: the list and the missing set read and followed, an older list ignored; an
import in progress kept until it fails, with its notice; an import through the
dialog into a playlist showing its queued file; a refused import, cancel, and
relink each giving a Korean notice and logging main's reason; a cancel of an
ended job and a relink saved later staying quiet; a list that can't load, and
stopping releasing every listener; the entries' order and copy progress; the
duration, size, and footer texts.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (the preload
      validates every media payload)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the three listeners on stop)
- [x] Caches and lists have size caps (jobs at the media list cap, through
      `updateActiveCopies`)
- [x] An exception in the output path doesn't stop the output (no output change)
- [x] Only what's needed re-renders (control window): the snapshot changes only
      when something changed
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly (about 290 lines of code and 250 of tests)
- [ ] Measured performance values (when relevant): not relevant

## Decisions I made (for the lead to confirm)

1. Notices stay Korean; main's English refusal messages go to the log, and only
   an import's own Korean reason joins its notice.
2. The renderer ignores a second relink while one is open, rather than showing
   main's refusal.

## Where to look

- `src/renderer/src/prep/media/mediaLibrary.ts`: following the pushes and the
  relink guard.

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
