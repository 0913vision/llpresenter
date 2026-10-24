# Review request: `data-12`

Review range: `4f15ed0...fix/data/stale-temp-files`

Round 2 changes only: `a87e605...fix/data/stale-temp-files`

- Team member: `data`
- Branch: `fix/data/stale-temp-files`, on `main` (data-9 and data-13 have
  merged)
- Base commit (`main`): `4f15ed0` (round 1: `94780dc` with data-9 and data-13
  below)
- Last commit: see the newest commit that changes this file
- Related brief: qa's F6 precheck of `writeFileAtomically` (through the lead):
  45 kills at real write stages never broke a file, but left 29 hidden
  `.song.llsong.<uuid>.tmp` files that nothing removed.

What to check in round 2:

1.  Finding 1: `TEMPORARY_NAME` in `src/main/store/atomicWrite.ts` requires the
    version 4 nibble and the RFC 4122 variant bits that `randomUUID()` writes.
    Tests: `staleTempFiles.test.ts`, the nil, version 1, and other-variant names
    are neither recognized nor removed.
2.  Finding 2: the backup's copy filter (`copyFilter` in `backup.ts`) skips
    every recognized temporary file, whatever its age, apart from what the
    cleanup may delete. Test: `backup.test.ts`, "leaves the temporary files of
    writes out of the backup": a fresh leftover stays in 곡 but isn't in the
    backup.

What to check in round 1:

1.  `src/main/store/staleTempFiles.ts`: only plain files whose names match the
    store's own temporary names, untouched for a minute, are removed. A write
    that runs now, any other file, a folder, and a link are left alone, even
    when their names look like a temporary file.
2.  `isTemporaryFileName` in `src/main/store/atomicWrite.ts` matches exactly the
    names `writeFileAtomically` writes (a test captures a real one).
3.  `src/main/store/register.ts`: the cleanup runs once at launch, after the
    data is read and before the backup, so a backup never copies a leftover. A
    file that can't be removed is a warning in the log.

## Shared changes

None.

## What changed and why

`writeFileAtomically` writes to `.<file name>.<random UUID>.tmp` and renames it
over the file. When the app is killed between the two, the temporary file stays.
The file itself is never harmed, which qa confirmed, but leftovers pile up in
the data folders and would be copied into every backup.

| Module              | What changed                                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `atomicWrite.ts`    | `isTemporaryFileName`: the pattern of the temporary names, kept next to the code that makes them.                                                                    |
| `staleTempFiles.ts` | `removeStaleTempFiles(folder)`: removes the folder's own leftovers older than a minute and returns what it couldn't remove. A missing folder has none. Never throws. |
| `register.ts`       | After the launch read: removes leftovers in 곡, 예배, 틀, and 설정, then runs the launch backup.                                                                     |
| `locations.ts`      | `dataFileFolders`: the four folders of data files, which the backup and the cleanup share.                                                                           |

Why a minute: a write takes milliseconds, so a temporary file a minute old
belongs to no running write. The cleanup runs at launch, before anything saves,
so the margin is wide; the age check keeps it safe if it ever runs later.

## Changed files

- `src/main/store/`: `staleTempFiles.ts` and its test (new), `atomicWrite.ts`
  with `atomicWriteRetry.test.ts`, `register.ts` and its test, `locations.ts`,
  and `backup.ts`.
- `docs/reviews/data-12.md` (new).

## Checks run

Round 2: `npm run verify` on the commit before this document's round 2 change
(d0b1463), on `main` 4f15ed0: every step passed (195.9 s, steps at once).

| Command or test                    | Result                       |
| ---------------------------------- | ---------------------------- |
| `npm run typecheck`                | Passed (48.0 s)              |
| `npm run lint`                     | Passed (87.3 s)              |
| `npm run format:check`             | Passed (100.2 s)             |
| `npm test`                         | Passed as `test:coverage`    |
| `npm run build`                    | Passed (6.0 s)               |
| `npm run verify` (from phase 1 on) | Passed: every step (195.9 s) |

Round 1 passed on `main` 94780dc with `data-9` and `data-13` below it (93.9 s).

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema: file names
      are matched against the exact temporary name pattern before anything is
      removed.
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: nothing new is registered.
- [x] Caches and lists have size caps: this request removes files that grew
      without a cap.
- [x] An exception in the output path doesn't stop the output: nothing here runs
      in the output path, and the cleanup never throws.
- [x] Only what's needed re-renders (control window): no UI.
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not measured. One folder
      listing per data folder at launch.

## Decisions I made (for the lead to confirm)

1.  The cleanup covers the four folders the store writes data files in. Shell's
    UI state writes `app.json` with its own atomic writer for now; once it
    switches to this one (data-7's plan), the app data folder can join the list.
2.  The review number `data-12` was free; the lead may renumber it.

## Where to look

- `src/main/store/staleTempFiles.ts`.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (a87e605, codex3): Request changes with two findings: the name matcher
  accepted every UUID shape, and backups copied the temporary files that cleanup
  left behind.
- Round 2 (686576e): reviewer (Codex, codex2) Approve with no findings. Lead
  Approve; only version 4 UUID names that atomic writes make are removed, and no
  backup copies a temporary file. Rebased by the lead onto local `main` without
  conflicts.

## Team member's reply

Round 1 findings from codex3, answered in round 2:

1.  Fixed. The pattern now reads
    `[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}`, the
    shape `randomUUID()` always makes (version 4, RFC variant). A file named
    with the nil UUID, a version 1 UUID, or another variant is neither
    recognized nor removed, even when it is old.
2.  Fixed. The backup no longer relies on the cleanup: its `cp` filter skips
    every file whose name `isTemporaryFileName` recognizes, so a fresh leftover
    after a quick restart, or one the cleanup couldn't remove, stays where it is
    and never reaches a backup. The filter keeps the development check of data-9
    round 3 for everything else.
