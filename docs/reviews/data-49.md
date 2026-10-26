# Review request: `data-49`

- Team member: data (Claude session)
- Branch: `feat/data/media-import`, stacked on data-47 (`feat/data/save-retry`)
- Base commit: the data-47 head; the request message gives the range, the head
  commit, and its CI run.
- Related brief: `docs/briefs/data.md`; request from `.llp/task.md`, "Next (from
  the lead, 10:15)", item 2, M3-P6a part 1 (`docs/plans/m3-breakdown.md`, "M3-P1
  to M3-P6", P6a), split with the lead's agreement: part 1 imports with copy
  progress; part 2 relinks and checks missing files; part 3 analyses media in a
  hidden renderer (`docs/decisions.md`, 1aa047ff).

## What changed and why

data-34 left a `MediaBackendPort` for P6a: the media channels validate
`media:import` and `media.import.cancel` and wait for a backend to answer them.
This request connects that backend.

1. **Import** (`src/main/media/mediaImporter.ts`). An import takes the files
   from the dialog or from dropped paths, answers at once with a `queued` job
   per file under a reserved media id, and then runs the jobs one at a time:
   each copies its file into the media folder, reporting `copying` with whole
   percents, joins the media list (and the chosen playlist) through
   `MediaStore.add` at the current revision, and reports `complete`. A file
   whose kind isn't supported answers `failed` at once and never queues. A
   refused list addition fails the job and removes its copy. At most
   `MAX_IMPORT_JOBS` (200, the import batch cap) wait or run.
2. **Copying** (`src/main/media/copyFile.ts`). A copy streams through a
   temporary file in the media folder (the same `.<name>.<uuid>.tmp` pattern as
   atomic writes) and renames it into place, so a cancelled or failed copy
   leaves nothing behind. A taken name gets " (2)", " (3)", and so on, up to
   `MAX_NAME_TRIES`.
3. **Cancel.** `media.import.cancel` aborts a waiting or copying job, which
   reports `cancelled`; a job that already ended answers `not-found`.
   Disconnecting at quit cancels every job and waits for the running one.
4. **Kinds** (`src/main/media/mediaKinds.ts`). Video, image, and audio by
   extension: the video and image formats the media protocol serves, and common
   audio formats. The dialog offers all of them first, then each kind.
5. **Open questions 14 and 15**, one constant each: `COPY_IMPORTED_MEDIA` (true;
   false refers to the file in place by its full path) and
   `IMPORTED_VIDEO_SOUND` (false: an imported video starts with 소리 켜기 off).
6. **Wiring** (`src/main/media/register.ts`, `src/main/index.ts`).
   `registerMediaImport` connects the backend to the data store's port, opens
   the dialog on the control window (never in offscreen mode), and is stopped
   before the data store closes. Relinking answers a refusal until part 2,
   marked with a `TODO`.

The `analysing` phase and the item's duration, size in pixels, and thumbnail
arrive with part 3; part 1 records the kind, name, file, and size in bytes.

## Changed files

- `src/main/media/mediaKinds.ts`, `copyFile.ts`, `mediaImporter.ts`,
  `register.ts`, and their tests (new).
- `src/main/store/mediaStore.ts`: `folder`, the media folder.
- `src/main/index.ts` and `index.wiring.test.ts`: register media import and stop
  it before the data store.
- `docs/reviews/data-49.md`: this request.

## Changes outside my paths

- `src/main/media/` (prep, no member): P6a's own folder, given to data by the
  lead.
- `src/main/index.ts` and its wiring test (output): the registration and its
  disposal, as "File ownership" asks of a new main-process module.

## Shared contract changes

None. The import, progress, and cancel contracts are data-25's.

## Checks run

| Command or test                                    | Result                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                                | Pass                                       |
| Vitest (`--no-fsModuleCache`) on the changed areas | Pass: 396 tests in 46 files                |
| `npx eslint` on the changed files                  | Pass                                       |
| `npm run format:check`                             | Pass                                       |
| `npm run verify`                                   | GitHub CI on the head commit (see request) |

Tests: kinds by extension and the dialog filters; a copy with rising whole
percents to 100 and identical bytes, nothing left after a cancel or a missing
source, and numbered names; jobs queued, copied, added with the playlist, and
complete, with the stored item (relative file, size, kind, sound off for video);
the in-place option; an unsupported file; cancelling a waiting job and an ended
one; a refused addition removing its copy; the dialog's files and its cancel;
the job cap and a closed import; disposal cancelling every job; the
registration's dialog, offscreen refusal, relink refusal, a backend that can't
connect, and the stop; the wiring order.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (the channels
      validate requests; the store validates items again)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (abort listeners end with their jobs;
      the backend disconnects)
- [x] Caches and lists have size caps (200 jobs)
- [x] An exception in the output path doesn't stop the output (no output change)
- [x] Only what's needed re-renders (control window): no renderer change
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly (about 500 lines of code and 560 of tests)
- [ ] Measured performance values (when relevant): not measured

## Decisions I made (for the lead to confirm)

1. One job at a time, so imports don't compete for the disk during a service.
2. Failure reasons are short Korean phrases for the tile's tooltip: 지원하지
   않는 형식, 복사하지 못함, 미디어 목록에 넣지 못함.
3. Sound off applies to video only; audio files keep their sound.
4. A refused list addition removes the copied file, so the media folder holds no
   file the list doesn't know.

## Where to look

- `src/main/media/mediaImporter.ts`: the job states and cancellation.
- `src/main/media/copyFile.ts`: the temporary file and its cleanup.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex, codex4): Request changes: a media-list save failure deleted an
  accepted file; finished jobs kept abort listeners; cancels at the copy and
  admission boundaries left files or reported wrongly.
- Round 2 (de8b19db): reviewer (Codex, codex4) Approve, no findings. Lead
  Approve. Rebased by the lead onto local `main` after data-47 without
  conflicts; typecheck passes.

## Team member's reply

1.

## Round 2 reply

All four in
`fix(media): admit imports at one commit boundary and release finished jobs`,
which gives a job explicit phases: copy, then a check for a cancel, then
admission.

1. [P1] `mediaImporter.ts:231`, a list save failure deleted an accepted file.
   `MediaStore.add` applies the item before it saves, so a `write-failed` answer
   now completes the job and keeps the file; the list's save waits for its retry
   (data-47). Only a refusal, which leaves the list unchanged, removes the copy.
   Regression with a real `MediaStore` whose writes fail: the job completes, the
   file stays, and the item is in the list.
2. [P2] `:175`, finished jobs kept their listener on the backend's shared
   signal. Each job now removes its listener when it ends. Regression: three
   imports on one signal leave no `abort` listener.
3. [P2] `:216`, a cancel that won after the copy left an unlisted file. After
   the copy, a cancelled job removes its own copy before it reports `cancelled`.
   Regression: a cancel while the copy finishes removes the file and never
   reaches the list.
4. [P2] `:147`, a cancel during admission reported `cancelled` for an item that
   was in the list. Admission is the commit boundary: the job marks itself
   admitting before `MediaStore.add`, and a cancel from then on is refused
   (`invalid`, "This import is joining the media list"). Regression: a cancel
   while the store's write is pending is refused, and the job completes with its
   file.
