# Review request: `qa-8`

Review range: `505ab18...docs/qa/m2-check2`

- Team member: `qa`
- Branch: `docs/qa/m2-check2`
- Base commit (`main`): `505ab189a2241b35e8b1a6ac53395ce42db838c4`
- Last commit: see the review request message
- Related brief: `docs/briefs/qa.md`; the replaced `.llp/task.md`
- Tested app snapshot: local main `722fc6e8b6a4c8a51f8234c471a6f8a6cd6ec83e`,
  version `0.12.0`; native runtime checks were not repeated after the rebase.
- Milestone scope reference: `docs/MILESTONES.md` on main `4d66230`, with the
  October 25 M2 restart clarification; the app snapshot above was not retested.

## What changed and why

Add the Korean `m2-check2` user sheet for real hardware. It covers a fresh tag
clone and data copy, the ten requested feedback checks, a 60-minute output run
with GPU-process memory readings, physical monitor unplug/replug, and app
force-quit/restart. The M2 restart check requires a clean launch with data
intact, the same service open, outputs off, and manual resumption by the
operator. The output-state recovery dialog belongs to M3 (O8, S2b), so the sheet
lists it as a known gap outside M2 acceptance. The default-hidden clear-undo
button remains a known gap being addressed by spec-18.

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
| App force-quit/restart                           | Observed clean restart, same service open and outputs off; manual output resumed in the follow-up; dialog belongs to M3                           |
| Captures at 1280x720 and 1920x1080               | Visually inspected; video/image backgrounds, new header and preview row appear                                                                    |
| Offscreen safety and cleanup                     | All observed windows hidden, unfocused, offscreen, not native fullscreen or always-on-top; no show/focus/fullscreen events; test instances closed |
| `npm run format:check`                           | Passed before the branch-CI workflow change                                                                                                       |
| Prettier checks on owned docs and sample JSON    | Pass after rebase                                                                                                                                 |
| Local `npm run verify`                           | Not run; the new workflow requires only fast checks on owned files locally                                                                        |
| GitHub CI                                        | Exact-head run URL and result accompany the review request message after pushing this branch                                                      |

The tag is the lead's later publication step. This smoke used local main and the
updated fixture, not an unpublished remote `m2-check2` tag. Physical cable
changes, a new 60-minute real-hardware run, and Task Manager observation remain
for the user. The prior GPU growth finding is not cleared by this short smoke.

The branch was rebased onto main `505ab18` to adopt the required branch-push CI,
status script, and member pre-push hook. The app snapshot above remains the
runtime evidence. CI verifies the rebased request's exact head on GitHub; no
full verify is run locally. Its run URL and result are reported outside this
file so recording them does not change the head being verified.

## Known gaps and milestone scope

### Output-state recovery dialog: M3, O8 and S2b

- M2 requires a clean restart after force-quit with data intact, the same 예배
  순서 open, and all outputs off. The operator resumes by clicking the slide and
  turning output on. `docs/MILESTONES.md` explicitly reserves the dialog and
  live-state restoration for M3.
- On tested main `722fc6e`, the service reopened with outputs off and empty live
  layers. The follow-up reused the same data and manually showed the first song
  over its video. No dialog or live-state recovery record was present. These
  observations do not establish a dialog-related M2 failure.
- The user sheet asks the operator to check all five service entries, the songs,
  their slides and media, and manual resumption on the tagged build. Physical
  monitor checks and the 60-minute run also remain for the user. This request
  does not close M2 acceptance.

### Default-hidden clear-undo button: known gap, spec-18 in progress

- Feedback item 7's remaining setting/visibility work is being addressed by
  spec-18, as the lead reported. Keep it listed as a known gap in the sheet
  until the change is integrated and checked.
- The final choices in `docs/plans/m2-check1-feedback.md` select default off. A
  fresh copied fixture still displays 되돌림 (tooltip and accessible name:
  되돌리기); `ClearRow` renders it unconditionally and the preference control is
  not connected.
- Ctrl Z removal works. The sheet describes the visible button and the pending
  spec-18 work without claiming default-hidden behavior shipped.

## Evidence and harness corrections

Ignored `.llp/qa/m2-check2/` holds the scripts and copied data. `results/` holds
`fixture-validation.json`, `smoke.json`, `confirm.json`, process logs, the
forced-exit log, and the inspected image/video screenshots. `user-data-2/` holds
the checked app data and `logs/main.log` (no app warnings or errors).

An initial script escaped a newline incorrectly in an evaluated expression;
another assertion used `Number('125%')` instead of parsing the displayed suffix.
A screenshot follow-up initially searched only aria-label on a toolbar button
that has visible text. These were harness mistakes; their records are preserved
separately. The corrected percentage follow-up passes. The raw recovery-dialog
assertion in `smoke.json` is false, but checks M3 work and does not fail the M2
restart criterion. The raw observations are retained. A native process query
also confirmed the GPU command line contains `--type=gpu-process` and this
test's `--user-data-dir`, as the sheet instructs the user to identify it.

## Quality checklist

Documentation and fixtures only, with schema/reference and native runtime
validation. All sample text is invented; original procedural media are reused.
No shared contract or dependency changed. No middle dots or em dashes.

## Decisions I made (for the lead to confirm)

1. Give the second song the shared video to make every sample song's default
   background explicit and support a continuous long run across the first two.
2. Reuse the sample path while instructing a fresh copy from the new tag.
   Existing `m2-check1` tag contents remain immutable.
3. Follow the clarified M2 restart criteria and list the M3 recovery dialog as a
   known gap. Keep the default-hidden undo gap marked spec-18 in progress.

## Shared contract change requests

None.

## Where to look

- The fresh data-copy commands and background instructions in the Korean sheet.
- Hardware steps against M2 criteria and spec 03, including the clean-restart
  and manual-resume requirements and the M3 dialog scope.
- The GPU process identification and memory report fields.
- The remaining clear-undo visibility gap against the feedback's final choice,
  with spec-18 in progress.

## Review: lead

- Verdict:
- Findings:

## Review: reviewer

- Verdict:
- Findings:

## Team member's reply

Apply the lead's pre-review scope correction: the dialog is M3 work, the M2
force-quit check covers clean restart and manual resumption, and the default-off
clear-undo setting is a known gap being addressed by spec-18. No app code
changed or new runtime run was needed for this documentation correction.
