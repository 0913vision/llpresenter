# Review request: data-34

- Team member: data
- Branch: `feat/data/media-store`
- Base: `867330a998a77e2237cbc26fb90c64a5b45a341d` (`main`)
- Review range: `867330a...feat/data/media-store`
- Request: M3-D2 part 3, the media list, with the lead-approved P6a boundary.
- Final commit and final HEAD CI URL/result accompany the review request.

## What changed and why

The media list now has a revisioned main-process store behind the existing
`media.get`, `media.edit`, and `media.import` contracts. It creates a missing
`media.json`, loads and validates existing data, preserves unknown fields, and
saves accepted changes through the existing atomic writer and recovery copies. A
broken file remains untouched; defaults and a bounded settings-problem event let
the other areas continue loading. Refused media paths are also reported. A newer
original remains read-only even when an older recovery copy can be loaded. The
same fallback-access bug is fixed in the settings loader.

Playlist creation, update, and deletion work for both media and audio lists.
Property changes validate the resulting metadata, including trim bounds.
Deleting an item removes its playlist references and file lookup while keeping
the original bytes. Audio playlists reject non-audio members. Stable IDs retain
unknown item, property, and playlist fields across edits. Optional known fields
can still be removed.

Accepted edits update the current lookup and push the new document immediately;
the reply waits for the 500 ms debounced save. Revision checks reject stale
edits. A write failure reports the applied revision and unchanged file, retains
the in-memory edit, and leaves it eligible for retry. Shutdown flushes accepted
changes and removes handlers, listeners, and timers. Media changes also refresh
background choices in the open service without a restart.

### Boundary for prep's P6a

Copying, analysis, file dialogs, and relinking remain P6a's responsibility. This
request provides only these main-side ports, accessible on `DataStore`:

- `media: Promise<MediaStore | null>` exposes the current catalog and
  `add({items, baseRevision}, playlist)` / `replace({items, baseRevision})` for
  completed imports and relinks. The store checks revision, metadata, paths,
  stable IDs, audio membership, and batch limits before committing.
- `mediaBackend.connect(backend)` attaches one implementation of
  `import(request, signal)`, `relink(mediaId, signal)`, and
  `cancel(mediaId, signal)`. Its connection supplies `report(unknown)` and
  `disconnect()`. Replies and progress are schema-checked; disconnect and
  shutdown abort the signal and discard late replies/progress.

Until connected, import, relink, and cancellation requests return an explicit
unavailable error. They cannot report success without an implementation. The
connection permits at most 16 in-flight backend requests. The shared schema caps
the list at 10,000 media items, 1,000 playlists of each kind, 10,000 members per
playlist, and 200 import paths or returned jobs per batch.

## Changed files

- `src/shared/schema/mediaList.ts`: named list and import limits.
- `src/shared/schema/mediaEdit.ts`: bounded import batches and a schema-layer
  merge helper that preserves current unknown fields.
- `src/shared/schema/mediaLimits.test.ts`: exact-cap and over-cap cases.
- `src/main/store/mediaEdits.ts`: playlist, property, and list deletion edits.
- `src/main/store/mediaStore.ts` and `mediaStore.test.ts`: revisioned catalog,
  persistence, notifications, P6a commits, and refusal/failure tests.
- `src/main/store/mediaLoader.ts` and `mediaLoader.test.ts`: independent
  loading, defaults, startup problems, recovery, and read-only tests.
- `src/main/store/mediaChannels.ts` and `mediaChannels.test.ts`: validated IPC,
  the explicit unavailable answer, backend connection and lifetime tests.
- `src/main/store/register.ts` and `register.test.ts`: store wiring, current
  file lookup, service background refresh, IPC/restart and real-file tests.
- `src/main/store/settingsStore.ts`: bounded, deduplicated startup-problem feed
  that also accepts the independently loaded media problem.
- `src/main/store/settingsLoader.ts` and `settingsLoader.test.ts`: preserve
  read-only access when a newer original falls back to an editable copy.
- `docs/reviews/data-34.md`.

## Checks run

| Check                                                                                                     | Result                                          |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `npm run typecheck`                                                                                       | Passed after rebase                             |
| Focused Vitest for media store/loader/channels, register, settings store/loader, media schemas and limits | Nine files, 123 tests passed                    |
| ESLint on changed TypeScript files                                                                        | Passed after rebase                             |
| `npm run format` and `git diff --check`                                                                   | Passed                                          |
| Rebase onto latest main                                                                                   | Completed without conflicts                     |
| Local full verify                                                                                         | Not run, per lead instruction                   |
| GitHub full verification                                                                                  | Final HEAD URL and result accompany the request |

Tests cover immediate pushes and debounce, restart, unknown-field retention,
stale and read-only refusals, partial write outcomes and retry, close while
loading, backend disconnect and malformed replies, the in-flight cap, missing
and broken files, rejected paths, and list limits. The register integration uses
invented files to check that property changes and deletion refresh the open
service and that deleting a list item keeps its file bytes.

No visible windows, dialogs, dependency installs, soak, or memory measurements
were started. Electron is mocked in these local tests.

## Where to look

`MediaStore.commit` validates and serializes before changing memory, replaces
the current file lookup, and broadcasts before waiting on persistence.
`mediaChannels.ts` contains the P6a boundary and its unavailable/lifetime
guards. `register.test.ts` exercises these paths with the existing service and
settings handlers in place.

## Review: lead

Pending.

## Review: reviewer

Pending.

## Team member's reply

Pending review.
