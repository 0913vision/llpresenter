# Brief: qa

- Session name: qa
- Branch: `docs/qa/<milestone>-<topic>` for each report (own worktree)
- Dev server port: 5189; app data folder: `D:\llp-dev\qa`
- Phase: every milestone, starting with M1

## Goal

Be the team's quality assurance. For each milestone in `docs/MILESTONES.md`,
test the frozen milestone tag against its acceptance criteria and the spec, the
way an operator would use the app during a service, and report every bug so that
it can be fixed before the user sees it. You don't fix code; you find,
reproduce, and describe.

## Tasks

1. Rewrite `.llp/notes.md` for this role.
2. **Before the freeze (now for M1):** write the test plan `docs/qa/m1-plan.md`:
   one test case per acceptance criterion and per relevant spec rule, each with
   steps, the expected result, and the source (`docs/spec/...`, a design system
   README, or `docs/MILESTONES.md`). Include the window sizes (1280×720,
   1920×1080, 2560×1440), Windows display scaling (100%, 125%, 150%) where you
   can, and restarts. Send it as review request `qa-1` so the lead can check its
   coverage.
3. **After the freeze:** the lead tells you the tag (`m1`). Check it out
   detached in your worktree (`git switch --detach m1`), run `npm ci`, and run
   every test case: the app itself (`LLP_DEV_PORT=5189`,
   `LLP_USER_DATA=D:\llp-dev\qa`), the gallery, `npm run verify` on a clean
   clone, and the CI and version bot results on GitHub. Drive the app through
   the Chrome DevTools Protocol where a script helps; keep windows offscreen or
   unfocused so nothing pops up on the user's screen, and check any script with
   `node --check` before it starts Electron.
4. **Report:** `docs/qa/m1-report.md` with the result of every case (pass, fail,
   blocked), and one entry per bug: id (`M1-<n>`), severity (blocker, major,
   minor, cosmetic, as defined in `docs/MILESTONES.md`), area and owner, steps
   to reproduce, expected and actual results, the build (tag and version), and
   screenshots or logs saved under `docs/qa/m1/` when they help. Send each
   blocker or major bug to the lead at once with SendMessage, not only at the
   end.
5. **Retest:** when fixes merge, retest them on `main` and update the report.
   Sign off when no blocker or major bug is open.
6. Then write the next milestone's test plan.

## Out of scope

- Changing app code, tests, or configuration. Suggest a test that would have
  caught a bug in the report, and the owner adds it.

## Owned files

- `docs/qa/` and `docs/reviews/qa-<number>.md`

## What to read

- `CLAUDE.md`, `docs/WORKFLOW.md`, `docs/MILESTONES.md`
- `docs/spec/` (behavior), `design/system/project/README.md` and the component
  READMEs (look and states), `docs/TECH.md` (quality bar)

## Done when

- Each milestone has a plan, a report, and a sign-off, merged into `main`.

## How to verify

- `npm run format:check` for your documents.

## When you finish a document

Rebase onto the latest `main`, run the check, commit, and send the lead:

```text
Review request: docs/reviews/qa-<number>.md, branch docs/qa/<milestone>-<topic>, commit <hash>
```
