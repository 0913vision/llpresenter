# Review request: `output-55`

- Team member: `output`
- Branch: `fix/output/clear-toggles`
- Base, head, review range and CI: in the request message.
- Scope: the m3-check3 user decision that F1 to F7 toggle their own clear.
- Stacked on output-54 until its merge. New features remain frozen.

## What changed and why

Clear keys and their buttons now restore what that key cleared on a second
press. Main retains at most seven captures, one per key. F1 restores every
nonempty layer it actually cleared, preserving content already restored by
another key. New output content invalidates every capture, so the next key press
clears the new content. Output on/off, Looks and audio/notice transport pause do
not invalidate captures.

Restore uses the existing clear undo timing for background, messages, notices
and audio, including a fresh audio playback identity. The optional undo button
keeps its existing one-level behavior and consumes key captures when used. Macro
clear actions keep their one-way command. Captures are temporary and start empty
after recovery.

The clear row remains enabled for a restorable key even when its layer is empty.
Pressed styling and a 복원 tooltip identify that state. The existing key handler
still suppresses held-key repeats and keeps Ctrl Z for editing. Spec 03 and the
seven spec 10 command rows record the user decision; toggle restore is not
claimed as ProPresenter behavior.

## Changes outside my paths

- `src/shared/commands.ts`, `live.ts`, command/state schemas and tests: additive
  `layer.clear.toggle` command and optional unique, seven-item restore flags.
- `src/renderer/src/state/clear.ts` and test: dispatch toggles and allow restore
  with an empty layer.
- `src/renderer/src/show/ClearRow.tsx`, its styles/test and `clearKeys.ts`:
  shell's clear controls use the toggle command and expose restore state. Key
  bindings and focus precedence stay the same.
- `src/renderer/src/control/App.test.tsx` and
  `control/recovery/RecoveryMount.test.tsx`: update integrated F2 and modal F1
  expectations to the additive toggle command.
- Spec 03 and 10: clear toggle and restore behavior.

## Checks run

- Main clear, undo, audio, schema and control regressions: see request message.
  Cases include all seven keys, F1 after another clear, new-content reset, stage
  text reset, monotonic audio resume, pause preserving another capture, bounded
  repeated captures and malformed IPC flags/targets.
- Typecheck, build, own-file lint after formatting: see request message. Full
  verify runs on GitHub.
- The first
  [CI run](https://github.com/0913vision/llpresenter/actions/runs/40346115241)
  failed two old command expectations in `App.test.tsx` and
  `RecoveryMount.test.tsx`. Both now expect `layer.clear.toggle`.

## Checked in the app

- Built with `npm run build`; `node --check` passed before the CDP launcher
  started Electron. Two launches used `LLP_TEST_WINDOWS=offscreen`, port 5182
  and isolated sample data. No sound played and no desktop window appeared.
- Each launch repeated 25 cycles through real CDP F2 key events: clear, press
  again to restore, clear then send a new slide, press to clear that new slide,
  restore with the visible button. Each cycle also pressed F1 twice and checked
  that every cleared live layer in the fixture, lyrics and background, returned.
  Real output text followed the restored frame. Both launches quit normally.
- Five renderer targets, 451 live DOM elements and 1,669 CDP DOM nodes remained
  constant. Listeners were 403 throughout run 1 and decreased from 406 to 403 in
  run 2. Collected control heaps at iterations 5 and 25 were 5,489,924 to
  5,767,376 bytes and 5,621,368 to 5,902,688 bytes. This is a short
  repeated-flow check, not an hours-long soak.
- Screenshots: [cleared key](evidence/output-55/cleared-run1.png),
  [restored picture](evidence/output-55/restored-run1.png),
  [second launch](evidence/output-55/restored-run2.png).
- Round 2 repeats the two launches with a notice active on the stage screen.
  Each of 25 cycles clears lyrics with F2, pauses and resumes that unchanged
  notice, and restores the lyrics with F2. Both runs also repeat the existing
  new-slide reset and F1 restore checks and quit normally. Counts stay at 451
  live elements and 1,675 CDP DOM nodes; listeners stay at 403 or decrease from
  408 to 403. Collected heaps were 5,516,572 to 5,794,364 bytes and 5,492,700 to
  5,792,648 bytes. Screenshots:
  [notice resume and restored lyrics](evidence/output-55-round2/restored-run1.png),
  [second launch](evidence/output-55-round2/restored-run2.png).

## Review: lead

- Verdict: pending

## Review: reviewer

- Verdict: pending

## Team member's reply

1. Resuming a notice with the same media sequence and targets now uses
   `updateLayer`, preserving another clear key's capture. New notice content or
   targets still invalidate captures. The regression starts a notice, clears
   lyrics with F2, pauses and resumes the notice, then restores those lyrics
   with F2. Two integrated key expectations found by CI were also updated to the
   toggle command.
