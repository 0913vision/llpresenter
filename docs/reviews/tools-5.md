# Review request: `tools-5`

- Team member: tools
- Branch: `feat/tools/quick-edit`
- Base: local `main` at `c88d051a`, including approved tools-4 round 2.
- Brief: `docs/briefs/tools.md`, M3-T4b. Final head and CI are in the report.

## What changed and why

퀵 실행 추가 can save the current service song or Bible reference, library song,
Bible preview, or a black entry. Adding never outputs or edits the service. The
row context menu supports rename and delete, including unknown kinds. Blank
names cannot save; failed saves leave the rename dialog open. Neither operation
clears live output. Context menus also open with Shift F10.

Edits read the latest settings revision, preserve unrelated and unknown fields,
and retry one stale revision. A synchronous busy lock blocks duplicate submits.
Read-only documents reject edits, callbacks stop after unmount, reads time out,
and additions stop at 500 rows. Names are limited to 256 characters.

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

None yet.
