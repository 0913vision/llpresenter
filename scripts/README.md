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
example `npm run lint`. Branch pushes run verification on GitHub-hosted Windows
runners. The lead reads the branch result before merging and checks that its
head SHA is the commit under review. The hook keeps the local stamp rule for
pushes to `main`.

- When every step passes, verify writes `.llp/verify-stamp.json` (Git ignores
  `.llp/`): the tree of the checked-out commit, whether the working tree was
  clean before and after the run, and when it passed. A run that fails or is
  stopped leaves no stamp, because verify removes the old one first. The
  pre-push check reads it.
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

## UTF-8 without a byte order mark

`npm run format:check` first runs `node scripts/check-bom.mts` on tracked
Markdown and JSON files, including files such as `package-lock.json` that
Prettier ignores. A BOM prints the file's path and fails the check. The check
reads only the first three bytes of each file and doesn't rewrite files.
ESLint's `unicode-bom: ['error', 'never']` enforces the same rule for code.

In Windows PowerShell 5.1, `Set-Content -Encoding UTF8` writes a BOM and
`utf8NoBOM` isn't an available encoding name. Write repository text with the
.NET UTF-8 encoder instead:

```powershell
$path = Join-Path (Get-Location) 'docs/reviews/example.md'
$text = "# Example`n"
[IO.File]::WriteAllText($path, $text, [Text.UTF8Encoding]::new($false))
```

See Microsoft's
[PowerShell encoding reference](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding?view=powershell-5.1).
Preserve LF line endings when preparing the text. For an encoding-only cleanup,
remove the leading `EF BB BF` bytes without decoding and rewriting the body.

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
- `llp/layer-imports` (`scripts/lint/layer-rule.mts`) allows an import only
  along the layers in `scripts/lint/layers.mts` (`docs/TECH.md`, "Code
  structure"). It resolves both relative and alias imports.
  `llp/test-layer-imports` lets a test use any layer of its own process, never
  another process's code.
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
  - `installMockClock()` mocks `Date` and the timers until the test finishes. It
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
- The aliases (`@core`, `@contracts`, `@renderer`) match the renderer build; a
  test checks them against `electron.vite.config.ts`.
- The config is `scripts/gallery/vite.config.mts`. A test starts it under a hook
  that records any import of `electron` or `electron-vite` and expects none.

## `npm run soak`

Starts the built app in test mode, waits until it quits, and judges the record
that it wrote. Run `npm run build` first.

- `npm run soak`: a 60-minute run.
- `npm run soak -- --minutes 5`: a short trial run.
- `npm run soak -- --judge path/to/soak.jsonl`: judges an existing record
  without starting the app.

Before the app starts, the runner makes the background clip and a media library
that lists it in the new `LLP_USER_DATA` folder:

- The clip maker (`scripts/soak/clip/main.mts`) runs in Electron, in a window
  that is never shown and draws offscreen. It draws 300 frames of moving lights
  at 1920×1080, encodes them with WebCodecs (VP8, 4 Mbps), and gives each frame
  its exact time, so the clip has no gaps that would look like a hitch at the
  loop point. `scripts/soak/webm.mts` wraps the frames in a 10-second WebM with
  its duration, which MediaRecorder leaves out. The maker then plays and seeks
  the file in Chromium before it reports the clip.
- `LoveLight/Media/soak-loop.webm` holds the clip, and
  `LoveLight/Settings/media.json` lists it with `end: loop` and `fit: fill`.

The runner then starts Electron with these environment variables. In the app,
`registerSoakRecorder` (`src/main/soak/`) samples `app.getAppMetrics()` and each
output's frame rate every 10 seconds, appends one line per sample, and quits
after `LLP_SOAK_EXIT_MS`, once every queued line is written. It names renderers
by their page: `index.html` is `control`, and `output.html?screen=<id>` is
`output:<id>`. `registerSoakScenario` plays the test scenario: the looping
background, the 본 화면 on, and the next of 12 invented 장 every 5 seconds.

| Variable            | Meaning                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LLP_USER_DATA`     | A new temp folder, so the run never touches real data                                                                                                   |
| `LLP_SOAK_RECORD`   | The record file to append to; setting it turns on the test scenario                                                                                     |
| `LLP_SOAK_EXIT_MS`  | When the app quits on its own: whole milliseconds, 1 to 2,147,483,647. Empty or unset keeps it running; another value is logged and nothing is recorded |
| `LLP_SOAK_MEDIA_ID` | The background clip's media id; a value that isn't one is logged, and the scenario runs without a background                                            |
| `LLP_TEST_WINDOWS`  | `offscreen`: every window stays off the user's screen (output's switch)                                                                                 |

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
every push. For every branch except `main`, it checks commit messages only;
verification runs on GitHub after the push. These branches can be pushed from a
different or dirty checkout. For a push that updates `main`, it stops the push
with a one-line reason when:

- the pushed commit isn't checked out, or the working tree has changes, because
  verify runs on the checked-out tree,
- `origin` has a commit this clone lacks (pull the version bot commit first),
- a pushed commit message isn't `tag(scope): sentence` or the bot's exact
  `Bump version: x.y.z`, or has a body or trailers, or
- `npm run verify` fails.

The message check always runs. Verify doesn't run again when the stamp says the
pushed commit's tree already passed `npm run verify` on a clean working tree;
the hook prints `pre-push: verify skipped: ...` then. Otherwise it prints why it
runs verify (no stamp, another tree, or uncommitted changes during that run) and
runs it.

The hook checks every branch in a mixed push before running main's verify. Tags
and branch deletions pass without a check.

## Version bot

On a push to `main`, the `bump` job in `ci.yml` runs
`node scripts/version/run.mts`. It commits `Bump version: x.y.z` as
`github-actions[bot]`, tags `vx.y.z` (annotated), and pushes both together with
the default `GITHUB_TOKEN`. Pushes made with that token don't start another run.

- The version lives only in `package.json` and `package-lock.json`, because
  Electron's `app.getVersion()` reads it.
- `break`, `feat`, and `refactor` raise the minor version. `fix`, `style`,
  `docs`, `test`, and `chore` raise the patch version. A push with any
  minor-type commit raises the minor version. A message that breaks the format
  counts as a patch change.
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

The October 25 user decision moves heavy branch verification to GitHub-hosted
runners. `.github/workflows/ci.yml` runs:

- On a push to any branch except `main`: `npm ci` and `npm run verify` on
  `windows-latest`, with npm and the Electron download cached, and the coverage
  report uploaded as an artifact. The job has read-only repository permission,
  doesn't pass repository secrets, and doesn't persist checkout credentials.
- On a push to `main`: only the `bump` job above. Main's pre-push hook retains
  the local verification stamp rule.
- On demand (`workflow_dispatch`, with the `major` input) on `main`: only the
  bump. Manual runs on other branches skip both jobs.

Only one run per branch can be active; a new push cancels the previous run for
that branch. Tag pushes and pull request events don't start runs.

### Read a branch's latest result

```bash
node scripts/ci/status.mts chore/devops/verify-stamp
```

This reads this public repository's GitHub REST API without a token, GitHub CLI,
or other authentication. It requests only the latest `push` run of `ci.yml` for
the supplied branch and prints JSON with `status`, `conclusion`, `headSha`, and
`url`. A request has a 15-second timeout and isn't retried. Main's result
describes the bump job, not a verification run.

| Exit code | Meaning                                                               |
| --------- | --------------------------------------------------------------------- |
| 0         | The latest run completed successfully                                 |
| 1         | The run completed with any other conclusion, including cancellation   |
| 2         | The latest run is queued, running, or waiting                         |
| 3         | No push run exists for this branch                                    |
| 4         | Bad arguments, a request failure (including rate limits), or bad JSON |

Compare `headSha` with the commit under review before accepting success. Right
after a push, the API can still return a previous run until the new one appears.
No previous success is substituted for a queued, failed, or cancelled latest
run. Anonymous API requests have a shared rate limit, so check on demand.
