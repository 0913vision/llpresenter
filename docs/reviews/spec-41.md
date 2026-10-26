Review range: `d7bf32c6...docs/spec/recovery-snapshot`

# Review request: `spec-41`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `docs/spec/recovery-snapshot`
- Base commit: `d7bf32c6`, main after the ui-30 approval
- Review round: 1
- Task: the lead's spec docs items of 05:45, 06:50, and 09:12

## What changed and why

**Recovery snapshot (06:50).** Spec 02 described the output recovery file as a
reference record (song or Bible reference, 구성 name, position, ids for 소품 and
메시지, timers, audio). data-42 stores a complete `LiveState` snapshot with the
current service id instead. The section heading, the file header, and the table
now describe `llrecovery` schema version 1 with `savedAt`, a nullable
`serviceId`, and `state`. The table names the nested live layers and the
captured content, including the slide lines, instead of a separate reference
model. The audio and timer rows say that output removes them before writing, so
neither restarts on restore. The no-undo-history rule and the recovery dialog
proposals stay as written. I checked the table against
`src/shared/schema/recoveryRecord.ts` and `LiveState` in `src/shared/live.ts` on
`main`.

**Whole-dispatch drop (09:12).** Spec 01 now says that a 매크로 or a batch whose
actions are each valid, but whose result together would exceed the live state
limits, is dropped whole: no state change, no new state sent, no effects, and
one log entry naming it (data-45). A missing target still skips only that
action. Spec 08 adds what the operator sees: a warning card "매크로 적용 실패"
with the 매크로 name as its detail line, and nothing changes on output.

**Fallback window order (05:45).** Already in spec 03, "When a monitor
disconnects during output" (lines 476 to 479): the fallback goes directly behind
the control window, and the app never raises it or restores that order when the
operator switches windows. No change was needed.

Codex wrote the recovery commit on `589e7b59` and never sent it; I rebased it
onto `main` without conflicts and added the spec 01 and 08 commit.

## Decisions I made (for the lead to confirm)

1. Spec 01 points to `LIVE_STATE_LIMITS` for the limits instead of copying the
   numbers, so the spec doesn't drift from the code.
2. Spec 08 gives the notice only for a 매크로, as the lead asked. A batch that
   isn't a 매크로 (an item start with its first 슬라이드) is dropped and logged
   with no card.

## Changed files

- `docs/spec/02-data.md`: recovery snapshot section and table.
- `docs/spec/01-concepts.md`: the whole-dispatch drop rule.
- `docs/spec/08-problems.md`: the notification table row and the 매크로 적용
  실패 card.
- `docs/reviews/spec-41.md`: this request.

## Changes outside my paths

None.

## Validation

Prettier on the changed files and `git diff --check` pass. No runtime code
changes. The final pushed head and its GitHub CI result are in the request
message.
