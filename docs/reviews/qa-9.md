# Review request: `qa-9`

Review range: `09dcac2...docs/qa/m2-run`

- Team member: `qa`
- Branch: `docs/qa/m2-run`
- Base commit (`main`): `09dcac2e3135640311b507afe311db301652fe0c`
- Last commit: see the review request message
- Task: the lead's replaced `.llp/task.md` and the explicit follow-up about the
  tool-caused close, fresh before/after-hash force-quit check, and the
  subsequent user-operated HDMI unplug/reconnect check
- Tested app: `51b9e625498241d3ae3ea63a4d56abb47f527bb7`, version `0.13.0`

## What changed and why

Add real-monitor run 4 to `docs/qa/m2-notes.md`, including the independent
30-second Windows process/GPU counter CSV, whole-run and last-30-minute trends,
peaks, app judgement, fps, and the dedicated force-quit result. M2-8 reproduces
with a visible BenQ output: app GPU private-memory slopes are +10.26/+8.69
MiB/h. Native private bytes and dedicated GPU counters also rise late. All other
processes pass the app's flat-memory judgement.

The physical HDMI follow-up preserves playback and PIDs, switches to a primary
monitor window, and automatically returns to BenQ full screen. Native geometry
confirms return within about 1.3 seconds of recorded detection. The report also
records a temporary topmost output over control and the stable fallback's
partial rectangle overlap, with the measurement limits stated explicitly.

The app's hour-end close was caused by QA's cleanup tool, not an observed app
crash: exit 4294967295 at 12:48:20.210Z after helper metadata serialization
failed. The preserved pre-exit app log has no error/crash/renderer-gone entry.
The repeated, deliberately controlled force-quit check has a fresh pre-kill
baseline: all nine content hashes and the last service ID match after restart,
the same service opens with outputs off, and the final app closes normally.

## Changed files

- `docs/qa/m2-notes.md`: run 4, measurements, cleanup incident, recovery check,
  physical HDMI recovery, operator-window overlap, limitations, and evidence.
- `docs/reviews/qa-9.md`: this review request.

## Checks run

| Check                                        | Result                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Separate-clone `npm ci` and `npm run build`  | Pass, tested app snapshot above                                                             |
| Helper syntax checks before app launches     | Pass for the final scripts                                                                  |
| Real-monitor hour                            | 121 system times, 605 process rows, 360 valid app lines, zero process relaunches            |
| Official 60-minute judge                     | Fails GPU growth; coverage sufficient; every other process flat                             |
| Supplementary last-30 judge                  | Same GPU-only failure                                                                       |
| Native GPU counter coverage                  | 121/121 GPU-process samples valid                                                           |
| Pre-exit app-log audit                       | 8 INFO lines, no warning/error/crash/renderer-gone/child-process-gone entry                 |
| Dedicated force-quit/restart                 | Pass, nine hashes and last service match; outputs off on restart; final normal exit 0       |
| Electron cleanup                             | No clone Electron process remains                                                           |
| Prettier on changed documents and diff check | Pass                                                                                        |
| Full local verify                            | Not run, only fast local checks under the current workflow                                  |
| Branch push and GitHub CI                    | Run URL and result accompany the request; task notes the known GPU-runner failure exception |

### HDMI follow-up checks

| Check                               | Result                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| User-operated removal and reconnect | Core recovery pass; same renderer/content/video; automatic BenQ full-screen return; control overlap observation recorded |
| Recorder                            | 737 app plus 737 native snapshots; no recorder error; nominal 1 s, maximum app interval 3.170 s                          |
| Errors and cleanup                  | Expected monitor-missing warning only; no crash/error/PID change; app and native recorder exit 0                         |

## Quality checklist

Documents only. Runtime work used the explicitly authorized separate clone and
visible app. No tracked app code, dependency, shared contract, or setting was
changed. The raw CSV/records stay under the clone; paths and hashes are in the
report. No copyrighted lyrics or personal app content is included.

## Decisions and limitations

1. Preserve the real native counter observations separately from Electron's
   private-memory judge. Native tables use raw-sample OLS; the app judge uses
   post-warm-up robust window minima. Both full and late results are explicit.
2. Record the initial hidden control window and its nonactivating show at
   elapsed 12:59. Output was actually visible throughout; both windows were
   visible for the last 30 minutes. No inspector was attached during the hour.
3. Label the tool-caused end-of-hour kill plainly and retain the unmodified
   failure evidence. Use the fresh, explicit before/after force-quit sequence
   for the M2 clean-restart result, not the tool's failed end metadata.
4. Report the app's 144/143 fps meter without claiming independent scan-out or a
   continuous human stutter assessment.
5. Keep the HDMI recovery result separate from operator-window overlap. The
   initial topmost primary output covered control, and the steady fallback
   geometrically overlaps its right edge. Do not infer exact persistent pixel
   occlusion from native enumeration order or claim no brief stutter from
   one-second samples with a 3.170-second maximum gap.

## Shared contract change requests

None.

## Where to look

- M2-8 in normal output, especially native private bytes versus falling working
  set and rising dedicated GPU allocation.
- The timestamp, exit code, preserved app log, and cleanup cause of the close
  the user saw.
- Fresh force-quit manifests and their matching last service ID.
- Actual monitor/window transitions, measured restoration delay, playback
  identity and PID preservation, and the control-window overlap observation.

## Review: lead

- Verdict:
- Findings:

## Review: reviewer

- Verdict:
- Findings:

## Team member's reply

Added the lead-authorized physical HDMI follow-up after the user unplugged and
reconnected the BenQ. Continued recording beyond 60 seconds after reconnection,
then stopped the recorder and closed the app normally. No app code changed.
