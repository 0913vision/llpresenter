# Review request: data-30

- Team member: data
- Branch: `feat/data/settings-edits`
- Base: `91fea772a188ad44781bc014718a815889d0ec12` (`main`)
- Review range: `91fea77...feat/data/settings-edits`
- Request: M3-D2 part 2 in `.llp/task.md`, plus output-20 and data-29 nits.
- Last commit and final HEAD CI run accompany the review request.

## What changed and why

Settings edits now check the current revision, access, and schema version,
validate the merged document, update memory, and broadcast immediately.
Malformed, stale, unavailable, and read-only edits cannot mutate or save a
document. The normalized `preferences.get` answer and preferences push use this
same state. The main-process settings reader exposes reads and subscriptions for
consumers. Open-service labels and recovery-copy retention read current settings
too.

Each file uses the M2 atomic saver and recovery copies through a 500 ms
debounce. The edit answer waits for that write, while subscribed windows receive
the accepted revision before disk I/O. A failed save returns `write-failed` with
the applied revision and unchanged file; memory remains current and flush
retries the newest failed operation. Closing removes handlers and subscriptions,
finishes accepted writes, and releases timers, including when loading finishes
late.

Unknown fields from the current document survive a whole-file edit even when the
client omits them. The schema-layer helper traverses the pinned Valibot schema
metadata, preserving unknown fields on retained objects while allowing known
optional fields, record keys, array items, and old variant payloads to be
removed. The final merged value is schema-validated again.

Each settings area now catches loading, validation, and serialization exceptions
independently. Its defaults remain available and a `SettingsProblem` identifies
the file while other areas continue loading. Broken files are never overwritten
at startup. If the app's own defaults fail validation, only that area is
unavailable. Newer-version files retain read-only access. Format IDs now live in
the codec table, including `llsettings.stage`.

## Changed files

- `src/shared/schema/preserveUnknown.ts`, `settingsDocuments.ts`, and
  `settingsDocuments.test.ts`: schema-directed retention and coverage across all
  13 settings formats, nested fields, records, reordered identities, variants,
  renamed labels, and prepended Bible recents.
- `src/main/store/settingsStore.ts`, `settingsLoader.ts`,
  `settingsPersistence.ts`, `settingsCodecs.ts`, and `settingsFile.ts`:
  revisioned state, independent loading, debounced saves, recovery, and codec
  metadata.
- `src/main/store/settingsChannels.ts` and `register.ts`: validated IPC,
  broadcasts, canonical preferences, the read-only main-process port, and label
  feed updates.
- `src/main/store/settingsStore.test.ts`, `settingsEdits.test.ts`,
  `settingsLoader.test.ts`, `settingsChannels.test.ts`, and `register.test.ts`:
  behavior, real-disk restart, failed writes, pending I/O supersession, error
  isolation, and disposal coverage.
- `src/shared/schema/bibleTranslation.ts` and `bibleTranslation.test.ts`:
  data-29 nits below.
- `docs/reviews/data-30.md`.

## Checks run

| Check                                        | Result                                          |
| -------------------------------------------- | ----------------------------------------------- |
| `npm run typecheck`                          | Passed                                          |
| Settings/store/IPC and Bible targeted Vitest | Seven files, 135 tests passed                   |
| Final loader/register/settings-file Vitest   | Three files, 42 tests passed                    |
| ESLint on changed TypeScript files           | Passed                                          |
| `npm run format` and `git diff --check`      | Passed                                          |
| Rebase onto latest main                      | Passed without conflicts                        |
| Local full verify                            | Not run, per lead instruction                   |
| GitHub full verification                     | Final HEAD URL and result accompany the request |

No visible windows, dialogs, soak, or memory measurements were started. Disk
tests use temporary folders and invented metadata.

## Decisions and limits

- A burst shares one pending write and its outcome per file; a callback reads
  the latest request when it starts. At most one running and one waiting write
  exist per settings file, bounded by the 13 settings names. A held older write
  cannot later overwrite a newer accepted revision.
- Retained array objects match by declared ID or translation/reference pair.
  Names match reordered named entries, with positional fallback for renames;
  anonymous entries use position. Removed items do not reappear. Newly inserted
  stable identities do not inherit another entry's unknown fields.
- The public IPC shapes do not change. The main-process `DataStore.settings`
  port is `Promise<SettingsReader | null>` with `get`, `preferences`, and
  `subscribe`; writes remain on the validated settings-edit handler.
- The generic metadata traversal remains inside the schema layer. No Valibot
  runtime import is added to the store.

## Data-29 nits carried here

1. Every book now requires at least one chapter. Individual chapters still
   require at least one verse entry. The main Bible loader owns canonical
   chapter counts and trimmed-text validation.
2. Source URLs accept only HTTP and HTTPS. A rejected FTP URL is covered.
3. Keep the existing BCP 47 syntax validator. The optional `Intl` replacement
   rejects supported syntactically valid private-use, extlang, and grandfathered
   examples (`x-private`, `zh-cmn-Hans-CN`, `i-klingon`). Changing that
   acceptance policy needs a separate decision.

## Where to look

`SettingsStore.update` checks refusals before mutation and announces before the
write answer. `SettingsPersistence.writePending` resolves burst callers with the
latest write. `loadSettingsArea` protects each load independently.
`mergeSettingsDocument` applies server-side preservation and final validation.

## Review: lead

Pending.

## Review: reviewer

Pending.

## Team member's reply

Pending review.
