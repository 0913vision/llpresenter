# Review request: `spec-58`

- Team member: `spec` (Codex)
- Branch: `fix/spec/source-tree-sections`, initially stacked on spec-57
- Base, range, and exact-head CI: see the request message
- Review round: 2
- Task: remove slots from the 새 예배 and 다른 예배에서 가져오기 trees

## What changed and why

The source trees no longer present a slot as a content item. Their sample
template uses consecutive empty sections, including a final empty section. Each
section remains a top-level checkable row, carries no slot icon/detail, and is
excluded from the content-item count. The existing selection logic already
supports empty sections, so it needs no new state or subscriptions.

Regression coverage checks their tree positions, independent mouse/keyboard
checks, creation with only empty sections, and importing only empty sections
without selecting the preceding section's passage. Existing rename and source
switching coverage continues to run.

## Validation

- Service-dialog tests: 83 passed, including real service/template parser
  normalization and both dialog flows from a legacy source document.
- Typecheck and scoped ESLint passed.
- Build passed. Formatting and final diff checks are in the request message.

## Checked in the app

Built with `npm run build`, then launched the real Electron app with
`LLP_TEST_WINDOWS=offscreen`, the built renderer served on dev port 5193, CDP
port 9517, and an isolated data folder inside this worktree. Ran `node --check`
on the driver, server and main launch entry before Electron. Repeated after
rebasing onto data-71's normalization.

The on-disk source template contains actual legacy song/Bible slots, including
unknown metadata. Main reads them as sections. The app shows and independently
checks their titles, creates/imports them as section rows, and preserves the
unknown metadata through copying.

For each dialog, switched A to B and back 20 times, reopened/closed twice after
warm-up, and independently checked the two consecutive empty sections. Created a
service containing only those sections, then imported them again. Read the real
main-owned document to verify the resulting four section rows, their source
order, and fresh IDs. No renderer exceptions occurred. The app and its process
tree were stopped after the check.

At the closed checkpoints, elements stayed at 397, DOM nodes at 1449, and
listeners at 650. Collected renderer heap stayed bounded: 5.26, 5.57, 5.66 MB
for new service, then 5.71, 5.81, 5.86 MB for import. The small warm-up growth
decreased between batches; no DOM or listener accumulation occurred. Full
measurements are in [measurements.json](spec-58/measurements.json).

![New service with consecutive empty sections checked](spec-58/new-service.png)

![Import with consecutive empty sections checked](spec-58/import-service.png)

## Changes outside my paths

`src/renderer/src/prep/services/` is prep-owned. The lead assigned these trees
to this member for slot removal. No shared contract or normalization changes:
data handles legacy slots before the tree receives a document. UI owns the
QuickAdd menu and fill-path removal. UI's ui-52 now also covers the prepared
service-order selection/drop unit; spec will retain only cleanup or additional
regressions after that request lands.

## Team member's reply

1. Rebased onto data-71's merged normalization dependency. Added legacy-source
   regressions through the real `parseService` and `parseTemplate` functions,
   including consecutive/final sections, their independent top-level checks,
   stable source order, and unknown fields. Both dialog regressions now start
   from a legacy template read rather than a manually converted fixture. The
   real-app fixture also stores raw song/Bible slots on disk before launch;
   creation and import must produce section rows and preserve unknown fields.
   The tree no longer receives raw slots from validated source documents.

## Verdicts (recorded by the lead at merge)

- Round 2 (d342a7af): reviewer (Codex) Approve. Lead Approve through the lead's
  merge check: the exact-head CI run passed, the branch rebased onto local
  `main` without conflicts, and typecheck passes. Earlier rounds' findings and
  replies are above.
