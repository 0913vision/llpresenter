# Review request: `data-9`

Review range: `94780dc...feat/data/backups`

Round 3 changes only: `283b7e5...feat/data/backups`

Changed outside data's paths, with output's permission: `src/main/index.ts` (the
`registerStore` call takes `{log, isAnyOutputOn}` and moves below the
`LiveStore` it reads) and `src/main/index.wiring.test.ts` (its mock records the
options, and a test checks them).

- Team member: `data`
- Branch: `feat/data/backups`
- Base commit (`main`): `94780dc` (round 2: `02bb9c0`, round 1: `db4b2e6`)
- Last commit: see the newest commit that changes this file
- Related brief: `docs/briefs/data.md`; M2 in `docs/MILESTONES.md`,
  "Main-process file store"; `docs/spec/02-data.md`, "Automatic backup";
  `docs/spec/10-shortcuts-and-settings.md`, the 백업 rows of 라이브러리;
  `docs/spec/08-problems.md` (no automatic backup during a service)

What to check in round 3:

1.  Round 2 finding 1: in development, `copyFolder` passes `cp` a filter that
    checks the real path of every file and folder against the real path of
    `LLP_USER_DATA` before it is copied, and throws for one outside, which fails
    the backup. `LoadedStore.developmentFolder` carries the folder to the
    backup. Tests: "fails in development when a link under 곡 leads outside
    LLP_USER_DATA" (two temporary folders) and "follows the same link outside
    the development setup".
2.  Round 2 finding 2: `createStaging` creates `<time>.partial` with a plain
    `mkdir`, so anything already at that name fails the backup and stays as it
    is; nothing is removed first. Only a staging folder this run created is
    removed after a failure. Tests: "refuses a file at the staging name and
    leaves it as it is" and "refuses a link at the staging name and leaves it
    and its target".
3.  Round 2 finding 3: the `BackupFolders` fields have no TSDoc.
4.  The `registerStore` call in `src/main/index.ts`, now that output-9 has
    merged.

What to check in round 2 (done):

1.  Finding 1: `copyFolder` in `src/main/store/backup.ts` copies with
    `dereference`, so a linked data folder is copied as its contents. Test:
    `backup.test.ts`, "copies what a linked data folder holds, so the backup
    stands alone".
2.  Finding 2: only a source folder that doesn't exist is skipped, checked
    before the copy; any error during a copy fails the backup before the rename
    and the pruning. A file where a data folder should be fails it too. Tests:
    `backupCopyFailure.test.ts` (a copy that fails with `ENOENT` halfway) and
    "fails when a file stands where a data folder should be".
3.  Finding 3: `backupFolders` lists only real folders, and a name counts only
    when it parses to a time that writes back to the same name. Tests: "leaves
    files, links, and other names alone when it deletes old backups" and "counts
    only folders with a valid time as backups".
4.  Finding 4: names follow spec 02, `YYYY-MM-DD HHmmss`.

What to check in round 1:

1.  `src/main/store/backup.ts` against spec 02, "Automatic backup", and the
    lead's rules:
    - Once a day at launch, only when 자동 백업 is on.
    - Never started while an output is on.
    - A failure is reported once and isn't retried in a loop.
    - The 보관 count is kept, clamped to 1 to 365.
    - Media files are left out.
2.  The copy goes into `<time>.partial` and is renamed when complete, so a cut
    off backup never counts. Old backups and leftover `.partial` folders are
    deleted, but nothing else in the backup location.
3.  `src/main/store/register.ts`: the launch backup runs once, after the data is
    read, and the dispose function waits for it.
4.  `src/main/store/locations.ts`: the default backup folder follows spec 10,
    and stays inside `LLP_USER_DATA` in development (`confineLocations` checks
    it like every other folder).
5.  Nothing writes `app.json`.

## Shared changes

1.  `src/shared/live.ts`: `isAnyOutputOn(state)`, true while any screen's output
    is on. Output's wiring passes it to `registerStore`, and later parts that
    must pause during a service can use it too.

`registerStore` changes from `registerStore(log, context?)` to
`registerStore({log, isAnyOutputOn, context?})`, and its dispose function now
returns a promise. Nothing calls it yet; output wires it once after this merges
(below).

## What changed and why

| Module         | What it does                                                                                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backup.ts`    | `runBackup`: copies 곡, 예배, 틀, and 설정 into `<backup location>\<YYYY-MM-DD HHmmss>.partial`, renames it without the suffix, then deletes the oldest backups past 보관 and any leftover `.partial`. Returns a `Result`, never throws. |
|                | `lastBackupTime`: the time of the newest complete backup, read from its folder name.                                                                                                                                                     |
|                | `Backups`: `atLaunch()` (자동 백업 on, not yet today) and `backUpNow()` (지금 백업). Both refuse while an output is on, and a second request while one runs is skipped.                                                                  |
| `register.ts`  | After the data is read, runs `Backups.atLaunch()` once and logs the outcome: done, skipped with the reason, or failed. Old backups it can't delete are warnings.                                                                         |
| `fileStore.ts` | `LoadedStore.preferences`: 환경설정 with the default for every field the file leaves out, read like `labels.json`, recovery copies included. The backup reads 자동 백업 and 보관 from it.                                                |
| `locations.ts` | The default backup folder is `LoveLight 백업` next to the data folder: `Documents\LoveLight 백업`, or `<LLP_USER_DATA>\LoveLight 백업` in development. It was `<data folder>\백업`.                                                      |
| `fsErrors.ts`  | `isMissingFile(error)`. Three store modules had their own copy; they share this one now.                                                                                                                                                 |

The lead's decisions for this request:

1.  **The last backup time comes from the newest complete backup folder name.**
    Spec 10 lists `app.json` `lastBackupAt`, but shell's UI state store owns the
    writes to `app.json`, and one writer per file is the rule. Nothing here
    writes `app.json`. When the backup location changes, the first launch after
    it backs up again, which is harmless. The lead has the spec member change
    spec 10's storage field to match.
2.  **The default backup folder is outside the data folder**, as spec 10
    proposes, so a backup survives when the data folder is lost or damaged.

Other details:

- A backup folder name is the local time, `2026-10-25 075800`, as spec 02 writes
  it, so the operator can read it in Explorer and the names sort in time order.
  Two backups in the same second fail the second one, which the tests show
  leaves the first untouched.
- "Once a day" means the newest backup's local date isn't today.
- A backup location that can't be read or written makes the backup fail with the
  reason. It doesn't retry; the next launch or 지금 백업 tries again. The
  warning notification of spec 02 needs a notification channel, which doesn't
  exist yet, so the failure goes to the log for now.
- The launch backup checks 자동 백업 before it reads the backup location, so a
  missing backup drive isn't reported while backups are off.
- Copies use the asynchronous `fs.cp`, so a backup never blocks the main process
  or stalls the output (spec 08). An output turned on during a running backup
  doesn't stop it; only starting is refused.
- Quitting waits for a running launch backup inside output's shutdown deadline.
  A backup cut off anyway leaves a `.partial` folder, which the next backup
  deletes.

### Wiring (output)

Output wires the store once, after this merges, as a step of output-9's shutdown
coordinator:

```ts
const disposeStore = registerStore({
  log,
  isAnyOutputOn: () => isAnyOutputOn(store.state),
});
shutdown.add({name: 'close the data store', run: disposeStore});
```

## Changed files

- `src/shared/live.ts` and its new test.
- `src/main/store/`: `backup.ts` and its test (new), `fsErrors.ts` (new),
  `register.ts`, `fileStore.ts`, and `locations.ts` with their tests,
  `readFiles.ts`, and `recoveryCopies.ts`.
- `docs/reviews/data-9.md` (new).

## Checks run

Round 3: `npm run verify` on the commit before this document's round 3 change
(3453bd3), on `main` 94780dc: every step passed (149.5 s, steps at once).
Coverage: `src/main/store/` 96.5% of lines and 91.9% of branches; `backup.ts`
94.3% of lines and 88.2% of branches, where the uncovered lines are the cleanup
failures (a `.partial` or an old backup that can't be deleted).

| Command or test                    | Result                       |
| ---------------------------------- | ---------------------------- |
| `npm run typecheck`                | Passed (38.0 s)              |
| `npm run lint`                     | Passed (89.7 s)              |
| `npm run format:check`             | Passed (68.6 s)              |
| `npm test`                         | Passed as `test:coverage`    |
| `npm run build`                    | Passed (9.1 s)               |
| `npm run verify` (from phase 1 on) | Passed: every step (149.5 s) |

Round 2 passed on `main` 02bb9c0 (167.8 s), and round 1 on `main` db4b2e6 (1571
tests, 346.0 s).

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema:
      `preferences.json` goes through `parsePreferences`. Backup folder names
      are matched with a pattern before they are read or deleted.
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: the dispose function removes the
      handler. No timers.
- [x] Caches and lists have size caps: the backups are capped at 보관, at
      most 365.
- [x] An exception in the output path doesn't stop the output: nothing here runs
      in the output path, every function returns a result, and the launch backup
      catches and logs anything else.
- [x] Only what's needed re-renders (control window): no UI.
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not measured. A backup copies
      text files once a day, off the output path.

## Decisions I made (for the lead to confirm)

1.  `backUpNow()` exists for 지금 백업, but no channel calls it yet; the
    환경설정 window adds the channel when it is built.
2.  Old backups that can't be deleted are logged, and the new backup still
    counts.
3.  보관 values outside 1 to 365 are clamped when the backup runs, so a bad
    `preferences.json` can't delete every backup or keep them without limit.

## Where to look

- `src/main/store/backup.ts`: `runBackup` and `deleteOldBackups`.
- `src/main/store/register.ts`: `backUpAtLaunch` and the dispose function.

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

Round 2 findings from codex3, answered in round 3:

1.  Fixed. With `dereference`, a link deep inside a data folder could lead out
    of `LLP_USER_DATA`, since `confineLocations` checks only the configured
    folders. In development, `cp` now gets a filter that resolves the real path
    of every source entry and fails the backup when it lies outside the real
    path of `LLP_USER_DATA`. The test puts a junction under 곡 that leads to a
    second temporary folder: the backup fails, no backup or `.partial` folder is
    left, and the outside folder is untouched. Without a development folder,
    links are followed as before, which another test shows.
2.  Fixed. The staging folder is created, not taken over: the backup location is
    created with `recursive`, then `<time>.partial` with a plain `mkdir`, which
    fails when anything is already there. That failure returns at once, so the
    cleanup never runs; the cleanup only removes a staging folder this run
    created. The tests put a file, then a junction, at the staging name and
    check that each stays, and that the junction's target keeps its file.
3.  Fixed. The fields lost their TSDoc; the NOTE on `backupFolders` explains
    both lists.

Also in round 3: output-9 merged with `registerStore(log)` in
`src/main/index.ts`. With output's permission, the call now passes
`{log, isAnyOutputOn: () => isAnyOutputOn(store.state)}` and sits below the
`LiveStore`, so main keeps type-checking when this merges. The shutdown step is
unchanged and awaits the dispose promise. The wiring test checks the options.

Round 1 findings from codex3, answered in round 2:

1.  Fixed. `cp` runs with `dereference: true`, so a link inside a data folder,
    or a data folder that is itself a junction, is copied as what it points to.
    The test backs up a 곡 location that is a junction, deletes the original
    folder, and reads the song from the backup.
2.  Fixed. `copyFolder` no longer catches `ENOENT`. It checks first whether the
    source folder exists: a missing one is skipped (such as 틀 before the first
    틀), anything that isn't a folder fails the backup, and every error from the
    copy itself fails it. A failed backup is never renamed, and the pruning
    doesn't run, so it can't push good backups out. The new test mocks `cp` to
    fail with `ENOENT` and checks that the older backup stays and no new or
    `.partial` folder is left.
3.  Fixed. Discovery and cleanup share `backupFolders`, which reads the folder
    with file types and keeps only real folders, so a file or a link named like
    a backup is neither counted nor deleted. A name counts only when it parses
    to a valid local time that writes back to the same name, so
    `2026-13-40 250000` or `2026-02-30 060000` never count. The tests put a
    file, a junction (whose target must survive), an invalid time, and a file
    named like a `.partial` in the backup location, and check that all of them
    stay.
4.  Switched to spec 02's `YYYY-MM-DD HHmmss`, so there is one format and no
    spec change.
