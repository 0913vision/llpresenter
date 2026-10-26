# Review request: `bible-2`

- Team member: bible
- Branch: `feat/bible/reference-form`
- Stack: bible-1, `feat/bible/four-field-input`.
- Base and reviewed head: recorded in the member report after rebase.
- Related brief: `docs/briefs/tools.md`; four-field restart task.

## What changed and why

Add the shared four-field component for 진행 and 준비. This request builds and
tests the component; bible-3 mounts it in both operator flows and records the
real-app checks. Existing operator screens still use their previous inputs in
this request.

책 lists all canonical containment matches with no initial selection. Tab
completes an exact name or unique candidate immediately, even while lookup is
pending. Ambiguous input stays until an arrow or click chooses a book. Valid Tab
advances through 장, 시작절, and optional 끝절. Invalid values retain focus with
a short Korean reason in the existing field tooltip. Shift Tab and IME keys
retain their normal behavior.

Book-only lookups read bounds, independently of the passage lookup. Each reader
keeps one request in flight and one replaceable pending input. A new book or
translation cannot reuse the old bounds or passage. Valid input previews without
output. Enter submits the current passage once; repeat and composition Enter do
not submit. An oversized end blocks Tab but queries the clamped range and
normalizes the field on Enter. Changing the start clears the end.

## Changed files

- `BibleReferenceForm.tsx`: shared component.
- `BibleReferenceField.module.css`: token-based four-field grid.
- `BibleReferenceForm.test.tsx`, `testing/referenceForm.ts`: real reference
  resolver with invented translation data and interaction tests.

## Changes outside my paths

None.

## Checks run

- Scoped Vitest: 18 tests passed.
- Typecheck, ESLint, formatting and exact-head GitHub verify: final results in
  the member report.
- No full local verify, dependency changes, Bible text, or crawl output.

## Checked in the app

This request does not mount or replace an operator-facing control. The mounted
Show and Prep flows, repeated selection and open/close checks, memory and DOM
observations, and screenshots belong to bible-3.

## Quality and review focus

Check exact selection beside other containment matches, ambiguous Tab without an
initial highlight, async translation replacement, tooltip-only validation, and
endpoint clamping. The test fixture uses the real resolver. No new queue or
cache implementation, and the lookup hook and suggestion popup release their
readers and listeners on unmount.

## Team member's reply

1. Addressed the round-1 P2 finding. Forward Tab now checks the same completed
   availability result that marks 책 with 역본에 없는 책. If the candidate is
   the book covered by that result, focus stays on 책. A pending lookup still
   permits immediate exact or unique completion; selecting a different candidate
   can begin its own lookup without reusing the previous book's failure.
   Regression tests use 시편, absent from the invented translation, and cover
   both an already completed failure and a reply arriving after immediate Tab
   completion. The mounted bible-3 branch will inherit this fix when restacked.

## Verdicts

Recorded by the lead at merge.
