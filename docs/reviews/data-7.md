# Review request: `data-7`

Review range: `d5b8af9...feat/data/file-store`

Round 2 changes only: `d6087be...feat/data/file-store`

- Team member: `data`
- Branch: `feat/data/file-store`, on `main` (data-4 has merged)
- Base commit (`main`): `d5b8af9` (round 1: `b9392d0`)
- Last commit: see the newest commit that changes this file
- Related brief: `docs/briefs/data.md`; M2 in `docs/MILESTONES.md`,
  "Main-process file store"; `docs/spec/02-data.md`, "Save rules"

What to check in round 2:

1.  Finding 1: `src/main/store/saver.ts` runs each file's recovery copy and
    write as one step through `FileWriter`, in request order. Test:
    `saver.test.ts`, "writes overlapping saves in order when the first copy is
    slow".
2.  Finding 2: `src/main/store/fileWriter.ts` keeps one waiting job and one
    shared promise per file, and `src/main/store/autosave.ts` runs one save per
    key and keeps only the newest due one. Tests: `fileWriter.test.ts`, "keeps
    one waiting text and one shared result while a write stalls";
    `autosave.test.ts`, the three tests about a stalled save.
3.  Finding 3: `confineLocations` in `src/main/store/locations.ts` and the
    junction tests in `locations.test.ts`. The caller that runs it before any
    read is `loadStore` in `data-8`, which gets that change in its round 2.
4.  The nits in `recoveryCopies.ts` and `fileWriter.test.ts`.

Changed files outside `src/main/store/`: none. `src/main/store/` is data's.

## What changed and why

The first of three requests for the M2 file store (the lead approved the split).
This one is the write path. The read path, the wiring into the main process, and
shell's `ShowService` channel follow in `data-8`, and the backups in `data-9`.
Nothing calls these modules yet.

| Module              | What it does                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `atomicWrite.ts`    | `writeFileAtomically`: a temporary file in the same folder, flushed with `fsync`, then renamed over the file. Creates a missing folder. Returns a `Result`, never throws.                                                                   |
| `fileWriter.ts`     | `FileWriter<TJob>`: the jobs for one file run one at a time, in order. While one runs, only the newest job waits, and every caller of a replaced job shares the newer job's result. `idle()` for quitting.                                  |
| `recoveryCopies.ts` | `RecoveryCopies`: before an overwrite, copies the previous version to `.복구 사본/<kind>/<id>/<time>.json`, at most once per file every 5 minutes, and keeps 환경설정's count.                                                              |
| `autosave.ts`       | `Autosave`: saves once the changes to a file stop for 0.5 seconds, one save per file at a time; a save that comes due meanwhile waits, newest only. `flush()` saves what waits and waits for running saves. `dispose()` clears every timer. |
| `locations.ts`      | `resolveLocations` and `readLocationFields`: the data folders from `app.json`, and the location fields of a broken `app.json`. `confineLocations`: in development, refuses folders that a junction or link leads outside `LLP_USER_DATA`.   |
| `saver.ts`          | `Saver`: keeps a recovery copy, then writes atomically, both as one job of a `FileWriter`, so a file's saves run in order.                                                                                                                  |

The spec's save rules, as built:

- Atomic writes, and the later content wins when writes overlap
  (`docs/spec/02-data.md`, "Atomic writes").
- Recovery copies: the folder layout, the count, and the 5-minute limit
  ("Recovery copies"). The count is a function, so a change in 환경설정 applies
  at once.
- Autosave within 0.5 seconds after the last change, and a flush before the app
  quits ("Autosave").

The lead's rules for the store:

1. No development run may touch the user's real data. With `LLP_USER_DATA` set,
   the data folder defaults to `<LLP_USER_DATA>/LoveLight`, and an `app.json`
   folder outside `LLP_USER_DATA` is ignored and reported. A test proves that
   every folder resolves inside it. Every test uses the temporary folders of
   `test/temp-dir.ts`.
2. A broken `app.json`: `readLocationFields` keeps each location field that is
   text and returns the validation problem. The wiring in `data-8` warns once
   and never writes over that file.

On Windows, antivirus and indexers can hold a file for a moment after it
changes, so a rename that fails with `EPERM`, `EBUSY`, or `EACCES` is retried up
to 5 times, with a short delay that grows. Other errors fail at once.

### One atomic writer for the app

Shell's `src/main/uiState/atomicWrite.ts` (shell-3, in review) also writes
atomically. The lead asked for one writer; shell switches to this one after this
merges. The differences shell will meet:

- `writeFileAtomically` returns a `Result` instead of throwing.
- Each write uses its own temporary file name, so two writes never share one.
- It retries the short Windows locks above.

## Changed files

- `src/main/store/`: the six modules above, a test file for each, and
  `atomicWriteRetry.test.ts`, which mocks `rename` to test the retry.
- `docs/reviews/data-7.md` (new).

## Checks run

Round 2: `npm run verify` on the commit before this document's round 2 change
(ddf4068), on `main` d5b8af9: every step passed. The one skipped test belongs to
another member's suite. Coverage of `src/main/store/`: 98.5% of lines, 91.6% of
branches.

| Command or test                    | Result                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| `npm run typecheck`                | Passed                                                                |
| `npm test`                         | Passed: 112 files, 1228 tests and 1 skipped (45 in the store)         |
| `npm run format:check`             | Passed                                                                |
| `npm run build`                    | Passed                                                                |
| `npm run verify` (from phase 1 on) | Passed: typecheck, lint, format:check, test:coverage, build (261.9 s) |

Round 1 passed too, on `main` b9392d0 with `data-6` and `data-4` below it (955
tests, 218.4 s).

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema: `app.json`
      goes through `parseAppConfig`.
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: `Autosave.dispose` clears its timers,
      and a test checks that no timer is left.
- [x] Caches and lists have size caps: `RecoveryCopies` forgets a file once its
      5 minutes pass, and `FileWriter` keeps at most one waiting text per file.
- [x] An exception in the output path doesn't stop the output: nothing here runs
      in the output path, and every function returns a result.
- [x] Only what's needed re-renders (control window): no UI.
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not measured; every write
      happens off the output path.

## Decisions I made (for the lead to confirm)

1. The default backup folder is `백업` in the data folder, like the other Korean
   folder names. The spec gives no name.
2. A recovery copy that fails is reported, and the save still goes ahead. Losing
   the operator's edit is worse than missing one copy.
3. The 5-minute limit on recovery copies is kept in memory, so the first save
   after a launch always makes a copy.
4. An `app.json` folder that isn't absolute is ignored and reported, like one
   outside `LLP_USER_DATA`.

## Shared contract change requests

- None.

## Where to look

- `src/main/store/fileWriter.ts`: the waiting and replacing of texts.
- `src/main/store/locations.ts`: the development folder rule.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (6e17be1, restacked as 12c77a9): reviewer (Codex, codex3) Request
  changes: an older save's recovery copy could overwrite a newer save, waiting
  saves grew without a bound, and a junction inside LLP_USER_DATA could let a
  development run write into real data.
- Round 2 (8936836): reviewer (Codex, codex3) Approve, no findings. Lead
  Approve. shell's uiState switches to this store's atomic writer in a
  follow-up. Rebased by the lead onto local `main` without conflicts.

## Team member's reply

Round 1 findings from codex3, answered in round 2:

1.  Fixed (`saver.ts`). `Saver` no longer copies before it queues. It hands the
    whole save, copy and then write, to a `FileWriter` as one job, so the saves
    of a file run one at a time in the order asked for, and a copy that finishes
    late can't let an older text win. `FileWriter` is now generic over the job
    for that reason. `Saver` takes an options object (`copies`,
    `reportCopyProblem`, and an optional `writeText` for tests) and has
    `idle()`. The new test holds the first copy and checks that the writes come
    out as `older`, then `newer`; on the old code, `newer` was written first.
2.  Fixed (`fileWriter.ts`, `autosave.ts`). A waiting write now holds one job
    and one promise. A newer job replaces the job, and every caller gets the
    same promise, so 1,000 edits during a stalled write keep one entry (the test
    checks that the returned promises are one object). `Autosave` starts at most
    one save per key. A save that comes due while the key's save still runs
    waits in a map with one entry per key, and only the newest runs when the
    running one ends. `flush` waits for those too, and `dispose` drops them.
3.  Fixed (`locations.ts`). `confineLocations(locations, developmentFolder)`
    follows junctions and links with `realpath` and refuses any data folder,
    default or set in `app.json`, whose real path leaves the real path of
    `LLP_USER_DATA`. A folder that doesn't exist yet is checked through its
    nearest existing parent, so a new folder below a junction counts. A junction
    whose target is missing is refused, because creating folders through it
    could land outside. Any other error while checking also refuses. It does
    nothing without a development folder. The tests make real junctions between
    two temporary folders: the data folder as a junction, a new folder below a
    junction, a dangling junction, and a link that stays inside, which passes.
    Nothing in this request reads or writes data yet; `loadStore` in `data-8`
    calls `confineLocations` before its first read and refuses the whole store
    when it fails.
4.  Fixed. `copyName` has a NOTE instead of TSDoc, and `controlledWrites` has no
    comment.
