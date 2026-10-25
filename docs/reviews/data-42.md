# Review request: data-42

- Team member: data
- Branch: `feat/data/recovery-record`
- Base: `2d2b6078c75b58629715cf196a9756047d1efc6a` (`main`).
- Review range: `2d2b6078...feat/data/recovery-record`.
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
text is checked by the active-prop schema. The registry reduces a transaction
without publishing intermediate state, then validates the final candidate once.
Only a failed final check causes a retry with per-child checks. A rejected child
then uses the existing warning diagnostic, retains the same history and undo
entry, and leaves later batch children running. A normal 256-child batch,
including one nested inside a macro, performs one full state and budget check.

Individual field limits alone still permit a combined state larger than 4 MiB.
Main therefore also enforces a byte budget, including recovery's state
indentation and reserving 1 KiB for its standard header. A cheap upper bound
uses bounded field lengths without reading string contents. When necessary, main
counts UTF-8, JSON escapes, and indentation without creating a JSON string or an
encoded copy. This check includes future fields in the original candidate. The
exact counter caches at most 256 short strings, at most 128 characters each, for
that check only. Cycles, excessive nesting, and non-JSON objects fail.

`parseLiveState` and preload stay on schema validation only; each output window
does not repeat main's byte calculation on every broadcast. Retry recompiles
macros against the admitted history. Macro plan observations and warnings run
only for the selected attempt, and deferred idempotent screen resyncs are
remembered during that dispatch so retry does not call their port twice.

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
- `src/shared/schema/liveState.ts`: export and reuse the schema and apply the
  shared text/line/output limits. Keep IPC parsing free of byte calculation.
- `src/shared/schema/liveLimits.ts` and `.test.ts`: named limits, shared text
  and output schemas, alias allowance, byte budget, and boundary regressions.
- `src/shared/schema/liveActions.ts`: bound stage and sent-message text.
- `src/shared/schema/overlayState.ts`: bound active-message and text-prop text.
- `src/preload/index.test.ts`: verify a broadcast validates known fields without
  JSON serialization or a `TextEncoder` pass.
- `docs/reviews/data-42.md`: this request.

## Changes outside my paths

- `src/main/live/sliceRegistry.ts`: validate the final candidate once and use
  the per-child retry only on failure. Preserve skipped-child diagnostics,
  select deferred observations once, and memoize idempotent screen resyncs for
  that dispatch. This enforces cumulative limits with bounded work on the normal
  output path.
- `src/main/live/slice.ts`: an optional deferred observation function lets the
  registry discard speculative macro reports on retry.
- `src/main/live/stateBudget.ts` and `.test.ts`: main-only upper bound and exact
  UTF-8/JSON size counting, with byte-boundary and encoding regressions. Keeping
  this out of the shared parser avoids work in every output window.
- `src/main/live/limits.test.ts`: regression tests with explicit test registries
  for actual output-25 alias normalization, the 201st configured output,
  combined-state byte overflow, batch continuation, and settings-derived prop
  text. Also verifies one check across 256 nested children, retry recompilation,
  one observation/resync, cached resync failures, and observer error isolation.
  Valid admitted states remain serializable.
- `src/main/macros/runner.ts` and `.test.ts`: defer the selected `lastRun` and
  warnings so the exceptional retry does not report a speculative plan twice.
- `scripts/bench/liveAdmission.test.ts`: opt-in CPU measurement harness for the
  requested before/after dispatch and preload costs. Normal tests skip it.

These changes follow main's code-owner rule at `589e7b5` and are needed for
admission performance and retry correctness. No output feature or persistence
wiring is added.

## Validation

- Fast tests pass after rebase: 312 tests across 16 files, covering recovery and
  live schemas, command requests and batches, registry admission, overlays, and
  the live store. Tests cover a value at and one over each text and slide-line
  cap on both the command and record, 200 canonical outputs plus all four
  aliases, a rejected next output through the real slice, the aggregate byte
  budget, one-check admission, retry behavior, and preload's schema-only
  parsing.
- Type check, scoped ESLint, `npm run format`, cache-disabled changed-file
  Prettier checks, and `git diff --check` pass. The full verify runs on the
  pushed branch in GitHub CI.
- No visible windows, Electron launch, soak, or memory measurement.

## Review focus

Check nested unknown-field preservation after schema validation, the shared
live-state rules and error paths, the final-candidate fast path and exceptional
retry, and the record's bounds and version behavior.

## Dispatch and broadcast cost, round 3

Measured locally on Windows, Node v24.20.0, Intel Core i7-7700K at 4.20 GHz. The
baseline is round 2 (`83db76a4`); the after measurement uses this round's
implementation. Both use the same fixtures and timing loop in
`scripts/bench/liveAdmission.test.ts`, seven samples after two warm-up calls.
Each table value is the median of per-sample mean milliseconds per operation.

The typical service state has a two-line slide, background, one short message,
and three output keys, a 668-byte `{state}` JSON frame. The heavy legal state
has 200 messages, 512 notice images, 1,000 slide lines, and 200 canonical output
keys plus all four aliases. Every slide line and message has a distinct invented
prefix and is 3,000 characters long. Its frame is 3,699,811 bytes in both runs.

| State       | Operation                               | Round 2 ms | Round 3 ms |
| ----------- | --------------------------------------- | ---------: | ---------: |
| Typical     | Single dispatch                         |     0.0137 |     0.0088 |
| Typical     | 256-child batch                         |      2.613 |      0.094 |
| Typical     | Preload parser per broadcast per window |     0.0067 |     0.0030 |
| Heavy legal | Single dispatch                         |      8.922 |      5.901 |
| Heavy legal | 256-child batch                         |  2,261.477 |      5.848 |
| Heavy legal | Preload parser per broadcast per window |      7.854 |      0.379 |

Samples use 500 single-dispatch/parser calls and 10 batches for the typical
state; three single-dispatch/parser calls and one batch for the heavy state.
Each timed batch has 256 alternating `output.set` children that all change
state. The harness verifies the resulting version count so a rejected/no-op
dispatch cannot make the measured work disappear. The heavy batch sample range
was 2,223.438 to 2,462.128 ms before and 5.725 to 6.601 ms after. The final
after run was repeated after resolving the main schema conflict below.

The preload figure isolates the actual `parseLiveState` function called by
`live:changed` in each window. It excludes IPC cloning, renderer painting, and
macro compilation. These are short CPU measurements on the shared development
machine, not soak or memory measurements or an end-to-end frame-time guarantee.
Small timing differences between short operations are within shared-machine
variation; the large batch gain comes from removing repeated full-state work.

To rerun the after measurement in PowerShell:

```powershell
$env:LLP_LIVE_BENCH = '1'
$env:LLP_LIVE_BENCH_PHASE = 'round3-after'
npx vitest run --no-fsModuleCache scripts/bench/liveAdmission.test.ts
Remove-Item Env:LLP_LIVE_BENCH
Remove-Item Env:LLP_LIVE_BENCH_PHASE
```

The harness writes raw samples' summary to `.llp/data42-after-cost.json` (use
`round2-before` for the baseline file). The before run used the round 2 versions
of `liveLimits.ts`, `liveState.ts`, and `sliceRegistry.ts` in this worktree; the
round 3 copies were restored immediately afterwards.

## Follow-up order

Per the lead's 07:00 queue change, Look contracts move to output's O4 request
and media strip / left-column contracts to spec's S1b. Data's next request is
data-44, the close handshake end to end. Under the later user usage stop, this
request is the current stop point: data-44 is not started, and only findings on
data-42 will be answered before waiting for the lead.

## Round 2 reply

1. Removed the recovery-only field restrictions. Live commands, live state,
   active overlays, and the record now use the same named limits. State
   admission also checks cumulative outputs and serialized bytes, retains the
   last good history on rejection, and continues later batch commands. Boundary
   and integration regressions cover the requested caps and compatible alias
   keys. The contract tightening is committed with the `break` tag.
2. The spec 02 record-table nit is assigned to spec by the lead. This request
   does not change the spec table.

## Round 3 reply

Moved full-state admission to the top-level candidate, with child-by-child
validation only after a failed final check. Replaced serialization/encoding with
a main-only length upper bound and allocation-light UTF-8/JSON counting
fallback. Preload now validates the schema only. The measurements above cover
both states, both dispatch sizes, and per-broadcast preload parsing before and
after. Regressions also check nested macros, replayed plans and warnings, and
resync effects so the exceptional retry preserves behavior.

Rebased onto main's output-27 contracts, retaining the new optional
`LiveState.lookId` when resolving the schema-export conflict. Recovery tests
cover a valid Look id, null, an older record without it, and an invalid id.

## Reviewer

Pending.
