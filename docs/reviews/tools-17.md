# Review request: `tools-17`

- Team member: tools
- Branch: `docs/tools/timer-modes`, stacked on tools-16.
- Base, final head, checks and CI status: in the report.
- Scope: October 27 timer decisions, qa-12 rows T03, T07 and T09.

## What changed and why

Spec 04 adds a per-countdown stop/continue choice, an explicit date and time
target, and elapsed duration starting from a configured value. Stop-at-zero
holds zero and is no longer running; starting a finished duration timer starts
fresh. Existing missing-overrun records keep the current continue default.

Spec 02 maps this additively to optional `.overrun`, optional `.date`, and
`elapsed` with `.start`. Existing `elapsedFrom` and undated countdown-to records
keep their earlier meaning. The new editor writes an explicit date and labels
legacy time-of-day elapsed distinctly. IDs and unknown fields are preserved. No
existing field is retyped or reused for a different meaning, so this does not
require a breaking timers.json change.

Checked the linked Renewed Vision timer article. It supports Overrun and the
stopwatch start value. Explicit calendar-date selection is attributed to the
user decision. The clock remains local wall time for date/time targets and
monotonic time for counted durations.

## Changes outside my paths

- `docs/spec/04-show.md`: operator behavior and timer editor fields.
- `docs/spec/02-data.md`: additive definition fields and compatibility.
- This review document.

## Checks and quality

Documentation only. Formatting and exact-head CI are in the report. No source,
runtime contract or TSDoc changes in this request. Code follows in small units.

## Checked in the app

No app screen changes in this specification-only request. Each visible code
request will include the required offscreen CDP repetitions, DOM/memory checks
and screenshots.
