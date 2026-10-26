# Review request: `spec-57`

- Team member: `spec` (Codex)
- Branch: `docs/spec/remove-slots`
- Base commit: `3b1dccad8ae02cdf0a06cf695b7985ab58051487`
- Review range: `3b1dccad...docs/spec/remove-slots`
- Review round: 2
- Task: October 26 user decision, replace slot items with empty sections

## What changed and why

Specs 01, 02, 04, and 05 now use 구역 for the section row, 구역 추가 for its
menu action, and 새 구역 for a new row. The stored kind stays `header`. Empty
sections remain visible, selectable, copyable, and saveable, including
consecutive and final empty sections. 항목 추가 targets the selected section.
The other-items menu and service order no longer offer slots or slot filling.

The data spec defines legacy service/template reads as slot-to-section
normalization, preserving the title, id, position, and unknown fields. Templates
and both source trees retain empty sections. This follows the user decision in
`docs/decisions.md`, replacing the earlier draft behavior.

## Validation

Documentation only. Checked the four specs against the recorded user decision
and searched for obsolete slot behavior and 머리글 labels. Prettier and diff
checks are recorded in the request message; no unit tests needed.

## Changes outside my paths

None. Only the four spec documents and this review document change.

## Follow-up coordination

Data owns removing the shared slot contract and normalizing legacy reads. UI
owns the 구역 strings, other-items menu, and removal of its slot-fill paths
(including ui-41). Spec follows with the new-service/import trees and service
order display, selection, and drop behavior. No shared schema is changed here.

## Team member's reply

1. Spec 01 now lists sections instead of slot items in the service-item and
   template definitions. Its new-service comparison explicitly distinguishes our
   empty sections from ProPresenter placeholders and links to 02 and 05. Checked
   all four affected specs for remaining active slot definitions.

## Verdicts (recorded by the lead at merge)

- Earlier rounds (Codex): see the findings and replies above.
- Final round (96d6e04a): reviewer (Codex) Approve. Lead Approve (see "What
  changed and why"); the exact-head CI run passed, checked by the lead at merge.
  Rebased by the lead onto local `main` without conflicts; typecheck passes.
