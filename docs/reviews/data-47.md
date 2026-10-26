# Review request: `data-47`

- Team member: data (Claude session)
- Branch: `feat/data/save-retry`, stacked on data-46 (`feat/data/macro-drop`),
  data-48, and data-44
- Base commit: the data-46 head; the request message gives the range, the head
  commit, and its CI run.
- Related brief: `docs/briefs/data.md`; request from `.llp/task.md`, "Added
  (10:45)", item 2; spec 02 "Save failures" and spec 08 "Save failed".

## What changed and why

`EditFailure`'s TSDoc says that main saves the unwritten files "again later" and
reports 저장할 수 없음, but main only retried them while quitting, and no window
heard about them. This request makes that true for the songs, 예배 순서, 틀,
app-wide settings, and the media list.

1. **One waiting list** (`src/main/store/saveFailures.ts`). `SaveFailures` keeps
   each file that couldn't be written, in retry order. Every change pushes
   `save-failed` with the next file's name and the count; when the last file is
   written, it pushes `save-recovered`. While files wait, it writes them again
   every `SAVE_RETRY_INTERVAL_MS` (30 s) and at once on `retry()`, which joins a
   retry that already runs. A pass moves each file that fails again to the end
   and stops after `MAX_FAILED_RETRIES_IN_A_ROW` (3) failures in a row, so a
   full disk costs a few writes per pass (round 2), and walks the list without
   copying it (round 3).
2. **A cap** (round 3). Once `MAX_WAITING_SAVES` (100) files of the content
   store wait, an edit that would write or delete a file that doesn't wait yet
   is refused with the new reason `saves-full` before it changes anything, and
   저장할 수 없음 is pushed again; an edit of files that wait already goes on.
   Nothing waiting is ever dropped. A file's later operation replaces its
   earlier one, so a delete supersedes a waiting write and only the newest
   intent is retried.
3. **Where the content waits.** The stores already keep the edited documents in
   memory, and `ContentPersistence`, which the content, settings, and media
   stores share, already kept each file's newest failed write or delete for the
   flush at quit. It now reports such a file to the sink in `DocumentFiles` with
   a `retry` that runs its newest operation again, and reports it written once
   that operation, or a newer one, succeeds. A superseded failure is left to the
   newer operation's result, so an older text never comes back.
4. **Names.** The card names a song by its title and a 예배 순서 or 틀 by its
   name (`ContentStore.nameOfFile`); settings and the media list use their file
   names, such as `media.json`.
5. **Channels** (`src/main/store/saveProblems.ts`). The data store adds the
   waiting saves to data-46's problem feed as a standing source, so
   `app:problem:list` lists `save-failed` while files wait, pushes every change
   through the feed on `app:problem`, and retries on `app:problem:retry-saves`
   (`LlpApi.problems.retrySaves()`, the card's 다시 시도). An explicit retry
   pushes the current problem again when files still wait, even unchanged,
   because pressing 다시 시도 closed the card (visio-c9); the automatic retries
   push only a change. spec-46 adds its skipped files to the same feed.
6. **Contract.** `AppProblem` gains `{kind: 'save-failed', name, count}` and
   `{kind: 'save-recovered'}`, as agreed with the 진행 member (visio-c9), who
   builds the 저장할 수 없음 card on it in spec-45 and 46.

## Changed files

- `src/shared/schema/appProblem.ts` and `.test.ts`: the two kinds, the cap,
  `saveFailedProblem`, and `AppProblemOf`.
- `src/shared/schema/contentEdit.ts`: the `saves-full` refusal (round 3).
- `src/shared/ipc.ts`, `src/preload/index.ts` and `.test.ts`,
  `src/shared/testing/fakeLlpApi.ts` and `.test.ts`: `retrySaves`.
- `src/main/store/saveFailures.ts` and `.test.ts`: the waiting list (new).
- `src/main/store/saveProblems.ts` and `.test.ts`: the feed source, the pushes,
  and the retry listener (new).
- `src/main/store/contentPersistence.ts` and `.test.ts` (new test): reports,
  `retry(file)`, and the cap's `admits` and `remind`.
- `src/main/store/documentFiles.ts`: carries the sink.
- `src/main/store/contentStore.ts` and `.test.ts`: names the files and checks
  the cap before each edit changes anything.
- `src/main/store/settingsStore.ts`, `mediaLoader.ts` and `.test.ts`: pass the
  sink; `openMediaStore` takes its context as one object.
- `src/main/store/register.ts` and `.test.ts`: one `SaveFailures` for all
  stores, its feed source, and their disposal; `registerStore` takes the feed.
- `src/main/index.ts` and `index.wiring.test.ts`: the feed starts before the
  data store, which gets it.
- `src/main/live/store.test.ts`: narrows a problem by kind.
- `docs/reviews/data-47.md`: this request.

## Changes outside my paths

- `src/main/index.ts` and its wiring test, `src/main/live/store.test.ts`
  (output): the data store gets the problem feed, and a test narrows the wider
  union.

## Shared contract changes (additive)

- `save-failed` and `save-recovered` in `AppProblem`, `saveFailedProblem`,
  `AppProblemOf`, `app:problem:retry-saves`, and `LlpApi.problems.retrySaves`.
- `saves-full` in `editRefusalReasons` (round 3). No window branches on it yet;
  each treats it like any other refusal until the editing windows show it.

## Checks run

| Command or test                                    | Result                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                                | Pass                                       |
| Vitest (`--no-fsModuleCache`) on the changed areas | Pass: 1,591 tests in 106 files             |
| `npx eslint` on the changed files                  | Pass                                       |
| `npm run format:check`                             | Pass                                       |
| `npm run verify`                                   | GitHub CI on the head commit (see request) |

Tests: the pushes for a first, a second, and a repeated file, a written file,
and the last one (`save-recovered`); the list; one retry per file in order,
joined, with a throwing retry logged; the automatic retry at exactly the
interval, again while files wait, and no timer once none do; an explicit retry
pushing an unchanged problem again; the cap; a throwing listener; disposal;
`ContentPersistence` reporting by name, retrying the newest text, and leaving a
superseded failure to the newer write; a song named by its title and a 틀 by its
name, and the song reported written after its retry; the feed source's list,
push, retry, and removal; the payloads, the preload send, and the fake.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released
- [x] Caches and lists have size caps (`MAX_WAITING_SAVES` waiting files per
      store, one entry per file; each pass by 3 failures in a row)
- [x] An exception in the output path doesn't stop the output (a save failure
      never touches the output, spec 02)
- [x] Only what's needed re-renders (control window): no renderer change
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not relevant

## Decisions I made (for the lead to confirm)

1. Automatic retries every 30 seconds while files wait, besides 다시 시도, the
   next edit of the same file, and the flush at quit (the lead's "retry it";
   spec 02 names only 다시 시도).
2. `save-recovered` as its own kind instead of `count: 0`, so `save-failed`
   always names a file (agreed with visio-c9).
3. `app.json` stays out: it holds the window's UI state, writes through its own
   writer, and already logs its failures.
4. The card names content by title or name rather than by file name, because
   song files are named by id.
5. A failed delete waits like a failed write, since `ContentPersistence` retries
   both.
6. The cap refuses only edits of the songs, 예배 순서, and 틀 (round 3).
   Settings and the media list are one file each, so they can't grow the list,
   and the open 예배 순서's save on switching and the autosave of an accepted
   edit write a change that is in memory already, so refusing them would save
   nothing. An edit admitted just below the cap may take the count past it by
   its own files (a 라벨 rename by its songs); those are documents in memory,
   and deleted documents never pass the cap.
7. The cap is 100 files: a disk that fails that many writes is broken, and the
   card already shows it.

## Where to look

- `src/main/store/saveFailures.ts`: the order, the pushes, the timer, and the
  cap.
- `src/main/store/contentPersistence.ts`, `report`: which operation decides.
- `src/main/store/register.ts`: one list for all stores and its disposal.

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

## Round 2 reply

1. [P2] `saveFailures.ts:59`, the 257th failed file fell out of retries and
   notices. Fixed in
   `fix(store): keep every waiting save and bound each retry pass`: there is no
   drop any more. The list keeps one entry per waiting file, and every one is a
   document its store holds in memory anyway, so the list is bounded by the
   stores (a NOTE says why). The retry work is what's bounded now: a pass
   retries in order, moves each file that fails again to the end, and stops
   after `MAX_FAILED_RETRIES_IN_A_ROW` (3) failures in a row, so the next pass
   starts with files it didn't try. `count` loses its 256 cap (a safe positive
   integer). Regressions: 300 waiting files are all counted, and
   `save-recovered` goes out only after the last one is written; a pass over
   five failing files tries three, and the next pass tries the other two first.
2. [P2] `contentStore.ts:394`, an unnamed 예배 순서 or 틀 gave an empty name.
   Fixed in `fix(store): name an unnamed waiting file by its file name`: a blank
   name falls back to the file name. Regression: a 틀 with an empty name waits
   under its file name.
3. The private method's TSDoc is gone (same commit).

## Round 3 reply

1. [P2] `saveFailures.ts:68`, repeated failed deletes grew the list without a
   bound. Fixed in
   `fix(store): cap the waiting saves and refuse edits of new files at the cap`,
   as directed:
   1. **Coalescing.** Each file keeps only its newest operation, and song, 예배
      순서, and 틀 files are named by id, so a delete supersedes a waiting write
      of the same document and the retry runs only the delete. Regression: a
      failed write and then a failed delete of one file leave one waiting entry,
      and its retry deletes without writing.
   2. **One cap.** `MAX_WAITING_SAVES` (100) in `saveFailures.ts`.
      `ContentPersistence` tracks the files whose newest operation failed and
      `admits` an edit while fewer than 100 wait, or when every file it touches
      waits already.
   3. **Refusal at the cap.** `ContentStore` checks before an edit changes
      anything (create, update, delete, 구성 edits with every 예배 순서 and 틀
      they rewrite, item import, 틀 saving, and the songs of a 라벨 rename). A
      refused edit answers `saves-full`, "Too many files are waiting to be
      saved", and pushes `save-failed` again through the new
      `SaveFailureSink.remind()`. Nothing is dropped: the document stays in its
      collection and every waiting entry stays. Regression: 100 create and
      delete cycles on a failing disk leave 100 waiting deletes; then a create,
      a delete, and an update are refused with the song, the list, and the files
      unchanged; once the disk works, the retries delete all 100 without
      writing, and a create works again. Another: at the cap, an update of a
      song that waits already goes on.
   4. **No copy per pass.** A pass takes the first waiting file each time, since
      a file that fails again moves to the end, and stops after the number of
      files that waited when it began. Regression: a file that starts waiting
      during a pass waits for the next one.
