# Review request: `output-15`

- Team member: `output`
- Branch: `fix/output/media-memory`
- Base commit (`main`): `da4aae7eed32eb13fb13712caf24d9773fc4c4fe`
- Code commit: `5c7edcc`
- Review range: `da4aae7...fix/output/media-memory`
- Related brief: `docs/briefs/output.md`, bug M2-5, and the lead's instruction
  to measure both candidates before fixing the cause.
- Shared contract changes: none.

## What changed and why

M2-5's large main-process memory swings come from the offscreen test windows'
bitmap frames. A 1920 x 1080 frame is 8,294,400 bytes (7.91 MiB). An animated
canvas reproduced the swing without making any media requests. Keeping the same
animation running with GPU shared textures removed the swing.

Offscreen control and output windows now request GPU shared textures. A shared
helper releases each texture synchronously in the `paint` listener and removes
that listener when the web contents are destroyed. Rendering and video playback
remain active. Normal windows keep their existing options and have no frame
listener.

The media handler stays unchanged. Its temporary probe counters, logging, and
timer were removed; they were uncommitted measurement code left before the power
loss. A new test checks that cancelling a partially read range destroys its Node
stream and closes its file without waiting for garbage collection. That test
also passes with the old handler.

## Measurements before the fix

All runs used the installed Electron 44.9.3, GPU acceleration, a hidden 1920 x
1080 offscreen window, a fresh process, and no inspector or heap flags. Runs
were sequential. Main private memory came from `app.getAppMetrics()` every 500
ms, converted from KiB to MiB. No forced GC was used. The video is the original
soak clip: 5,013,551 bytes, 1080p, 10 s.

The local harness and raw results are in this worktree's ignored `.llp/m2-5/`
folder. Every launch requires `LLP_TEST_WINDOWS=offscreen`, uses `show: false`,
and sets `webPreferences.offscreen` explicitly. Scripts passed `node --check`
before launch.

| Isolated scenario                                            | Time | Main private MiB min / median / max / last | Other observations                                                                                                     |
| ------------------------------------------------------------ | ---- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Animated canvas, bitmap frames                               | 24 s | 48.20 / 376.58 / 1226.27 / 479.81          | No media requests or streams; 1,435 paints, 11,902,464,000 cumulative bitmap bytes                                     |
| Same canvas, shared textures released immediately            | 24 s | 36.52 / 38.32 / 39.35 / 39.35              | No media requests; 1,414 paints, 1,414 releases; 1,415 animation callbacks                                             |
| Looping video, bitmap frames                                 | 24 s | 93.71 / 300.14 / 679.91 / 648.24           | 722 paints; 1 stream opened and closed; 5,013,551 file bytes read; 2 completed loops                                   |
| Same video, painting stopped to isolate the media path       | 24 s | 81.68 / 81.71 / 82.17 / 81.84              | No bitmap paints; 1 stream opened and closed; 2 completed loops; 724 decoded frames                                    |
| Same video, shared textures released immediately             | 24 s | 73.57 / 81.75 / 82.57 / 73.60              | 715 paints and releases; 1 stream opened and closed; 2 completed loops; 723 decoded frames                             |
| Twelve video loads interrupted after 100 ms, shared textures | 8 s  | 77.79 / 135.11 / 135.11 / 135.11           | 12 distinct URLs, 12 streams opened and closed, at most 1 live stream; 2 closed before EOF; 52,429,270 file bytes read |

The interruption run removed `src` and called `load()` on each video, with a
different query string to avoid a cache hit. All 12 interrupted loads finished
without a page error. Electron reported zero `request.signal` abort events, but
cancellation of the response body still closed the file streams. Missing
`request.signal` wiring therefore does not explain the measured large swings in
this scenario.

The canvas comparison isolates the bitmap allocation path from the media
protocol entirely. The matching video comparison retains the original
`createReadStream` and `Readable.toWeb` implementation and eliminates the large
peaks by changing only the offscreen frame transport and release.

Two exploratory interruption runs are excluded from the table: renderer `fetch`
was rejected before the protocol handler ran, and repeating the same video URL
mostly hit Chromium's cache. The final run used distinct video URLs.

Reproduce with the local harness from the output worktree:
`D:\programming\2020-\pp\.claude\worktrees\output`.

```text
node .llp/m2-5/run.mjs canvas bitmap
node .llp/m2-5/run.mjs canvas shared
node .llp/m2-5/run.mjs video bitmap
node .llp/m2-5/run.mjs video stopped
node .llp/m2-5/run.mjs video shared
node .llp/m2-5/run.mjs abort shared 8000
```

The harness uses the same streaming implementation as the handler, with counters
for opens, closes, and file bytes. It samples only sizes of bitmap images; it
never calls `toBitmap()` or makes another frame copy.

## Regression tests and actual app check

Before changing production code, the focused run had 4 failing tests and 45
passing tests. The failures detected bitmap options in the helper and both
window factories, and the absence of immediate texture release in the output
factory. After the fix the same 49 tests passed.

The window tests also check repeated frame release, release after output-page
reload, removal of the frame listener at destruction, a frame without a texture,
and normal-window behavior. The partial-range test observes the real Node file
stream: it is destroyed on reader cancellation, emits `close`, and has a null
file descriptor. No production injection point was added.

Before rebasing, the built app ran offscreen for 30 s with the same clip, output
enabled, and slide changes every 5 s, then exited normally. The recorder's two
samples at 10 and 20 s put main private memory at 79.32 and 79.78 MiB. Both
output frame-rate readings were 60. These two samples are a wiring check, not a
peak measurement. The raw record is `.llp/m2-5/app-data/soak.jsonl`, and the app
log is `.llp/m2-5/app-run.log`.

## Changed files

- `src/main/windows/testWindows.ts`: shared-texture options and immediate
  release helper.
- `src/main/windows/control.ts`, `src/main/outputs/electronWindow.ts`: install
  the helper before loading either page.
- `src/main/windows/testWindows.test.ts`, `control.test.ts`, and
  `src/main/outputs/electronWindow.test.ts`: window configuration, frame
  lifetime, and normal-window coverage.
- `src/main/windows/mediaResponse.test.ts`: partial-response cancellation and
  file-handle closure.
- This review document.

## Checks run

| Command or test                                     | Result                                                |
| --------------------------------------------------- | ----------------------------------------------------- |
| Focused old-code regression run, 4 files, 2 workers | Expected failure: 4 failed, 45 passed                 |
| Same focused run after fix                          | Pass: 49 tests                                        |
| Scoped output tests, 2 workers                      | Pass: 34 files, 327 tests                             |
| `npm run typecheck`                                 | Pass                                                  |
| ESLint on changed TypeScript files                  | Pass                                                  |
| `npm run build`                                     | Pass                                                  |
| `npm run format`                                    | Pass; no changes outside output's owned files         |
| `npm run format:check`                              | Pass, including in full verification                  |
| `npm run verify`                                    | Pass: 5 steps in 111.6 s; one invocation after rebase |

The restart check before implementation passed 272 tests but could not start
four renderer workers. The scoped run above used two workers and completed all
34 files. The single full verification above includes the rebased code.

Full verification timings: typecheck 4.7 s, lint 81.7 s, format check 7.4 s,
coverage tests 111.6 s, and build 4.6 s. No step failed or needed a manual
rerun. The only subsequent changes are this review's result recording and
formatting. Raw verification output: `.llp/m2-5/verify.log`.

Rebased once onto `da4aae7`. Resolved the output window test-double conflict by
keeping main's ping and crash methods on an `EventEmitter`, so both the existing
hang-handling tests and the new frame-lifetime tests run. The focused run after
rebase passed all 52 tests in four files.

## Decisions and limits

- Fix the measured frame transport issue and retain the media protocol. The
  stream cancellation test guards its observed behavior.
- Use the existing Electron shared-texture API and release unused textures; add
  no dependencies, disable no hardware acceleration, and keep rendering active.
  Electron documents the bitmap copy cost in its
  [offscreen rendering guide](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering)
  and the required prompt release in
  [OffscreenSharedTexture](https://www.electronjs.org/docs/latest/api/structures/offscreen-shared-texture).
- These short runs establish the cause and check the fix on this Windows
  machine. They do not replace devops's longer rerun or QA's 60-minute check on
  real monitors. An offscreen frame rate does not establish visible playback
  quality.
- M3-O0 remains parked. Stop after this review request.

## Quality checklist

- [x] `npm run verify` passes and the format check passes.
- [x] The regression tests fail on the old code and pass after the fix.
- [x] Registered frame listeners are removed; textures are released at once.
- [x] No shared contracts, external input handling, caches, UI, or normal output
      behavior change.
- [x] No new dependencies, unsafe type assertions, `any`, or non-null
      assertions.
- [x] Changes stay within output's ownership and measured M2-5 scope.

## Where to look

Check the measurement table first, then `windowTestOptions` and
`discardTestFrames`, and their calls in both window factories. Check that each
paint releases its texture before the next paint, including after a reload, and
that destruction removes the listener.

## Review: lead

- Verdict: pending
- Findings:

## Review: reviewer

- Verdict: pending
- Findings:

## Team member's reply

None yet.
