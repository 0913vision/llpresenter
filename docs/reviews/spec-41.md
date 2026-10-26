Review range: `2ba089b8...docs/spec/recovery-snapshot`

# Review request: `spec-41`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `docs/spec/recovery-snapshot`
- Base commit: `2ba089b8`, main after the spec-40 approval
- Review round: 2
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

## Round 2 response

1. Spec 02's table adds `state.version` ("Not displayed; restore starts a new
   count"), `state.lookId`, and `state.canUndo` (written as `false`, not
   restored, like audio). A rule under the table says restore applies the
   record's `lookId` when that Look still exists, and otherwise the saved
   `looks.current`. The header names clear undo state among what output removes
   before writing.
2. Spec 02 keeps a row for stage layout overrides, which join the state when the
   stage slice (M3-O5) adds them; spec 08's 표시 중이던 항목 row marks the stage
   layouts as later work.
3. Spec 01 and 08 show the card only when the dropped dispatch ran a 매크로
   (`macro.run`, or `item.start` with a start 매크로), with that 매크로's name;
   a dispatch with no 매크로 is only logged. Spec 01 says the drop entry carries
   the 매크로 id (later work) and follows any entries for skipped actions.
4. Spec 01 writes the limits as behavior: 4,000 characters per text, 1,000 lines
   per 슬라이드, 200 screen outputs plus `main`, `stage`, `broadcast`, and
   `captions`, and a recovery record of 4 MiB with 1 KiB reserved for its
   header. Spec 02 says "the complete live output state" and cites the limits.
5. The heading is "What isn't saved, and the recovery record" again, so the
   citations in 01, 02, 03, and 08 still match.
6. `serviceId` is also `null` before the content has been read.

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
