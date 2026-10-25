# Review request: data-42

- Team member: data
- Branch: `feat/data/recovery-record`
- Base: `589e7b5904f11cfd9b75807700f3bd449dd0f2e8` (`main`).
- Review range: `589e7b59...feat/data/recovery-record`.
- Request: `.llp/task.md`, "After data-40, before data-41 (from the lead,
  06:05)", and output's read-only `output-26/recovery-contract-proposal.md`.
- Final commit and final HEAD CI URL/result accompany the review request.

## What changed and why

The shared recovery file contract wraps the live state in `live.json`:
`format: 'llrecovery'`, `schemaVersion: 1`, `savedAt`,
`serviceId: ServiceId | null`, and `state: LiveState`.
`parseRecoveryRecord(text, file = 'live.json')` and
`serializeRecoveryRecord(record, file = 'live.json')` use the existing file
pipeline, typed errors with field paths and file names, stable JSON, BOM
handling, version checks, and reserved-key escaping.

The file state reuses the existing live-state schema rather than declaring a
second model. Validation produces its normalized known fields first. Only
unknown fields from the original value are then restored on that validated copy,
recursively through objects and arrays. Known values stay those returned by the
schema. The existing file pipeline bounds depth and safely restores reserved
keys such as `__proto__`, `constructor`, and `prototype`. IPC parsing continues
to drop unknown fields as before.

The record is at most 4 MiB of UTF-8, on both parse and serialization.
`LIVE_STATE_LIMITS` is the single source for the recovery and live boundaries:
200 non-alias output keys, 1,000 slide lines, and 4,000 characters per displayed
text field. The four output-25 aliases `main`, `stage`, `broadcast`, and
`captions` have separate slots beside those 200 keys. The existing live overlay
schemas retain their caps for 200 messages, 64 props, 512 notice images, and 200
target screens, together with their ID, uniqueness, clock, and position checks.
Unknown future content also counts toward the file byte limit.

Commands reuse the bounded layer and live-action schemas. Settings-derived prop
text is checked by the active-prop schema. The registry validates each changed
state before admitting it, so a sequence of individually valid output commands
cannot accumulate too many outputs, and main-only calls cannot bypass the
limits. A rejected child uses the existing warning diagnostic, retains the same
history and undo entry, and leaves later batch children running.

Individual field limits alone still permit a combined state larger than 4 MiB.
`parseLiveState` therefore also enforces a serialized byte budget, including
recovery's state indentation and reserving 1 KiB for its standard header. The
registry applies this check to the original candidate, including any future
fields. This prevents admitting an otherwise valid large slide plus messages
that would leave the recovery writer stuck with an old record.

Output owns the writer, crash eligibility, the audio/timer/undo exclusions
before writing, and rebasing playback and overlay clocks during restore. There
is no IPC, disk I/O, or restore action in this request. The live admission guard
is included here to keep the file and runtime boundaries consistent.

## Versions and preservation

Version one is the first file schema and needs no invented migration step. The
older-record regression uses a version-one state from before the additive
multi-item overlays and stage message. It keeps legacy layer summaries and
placeholder output ids, and round trips without adding absent fields.

A compatible schema version two record loads read-only with its unknown fields
preserved. The serializer refuses it, following the common newer-file rules. A
malformed newer record reports `newer`, while current malformed data reports
`invalid` with its nested state field path.

Tests round trip root, state, layer, array-element, prop-content, and notice
playback extensions, including reserved keys, then change a known field and
verify those extensions remain. They also cover invalid file headers, ids,
times, state and overlay values, UTF-8 byte limits, text and list caps, nullable
service, BOM, stable serialization, and invalid writes. Fixtures contain
invented text only.

## Changed files

- `src/shared/schema/recoveryRecord.ts`: file schema, limits, parser,
  serializer, and validated unknown-field preservation.
- `src/shared/schema/recoveryRecord.test.ts`: file and compatibility tests.
- `src/shared/schema/liveState.ts`: export and reuse the schema, apply the
  shared text/line/output limits, and check the live aggregate byte budget.
- `src/shared/schema/liveLimits.ts` and `.test.ts`: named limits, shared text
  and output schemas, alias allowance, byte budget, and boundary regressions.
- `src/shared/schema/liveActions.ts`: bound stage and sent-message text.
- `src/shared/schema/overlayState.ts`: bound active-message and text-prop text.
- `docs/reviews/data-42.md`: this request.

## Changes outside my paths

- `src/main/live/sliceRegistry.ts`: validate a changed candidate before it
  enters the live history. This is necessary to enforce cumulative output and
  byte limits, which an individual command cannot know. The existing skip and
  batch paths are reused.
- `src/main/live/limits.test.ts`: regression tests with explicit test registries
  for actual output-25 alias normalization, the 201st configured output,
  combined-state byte overflow, batch continuation, and settings-derived prop
  text. Valid states at these boundaries remain serializable.

These minimal output-owned changes follow main's code-owner rule at `589e7b5`.
No separate output feature or persistence wiring is changed.

## Validation

- Fast tests pass: 196 tests across 11 files, covering recovery and live
  schemas, command requests and batches, registry admission, overlays, and the
  live store. Tests cover a value at and one over each text and slide-line cap
  on both the command and record, 200 canonical outputs plus all four aliases, a
  rejected next output through the real slice, and the aggregate byte budget.
- Type check, scoped ESLint, `npm run format`, cache-disabled changed-file
  Prettier checks, and `git diff --check` pass. The full verify runs on the
  pushed branch in GitHub CI.
- No visible windows, Electron launch, soak, or memory measurement.

## Review focus

Check nested unknown-field preservation after schema validation, the shared
live-state rules and error paths, and the record's bounds and version behavior.

## Follow-up order

Per the lead's 07:00 queue change, Look contracts move to output's O4 request
and media strip / left-column contracts to spec's S1b. Data's next request is
data-44, the close handshake end to end.

## Round 2 reply

1. Removed the recovery-only field restrictions. Live commands, live state,
   active overlays, and the record now use the same named limits. State
   admission also checks cumulative outputs and serialized bytes, retains the
   last good history on rejection, and continues later batch commands. Boundary
   and integration regressions cover the requested caps and compatible alias
   keys. The contract tightening is committed with the `break` tag.
2. The spec 02 record-table nit is assigned to spec by the lead. This request
   does not change the spec table.

## Reviewer

Pending.
