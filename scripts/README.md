# Scripts

Short usage notes for the checks and tools in this folder. Run every command
from the repository root. npm runs package scripts through `cmd.exe` on Windows,
so they behave the same in Git Bash and in PowerShell.

## `npm run verify`

Runs every check in order and stops at the first one that fails:

1.  `typecheck`: TypeScript 7 (`tsc`) on the node and web projects.
2.  `lint`: ESLint, with no warnings allowed.
3.  `format:check`: Prettier.
4.  `test:coverage`: Vitest with a coverage report in `coverage/`.
5.  `build`: electron-vite.

It prints a header before each step and a summary at the end. When a step fails,
the summary names the step and its exit code, and you can rerun that step alone,
for example `npm run lint`. The whole run takes under a minute on the
development PC. Team members run it before a review request, and the lead runs
it before a merge.

## `npm run lint`

- The config is `scripts/lint/config.mts`. The root `eslint.config.mjs` only
  re-exports it, and Node strips the types when ESLint loads it.
- typescript-eslint needs the TypeScript compiler API, which TypeScript 7
  doesn't have. So the `typescript` package is the TypeScript 6 API
  (`@typescript/typescript6`), used only by lint and the editor, and `tsc` comes
  from TypeScript 7 (`@typescript/native`). See `docs/decisions.md`.
- `llp/allowed-comments` (`scripts/lint/comment-rule.mts`) allows only the
  comments in `CLAUDE.md`: TSDoc, `// NOTE(0913vision): ...`, and
  `// TODO(0913vision): ...`. Plain `//` lines right under a NOTE or TODO, in
  the same column, continue it. `tsdoc/syntax` checks TSDoc.
- Comments can't switch rules off (`noInlineConfig`). When existing code breaks
  a rule, add the narrowest entry to `scripts/lint/legacy-exclusions.mts` with a
  TODO, and the code's author fixes it.
- Modules that Node loads directly use `.mts`, so Node doesn't warn that
  `package.json` has no `"type"` field.

## `npm test` and `npm run test:coverage`

- Vitest runs two projects: `node` (main, preload, shared, `scripts/`, `test/`)
  and `renderer` (jsdom with Testing Library, cleaned up after each test).
- Mocks, stubbed globals, and stubbed environment variables reset after each
  test.
- Shared helpers live in `test/`:
  - `makeTempDir()` creates an empty folder under the system temp folder and
    deletes it when the test finishes.
  - `installFakeClock()` fakes `Date` and the timers until the test finishes. It
    starts at a fixed time and has `advance(ms)`, `runAll()`, and `now()`.
- `test:coverage` writes a summary to the terminal and an HTML report to
  `coverage/index.html`. CI uploads the report as the `coverage` artifact.

## `npm run soak`

Starts the built app in test mode, waits until it quits, and judges the record
that it wrote. Run `npm run build` first.

- `npm run soak`: a 60-minute run.
- `npm run soak -- --minutes 5`: a short trial run.
- `npm run soak -- --judge path/to/soak.jsonl`: judges an existing record
  without starting the app.

The runner starts Electron with these environment variables. The app side lands
in phase 2.

| Variable           | Meaning                                                             |
| ------------------ | ------------------------------------------------------------------- |
| `LLP_USER_DATA`    | A new temp folder, so the run never touches real data               |
| `LLP_SOAK_RECORD`  | The record file to append to; setting it turns on the test scenario |
| `LLP_SOAK_EXIT_MS` | When the app quits on its own                                       |

The record is JSON Lines: one sample per line, flushed as it's written. Here is
one sample, spread over several lines:

```json
{
  "v": 1,
  "elapsedMs": 10000,
  "processes": [
    {"name": "main", "pid": 4120, "workingSetKb": 151200, "privateKb": 120400},
    {
      "name": "output:main",
      "pid": 5332,
      "workingSetKb": 301000,
      "privateKb": 250100
    }
  ],
  "outputs": [{"screen": "main", "fps": 59.8}]
}
```

- `name` stays the same across samples and relaunches: `main`, `control`, `gpu`,
  `output:<screen id>`, or `utility:<name>`.
- Memory comes from `app.getAppMetrics()` in KB.
- `fps` is the output window's frame rate over the last interval.

The judge skips a warm-up (5 minutes, or a twelfth of a shorter run) and splits
the rest of the requested time into 6 windows. The run fails when:

- the record covers less than the requested time,
- a process has fewer than 3 samples in any window, for example because it
  disappeared partway,
- a process relaunched (a new `pid` under the same `name`), or
- a process's memory keeps growing: its lowest value rises in every window and
  by at least 10 MB in total.

A median frame rate under 58 fps is a warning. Bad record lines are dropped and
listed.

## `session-context.ts`

The SessionStart hook in `.claude/settings.json`. It prints a session's role,
notes, git state, and `docs/STATUS.md` at every start, resume, and compaction.
The lead owns it.

## CI

`.github/workflows/ci.yml` runs `npm ci` and `npm run verify` on Windows when
`main` is pushed, and on demand (`workflow_dispatch`). It caches npm and the
Electron download.
