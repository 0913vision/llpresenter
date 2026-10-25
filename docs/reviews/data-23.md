# Review request: data-23

Shared changes: library search, decoded text-import input and draft results, and
the custom song-drag payload. New preload functions validate requests and
replies. Main search/import handlers and service-drop UI remain in D4, D3, and
prep's later requests.

- Team member: data
- Branch: `feat/data/library-contracts`
- Base commit (`main`): `ff365049e0e0be39ded27e10cc962530b581062b`
- Last code commit: `b63950d`
- Review range: `ff36504...feat/data/library-contracts`
- Task: M3-D1a-2, `docs/plans/m3-breakdown.md`
- Behavior: spec 05 search/text import/drag, spec 04 toolbar search, spec 02
  song fields

## What changed and why

### Search

`library.search({query, limit?})`, on `library:search`, returns
`{query, matches}`. Each match carries `songId`, title, slide count, and either
`match: {kind: 'title'}` or `match: {kind: 'lyrics', line}`. The original first
matching line lets a toolbar show the lyrics context. The echoed query lets a
window discard an older asynchronous response.

An omitted limit permits all matches for the library; toolbar callers pass 20.
The schema leaves query normalization, empty/space-only behavior, and sorting to
D4. Duplicate song ids are rejected with a linear-time uniqueness check.

### Text import

The lead approved two separate operations, both validated in preload:

- `textImport.read({source, encoding})` on `import:text:read`: main chooses one
  file or reads the clipboard, and returns decoded text with `source` and
  `fileName`. File input requires a name; clipboard input has `fileName: null`.
  No renderer-supplied disk path is accepted. A null success is cancellation.
- `textImport.preview({source, options})` on `import:text:preview`: rebuild an
  unsaved `{title, slides}` draft from retained decoded input. A title may be
  empty; at least one slide is required. There is no song id, revision, save, or
  autosave. Actual conversion and saving remain D3 work.

Both operations return typed `Result` values. Failures distinguish
`read-failed`, `decode-failed`, `empty`, and `invalid`, with a message. Options
reuse the preferences' split, label, first-line, and encoding schemas. The
preview requires positive whole units per slide, and a nonblank symbol for
symbol splitting. The existing slide schema keeps unknown slide fields safely,
including unusual JSON keys.

### Song drag

`SONG_DRAG_MIME` is `application/x-llp-song`; its JSON is
`{kind: 'song', songId}` with a branded UUID. Schema helpers validate both an
object and custom MIME text, and serialize only supported fields. Bad JSON
returns a typed failure without yielding an id. The future drop receiver logs
that failure and supplies the position or slot and the spec's insertion
defaults. Payloads cannot choose an arrangement, background, or start macro.

### Boundary behavior

The three new preload calls reject malformed requests before invoking IPC and
log their channel and failing field. Replies use the existing checked-invoke
policy: malformed replies and transport errors are logged and rejected, so the
caller retains its prior state. Valid conversion refusals and cancelled reads
remain normal typed results. No raw IPC, filesystem, or Electron APIs are
exposed.

## Changed files

- New `schema/librarySearch.ts`, `textImport.ts`, `songDrag.ts` and tests.
- `schema/preferences.ts` and `song.ts`: export/reuse the existing option and
  slide schemas; stored formats and behavior are unchanged.
- `schema/testHelpers.ts`: allow the success helper to unwrap payload errors as
  well as file errors, with no runtime change.
- `src/shared/ipc.ts`, preload, and their fake/tests: three channels and typed
  checked functions. Fake search is empty, reads cancel, and previews refuse.
- This review document. No main handler or renderer source changes.

## Checks run

| Check                                               | Result                                                  |
| --------------------------------------------------- | ------------------------------------------------------- |
| Typecheck                                           | Passed, including after rebase                          |
| Focused schema/preferences/song/preload/fake tests  | Passed: 7 files, 145 tests                              |
| Final focused search/import/drag/preload/fake tests | Passed: 5 files, 100 tests                              |
| Changed-file ESLint                                 | Passed after safe unknown handling in tests             |
| Format                                              | Passed before code commits                              |
| Rebase onto main                                    | Refreshed for devops-19 at `ff36504`, without conflicts |
| Local full verify                                   | Not run, per the lead's updated CI rule                 |
| GitHub CI, tested head `62b5746`                    | Passed: fully green after devops-19                     |

Source verification run:
[GitHub CI](https://github.com/0913vision/llpresenter/actions/runs/40190412105).
The final review-head CI URL and result are included in the request report.
Local fast-check logs are `.llp/data23-*.log`.

### CI after devops-19

The run above verifies head `62b5746`, including the current source and
SwiftShader support from main. It completed successfully. Earlier runs before
devops-19 failed in inherited Electron fixtures because GitHub runners had no
GPU; that temporary exception is retired and is not used for this request. The
final review-head run must also be fully green and is recorded in the request
report. No local full verify was run.

## Quality checklist

- [x] Source CI is fully green; final review-head CI is recorded in the request
      report.
- [x] New requests, replies, and drag data have valid/invalid tests.
- [x] Malformed requests and replies are logged and rejected at preload.
- [x] The preload stays typed; file-shaped fields retain unknown data safely.
- [x] No unchecked assertions, non-null assertions, or `any`.
- [x] No new subscriptions, timers, caches, output work, or renderer work.

## Decisions for the lead

1. Search replies include title/count for standalone toolbar rows and echo the
   query for asynchronous result handling. Query behavior stays main-owned.
2. The read/preview split follows the lead's explicit answer. File reading is
   selected in main; preview requests carry retained text rather than a path.
3. Only the song id crosses the drag boundary; insertion details belong to the
   destination service. Bad drag data returns an error for its future receiver.

---

## Verdicts (recorded by the lead at merge)

- Round 1 (d434655): reviewer (Codex, codex2) Approve with no findings. Lead
  Approve. Nit for the next data branch: `LibrarySearchRequest.limit` has no
  upper bound and an absent limit returns every match; cap it (for example 200)
  so that one IPC reply stays bounded (CLAUDE.md, cap every list). Written by
  the Codex session that took over data's work. Rebased by the lead onto local
  `main` without conflicts.
