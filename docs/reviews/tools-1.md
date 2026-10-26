# Review request: `tools-1`

- Team member: tools
- Branch: `feat/tools/quick-bible`
- Base commit (`main`): `01735790`
- Last code commit: `4c083fd3`; the member report gives the request head and its
  matching CI run.
- Related brief: `docs/briefs/tools.md`, M3-T4b

## What changed and why

T4a supplies offline parsing, matching, and a library, but has no renderer API
or main-process registration. This first T4b request adds that prerequisite in
697 added lines, before the field, suggestions UI, and Bible panel requests.

`window.llp.bible.lookup` returns normalized passage text, reference problems,
and up to eight canonical book suggestions. Suggestions retain the typed range
and use T4a's Korean, English, and keyboard matching. A lookup never changes
live output, recent passages, or a service document.

Main waits for settings and lazily loads the installed `.llbible` files from the
app data folder. It reuses loaded text until installed IDs or filenames change.
Reads serialize behind one queue capped at eight outstanding requests. Closing
the registration rejects queued work and releases retained text, including a
library whose disk read completes after shutdown.

Both IPC directions validate payloads. Replies must name the requested input and
translation, including the resolved passage's translation. Input and reference
strings and translation IDs cap at 256 characters, suggestions at eight,
returned verses at 40,000, and each verse at 20,000 characters. Unknown IPC
fields are dropped.

New settings now name `krv.llbible` and `kjv.llbible`; the old `.json` default
filenames were rejected by T4a's loader. Existing settings entries are
preserved. No translation text or Bible database is included in this request.

## Changed files

- `src/main/bible/lookup.ts` and `lookup.test.ts`: serialized library access,
  cache invalidation, suggestions, lifecycle, and queue limits.
- `src/main/bible/register.ts` and `register.test.ts`: validated IPC
  registration, error logging, and handler cleanup.
- The paths below supply the shared contract, preload boundary, application
  wiring, and compatible starter settings.

## Changes outside my paths

- `src/shared/schema/bibleLookup.ts` and `bibleLookup.test.ts`: additive request
  and reply schemas with valid, invalid, and limit tests.
- `src/shared/ipc.ts`: the channel and typed renderer API.
- `src/shared/testing/fakeLlpApi.ts`: a default response for existing test APIs.
- `src/preload/index.ts` and `index.test.ts`: request validation and correlated
  reply validation through the existing invocation helpers.
- `src/main/index.ts` and `index.wiring.test.ts`: register Bible lookup with
  `dataStore.settings` and `<userData>/bible`, then stop it before data closes.
- `src/main/store/settingsDefaults.ts` and `settingsDefaults.test.ts`: align
  starter filenames with the accepted translation format.
- `docs/reviews/tools-1.md`: this request.

## Mount points

Main registration and shutdown are mounted and tested in `src/main/index.ts`.
The following T4b UI requests will include their mounts in shell-owned paths and
list them under changes outside my paths. This request has no renderer UI.

## Checks run

| Command or test                              | Result                                     |
| -------------------------------------------- | ------------------------------------------ |
| `npm ci`                                     | Passed; 277 packages, no audit findings    |
| `npm run typecheck`                          | Passed after rebase onto `01735790`        |
| Focused Vitest run                           | Passed: six files, 113 tests, after rebase |
| ESLint on all 14 changed code and test files | Passed                                     |
| `npm run format` and `npm run format:check`  | Passed                                     |
| `git diff --check`                           | Passed                                     |
| `npm run verify`                             | Passed on GitHub at code commit 4c083fd3   |

Code CI passed at `4c083fd3`:
[GitHub Actions run 40257535941](https://github.com/0913vision/llpresenter/actions/runs/40257535941).
The member report supplies the final request head's separate CI result. The full
verify was not run locally, per the member instructions.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] GitHub `npm run verify` passes.
- [x] Type checking, focused tests, lint, and formatting pass.
- [x] Every added behavior has unit tests, including IPC and startup wiring.
- [x] Cross-process values use schemas with limits.
- [x] No `any`, unsafe assertions, or non-null assertions.
- [x] Handler cleanup and pending-request disposal are tested.
- [x] The main-process cache is released and pending reads have a cap.
- [x] Lookup has no live output side effects.
- [x] Comments and commits follow `CLAUDE.md`.

## Decisions I made (for the lead to confirm)

- Split out the missing lookup bridge before the Bible field to keep each review
  near the requested 600 to 800 lines.
- Keep recent-passage writes on the existing settings API, after output or
  insertion in the upcoming UI request. Preview lookup does not write history.
- A rejected translation file is logged once per library load. Connecting those
  file problems to shell's notification UI remains a later integration.
- Cache keys track IDs and filenames. Replacing a file at the same installed
  path requires an app restart; translation import is outside this request.

## Shared contract change requests

Additive `bible:lookup`, with no changes to existing commands or file schemas.

## Where to look

Review `BibleLookupSession` shutdown and queue handling, the preload reply
correlation, and the default filename correction. Tests use invented text only.

## Review: lead

- Verdict:
- Findings:

## Review: reviewer

- Verdict:
- Findings:

## Team member's reply

None yet.
