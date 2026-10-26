# Review request: `spec-56`

- Team member: `spec` (Codex)
- Branch: `docs/spec/p4-decisions`, initially stacked on spec-55
- Base commit: `1520fdede1e2bac1e662acb3de12bfd09ba37d88`
- Review range: `1520fded...docs/spec/p4-decisions`
- Review round: 2
- Task: lead-authorized restart item 4, P4 decisions in spec 05

## What changed and why

Spec 05 still marked the now-accepted P4 behaviors as proposals and put source
menus on the service picker. It now records the decisions implemented and
accepted in spec-48 through spec-53:

- Date/time choices, checked-item creation, failure handling, source retention
  across reordering, independent list retries, and tree keyboard behavior.
- Import defaults and checks, exclusion of the open service, read-only and
  empty-selection reasons, applied disk failures versus refusals/rejections, and
  failures without changing output.
- Save-new numbering and overwrite ordering that keeps the prior template until
  the replacement is on disk, including write-failed handling.
- Rename/delete menus on both source dialogs, revision checks, protection of the
  open service, busy prompts, and rename participation in the close flush.
- Failures use the one notification list; successful operator actions add none.

Each affected section cites its accepted review records. The calendar popover
remains a UI follow-up. Slot appearance and the other item 5 work remain with
ui. This request changes no implementation or shared contracts.

## Validation

Prettier, diff checks, and review against the accepted P4 requests and current
implementation. No behavior change requiring new unit tests. Exact-head CI and
final check results are in the request message.

## Changes outside my paths

None. Only `docs/spec/05-prep.md` and this member's review document changed.

## Team member's reply

1. Spec 05 now distinguishes applied `write-failed` results from refused edits
   and rejected calls in both flows. Creation continues with its applied id, and
   an applied copy stays intact while opening continues. Only a refused or
   rejected copy starts rollback; an applied cleanup deletion, including
   `write-failed`, permits retrying creation. Import into the open service
   closes after either plain success or `write-failed`, with main retaining the
   applied items and pending save. Main handles save-problem notifications;
   retrying disk persistence never reapplies the import. Checked against
   `appliedId`/`editApplied`, `createService`, `useImportItems`, and the
   accepted spec-50/spec-51 review records. This changes documentation only.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex): Request changes; the findings and replies are above.
- Round 2 (4f415877): reviewer (Codex) Approve. Lead Approve (see "What changed
  and why"); it changes documents only, and its exact-head CI run was still
  running at merge (the lead checks it afterwards). Rebased by the lead onto
  local `main` without conflicts; typecheck passes.
