# Review request: `qa-8`

Review range: `722fc6e...docs/qa/m2-check2`

- Team member: `qa`
- Branch: `docs/qa/m2-check2`
- Base commit (`main`): `722fc6e8b6a4c8a51f8234c471a6f8a6cd6ec83e`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/qa.md`; the replaced `.llp/task.md`
- Tested app snapshot: the same local-main commit, version `0.12.0`

## What changed and why

Add the Korean `m2-check2` user sheet for real hardware. It covers a fresh tag
clone and data copy, the ten requested feedback checks, a 60-minute output run
with GPU-process memory readings, physical monitor unplug/replug, and app
force-quit/restart. It separates spec expectations from current observed gaps so
the user does not count missing recovery as a pass.

The second sample song previously had no background. Give it the first song's
looping video, so both can be used throughout the long run without restarting
media when changing songs. The third song retains its still image. Update the
fixture README's obsolete claim that song clicks cannot show backgrounds.

## Changed files

- `docs/qa/m2-check2.md`: Korean setup, changed features, remaining hardware
  checks, current limits, and report form.
- `docs/qa/m2-check/sample/LoveLight/곡/2c4f6e8a-0b2d-4f4e-9a6b-7c8d9e0f1a22.llsong`:
  add the default video background ID.
- `docs/qa/m2-check/README.md`: link the current sheet and describe backgrounds.
- `docs/reviews/qa-8.md`: this request and local smoke results.

## Checks run

| Command or test                                  | Result                                                                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                         | Pass, 275 packages, zero audit vulnerabilities                                                                                                    |
| `npm run build`                                  | Pass                                                                                                                                              |
| Fixture parsers and reference checks             | Pass, all 7 text files editable with no dropped fields; references and media sizes match                                                          |
| `node --check` on local launch and smoke scripts | Pass before Electron                                                                                                                              |
| Fresh-sample offscreen `npm run preview`         | Service loads, normal shutdown exits 0                                                                                                            |
| Service header A and type                        | Pass, service name 16/22, service rows 14 px, menu title 12/16                                                                                    |
| Slide wording, arrangements, focus               | Pass, 10/5/3 slides; show grid/list have no focus outline and live slide retains red ring                                                         |
| Ctrl Z after F2                                  | Pass, lyrics stay cleared; clicking a slide restores them                                                                                         |
| Preview B                                        | Pass, fixed main/stage/broadcast order, selected marker and large view change without changing live layers; placeholder names absent              |
| UI zoom                                          | Pass, 100/110/120/110/100%; output zoom remains 100% and live layers stay unchanged                                                               |
| Continuous slider and percent field              | Pass after correcting harness suffix parsing, 50-200 range, `step=any`, fractional drag value, 125%, plus focused 140% and 100% checks            |
| Song video backgrounds                           | Pass, decoded 1280x720 video, 12-second loop with an ended event and buffer handover; same media start time across both songs                     |
| Image background                                 | Pass, slide click loads complete 1920x1080 PNG with opacity 1 and the correct lyrics                                                              |
| App force-quit/restart                           | Service and standby outputs pass; output-state recovery fails as F1 below                                                                         |
| Captures at 1280x720 and 1920x1080               | Visually inspected; video/image backgrounds, new header and preview row appear                                                                    |
| Offscreen safety and cleanup                     | All observed windows hidden, unfocused, offscreen, not native fullscreen or always-on-top; no show/focus/fullscreen events; test instances closed |
| `npm run format:check`                           | Pass                                                                                                                                              |
| `npm run verify`                                 | Not run, task explicitly requests documents-only format check                                                                                     |

The tag is the lead's later publication step. This smoke used local main and the
updated fixture, not an unpublished remote `m2-check2` tag. Physical cable
changes, a new 60-minute real-hardware run, and Task Manager observation remain
for the user. The prior GPU growth finding is not cleared by this short smoke.

## Findings to route

### F1: App force-quit loses output state without the recovery dialog

- Severity: major, an open M2 recovery acceptance path. Owner: output wiring,
  with data persistence and shell recovery UI.
- Build: local main `722fc6e`, version `0.12.0`.
- Steps: open the copied fixture, output slide 3 of the first song over its
  video on the main screen, wait, force-stop only this test instance's main
  process and children, then restart with the same `LLP_USER_DATA`.
- Expected, spec 08 "Crash and restart": reopen the service, keep outputs on
  standby, show 출력 상태 복구, and allow the last output/slide/background to be
  restored through 복구.
- Actual: the service reopens and outputs are off, but there is no dialog. Every
  live layer is null. Neither `recovery/live.json` nor `recovery/session.lock`
  exists in the copied app data. Before the kill, main output was on, slide
  position 2 and the sample video's media ID were present.
- The sheet states the expected flow and this observed failure separately. No
  code change was attempted. This request does not close M2 acceptance.
- Suggested owner regression: persist a live slide/media snapshot, terminate the
  process without shutdown handlers, restart, and assert recovery standby,
  dialog data, and the restore/start-fresh outcomes.

### F2: The feedback's default-hidden clear-undo button is still visible

- Severity: minor, feedback item 7's remaining setting/visibility work. Owner:
  shell, with the settings owner.
- The final choices in `docs/plans/m2-check1-feedback.md` select default off. A
  fresh copied fixture still displays 되돌림 (tooltip and accessible name:
  되돌리기); `ClearRow` renders it unconditionally and the preference control is
  not connected.
- Ctrl Z removal works. The sheet describes the visible button and the pending
  setting without claiming default-hidden behavior shipped.

## Evidence and harness corrections

Ignored `.llp/qa/m2-check2/` holds the scripts and copied data. `results/` holds
`fixture-validation.json`, `smoke.json`, `confirm.json`, process logs, the
forced-exit log, and the inspected image/video screenshots. `user-data-2/` holds
the checked app data and `logs/main.log` (no app warnings or errors).

An initial script escaped a newline incorrectly in an evaluated expression;
another assertion used `Number('125%')` instead of parsing the displayed suffix.
A screenshot follow-up initially searched only aria-label on a toolbar button
that has visible text. These were harness mistakes; their records are preserved
separately. The corrected percentage follow-up passes. F1 is the runtime
failure, independently of those corrections. A native process query also
confirmed the GPU command line contains `--type=gpu-process` and this test's
`--user-data-dir`, as the sheet instructs the user to identify it.

## Quality checklist

Documentation and fixtures only, with schema/reference and native runtime
validation. All sample text is invented; original procedural media are reused.
No shared contract or dependency changed. No middle dots or em dashes.

## Decisions I made (for the lead to confirm)

1. Give the second song the shared video to make every sample song's default
   background explicit and support a continuous long run across the first two.
2. Reuse the sample path while instructing a fresh copy from the new tag.
   Existing `m2-check1` tag contents remain immutable.
3. Keep spec recovery expectations in the user sheet, while prominently labeling
   the missing dialog as an observed failure. Route the bug rather than changing
   another member's code or promising recovery that does not run.

## Shared contract change requests

None.

## Where to look

- The fresh data-copy commands and background instructions in the Korean sheet.
- Hardware steps against M2 criteria and spec 03/08, especially F1.
- The GPU process identification and memory report fields.
- The remaining clear-undo visibility gap against the feedback's final choice.

## Review: lead

- Verdict:
- Findings:

## Review: reviewer

- Verdict:
- Findings:

## Team member's reply

None yet.
