# M2 checkpoint notes

## Soak run 2: 20 minutes after output-15

**Failed.** The existing judge reports growing private memory in `main`, `gpu`,
and `output:main`. The control renderer and network utility are flat. Output
frame-rate samples are all 60 fps. There were no recorded relaunches, parser
problems, or app log warnings or errors.

### Build and method

- Tested local `main` snapshot `4bcba7b688516361646e1ab1734acda683b315aa`,
  version `0.12.0`, on October 25, 2026, after output-15 merged. The run was
  built in QA's worktree on the new `docs/qa/soak-2` branch. App and runner code
  were unchanged.
- Command: `npm run build`, then exactly one `npm run soak -- --minutes 20`, as
  described in [devops-13](../reviews/devops-13.md) and
  [devops-17, Soak run 1](../reviews/devops-17.md#soak-run-1).
- Recording ran from 16:50:27 to 17:10:27 KST. Including clip preparation, the
  runner ran from 16:50:18 to 17:10:28 KST. The app quit normally; the runner
  returned exit code 1 because the judge failed it.
- The runner generated the same specified 1920x1080 VP8 clip: 300 frames, 10
  seconds, 5,013,551 bytes. The scenario loops it on the main output and cycles
  through 12 invented slides, changing slides every 5 seconds.
- Every Electron launch used `LLP_TEST_WINDOWS=offscreen`. The runner removed
  every spelling of `NODE_OPTIONS`. No inspector, CDP, heap flags, forced GC, QA
  window wrapper, or runtime patch was used. No test window or dialog appeared.
  No heavy checks were run by this QA session during the recording.
- `TEMP` and `TMP` pointed to this worktree's ignored `.llp/qa/soak-2/`, so the
  runner's temporary user data, media, caches, record, and logs stayed inside
  this worktree.
- Two real displays were detected at 100% scale: primary 3440x1440 at (0, 0),
  secondary 1920x1080 at (3440, 222). Output status was `fullscreen` on the
  secondary display, while offscreen mode kept the window hidden.
- 119 valid samples, 10 seconds apart, cover 1,190,896 ms, or 19.848 minutes.
  The judge accepts this coverage within its 60-second tolerance. No record line
  was dropped, and each of the five processes kept one PID.

### Per-process result

Memory is from `app.getAppMetrics()`. Values below use the judge's KB/1024
conversion, labeled MiB. The rise is the judge's robust slope through the lowest
private-memory value in each window, rather than an endpoint average.

| Process                                | Judge   | Rise (MiB/h) | Sampled private peak (MiB) | Sampled working-set peak (MiB) | PID   |
| -------------------------------------- | ------- | ------------ | -------------------------- | ------------------------------ | ----- |
| `main`                                 | growing | +12.7        | 88.2                       | 118.4                          | 45728 |
| `gpu`                                  | growing | +16.4        | 449.4                      | 344.5                          | 47968 |
| `control`                              | flat    | -6.3         | 140.4                      | 274.3                          | 42432 |
| `output:main`                          | growing | +18.8        | 103.0                      | 181.9                          | 44916 |
| `utility:network.mojom.NetworkService` | flat    | +0.0         | 12.6                       | 48.3                           | 41380 |

These peaks are the maxima of the 10-second samples, including warm-up; they do
not capture every allocation between samples. Private and working-set peaks are
separate measurements and can occur at different times.

The unmodified 20-minute judge uses a 100-second warm-up, 12 equal windows, at
least 3 samples per window, and a growth limit of 4 MiB/h. A process is
`growing` only when the robust slope reaches that limit over both the full
judged period and its later half. All three growing processes meet that test.
The judge at the tested commit has no separate peak-memory gate.

The main process ranged from 77.7 to 88.2 MiB, with median 86.8 MiB. The
multi-gigabyte main-process swings from run 1 were absent from these samples
after output-15. The remaining failure is sustained growth under the existing
judge. GPU window minima rose from about 400 MiB to 408, 425, and 449 MiB in the
final windows. The output renderer's window minima rose from 94.0 to 102.2 MiB.

### Frame rates and limits

| Output | Median fps after warm-up | Lowest fps after warm-up | Below-target warning |
| ------ | ------------------------ | ------------------------ | -------------------- |
| `main` | 60.0                     | 60.0                     | No                   |

There were no renderer or process relaunches, no logged playback failures, and
no app warnings or errors. All five recorded processes ended after shutdown.

The frame rates are the output's meter in an offscreen run. They are an
observation and do not establish smooth visible playback on real monitors. The
current judge treats a median below 58 fps as a warning, separately from its
memory and restart failure gates.

This 20-minute run does not satisfy the 60-minute SK2 acceptance criterion. The
lead should route the three memory-growth results for investigation; no app fix
or further soak was attempted in this task. Run 1 used a different build and
display setup, so these results do not isolate the cause of each change from
that run.

### Record and logs

All paths are under
`D:\programming\2020-\pp\.claude\worktrees\qa\.llp\qa\soak-2\`:

| Evidence                                                  | Relative path                   |
| --------------------------------------------------------- | ------------------------------- |
| Raw record                                                | `llp-soak-Ws3Um0/soak.jsonl`    |
| App log                                                   | `llp-soak-Ws3Um0/logs/main.log` |
| Runner and app console log, including judge result        | `runner.log`                    |
| Exact command, tested commit, start/end, exit code        | `launch.json`                   |
| Parsed record, exact verdict, peaks, PIDs, media metadata | `analysis.json`                 |
| Judge text                                                | `judge.txt`                     |

Raw record SHA-256:
`b5d3559eb96a05ad29c46a27dbdfc9c03a379d7446142efc3a1d3c3c4e31ef52`. The parser
and judge results were saved from the tested source before the documentation
branch was rebased for review. Evidence remains local and is not committed.
