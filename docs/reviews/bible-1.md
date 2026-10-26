# Review request: `bible-1`

- Team member: bible
- Branch: `feat/bible/four-field-input`
- Base and reviewed head: recorded in the member report after rebase.
- Related brief: `docs/briefs/tools.md`; scope: `.llp/restart.md`.

## What changed and why

Prepare the shared four-field Bible input with complete canonical book
candidates, translation-specific bounds, and synchronous field validation. The
existing parser keeps its exact-name priority and eight-suggestion cap; the new
form matcher returns every containment match, including matches beside an exact
abbreviation. Exact and unique completion are separate from the list.

The lookup reply gains optional `bounds`, containing the selected book ID and
verse-slot counts per chapter. It reads the installed header without loading
chapter text, so omitted verses cannot shorten a chapter's valid range. The
additive schema validates positive counts and caps the book ID, chapter count,
and verse counts. Old replies without bounds remain valid.

The pure form model validates the book, chapter, start, and optional end. An
oversized end blocks Tab but builds a lookup ending at the final verse. A
reversed or malformed range cannot build a lookup. Changing the start clears the
end. Spec 02 distinguishes this form from the stored reference grammar.

## Changes outside my paths

- `src/shared/bibleMatching.ts` and its new tests expose the uncapped form
  matcher without changing existing parser behavior.
- `src/shared/schema/bibleLookup.ts` and tests add optional bounded metadata to
  the existing reply. No channel, request, or existing field changes.
- `docs/spec/02-data.md` records the user's four-field decision and metadata.

## Checks run

- `npm run typecheck`: passed.
- Scoped ESLint, Prettier and Vitest: results in the member report.
- GitHub `npm run verify`: exact head, run URL and result in the member report.
- No full local verify, app launch, dependencies, Bible text, or crawl output.

## Quality and review focus

Tests cover all containment candidates beyond eight, exact and ambiguous
selection, jamo and IME-off input, integer and endpoint validation, empty end,
clamping versus Tab refusal, stale book bounds, and clearing the end. IPC tests
accept old replies and reject invalid or oversized metadata. The lookup-session
test checks a book-only request with a chapter-read spy.

No new subscriptions, timers, queues, or caches. Metadata is at most 150
positive counts and is derived from already validated headers. The existing
eight-result IPC suggestions retain their contract. The UI connection follows in
bible-2, then 준비 quick add in bible-3.

## Decisions made

- Keep the stored/API reference grammar unchanged; the form alone clamps its
  single-chapter endpoint, as the October 26 decision requires.
- Leave Shift Tab available for backward navigation.

## Verdicts

Recorded by the lead at merge.

## Verdicts (recorded by the lead at merge)

- Round 1 (2f82f53c): reviewer (Codex) Approve. Lead Approve; the first slice of
  the four-field Bible input (the shared model with copible's candidate and Tab
  rules), per the user decisions of October 26. The exact-head CI run passed,
  checked by the lead at merge. Rebased by the lead onto local `main` without
  conflicts; typecheck passes.
