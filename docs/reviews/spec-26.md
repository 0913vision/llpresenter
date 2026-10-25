Review range: `f8c38e2...docs/spec/arrangement-split-merge`

# Review request: `spec-26`

- Team member: `spec`
- Branch: `docs/spec/arrangement-split-merge`, from main, independent of spec-25
- Base commit: `f8c38e2`
- Review round: 1
- Task: `.llp/task.md`, the lead's small docs item at 02:00

## What changed and why

Added the decided 구성 split and merge rules beside spec 02's existing rules for
references after inserting, deleting, and moving slides. This closes the gap
identified after ui-21's review and cites the decision in `f8c38e2`.

Every occurrence of a split slide expands to all parts in order. The example
retains repeated references: `[1, 3, 3]` becomes `[1, 3, 4, 3, 4]`. References
to a merged-away block point to the merged block, and adjacent duplicates
introduced by that merge collapse. Both `[2, 3]` and `[3]` become `[2]` when 3
merges into 2. Only deletion removes references.

The text names Enter on an empty line and pasting with blank lines as split
triggers, and Backspace at a block's start as the merge trigger. This request
changes no runtime code, schema, or existing insert/delete/move behavior.

## Checks run

| Check                                     | Result                                                      |
| ----------------------------------------- | ----------------------------------------------------------- |
| Manual comparison with decision `f8c38e2` | Pass: triggers and all examples match                       |
| Changed-file Prettier                     | Pass                                                        |
| `git diff --check`                        | Pass                                                        |
| Local full verify                         | Not run, per the lead's rule                                |
| GitHub branch CI                          | Exact submitted HEAD's run URL and result are in the report |

## Changed files

- `docs/spec/02-data.md`: two rules in the song file's 구성 section.
- `docs/reviews/spec-26.md`: this request.

The report records the exact submitted HEAD's green CI URL and result without
adding an unverified metadata commit. No window was started.

## Verdicts (recorded by the lead at merge)

- Round 1 (3e834c1): reviewer (Claude, trial-97) Approve. Nit: the split list at
  `docs/spec/02-data.md:110` names Enter on an empty line and a paste but not
  Ctrl Enter, which also splits (spec 05, 10); the lead added Ctrl Enter to the
  decision, and spec adds it to spec 02 in its next request. Lead Approve.
  Written by the Codex session that took over spec's work. Merged by the lead
  without conflicts.
