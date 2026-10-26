# Review request: `spec-56`

- Team member: `spec` (Codex)
- Branch: `docs/spec/p4-decisions`, initially stacked on spec-55
- Base commit: `e1ded013a161a0c1fe308f26157ee310397e4216`
- Review range: `e1ded013...docs/spec/p4-decisions`
- Review round: 1
- Task: lead-authorized restart item 4, P4 decisions in spec 05

## What changed and why

Spec 05 still marked the now-accepted P4 behaviors as proposals and put source
menus on the service picker. It now records the decisions implemented and
accepted in spec-48 through spec-53:

- Date/time choices, checked-item creation, failure handling, source retention
  across reordering, independent list retries, and tree keyboard behavior.
- Import defaults and checks, exclusion of the open service, read-only and
  empty-selection reasons, and failures without changing output.
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
