# Review request: `spec-63`

- Team member: `spec` (Codex)
- Branch: `fix/spec/alphabetic-search`
- Base, range, and exact-head CI: see the request message
- Review round: 1
- Task: October 27 user decision, qa-12 P03 library search ordering

## What changed and why

Title hits previously displaced alphabetically earlier lyric hits. The shared
main-process search now walks its existing title-sorted index once, collecting
all matching songs together and stopping at the requested limit. Korean numeric
collation and stable ID tie-breaking remain the same. Title/lyric match metadata
and the first matching lyric line are preserved.

For a query 찬송, the mixed result now places 가나다 and 나무 (lyric hits)
before 찬송 2 and 찬송 10 (title hits). A limit of two returns the first two in
that same order. All renderer search surfaces consume this one result order.

This follows the recorded user decision and the current
[Renewed Vision Quick Search article](https://support.renewedvision.com/hc/en-us/articles/9808905773715-How-to-Use-Quick-Search-within-ProPresenter),
which documents alphabetical library results. Spec 05 and the shared request
comment now describe that ordering. No IPC fields or schema validation change.

## Validation

Index/registration regressions cover mixed matches and truncation, preservation
of lyric details, numeric title ordering, equal-title ID ties, rename/update/
delete behavior, Hangul initials, normalization, and the existing 3000-song
latency/yield check. Final counts, typecheck, lint, formatting, build and CI go
with the submission.

## Checked in the app

Pending the required offscreen CDP check before submission.

## Changes outside my paths

- `src/main/search/` and tests: prep-owned shared index used by toolbar,
  library, and QuickAdd. The lead explicitly assigned P03 to this member.
- `src/shared/schema/librarySearch.ts`: data-owned comment only, correcting the
  old title-first description; payload shape and validation are unchanged.
- `docs/spec/05-prep.md` and this review record belong to this member.
