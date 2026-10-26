Review range: `e03c0e9f...feat/spec/problem-cards`

# Review request: `spec-46`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/problem-cards`
- Base: data-47 (`feat/data/save-retry`, `e03c0e9f`), which sits on main now
  that data-46 is merged; stacked until data-47 merges
- Review round: 2
- Task: M3-S2a part 3, the 파일을 읽을 수 없음, 매크로 적용 실패, and 저장할 수
  없음 cards on the app problem feed (lead, 10:1x and 10:5x)
- Code owners: data for `src/shared/` and `src/main/store/`; shell for the
  renderer

## What changed and why

Spec 08 lists "A file can't be read and was skipped" and "Save failed" among the
version 1 notifications, and spec-41 added 매크로 적용 실패. data-46 and data-47
built the app problem feed (`ProblemFeed`: `report` for one-shot problems,
`push` for a standing problem's change, `addStanding` for list sources;
`problems.subscribe`, `problems.list`, `problems.retrySaves` in the windows)
with the `macro-dropped`, `save-failed`, and `save-recovered` kinds.

**Contract (additive).** `AppProblem` gains `{kind: 'file-skipped', name}`,
where `name` is the file name without the folder, non-empty, and at most
`APP_PROBLEM_LIMITS.nameCharacters`. `fileSkippedProblem(file)` takes the name
from a Windows or POSIX path and cuts it at a whole character, like the other
helpers.

**Data store.** Skipped files happen while the data is read, before the control
window loads, so they are a standing problem. `SkippedFiles` keeps each skipped
file once, up to `APP_PROBLEM_LIMITS.listed`, and logs the overflow once.
`registerStore` adds it to the feed with `problems.addStanding` (after the
waiting saves, so the feed lists saves first) and starts
`startSkippedFileProblems`, which feeds it from the settings problem feed
(settings and media files, replayed to a new listener) and from the content
files read at startup (songs, 예배 순서, 틀, labels, preferences; the filter the
launch log already used, now one `contentProblems` function), and pushes each
new problem with `problems.push`. Both stop when the store is disposed.

**Renderer.** `useProblemNotices` subscribes first, then lists once, and shows:

- one 파일을 읽을 수 없음 card for every skipped file so far, keyed
  `file-skipped`, with the first name and how many more ("looks.json 외 2개")
  and 건너뜀. A file that arrives both by the list and by a push counts once.
- 매크로 적용 실패 with the 매크로's name (or 이름 없는 매크로), keyed
  `macro-dropped:<macroId>`, so the same 매크로 again replaces its card.
- 저장할 수 없음 with the oldest waiting file's name and how many more, keyed
  `save-failed`, with 다시 시도 calling `problems.retrySaves()`.
  `save-recovered` closes it. data-47 pushes save-failed again after an explicit
  retry that leaves files waiting, so the card comes back even though the
  session closed it on the button press.

## Round 2 response

1. **A late list no longer brings back a resolved save warning.** Once a
   `save-failed` or `save-recovered` push has arrived, the initial list's save
   state is ignored, since the push is newer; skipped files and unread 매크로
   drops from the list still show. Test: the list is held back, a push of 저장할
   수 없음 and then of `save-recovered` arrives, and the late list with the old
   `save-failed` shows no card.
2. **Skipped files are told apart by a stable id.** `file-skipped` now carries
   `fileId`, a whole number from 1 to `APP_PROBLEM_LIMITS.listed` that
   `SkippedFiles` gives each file once for as long as the app runs, separate
   from the display `name`. The card counts by id. Tests: two files with the
   same base name in different folders, and two long names that clip to the same
   text, each count as two; the schema rejects a missing, zero, fractional, or
   out-of-range id.
3. The private `contentProblems` explains itself with a NOTE.

Restacked onto data-47's tip `26401936`, which now sits on main; `App.tsx` keeps
both notification hooks (spec-45's and this one), and this hook takes spec-45's
`NoticeTarget` type now that it's on main.

## Decisions I made (for the lead to confirm)

1. One card for all skipped files instead of one per file. A broken folder can
   skip dozens of songs at once, and the stack shows only three cards; one card
   keeps a lost monitor card from being pushed out.
2. Song and 예배 순서 files are named by their file name (`<id>.llsong`), since
   a file that couldn't be read has no title to show.
3. The 매크로 card uses the `macro` icon and 저장할 수 없음 the `warning` icon,
   as the gallery does; spec 08 names none.

## Changes outside my paths

data keeps:

- `src/shared/schema/appProblem.ts` and `.test.ts`: the `file-skipped` kind,
  `fileSkippedProblem`, valid and invalid cases. The old invalid case
  `{kind: 'file-skipped', ...}` became an unknown kind.
- `src/main/store/skippedFiles.ts` and `.test.ts` (new): `SkippedFiles` and
  `startSkippedFileProblems`.
- `src/main/store/register.ts` and `.test.ts`: the standing source, the feed
  start and stop, and the shared `contentProblems` filter; tested with a broken
  song and a broken settings file, listed and pushed once each.

Shell keeps `src/renderer/src/control/notifications/` and `App.tsx`.

This review document is in my own path. No dependency is added.

## Validation

| Command or test                                                                                                                                           | Result                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `npm run typecheck`                                                                                                                                       | Pass                   |
| `npx vitest run --no-fsModuleCache src/main/store src/main/problemFeed.test.ts src/shared/schema/appProblem.test.ts src/renderer/src/control src/preload` | Pass, 563 tests        |
| `npx eslint --max-warnings 0` on the changed files                                                                                                        | Pass                   |
| `npx prettier --check` on the changed files                                                                                                               | Pass                   |
| GitHub CI (`npm run verify`)                                                                                                                              | In the request message |

No Electron process, visible window, soak, or memory measurement was started.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex, codex5): Request changes: a late initial list could bring back
  a resolved save warning, and skipped files with the same display name were
  merged; private TSDoc.
- Round 2 (34e08599): reviewer (Codex, codex5) Approve, no findings. Restacked
  afterwards on data-47's final tip; `git range-diff` shows only the review
  document's range line changed. Lead Approve. Changes outside 진행's paths
  (data's `appProblem.ts`, `store/skippedFiles.ts`, `store/register.ts`) checked
  against data's rules. Rebased by the lead onto local `main` without conflicts;
  typecheck passes. M3-S2a is complete.
