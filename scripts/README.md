# Scripts

Short usage notes for the checks and tools in this folder. Run every command
from the repository root. npm runs package scripts through `cmd.exe` on Windows,
so they behave the same in Git Bash and in PowerShell.

## `npm run verify`

Runs every check at once and waits for all of them:

1.  `typecheck`: TypeScript 7 (`tsc`) on the node and web projects.
2.  `lint`: ESLint, with no warnings allowed.
3.  `format:check`: Prettier, which skips files whose content hasn't changed
    since its last check (`node_modules/.cache/prettier`).
4.  `test:coverage`: Vitest with a coverage report in `coverage/`.
5.  `build`: electron-vite.

The steps read and write separate files, so they don't wait for each other, and
the run takes about as long as the slowest step. Each step's output is captured.
When a step finishes, verify prints one `ok` line, or for a failed step
everything that step printed, between markers. The summary at the end lists the
steps in the order above, with their times. Its exit code is the first failed
step's in that order. Under "What failed", the summary lists the failed tests,
Vitest worker start errors, and unhandled errors from that step's output. That
tells a busy-machine timeout from a broken test. Rerun the step alone, for
example `npm run lint`. Team members run it before a review request, and the
lead runs it before a merge.

- Each step has 10 minutes. A step that runs longer fails, and verify ends it
  with every process it started (`taskkill /t /f`). Ctrl+C does the same for
  every running step. Five seconds after it starts to stop a step, verify lets
  go of the step's output, so verify always ends, with a nonzero exit code.
- taskkill reaches only processes whose parents still run. When a process
  outlives its parent and keeps the output open, the summary says
  `A process started by "npm run <step>" kept running; check Task Manager.`
- Verify keeps the last 2 million characters of each step's output and says how
  many came before them. "What failed" comes from all of the output, line by
  line for each stream, as it arrives.

Tests have 60 seconds each (Vitest's default is 5), and Vitest uses worker
threads on half the cores, so a machine busy with several sessions makes the run
slower instead of failing it.

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
- Lint and Prettier skip `electron.vite.config.ts.*.mjs`, the temporary file
  that electron-vite bundles its config into while `build` runs alongside them
  in `npm run verify`.

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

## `npm run gallery`

Serves the component gallery (`src/renderer/gallery.html`) and the renderer with
plain Vite, without Electron. electron-vite 6.0.0 starts Electron even with
`--rendererOnly`, so don't use that for the gallery.

```bash
LLP_DEV_PORT=5186 npm run gallery
```

- The port comes from `LLP_DEV_PORT` (5173 without it). A port in use fails
  instead of moving.
- It listens on `127.0.0.1` only, so the Windows firewall never asks, and it
  never opens a browser.
- The aliases (`@shared`, `@renderer`) match the renderer build; a test checks
  them against `electron.vite.config.ts`.
- The config is `scripts/gallery/vite.config.mts`. A test starts it under a hook
  that records any import of `electron` or `electron-vite` and expects none.

## `npm run soak`

Starts the built app in test mode, waits until it quits, and judges the record
that it wrote. Run `npm run build` first.

- `npm run soak`: a 60-minute run.
- `npm run soak -- --minutes 5`: a short trial run.
- `npm run soak -- --judge path/to/soak.jsonl`: judges an existing record
  without starting the app.

The runner starts Electron with these environment variables. In the app,
`registerSoakRecorder` (`src/main/soak/`) reads them once the app is ready. It
samples `app.getAppMetrics()` every 10 seconds, appends one line per sample, and
quits after `LLP_SOAK_EXIT_MS`, once every queued line is written. It names
renderers by their page: `index.html` is `control`, and
`output.html?screen=<id>` is `output:<id>`. The test scenario (looping video and
장 changes) and the output frame rates come with output's M2 work.

| Variable           | Meaning                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LLP_USER_DATA`    | A new temp folder, so the run never touches real data                                                                                                   |
| `LLP_SOAK_RECORD`  | The record file to append to; setting it turns on the test scenario                                                                                     |
| `LLP_SOAK_EXIT_MS` | When the app quits on its own: whole milliseconds, 1 to 2,147,483,647. Empty or unset keeps it running; another value is logged and nothing is recorded |

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
the rest of the requested time into 12 windows. A short run gets fewer windows
of at least a minute each, but never fewer than 4, so below about 4.4 minutes
the windows are shorter than a minute (27.5 seconds for a 2-minute run). The run
fails when:

- the record covers less than the requested time,
- a process has fewer than 3 samples in any window, for example because it
  disappeared partway,
- a process relaunched (a new `pid` under the same `name`),
- a process's memory keeps growing: the slope through each window's lowest value
  rises at least 4 MB per hour, both over the whole judged time and over its
  later half. The slope is the median of the slopes between every pair of
  windows (Theil-Sen), so one window that dips or jumps can't decide it. A cache
  that fills early and then levels off passes; a leak that starts halfway
  doesn't, and
- a fit has fewer than two windows to compare, which can't be judged.

A median frame rate under 58 fps is a warning. Bad record lines are dropped and
listed.

## `session-context.ts`

The SessionStart hook in `.claude/settings.json`. It prints a session's role,
notes, git state, and `docs/STATUS.md` at every start, resume, and compaction.
The lead owns it.

## Pre-push check

`npm ci` runs the `prepare` script (`scripts/hooks/install.mts`), which sets
`core.hooksPath` to `.githooks` in this repository's config, never the global
one. From then on, git runs `.githooks/pre-push` (Git Bash on Windows) before
every push. For a push that updates `main`, it stops the push with a one-line
reason when:

- the pushed commit isn't checked out, or the working tree has changes, because
  verify runs on the checked-out tree,
- `origin` has a commit this clone lacks (pull the version bot commit first),
- a pushed commit message isn't `tag(scope): sentence` or the bot's exact
  `Bump version: x.y.z`, or has a body or trailers, or
- `npm run verify` fails.

Pushes of tags and other branches pass without a check.

## Version bot

After `verify` passes on a push to `main`, the `bump` job in `ci.yml` runs
`node scripts/version/run.mts`. It commits `Bump version: x.y.z` as
`github-actions[bot]`, tags `vx.y.z` (annotated), and pushes both together with
the default `GITHUB_TOKEN`. Pushes made with that token don't start another run.

- The version lives only in `package.json` and `package-lock.json`, because
  Electron's `app.getVersion()` reads it.
- `break`, `feat`, and `refactor` raise the minor version. `fix`, `style`,
  `chore`, and `docs` raise the patch version. A push with any minor-type commit
  raises the minor version. A message that breaks the format counts as a patch
  change.
- The major version goes up only when someone runs the workflow by hand
  (`workflow_dispatch`) with `major` checked, after the user approves.
- The bot counts every commit that no version tag covers yet: those since the
  last `v*` tag, or the whole history before the first tag. A run that was
  cancelled or failed never tags, so the next run still counts its commits. When
  only bump commits are new, it does nothing.
- `Bump version: x.y.z` is the one exception to the commit message format, and
  only the bot writes it. The script commits only in GitHub Actions.
- To see the next version locally: `node scripts/version/run.mts --dry-run`.

### Landing on `main` with the bot

The bot adds a commit to `main` on GitHub after each push. Before the next
merge, the lead brings it in:

```bash
git pull --ff-only origin main
```

If the lead merges first, local `main` and `origin/main` diverge, and the
pre-push check stops the push with "pull the version bot commit first". Merge
commits and rewriting `main` aren't allowed, so pull before every merge.

## CI

`.github/workflows/ci.yml` runs `npm ci` and `npm run verify`, the same check as
the pre-push hook, when `main` is pushed and on demand (`workflow_dispatch`). It
runs on `windows-latest`, so it moves to each new Windows image that GitHub
makes the default. It caches npm and the Electron download. The `bump` job above
runs after it on `main`.
