# Review request: `devops-1`

- Team member: `devops`
- Branch: `chore/devops/verify`
- Base commit (`main`): `5b09a98`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/devops.md`

## What changed and why

This change makes one check, `npm run verify`, enforce the quality bar for
everyone: type check, lint, format check, unit tests with coverage, and build,
in that order, stopping at the first failure. It also adds CI, shared test
helpers, and the soak test skeleton. Usage notes are in `scripts/README.md`.

### TypeScript 7 and typescript-eslint

- typescript-eslint 8.72.0 (the latest) has the peer
  `typescript >=4.8.4 <6.1.0`. Next to `typescript@7.0.2`, `npm install` fails
  with ERESOLVE. Forced with `--legacy-peer-deps`, ESLint stops with
  "typescript-eslint does not support TS 7.0", because TypeScript 7 ships no
  compiler API until 7.1.
- Following "Running side-by-side with TypeScript 6.0" in the TypeScript 7
  announcement, `devDependencies` now has
  `"typescript": "npm:@typescript/typescript6@6.0.2"` (the TypeScript 6 API, for
  lint and the editor) and `"@typescript/native": "npm:typescript@7.0.2"`
  (`tsc`). The lead approved this and recorded it in `docs/decisions.md`.
- `npm run typecheck` still runs TypeScript 7:

  ```text
  $ npx tsc -v
  Version 7.0.2
  $ node -e "console.log(require('typescript').version)"
  6.0.3
  $ npm ls @typescript/native
  `-- @typescript/native@npm:typescript@7.0.2
  ```

- `npm ls typescript --all`:

  ```text
  +-- eslint-plugin-tsdoc@0.5.4
  | `-- @typescript-eslint/utils@8.56.1
  |   +-- @typescript-eslint/typescript-estree@8.56.1
  |   | +-- @typescript-eslint/project-service@8.56.1
  |   | | `-- typescript@5.9.3 deduped
  |   | +-- @typescript-eslint/tsconfig-utils@8.56.1
  |   | | `-- typescript@5.9.3 deduped
  |   | `-- typescript@5.9.3 deduped
  |   `-- typescript@5.9.3
  +-- typescript-eslint@8.72.0
  | +-- @typescript-eslint/eslint-plugin@8.72.0
  | | +-- @typescript-eslint/type-utils@8.72.0
  | | | `-- typescript@npm:@typescript/typescript6@6.0.2 deduped
  | | +-- ts-api-utils@2.5.0
  | | | `-- typescript@npm:@typescript/typescript6@6.0.2 deduped
  | | `-- typescript@npm:@typescript/typescript6@6.0.2 deduped
  | +-- @typescript-eslint/parser@8.72.0
  | | `-- typescript@npm:@typescript/typescript6@6.0.2 deduped
  | +-- @typescript-eslint/typescript-estree@8.72.0
  | | +-- @typescript-eslint/project-service@8.72.0
  | | | `-- typescript@npm:@typescript/typescript6@6.0.2 deduped
  | | +-- @typescript-eslint/tsconfig-utils@8.72.0
  | | | `-- typescript@npm:@typescript/typescript6@6.0.2 deduped
  | | `-- typescript@npm:@typescript/typescript6@6.0.2 deduped
  | +-- @typescript-eslint/utils@8.72.0
  | | `-- typescript@npm:@typescript/typescript6@6.0.2 deduped
  | `-- typescript@npm:@typescript/typescript6@6.0.2 deduped
  `-- typescript@npm:@typescript/typescript6@6.0.2
  ```

- Nested `typescript@5.9.3`: eslint-plugin-tsdoc 0.5.4 pins
  `@typescript-eslint/utils ~8.56.0`, whose peer is `typescript <6.0.0`, so npm
  installs a private TypeScript 5.9.3 under
  `node_modules/eslint-plugin-tsdoc/node_modules/`. It costs disk space only. No
  other installed package depends on `typescript`.
- gts isn't used. gts 7.0.0 wraps typescript-eslint, so it has the same
  TypeScript 7 problem. It also pulls ESLint 9, runs Prettier inside ESLint
  (which duplicates `format:check`), and turns off `no-non-null-assertion`. Its
  useful core rules are in our config instead (see "Lint").

### Dependencies (dev only, exact versions)

| Package                     | Version                         | Reason                                                                                                                                                 |
| --------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `eslint`                    | 10.13.0                         | The linter (brief)                                                                                                                                     |
| `@eslint/js`                | 10.0.1                          | ESLint's recommended core rules, such as `no-unsafe-finally` and `no-fallthrough`. ESLint 10 no longer bundles it. Same major as ESLint. Lead approved |
| `typescript-eslint`         | 8.72.0                          | Type-aware TypeScript rules (brief)                                                                                                                    |
| `eslint-plugin-react-hooks` | 7.1.1                           | Hooks rules and React Compiler checks (brief)                                                                                                          |
| `eslint-plugin-tsdoc`       | 0.5.4                           | TSDoc syntax (brief)                                                                                                                                   |
| `@vitest/coverage-v8`       | 5.0.5                           | Coverage report (brief), same version as Vitest                                                                                                        |
| `typescript`                | `@typescript/typescript6@6.0.2` | The TypeScript 6 API for typescript-eslint (lead approved)                                                                                             |
| `@typescript/native`        | `typescript@7.0.2`              | `tsc` stays TypeScript 7 (lead approved)                                                                                                               |

### Lint (`npm run lint`)

- The config is `scripts/lint/config.mts`, and the root `eslint.config.mjs`
  re-exports it. ESLint 10 can't load `eslint.config.ts` without jiti or an
  unstable flag, while Node 24 strips types itself when the `.mjs` file imports
  the `.mts` file. The modules are `.mts`, not `.ts`: Node prints
  `MODULE_TYPELESS_PACKAGE_JSON` every time it loads a typeless `.ts` file
  (tested), and `.mts` avoids that without a `"type"` field in `package.json`.
- Presets: `@eslint/js` recommended, typescript-eslint `strictTypeChecked` and
  `stylisticTypeChecked` (type-aware through `projectService`), and react-hooks
  `recommended-latest` for `src/renderer/`.
- Every rule set explicitly has one `// NOTE(0913vision): ...` that says why.
  Each rule the brief asks for:

  | Brief                                  | Rule                                                                                                   |
  | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
  | Ban `any`                              | `@typescript-eslint/no-explicit-any`, plus the `no-unsafe-*` rules from the strict preset              |
  | Ban type assertions that bypass checks | `@typescript-eslint/consistent-type-assertions` with `assertionStyle: 'never'` (`as const` is allowed) |
  | Ban `!`                                | `@typescript-eslint/no-non-null-assertion`                                                             |
  | Ban unhandled promises                 | `@typescript-eslint/no-floating-promises`, `no-misused-promises`                                       |
  | Exhaustive switches                    | `@typescript-eslint/switch-exhaustiveness-check`; a `default` doesn't count for unions                 |
  | React hooks rules                      | `react-hooks/*`, with `exhaustive-deps` raised to an error                                             |
  | Unused variables                       | `@typescript-eslint/no-unused-vars`, including unused caught errors                                    |

- Rules for `CLAUDE.md` and the Google TypeScript style guide: `eqeqeq` (with
  `== null` allowed, as Google allows), `no-var`, `prefer-const`,
  `prefer-arrow-callback`, `prefer-template`, `prefer-object-has-own`,
  `curly: multi-line`, `max-depth: 3`, `@typescript-eslint/max-params: 3`,
  `prefer-readonly`, `array-type: array-simple`,
  `consistent-type-definitions: interface`, and `no-restricted-syntax` for
  `#private`, `for...in`, `const enum`, and default exports (allowed in
  `*.config.*` files, which tools read by default export). `.only` on
  `describe`, `it`, and `test` is banned.
- Comment rules: `llp/allowed-comments` (`scripts/lint/comment-rule.mts`, 17
  RuleTester cases) allows only TSDoc, `// NOTE(0913vision): ...`, and
  `// TODO(0913vision): ...`. Plain `//` lines right under a NOTE or TODO line,
  in the same column, continue it, because the existing NOTEs wrap over several
  lines. `NOTE:` without the owner, another owner, or a block-comment NOTE gets
  a message that shows the right form. Triple-slash directives are left to
  `@typescript-eslint/triple-slash-reference`. `tsdoc/syntax` checks TSDoc.
- Comments can't switch rules off: `noInlineConfig` is on, so an
  `eslint-disable` comment has no effect and the comment rule reports it.
- ESLint doesn't read `.gitignore`, so the config ignores `out/`, `dist/`,
  `coverage/`, `design/`, `.llp/`, and `.claude/`. Ignoring `.claude/` matters
  in the lead's checkout, which holds every session worktree.
- Lint runs without `--cache`, because cached type-aware results go stale when a
  type in another file changes.

### Deliberate violations

I added three probe files with the violations below, ran
`npx eslint --max-warnings 0` on them, and deleted them before committing.
ESLint exited with code 1 and 24 errors.

| Violation                                         | Caught by                                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `value: any` and `return value.size`              | `no-explicit-any`, `no-unsafe-return`, `no-unsafe-member-access`                       |
| `text!.length`                                    | `no-non-null-assertion`                                                                |
| `value as string`                                 | `consistent-type-assertions`                                                           |
| `save();` without `await`                         | `no-floating-promises`                                                                 |
| `switch` that misses one union member             | `switch-exhaustiveness-check` ("Cases not matched: "audio"")                           |
| `// plain comment that is not allowed`            | `llp/allowed-comments`                                                                 |
| `@param {string} name the name`                   | `tsdoc/syntax` (`tsdoc-param-tag-with-invalid-type`, `tsdoc-param-tag-missing-hyphen`) |
| `const unused = 1;`                               | `no-unused-vars`                                                                       |
| `#count`                                          | `no-restricted-syntax`                                                                 |
| `// eslint-disable-next-line ...` then `any`      | `llp/allowed-comments`, the `noInlineConfig` warning, and `no-explicit-any` still      |
| `a == 1`                                          | `eqeqeq`                                                                               |
| `export default`                                  | `no-restricted-syntax`                                                                 |
| `useState` inside `if`, and after an early return | `react-hooks/rules-of-hooks`                                                           |
| `setText` inside `useEffect`, missing dependency  | `react-hooks/set-state-in-effect`, `react-hooks/exhaustive-deps`                       |
| `it.only(...)`                                    | `no-restricted-properties`                                                             |

### Spots in existing code excluded from lint

As the brief says, I didn't change these files. Each exclusion is one rule for
one file, in `scripts/lint/legacy-exclusions.mts`, with a TODO:

1.  `scripts/session-context.ts:126` (`readStdin`): `JSON.parse(...) as {...}`
    breaks `consistent-type-assertions`. Validate the input instead.
2.  `src/main/log.ts:35` (`formatDetail`): `String(detail)` on an `unknown` that
    `JSON.stringify` rejected breaks `no-base-to-string`. Handle that case
    explicitly.

Everything else on `main` at 5b09a98 passes, including `src/shared/colors.ts`.

### Vitest

- Coverage with v8: a summary in the terminal and an HTML report in `coverage/`
  (ignored by git and Prettier since fdb333a). It covers `src/` and `scripts/`,
  without tests and `.d.ts` files. No thresholds yet (see "Decisions").
- `restoreMocks`, `unstubEnvs`, and `unstubGlobals` reset state after every
  test, so tests stay independent.
- The `node` project now includes `test/**/*.test.ts`. The `renderer` project
  has `test/setup-renderer.ts`, which runs Testing Library's `cleanup` after
  each test. Testing Library does that by itself only when the test globals are
  on, and they're off here.
- Helpers in `test/`, each with tests:
  - `makeTempDir()`: an empty folder under the system temp folder, deleted with
    `onTestFinished` (with retries for Windows file locks).
  - `installFakeClock(start?)`: fakes `Date` and the timers from a fixed start
    time until the test finishes, with `advance(ms)`, `runAll()`, and `now()`.
- The whole unit suite (99 tests) takes 16 s (`npm test`).

### `npm run verify`

`scripts/verify.mts` runs `typecheck`, `lint`, `format:check`, `test:coverage`,
and `build` through npm, one at a time. It prints `[verify 2/5] npm run lint`
before each step, stops at the first failure, and ends with a summary such as:

```text
  ok    typecheck (2.5 s)
  FAIL  lint (17.9 s)
verify failed at step 2/5: "npm run lint" exited with code 1.
Fix it, then run "npm run lint" alone or "npm run verify" again.
```

It starts npm with the running Node and `npm_execpath`, not through a shell, so
Git Bash and PowerShell behave the same. The steps stay in `package.json`, so
each one can run alone.

### CI (`.github/workflows/ci.yml`)

On a push to `main` and on `workflow_dispatch`: Windows Server 2025, Node
24.20.0 (the version on this PC), the npm cache from `setup-node`, a cache of
`%LOCALAPPDATA%\electron\Cache` (the default folder of `@electron/get`, which
`install-electron` uses during `npm ci`), then `npm ci` and `npm run verify`. It
uploads `coverage/` as an artifact for 14 days. Permissions are read-only, a
newer push cancels an older run, and the job times out after 30 minutes. I
couldn't run it because team members don't push, so please check the first run
after you push.

### Soak test skeleton (`scripts/soak/`)

- `npm run soak [-- --minutes <n>] [-- --judge <record.jsonl>]`. The runner
  needs `npm run build` first. It starts the built app with Electron, waits
  until the app quits (with 2 minutes of grace, then stops it), and judges the
  record.
- Proposed contract for the app side (phase 2): the runner sets `LLP_USER_DATA`
  (a new temp folder), `LLP_SOAK_RECORD` (the record file; setting it turns on
  the test scenario), and `LLP_SOAK_EXIT_MS` (when the app quits by itself).
- Proposed record format: JSON Lines, one sample per line, flushed as it's
  written. Each line is
  `{"v": 1, "elapsedMs", "processes": [{"name", "pid", "workingSetKb", "privateKb"}], "outputs": [{"screen", "fps"}]}`.
  Memory comes from `app.getAppMetrics()` in KB. `name` stays the same across
  samples and relaunches (`main`, `control`, `gpu`, `output:<screen id>`,
  `utility:<name>`). An example is in `scripts/README.md`.
- Judging: the first 5 minutes are skipped and the rest is split into 6 windows.
  A process's memory keeps growing when its lowest `privateKb` rises in every
  window and by at least 10 MB in total. Lowest values are used because garbage
  collection makes memory rise and fall in between. The run fails when memory
  keeps growing, when a window has fewer than 3 samples, when a process
  relaunched (a new `pid` under the same `name`, which would hide a leak), or
  when the record is shorter than requested. A median frame rate under 58 fps is
  a warning. Bad lines are dropped, listed, and the rest is still judged.
- Tried for real: with the app's existing `LLP_SMOKE_EXIT_MS=3000`,
  `node scripts/soak/run.mts --minutes 0.1` started the built app on a temp
  folder, the app quit with code 0, and the runner reported "No record at ...",
  exit 1, as expected until phase 2. A synthetic 60-minute record with one
  leaking output window was judged `growing` and failed, with the main process
  `flat`.

### GitHub PRs (proposal for the lead)

Keep reviews in `docs/reviews/` and SendMessage for now, and don't use GitHub
PRs yet. Team members don't push and this PC has no `gh`, so a PR would only add
a copy of what the review document already holds. CI checks `main` after each
push. Reconsider when a reviewer outside this PC joins, or when we want CI on a
branch before it merges. Then the lead would push the member branch and open the
PR, and `ci.yml` would add a `pull_request` trigger.

## Changed files

- `package.json`: `scripts` (`lint`, `test:coverage`, `verify`, `soak`) and
  `devDependencies` only. `package-lock.json` follows from them.
- `eslint.config.mjs`, `scripts/lint/config.mts`,
  `scripts/lint/comment-rule.mts`, `scripts/lint/comment-rule.test.ts`,
  `scripts/lint/legacy-exclusions.mts`
- `vitest.config.mts`, `test/setup-renderer.ts`, `test/temp-dir.ts`,
  `test/temp-dir.test.ts`, `test/fake-clock.ts`, `test/fake-clock.test.ts`
- `scripts/verify.mts`, `scripts/verify.test.ts`
- `.github/workflows/ci.yml`
- `scripts/soak/record.mts`, `scripts/soak/judge.mts`,
  `scripts/soak/report.mts`, `scripts/soak/run.mts`, and a test file for each
- `scripts/README.md`, this document

## Checks run

| Command or test                                       | Result                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                   | Pass (2.5 s)                                                                                      |
| `npm test`                                            | Pass, 17 files and 99 tests, 16.2 s                                                               |
| `npm run format:check`                                | Pass                                                                                              |
| `npm run verify` (in this worktree)                   | Pass, 43.9 s: typecheck 2.5 s, lint 17.9 s, format:check 7.5 s, test:coverage 14.0 s, build 2.0 s |
| Clean clone of the branch: `npm ci`, `npm run verify` | Pass. `npm ci` 1 min 55 s; `npm run verify` 74.5 s with cold caches                               |
| Deliberate violations                                 | All caught (see "Deliberate violations")                                                          |
| `npm run soak` against the built app                  | Starts and stops the app; reports the missing record (see "Soak test skeleton")                   |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (the soak
      record is checked field by field until valibot is a dependency; a TODO
      marks the switch)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the soak watchdog timer is cleared;
      the helpers restore timers and delete folders)
- [x] Caches and lists have size caps (the soak report shows at most 10 dropped
      lines)
- [x] An exception in the output path doesn't stop the output (not touched)
- [x] Only what's needed re-renders (control window) (not touched)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md` (lint now enforces it)
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly (one commit per part: dependencies, lint, tests, verify, CI, soak,
      notes)
- [x] Measured performance values: unit suite 16 s; verify 44 s warm and 75 s
      cold

## Decisions I made (for the lead to confirm)

1.  I left out `no-magic-numbers`. It flags `const MAX = 5 * 1024 * 1024`, the
    normal way to write a named constant (it hit `src/main/log.ts:4`), and has
    no option for that. Reviewers keep checking magic numbers. It did find one
    real case: `src/renderer/src/shell/Toolbar.tsx:40`,
    `iconSize: compact ? 16 : 18`. If you want the rule, I can wrap it to allow
    numbers in module-level `const` declarations.
2.  `stylisticTypeChecked` is on, with the Google options above. Its
    `non-nullable-type-assertion-style` is off because it asks for `!`.
    `dot-notation` allows both `process.env['NAME']` and `process.env.NAME`.
3.  In test files, `require-await`, `no-empty-function`, and `unbound-method`
    are off, because fakes are written as `async () => value` and no-ops, and
    `expect(mock.method)` passes methods unbound.
4.  The comment rule also rejects `// @ts-expect-error`, `// prettier-ignore`,
    and comments inside JSX, because `CLAUDE.md` allows no other comments. Tell
    me if any of them should be allowed.
5.  CSS comments aren't checked. That needs a CSS linter, which isn't on the
    allowed list.
6.  The actions are pinned to exact release tags (`actions/checkout@v7.0.1`,
    `setup-node@v7.1.0`, `cache@v6.1.0`, `upload-artifact@v7.0.2`), not to
    commit hashes. A hash needs a version comment to stay readable, and the
    comment rules don't allow one.
7.  No coverage thresholds yet. Coverage is 60% of lines, mostly because
    Electron entry code has no tests. I propose thresholds once phase 2 adds the
    core modules.
8.  verify stops at the first failure, as you asked, instead of running every
    step and reporting them together.
9.  In the soak judge, a relaunch fails the run and a low frame rate is only a
    warning. The thresholds (5-minute warm-up, 6 windows, 10 MB, 58 fps) are
    constants in `DEFAULT_JUDGE_OPTIONS`.

## Shared contract change requests

1.  `CLAUDE.md` "Checks" and `README.md` "Development": `npm run verify` exists
    now, so both can point to it.
2.  The two spots in "Spots in existing code excluded from lint". When you fix
    one, delete its entry in `scripts/lint/legacy-exclusions.mts`.
3.  Phase 2, app side: write the soak record when `LLP_SOAK_RECORD` is set, run
    the test scenario, and quit after `LLP_SOAK_EXIT_MS`.
4.  Optional: the renderer tests' own `afterEach(cleanup)` is now redundant.
5.  Editors: `node_modules/typescript` is now the TypeScript 6 API, so an editor
    that uses the workspace TypeScript gets 6.0. Type errors that only
    TypeScript 7 reports still show in `npm run typecheck`.

## Where to look

- `scripts/lint/comment-rule.mts`: how NOTE continuation lines are matched (same
  column, next line, own line).
- `scripts/lint/config.mts`: the rule choices and their NOTEs.
- `scripts/soak/judge.mts`: the growth test (`windowBaselines`, `keepsGrowing`).
- `.github/workflows/ci.yml`: it has never run on GitHub yet.

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
