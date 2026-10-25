# M2 checkpoint notes

Latest result:
[the real-monitor run 4](#run-4-60-minutes-on-the-real-benq-monitor) also fails
on GPU private-memory growth. Native GPU dedicated-memory counters rise as well.
The dedicated force-quit/restart check passes. The app's exit at the end of the
hour was caused by QA's tool cleanup, not an observed app crash. The
[physical HDMI follow-up](#physical-hdmi-unplug-and-reconnect-follow-up) passes
output recovery and sampled playback continuity, with a control-window overlap
observation. Runs 2 and 3 remain below as historical evidence.

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

## Run 4: 60 minutes on the real BenQ monitor

**M2-8 reproduces with a visible output window.** The unchanged app judge finds
GPU private-memory growth of +10.26 MiB/h overall and +8.69 MiB/h in the last 30
minutes. Every other recorded process is flat. Native process private bytes and
GPU dedicated-memory counters also have positive late trends. The memory
acceptance criterion remains open; this result does not establish the
allocation-level cause.

**The QA tool killed the app at 12:48:20.210Z, exit code 4294967295.** Its
end-of-run metadata serialization failed, entering its cleanup path, which ran
`Stop-Process -Force` on main PID 49240 and any surviving owned children. This
was the close the user saw after the hour. It was not a spontaneous app exit.
The separate, deliberately repeated force-quit check below passes.

### Build, visible output, and measurement

- Tested main `51b9e625498241d3ae3ea63a4d56abb47f527bb7`, version `0.13.0`, on
  October 25, 2026. Cloned `D:\programming\2020-\pp` to the explicitly
  authorized `D:\llp-dev\m2-run`; `npm ci` and `npm run build` passed there. No
  app source or built output was patched. The documentation branch was later
  rebased independently; it is not the runtime snapshot.
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
- The app recorded 360 valid samples, spanning 3,602,765 ms. The fixed
  0-to-60-minute judgement selects 359 samples through 3,592,759 ms, within the
  official 60-second tolerance; no line was dropped. The last-30 selection has
  180 samples and spans 1,792,759 ms after subtracting 30 minutes.

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

These are the app's `requestAnimationFrame` meter values, not an independent
scan-out or video-frame-drop measurement. The native video-controller query
reports a 60 Hz 1920x1080 mode. The captures confirm visible output at the three
checkpoints; they do not establish a continuous human assessment of stutter.

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

All paths are local under `D:\llp-dev\m2-run\.llp\real-run\`, outside team
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

**Output recovery and sampled playback continuity pass against spec 03.** The
same output and renderer moved to a 960x540 window on the primary monitor when
the BenQ disappeared, and returned automatically to BenQ full screen when it
reconnected. All five Electron PIDs stayed unchanged. There was no crash or
error. **Operator-window overlap was observed**, including a brief topmost
output on the primary monitor before the smaller fallback window settled.

### Setup and method

- Same built clone and runtime snapshot as run 4: main `51b9e62`, version
  `0.13.0`, `D:\llp-dev\m2-run`, and the same `.llp/real-run/user-data` folder.
  No soak variables were set. The user explicitly authorized visible app windows
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

The longest app-record interval was 3.170 seconds during display
reconfiguration, despite the nominal one-second schedule. Video time advanced
and no reset or paused state was observed, but these samples cannot rule out a
short visual stutter or flash inside a sampling gap. Notification-card and
toolbar-color presentation were not asserted by this recorder; the notification
host remains outside the earlier M2 slice.

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

Local evidence is under `D:\llp-dev\m2-run\.llp\unplug\`:

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
