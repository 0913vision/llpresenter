# Review request: `tools-2`

- Team member: tools
- Branch: `feat/tools/bible-field`
- Base commit (`main`): `d91ae981`
- Last code commit: `76daa32f`; the member report gives the request head and its
  matching CI run.
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
current passage's verse count, and recent passages capped and deduplicated at
ten. IME Enter remains with composition. The popup retains input focus on click,
closes on outside presses, scrolls and resizing, and lives in the shared popover
layer so a scrolling panel cannot clip it. Existing field styling and error
tooltips supply the invalid-reference reason without inline text.

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
- `src/main/bible/lookup.ts` and `lookup.test.ts`: tools-1 boundary nit.
- `src/main/bible/recents.ts`: re-export the extracted recent-list helpers so
  the existing main callers and tests retain their API.

## Changes outside my paths

- `src/shared/bibleRecents.ts`: move the pure recent-list helpers here so the
  renderer reuses the same deduplication, cap, and unknown-field preservation.
- `docs/reviews/tools-2.md`: this request.

## Mount contract and following request

`BibleReferenceField` receives the Bible API, chosen translation, recent list,
and `onPreview` and `onShow` callbacks. Tests exercise these callbacks directly.
The field's application mount belongs to the next panel request, which also
supplies the preview, output, and history persistence. Keeping that connection
separate holds this code change to 761 additions instead of mixing panel state
and output navigation into the reusable field.

The local draft `feat/tools/bible-panel` at `b56bf2d9` already contains the
`BibleQuickField` mount in `src/renderer/src/shell/Workspace.tsx`, the temporary
Bible slide source, and serialized recent writes. It is not part of this review
and still needs its tests and full panel controls. That request will list the
mount and its other shell-owned changes explicitly.

## Checks run

| Command or test                             | Result                                                |
| ------------------------------------------- | ----------------------------------------------------- |
| `npm run typecheck`                         | Passed after rebase and on the separated field branch |
| Focused Vitest run                          | Passed: four files, 21 tests                          |
| ESLint on all changed TypeScript files      | Passed                                                |
| `npm run format` and `npm run format:check` | Passed                                                |
| `git diff --check`                          | Passed                                                |
| `npm run verify`                            | Passed on GitHub at code commit 76daa32f              |

Code CI passed at `76daa32f`:
[GitHub Actions run 40260433217](https://github.com/0913vision/llpresenter/actions/runs/40260433217).
The final member report supplies the matching request head's separate CI run.
The full verify was not run locally. The anonymous status script hit GitHub's
HTTP 403 rate limit, so the authenticated GitHub connector supplies CI status.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] GitHub `npm run verify` passes.
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
- Only a valid current passage shows its verse count in this first field unit;
  per-candidate counts can extend the lookup reply in the panel request.
- Escape closes an open suggestion list first, then uses the field's normal
  clear and blur behavior.

## Shared contract change requests

None. The extracted helper has the same runtime behavior and main re-exports.

## Where to look

Review current-versus-pointed Enter behavior, async result coalescing, stable
selection while books arrive, and the max-length suggestion regression test.

## Review: lead

- Verdict:
- Findings:

## Review: reviewer

- Verdict:
- Findings:

## Team member's reply

None yet.
