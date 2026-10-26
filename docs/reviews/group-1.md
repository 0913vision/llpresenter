# Review request: `group-1`

- Team member: `group`
- Branch: `docs/group/plan`
- Base commit (`main`): `dacaf400eb6b8840504504ec94b426dfd0205380`
- Related brief: `.llp/restart.md` / `docs/briefs/data.md`
- CI pending.

## What changed and why

Creates the implementation plan `docs/plans/grouped-songs.md` for activating
ProPresenter-style grouped songs end-to-end across the store, IPC, song editor,
예배 순서 구성 chips, and projection to the 진행 tiles, following the user's
October 27 decision ("Follow ProPresenter where qa-12 found a difference").

The plan includes:

1. Context and baseline audit of merged foundation pieces (spec 02/05,
   `groupedSong.ts`, `songGroupMigration.ts`, `slideHotKey.ts`,
   `showService.ts`).
2. Detailed file format comparison (v1 vs v2) and first-read migration behavior
   (`migrateSongGroups`), demonstrating that existing user libraries convert on
   first read without losing a slide, a label, a repeat, or an unknown field.
3. Complete code audit of every file reading/writing songs across shared
   contracts, main store, search index, live recovery, 진행 tiles projection,
   song editor, service item panel, and text import.
4. Detailed division of work into 7 focused review requests (`group-2` to
   `group-8`), each budgeted near 600 lines with explicit file owners, paths,
   tests, and double-review requirements for store/format units.
5. Explicit open questions for the lead regarding editor hotkey UI, text import
   drafting, and unnamed group chip display.

## Changed files

- `docs/plans/grouped-songs.md`: End-to-end activation plan for grouped songs.
- `docs/reviews/group-1.md`: This review request.

## Checks run

| Command or test        | Result |
| ---------------------- | ------ |
| `npm run typecheck`    | Passed |
| `npm run format:check` | Passed |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run typecheck` passes
- [x] `npm run format:check` passes
- [x] The change is small, focused, and thoroughly documented
- [x] Open questions are explicitly surfaced for the lead rather than guessed

## Decisions I made (for the lead to confirm)

- Structured the rollout into 7 downstream requests (`group-2` to `group-8`) of
  ~520 to ~620 lines each, keeping store/format units isolated for the required
  double-review process.
- Staged shared contract updates in `group-2` and store activation in `group-3`
  so consumer components can adopt the validated schema cleanly without
  divergence.

## Shared contract change requests

None in this planning document. Downstream contract modifications are specified
in `docs/plans/grouped-songs.md`.

## Where to look

- `docs/plans/grouped-songs.md`: Section 2 (Format & Migration), Section 3
  (Audit), Section 4 (Request Breakdown), and Section 5 (Open Questions).

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1.
