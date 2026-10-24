# Review request: `spec-11`

- Review range: `1b4b72b...docs/spec/fit-overflow`
- Team member: `spec`
- Branch: `docs/spec/fit-overflow`, from `main` (not stacked)
- Base commit (`main`): `1b4b72b`
- Shared files changed: none
- Last commit: see the commit that adds this file
- Related request: the nit from spec-10 round 2 (codex4)

## What changed and why

### Round 1

spec-10's reviewer asked that 03 "Drawing text" name the case where the lines
don't fit even at 1 px, and stop saying that every line always fits. 03 now says
every line fits and nothing is cut or runs past the margins, except in the
overflow case: when the lines don't fit even at 1 px, the text draws at 1 px and
may run past the margins. The rule itself is unchanged.

## Changed files

- `docs/spec/03-output.md`
- `docs/reviews/spec-11.md` (new)

## Checks run

| Command or test           | Result                                             |
| ------------------------- | -------------------------------------------------- |
| `npm run format:check`    | Pass on base `1b4b72b`                             |
| Middle dots and em dashes | None in the changed files (checked with `grep -c`) |

## Decisions I made (for the lead to confirm)

None.

## Where to look

- 03 "Drawing text", the shrink to fit bullet.

## Verdicts (recorded by the lead at merge)

- Round 1 (cc521f2): lead Approve. This is the wording nit from spec-10's round
  2 (Codex, codex4), with no change to the rule, so it needed no new Codex
  round. Merged onto local `main` without conflicts.
