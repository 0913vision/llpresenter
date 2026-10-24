# Review request: `data-9`

Review range: `db4b2e6...feat/data/backups`

- Team member: `data`
- Branch: `feat/data/backups`
- Base commit (`main`): `db4b2e6`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/data.md`; M2 in `docs/MILESTONES.md`,
  "Main-process file store"; `docs/spec/02-data.md`, "Automatic backup";
  `docs/spec/10-shortcuts-and-settings.md`, the 백업 rows of 라이브러리;
  `docs/spec/08-problems.md` (no automatic backup during a service)

What to check:

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

| Module         | What it does                                                                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backup.ts`    | `runBackup`: copies 곡, 예배, 틀, and 설정 into `<backup location>\<YYYY-MM-DD HH-mm-ss>.partial`, renames it without the suffix, then deletes the oldest backups past 보관 and any leftover `.partial`. Returns a `Result`, never throws. |
|                | `lastBackupTime`: the time of the newest complete backup, read from its folder name.                                                                                                                                                       |
|                | `Backups`: `atLaunch()` (자동 백업 on, not yet today) and `backUpNow()` (지금 백업). Both refuse while an output is on, and a second request while one runs is skipped.                                                                    |
| `register.ts`  | After the data is read, runs `Backups.atLaunch()` once and logs the outcome: done, skipped with the reason, or failed. Old backups it can't delete are warnings.                                                                           |
| `fileStore.ts` | `LoadedStore.preferences`: 환경설정 with the default for every field the file leaves out, read like `labels.json`, recovery copies included. The backup reads 자동 백업 and 보관 from it.                                                  |
| `locations.ts` | The default backup folder is `LoveLight 백업` next to the data folder: `Documents\LoveLight 백업`, or `<LLP_USER_DATA>\LoveLight 백업` in development. It was `<data folder>\백업`.                                                        |
| `fsErrors.ts`  | `isMissingFile(error)`. Three store modules had their own copy; they share this one now.                                                                                                                                                   |

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

- A backup folder name is the local time, `2026-10-25 07-58-00`, so the operator
  can read it in Explorer and the names sort in time order. Two backups in the
  same second fail the second one, which the tests show leaves the first
  untouched.
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

`npm run verify` on the commit before this document (4866376), on `main`
db4b2e6: every step passed. The one skipped test belongs to another member's
suite. Coverage: `src/main/store/` 96.1% of lines and 91.3% of branches;
`backup.ts` 90.8% of lines and 81.8% of branches, where the uncovered lines are
the cleanup failures (a `.partial` or an old backup that can't be deleted).

| Command or test                    | Result                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| `npm run typecheck`                | Passed                                                                |
| `npm test`                         | Passed: 147 files, 1571 tests and 1 skipped                           |
| `npm run format:check`             | Passed                                                                |
| `npm run build`                    | Passed                                                                |
| `npm run verify` (from phase 1 on) | Passed: typecheck, lint, format:check, test:coverage, build (346.0 s) |

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

1.
