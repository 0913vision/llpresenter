# Review request: `spec-3`

- Team member: `spec`
- Branch: `docs/spec/m3-breakdown`, from `main` (not stacked)
- Base commit (`main`): `1f52d24`
- Shared files changed: none
- Last commit: see the commit that adds this file
- Related request: the lead's message of October 25 (M3 breakdown)

## What changed and why

This change adds `docs/plans/m3-breakdown.md`, a proposal that splits milestone
M3 (phase 3 of `docs/PLAN.md`: the prep, output, and tools bundles) into tasks
the lead can turn into briefs and the M3 section of `docs/MILESTONES.md`.

- **31 tasks** (the waiting lyric style task is split by owner), each with one
  owner, one or two review requests, its scope, the spec sections it implements,
  its owned paths, its dependencies on M2 work and other M3 tasks, and
  acceptance criteria that QA can test.
- **Owners** from the current members by area (data, output, shell, ui, devops,
  qa, spec), and three new members where they help most: prep (the 준비
  workspace, the largest bundle with no owner today), tools (진행 도구, 매크로,
  퀵 실행, Bible), and screens (the 화면 설정 UI, so that output stays on the
  main process and rendering).
- **No shared files between owners.** Every task lists its paths. The plan asks
  for the ownership changes this needs (new folders, and carving `show/tools/`,
  `show/quick/`, and `show/bible/` out of shell's `show/`), turns the live
  reducer and the layer renderer into registries in the first output task, and
  lists the one-line mount requests between owners.
- **Waiting parts kept apart.** Open settings questions 10 to 18 of
  `docs/spec/10-shortcuts-and-settings.md` are marked "Waits on". The 메시지
  style (13) and the lyric style additions (16, 17) are their own tasks (M3-X1,
  M3-X2a, M3-X2b); transitions (12), prevent sleep (10), and the media import
  defaults (14, 15) are behind one constant each in the tasks that use them.
- **Order:** four waves, the three longest dependency chains, and six open
  questions for the lead (new members, the carve-out, where audio plays, the
  copible data format, the utility process wiring, and the search budget).

The plan references sections of `docs/spec/10-shortcuts-and-settings.md` that
arrive with spec-1 round 2 ("Focus precedence", the settings inventory) and
spec-2 (the number field step note). It's branched from `main`, not stacked, so
it can merge on its own; the references hold once spec-1 and spec-2 merge, which
come before it in the merge queue.

## Changed files

| File                         | Change                    |
| ---------------------------- | ------------------------- |
| `docs/plans/m3-breakdown.md` | New. The M3 breakdown.    |
| `docs/reviews/spec-3.md`     | New. This review request. |

## Checks run

| Command or test           | Result                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`          | Pass: typecheck 4.1 s, lint 30.5 s, format:check 8.9 s, test:coverage 55.1 s (21 files, 185 tests), build 10.0 s; 108.7 s in all |
| Middle dots and em dashes | None in the changed files (checked with `grep -c`)                                                                               |

## Decisions I made (for the lead to confirm)

1. Three new members (prep, tools, screens), with fallbacks if the lead adds
   fewer.
2. The carve-out of `show/tools/`, `show/quick/`, and `show/bible/` from shell.
3. Audio plays in a hidden window owned by output, so a control window reload
   can't stop it.
4. A search budget of 50 ms for 3,000 songs.
5. `src/main/media/` goes to prep, so that media import and the media view have
   one owner.

## Where to look

- Whether any two tasks of different owners still touch the same file.
- Whether the acceptance criteria are concrete enough for qa.
- The waves and the longest chains against how fast M2 frees people.
