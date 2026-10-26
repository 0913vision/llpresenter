# Review request: `tools-8`

- Team member: tools
- Branch: `feat/tools/stage-tab`
- Base: local `main` at `6c62d738`, including approved tools-7.
- Brief: `docs/briefs/tools.md`, first M3-T1a unit.
- Final head and exact-head CI are in the report.

## What changed and why

The 무대 tab now shows a layout select for each configured stage screen and a
timer select for the stage layout. A layout choice sends `stage.layout.set` with
that screen's ID. The value follows its live override or the current Look, using
the output renderer's existing resolver, including missing-Look fallback. Timer
selection sends `stage.timer.set`, including `null` for 없음; it does not start
the timer or save settings. Removed targets cannot be selected.

The stage message field sends with 보내기 or Enter, trims text, rejects blank
and oversized text, and leaves IME composition alone. Its 내리기 sends the
existing `stage.message.set` null command. LIVE and preset rings follow the
received live state. Presets send immediately and leave the operator's draft
intact. The tab follows preset edits; it does not edit them. Sends are disabled
without a configured stage screen. Reasons use tooltips.

## Changed files and changes outside my paths

Owned code: `show/tools/StageTab`, `StageMessage`, styles, tests and fixture.
Outside: `show/ShowToolsPanel.tsx` mounts the selected tab and accepts the
notice callback; `shell/Workspace.tsx` forwards that callback. The review
document is the only other path. No shared contract, storage, dependency or
output changes.

## Checks and quality

- Typecheck after rebase and final implementation, changed-file ESLint, relevant
  test results, format check and exact-head CI are in the report.
- Tests cover screen-specific commands, Look fallback and live overrides, timer
  selection and removal, message boundary/IME/Enter behavior, received live
  marks, preset edits, absent screens, failed reads and unsubscription.
- Settings are read and subscribed only while the stage tab is mounted; all five
  document subscriptions release. Live selectors omit timer tick state.
- New preset rendering is capped at 50 buttons. Invalid saved presets remain
  disabled; message text uses the shared 4,000-character IPC cap. No new queue
  or cache grows during operation.
- No new TSDoc; every new `/**` was checked before the request.
- No full local verify or app launch.

## Next units

The 표시 중 and 메시지 tabs remain separate T1a units. Then the retained 타이머
tab follows; audio waits for O7 and lead confirmation.

## Review: lead

- Verdict:
- Findings:

## Review: reviewer

- Verdict:
- Findings:

## Team member's reply
