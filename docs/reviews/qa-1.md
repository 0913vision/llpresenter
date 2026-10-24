# Review request: `qa-1`

- Team member: `qa`
- Branch: `docs/qa/m1-plan`
- Base commit (`main`): `8b5edaa`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/qa.md` (task 2)

## What changed and why

This change adds the M1 test plan, `docs/qa/m1-plan.md`, so that the lead can
check its coverage before the freeze. No code, configuration, or dependency
changed.

The plan has:

- The scope, the build under test (tag `m1`), and the test environment,
  including a window size matrix of 1280×720, 1920×1080, and 2560×1440 at 100%,
  125%, and 150%, plus the sizes of the `Layout` table.
- The safety rules for QA runs (nothing on the user's screen, no `git push`,
  breakage only in a clean clone) and the procedures the cases use.
- How results and bugs are recorded, with a severity guide on top of the
  definitions in `docs/MILESTONES.md`.
- A coverage table from each acceptance criterion to its cases.
- 144 test cases in seven sections: V (install, checks, CI, version bot,
  pre-push hook, soak judge; 18), W (window, size classes, workspaces; 15), C
  (column widths, restarts, `app.json`; 23), G (gallery: 16 general cases and
  one case per component with three parts; 32), D (data formats: 18 common cases
  and one rule list per format; 36), B (shell against the design system; 6), and
  S (stability; 14).

## Changed files

- `docs/qa/m1-plan.md` (new)
- `docs/reviews/qa-1.md` (new)

## Checks run

| Command or test        | Result                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | Not run: the change has no code                                                              |
| `npm test`             | Not run: the change has no code                                                              |
| `npm run format:check` | Pass (`npx prettier --check` on both files)                                                  |
| `npm run verify`       | Pass, exit 0, on 8ce1abb (before the rebase onto 8b5edaa, which changed only lead documents) |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

Not applicable: documents only. The plan follows the Google developer
documentation style and has no middle dots or em dashes.

## Decisions I made (for the lead to confirm)

1. **Display scaling is emulated.** Windows scaling is a system setting, which
   `CLAUDE.md` forbids changing, so the plan runs Electron with
   `--force-device-scale-factor` and sets sizes in CSS pixels. Runs taller than
   the monitors here (S6, S8, S9) fall back to an emulated viewport and are
   marked as such.
2. **The pre-push hook is run directly**, with the arguments and standard input
   that git passes, instead of through `git push`, because members never run
   `git push`.
3. **"Record" instead of a guess.** Where the sources set no expected result
   (about 25 data rules, such as a `current` Look that names no Look), the case
   records the behavior as a question for the report, not as a bug.
4. **Severity guide.** A missing gallery state or a lost restart width is major
   (a criterion doesn't work); growth in memory or listeners with repetition is
   major; a broken file or lost unknown fields on write is a blocker (data
   loss).
5. **Card server port 5289**, so it doesn't clash with ui's 5296.

## Shared contract change requests

None.

## Where to look

Questions for the lead:

1. **QA tools.** The plan keeps the QA launcher, the CDP driver, and the schema
   harness in `.llp/qa/` (ignored by git), outside the team's lint, type check,
   and tests, and lists every input in the report. Should they be committed
   instead (for example under `docs/qa/tools/`), which would put them under lint
   and the format check?
2. **Real scaling.** Can the user do one spot check at a real 125% and 150% (S1,
   S2, and a drag) after QA's emulated runs? QA can't change the setting.
3. **Section B.** The menu bar and status bar still carry TODOs, and M1 doesn't
   list moving the shell to the ui components. Do failures in section B count
   for M1, or go to the M2 backlog?
4. **Section S and data-4.** S4 (control window crash), S9 (IPC flood), and D17
   (malformed live commands) test the scaffold and data-4 beyond the criteria.
   Keep them in M1?
5. **Broken `app.json` (C19).** Spec 02 says not to touch a broken file. Should
   the first drag after starting with a broken `app.json` overwrite it, or
   should saving wait until the operator acts in a way the spec defines? The
   plan records the behavior for now.

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
