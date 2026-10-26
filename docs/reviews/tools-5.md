# Review request: `tools-5`

- Team member: tools
- Branch: `feat/tools/quick-edit`
- Base: local `main` at `c88d051a`, including approved tools-4 round 2.
- Brief: `docs/briefs/tools.md`, M3-T4b. Final head and CI are in the report.

## What changed and why

퀵 실행 추가 can save the current service song or Bible reference, library song,
Bible preview, or a black entry. Adding never outputs or edits the service. The
row context menu supports rename and delete, including unknown kinds. Blank
names cannot save; rejected edits leave the rename dialog open. Neither
operation clears live output. Context menus also open with Shift F10.

Edits read the latest settings revision, preserve unrelated and unknown fields,
and retry one stale revision. A synchronous busy lock blocks duplicate submits.
Read-only documents reject edits, callbacks stop after unmount, reads time out,
and additions stop at 500 rows. Names are limited to 256 characters. The
complete read, retry and write operation participates in the window's close
gate. An applied `write-failed` edit finishes while retaining a persistence
warning.

## Changed files and changes outside my paths

Owned code: `show/quick/` menu, editing hook/writer, panel mount and tests.
Outside: `shared/schema/ids.ts` adds `createQuickItemId` using the existing UUID
schema. `idCreation.test.ts` checks its valid/invalid cases and uses low-entropy
fixtures. The quick test fixture now exposes the readonly IPC document type. No
IPC shape, output renderer, dependency or storage-format changes.

## Checks and quality

Typecheck passed after rebase and implementation; six related files, 118 tests
passed. ESLint, format checks and exact-head GitHub verify are in the report. No
full local verify or app launch. The only new TSDoc is on exported
`saveQuickEdit`. No growing operation queue; subscriptions and timers release.

## Next units

Target submenus, reorder and service-row drag/drop follow separately. Black
execution and the remaining Bible display options still need their additive
contract and renderer units; the stored black entry remains disabled for now.

## Review: lead

- Verdict:
- Findings:

## Review: reviewer

- Verdict:
- Findings:

## Team member's reply

1. Addressed both round-1 P2 findings. The whole read-before-write operation,
   including a stale revision retry, now runs through `pendingWritesOf(api)`.
   Close waits for it to reach main, and new edits stop while close is pending.
   Two deferred-read tests exercise the actual control-session close request,
   with and without a stale retry. `write-failed` is now returned as an applied
   result, counted as sent by the gate, and reported as a persistence warning.
   Rename closes after an applied change; addition returns success without
   retrying or duplicating it. Four regression cases failed before the fixes and
   pass after them. Final checks and exact-head CI are in the report.
