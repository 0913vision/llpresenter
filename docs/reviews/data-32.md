# Review request: data-32

- Team member: data
- Branch: `feat/data/label-rename`
- Base: `3384a750a1d4a8f1ca401f073dee3744e59cea57` (`main`)
- Review range: `3384a75...feat/data/label-rename`
- Request: `.llp/task.md`, "After data-31 (from the lead, 01:25)".
- Final commit and final HEAD CI URL/result accompany the review request.

## What changed and why

The song editor can now rename an app-wide label through the existing checked
`settings.edit` boundary:

```ts
{type: 'labels.rename', name: 'labels', from, to, baseRevision}
```

The reply is the existing `EditResult`, with `id: 'labels'` and the label-list
revision when applied. Both names must be nonblank and different. The main
coordinator checks the current labels revision and access, the source name, a
duplicate destination, and every affected song's access before changing memory.
A read-only affected song refuses the whole operation; it cannot leave an old
label behind in part of the library.

The edit renames the labels entry in place and every exact matching slide label
across the song library. Color, jump key, unrelated labels and slides, song
arrangements, and unknown fields remain intact. Labels and affected songs get
new revisions and change pushes. Song-list display fields do not change, so
label-only updates send document changes without rebuilding the library list
once per affected song. The existing open-service feed follows these changes.

The operation shares the content-edit queue. It drains earlier song autosaves,
then saves `labels.json` first and affected songs in ID order through the M2
saver and recovery copies. A failed write does not stop later files: all new
content stays in memory, and `write-failed` reports the applied labels revision
and unchanged paths in write order. The existing persistence queues retain
failed files for a later flush to retry. The settings write is started
immediately without retrying inside the operation, so the reported unchanged
path is accurate.

Settings-channel shutdown removes handlers immediately and waits for accepted
renames before closing the settings store. Late requests are refused. The new
variant is routed to the cross-file coordinator; direct whole-file settings
updates retain their existing behavior. Malformed renames are rejected and
logged in preload or main before mutation.

## Changed files

- `src/shared/schema/settingsDocuments.ts`: the checked `labels.rename` variant
  and public `LabelRename` type, retaining `settings.update`.
- `src/preload/index.test.ts`: checked rename delivery and rejection before IPC.
- `src/main/store/contentStore.ts`: serialized global rename, preflight,
  revisions, pushes, ordered saves, and partial-failure answers.
- `src/main/store/settingsStore.ts`, `settingsPersistence.ts`: start accepted
  settings writes immediately for cross-file ordering, while later flush keeps
  its retry behavior.
- `src/main/store/settingsChannels.ts` and `register.ts`: route the new edit,
  wait for launch, and finish accepted renames on shutdown.
- `src/main/store/labelRename.test.ts`, `register.test.ts`, and
  `settingsChannels.test.ts`: multi-song rename, unknown-field preservation,
  stale/read-only/duplicate refusals, pending autosave ordering, halfway and
  labels-file failures, retry, actual disk/restart, IPC, and close coverage.
- `src/shared/schema/overlayState.ts`, `liveState.ts`, and
  `overlayState.test.ts`: data-31 nits below.
- `docs/reviews/data-32.md`.

## Checks run

| Check                                                 | Result                                          |
| ----------------------------------------------------- | ----------------------------------------------- |
| `npm run typecheck`                                   | Passed                                          |
| Targeted store, settings, overlay, and preload Vitest | Eight files, 210 tests passed                   |
| Final content-store and rename regression Vitest      | Two files, 43 tests passed                      |
| ESLint on changed TypeScript files                    | Passed                                          |
| `npm run format` and `git diff --check`               | Passed                                          |
| Rebase onto latest main                               | Passed; merged data-31 commits skipped          |
| Local full verify                                     | Not run, per lead instruction                   |
| GitHub full verification                              | Final HEAD URL and result accompany the request |

No visible windows, dialogs, soak, memory measurements, or dependency installs
were started. New test text is invented.

## Decisions and limits

- Match label names exactly, as stored. Renaming keeps the label's position;
  stable IDs are not introduced into the file format.
- Refuse a read-only label list or any read-only song that needs rewriting
  before mutation. Unaffected songs keep their revisions and files.
- Follow D1a partial-failure behavior: retain the complete applied edit in
  memory, save the remaining files, and report unchanged files for retry.
- No service/template rewrite or output command is required: slides belong to
  songs, and existing change feeds rebuild the open service.
- The new code adds no cache or retained file list. Failure queues keep only the
  latest operation per affected file. Rename handlers use one serialized promise
  tail and release all handlers on disposal.

## Data-31 nits carried here

1. `NoticePlayback.targets` requires at least one screen, with a rejected-empty
   test. Active props can still have no targets, covered explicitly.
2. `LiveState.stageMessage` uses `nonBlankText` when present. Empty and
   whitespace text are rejected; null remains the explicit way to clear it. The
   field stays optional for older states and records.

## Where to look

`ContentStore.renameLabelFiles` preflights the cross-file edit and preserves
write order. `SettingsPersistence.savePending` starts writes without immediately
retrying a reported failure. `register.test.ts` exercises the actual IPC and
restart path; `settingsChannels.test.ts` covers shutdown during an accepted
edit.

## Verdicts (recorded by the lead at merge)

- Round 1 (464d9df): reviewer (Claude, trial-97) Approve. Nit for the next data
  branch: `src/main/store/contentStore.ts` `renameLabelFiles` writes the
  affected songs one by one inside the content-edit queue, so renaming a common
  label (후렴) holds every other edit behind the whole set. Measure a rename
  that touches 1,000 songs and record it; if it is long, keep the labels-first
  order but let the song writes go through the existing autosave and persistence
  queues after memory is updated. Lead Approve. Written by the Codex session
  that took over data's work. Rebased by the lead onto local `main` without
  conflicts.

## Team member's reply

Pending review.
