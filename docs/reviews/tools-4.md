# Review request: `tools-4`

- Team member: tools
- Branch: `feat/tools/quick-panel`
- Base: local `main` at `10fadab4`; final head and CI are in the report.
- Brief: `docs/briefs/tools.md`, M3-T4b, saved quick actions.

## What changed and why

The 진행 quick panel now loads saved rows in order, with kind icons and the
Bible field in its tool row. Prop and timer rows reflect accepted live state and
toggle only their target. Macros run directly. Song rows open the default
arrangement and output its first tile without editing the service or changing
the background. Supported saved Bible passages reopen at their first verse
through the existing output/history path.

Delayed reads time out and are discarded after another action, selection, clear,
settings replacement, typing or choosing a suggestion in the Bible field, or
unmount. Explicit service-row reselection cancels them too. Quick actions cancel
an older field lookup. Unknown kinds stay visible and disabled.

## Changed files and changes outside my paths

Owned: `show/quick/QuickPanel.tsx`, its CSS, `quickActions.ts`, tests and
fixtures. Outside: `shell/Workspace.tsx` mounts the content-sized panel in all
size classes. The existing settings-document hook, UI components and validated
IPC are reused. No shared contracts, settings writes, or output-renderer
changes. `shared/testing/fakeLlpApi.ts` supplies empty quick settings for
mounted apps; otherwise its default rejection adds an unrelated warning to
notification tests.

## Checks and quality

Typecheck passed after rebase; six related test files passed before the final
test consolidation. Final test count, formatting, ESLint and exact-head GitHub
verify are in the report. No full local verify or app launch. New TSDoc is only
on the exported runner. Subscriptions and timeout timers are released; the panel
keeps one settings snapshot and a generation counter, with no growing cache.
Initial CI exposed three notification-test failures from the new settings read;
the fake API default fixes them. Final head CI is in the report.

## Remaining units and shared contract request

Add menu, drag/drop, reorder, rename and delete follow in the next request.
Black stays disabled until the following additive contract unit: `prop.set`
currently requires a saved prop ID and neither stored nor live prop content
supports a black fill. The lead authorized tools to add the contract in its own
request. Saved Bible options beyond the approved panel's numbered one-verse
slides, without reference or translation-name text, stay disabled with a reason
rather than being silently ignored. Full T4b remains open for those options and
black.

## Review: lead

- Verdict:
- Findings:

## Review: reviewer

- Verdict:
- Findings:

## Team member's reply

1. Addressed round-1 P2. `BibleReferenceField` now reports reference intent
   explicitly when its value changes, including suggestion selection by mouse or
   keyboard. `BibleQuickField` forwards it to the quick runner's cancellation
   callback. The panel no longer depends on a captured DOM change event. Two
   deferred integration cases choose a recent passage, resolve the older song
   first, and verify that it produces no output and leaves the field intact.
   They then resolve the chosen Bible lookup and verify that Enter outputs it.
   Both cases reproduced the failure before the fix. Final checks and exact-head
   CI are in the round-2 report.
