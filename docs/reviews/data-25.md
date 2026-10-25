# Review request: data-25

Shared changes: revisioned settings-file reads, updates, and subscriptions;
media-list edits, import jobs, and progress; normalized preference pushes.
`preferences.get()` from data-24 remains unchanged. This request provides
contracts and preload boundaries; D2 and P6 implement the settings/media work.

- Team member: data
- Branch: `feat/data/settings-media-contracts`
- Main base: `230427f5ad3048690c1345a6beb3b339f676ef56`
- Lower stack replayed onto that main: data-23 and data-24, unchanged by
  `git range-diff`; their published branch heads remain `84150ce` and `7366e97`
- Incremental base: `46f7a378a143eaf453bc44274d7b33cf9e6dee49`, the replayed
  data-24 head
- Review range: `46f7a37...feat/data/settings-media-contracts`
- Last code commit: `0c18d5c`
- Code commits: `57b099a` settings, `2e9f335` media, `0c18d5c` preload
- Task: M3-D1a-3, after the inserted spec-18 prerequisite
- Behavior: spec 02 app-wide files/save rules, spec 05 media view, spec 08
  relinking; `docs/plans/m3-breakdown.md` D1a/D2/P6

## Settings contracts

`settings.get({name})` reads `{name, value, revision, access}`. The closed names
are screens, looks, stage-layouts, macros, quick, messages, notices, props,
timers, labels, bible, preferences, and shortcuts. The value must pass that
file's existing schema; a correct document for another requested name is also
rejected. No arbitrary settings path or `app.json` writer is exposed.

`settings.edit({type: 'settings.update', name, value, baseRevision})` updates a
whole settings file. The reply reuses `EditResult`, including stale/read-only
refusals and applied write failures with their revision and unchanged files. The
main settings store will enforce the revision/access and preserve current
unknown fields when applying an edit. Invalid preference ranges and shortcut
bindings are rejected at this boundary rather than pruned as on a file read.

`settings.subscribe` follows whole changed documents, with their new revision.
`preferences.subscribe` follows normalized preferences alongside the existing
normalized `preferences.get()`. This grows the data-24 namespace without
replacing its read. Stored file formats, defaults, and migration behavior do not
change; existing schemas are exported for reuse instead of copied.

## Media contracts

`media.get()` and `media.subscribe` use a media document with the same
revision/access metadata and the complete `llmedia` value. Media stays outside
generic settings updates, so importing, relinking, and deleting go through its
dedicated commands.

| Command                   | Payload                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `media.playlist.create`   | `kind: 'media'` or `'audio'`; main chooses the default name/id                           |
| `media.playlist.update`   | `playlist: {kind, value}`, `baseRevision`; supports rename, membership/order, audio loop |
| `media.playlist.delete`   | `playlist: {kind, id}`                                                                   |
| `media.properties.update` | `mediaId`, `changes: {name?, props?}`, `baseRevision`; at least one change               |
| `media.relink`            | `mediaId`; main opens the replacement-file picker                                        |
| `media.delete`            | `mediaId`; deletes from the list, not the underlying file                                |
| `media.import.cancel`     | The reserved `mediaId` of the copy job                                                   |

`media.edit` returns a nullable success or an edit failure. A success id names
the affected entity; its revision belongs to the whole media list. Null
acknowledges a relink-dialog or copy cancellation. Write failures retain their
applied result, as in content edits.

`media.import({source, playlist})` accepts a picker source or explicit paths
from a file drop, and a media/audio playlist reference or null for the library.
It returns reserved copy jobs; an empty success cancels the picker. Each job has
a reserved media id, display filename, phase, and percent. The phases are queued
(0), copying, analysing, complete (100), failed (requires a message), and
cancelled. Percent is bounded to 0 through 100 and duplicate job ids are
rejected. `media.subscribeImports` follows individual job updates.

P6 still owns file selection/copying, absolute-path and file-type checks,
metadata analysis, job lifetime, audio-only playlist membership, referenced
media checks, and range validation against the loaded item's duration. The
complete media-document schema already validates duration-relative trim values.
No media bytes, renderer, file operation, or live command is added here.

## Boundary behavior and changed files

All new requests and replies are checked. A bad outgoing request is logged and
rejected before IPC; a bad reply is logged and rejected without inventing data.
Malformed pushes are logged and dropped; every subscription returns its remover.
File-shaped values retain unknown fields with `checkPart` key handling.

- New `settingsDocuments.ts`, `mediaEdit.ts`, and their tests.
- Existing settings/media schemas: exports only, no stored-format changes.
- Common document access/edit-result schemas: exports for reuse.
- `ids.ts` and its tests: public media/playlist UUID factories, keeping brands
  in the schema layer.
- `ipc.ts`, preload, and fake/tests: typed methods, checked messages, and
  listener cleanup. Fake settings reads reject unavailable data; fake media
  reads are an empty valid document and imports cancel.
- This review document. Only data-owned paths change.

## Checks

| Check                                                       | Result                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| Typecheck                                                   | Passed before and after rebase                             |
| Focused schema, id, content, media, preload, and fake tests | Passed: 8 files, 229 tests                                 |
| Changed-file ESLint                                         | Passed after correcting one array-type spelling            |
| Format                                                      | Passed before source commits                               |
| Rebase                                                      | No conflicts; latest main includes devops-19 and output-19 |
| Local full verify                                           | Not run, per the CI rule                                   |
| GitHub CI, source head `0c18d5c`                            | Passed: fully green                                        |

Source run:
[GitHub CI](https://github.com/0913vision/llpresenter/actions/runs/40192773049).
The final review-head CI URL/result is included in the request report.
Fast-check and CI logs use `.llp/data25-*.log`.

## Quality checklist

- [x] Source CI is fully green; final review-head result is in the report.
- [x] Every settings name and media command has valid/invalid schema tests.
- [x] Wrong read-file identity and invalid revisions/access are rejected.
- [x] Unknown stored fields, applied write failures, cancellations, and bad
      pushes have regression tests.
- [x] Subscription removers are tested; no new runtime cache or timer.
- [x] No unchecked assertions, non-null assertions, or `any`.
- [x] No main handler, renderer, output-state, or settings-writer changes.

## Decisions for the lead

1. Generic whole-file settings updates exclude media, whose dedicated commands
   preserve its copy/relink/delete workflow. They also exclude computer-local
   `app.json`, which keeps its existing single writer.
2. All app-wide non-media files, including preferences and shortcuts, share
   document metadata and revision checks. The normalized preference API remains
   available alongside editable file documents.
3. Copy jobs reserve a media id before joining the library, so progress and
   cancellation need no separate id brand. Main supplies playlist names and ids,
   and relink file paths never come from renderer commands.

---

## Verdicts (recorded by the lead at merge)

- Round 1 (97fb607): reviewer (Codex, codex3) Approve with no findings. Lead
  Approve, including the three decisions: whole-file settings updates exclude
  the media list (its own commands) and `app.json` (its single writer); every
  other app-wide file shares document metadata and revision checks, with
  `preferences.get()` kept beside them; copy jobs reserve a media id, and relink
  paths never come from renderer commands. Written by the Codex session that
  took over data's work. Rebased by the lead onto local `main` after data-24
  without conflicts. D1a is complete.
