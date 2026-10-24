# Review request: `data-7`

- Team member: `data`
- Branch: `feat/data/file-store`, stacked on `data-4`
  (`refactor/data/live-command-schema`)
- Base commit (`main`): `b9392d0`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/data.md`; M2 in `docs/MILESTONES.md`,
  "Main-process file store"

Changed files outside `src/main/store/`: none. `src/main/store/` is data's.

## What changed and why

The first of three requests for the M2 file store (the lead approved the split).
This one is the write path. The read path, the wiring into the main process, and
shell's `ShowService` channel follow in `data-8`, and the backups in `data-9`.
Nothing calls these modules yet.

| Module              | What it does                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `atomicWrite.ts`    | `writeFileAtomically`: a temporary file in the same folder, flushed with `fsync`, then renamed over the file. Creates a missing folder. Returns a `Result`, never throws.           |
| `fileWriter.ts`     | `FileWriter`: writes to one file run one at a time. While one runs, only the newest text waits, and callers of a replaced text get the newer write's result. `idle()` for quitting. |
| `recoveryCopies.ts` | `RecoveryCopies`: before an overwrite, copies the previous version to `.복구 사본/<kind>/<id>/<time>.json`, at most once per file every 5 minutes, and keeps 환경설정's count.      |
| `autosave.ts`       | `Autosave`: saves once the changes to a file stop for 0.5 seconds. `flush()` saves what waits and waits for running saves. `dispose()` clears every timer.                          |
| `locations.ts`      | `resolveLocations` and `readLocationFields`: the data folders from `app.json`, and the location fields of a broken `app.json`.                                                      |
| `saver.ts`          | `Saver`: keeps a recovery copy, then writes through `FileWriter`.                                                                                                                   |

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

`npm run verify` on the commit before this document, on `main` b9392d0 with
`data-6` and `data-4` below it: every step passed. The one skipped test belongs
to another member's suite. Coverage of `src/main/store/`: 98.7% of lines, 91.8%
of branches.

| Command or test                    | Result                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| `npm run typecheck`                | Passed                                                                |
| `npm test`                         | Passed: 97 files, 955 tests and 1 skipped (33 in the store)           |
| `npm run format:check`             | Passed                                                                |
| `npm run build`                    | Passed                                                                |
| `npm run verify` (from phase 1 on) | Passed: typecheck, lint, format:check, test:coverage, build (218.4 s) |

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
