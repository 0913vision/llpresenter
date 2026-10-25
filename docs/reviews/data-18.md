# Review request: `data-18`

Review range: `5536536...feat/data/content-contracts`

Round 2 changes only: `6dac9fc...feat/data/content-contracts`

- Team member: `data`
- Branch: `feat/data/content-contracts`, on `main` (data-16 has merged)
- Base commit (`main`): `5536536` (round 1: `0e180a1` with data-16 below)
- Last commit: see the newest commit that changes this file
- Related brief: `docs/plans/m3-breakdown.md`, "M3-D1a, D1b, D1c Contracts"
  (D1a-1: songs, 예배 순서, and 틀); the lead's design answer of October 25
  (whole documents with a base revision, cross-file commands, revisions on every
  push); spec 01 (command path), 02 (file formats), 04, 05

What to check in round 2:

1.  Finding 1: `EditFailure` is a variant on `reason`. A refusal (`stale`,
    `not-found`, `read-only`, `duplicate-title`, `invalid`) has only a message,
    because nothing changed. `write-failed` carries `applied`, the
    `{id, revision}` the edit produced in memory, and at least one entry in
    `unchangedFiles` (02, "Save failures": the content stays in memory). Tests:
    `contentEdit.test.ts` (accepted with `applied`, rejected without it or
    without a file) and the preload test "keeps the applied result of an edit
    whose save failed".
2.  Finding 2: `service.importItems` takes
    `from: {kind: 'service', id} | {kind: 'template', id}`, and `index` is gone:
    spec 05, "Importing from another service", lists 틀 and 지난 예배 as sources
    and appends the checked items to the end of the current service, in source
    order, with new ids. Tests: valid imports from both kinds; an unknown kind,
    a 틀 id that isn't a UUID, and the old `fromServiceId` shape fail.
3.  Finding 3: every change schema checks that a non-null document carries the
    id the change names (`document.song.id === songId`, and the same for 예배
    순서 and 틀). Tests: `contentDocuments.test.ts` for all three kinds, and the
    preload subscription test drops a song push with another id.

What to check in round 1:

1.  `src/shared/schema/contentEdit.ts`: the `ContentEdit` union (dotted types,
    like `LiveCommand`) and `EditResult`. Every edit has a schema; a wrong shape
    fails with its field. A song or 예배 순서 inside an edit is checked with the
    file schema and the file's key handling, so its unknown fields survive and
    `__proto__` stays a plain field.
2.  `src/shared/schema/contentDocuments.ts`: the reads and pushes, each with the
    document's revision and access.
3.  `src/shared/ipc.ts`: the channels (`a:b`, as all channels are) and
    `LlpApi.content`, `songs`, `services`, and `templates`, with the TSDoc rules
    below.
4.  `src/preload/index.ts`: typed functions only; every answer and push goes
    through its check; a bad answer is logged and rejects (data-16's rule), and
    a bad push is logged and dropped.

## Shared changes

All in data's paths:

1.  New `src/shared/schema/contentEdit.ts` and `contentDocuments.ts`.
2.  `src/shared/schema/song.ts` and `service.ts` export `songSchema`,
    `serviceSchema`, and `templateSchema` for the payloads, and song.ts exports
    `arrangementNameSchema` (the rule that a stored 구성 is never named 기본),
    which the song schema now uses too.
3.  `src/shared/ipc.ts`: 13 channels, `LlpApi.content.edit`, and the
    `DocumentApi` that `songs`, `services`, and `templates` share.
4.  `src/preload/index.ts`: the calls; `invokeChecked` passes arguments now.
5.  `src/shared/testing/fakeLlpApi.ts`: empty lists, `null` documents, and an
    edit that answers `not-found`.

## What changed and why

### The edits (`content:edit`)

| Type                                | Payload                                              | What the main process does (data-19)                                                                             |
| ----------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `song.create`                       | none                                                 | A song "새 곡" (or the next free "새 곡 N") with one blank 장 (05, "New song")                                   |
| `song.update`                       | `song`, `baseRevision`                               | Applies the known fields over the stored file, so unknown fields survive                                         |
| `song.delete`                       | `songId`                                             | Deletes the file; items that use it show `missing-song` (05, "Deleting a song")                                  |
| `song.arrangement.rename`           | `songId`, `from`, `to`                               | Renames the 구성 and rewrites every 예배 순서 item that picks it (05, "구성 row")                                |
| `song.arrangement.delete`           | `songId`, `name`                                     | Deletes the 구성; items that picked it play 기본 (05, "구성 row")                                                |
| `service.create`                    | `name`, `date`, `templateId` or `null`               | A new 예배 순서, from a 틀 or empty (05, "New service")                                                          |
| `service.update`, `template.update` | the document, `baseRevision`                         | As `song.update`                                                                                                 |
| `service.delete`, `template.delete` | the id                                               | Deletes the file                                                                                                 |
| `service.importItems`               | `serviceId`, `from` (a 예배 순서 or a 틀), `itemIds` | Appends copies of the items, in source order and with new ids, to the end (05, "Importing from another service") |
| `service.saveAsTemplate`            | `serviceId`, `name`                                  | A new 틀 from the 예배 순서 (05, "Saving the current service as a 틀")                                           |

The answer, `EditResult`, is either `{id, revision}` (the new revision, or
`null` after a delete) or a failure with a `reason`. A refusal changes nothing:

- `stale`: the document's revision moved past `baseRevision` (another window's
  edit, or a cross-file command such as a 구성 rename that rewrote this 예배
  순서). Nothing is applied; the window reads the document again. This is what
  keeps an editor with an old copy from silently undoing a newer change.
- `not-found`, `read-only` (a file from a newer app version), `duplicate-title`
  (05: titles are unique), `invalid` (a rule the schema can't see, such as an
  item id that already exists).
- `write-failed` isn't a refusal: the edit is applied and kept in memory,
  `applied` holds its `{id, revision}`, so a window still knows the song it
  created and can match its own push, and `unchangedFiles` names the files that
  couldn't be written; they are saved again later and reported as a save failure
  (02, "Save failures").

### Revisions and pushes

- A document's revision is 1 when it is read at launch and grows by one with
  every change the main process applies. It isn't stored in the file.
- Every document read and push carries the revision. The window that sent an
  edit knows its own change by the revision in the answer, so it doesn't reset
  its editor (no cursor jump while typing).
- The window's draft, such as the text being typed, is its own UI state. Its
  copy of the document changes only on an answer or a push; nothing is applied
  to that copy before the main process answers.
- How often pushes fire while someone types: the document push
  (`songs:document:changed`) fires once per applied update, so as often as the
  editor sends updates. The list push (`songs:list:changed`) fires only when
  what the list shows changes: a title, a 장 count, a use, or the set of songs.
  So the 라이브러리 and the 진행 list don't re-render on every key; only the
  window that shows that one song follows its document pushes. The editor
  decides how often it sends (prep's request); the contract allows one update
  per change.

### Rules from the spec that these contracts carry

- Editing a song that is on output (04, "Editing a song that is on output"): the
  output screens don't change until the next 장 goes out, and the tiles of the
  장 panel change at once. The edit changes the song file and the
  `service:changed` push (`ShowService`); it never sends a live command.
- A 예배 순서 item whose 구성 name no longer exists plays 기본 (05, "Importing
  from another service" answers, and the 구성 delete rule). `buildShowService`
  already falls back to the file order for an unknown 구성.
- Cross-file commands, in data-19: the main process applies the change to every
  file in memory, then writes the files one at a time, the song (or the document
  named in the edit) first, then the affected 예배 순서 in id order. Each write
  is atomic. If a write fails, the rest are still written, the answer is
  `write-failed` with the applied result and the files that didn't change, and
  each failure is logged.

### Naming

Edits are dotted types inside one channel, as live commands are inside
`live:command`; every channel is `a:b`. `service` stays the open 예배 순서 as
진행 shows it; `services` is the files.

## Changed files

- `src/shared/schema/`: `contentEdit.ts`, `contentDocuments.ts`, and their tests
  (new); `song.ts`, `service.ts`.
- `src/shared/ipc.ts`, `src/shared/testing/fakeLlpApi.ts` and its test.
- `src/preload/index.ts` and its test.
- `docs/reviews/data-18.md` (new).

## Checks run

Round 2: `npm run verify` on the commit before this document's round 2 change
(dff9c49), on `main` 5536536, steps at once: every step passed except
`test:coverage`, which failed on two tests outside this change:

- `scripts/soak/media.test.ts`, "ends the stalled maker and every process it
  started": the failure known on `main` since devops-13 (devops-17 fixes it).
- `src/main/index.test.ts`, "quits with a logged error and no dialog when the
  path is relative": it timed out at 30 s while the machine was busy (the format
  check alone took 233.8 s in this run). This change doesn't touch the main
  entry.

Every test in the files this change touches passed.

| Command or test                    | Result                                                 |
| ---------------------------------- | ------------------------------------------------------ |
| `npm run typecheck`                | Passed (52.5 s)                                        |
| `npm run lint`                     | Passed (125.8 s)                                       |
| `npm run format:check`             | Passed (233.8 s)                                       |
| `npm test`                         | Failed on the two tests above only, as `test:coverage` |
| `npm run build`                    | Passed (22.5 s)                                        |
| `npm run verify` (from phase 1 on) | Failed on `test:coverage` only (295.4 s)               |

Round 1 passed on `main` 0e180a1 with `data-16` below it (187.3 s).

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes: every step except the two tests outside this
      change named under "Checks run"
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests: every edit type,
      valid and invalid; the answers; the reads and pushes; the preload path.
- [x] Values from outside the process are validated with a schema: edits are
      checked in the main process (`parseContentEdit`), answers and pushes in
      the preload.
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: every `subscribe` returns its
      `Unsubscribe`, and a test checks it.
- [x] Caches and lists have size caps: nothing is kept.
- [x] An exception in the output path doesn't stop the output: nothing here runs
      in the output path.
- [x] Only what's needed re-renders (control window): see "Revisions and
      pushes".
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not measured.

## Decisions I made (for the lead to confirm)

1.  The stale and the write-failure tests the lead asked for come with the main
    process side (data-19), where the behavior lives; this request defines the
    fields they need.
2.  `song.create` takes no draft yet; the import flow (D1a-2) adds the draft of
    an imported song.
3.  `labels.rename` lands with the settings contracts (D1a-3).

## Where to look

- `src/shared/schema/contentEdit.ts`.
- `src/shared/ipc.ts`: `DocumentApi`.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (codex5): Request changes with three findings: a failed save could not
  report what was applied, `service.importItems` took only a past service as its
  source, and change schemas accepted an outer id that differed from the
  document's.
- Round 2 (3685623): reviewer (Codex, codex3) Approve with two nits: six
  document-channel TSDoc comments use singular channel names, and
  `src/preload/index.test.ts` imports valibot directly. The nits go into data's
  next branch. Lead Approve; the D1a-1 contracts for songs, 예배 순서, and 틀
  carry the base revision with a stale answer, a revision on every push, the
  local draft wording, and the write order and partial failure of cross-file
  commands (the lead's four conditions). The handlers and their behavior tests
  follow in data-19. Rebased by the lead onto local `main` without conflicts.

## Team member's reply

Round 1 findings from codex5, answered in round 2:

1.  Fixed. A `write-failed` answer now carries `applied`, the `{id, revision}`
    the edit produced, next to `unchangedFiles` (at least one). This follows 02,
    "Save failures": the content stays in memory and the save is retried, so the
    edit did happen and the window needs its result. The refusals keep only a
    message.
2.  Fixed. `service.importItems` takes `from`, a 예배 순서 or a 틀 by id.
    Following 05, "Importing from another service" (sources: 틀 and 지난 예배;
    the checked items are appended to the end, in source order, with new ids),
    `index` is gone.
3.  Fixed. The song, 예배 순서, and 틀 change schemas refuse a document whose id
    differs from the change's id, reported at `document`, so a subscriber that
    filters by the id gets that document only.

4.
