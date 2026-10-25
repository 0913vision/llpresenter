# Review request: data-42

- Team member: data
- Branch: `feat/data/recovery-record`
- Base: `5c303d153c92c9ad347570be252e1f8839824fc3` (`main`).
- Review range: `5c303d15...feat/data/recovery-record`.
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

The record is at most 4 MiB of UTF-8, on both parse and serialization. Saved
outputs are limited to 200, slide lines to 1,000, and each displayed text field
to 4,000 characters. The existing live overlay schemas retain their caps for 200
messages, 64 props, 512 notice images, and 200 target screens, together with
their ID, uniqueness, clock, and position checks. Unknown future content also
counts toward the file byte limit.

This is a file contract. Output owns the writer, crash eligibility, the
audio/timer/undo exclusions before writing, and rebasing playback and overlay
clocks during restore. There is no IPC, disk I/O, or restore action in this
request.

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
- `src/shared/schema/liveState.ts`: export the existing schema for reuse; its
  definition and IPC behavior do not change.
- `docs/reviews/data-42.md`: this request.

## Validation

- Fast tests pass: 60 tests across the recovery record, existing live state, and
  overlay state schemas, including the final recovery record cases.
- Type check, scoped ESLint, `npm run format`, cache-disabled changed-file
  Prettier checks, and `git diff --check` pass. The full verify runs on the
  pushed branch in GitHub CI.
- No visible windows, Electron launch, soak, or memory measurement.

## Review focus

Check nested unknown-field preservation after schema validation, the shared
live-state rules and error paths, and the record's bounds and version behavior.

## Follow-up order

The Look contracts for O4 (data-43) come next, before data-41's media strip and
left-column state. The Look addition is additive so old recovery records remain
readable.

## Reviewer

Pending.
