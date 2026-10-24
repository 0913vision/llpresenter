# Review request: `data-12`

Review range: `e0716e6...fix/data/stale-temp-files`

- Team member: `data`
- Branch: `fix/data/stale-temp-files`, stacked on `data-13`
  (`feat/data/media-library`, e0716e6, in review)
- Base commit (`main`): `94780dc`
- Last commit: see the commit that adds this file
- Related brief: qa's F6 precheck of `writeFileAtomically` (through the lead):
  45 kills at real write stages never broke a file, but left 29 hidden
  `.song.llsong.<uuid>.tmp` files that nothing removed.

What to check:

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

`npm run verify` on the commit before this document (1d7bb96), on `main` 94780dc
with `data-9` and `data-13` below it: every step passed (93.9 s, steps at once).
Coverage: `src/main/store/` 96.4% of lines and 91.7% of branches;
`staleTempFiles.ts` 91.3% of lines and 76.9% of branches, where the uncovered
branches are a file that vanishes between the listing and the removal, and a
removal that fails.

| Command or test                    | Result                      |
| ---------------------------------- | --------------------------- |
| `npm run typecheck`                | Passed (6.9 s)              |
| `npm run lint`                     | Passed (61.0 s)             |
| `npm run format:check`             | Passed (25.6 s)             |
| `npm test`                         | Passed as `test:coverage`   |
| `npm run build`                    | Passed (3.2 s)              |
| `npm run verify` (from phase 1 on) | Passed: every step (93.9 s) |

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
