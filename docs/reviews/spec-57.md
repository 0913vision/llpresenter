# Review request: `spec-57`

- Team member: `spec` (Codex)
- Branch: `docs/spec/remove-slots`
- Base commit: `c5ea313b556dc171c1ddb5c88fb88fc089b4c55c`
- Review range: `c5ea313b...docs/spec/remove-slots`
- Review round: 1
- Task: October 26 user decision, replace slot items with empty sections

## What changed and why

Specs 02, 04, and 05 now use 구역 for the section row, 구역 추가 for its menu
action, and 새 구역 for a new row. The stored kind stays `header`. Empty
sections remain visible, selectable, copyable, and saveable, including
consecutive and final empty sections. 항목 추가 targets the selected section.
The other-items menu and service order no longer offer slots or slot filling.

The data spec defines legacy service/template reads as slot-to-section
normalization, preserving the title, id, position, and unknown fields. Templates
and both source trees retain empty sections. This follows the user decision in
`docs/decisions.md`, replacing the earlier draft behavior.

## Validation

Documentation only. Checked the three specs against the recorded user decision
and searched for obsolete slot behavior and 머리글 labels. Prettier and diff
checks are recorded in the request message; no unit tests needed.

## Changes outside my paths

None. Only the three spec documents and this review document change.

## Follow-up coordination

Data owns removing the shared slot contract and normalizing legacy reads. UI
owns the 구역 strings, other-items menu, and removal of its slot-fill paths
(including ui-41). Spec follows with the new-service/import trees and service
order display, selection, and drop behavior. No shared schema is changed here.
