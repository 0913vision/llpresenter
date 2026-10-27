# Review request: `tools-14`

- Team member: tools
- Branch: `docs/tools/timer-redesign`, rebased onto local main after tools-13.
- Base, final head, checks and CI status: in the report.
- Scope: the October 26 user-check timer decision, documentation first.

## What changed and why

The old quick timer submenu reused existing timer IDs and its running row paused
on another click. Spec 04 now requires a duration dialog that creates a new
timer per row, numbered initial names, rename through 이름 바꾸기, an in-place
running value, and press-again stop/reset. Overrun keeps its leading minus. The
timer tab's separate pause/reset controls remain distinct, and stage pickers
keep selecting a named timer by ID.

Spec 02 maps the flow to the existing countdown record and live timer state.
Adding and renaming apply the definition and quick row together. Older shared
quick references split into separate timer IDs while preserving the original ID
for stage and prop references. This retains all four existing timer kinds,
unknown fields and schema version 1; no existing timers.json shape conflicts
with the requested behavior.

## Changes outside my paths

- `docs/spec/04-show.md`: quick interaction and timer behavior.
- `docs/spec/02-data.md`: definition identity, quick references and upgrade
  behavior. Implementation follows in small requests with additive contracts
  where a whole-file settings update cannot apply both records together.
- This review document.

## Checks and quality

Documentation-only change. Checked the decisions against `timers.ts`,
`timerState.ts`, the timer slice, and the current quick add and action code. No
source or runtime contract changed. Formatting and CI status are in the report.
There are no added TSDoc comments.

## Checked in the app

This request changes specification text only. It has no operator-visible app
change or new screen to capture. Each implementation request will build and
exercise its flow offscreen through CDP, repeat selections and open/close
cycles, measure DOM and memory, and include its screenshots here.

## Team member's reply

Round 1: specified quick display and clicks for preserved date/time countdown,
time-of-day elapsed, duration-based elapsed and clock definitions. Stopped wall
targets draw once; start/reset keeps their reference semantics, a paused row
resumes, and clocks keep updating with no click effect or running bar. Spec 02
explicitly preserves the original kind/settings when separating shared quick
references, including the original stage and prop references. No duration is
invented and no existing timer is converted. The general quick-row wording and
table now defer to these kind rules. Checked against the shared formatter, quick
action runner and main timer slice. Documentation only; no new runtime behavior
or TSDoc comments.
