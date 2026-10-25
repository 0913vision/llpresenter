# M2 checkpoint notes

Latest result: [the 60-minute run 3](#soak-run-3-60-minutes-sk2-workload) fails
on GPU growth. All other processes are flat in the full assessment and the last
30 minutes. Run 2 remains below as historical evidence.

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

## Soak run 3: 60 minutes (SK2 workload)

**Failed on GPU memory growth.** The official 60-minute judge reports every
other process as flat. The separate last-30-minute assessment also reports GPU
growth. Main output fps has median and minimum 60 in both assessments. There
were no process relaunches, dropped record lines, or app warnings or errors.

### Build and method

- Tested local main snapshot `b7c61e3fd283b6ccba6f542bdad088bf1e436356`, version
  `0.12.0`.
- Recording ran on October 25, 2026, from 17:26:57 to 18:26:57 KST. Including
  clip preparation, the runner ran from 17:26:34 to 18:26:57. The app quit
  normally; the runner returned exit code 1 for the failed judgement.
- Built that snapshot, then ran exactly one `npm run soak -- --minutes 60`. The
  unchanged devops scenario loops a generated 5,013,551-byte, 1920x1080 VP8
  clip, 300 frames over 10 seconds, on the main output. It cycles through 12
  invented slides, changing slides every 5 seconds, as in run 2.
- Every launch used `LLP_TEST_WINDOWS=offscreen`. No inspector, CDP, forced GC,
  heap flags, QA window wrapper, or app patch was used. The runner removed every
  spelling of `NODE_OPTIONS`. This QA session ran no heavy checks during
  recording. Process-local `TEMP` and `TMP` kept all generated data under the
  ignored `.llp/qa/soak-3/` in this worktree.
- Two real monitors were detected at 100%: primary 3440x1440 at (0, 0),
  secondary 1920x1080 at (3440, 222). The main output had `fullscreen` placement
  on the secondary monitor while its window stayed offscreen.
- 359 valid 10-second samples cover 3,593,136 ms, or 59.886 minutes, within the
  judge's 60-second coverage tolerance. Each process has one unchanged PID
  across all samples.

The official judgement uses the unchanged 60-minute settings: 5-minute warm-up,
12 windows over minutes 5 to 60, at least 3 samples per window, and a 4 MiB/h
growth threshold. Rates are Theil-Sen slopes through each window's lowest
private-memory value, using KB/1024 as in the judge.

For the requested late assessment, select elapsed times from 30:00 to 60:00 and
subtract 30 minutes from their timestamps. Judge those 180 samples with zero
additional warm-up and six 5-minute windows, retaining the other thresholds. The
selected record covers 29.886 minutes. This supplementary assessment does not
change the official verdict. In each assessment, `growing` requires both the
selected-period slope and its later-half slope to reach 4 MiB/h.

### Full and last-30-minute trends

| Process                                | Official full judge | Full rise (MiB/h) | Last 30 judge | Last 30 rise (MiB/h) |
| -------------------------------------- | ------------------- | ----------------- | ------------- | -------------------- |
| `main`                                 | flat                | +2.38             | flat          | +0.86                |
| `gpu`                                  | growing             | +8.77             | growing       | +13.18               |
| `control`                              | flat                | +1.64             | flat          | -0.96                |
| `output:main`                          | flat                | +8.69             | flat          | +0.71                |
| `utility:network.mojom.NetworkService` | flat                | +0.00             | flat          | +0.00                |

The output renderer's positive full-period slope does not make it `growing`
under the existing rule because its later-half slope is below the threshold. Its
six late window minima are 99.93, 99.92, 99.94, 100.00, 100.12, and 100.17 MiB.
Main and output did not sustain above-threshold growth in the last 30 minutes of
this run.

GPU growth remains in the late assessment. Its six late window minima are
449.34, 452.63, 452.54, 452.60, 452.57, and 474.22 MiB. The first and last late
samples are 450.07 and 474.88 MiB, a 24.81 MiB endpoint increase. GPU stepped
from about 453 to 475 MiB near minute 52, so the remaining failure cannot be
attributed solely to initial warm-up. Its allocation-level cause and
normal-window behavior were not investigated in this task.

### Sampled peaks

Values are MiB. These are 10-second sampled maxima, including warm-up in the
full-run columns, rather than continuous allocation peaks.

| Process                                | Full private peak | Last 30 private peak | Full working-set peak | Last 30 working-set peak |
| -------------------------------------- | ----------------- | -------------------- | --------------------- | ------------------------ |
| `main`                                 | 87.4              | 87.4                 | 118.3                 | 118.3                    |
| `gpu`                                  | 474.9             | 474.9                | 349.2                 | 349.2                    |
| `control`                              | 137.0             | 133.6                | 273.1                 | 270.5                    |
| `output:main`                          | 101.1             | 101.1                | 185.6                 | 185.6                    |
| `utility:network.mojom.NetworkService` | 12.6              | 12.0                 | 48.3                  | 48.0                     |

Main ranged from 76.2 to 87.4 MiB across all samples. The earlier multi-gigabyte
main-process swing did not recur in these samples. The tested judge has no
separate peak-memory failure gate.

### Frame rates, cleanup, and scope

| Output and assessment            | Median fps | Lowest fps | Below-target warning |
| -------------------------------- | ---------- | ---------- | -------------------- |
| `main`, full judge after warm-up | 60.0       | 60.0       | No                   |
| `main`, last 30 minutes          | 60.0       | 60.0       | No                   |

PIDs were main 48224, GPU 38540, control 26944, output 49512, and network 50580.
No PID changed, and all five were gone after normal shutdown.

This is the requested SK2 memory workload and existing recorder. Fps values are
offscreen observations; visible stutter, stage output, independent frame
capture, and start/end DOM counters were not assessed. GPU growth keeps the
memory criterion open. No app code changed and no further run started. The lead
can route the GPU evidence for investigation.

### Record and logs

All paths are under
`D:\programming\2020-\pp\.claude\worktrees\qa\.llp\qa\soak-3\`:

| Evidence                                                       | Relative path                   |
| -------------------------------------------------------------- | ------------------------------- |
| Raw record                                                     | `llp-soak-bdbomO/soak.jsonl`    |
| App log                                                        | `llp-soak-bdbomO/logs/main.log` |
| Runner/app console and official verdict                        | `runner.log`                    |
| Command, tested commit, start/end, exit                        | `launch.json`                   |
| Both verdicts, options, peaks, endpoints, PIDs, media metadata | `analysis.json`                 |
| Original full judgement                                        | `judge.txt`                     |
| Supplementary last-30-minute judgement                         | `judge-last-30.txt`             |

Raw record SHA-256:
`a8b4a39089841d97fd7706b6c2795e071ee1ba6113730b255ba69313da00a651`. Both
assessments were extracted from the tested source before rebasing the
documentation branch. Raw evidence remains local and is not committed.
