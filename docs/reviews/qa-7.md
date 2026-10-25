# Review request: `qa-7`

Review range: `3469d9e...docs/qa/soak-3`

- Team member: `qa`
- Branch: `docs/qa/soak-3`
- Base commit (`main`): `3469d9e320a383c99c4a2e1e648f97f48fdb168b`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/qa.md`; the lead's 60-minute SK2 follow-up
- Tested app commit: `b7c61e3fd283b6ccba6f542bdad088bf1e436356`

## What changed and why

Append the 60-minute soak result to `docs/qa/m2-notes.md`, preserving the merged
qa-6 20-minute history. The official judge fails only GPU memory growth. The
separate last-30-minute assessment also fails on GPU, at +13.18 MiB/h; its
sampled private peak is 474.9 MiB. Main, control, output, and network are flat
in both assessments. Main output median and minimum fps are both 60.

The result distinguishes early settling in main/output from late GPU growth. It
includes both judgement methods, full and late peaks, record coverage, cleanup,
scope limits, raw-record hash, and local log paths. Main's peak was 87.4 MiB. No
app code, fixture, configuration, or dependency changed.

## Changed files

- `docs/qa/m2-notes.md`: latest-result pointer and appended run 3.
- `docs/reviews/qa-7.md`: this request.

## Checks run

| Command or test                                               | Result                                             |
| ------------------------------------------------------------- | -------------------------------------------------- |
| `node --check` on runner, clip scripts, launcher and analyzer | Pass                                               |
| `npm run build` on tested snapshot                            | Pass                                               |
| `npm run soak -- --minutes 60`                                | Fail, exit 1, GPU growth only; no rerun            |
| Original parser and full judge                                | 359 valid samples, no dropped lines or relaunches  |
| Last-30-minute assessment                                     | 180 samples, GPU growing, all other processes flat |
| Recorded-process cleanup                                      | All five PIDs ended after normal app shutdown      |
| `npm run format:check`                                        | Pass, full repository check                        |
| `npm run verify`                                              | Not run, standing QA documents-only check rule     |

The format-check-only rule is in `docs/briefs/qa.md` and is recorded in qa-3.
The failed soak is the result this documentation request reports.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

Documents only. Original judge settings and verdict are preserved; the late
assessment is labeled separately. No inspector, CDP, forced GC, or wrapper
changed the workload. Every launch was offscreen. No middle dots or em dashes.

## Decisions I made (for the lead to confirm)

1. Hold the then-current main app snapshot throughout the run. After extracting
   results and after qa-6 merged, rebase this own branch once onto newer main
   before appending the result.
2. Measure the last 30 minutes without another warm-up, using six 5-minute
   windows and the same judge threshold and classification rule. Record its
   numeric slope and sampled peaks alongside the official full result.
3. Preserve the late GPU step, minima, and endpoints. The late main/output rates
   are below the threshold in this run; GPU's cause remains open.

## Shared contract change requests

None.

## Where to look

- Run 3's full/late trend and peak tables in `docs/qa/m2-notes.md`.
- The GPU late-window minima and endpoint increase.
- Why output is flat despite a positive overall slope.
- Scope: this is the requested offscreen recorder workload, not a complete
  visible-stutter or DOM-counter SK2 sign-off.

## Review: lead

- Verdict:
- Findings:

## Review: reviewer

- Verdict:
- Findings:

## Team member's reply

None yet.
