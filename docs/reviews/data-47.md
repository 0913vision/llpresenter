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
   full disk costs a few writes per pass (round 2). The list holds one entry per
   file of a store, which keeps every such document in memory already, so it
   can't outgrow them.
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
4. **Channels** (`src/main/store/saveProblems.ts`). The data store adds the
   waiting saves to data-46's problem feed as a standing source, so
   `app:problem:list` lists `save-failed` while files wait, pushes every change
   through the feed on `app:problem`, and retries on `app:problem:retry-saves`
   (`LlpApi.problems.retrySaves()`, the card's 다시 시도). An explicit retry
   pushes the current problem again when files still wait, even unchanged,
   because pressing 다시 시도 closed the card (visio-c9); the automatic retries
   push only a change. spec-46 adds its skipped files to the same feed.
5. **Contract.** `AppProblem` gains `{kind: 'save-failed', name, count}` and
   `{kind: 'save-recovered'}`, as agreed with the 진행 member (visio-c9), who
   builds the 저장할 수 없음 card on it in spec-45 and 46.

## Changed files

- `src/shared/schema/appProblem.ts` and `.test.ts`: the two kinds, the cap,
  `saveFailedProblem`, and `AppProblemOf`.
- `src/shared/ipc.ts`, `src/preload/index.ts` and `.test.ts`,
  `src/shared/testing/fakeLlpApi.ts` and `.test.ts`: `retrySaves`.
- `src/main/store/saveFailures.ts` and `.test.ts`: the waiting list (new).
- `src/main/store/saveProblems.ts` and `.test.ts`: the feed source, the pushes,
  and the retry listener (new).
- `src/main/store/contentPersistence.ts` and `.test.ts` (new test): reports and
  `retry(file)`.
- `src/main/store/documentFiles.ts`: carries the sink.
- `src/main/store/contentStore.ts` and `.test.ts`: names the files.
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
- [x] Caches and lists have size caps (the waiting list is bounded by the
      stores' documents, one entry per file; each pass by 3 failures in a row)
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
