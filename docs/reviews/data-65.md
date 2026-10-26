# Review request: `data-65`

- Team member: data
- Branch: `feat/data/bible-chunk-lookup`
- Base commit: `4f2d1b7b` on local `main`, including approved `data-63` and
  `data-64`. The member report supplies the final range, head and CI URL.
- Related decision: October 26, chunked Bible files and prepared translations
  delivered with app updates; specification request `data-62`.

## What changed and why

The lookup session previously loaded every verse of every installed v1 JSON
translation on its first request. It now primes the v2 header catalog when the
session starts. A valid lookup reads only its required chapters through the
shared, bounded cache from `data-64`. The whole-file runtime loader is removed.

Passage resolution first plans the complete range using header verse counts.
Missing books, invalid chapters or starting verses, reversed ranges and the
existing 40,000-verse request limit fail before any chapter read. Resolution
then reads each planned chapter and retains original verse numbers when skipping
omitted slots. Existing grammar, reference normalization, endpoint rejection,
translation-language display and lookup reply schemas remain intact.

Suggestions await indexed passage resolution to retain their canonical refs and
counts. Book-only suggestions use canonical metadata without chapter reads.
Requests remain serialized and capped at eight. Failed files warn once for the
lookup session, including catalog reloads. Disposal clears the active catalog,
discards late startup loads and rejects requests whose reads finish after close.

Runtime files must now be prepared v2 containers, as specified in `data-62`. The
legacy v1 parser remains available for the separate build-time converter; the
running app never converts or rewrites translation files. The converter is the
next request. No Bible text or dependencies are added.

## Changes outside my paths

The seven main TypeScript files are in `src/main/bible`, owned by tools. The
user explicitly assigned this reader to data. `library.ts`, `lookup.ts` and
`reference.ts` connect indexed IO to the existing lookup API. Their tests and
`testFiles.ts` use invented text and in-memory chapter sources. No IPC or
preload contract changes are needed.

`src/renderer/src/show/bible/BibleReferenceField.test.tsx` and
`src/renderer/src/prep/service/QuickAdd.test.tsx` directly exercise the real
resolver for endpoint rejection. These tools-owned tests now use the same
in-memory passage source and await resolution; product renderer code is
unchanged.

## Checks

- Grammar, passage library, lookup session and IPC registration tests: count and
  final results in the report.
- Node TypeScript check, changed-file ESLint, formatting and diff checks: final
  results in the report.
- Full `npm run verify`: GitHub CI on the final request head; URL in report.

Initial CI run 40312316100 on `61cbf9ed` failed because the two renderer test
files above still called the former synchronous resolver with a v1 fixture.
Their six endpoint cases now await the indexed resolver with `passageSource`.
The second main-build quiet window pauses local checks for this follow-up;
GitHub CI checks the corrected candidate.

Coverage retains both reference grammars, numbered and ambiguous book names,
IME-off input, normalized ranges and omitted verse behavior. New integration
coverage checks startup indexing without chapter IO, requested chapter spans,
invalid bounds without reads, the exact verse-count limit and over-limit
rejection, cached reads, late file failure, warning deduplication across
reloads, legacy runtime rejection, queued work and disposal during index/read.

## Decisions I made for review

1. Make internal passage resolution asynchronous while retaining the external
   lookup request/reply API. Plan all chapter spans before beginning IO.
2. Preserve main's newly merged endpoint rejection and shared book metadata
   imports while resolving rebase conflicts. Both start and end bounds are
   checked against header counts before disk reads.
3. Use a breaking-change commit because runtime translation storage switches
   from legacy JSON to the approved v2 container.

## Team member's reply

1.

## Verdicts (recorded by the lead at merge)

- Round 1 (dfb2969d): reviewer (Codex) Approve. Lead Approve; the third Bible
  reader slice, after data-62 to data-64 (see "What changed and why"). Rebased
  by the lead onto local `main` without conflicts; typecheck passes.
