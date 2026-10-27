# M2 checkpoint notes

Latest HDMI result: **Partial.** The
[morning recheck after output-21](#morning-hdmi-recheck-after-output-21) records
non-topmost placement directly behind control, preserved playback/PIDs, and
automatic BenQ full screen with always on top restored. Behind-control retention
is **Pass** under the lead's reading: place the fallback directly behind control
and never raise it afterwards; adjacency after the operator's own window
switching is not required. The immediate callback path is **Partial** because
the topmost-change event precedes the recorded callback and does not establish
its cause. Work-area centering is **Fail**, 31 DIP left (M2-9). Spec 03 steps 2
and 3 and the reconnect notification are **Not checked**.

Earlier results:
[the real-monitor run 4](#run-4-60-minutes-on-the-real-benq-monitor) also fails
on GPU private-memory growth. Native GPU dedicated-memory counters rise as well.
The dedicated force-quit/restart check passes. The app's exit at the end of the
hour was caused by QA's tool cleanup, not an observed app crash. The
[physical HDMI follow-up](#physical-hdmi-unplug-and-reconnect-follow-up) passes
spec 03 step 1 and the return to full screen, with a control-window overlap
observation. Steps 2 and 3 and the reconnect notification were not checked; the
notification host is not in M2. Runs 2 and 3 remain historical evidence.

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

All paths are under `<qa worktree>\.llp\qa\soak-2\`:

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

All paths are under `<qa worktree>\.llp\qa\soak-3\`:

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

## Run 4: 60 minutes on the real BenQ monitor

**M2-8 reproduces with a visible output window.** The unchanged app judge finds
GPU private-memory growth of +10.26 MiB/h overall and +8.69 MiB/h in the last 30
minutes. Every other recorded process is flat under the app judge. The GPU
process's native private bytes also rise late (+13.06 MiB/h OLS), as do its
dedicated-memory counters (+30.71 MiB/h). The memory acceptance criterion
remains open; this result does not establish the allocation-level cause.

**The QA tool killed the app at 12:48:20.210Z, exit code 4294967295.** Its
end-of-run metadata serialization failed, entering its cleanup path, which ran
`Stop-Process -Force` on main PID 49240 and any surviving owned children. This
was the close the user saw after the hour. It was not a spontaneous app exit.
The separate, deliberately repeated force-quit check below passes.

### Build, visible output, and measurement

- Tested main `51b9e625498241d3ae3ea63a4d56abb47f527bb7`, version `0.13.0`, on
  October 25, 2026. Cloned `<main checkout>` to the explicitly authorized
  `<m2-run folder>`; `npm ci` and `npm run build` passed there. No app source or
  built output was patched. The documentation branch was later rebased
  independently; it is not the runtime snapshot.
- User-authorized visible run: 20:48:16 to 21:48:20 KST (`11:48:16.478Z` to
  `12:48:20.210Z`). The original 1920x1080, 300-frame, 10-second VP8 soak clip
  is 5,013,551 bytes. The unchanged scenario changes among 12 invented slides
  every 5 seconds.
- Used `soakEnvironment` from `scripts/soak/run.mts`, removed
  `LLP_TEST_WINDOWS`, and launched the real built app directly. There was no
  inspector, CDP, heap flag, forced GC, or offscreen mode during measurement.
  `LLP_SOAK_EXIT_MS=3900000` was a 65-minute safety exit; the tool killed the
  app earlier after the measured hour. Helpers were hidden.
- The native output window was visible, without a caption, at
  `(3440, 222, 1920, 1080)` in all 121 checks, matching the right BenQ GW2780 in
  the app's display log. Primary was TFG34Q14WQ, 3440x1440. Both had scale
  factor 1. Start, midpoint, and endpoint captures show the lyrics and video.
- Initial tool limitation: the launcher's `windowsHide` setting suppressed the
  control window's first show. The output was already visible. At
  `12:01:15.833Z`, elapsed 12:59, QA used `ShowWindow(SW_SHOWNA)` on its own
  control window without activation. Both windows were visible thereafter; the
  last 30 minutes therefore exclude this initial condition. This event is
  recorded in `control-show.json` and was not an app restart or source patch.
- The user was allowed to Alt Tab and do light work. Foreground belonged to
  another process in 120 of 121 snapshots. Other app names and content were not
  collected. This was a realistic desktop-use condition, not an isolated idle
  machine. QA ran no full local verify during the hour.
- PowerShell sampled the run's Electron process tree every 30 seconds:
  `Get-CimInstance Win32_Process` identified ownership, `Get-Process` supplied
  `PrivateMemorySize64` and `WorkingSet64`, and `Get-Counter` supplied GPU
  dedicated/shared bytes. PID roles came from the app record, without attaching
  a debugger. There are 605 CSV rows over 121 times, with one unchanged PID per
  role and no missing GPU-process counter samples.
- The app recorded 360 valid samples through 3,602,765 ms after recorder start.
  The fixed 0-to-60-minute judgement selects 359 samples through 3,592,759 ms,
  within the official 60-second tolerance; no line was dropped. The last-30
  selection has 180 samples: the first is at 1,801,464 ms and the last at
  3,592,759 ms in the original record. Relative to the 30-minute boundary, their
  offsets are +1,464 ms and +1,792,759 ms. The actual first-to-last sampled span
  is 1,791,295 ms; the judge's 1,792,759 ms coverage is the last offset from the
  boundary, not that sampled span.

### App judge and frame-rate result

Used the tested `scripts/soak/judge.mts` through the unchanged CLI:
`node scripts/soak/run.mts --judge .llp/real-run/soak-60min.jsonl --minutes 60`.
It exits 1 for GPU growth. The default judgement excludes 5 minutes of warm-up,
uses 12 windows, and applies the 4 MiB/h threshold to robust slopes through
window minima over both the selected period and its later half. The last-30
assessment uses six 5-minute windows and no additional warm-up, as in run 3.

| Process                                | PID   | Full judge | Full rise (MiB/h) | Last 30 judge | Last 30 rise (MiB/h) |
| -------------------------------------- | ----- | ---------- | ----------------- | ------------- | -------------------- |
| `main`                                 | 49240 | flat       | +2.48             | flat          | +2.07                |
| `gpu`                                  | 44204 | growing    | +10.26            | growing       | +8.69                |
| `control`                              | 53768 | flat       | -0.19             | flat          | +0.03                |
| `output:main`                          | 30116 | flat       | +1.05             | flat          | +1.58                |
| `utility:network.mojom.NetworkService` | 52368 | flat       | +0.00             | flat          | +0.00                |

GPU's last six minima are 286.21, 289.75, 291.07, 287.13, 289.38, and 291.47
MiB. The last-30 judgement still classifies it as growing over both halves; the
result is not based on the final endpoint alone.

| Output period       | Median app fps | Lowest app fps | Relaunches |
| ------------------- | -------------- | -------------- | ---------- |
| Full, after warm-up | 144            | 143            | 0          |
| Last 30 minutes     | 144            | 144            | 0          |

**Observation for output:** the app's per-screen fps meter showed 144 while the
BenQ ran at 60 Hz. The meter followed the primary display's cadence in this run,
so the status-bar fps for the BenQ output is misleading. Route this observation
to output; no meter fix was attempted. These `requestAnimationFrame` counts are
not an independent scan-out or video-frame-drop measurement. The captures
confirm visible output at the three checkpoints; they do not establish a
continuous human assessment of stutter.

### Native process trends and sampled peaks

Units are MiB (`bytes / 1048576`) and MiB/h. Unlike the app judge, the native
tables use an ordinary least-squares fit through all 121 raw samples over the
hour, including startup, and the 61 samples from minute 30 through 60. Peaks
include startup and are sampled maxima, not continuous allocation peaks.

| Process                                | Private full rise | Private last 30 rise | Private peak | Working set full rise | Working set last 30 rise | Working set peak |
| -------------------------------------- | ----------------- | -------------------- | ------------ | --------------------- | ------------------------ | ---------------- |
| `main`                                 | +1.22             | +1.60                | 97.61        | -24.79                | -41.21                   | 125.98           |
| `gpu`                                  | +2.94             | +13.06               | 343.02       | -84.00                | -124.81                  | 330.29           |
| `control`                              | +0.61             | -2.92                | 141.14       | -44.97                | -62.00                   | 266.27           |
| `output:main`                          | +2.23             | +1.01                | 102.29       | -32.15                | -57.04                   | 180.68           |
| `utility:network.mojom.NetworkService` | -0.08             | +0.00                | 12.51        | -7.83                 | -14.06                   | 48.20            |

The app's finer 10-second private-memory peaks are main 98.08, GPU 346.24,
control 141.31, output 102.73, and utility 12.51 MiB. Main's earlier
multi-gigabyte swing did not recur.

### Native GPU memory counters

Read `\GPU Process Memory(pid_<id>*)\Dedicated Usage` and `Shared Usage`,
summing valid per-adapter instances for each owned PID. GPU PID 44204 had
counter data in every system sample. Other Electron PIDs had no matching
instances, reported as unavailable rather than zero. Raw adapter instances and
values are preserved in `gpu-counters.jsonl`.

| GPU PID 44204 counter | Full rise (MiB/h) | Last 30 rise (MiB/h) | Full peak (MiB) | Last 30 peak (MiB) |
| --------------------- | ----------------- | -------------------- | --------------- | ------------------ |
| Dedicated Usage       | +13.50            | +30.71               | 232.10          | 210.51             |
| Shared Usage          | +1.42             | +1.19                | 48.27           | 48.27              |

As a supplementary robust check on the raw native samples, Theil-Sen slopes for
GPU private bytes are +6.63/+8.64 MiB/h over full/last 30 minutes; dedicated
usage is +19.11/+24.97, and shared usage is +0.80/+0.87. Thus the
process-private growth in M2-8 is observed with a real window, with a rising
dedicated-memory trend as well. The falling working set does not mean private
commit or GPU allocations are flat. The counters fluctuate and do not alone
prove a specific leak mechanism. Hardware was NVIDIA GeForce RTX 4060 Ti, driver
32.0.15.6094, with Intel HD Graphics 630 also listed.

### The tool-caused close and separate force-quit check

The hour's close must not be reported as an app crash. After the final sample,
the PowerShell helper tried to serialize a Hashtable with integer PID keys.
`ConvertTo-Json` rejected it; the helper's `catch` then force-stopped the app.
`app-exit.json` records code **4294967295 at 12:48:20.210Z** and
`monitor-exit.json` records the helper's failure. The last app sample precedes
that close and covers more than 60 minutes.

`soak-main-before-exit.log` preserves all eight app-log lines before subsequent
launches. They are all INFO. There are **zero error, warning, crash,
renderer-gone, or child-process-gone entries before the exit**. Its last line is
`11:48:17.301Z INFO skipped the launch backup`, reason `output-on`. The file
SHA-256 is `71622aa8dbbe9209a3512663fa79fe90500053b96d2d917f09c057c875ad44e9`.
`exit-audit.json` records the scan and the tool-cleanup cause.

Per the lead's follow-up, QA then made one dedicated, baseline-before-kill
force-quit check using the same data folder:

1. Rewrote and syntax-checked `hash-data.mjs`. Restarted the app without soak
   variables; the same `샘플 주일 예배` opened with three songs and two section
   headers, empty live layers, and outputs off.
2. At `12:53:15.806Z`, hashed nine content files: three songs, one service,
   media/label JSON, and three media files. Recorded `app.json`'s
   `lastServiceId` separately; UI-state changes are not content corruption.
3. Clicked a sample slide, turned main output on, and verified a visible normal
   full-screen window on the BenQ. At `12:53:18.447Z`, deliberately used
   `Stop-Process -Force` on main PID 56452 and its owned process tree. All five
   owned processes ended; exit was 4294967295 at `12:53:18.539Z`.
4. Restarted from the same folder. The same service opened, outputs were off,
   and the live layers were empty. At `12:53:20.417Z`, all nine content hashes
   and `lastServiceId` matched. The final app closed normally, exit 0.

**M2 clean-restart/data-integrity check: pass.** The recovery dialog remains M3
scope. An initial preparation assertion incorrectly counted section headers as
selectable song rows; that helper-only error was corrected before the dedicated
baseline/output-on/force/restart sequence. Its evidence is retained. All clone
Electron processes were checked gone afterwards. No monitor unplug was attempted
during run 4; the subsequent physical check is recorded below.

### Evidence paths

All paths are local under `<m2-run folder>\.llp\real-run\`, outside team
worktrees and excluded from Git:

| Evidence                                       | Relative path                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| System CSV, 605 rows                           | `system-samples.csv`                                                           |
| Original app record, 360 lines                 | `soak.jsonl`                                                                   |
| Fixed 60-minute selection, 359 lines           | `soak-60min.jsonl`                                                             |
| Both judgements, native fits, peaks, hashes    | `analysis.json`, `judge.txt`, `judge-last30.txt`                               |
| Per-adapter GPU counter samples                | `gpu-counters.jsonl`                                                           |
| Native window checks and three output captures | `windows.jsonl`, `output-1.png`, `output-60.png`, `output-120.png`             |
| Launch, monitor topology, control-show event   | `launch.json`, `topology.json`, `control-show.json`                            |
| Tool failure and exact exit                    | `monitor-failure.txt`, `app-exit.json`, `monitor-exit.json`, `exit-audit.json` |
| Preserved pre-exit app log                     | `soak-main-before-exit.log`                                                    |
| Dedicated force-quit result and kill metadata  | `force-check-results.json`, `force-check-kill.json`                            |
| Fresh before/after content hashes              | `force-data-before.json`, `force-data-after.json`                              |

Original record SHA-256:
`6b8ad2c5ab997ce9ae4195c19f80fdded65352584be8faa0c9a5855053ee6665`. System CSV
SHA-256: `9773e15026a2cecdefbaab6599fbaf46f261c63ff1e906db7bffbc25e29f9086`.

## Physical HDMI unplug and reconnect follow-up

**Spec 03 step 1 and the return to full screen pass.** Steps 2 and 3 and the
reconnect notification were not checked; the notification host is not in M2. The
same output and renderer moved to a 960x540 window on the primary monitor when
the BenQ disappeared, and returned automatically to BenQ full screen when it
reconnected. All five Electron PIDs stayed unchanged. There was no crash or
error. **Operator-window overlap was observed**, including a brief topmost
output on the primary monitor before the smaller fallback window settled.

### Setup and method

- Same built clone and runtime snapshot as run 4: main `51b9e62`, version
  `0.13.0`, `<m2-run folder>`, and the same `.llp/real-run/user-data` folder. No
  soak variables were set. The user explicitly authorized visible app windows
  and physically removed/reinserted the HDMI cable; QA did not simulate display
  removal.
- `샘플 주일 예배` was open, with the first slide of `새벽을 여는 노래` over its
  12-second looping video. Control was visible at `(760, 180, 1920, 1080)` on
  TFG34Q14WQ; output was visible/full screen at `(3440, 222, 1920, 1080)` on
  BenQ GW2780. Ready was confirmed at `13:09:13.202Z` before the user acted.
- Hidden recorders targeted one-second intervals. There are 737 app/inspector
  snapshots and 737 independent native window snapshots. They record window
  bounds, visibility, assigned monitor, process PIDs, video state/time, live
  content, display events, and new app log lines. Inspector access was only for
  this functional follow-up, not the memory run.
- The lead reported the physical unplug at 22:15:51 KST and reconnection at
  22:18:41. Recorded OS events occurred earlier than these message markers:
  `13:15:30.174Z` removed and `13:18:29.323Z` added. Timing below uses the
  recorded events, not an assumed exact match to the lead's reported clock. The
  detected disconnected interval was 179.149 seconds.
- Recording continued through `13:21:27.205Z`, more than 60 seconds after
  reconnection. The app closed normally at `13:21:28.507Z`, exit 0; the native
  recorder exited 0 at `13:21:29.143Z`. No clone Electron or recorder process
  remained afterwards.

### Spec 03 checks

Source:
[When a monitor disconnects during output](../spec/03-output.md#when-a-monitor-disconnects-during-output).

| Check                                                   | Observed result                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Move the same output to a window on the control monitor | Pass. Window ID 2 and renderer PID 54948 remained. First sampled stable fallback was `13:15:31.201Z`, 1.027 s after the recorded removal, at `(2480, 492, 960, 540)` on the primary monitor. It was visible, not full screen, not topmost, and not focused.                                                                                                                                |
| Keep lyrics and video playback                          | Pass in the samples. Lyrics, slide identity, media ID, `outputs.main=true`, and media `startedAt=1792933751169` stayed unchanged after ready. All 735 post-ready samples had an active, unpaused decoded video with no media error. There were no repeated adjacent video times during the detected disconnect; normal 12-second wraps continued.                                          |
| Return to full screen on the same BenQ                  | Pass. Display ID 1102585166 returned. The app logged its updated monitor list at `13:18:29.644Z` and full-screen status at `13:18:29.788Z`, a 0.144 s status transition.                                                                                                                                                                                                                   |
| Verify the actual returned window and delay             | First app snapshot beginning after the display-added event verified BenQ full screen at `13:18:30.221Z`, 0.898 s after that event. The first independent native snapshot after the event verified the same full 1920x1080 bounds at `13:18:30.580Z`, 1.257 s after it. Treat visible recovery as confirmed within about 1.3 s of recorded detection, not a subsecond scan-out measurement. |
| Crash, renderer loss, or unexpected error               | None recorded. One expected warning at `13:15:31.055Z`: `output monitor missing`, status `monitorMissing`. No ERROR/FATAL/crash/renderer-gone/child-process-gone or recorder-error entry occurred.                                                                                                                                                                                         |
| Preserve processes                                      | Pass. Main 55944, GPU 55052, control renderer 57116, output renderer 54948, network utility 23596 before and after. The same PID set appears throughout post-ready recording.                                                                                                                                                                                                              |

The following spec 03 UI requirements remain **not checked**:

- Step 2: amber toolbar button/dot and icon, monitor-missing status-bar text,
  and amber preview outline.
- Step 3: warning notification, including its detail text and the
  `모니터 다시 찾기` and `창 보기` actions.
- Reconnect notification: conversion to the information notification and
  automatic close after 6 seconds.

The notification host is outside M2. The recorded monitor-missing log warning
does not establish that these UI requirements were checked.

The longest app-record interval was 3.170 seconds during display
reconfiguration, despite the nominal one-second schedule. Video time advanced
and no reset or paused state was observed, but these samples cannot rule out a
short visual stutter or flash inside a sampling gap.

### Control-window overlap

At `13:15:30.204Z`, before the 960x540 fallback settled, the output was sampled
on the primary monitor at `(0, 0, 1920, 1080)`, still full screen and topmost.
The native snapshot at `13:15:30.254Z` confirms those bounds, while control
remained visible at native outer bounds `(752, 180, 1936, 1088)`. Their
intersection was 1,051,200 pixels. Thus a topmost output temporarily covered a
large portion of control for approximately one sampled interval.

The stable fallback also intersected the control window's right edge: 200x540
pixels using Electron bounds, or 208x540 (112,320 pixels) using native outer
bounds. It remained non-topmost and unfocused. The recorder's
`WindowsInNativeZOrder` field contains native enumeration order, not an
additional independently measured stacking/occlusion check. Persistent fallback
overlap is established geometrically; its exact pixel occlusion was not
captured. This operator-UI observation should be reviewed separately from the
successful content/playback recovery. No placement fix was attempted.

### Evidence

Local evidence is under `<m2-run folder>\.llp\unplug\`:

| Evidence                                                                       | Relative path                                                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Per-second app windows, monitors, PIDs, playback, live state and log additions | `record.jsonl`                                                |
| Independent native windows and overlap rectangles                              | `native-windows.jsonl`                                        |
| Parsed phases, measured delays, playback and PID checks                        | `analysis.json`                                               |
| App log lines for this run, including removal, warning, and restored output    | `app-events.log`, `app-console.log`                           |
| Human-reported cable times and readiness                                       | `lead-markers.jsonl`, `ready.json`                            |
| Normal exit and recorder shutdown                                              | `app-exit.json`, `native-exit.json`, `recorder-finished.json` |

App record SHA-256:
`8c8e9cf0cb96c77f7a2ebbe3d4a162cf94c91b7e5824202a04fd153faa8cea51`. Native
record SHA-256:
`cbd186dc1fad97d962ad453c879199989b7b327c610d023b4b8173e09b5bb9cd`.

## Morning HDMI recheck after output-21

**Partial.** On the October 26 morning recheck, the output was non-topmost and
directly behind control before the settled monitor-list log, then became a
960x540 window. It kept the same lyrics, looping video, windows, and five
Electron PIDs. Reconnection restored BenQ full screen and always on top,
independently confirmed within about 3.1 seconds of the recorded display-added
event. Behind-control retention is Pass under the lead's reading below.
Work-area centering is Fail (M2-9), with the stable fallback 31 DIP left of the
current center. The immediate callback path is Partial: earlier window events
prevent attributing the topmost drop to that callback. UI steps 2 and 3 and the
reconnect notification are Not checked.

### Build, scenario, and recording

- Tested exactly `3d8a38b406d1870072babff416e4e2a6bc9ee06f` (output-21 merged),
  app version `0.13.0`, built with `npm ci` and `npm run build` in
  `<m2-run folder>`. The clone stayed detached at that commit. Eleven built file
  hashes were checked before launch; no app source or built code was patched.
  The newer documentation branch base is not the tested app build.
- Same data folder: `<m2-run folder>\.llp\real-run\user-data`. `샘플 주일 예배`
  was open with the first slide of `새벽을 여는 노래` and its 1280x720,
  12-second looping background video. The user authorized visible windows and
  physically unplugged/replugged HDMI. No display simulation, soak, or memory
  measurements were performed.
- At readiness (`20:09:22.183Z`, 05:09:22 KST), control was on the primary
  TFG34Q14WQ at Electron bounds `(791, 180, 1920, 1080)`, native outer bounds
  `(783, 180, 1936, 1088)`. BenQ GW2780 output was full screen at
  `(3440, 222, 1920, 1080)`, always on top and not focused. Both displays used
  scale factor 1.
- Hidden recorders collected 561 app snapshots (560 with both windows) and 566
  native snapshots at a nominal 1 s interval. Native ordering uses
  `GetWindow(GW_HWNDPREV)` and checks both the immediate predecessor and the
  nearest visible, nonminimized predecessor against control. Enumeration order
  alone is not used to infer stacking. Native bounds, work area, topmost flag,
  foreground state, overlap, PIDs, and the app's playback/log were recorded.
- Human-reported cable times were 05:15:10 and 05:16:56 KST. Recorded Electron
  events were earlier: removed at `20:14:40.510Z` and added at `20:16:53.167Z`
  on October 25 UTC (05:14:40.510 and 05:16:53.167 KST on October 26). Timing
  below uses these event observations; their separation was 132.657 s.
- App recording ended at `20:18:40.186Z`, about 107 s after display-added and 75
  s after the lead's reconnect message was received. An explicit stop file
  requested the normal control-window close. App exit was 0 at `20:18:47.776Z`;
  native recorder exit was 0 at `20:18:48.103Z`. A subsequent process check
  found no clone Electron process or original recorder remaining.

### Spec 03 after spec-20 and the lead's expected behavior

Source:
[monitor disconnect behavior](../spec/03-output.md#when-a-monitor-disconnects-during-output).
The lead's expected behavior for this recheck was:

> On the unplug, the output leaves always on top and sits directly behind the
> control window at once; it becomes a 960 x 540 window centered on the control
> monitor's work area; on the replug it returns to full screen on the BenQ with
> always on top on again.

The lead clarified the meaning of "keep" for round 2:

> The app places the fallback directly behind the control window and never
> raises it afterwards; adjacency after the operator's own window switching is
> not required.

Result labels: Pass, Fail, Partial, Not checked.

| Expectation                                                                                                                                            | Result      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drop always on top and place directly behind control on the removal callback, before monitor-list settle, without activating either window             | Partial     | Native sample `20:14:40.661Z` to `20:14:40.789Z`, before the settled-list log at `20:14:40.834Z`, confirms non-topmost output directly behind control, with neither app window foreground. However, move at `20:14:39.234Z`, resize at `20:14:39.326Z`, and always-on-top-changed at `20:14:39.330Z` precede the recorded display-removed callback at `20:14:40.510Z`. The evidence does not attribute the topmost drop to that callback or establish the entire immediate path.                                                            |
| Become a 960x540 window on the control monitor, retaining content and playback                                                                         | Pass        | First native window sample at `20:14:41.361Z` was `(2480, 492, 960, 540)`, directly behind control, non-topmost and unfocused. By `20:14:42.198Z` it was `(1240, 450, 960, 540)`. The initial right-edge rectangle did not persist.                                                                                                                                                                                                                                                                                                         |
| Center the fallback on the control monitor's work area                                                                                                 | Fail        | M2-9. The stable native/Electron rectangle was `(1240, 450, 960, 540)`. Work area had returned to `(62, 0, 3378, 1440)`, whose expected center placement is `(1271, 450, 960, 540)`. It remained 31 DIP left until reconnect.                                                                                                                                                                                                                                                                                                               |
| Keep the fallback directly behind control, non-topmost, without taking focus                                                                           | Pass        | Under the lead's reading above, initial direct placement is confirmed in 12 of 131 native fallback samples, through `20:14:53Z`, until control took focus at `20:14:54.082Z`. After that, the native distance to control was 6, later 4; adjacency after the operator's own window switching is not required. All 131 fallback samples remained below control, never above it and never topmost. Output was never sampled focused/foreground. No app raise is observed; the input source of the later control-focus event was not recorded. |
| Restore BenQ full screen and configured always on top                                                                                                  | Pass        | Full-screen event at `20:16:55.840Z` (+2.673 s), always-on-top event at `20:16:55.842Z`, and status log at `20:16:55.843Z`. The independent native sample ending `20:16:56.234Z` (+3.067 s) confirms the BenQ rectangle, no window caption, topmost true, above control, and not foreground.                                                                                                                                                                                                                                                |
| Keep the same output, playback state, and PIDs                                                                                                         | Pass        | At sample resolution, output window ID 2/HWND 132932 and control ID 1/HWND 7802552 were unchanged. All five process IDs below were unchanged. All 559 app samples from readiness retained one identical slide/media/output-on state and lyric text, with an active, unpaused, ready video and no media error. Video time advanced during disconnect and across reconnect; its start anchor stayed `1792958960039`.                                                                                                                          |
| Spec 03 step 2, amber toolbar button, status text and amber preview outline; step 3, warning and its actions; reconnect notification closing after 6 s | Not checked | The notification host is not in M2. No Pass or Fail is inferred for those UI steps.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### Placement, focus, and overlap limits

The initial planned work area briefly covered the whole primary display
`(0, 0, 3440, 1440)`. Its center for a 960x540 window is `(1240, 450)`. The app
logged the restored work area `(62, 0, 3378, 1440)` at `20:14:41.793Z`, but the
window retained the earlier center through reconnect. This is an observed
sequence, not a proven code-level cause.

The output's recorded move at `20:14:39.234Z`, resize at `20:14:39.326Z`, and
always-on-top-changed at `20:14:39.330Z` all precede the recorded
display-removed callback at `20:14:40.510Z`. The topmost-change event did not
record its new value. Later native samples confirm topmost is off, but these
events and samples do not attribute the topmost drop to that callback. No causal
claim about the callback or the entire immediate path is supported.

The stable fallback lies entirely inside control's outer rectangle, with a
518,400 px geometric intersection. Its native z-order remained below control, so
this overlap does not show output covering control. No independent native sample
captured a topmost output overlapping control during this transition, including
the interval before the recorded removal callback. The native sample from
`20:14:39.188Z` to `20:14:40.487Z` still reported a topmost output at
`(3440, 222, 1920, 1080)`, with zero intersection. That does not rule out a
topmost overlap in the pre-callback interval: one app row started at
`20:14:39.192Z` and finished at `20:14:40.565Z`, reporting a topmost primary
rectangle while mixing an earlier window read with later playback/event data.
Neither recorder provides an atomic view of the transition, so a brief
pre-callback overlap remains unresolved as well as any unsampled interval.

Control was not foreground in the immediate demotion/fallback samples. It
received focus at `20:14:54.082Z`, about 13.6 s after the recorded removal, and
remained foreground until reconnect. The recorder did not capture user input, so
it cannot attribute this later activation to the app or the operator. No
output-focus event was recorded. Under the lead's interpretation, the retention
check is Pass: the app placed the fallback directly behind control and no app
raise was observed afterwards. The later loss of adjacency does not change that
result; adjacency after the operator's own window switching is not required.

### M2-9: Fallback keeps an obsolete work-area center

- Severity: minor; area/owner: output window placement, output.
- Build: `3d8a38b`, version `0.13.0`; observed once in this physical recheck.
- Steps: with the described primary display and its 62 px left taskbar/work-area
  inset, show BenQ full-screen output with looping video and a lyric slide;
  physically disconnect BenQ HDMI and wait for the primary work area to settle.
- Expected: a 960x540 fallback centered on the current control work area, at
  `(1271, 450)`, behind control with always on top off.
- Actual: the initial right-edge fallback corrected to `(1240, 450)`, then
  stayed 31 DIP left of the current work-area center. Playback, non-topmost
  state, and relative ordering below control were retained.
- Suggested regression coverage for the owner: a fullscreen-exit fallback whose
  work area changes again after the first settled list, including a taskbar
  inset; verify the final native bounds against the latest work area.

### Logs, PIDs, and evidence

| Process              | Before and after PID |
| -------------------- | -------------------- |
| Main                 | 41928                |
| GPU                  | 43124                |
| Network utility      | 34456                |
| Control renderer     | 30188                |
| Main output renderer | 51788                |

No app error, crash, renderer-gone, or child-process-gone entry was recorded.
There were two warnings: the expected monitor-missing warning at `20:14:41.221Z`
and a low-frame-rate warning (12.9 fps) at `20:16:55.915Z` during reconnect. The
app reported recovery to its target at `20:16:58.919Z` (73 fps). This functional
recheck did not independently measure BenQ scan-out fps; the earlier
primary-cadence meter limitation still applies. Advancing one-second video
samples do not rule out a short visual stutter or flash.

App start-time gaps peaked at 2.785 s (capture-completion gaps at 2.742 s).
Native capture gaps peaked at 2.386 s. One native append failed because the file
was in use at `20:14:49.236Z`; recording resumed on the next interval. There
were no app-recorder errors. The app and native snapshots are not atomic with
each other or internally across awaited playback reads, so timing claims use
event timestamps and conservative native confirmation where available.

Local evidence directory:
`<m2-run folder>\.llp\hdmi-recheck\run-2026-10-25T20-09-06-070Z\`.

| Evidence                                                                    | File                                                                                          |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| App windows, monitors, PIDs, live state, playback, events and log additions | `record.jsonl`                                                                                |
| Native rectangles, work areas, topmost/foreground flags and true z-order    | `native-windows.jsonl`                                                                        |
| Parsed transitions, checks, errors and raw-record hashes                    | `analysis.json`                                                                               |
| App log and console including normal shutdown                               | `app-events.log`, `app-console.log`                                                           |
| Single dropped native append                                                | `native-errors.jsonl`                                                                         |
| Readiness and human-reported cable times                                    | `ready.json`, `lead-markers.jsonl`, `reconnect-confirmation.json`                             |
| Explicit normal close, app/recorder exits, no remaining processes           | `stop.request`, `app-exit.json`, `recorder-finished.json`, `native-exit.json`, `cleanup.json` |

App record SHA-256:
`fddb16f100b6cc65f61f383e1ff83e9c06d620b3785921748cbee5670360cdd0`. Native
record SHA-256:
`9411f82566ca92a04c8184414e73d5654228746467dcb8c6cb4f6793f29709f2`.
