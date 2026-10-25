# Review request: data-40

- Team member: data
- Branch: `feat/data/library-show-song`
- Base: `212dda70777fd28690d3b962d4035a1a1118d93f` (`main`).
- Review range: `212dda70...feat/data/library-show-song`.
- Request: `.llp/task.md`, "After data-39 (from the lead, 05:05)", and the seven
  data-39 review nits carried forward by the lead.
- Final commit and final HEAD CI URL/result accompany the review request.

## What changed and why

`LlpApi.library.showSong({songId})` returns `ShowLibrarySong | null` on
`library:show-song`. A search result can open a library song in 진행 without
adding a service item. The projection includes the song id and revision, title,
read-only flag, tiles, jump keys, and optional checked background and problem.
The schema validates both main's reply and preload's request/reply, including
matching the returned song id to the request.

Main reads the latest content document and current label settings. It reuses the
service projection's tile conversion, file-order default arrangement, label
colors, first-wins jump keys, and media library `backgroundOf` file check. A
missing background yields `missing-background` without a media choice. Known
fields from a newer source remain readable and read-only; `newer-version` is
reported when no missing background takes precedence, matching the service
projection. Unknown or deleted songs return null. Failed reads and unavailable
storage log and reject rather than pretending the song was deleted.

The read waits for the existing content load. Its handler is removed on store
disposal, and an in-flight read returns no projection after release. It writes
no files, changes no service, and sends no live command. The renderer remains
responsible for dropping stale asynchronous responses when its selection or
source changes.

The new reply caps tiles at 10,000, lines per tile at 1,000, and jump-key
entries at 200. Oversized projections reject with a logged error, without
truncating the song. The existing service projection's limits and behavior are
unchanged.

## Data-39 review nits

- The 256-command budget now stops expansion and emits one `command-limit`
  problem, like the action budget. Remaining generated commands and subsequent
  actions are not visited after the cap.
- Message blank substitution uses `Object.hasOwn` and rejects inherited
  properties as missing values.
- `mediaLoops` is the shared visual media end rule, used by the media library,
  macro media action, and renderer media strip. Only explicit `end: 'stop'`
  disables looping.
- `MacroCommandPort` is declared in the live slice contract. The live store no
  longer imports the macros feature's types, removing that type cycle.
- An invalid legacy service-item macro logs a warning with its item id and
  validation problem, retaining the current output.
- Skipped-action warnings are one summary with the total count and at most the
  first five problems. The bounded complete report remains in `lastRun`.
  Unsupported commands continue through the registry's own diagnostics.
- Removed the stray blank line in the macro schema imports.

## Changed files

### Shared contracts and preload

- `src/shared/schema/showLibrarySong.ts` and `.test.ts`: request, nullable
  projection, identity check, caps, and valid/invalid tests.
- `src/shared/schema/showService.ts`: expose the existing tile schema for reuse.
- `src/shared/ipc.ts`: channel and typed library method.
- `src/preload/index.ts` and `.test.ts`: validated invocation and failure tests.
- `src/shared/testing/fakeLlpApi.ts`: default nullable read for existing tests.
- `src/shared/mediaEndRule.ts` and `.test.ts`: shared end rule and defaults.
- `src/shared/schema/macros.ts`: import whitespace nit.

### Main data and macro implementation

- `src/main/store/librarySong.ts` and `.test.ts`: projection, handler, load and
  release behavior, current labels, missing source, and read failures.
- `src/main/store/register.ts` and `.test.ts`: register and release the read,
  share live label/background sources with the service feed, and verify real
  background checks, newer files, unchanged service, edits, and deletion.
- `src/main/store/showService.ts`: expose existing tile and jump-key builders.
- `src/main/store/mediaLibrary.ts`: call the shared media end rule.
- `src/main/macros/actions.ts`, `compiler.ts` and `.test.ts`, `messageText.ts`
  and `.test.ts`, `runner.ts` and `.test.ts`, `types.ts`: carried review nits
  and regressions. The lead's data-39 feature ownership exception covers this
  follow-up explicitly requested for data-40.

### Other owners' files under explicit lead exceptions

- `src/main/live/slice.ts`: declare `MacroCommandPort` here, as requested by the
  lead's data-39 review nit.
- `src/main/live/store.ts`: update only that type import to the slice contract.
- `src/renderer/src/show/useMediaStrip.ts`: only import and call `mediaLoops`,
  allowed by the lead for data-40. Rebase immediately before pushing because
  spec's media strip work can touch the same lines.
- `src/renderer/src/prep/library/useLibrary.ts`: narrow only the `LibraryApi`
  type to its consumed library method, `search`, as allowed by the lead. The
  preparation fixture need not implement an unrelated read boundary.
- `docs/reviews/data-40.md`: this request.

## Validation

- Fast tests pass: 189 tests across 14 files. They cover the schema, preload,
  library reader and real store wiring, existing service projection and media
  library, macro compiler/runner/message rendering/startup, and the existing
  media strip tests without changing them.
- Type check passes, including the narrowed preparation API.
- Scoped ESLint, `npm run format`, cache-disabled changed-file Prettier checks,
  and `git diff --check` pass. The full verify runs only on GitHub CI.
- No visible windows, local native Electron launch, soak, or memory measurement.

## Review focus

Check the read-only projection and current settings/background sources, the
shared tile behavior, command-budget termination and bounded warnings, and the
minimal cross-owner changes.

## Follow-up order

Next is the priority recovery record contract (data-42, the next free number),
then data-41's media strip and left-column state contracts. Neither is blocked
by this implementation.

## Reviewer

Pending.
