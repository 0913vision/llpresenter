Review range: `d119351...test/spec/bible-budget`

# Review request: `spec-22`

- Team member: `spec`
- Branch: `test/spec/bible-budget`, from `main` (not stacked)
- Base commit (`main`): `d119351`
- Test commit: `c808856`
- Task: `.llp/task.md`, the spec-21 parse-budget nit

## What changed and why

The full-size Bible parse budget previously measured one cold invocation, so a
loaded CI runner could fail on a transient pause. The test now warms up once,
measures three more parses, and checks their median against the same 100 ms
budget. Every measured parse must still succeed. The 66-book, 1,189-chapter,
31,102-verse, 4,607,273-byte invented fixture and its structural checks remain.

The test saves `coverage/bible-parse-budget.json` before the budget assertion.
The existing CI coverage upload includes it on success or failure, following
output-21's artifact pattern without changing the workflow. The JSON records the
fixture size and counts, warmup count, all three times, median, budget, Node
version, platform, and architecture. This retains the runner's actual figure
even when successful verify output is suppressed.

Local measured times were 13.854, 5.535, and 7.836 ms: **median 7.836 ms**.
Timing excludes fixture generation, serialization, file I/O, artifact writing,
and assertions. The runtime loader is unchanged.

## Checks run

| Check                                        | Result                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| Changed parse-budget test                    | Pass: 1 file, 1 test                                                         |
| Node TypeScript check (`tsconfig.node.json`) | Pass                                                                         |
| Changed-file ESLint and Prettier             | Pass                                                                         |
| `git diff --check`                           | Pass                                                                         |
| Generated diagnostic JSON inspection         | Pass: all measurements and metadata recorded                                 |
| Local full verify                            | Not run, per the lead's rule                                                 |
| GitHub branch CI                             | Exact submitted HEAD's run URL and result are recorded in the request report |

Local evidence: `.llp/spec21/robust-budget.log` and
`coverage/bible-parse-budget.json`. No app window, Electron process, soak, or
memory measurement was started.

## Changed files

- `src/main/bible/parsePerformance.test.ts`.
- `docs/reviews/spec-22.md`.

The branch starts from main at `d119351`. A fully green CI run of the submitted
HEAD is required. The request report records its URL and result without adding
another unverified commit for CI metadata. Its coverage artifact contains the CI
measurements in `bible-parse-budget.json`.
