# Review request: `output-32`

- Team member: `output`
- Branch: `fix/output/bench-uuid`
- Base: `afd7cfa4` (`main`); range: `afd7cfa4..fix/output/bench-uuid`.
- Fix commit: `77c4b10f`. CI:
  [40250575577](https://github.com/0913vision/llpresenter/actions/runs/40250575577).
- Scope: a merge repair; local `main` failed `npm run typecheck`.

## Cause

data-45 (`3b4b14f1`) added two `uuid(999)` uses to
`scripts/bench/liveAdmission.test.ts`. output-29 (`9964ff0e`, rebased onto
data-45 at merge) moved the `uuid` helper, with data-42's bench fixtures, into
`scripts/bench/liveFixtures.ts`. The rebase had no text conflict, so only a type
check showed the two "Cannot find name 'uuid'" errors. `origin/main` was never
affected.

## Changed files

- `scripts/bench/liveFixtures.ts`: export `uuid`, with a TSDoc line.
- `scripts/bench/liveAdmission.test.ts`: import it with the fixtures.

## Changes outside my paths

Both files are data's bench harness; the fix restores what output-29's move
broke.

## Checks run

- The lead ran the node type check on `77c4b10f` locally: pass.
- `npx prettier --check` with the repository config on both files: pass.
- GitHub CI: run 40250575577 (see the link above).

## Review

A merge repair reviewed by the lead, without a Codex round (lead decision).

## Verdicts (recorded by the lead at merge)

- Round 1 (a66efae0): lead review as a merge repair, no Codex round (lead
  decision: main failed typecheck after data-45 and output-29 landed with a
  clean text rebase). Lead Approve: the export and import are exactly what the
  two `uuid` uses need; `npm run typecheck` passes on main after the merge.
  Rebased by the lead onto local `main` without conflicts.
