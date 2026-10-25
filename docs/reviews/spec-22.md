Review range: `d0a97d3...test/spec/bible-budget`

# Review request: `spec-22`

- Team member: `spec`
- Branch: `test/spec/bible-budget`, from `main` (not stacked)
- Base commit (`main`): `d0a97d3`
- Test commit: `5ff5585`
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

## ClearRow startup race

The first branch CI run failed in the existing spec-18 test that counts undo
icon renders, not in the parse budget:
[run 40206840935](https://github.com/0913vision/llpresenter/actions/runs/40206840935).
The lead extended this request to fix `ClearRow.test.tsx`, test only.

The undo-render helper now starts live-state synchronization with an explicit
first-read promise and waits for that state and its React updates before it
returns. Tests set their desired live state afterwards, before resetting render
counters or asserting transitions. This removes the startup-read race from all
tests using the helper. The pre-first-state test now holds that response until
after its initial assertion, then explicitly settles it. Synchronization is
unsubscribed at test completion. Runtime ClearRow code is unchanged.

## Checks run

| Check                                           | Result                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| Changed parse-budget test                       | Pass: 1 file, 1 test                                                         |
| Node TypeScript check (`tsconfig.node.json`)    | Pass                                                                         |
| Changed-file ESLint and Prettier                | Pass                                                                         |
| ClearRow tests                                  | Pass: 1 file, 23 tests                                                       |
| Renderer TypeScript check (`tsconfig.web.json`) | Pass                                                                         |
| `git diff --check`                              | Pass                                                                         |
| Generated diagnostic JSON inspection            | Pass: all measurements and metadata recorded                                 |
| Local full verify                               | Not run, per the lead's rule                                                 |
| GitHub branch CI                                | Exact submitted HEAD's run URL and result are recorded in the request report |

Local evidence: `.llp/spec21/robust-budget.log`, `.llp/spec22-clear-row.log`,
and `coverage/bible-parse-budget.json`. No app window, Electron process, soak,
or memory measurement was started.

## Changed files

- `src/main/bible/parsePerformance.test.ts`.
- `src/renderer/src/show/ClearRow.test.tsx`, the lead's test-only exception.
- `docs/reviews/spec-22.md`.

The branch was rebased onto main at `d0a97d3`. A fully green CI run of the
submitted HEAD is required. The request report records its URL and result
without adding another unverified commit for CI metadata. Its coverage artifact
contains the CI measurements in `bible-parse-budget.json`.

## Verdicts (recorded by the lead at merge)

- Round 1 (b20e7f2): reviewer (Claude, trial-97) Approve. Nits for the next spec
  branch: the startup async in the old ClearRow test was `UndoControls`'
  `preferences.get().then(setVisible)` (`ClearRow.tsx:78`), not `live.get`;
  correct the cause in this document. Move the `node:fs/promises` and
  `node:path` imports in `src/main/bible/parsePerformance.test.ts:63` up with
  the other imports. Lead Approve. Written by the Codex session that took over
  spec's work; the ClearRow test change was under the lead's exception. Rebased
  by the lead onto local `main` without conflicts.
