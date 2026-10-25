# Review request: data-33

- Team member: data
- Branch: `feat/data/service-open`
- Base: `b6a230425591b954c097a367a65c4cbc7cd64cfa` (`main`)
- Review range: `b6a2304...feat/data/service-open`
- Request: `.llp/task.md`, "After data-32 (from the lead, 01:45)".
- Final commit and final HEAD CI URL/result accompany the review request.

## What changed and why

`LlpApi.service.open({serviceId: ServiceId})` invokes the checked `service:open`
channel and returns the chosen `ShowService`, or null when the switch fails.
Unknown IDs and malformed requests keep the current service. The preload checks
both the request and reply, including that a nonnull reply names the requested
service. The fake API returns null when no service library is provided.

Opening serializes with content edits, saves the current editable service
through the M2 atomic saver and recovery copies, pushes its document, and
refreshes its current projection before changing the active ID. A failed save
keeps the old service and unsaved memory, logs the failure, and returns null.
Pending saves of the current file are folded into this explicit save; a failed
pending write is not silently retried into a successful switch. Read-only
current files are never overwritten and do not prevent opening another service.

After a successful switch, the existing single `app.json` writer sets and
flushes `lastServiceId`, preserving UI and unknown fields, and the open-service
feed pushes the chosen projection. Its source ID and the current-service
deletion guard now follow the active service. Outputs and live layers are
untouched. Existing broken/newer `app.json` protection stays in effect. An
unexpected failure to remember the choice is logged; the reply still describes
the service that actually opened.

The channel serializes the complete switch, including persistence and
projection, so simultaneous callers receive their own selected service. At most
16 admitted switches can be pending; overflow is logged and returns null.
Shutdown removes handlers immediately and finishes accepted switches before
disposing the feed.

## Data-32 performance nit

The previous rename held the content-edit queue across every song write. Measure
1,000 generated songs with two invented slides each, existing files, actual
atomic writes, and recovery copies. Queue a new song creation immediately after
requesting the rename. On this Windows host with Node v24.20.0:

| Measurement                            | Previous implementation | This change |
| -------------------------------------- | ----------------------: | ----------: |
| Rename reply, waiting for save results |                8,730 ms |    5,162 ms |
| Following edit completed               |                8,742 ms |       31 ms |
| All writes completed                   |                8,743 ms |    5,162 ms |

These are single before/after samples, with no-op event consumers, not an output
or UI benchmark. Disk totals depend on load. The queue release is also covered
by a deterministic held-write regression, separate from the timing evidence.

Labels still save first. The rename then queues songs in ID order through the
existing autosave and persistence paths, with memory and revisions already
updated. Its reply continues waiting for actual outcomes outside the
content-edit queue, preserving partial-failure reporting. Other edits can
proceed while those saves run. Pending writes coalesce per file and read the
latest document, so a newer edit wins and a deleted song is not recreated by a
queued callback. `flush` waits for queued work and retries failed files as
before.

The reusable pending-save tracker shares one callback and outcome per waiting
file. Explicit current-service saves take over that file's pending callers and
wait only for its running save, leaving unrelated song saves alone. Shutdown
releases timers and pending callers. The measurement test writes current-run
evidence to `coverage/label-rename-budget.json`; the recorded baseline and
updated local artifacts are `.llp/data33-label-baseline.json` and
`.llp/data33-label-after.json`.

## Changed files

- `src/shared/schema/serviceOpen.ts` and `serviceOpen.test.ts`: branded request
  and matched reply validation.
- `src/shared/ipc.ts`, `src/preload/index.ts`, `index.test.ts`, and
  `src/shared/testing/fakeLlpApi.ts` / `fakeLlpApi.test.ts`: typed API, checked
  calls, malformed/mismatched reply tests, and fake support.
- `src/main/store/serviceChannels.ts`, `serviceChannels.test.ts`: serialized
  switching, failure, read-only, queue-cap, concurrency, and lifetime behavior.
- `src/main/store/register.ts`, `register.test.ts`: main wiring, dynamic feed,
  actual disk/restart, failed pending save, UI-field preservation, and no live
  output change.
- `src/main/store/contentStore.ts`: active service, current-file save, dynamic
  delete guard, and bulk rename preparation separated from disk completion.
- `src/main/store/queuedSaves.ts`, `queuedSaves.test.ts`, `autosave.ts`, and
  `autosave.test.ts`: shared pending outcomes, explicit-save transfer, per-file
  waiting/cancellation, failure/close handling, and held-write coverage.
- `src/main/store/labelRename.test.ts`, `labelRename.performance.test.ts`:
  subsequent edit/delete regressions and the requested 1,000-song measurement.
- `docs/reviews/data-33.md`.

## Checks run

| Check                                                         | Result                                          |
| ------------------------------------------------------------- | ----------------------------------------------- |
| `npm run typecheck`                                           | Passed                                          |
| Final targeted store, settings, API, preload, and fake Vitest | 10 files, 159 tests passed                      |
| Real-file 1,000-song measurement and rename regression run    | Four files, 49 tests passed                     |
| ESLint on changed TypeScript files                            | Passed                                          |
| `npm run format` and `git diff --check`                       | Passed                                          |
| Rebase onto latest main                                       | Passed without conflicts                        |
| Local full verify                                             | Not run, per lead instruction                   |
| GitHub full verification                                      | Final HEAD URL and result accompany the request |

No visible windows, dialogs, soak, memory measurements, or dependency installs
were started. New test text is invented.

## Where to look

`registerServiceChannels` keeps whole switches ordered.
`ContentStore.openService` preserves the previous selection when saving fails.
`prepareLabelRename` releases the edit queue after scheduling, and `QueuedSaves`
reads the newest per-file work when a save starts. The real-disk register test
checks the remembered service after restart, and the held-write rename test
checks that later edits remain usable.

## Verdicts (recorded by the lead at merge)

- Round 1 (d9a447e): reviewer (Claude, trial-97) Approve with no findings. The
  data-32 nit is fixed: a rename touching 1,000 songs holds the edit queue 31 ms
  instead of 8.74 s, with real write results and the labels-first
  partial-failure report kept. Lead Approve. Written by the Codex session that
  took over data's work. Rebased by the lead onto local `main` without
  conflicts.

## Team member's reply

Pending review.
