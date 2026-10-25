# Review request: data-31

- Team member: data
- Branch: `feat/data/overlay-contracts`
- Base: `da0d29926cf8f9f0b55673c8a8768b20e876c843` (`main`)
- Review range: `da0d299...feat/data/overlay-contracts`
- Request: `.llp/task.md`, "Insert first (from the lead, 01:20)".
- Proposal: output's `output-23/contracts.ts`, read without changing its
  worktree.
- Final commit and final HEAD CI URL/result accompany the review request.

## What changed and why

O6a can now carry routed, timed messages, several active props, notice playback,
and a stage message through the checked live-state boundary.
`MessageLayer.items`, `PropLayer.items`, `NoticeLayer.playback`, and
`LiveState.stageMessage` are optional additions. Existing M2 layers and records
still parse with their original string summary IDs. New metadata uses branded
UUIDs, including a new active `MessageId` and its schema-layer factory, distinct
from template IDs.

`ActiveMessage` contains text, targets, excluded targets, start time, and a
nullable expiry. `ActiveProp` reuses the stored image/text content schema and
adds its targets. `NoticePlayback` carries ordered media IDs, position,
interval, loop, targets, start time, and nullable pause time. Epoch values must
be finite, nonnegative, and no larger than the safe integer limit. Expiry and
pause cannot precede the corresponding start; notice positions must address an
image.

The list caps are 200 active messages, 64 active props, 512 notice images, and
200 screens per target or exclusion list. Active IDs and target IDs must be
unique. Explicit message targets must be nonempty; exclusions must belong to
explicit targets, or can narrow `all`. Repeated notice images remain allowed.
The existing `message.send` boundary shares the new target schema.

`message.expire` carries a branded active message ID and its deadline. It is a
single live command and can appear in a flat batch. It does not interrupt song
navigation. Until O6a registers its slice, the existing unsupported-command path
logs and skips it without changing state or undo. It is not added to saved macro
actions. O6a owns the timer and current-ID/deadline/clock checks.

Stage messages remain outside `layerKinds` and cleared layers. The contract
tests verify that an all-clear retains the stage message and that existing clear
undo retains the additive layer metadata. O6a owns per-screen replacement,
expiry scheduling, notice playback, rendering, and time adjustment on undo.

## Main settings access

`DataStore` now exposes the proposal's main-only API:

```ts
readSettings(name: SettingsName): Promise<SettingsDocument | null>;
subscribeSettingsChanges(listener: (document: SettingsDocument) => void): () => void;
```

These wrap the current canonical settings store. Reads wait for startup and
return null on unavailable areas or shutdown; failures are logged. Changes use
the existing validated settings documents and store subscriptions. Unsubscribe
and shutdown cancel pending loading subscriptions as well as active listeners.
No new renderer IPC, settings writer, or app-index wiring is needed.

## Changed files

- `src/shared/schema/overlayState.ts` and `overlayState.test.ts`: schemas,
  inferred public types, caps, routing/time checks, compatibility and invalid
  input coverage.
- `src/shared/live.ts`, `schema/liveState.ts`: additive layer/state fields and
  live-state validation.
- `src/shared/schema/ids.ts`, `idCreation.test.ts`: active message IDs.
- `src/shared/commands.ts`, `schema/liveCommand.ts`, `schema/liveActions.ts`,
  `schema/liveActions.test.ts`: expiry command, navigation classification,
  common target validation, and unsupported-slice regression coverage.
- `src/shared/schema/props.ts`: export its existing content schema for reuse.
- `src/main/store/settingsAccess.ts`, `settingsAccess.test.ts`, `register.ts`,
  `register.test.ts`: main-only reads and subscriptions, disposal/loading
  coverage, and real settings-edit delivery to a main subscriber.
- `src/shared/schema/preserveUnknown.ts`: data-30 TSDoc nit below.
- `docs/reviews/data-31.md`.

## Checks run

| Check                                                                      | Result                                          |
| -------------------------------------------------------------------------- | ----------------------------------------------- |
| `npm run typecheck`                                                        | Passed                                          |
| Targeted overlay, live command/state/batch, props, IDs, and settings tests | 10 files, 224 tests passed                      |
| ESLint on changed TypeScript files                                         | Passed                                          |
| `npm run format` and `git diff --check`                                    | Passed                                          |
| Rebase onto latest main                                                    | Already up to date                              |
| Local full verify                                                          | Not run, per lead instruction                   |
| GitHub full verification                                                   | Final HEAD URL and result accompany the request |

No visible windows, dialogs, soak, memory measurements, or dependency installs
were started. Test text is invented.

## Decisions and carried nit

Keep summary IDs compatible with M2; brand only the added metadata and new
command ID. The additions do not change stored settings formats. Reuse the
current settings owner and data-30 state rather than introducing another cache.

The `preserveUnknownFields` TSDoc now states that matching by name or position
can attach unknown fields to a different item when one edit both renames and
reorders entries. Stable IDs are preferred when a format gains them.

The interrupted media-list work is retained locally for data-32. Its P6a scope
agreement is unchanged; no media implementation is included here.

## Where to look

`overlayState.ts` defines the new shapes and bounds. `liveState.ts` leaves
legacy fields intact. `settingsAccess.ts` guards startup and disposal. The
existing register-store disk test now asserts main reads and change delivery
alongside the renderer push.

## Review: lead

Pending.

## Review: reviewer

Pending.

## Team member's reply

Pending review.
