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

## Verdicts (recorded by the lead at merge)

- Round 1 (447cb6a): reviewer (Codex, 0:6) Request changes: D3 crossed parsers
  that share the `llservice` format, G5 matched computed values against token
  literals, and G8 required focusable disabled samples against the TextField
  README.
- Round 2 (d9adfea): reviewer Request changes: S13 judged a 30-minute record
  with the 60-minute default, D26 lacked 매크로 payload cases, thresholds
  without a cited rule were treated as failures, and G6 missed the 퀵 실행 live
  bar.
- Round 3 (a9dad85): reviewer (Codex, 0:6) Approve, no findings. Lead Approve.
  The 매크로 default differences recorded in D26 are decided (spec 07 defaults;
  data changes the schema). Rebased by the lead onto `main` 159e0de without
  conflicts.

## Decisions confirmed by the lead

From the lead's answers to the questions above (2026-10-25). The plan follows
them in round 2.

1. QA tools stay in `.llp/qa/` for M1, uncommitted; the report lists every
   input. At the M2 freeze, the stable ones go to devops (`test/`). No code is
   committed under `docs/qa/`.
2. After QA's emulated runs, the lead asks the user for one spot check at a real
   125% and 150% (S1, S2, and a drag). The report gives the steps in Korean.
3. Section B isn't M1 work. Its failures are recorded as "known, M2 backlog".
4. S4, S9, and D17 stay. D17 is M1 (data-4). S4 and S9 are informative: their
   failures are filed, as blockers only if output stops or data is lost.
5. C19: the app never overwrites a broken `app.json` on its own. Widths changed
   in that session stay in memory, the file stays untouched, and one warning is
   logged. Replacing the file takes an operator action (settings window, M4).

## Team member's reply

Round 1 (Codex 0:6, Request changes). All three findings are addressed in round
2:

1. **D3 (`llservice` is shared).** Agreed. D3 now crosses only parsers whose
   `format` values differ, and says why services and 틀 aren't crossed. The date
   and time rules that tell them apart are now explicit: D21 fails a service
   without `date` or with a `time` in its place, and D22 passes a 틀 without
   `date`, checks `time` as `HH:mm`, and records a 틀 that has a `date`.
2. **G5 (computed values can't prove token use).** Agreed. G5 now reads the
   authored CSS rules as the dev server serves them and lists every literal
   value that isn't built from `var(--…)`, with a short list of allowed
   literals. Appearance stays in part (b) of each component case, and P-compare
   now compares under the same layout conditions as the card (a wrapper of the
   card sample's width, with the same content).
3. **G8 (disabled differs by component).** Agreed. G8 now checks the look and
   the tooltip for every component, and focus and the attribute as each README
   says: `aria-disabled` and focusable for Button, IconButton, ToolbarButton,
   disabled segments, and the AlertDialog primary button; pointed but not run
   for menu items; native `disabled` that Tab skips for TextField; either for
   ListRow; and "record" for the components whose READMEs set only the look.

I also applied the lead's decisions 3 and 5 to section B and C19.

Round 2 (Codex 0:6, Request changes). The three round 1 fixes and the B and C19
decisions were confirmed. The four new findings are addressed in round 3:

1. **S13 (judge for 30 minutes).** Agreed. S13 now runs
   `npm run soak -- --minutes 30 --judge <record.jsonl>`.
2. **D26 (매크로 actions).** Agreed. D26 now has a table with a valid payload
   and invalid payloads for each of the 12 action kinds in spec 07, and the
   expected error path `macros.<n>.actions.<m>.<parameter>`. Where spec 07 gives
   a default (the screen of 무대 화면 배치, the mode of 소품, the operation of
   타이머) or allows one 소품 in 레이어 지우기, a schema that requires the field
   or refuses the 소품 is recorded as a difference for the lead to decide.
3. **Thresholds without a source.** Agreed. D17 now counts as malformed only the
   inputs that the guards' rules reject, and records extra fields, a 1 MB text,
   and a `__proto__` key as observations (only prototype pollution fails). C23
   keeps the node and listener baseline (`CLAUDE.md`, release everything) and
   records the heap numbers. D12 records the parse time. I applied the same rule
   to two more cases with numbers of my own: S9 (the 100 ms round trip) and W12
   (the 50 ms long task) now record those values as observations.
4. **G6 (nit).** Added the 3px `live` bar of a 퀵 실행 row that is on.
