# Review request: `tools-2`

- Team member: tools
- Branch: `feat/tools/bible-field`
- Base commit (`main`): `d91ae981`
- Round-1 code commit: `76daa32f`; the round-2 report gives the fixed head and
  its matching CI run.
- Related brief: `docs/briefs/tools.md`, M3-T4b
- Stack: started on tools-1, then rebased onto main after its merge as the lead
  requested. The next panel draft is on `feat/tools/bible-panel`.

## What changed and why

The Bible reference field now uses the tools-1 API for book suggestions and
resolved passages. It exposes separate preview and output callbacks, so valid
input opens a preview while Enter uses the same output callback the panel's 바로
띄우기 button will use. Enter on a different pointed suggestion chooses that
suggestion first; clicking a suggestion also only chooses it.

The popup has 구절 and 최근 groups, arrow navigation, stable pointed keys, the
resolved suggestions' verse counts, and recent passages capped and deduplicated
at ten. IME Enter remains with composition. The popup retains input focus on
click, closes on outside presses, scrolls and resizing, and lives in the shared
popover layer so a scrolling panel cannot clip it. Existing field styling and
error tooltips supply the invalid-reference reason without inline text.

The lookup runner keeps one active request and one replaceable waiting input.
Old responses, cleared queries, removed translations, and unmounted fields
cannot trigger a preview or output. A failed request logs its cause and shows
the field reason; the next request can recover.

The tools-1 nit is also fixed. Expanding a short book name can exceed the reply
limit even when the input is valid. Oversized suggestions are now dropped before
reply validation. The reported 256-character input still resolves, and an
expanded suggestion exactly at the limit is retained.

## Changed files

- `src/renderer/src/show/bible/BibleReferenceField.tsx` and its stylesheet and
  test: reference entry, keyboard choices, bounded recents, and callback flow.
- `src/renderer/src/show/bible/BibleSuggestions.tsx`: viewport placement,
  pointer selection, focus preservation, tooltip truncation, and cleanup.
- `src/renderer/src/show/bible/LatestLookup.ts`, its test, `useBibleLookup.ts`,
  and `testBible.ts`: coalesced reads, stale-result protection, and fixtures.
- `src/main/bible/lookup.ts` and `lookup.test.ts`: tools-1 boundary nit and
  normalized suggestion identity and counts from the existing reference parser.
- `src/main/bible/recents.ts`: re-export the extracted recent-list helpers so
  the existing main callers and tests retain their API.

## Changes outside my paths

- `src/shared/bibleRecents.ts`: move the pure recent-list helpers here so the
  renderer reuses the same deduplication, cap, and unknown-field preservation.
- `src/shared/schema/bibleLookup.ts` and its test: optional `resolved` metadata
  on suggestions, with a nonblank reference capped at 256 characters and an
  integer verse count capped at 40,000. Existing payloads remain valid.
- `docs/reviews/tools-2.md`: this request.

## Mount contract and following request

`BibleReferenceField` receives the Bible API, chosen translation, recent list,
and `onPreview` and `onShow` callbacks. Tests exercise these callbacks directly.
The field's application mount belongs to the next panel request, which also
supplies the preview, output, and history persistence. Keeping that connection
separate keeps panel state and output navigation in their own request.

The following `feat/tools/bible-panel` branch already contains the
`BibleQuickField` mount in `src/renderer/src/shell/Workspace.tsx`, the temporary
Bible slide source, and serialized recent writes. It is not part of this review
and has its own tests and review document, `tools-3.md`. It will be restacked
after this fix; full panel settings remain later units. Its request lists the
mount and other shell-owned changes explicitly.

## Checks run

| Command or test                             | Result                                                |
| ------------------------------------------- | ----------------------------------------------------- |
| `npm run typecheck`                         | Passed after rebase and on the separated field branch |
| Focused Vitest run                          | Round 2 passed: four files, 47 tests                  |
| ESLint on all changed TypeScript files      | Passed                                                |
| `npm run format` and `npm run format:check` | Passed                                                |
| `git diff --check`                          | Passed                                                |
| `npm run verify`                            | Round 1 passed; round-2 head CI is in the report      |

Round-1 code CI passed at `76daa32f`:
[GitHub Actions run 40260433217](https://github.com/0913vision/llpresenter/actions/runs/40260433217).
The round-2 member report supplies the matching fixed head's CI run. The full
verify is run on GitHub, not locally.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] Round-1 GitHub verify passed; fixed-head CI is supplied with round 2.
- [x] Type checking, focused tests, lint, and formatting pass.
- [x] Every added behavior has unit tests.
- [x] IPC uses the existing validated lookup boundary.
- [x] No unsafe assertions, `any`, or non-null assertions.
- [x] Popup listeners are removed, and pending reads cannot publish after close.
- [x] Suggestions, recents, and waiting reads have caps.
- [x] Preview never invokes the output callback.
- [x] Comments, design tokens, and commits follow `CLAUDE.md`.

## Decisions I made (for the lead to confirm)

- Keep recent writes and the application mount with the panel connection.
- The main parser supplies each valid suggestion's canonical identity and count.
  Incomplete book suggestions omit this optional metadata.
- Escape closes an open suggestion list first, then uses the field's normal
  clear and blur behavior.

## Shared contract change requests

Add optional `suggestions[].resolved` with `ref` and `verseCount`. The shared
schema, valid and invalid boundary tests, and main producer are in this request.

## Where to look

Review current-versus-pointed Enter behavior, async result coalescing, stable
selection while books arrive, and the max-length suggestion regression test.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex, codex5): Request changes: a chosen suggestion pinned the
  translation, and the raw-text comparison mistook the current passage for
  another suggestion.
- Round 2 (0562b6d4): reviewer (Codex, codex5) Approve, no findings. Lead
  Approve. Written by the Codex tools member. Rebased by the lead onto local
  `main` without conflicts; typecheck passes.

## Team member's reply

1. P2 translation override: addressed by tying the local suggestion choice to
   the current parent translation and resetting it during render when that prop
   changes. Input text remains intact; `undefined` disables the field and
   cancels pending lookup. Book and recent selection regressions cover changing
   the translation, removal, and reintroduction, including Enter while the new
   read is pending. Reply acceptance also checks current input and translation.
2. P2 raw reference comparison: addressed by resolving book suggestions with the
   existing main parser and returning their canonical reference and verse count.
   Enter compares canonical reference plus translation; displayed counts use the
   returned metadata. Renderer and main tests cover `요 3장 16절` and
   `요 3장 16-18절`, with one Enter outputting the pointed current passage.

Round-2 fast checks passed: typecheck, four Vitest files with 47 tests, and
changed-file ESLint. All package tools run with `npx --no-install` or repository
npm scripts. The fixed head's GitHub CI URL and result are in the round-2
report.
