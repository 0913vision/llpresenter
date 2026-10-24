# Review request: `spec-3`

- Team member: `spec`
- Branch: `docs/spec/m3-breakdown`, from `main` (not stacked)
- Base commit (`main`): `86f5926`
- Shared files changed: none
- Last commit: see the commit that adds this file
- Related request: the lead's message of October 25 (M3 breakdown)

## What changed and why

### Round 2

Codex (0:6) requested changes, and the lead answered the plan's six questions.
Round 2 rewrites `docs/plans/m3-breakdown.md` around review requests: 50 rows,
each with one owner, its own scope, and its own dependencies.

1. **Screen output backend (finding 1).** New output requests M3-O9a (window and
   capture methods, live screen settings, sleep prevention) and M3-O9b (test
   pattern, monitor number windows, edge margin and offset), with contracts in
   the new M3-D1c, paths, dependencies, and criteria. M3-O1 keeps only the UI
   and its UI criteria; the cross-owner criteria are integration check IC-B1.
2. **Recovery cycle (finding 2).** The recovery interface (`recovery.summary`,
   `recovery.apply`, `recovery.startFresh`) is in M3-D1c. M3-O8 builds the
   backend without depending on the dialog; the dialog is M3-S2b, which depends
   on M3-O8. The notifications part (M3-S2a) has no recovery dependency.
3. **Per-request scope and waves (finding 3).** Every request has its own row.
   M3-T1a moved to wave C after M3-O6a (now wave B). M3-S1a sends `item.start`
   (a D1b contract it now depends on) and is accepted with a fake command sink;
   "the start 매크로 runs before the 장 draws" is integration check IC-C1 in
   wave C, after M3-T3a. Eleven integration checks sit in the waves where all
   their requests are merged.
4. **Registry bootstrap first (finding 4).** New M3-O0 in wave A, before M3-D1b
   widens `LiveCommand`. It describes registration (`defineSlice` modules
   collected with an eager `import.meta.glob`, unknown commands rejected and
   logged, layers the same way) and its acceptance test (a fake slice and layer
   added as new files work without editing existing files).
5. **Macro transactions (finding 5).** New output request M3-O10 implements
   `live.batch` (a D1b contract): one undo snapshot for all clears of a batch,
   skipped commands logged, one broadcast. M3-T3a runs a 매크로 as one batch and
   depends on M3-O10.
6. **Waiting tasks (finding 6).** M3-X1 and M3-X2 are split by owner: data for
   the stored fields, screens for the Look editor controls, output for
   rendering, each with owned paths, dependencies, and acceptance criteria.
7. **Question 17 (finding 7).** Question 17 is how often the Bible reference
   shows; it's now a dependency of M3-T4b's 참조 options. M3-X2's reference
   position depends on the 출처 위치 row of the settings proposal, which has no
   numbered question.
8. **The lead's six answers** are in a new "Lead decisions in this plan"
   section: prep and tools in wave B, screens decided at wave B with the
   fallback kept, the PLAN.md session cap reference dropped, the carve-out at
   the M2 freeze, audio in a hidden window owned by output marked as our design
   (no ProPresenter source describes it), M3-T4a waiting for spec-4 and the
   user's source choice, output wiring the utility process, and the search
   budget as a lead decision the user can change. The old "Open questions for
   the lead" section is gone.

### Round 1

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

Round 2, on the branch rebased onto `86f5926`:

| Command or test           | Result                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`          | Pass: typecheck 2.7 s, lint 25.3 s, format:check 42.2 s, test:coverage 70.9 s (50 files, 453 tests), build 7.4 s; 148.5 s in all |
| Middle dots and em dashes | None in the changed files (checked with `grep -c`)                                                                               |

Round 1:

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
