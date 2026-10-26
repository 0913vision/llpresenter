# Review request: `tools-10`

- Team member: tools
- Branch: `feat/tools/message-tab`
- Base: local `main`; final base and head are in the report.
- Brief: `docs/briefs/tools.md`, M3-T1a message sending unit.
- Exact-head CI and local check results are in the report.

## What changed and why

The 메시지 tab selects saved templates, shows sentence blanks as chips and one
input per distinct blank, previews the result, and sends `message.send`. Shared
macro substitution preserves literal values and bounds text at 4,000 characters.
Empty blanks, blank messages and oversized text disable sending with a tooltip.
Held Enter sends once per press. Unclosed braces stay literal.

Targets follow configured screens, with all and individual chips exclusive. The
command keeps `all` literal; removed explicit targets are dropped. Zero or more
than 200 targets block sending. Template defaults populate targets and duration,
with absent values using `all` and `null`; custom saved durations stay
available. Template or default changes reset the draft, unrelated pushes
preserve it, and deletion selects the first remaining template. No settings
writes. Both document subscriptions release on exit.

## Changes outside my paths

- `src/shared/messageText.ts`: share the existing macro substitution rule and
  extract distinct blank names with the same grammar. No IPC or file change.
- `src/renderer/src/show/ShowToolsPanel.tsx`: mount the selected message tab
  with the existing problem callback.
- `src/renderer/src/ui/ListRow.tsx`: accept React nodes in the second line so
  sentence blanks can use chips; existing string callers stay compatible.
- This review document.

## Checks and quality

Tests cover defaults, literal/repeated/prototype names, targets and durations,
template and screen changes, text limits, held Enter, failed reads and cleanup.
Existing macro and ListRow tests cover the shared paths. Results and exact-head
CI are in the report; local checks resumed after the m3-check3 quiet window. No
new cache, timer or growing history. The 4,000-character template limit bounds
blank inputs; rows and fields are memoized. No new TSDoc, verified before the
request. No full local verify or app launch.

## Next units

The minimal template editor (add, edit, delete) and 표시 중 with per-row clear
undo remain separate T1a requests. The retained 타이머 tab follows. Audio waits
for O7 and lead confirmation before work starts.

## Verdicts (recorded by the lead at merge)

- Round 1 (b823c952): reviewer (Codex) Approve. Lead Approve (see "What changed
  and why"). Rebased by the lead onto local `main` after spec-54 without
  conflicts; typecheck passes.
