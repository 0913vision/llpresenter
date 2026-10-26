# Review request: `data-50`

- Team member: data (Claude session)
- Branch: `feat/data/media-relink`, on `main` after data-47, data-49, and
  spec-46 (a75c124a)
- Base commit: a75c124a; the request message gives the range, the head commit,
  and its CI run.
- Related brief: `docs/briefs/data.md`; request from `.llp/task.md`, M3-P6a part
  2 (`docs/plans/m3-breakdown.md`, P6a: "the missing file check, relink, and
  relinking the other files of the same old folder"), split with the lead's
  agreement: part 1 imports with copy progress (data-49); part 2 relinks and
  checks missing files; part 3 analyses media in a hidden renderer
  (`docs/decisions.md`, 1aa047ff).

## What changed and why

Spec 08 ("Missing media file") asks main to check the media files when the list
loads and again when one fails to play, and 다시 연결 to replace the path of the
media id. data-34's channels already validate `media.relink` and pass it to the
backend, which refused it until now.

1. **Contract** (`src/shared/schema/mediaFiles.ts`, `src/shared/ipc.ts`,
   preload). `media:missing` pushes the media ids whose file can't be found, in
   media list order, `media:missing:get` reads them, and `media:check` asks main
   to check one file again, as after it failed to play. `LlpApi.media` gains
   `missing()`, `subscribeMissing()`, and `check()`. The list is capped at
   `MEDIA_LIMITS.items`.
2. **The check** (`src/main/media/missingFiles.ts`). `MissingFiles` checks every
   file when the media list opens, an item's file again whenever its path
   changes, and one file on `media:check`. A path the library refuses counts as
   missing. At most `MAX_PARALLEL_FILE_CHECKS` (8) files are read at once, only
   the newest check of an item counts, and changes gather for
   `MISSING_PUBLISH_DELAY_MS` (250 ms) before a push, so a launch check of many
   files sends a few lists instead of one per file. Removed items are forgotten.
3. **Relinking** (`src/main/media/mediaRelinker.ts`). `media.relink` opens a
   file dialog for the item's kind on the control window (never in offscreen
   mode). A cancelled dialog changes nothing. The chosen file is stored like an
   import (a path inside the media folder relative to it, any other path in
   full) with its size, and replaces the item at the list's current revision
   through `MediaStore.replace`, so every song and item that uses the media id
   works again. One relink runs at a time, and an aborted backend changes
   nothing.
4. **The same old folder.** Other missing media whose old file was in the same
   folder as the relinked one, and whose file name exists in the chosen file's
   folder, are relinked in the same commit, up to `MEDIA_LIMITS.importBatch`
   (200) items. The relinked files are checked again afterwards, so the missing
   list clears even when a path didn't change.
5. **Wiring** (`src/main/media/register.ts`, `src/main/index.ts`).
   `registerMediaImport` becomes `registerMediaBackend`: it also connects
   relinking, runs the check once the media list opens, and answers the three
   channels. Stopping it removes the channels and stops the check before the
   data store closes.
6. **A shared helper** (`src/main/media/storedPath.ts`): the importer's stored
   path, now shared with relinking.
7. **A data-47 nit** (the lead's round 3, moved here). A retry pass moves the
   files that fail again to the end, which can change the file 저장할 수 없음
   names, but the automatic retry pushed nothing after it, so the notice could
   disagree with `problems()`. The automatic retry now pushes the final state
   when it changed (`src/main/store/saveFailures.ts`).

## Changed files

- `src/shared/schema/mediaFiles.ts` and `.test.ts` (new), `src/shared/ipc.ts`,
  `src/preload/index.ts` and `.test.ts`, `src/shared/testing/fakeLlpApi.ts`: the
  contract.
- `src/main/media/missingFiles.ts`, `mediaRelinker.ts`, `storedPath.ts`, and the
  first two's tests (new).
- `src/main/media/mediaImporter.ts`: uses `storedPath`.
- `src/main/media/register.ts` and `.test.ts`: `registerMediaBackend`.
- `src/main/index.ts` and `index.wiring.test.ts`: the rename.
- `src/main/store/saveFailures.ts` and `.test.ts`: the data-47 nit.
- `docs/reviews/data-50.md`: this request.

## Changes outside my paths

- `src/main/media/` (prep, no member): P6a's folder, given to data by the lead.
- `src/main/index.ts` and its wiring test (output): the rename only.
- `src/preload/index.ts`, `src/shared/ipc.ts`, and the fake (shared): the three
  channels, as "Shared contracts" asks.

## Shared contract changes (additive)

- `media:missing`, `media:missing:get`, `media:check`; `MissingMedia`,
  `MediaCheckRequest`, `parseMissingMedia`, `parseMediaCheckRequest`;
  `LlpApi.media.missing()`, `subscribeMissing()`, and `check()`. ui shows the
  marks (spec 08, "Showing it") from `media:missing` in P6b, and output or the
  media view sends `media:check` when a file fails to play.

## Checks run

| Command or test                                    | Result                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                                | Pass                                       |
| Vitest (`--no-fsModuleCache`) on the changed areas | Pass: 504 tests in 51 files                |
| `npx --no-install eslint` on the changed files     | Pass                                       |
| `npm run format:check`                             | Pass                                       |
| `npm run verify`                                   | GitHub CI on the head commit (see request) |

Tests: the payloads and their caps, the preload invoke, push, and send, and the
fake; the launch check pushing once in list order with a refused path missing; a
changed path checked again, a removed item forgotten, and an unchanged list
neither read nor pushed; one file checked again on request and an unknown id
ignored; a stale check losing to the newest; at most 8 reads at once; disposal
stopping the subscription and the pushes; relinking a file inside the media
folder (relative path, size, recheck) and outside it (full path); the same old
folder (relinked: a missing neighbour whose file is in the new folder; left: one
whose file isn't, one that isn't missing, and one from another folder); the
200-item commit cap; a cancelled dialog and an aborted relink; an unknown media
id and an unreadable chosen file; a second relink while one is open and a
refused commit; the registration's relink dialog with the item's kind, the
offscreen refusal of both dialogs, the missing channels and their removal, and a
backend that can't connect; an automatic pass over five failing files pushing
the next file it names.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (`media:check`
      and the pushes; the store validates the replaced items)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the list subscription, the push
      timer, the handler, and the listener)
- [x] Caches and lists have size caps (8 reads at once, a list of at most the
      media items, 200 items per relink)
- [x] An exception in the output path doesn't stop the output (no output change)
- [x] Only what's needed re-renders (control window): no renderer change
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly (about 500 lines of code and 690 of tests)
- [ ] Measured performance values (when relevant): not measured

## Decisions I made (for the lead to confirm)

1. The missing list is pushed whole, as ids in list order, rather than as
   changes: it is small next to the media list, and a window that opens late
   reads the same value.
2. Same-folder relinking takes only media that are missing now, so a file that
   still works never moves, and only files whose names exist in the new folder.
3. A second 다시 연결 while a dialog is open is refused (`invalid`), so two
   dialogs never stack on the control window.
4. The check counts a path the library refuses (outside the media roots) as
   missing, since it can't be played either.

## Where to look

- `src/main/media/missingFiles.ts`: the queue, the check serials, and the push
  timer.
- `src/main/media/mediaRelinker.ts`: the same-folder rule and the commit.

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

## Round 1 reply

1. [P2] `mediaRelinker.ts:93`, a relink overwrote edits made while the dialog
   was open. Fixed in
   `fix(media): relink into the current media list and check applied relinks again`:
   the dialog and the file checks now collect only each media id's new file and
   size, and right before the commit those go into the items as they are then,
   at that revision. Media deleted meanwhile drop out, and a deleted relinked
   item answers `not-found` without a commit. Regressions: names changed and the
   revision moved on while the dialog was open are kept, with the commit at the
   new revision; a neighbour deleted meanwhile drops out; the relinked item
   deleted meanwhile commits nothing.
2. [P2] `missingFiles.ts:98`, removed ids stayed queued. Fixed in
   `fix(media): drop removed media from the file check queue`: the queue is an
   ordered `Set`, so each item waits once, and removing an item takes it out.
   `waitingChecks` tells how many wait. Regression: with every worker blocked,
   50 rounds of adding and removing an item leave no check waiting. It fails
   without the fix.
3. [P2] `mediaRelinker.ts:95`, an applied relink whose save failed wasn't
   checked again. Same commit as 1: a `write-failed` answer, which the list
   applied in memory, checks the files again like a success. Regression: a
   restored file relinked to its unchanged path with a failed save is checked
   again.
4. Not from the review:
   `test(media): give import jobs longer to end when the suite runs at once`. A
   data-49 import test timed out once at the default one second while the whole
   media folder ran; the import tests now wait up to 5 seconds for jobs to end.
