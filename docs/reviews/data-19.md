# Review request: data-19

Shared changes: `contentDocuments.ts` and `contentEdit.ts` expose deeply
readonly known fields, like the file schemas, so stored documents can be
returned without mutable copies. JSON and IPC shapes stay the same. The document
parser TSDoc now uses the plural channel names. The new test-only `testId`
helper replaces direct valibot imports in the app config and preload tests.
Dependencies data-17 and data-18 are already merged into `main`.

Round 2 adds public `createSongId`, `createServiceId`, `createTemplateId`, and
`createServiceItemId` helpers in `src/shared/schema/ids.ts`. Each checks and
brands a generated UUID, keeping the validation library inside the schema layer.
Existing data formats and IPC payloads are unchanged.

- Team member: data
- Branch: `feat/data/content-store`
- Base commit (`main`): `93844fdd32a479aeede04478861428169c815053`
- Last code commit: `738130d`
- Review range: `93844fd..feat/data/content-store`
- Round 1 head: `5794476`, rebased without conflicts to `fc5d22a`.
- Round 2 changes: `fc5d22a..feat/data/content-store`
- Related brief: `docs/briefs/data.md`; M3-D1a-1 main-process handlers

## What changed and why

The data-18 content API now reads and edits songs, 예배 순서, and 틀 through the
main-process store. Each loaded or created document starts at revision 1.
Whole-document updates require the current `baseRevision`; an old editor copy
returns `stale` without changing the stored document or its file. Commands run
in order, so a delete cannot overtake a multi-file edit and leave a resurrected
file. Read-only documents and changes to the schema version are refused.

A 구성 rename or delete changes the song and the editable 예배 순서 and 틀 items
that pick it. The song writes first, followed by affected services in id order,
then affected templates in id order, through atomic writes and recovery copies.
Each file can fail independently; the rest still write. A `write-failed` answer
names the unchanged files and the applied `{id, revision}` while the new
documents stay in memory. Failed operations retain only the latest write or
deletion per file, and flush retries them once. Tests inject a failure in the
middle, check the other files, and then retry the failed file.

Typing changes the in-memory document and sends its document push immediately.
The push carries its revision, as often as the editor submits an update; the
existing API tells the editor to recognize its own answer's revision. A typed
draft remains local UI state until an answer or push updates the window's store
copy. A list push occurs only when that list's displayed fields change. Lyrics
typing leaves every list alone. The write is debounced for 500 ms and uses the
latest document. Shutdown removes every content handler, finishes commands and
pending writes, retries failures once, and releases the timers.

The open `ShowService` is rebuilt when a song or service changes. Only a
displayed change increments its independent revision and sends
`service:changed`. It retains its last good snapshot if rebuilding fails.
Editing a song updates the tiles without a live-state command or push, following
04, "Editing a song that is on output": current output stays until the next 장,
while the tiles change immediately.

The handlers also create uniquely titled 새 곡, create services from a 틀 or
empty, import items in source order with new ids and their selected children's
headers, save a service as a new 틀, update documents, and delete them. The open
service cannot be deleted. Existing documents retain their loaded paths; new
documents use their ids as filenames. A deletion waits for in-flight saves and
keeps the final file as a recovery copy, even if a recent autosave already made
a copy. If the final recovery copy fails, deletion returns a failure and leaves
the original file for retry. Korean numeric collation puts 찬송 2 before
찬송 10.

Data-17 nits are included: the app config owner reuses the config and access
from `readLocationFields` instead of parsing again, and its test uses a public
test-id helper. Data-18 nits are included: plural TSDoc channel names and the
same helper in the preload test.

## Changed files

- Store: `contentStore.ts`, `documents.ts`, `contentEdits.ts`,
  `contentLists.ts`, `contentPersistence.ts`, and `documentFiles.ts` implement
  editing, revisions, list projections, persistence, and deletion recovery.
- Integration: `register.ts`, `contentChannels.ts`, `openServiceFeed.ts`, and
  `showService.ts` connect validated IPC reads/edits and document pushes to the
  existing open service without changing the live state.
- Loading: `library.ts` preserves each loaded path; `fileStore.ts` loads the
  template collection and reports broken template files.
- Nits and types: `appConfigFile.ts`, `locations.ts`,
  `src/shared/schema/{contentDocuments,contentEdit,testHelpers}.ts`, and
  `src/preload/index.test.ts`.
- Round 2: `src/shared/schema/ids.ts` and its new `idCreation.test.ts` cover the
  four public factories and invalid UUIDs.
- Tests: content store, content channels, document files, open-service feed,
  register, file store, app config, locations, and the existing preload test.
- Review: this document. No other member's owned files changed.

## Checks run

Round 2 store, schema, and preload tests passed: 53 files and 688 tests. The
original five regression failures were reproduced before the fixes. Changed
TypeScript files passed ESLint after correcting two style findings.

| Command or test                                                                 | Result                                                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run typecheck` after rebase                                                | Passed                                                                               |
| `npm test -- src/main/store src/shared src/preload --maxWorkers=2` after rebase | Passed: 57 files, 674 tests; the later readonly-reference test is included in verify |
| ESLint on changed TypeScript files                                              | Passed after correcting the reported test formatting                                 |
| `npm run format`                                                                | Passed before the code commit                                                        |
| `npm run verify` (round 1)                                                      | Passed once: all 5 steps, 239.9 s                                                    |
| Round 2 regression tests before fixes                                           | Five new cases failed on the round 1 implementation                                  |
| Round 2 typecheck                                                               | Passed                                                                               |
| Round 2 focused tests                                                           | Passed: 3 files, 67 tests                                                            |
| `npm run verify` (round 2)                                                      | Passed once: all 5 steps, 172.2 s                                                    |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes for round 2.
- [x] `npm run format:check` passes in round 2 verify.
- [x] New behaviors have tests, including stale revisions, a failure in the
      middle, save retry, deletion retry, pending-save deletion, template
      loading, IPC validation and cleanup, and immediate tile updates.
- [x] External IPC values and loaded files pass the shared schemas.
- [x] No `any`, assertions that bypass checks, or non-null assertions added.
- [x] Shutdown removes the handlers and releases autosave timers after flush.
- [x] Persistence holds at most one pending operation per file; list snapshots
      have three entries and the shown service has one snapshot.
- [x] A failed rebuild or window send is logged; other windows and live output
      keep running.
- [x] Document and list pushes reflect only their own displayed changes.
- [x] Persistence, IPC transport, projections, and editing have separate
      modules; the existing atomic saver handles ordered writes and copies.
- [x] Comments follow the allowed TSDoc and NOTE forms.
- [x] The change uses strict types and the repository's language conventions.
- [x] Scope is data-19 and the two preceding reviews' nits.
- [ ] Measured performance values: no performance benchmark or Electron app
      session was run for this request.

## Decisions I made (for the lead to confirm)

1. Failed persistence retries on a later edit of that file or on flush,
   including shutdown. This request implements store handlers and logging;
   renderer save-status and retry-button wiring are outside this batch.
2. Cross-file 구성 edits leave newer-version services and templates untouched.
   An item that still names a missing 구성 uses 기본, as required by 02, "Song
   item" and 05, "Editing an imported song". The existing show-service reader
   already implements that fallback.
3. Whole-document song and template updates preserve unknown top-level fields
   while omitted known optional fields clear the corresponding setting. The
   complete nested objects keep their unknown fields through the existing schema
   passthrough and object spreads.
4. `service.saveAsTemplate` creates a new template under the data-18 contract.
   Overwriting an existing template uses its revisioned `template.update`
   command after the UI resolves the confirmation.

## Shared contract change requests

None. The readonly type adjustments listed at the top keep existing runtime
payloads and channel names.

## Where to look

- `contentStore.test.ts`: stale updates and failure in the middle.
- `contentStore.ts`: dispatch, write order, and revision checks.
- `register.test.ts`: real IPC handlers, disk flush, and edited tile pushes.
- `documentFiles.test.ts`: final recovery copy and in-flight save ordering.
- `openServiceFeed.test.ts`: displayed revisions and last good snapshot.

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

Round 1 findings from codex3, addressed in round 2:

1. Fixed. `documentFiles.remove` returns the failed final recovery-copy result
   immediately, before removing the original. `ContentPersistence` retains that
   deletion for retry. The regression test uses a deletable regular file and a
   blocked recovery folder: the first attempt fails and preserves the original
   bytes, then flush succeeds after the blocker is removed, leaving the last
   content in the recovery copy. It failed on the round 1 code. A separate test
   covers an actual removal failure after a successful copy.
2. Fixed. 구성 rename and delete now rewrite matching references in editable 틀
   as well as 예배 순서. A shared helper increments only changed documents'
   revisions; every changed template is saved and pushed with its revision.
   Write order is the named song, services by id, then templates by id.
   Read-only and unrelated templates stay unchanged. Tests cover both edits,
   stale template editors, persisted content and pushes, later service creation
   and item import from the edited template, and a template write failure in the
   middle that leaves the remaining writes running and is retried on flush. All
   four template regression cases failed on the round 1 code.
3. Fixed. The two store modules no longer import valibot. Four public factories
   in `schema/ids.ts` validate generated UUIDs and return the appropriate
   branded ids; the main-process code only supplies `randomUUID()`. Factory
   tests cover valid lowercase UUID v4 values and reject empty, malformed, nil,
   non-v4, invalid-variant, and uppercase values. No type assertion bypasses
   validation.
