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
   each file that couldn't be written, oldest first, at most
   `APP_PROBLEM_LIMITS.waitingSaves` (256). Every change pushes `save-failed`
   with the oldest file's name and the count; when the last file is written, it
   pushes `save-recovered`. While files wait, it writes them again every
   `SAVE_RETRY_INTERVAL_MS` (30 s) and at once on `retry()`, which writes each
   file once, oldest first, and joins a retry that already runs. A file over the
   cap is logged; its store still keeps it for the next write and for the flush
   at quit.
2. **Where the content waits.** The stores already keep the edited documents in
   memory, and `ContentPersistence`, which the content, settings, and media
   stores share, already kept each file's newest failed write or delete for the
   flush at quit. It now reports such a file to the sink in `DocumentFiles` with
   a `retry` that runs its newest operation again, and reports it written once
   that operation, or a newer one, succeeds. A superseded failure is left to the
   newer operation's result, so an older text never comes back.
3. **Names.** The card names a song by its title and a 예배 순서 or 틀 by its
   name (`ContentStore.nameOfFile`); settings and the media list use their file
   names, such as `media.json`.
4. **Channels** (`src/main/store/problemChannels.ts`). The data store answers
   `app:problem:list` with `save-failed` while files wait, sends every change to
   the windows on `app:problem`, and retries on `app:problem:retry-saves`
   (`LlpApi.problems.retrySaves()`, the card's 다시 시도). The list handler
   moves here from `registerIpc` (data-46's empty placeholder), since the
   standing problems belong to the data store; spec-46 adds its skipped files
   here too.
5. **Contract.** `AppProblem` gains `{kind: 'save-failed', name, count}` and
   `{kind: 'save-recovered'}`, as agreed with the 진행 member (visio-c9), who
   builds the 저장할 수 없음 card on it in spec-45 and 46.

## Changed files

- `src/shared/schema/appProblem.ts` and `.test.ts`: the two kinds, the cap,
  `saveFailedProblem`, and `AppProblemOf`.
- `src/shared/ipc.ts`, `src/preload/index.ts` and `.test.ts`,
  `src/shared/testing/fakeLlpApi.ts` and `.test.ts`: `retrySaves`.
- `src/main/store/saveFailures.ts` and `.test.ts`: the waiting list (new).
- `src/main/store/problemChannels.ts` and `.test.ts`: the channels (new).
- `src/main/store/contentPersistence.ts` and `.test.ts` (new test): reports and
  `retry(file)`.
- `src/main/store/documentFiles.ts`: carries the sink.
- `src/main/store/contentStore.ts` and `.test.ts`: names the files.
- `src/main/store/settingsStore.ts`, `mediaLoader.ts` and `.test.ts`: pass the
  sink; `openMediaStore` takes its context as one object.
- `src/main/store/register.ts` and `.test.ts`: one `SaveFailures` for all
  stores, the channels, and their disposal.
- `src/main/ipc.ts` and `.test.ts`: the list handler moved out.
- `src/main/live/store.test.ts`: narrows a problem by kind.
- `docs/reviews/data-47.md`: this request.

## Changes outside my paths

- `src/main/ipc.ts` and `.test.ts`, `src/main/live/store.test.ts` (output): the
  list handler leaves `registerIpc`, and a test narrows the wider union.

## Shared contract changes (additive)

- `save-failed` and `save-recovered` in `AppProblem`,
  `APP_PROBLEM_LIMITS.waitingSaves`, `saveFailedProblem`, `AppProblemOf`,
  `app:problem:retry-saves`, and `LlpApi.problems.retrySaves`.

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
interval, again while files wait, and no timer once none do; the cap; a throwing
listener; disposal; `ContentPersistence` reporting by name, retrying the newest
text, and leaving a superseded failure to the newer write; a song named by its
title and a 틀 by its name, and the song reported written after its retry; the
channels' list, push, retry, and removal; the payloads, the preload send, and
the fake.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released
- [x] Caches and lists have size caps (256 waiting files)
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
