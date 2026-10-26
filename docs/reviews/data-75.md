# Review request: `data-75`

- Team member: data
- Branch: `break/data/song-group-spec`
- Exact base/range: member report after rebase.
- User decision: October 27, follow ProPresenter where qa-12 found a difference.

## What changed and why

Spec 02 replaces positional slide arrangements with version 2 songs containing
named groups. Arrangements store group IDs in order, including repeats. Spec 05
defines grouped source editing and group occurrences in the service chip strip.
The service's arrangement-name reference stays unchanged.

Migration combines original same-label run boundaries with cuts needed by all
old arrangements. This preserves every expanded order, including partial runs,
skips, reversed stretches and repeats, without copying lyrics. It consumes known
legacy fields and preserves unknown data, including collisions with the new
`groups` field through an explicit archive rule.

The official
[Groups and Arrangements article](https://support.renewedvision.com/hc/en-us/articles/360041809973-Using-Groups-and-Arrangements-for-Presentation-Organization)
was read on October 27. It establishes groups, arrangement tokens and shared
presentation content. The file representation and migration algorithm are our
contract, not a claim about ProPresenter's internal storage.

## Decisions and rollout

- Groups have UUID v4 IDs scoped to their song. Duplicate names stay distinct;
  unnamed groups use the empty name. Each group has at least one slide.
- The master/default arrangement remains implicit. An empty named arrangement
  keeps the existing default-order playback fallback.
- Land the grouped schema/migration API before switching persistence. The lead
  can then assign editor, grid, chip and live consumers. Activate version 2 only
  after those consumers are ready, so old editors cannot corrupt grouped files.
- Group splitting preserves all arrangement expansions. Editing/splitting source
  slides applies to every group occurrence. Cross-group Backspace is refused
  because whole-group references cannot represent arbitrary merges.

## Changes outside my paths

`docs/spec/02-data.md` and `05-prep.md` are the lead-requested contract and
editor specification changes. No runtime or other owner's implementation is
changed.

## Checks

- Formatting and diff checks: results in the member report.
- Full verify: CI pending (API 403); lead confirms the exact head.
- No runtime tests were added for this specification-only request. The next
  request covers version 1 files, expansion equality and unknown-field recovery.

## Checked in the app

This request changes prose only, with no changed screen to exercise. The grouped
schema API lands separately before runtime activation. Editor and live owners
must exercise their visible changes in the app and attach screenshots to their
requests; this document does not claim that the current app already uses groups.

## Team member's reply

1. R1: Cross-group Backspace is now always refused, including at same-named
   group boundaries. Spec 02 gives exact unchanged outcomes for separate `[A]`
   and `[B]`, reversed `[B, A]`, and repeated `[A, B, A, B]` arrangements. Spec
   05 limits its merge promise to blocks inside one group and supplies the
   refusal tooltip. Within-group merges still update every occurrence of that
   source group without removing repeated occurrences. This conservative rule
   needs no unrepresentable partial-group references.
