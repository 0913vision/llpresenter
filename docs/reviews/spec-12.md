# Review request: `spec-12`

- Review range: `6559a9b...docs/spec/backup-time`
- Team member: `spec`
- Branch: `docs/spec/backup-time`, from `main` (not stacked)
- Base commit (`main`): `6559a9b`
- Shared files changed: none
- Last commit: see the commit that adds this file
- Related request: the lead's decision for data-9 (October 25); reviewed by the
  lead, no Codex round

## What changed and why

### Round 1

The lead decided that the last backup time comes from the newest complete backup
folder's name instead of `app.json` `lastBackupAt`, so `app.json` keeps a single
writer.

- `02-data.md`: the `lastBackupAt` row is gone from the `app.json` table.
  "Automatic backup" now names each backup folder after its start time
  (`YYYY-MM-DD HHmmss`), copies into a `.partial` folder that is renamed only
  when every file is copied, and reads 마지막 백업 from the newest folder
  without `.partial` (없음 when there is none). The old `<date time>\`
  placeholder, which Markdown would render as a tag, is gone too.
- `10-shortcuts-and-settings.md`: the 마지막 백업 row's storage is "Not stored:
  the newest complete backup folder's name (02)".

## Changed files

- `docs/spec/02-data.md`, `docs/spec/10-shortcuts-and-settings.md`
- `docs/reviews/spec-12.md` (new)

## Checks run

| Command or test           | Result                                             |
| ------------------------- | -------------------------------------------------- |
| `npm run format:check`    | Pass on base `6559a9b`                             |
| Middle dots and em dashes | None in the changed files (checked with `grep -c`) |

## Decisions I made (for the lead to confirm)

1. The folder name format `YYYY-MM-DD HHmmss` and the `.partial` suffix are
   proposals that data-9 can change; the rule only needs a sortable time in the
   name and a way to tell an unfinished backup apart.

## Where to look

- 02 "Automatic backup".
