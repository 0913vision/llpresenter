# M1 test plan

This plan describes how QA tests milestone M1 (Foundation) after the lead
freezes it as the tag `m1`. Each test case checks one acceptance criterion in
`docs/MILESTONES.md` or one spec rule that the M1 work touches, the way an
operator would meet it before and during a service. The results go into
`docs/qa/m1-report.md`, and the evidence goes into `docs/qa/m1/`.

## Scope

In scope, from the M1 task table in `docs/MILESTONES.md`:

- `npm run verify`, lint, coverage, CI, and the soak runner (devops-1).
- The pre-push check and the version bot (devops-2).
- The ui components of `ui-1` and `ui-2`, and the development gallery.
- Column dragging, widths per size class, and their `app.json` store (shell-1
  and shell-2).
- The schemas for every file format, the file pipeline, and the live commands on
  the schema library (data-1 to data-4).
- The app shell as it stands at the tag: menu bar, toolbar, status bar, and the
  three workspaces.

Out of scope:

- Work of later milestones: output windows, 장 output, clears and undo, the file
  store with autosave, recovery copies and backups, notifications, the output
  state recovery dialog, and soak recording on the app side. The M2 plan covers
  them.
- The spec-1 proposal, which is a document for the user to decide.

Section [B](#b-shell-against-the-design-system) checks the shell against the
design system. M1 doesn't list moving the shell to the ui components as a task,
and the menu bar and status bar still carry TODOs at the time of writing. The
lead decided (2026-10-25) that this isn't M1 work: QA runs the cases and records
their failures as "known, M2 backlog", not as M1 bugs.

## Build under test

| Item    | Value                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Tag     | `m1`, annotated, on a `Bump version: x.y.z` commit                                                                                           |
| Version | `version` in `package.json` at the tag, which must equal the `v` tag on the same commit                                                      |
| Source  | A clean clone from GitHub checked out at `m1`, and the QA worktree switched to `m1` detached (`git switch --detach m1`)                      |
| App     | The production build (`npm run build`, then Electron on `out/main/index.js`). The gallery runs on the dev server, because the build omits it |

## Test environment

| Item             | Value                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| OS               | Windows 10 Education 10.0.19045                                                                               |
| Monitors         | Primary 3440×1440 at 100%, secondary 1920×1080 at 100% to its right                                           |
| Node             | 24.20.0, the version CI uses                                                                                  |
| Git              | 2.35.2 (Git for Windows)                                                                                      |
| Shells           | Git Bash and Windows PowerShell 5.1                                                                           |
| Dev server port  | 5189 (`LLP_DEV_PORT`)                                                                                         |
| Card server port | 5289 (`node design/system/card-server.js 5289`), apart from the 5296 that ui uses                             |
| App data         | A new subfolder of `D:\llp-dev\qa` for each run (`LLP_USER_DATA=D:\llp-dev\qa\<run>`), so runs share no state |
| Clean clone      | `D:\llp-dev\qa\clone`, a short path (see "Windows pitfalls" in `docs/WORKFLOW.md`)                            |

### Display scaling

Windows display scaling is a system setting, and `CLAUDE.md` forbids changing
system settings. QA emulates scaling for each run with Chromium's
`--force-device-scale-factor` switch (1, 1.25, or 1.5) on the Electron process,
and sets window sizes in CSS pixels (Electron DIPs). This covers the layout at
each scale. It doesn't cover a live DPI change when a window moves between
monitors with different scaling, because both monitors here run at 100%. A spot
check at a real 125% and 150% needs the user (question 2 in `qa-1`).

### Window size matrix

| Run | CSS size  | Scale | Physical size | Expected class         | Note                                    |
| --- | --------- | ----- | ------------- | ---------------------- | --------------------------------------- |
| S1  | 1280×720  | 100%  | 1280×720      | narrow                 | Minimum window                          |
| S2  | 1920×1080 | 100%  | 1920×1080     | normal                 | The size the drafts use                 |
| S3  | 2560×1440 | 100%  | 2560×1440     | wide                   |                                         |
| S4  | 1280×720  | 125%  | 1600×900      | narrow                 |                                         |
| S5  | 1920×1080 | 125%  | 2400×1350     | normal                 |                                         |
| S6  | 2560×1440 | 125%  | 3200×1800     | wide                   | Taller than any monitor here            |
| S7  | 1280×720  | 150%  | 1920×1080     | narrow                 | 1920×1080 at 150% in the `Layout` table |
| S8  | 1920×1080 | 150%  | 2880×1620     | normal                 | Taller than any monitor here            |
| S9  | 2560×1440 | 150%  | 3840×2160     | wide                   | 3840×2160 at 150% in the `Layout` table |
| S10 | 1536×864  | 125%  | 1920×1080     | narrow, under 900 high | 1920×1080 at 125% in the `Layout` table |
| S11 | 2048×1152 | 125%  | 2560×1440     | normal                 | 2560×1440 at 125% in the `Layout` table |
| S12 | 1366×768  | 100%  | 1366×768      | narrow                 | The `Compact` board                     |

For S6, S8, and S9, QA first tries a real window. If Windows limits the window
to the monitor height, QA runs the layout cases on an emulated viewport (CDP
`Emulation.setDeviceMetricsOverride`) and records the result as "pass
(emulated)" or "fail (emulated)", never as a plain pass.

## How the tests run

### Safety rules for QA runs

- Nothing appears on the user's screen. Every app window is shown inactive at an
  offscreen position (x = -4000), and the gallery and the design system cards
  render in offscreen windows. No window takes focus.
- A QA launcher loads the built main process unchanged and records calls to
  `dialog.*`, `BrowserWindow#focus`, `#maximize`, `#unmaximize`, and `#minimize`
  instead of letting them act on screen. That way the window buttons can be
  checked without moving a window, and an error dialog would be caught instead
  of shown.
- `node --check` runs on every QA script before it starts Electron.
- QA never runs `git push`. The pre-push hook is tested by running
  `.githooks/pre-push` directly with the arguments and the standard input that
  git passes to it.
- QA writes only in `D:\llp-dev\qa`, its scratchpad, and its own worktree.
  Deliberate breakage (section V) happens only in the clean clone, which is
  restored with `git restore .` afterward.
- QA tools live in `.llp/qa/` in the QA worktree (ignored by git), outside the
  team's lint, type check, and test suite. The report lists every input, so that
  anyone can reproduce a result (question 1 in `qa-1`).

### Procedures

The cases refer to these procedures by name.

| Procedure        | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-clone          | `git clone https://github.com/0913vision/llpresenter D:\llp-dev\qa\clone`, `git switch --detach m1`, `npm ci`. Records the time and the exit code.                                                                                                                                                                                                                                                                                                                        |
| P-launch(run)    | Runs the build through the QA launcher with a new `LLP_USER_DATA`, `--remote-debugging-port` (renderer CDP), `--inspect` (main process CDP), `--force-device-scale-factor` for the run's scale, and `--disable-features=CalculateNativeWinOcclusion` so the offscreen window keeps painting. Sets the run's CSS size and waits for the `started` log line.                                                                                                                |
| P-size(w, h)     | Sets the content size from the main process (`BrowserWindow#setContentSize`), waits two animation frames, and reads `innerWidth`, `innerHeight`, `devicePixelRatio`, `data-size`, and the boxes of the menu bar, toolbar, columns, gaps, and status bar through CDP.                                                                                                                                                                                                      |
| P-drag(gap, dx)  | Presses the mouse in the middle of a gap, moves it by `dx` in 10 steps, and releases it, with CDP `Input.dispatchMouseEvent` (Chromium turns these into pointer events). Reads the column boxes after each step.                                                                                                                                                                                                                                                          |
| P-quit           | Closes the main window with the menu bar's close button, waits until every Electron process of the run has exited, and records the exit code and the time.                                                                                                                                                                                                                                                                                                                |
| P-kill           | `taskkill /F /T /PID <main pid>`, a force-quit as in a crash.                                                                                                                                                                                                                                                                                                                                                                                                             |
| P-restart        | P-quit, then P-launch with the same `LLP_USER_DATA` and scale.                                                                                                                                                                                                                                                                                                                                                                                                            |
| P-gallery        | `LLP_DEV_PORT=5189 npx electron-vite dev --rendererOnly`, then loads `http://localhost:5189/gallery.html` in an offscreen window with CDP. Forces `:hover`, `:active`, and `:focus-visible` with CDP `CSS.forcePseudoState` where the gallery doesn't pin a state.                                                                                                                                                                                                        |
| P-card(name)     | `node design/system/card-server.js 5289`, then loads `http://localhost:5289/card/<name>` the same way.                                                                                                                                                                                                                                                                                                                                                                    |
| P-compare(name)  | For each state in the card, finds the same state in the gallery and compares, at scale 1 and under the same layout conditions (the gallery sample in a wrapper of the card sample's width, with the same content), the box size, padding, corner radius, background, text color, font (family, size, weight, line height), outline, and shadow from `getComputedStyle` and `getBoundingClientRect`. Saves side-by-side screenshots under `docs/qa/m1/` for each mismatch. |
| P-schema         | A Node harness that imports `parse<Format>` and `serialize<Format>` from `src/shared/schema/` at the tag and runs the inputs of section D. It catches any exception and counts it as a failure of the case.                                                                                                                                                                                                                                                               |
| P-mutate(format) | For each field in the format's table in `docs/spec/02-data.md`, on an otherwise valid full sample: removes it (required fields), gives it a value of the wrong type, gives it a value outside its enum or range, and adds an unknown field next to it.                                                                                                                                                                                                                    |
| P-github         | Reads the Actions runs, commits, and tags of `main` through the public GitHub API with WebFetch, and through `git log` and `git show` in the clean clone. Writes nothing to GitHub.                                                                                                                                                                                                                                                                                       |
| P-counters       | Before and after a repeated action: CDP `HeapProfiler.collectGarbage`, then `Runtime.getHeapUsage`, `Memory.getDOMCounters` (documents, nodes, JS event listeners), and `process.memoryUsage()` of the main process through the inspector.                                                                                                                                                                                                                                |

## Recording results

- Each case gets one result: pass, fail, or blocked (with the reason). A case
  that ran only on an emulated viewport says so.
- Where the sources set no expected result, the case says "record". QA records
  the behavior and lists it under questions in the report. It isn't a bug.
- Each failure gets a bug entry `M1-<n>` in the report: severity, area and
  owner, steps to reproduce, expected and actual results, the build (tag and
  version), and evidence under `docs/qa/m1/`.
- QA sends each blocker and major bug to the lead with SendMessage as soon as it
  is confirmed, not only with the report.

Severity follows `docs/MILESTONES.md`: blocker (output stops, data loss, crash),
major (a feature in the criteria doesn't work), minor (works with a flaw),
cosmetic (look differs from the design system). QA applies it this way:

| Finding                                                                                                                                                                                           | Severity                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| The app crashes, hangs, or shows an error dialog                                                                                                                                                  | blocker                                                    |
| A file is lost, left half-written, or loses unknown fields on write                                                                                                                               | blocker                                                    |
| A criterion's behavior doesn't work: a size class doesn't switch, widths are lost on restart, a component or a state is missing from the gallery, a format has no parser or accepts a broken file | major                                                      |
| A memory, node, or listener count that grows with repetition                                                                                                                                      | major, or blocker if it would stop output within a service |
| A README or spec behavior works with a flaw: one keyboard path, a wrong error field path, a tooltip delay                                                                                         | minor                                                      |
| A size, color, font, or text differs from the design system                                                                                                                                       | cosmetic                                                   |

## Coverage

| Acceptance criterion (`docs/MILESTONES.md`)                                     | Cases                                                                             |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm ci` and `npm run verify` pass on a clean clone                             | V1 to V7                                                                          |
| CI is green on `main`                                                           | V8, V9                                                                            |
| A push to `main` produces a `Bump version` commit and a `v` tag                 | V10 to V13                                                                        |
| A failing check blocks a push to `main`                                         | V14 to V17                                                                        |
| The app starts at 1280×720, 1920×1080, and 2560×1440 and shows three workspaces | W1 to W8, W13                                                                     |
| It switches size classes at 1600 and 2400                                       | W9 to W12                                                                         |
| The column gaps drag within their ranges, and the center never goes under 560   | C1 to C13, C22                                                                    |
| The widths per size class survive a restart                                     | C14 to C21                                                                        |
| The gallery shows every M1 component in every state                             | G1, G4, and part (a) of G20 to G35                                                |
| Each component matches its design system card                                   | G5, and part (b) of G20 to G35                                                    |
| Every file format parses its samples                                            | D1 to D3, D20 to D37                                                              |
| It rejects broken files with the field that failed                              | D4 to D7, D11 to D16, D20 to D37                                                  |
| It keeps unknown fields                                                         | D9, D10, C17                                                                      |
| Spec rules beyond the criteria                                                  | V18, W14, W15, C23, G2, G3, G6 to G16, part (c) of G20 to G35, D8, D17, D18, B, S |

## Test cases

### V. Install, checks, CI, and the version bot

Sources for the whole section: `docs/MILESTONES.md` M1 criteria,
`docs/briefs/devops.md`, `docs/briefs/devops-2.md`, `scripts/README.md`,
`docs/TECH.md` "Verification", and the 2026-10-24 entries in `docs/decisions.md`
about the version rules and the flow for `main`.

- **V1 Clean install**
  - Steps: P-clone.
  - Expected: `npm ci` exits 0 with no error. The `postinstall` step leaves the
    Electron binary in `node_modules/electron/dist/electron.exe`.
  - Source: MILESTONES; `docs/decisions.md` (install-electron).
- **V2 Hook path in the repository only**
  - Steps: Before P-clone, record `git config --global --get core.hooksPath`.
    After `npm ci`, run `git config --local --get core.hooksPath` in the clone,
    and the global query again.
  - Expected: The clone's value is `.githooks`. The global value is unchanged.
  - Source: devops-2 task 1; `CLAUDE.md` safety rules.
- **V3 Verify in Git Bash**
  - Steps: `npm run verify` in the clone, from Git Bash.
  - Expected: The type check, lint, format check, unit tests with coverage, and
    build run in that order, each after a header. The summary reports success,
    and the exit code is 0.
  - Source: MILESTONES; `scripts/README.md`.
- **V4 Verify in PowerShell**
  - Steps: The same from Windows PowerShell 5.1.
  - Expected: The same steps, order, and result as V3.
  - Source: devops brief ("the same whether you run it in Git Bash or in
    PowerShell").
- **V5 Unit suite time and coverage report**
  - Steps: Read the Vitest duration from V3, and open `coverage/index.html`.
  - Expected: The unit suite finishes in under 1 minute. The report exists and
    covers `src/` and `scripts/`. The known timeout of
    `scripts/lint/config.test.ts` under load is tracked by devops and isn't
    counted as an M1 bug.
  - Source: `docs/TECH.md` "Tests"; devops brief.
- **V6 Verify stops at the first failure**
  - Steps: In the clone, make one break at a time, run `npm run verify`, then
    `git restore .`: (a) a type error in `src/shared/live.ts`, (b) `any` in
    `src/main/log.ts`, (c) a formatting change in `README.md`, (d) a failing
    assertion in `src/main/live/reducer.test.ts`, (e) `src/renderer/index.html`
    renamed so that only the build fails.
  - Expected: Each run exits non-zero. The summary names the failing step and
    its exit code, and the later steps don't run.
  - Source: `scripts/README.md` "`npm run verify`".
- **V7 Lint catches the banned patterns**
  - Steps: In the clone, add one at a time to a file in `src/main/` (and the
    hook case to a file in `src/renderer/`), run `npm run lint`, then restore:
    `any`; a non-null `!`; an assertion that bypasses checks
    (`as unknown as T`); a floating promise; a promise dropped with `void`; a
    `switch` over a union that misses a case; an unused variable; a plain `//`
    comment; a `/* */` comment; `// NOTE: x` without the owner; a lowercase
    `// note(0913vision): x`; broken TSDoc (`@param {string} x`); a React hook
    called inside a condition.
  - Expected: Each one fails lint with the matching rule. The clean tree passes.
  - Source: devops brief "Lint configuration" and "Comment rules in lint";
    `CLAUDE.md` "Comments" and "Code".
- **V8 CI is green on `main`**
  - Steps: P-github: the CI run of the push that holds `m1`, and the run of the
    latest `main`.
  - Expected: Both runs succeeded on a Windows runner, ran `npm ci` and
    `npm run verify`, and uploaded the `coverage` artifact.
  - Source: MILESTONES; `.github/workflows/ci.yml`.
- **V9 CI triggers**
  - Steps: Read the workflows in `.github/workflows/` at `m1` and the list of
    runs.
  - Expected: Runs start on a push to `main` and on `workflow_dispatch` only.
    The bot's own push starts no run.
  - Source: devops brief; devops-2 task 2.
- **V10 Bump commit and tag**
  - Steps: P-github for the `m1` commit and for the last three pushes before it.
  - Expected: After each push to `main` comes exactly one commit
    `Bump version: x.y.z` by `github-actions[bot]`, with an annotated tag
    `vx.y.z` on it. The commit changes only the version in `package.json` and in
    both version entries of `package-lock.json`, and all three equal `x.y.z`.
    `m1` sits on such a commit.
  - Source: MILESTONES (criterion and "Freeze"); devops-2 task 2.
- **V11 Version rules**
  - Steps: For each bump since the bot landed, list the subjects between the
    previous bump and this one, and compute the expected level. Then, in a
    scratch repository under `D:\llp-dev\qa`, build ranges of only `fix` and
    `docs` commits, with one `feat`, with one `refactor`, with one `break`, and
    of only bump commits, and run the version script with `--dry-run` on each.
  - Expected: Minor when a range holds `break`, `feat`, or `refactor`; patch
    otherwise; bump commits never count; a range of only bump commits makes no
    bump; a push never raises the major version.
  - Source: devops-2 "Version rules"; `docs/decisions.md`.
- **V12 Major version input**
  - Steps: Read the `workflow_dispatch` inputs, and run the version script's dry
    run with its major option.
  - Expected: A `major` boolean input exists, and only it raises the major
    version (to `x+1.0.0`). Running the workflow on GitHub writes to `main`, so
    QA doesn't run it; that part is blocked unless the user runs it.
  - Source: devops-2 task 2.
- **V13 The bump commit as the only exception**
  - Steps: Run the commit and comment checks that devops-2 added on
    `Bump version: 1.2.3`, `Bump version: 1.2`, `bump version: 1.2.3`,
    `Bump version: 1.2.3 now`, and `feat(ui): add the Button component`.
  - Expected: Only the exact bot form and the normal `tag(scope): sentence` form
    pass. If no such check exists at `m1`, the case is recorded as not
    applicable.
  - Source: devops-2 task 3; `CLAUDE.md` "Commit messages".
- **V14 Pre-push stops `main` when a check fails**
  - Steps: Break lint in the clone as in V6 (b). From Git Bash, run
    `.githooks/pre-push origin <url>` with the standard input
    `refs/heads/main <local sha> refs/heads/main <remote sha>`.
  - Expected: The hook runs `npm run verify`, prints a one-line reason, and
    exits non-zero, which makes git stop the push.
  - Source: MILESTONES; devops-2 task 1.
- **V15 Pre-push lets `main` through when the checks pass**
  - Steps: Restore the clone and run the hook the same way.
  - Expected: Verify runs, and the hook exits 0.
  - Source: devops-2 task 1.
- **V16 Other refs pass without verify**
  - Steps: Run the hook with only a tag (`refs/tags/v9.9.9`), with only a branch
    (`refs/heads/feat/qa/x`), with a deletion of a branch (the zero sha), and
    with a tag and `main` together.
  - Expected: The first three exit 0 at once without running verify. With `main`
    among the refs, verify runs.
  - Source: devops-2 task 1.
- **V17 Hook from PowerShell**
  - Steps: Run V14 to V16 from PowerShell through Git for Windows' `sh.exe`.
  - Expected: The same results. The hook file has LF line endings and runs under
    Git for Windows.
  - Source: devops-2 task 1 ("It must work in Git Bash on Windows").
- **V18 Soak judge**
  - Steps: `npm run soak -- --judge <file>` on QA-written records: (a) flat
    memory for 60 minutes, (b) one process whose lowest value rises in every
    window by 12 MB in total, (c) only 30 minutes of a 60-minute run, (d) a
    process that relaunched (a new `pid` under the same `name`), (e) a median of
    50 fps, (f) broken lines among good ones.
  - Expected: (a) passes. (b), (c), and (d) fail with their reason. (e) passes
    with a warning. (f) drops and lists the broken lines.
  - Source: devops brief (soak test skeleton); `scripts/README.md`
    "`npm run soak`".

### W. Window, size classes, and workspaces

Sources for the whole section: MILESTONES criterion 2;
`docs/spec/01-concepts.md` "Windows" and "The three workspaces"; the design
system README "Window sizes and layout"; the `Layout` README.

- **W1 Start at each size**
  - Steps: P-launch for S1 to S12.
  - Expected: The window opens with no dialog. The log has `started` with the
    tag's version. `innerWidth` and `innerHeight` equal the run's CSS size, and
    `devicePixelRatio` equals its scale. The console has no error or warning.
  - Source: MILESTONES criterion 2.
- **W2 Size class of each run**
  - Steps: For each run, read `data-size` on the app root.
  - Expected: The class in the matrix: `narrow` under 1600, `normal` from 1600,
    `wide` from 2400.
  - Source: `Layout` "Sizes and variants".
- **W3 Bars**
  - Steps: For each run, measure the menu bar, toolbar, and status bar.
  - Expected: The menu bar is 30 high and the status bar 28 in every class. The
    toolbar is 40 in `narrow` and 56 in `normal` and `wide`. The work area fills
    the rest, with no gap above or below it.
  - Source: `Layout` "Anatomy".
- **W4 Default columns**
  - Steps: For each run with new app data, measure the three columns, the two
    gaps between them, and both window edges.
  - Expected: Left and right are 220 and 360 in `narrow`, 280 and 480 in
    `normal`, and 320 and 560 in `wide`. Each gap and each edge is 4. The center
    is the window width minus 16 minus both sides (684 at 1280, 1144 at 1920,
    1664 at 2560) and never under 560.
  - Source: `Layout`; design system README.
- **W5 Minimum window size**
  - Steps: At 100%, 125%, and 150%, call `setContentSize(1000, 600)` from the
    main process.
  - Expected: The content stays at 1280×720 CSS pixels at every scale.
  - Source: spec 01 "Windows"; `Layout` "Implementation notes".
- **W6 No Windows title bar**
  - Steps: Read the window's frame option and look at a screenshot of the top
    edge.
  - Expected: No Windows title bar. The 30px menu bar is the top row.
  - Source: spec 01 "Windows only"; design system README "Implementation notes".
- **W7 Window buttons**
  - Steps: Click the minimize, maximize, and close buttons in the menu bar. The
    launcher records the calls.
  - Expected: Minimize calls `minimize`, maximize calls `maximize`, and close
    quits the app as P-quit expects.
  - Source: spec 01 "Menu bar"; `MenuBar` README.
- **W8 Three workspaces**
  - Steps: In S1, S2, and S3, click 진행, 준비, and 화면 설정 on the toolbar in
    turn.
  - Expected: The app opens in 진행. Each tab shows its workspace in the same
    three-column frame with the same column widths. The selected tab has
    `aria-selected="true"` and the others `"false"`. The left column of 진행
    holds 예배 순서 and 퀵 실행, and the left column of 준비 holds 예배 순서 and
    라이브러리. Panels that later milestones build can be placeholders, but
    their names use glossary terms only.
  - Source: MILESTONES; spec 01 "The three workspaces" (opens in 진행 is a
    proposal).
- **W9 Class switch at 1600**
  - Steps: At 100% and a height of 900, P-size through the widths 1599, 1600,
    and 1599.
  - Expected: `narrow`, `normal`, `narrow`. The toolbar switches between 40 and
    56 and between the compact and the regular button forms, and the columns
    switch to that class's widths.
  - Source: MILESTONES; `Layout`.
- **W10 Class switch at 2400**
  - Steps: P-size through 2399, 2400, and 2399.
  - Expected: `normal`, `wide`, `normal`, each with its class's widths.
  - Source: MILESTONES; `Layout`.
- **W11 Height doesn't decide the class**
  - Steps: P-size(1600, 720), P-size(1600, 1440), P-size(1599, 1440).
  - Expected: `normal`, `normal`, `narrow`.
  - Source: `Layout` (the classes go by width).
- **W12 Resize sweep**
  - Steps: Sweep the width from 1280 to 2560 and back, in 1px steps at 100% and
    8px steps at 125% and 150%, and read the layout at each step.
  - Expected: The class changes exactly at 1600 and 2400 in both directions. The
    center is never under 560. Nothing overflows the window (`scrollWidth`
    equals `clientWidth`). No console error, and no long task over 50 ms.
  - Source: `Layout`; `docs/TECH.md` "Performance".
- **W13 Same CSS size at another scale**
  - Steps: Compare S1, S4, and S7, and S2, S5, and S8.
  - Expected: The same class and the same CSS boxes at each scale. Text and
    icons render sharp in a screenshot at the physical size.
  - Source: design system README ("Sizes are CSS pixels after Windows display
    scaling").
- **W14 Workspace switches keep the output state**
  - Steps: Turn on the 본 화면 output with its toolbar button, switch through
    the three workspaces and back, and read `llp.live.get()` after each switch.
  - Expected: The output state doesn't change, and the button stays on.
  - Source: spec 01 ("Switching workspaces never changes the output"); spec 08
    "What must never happen during a service".
- **W15 Single instance**
  - Steps: With a run open, start a second instance with the same
    `LLP_USER_DATA`, then one with a different folder.
  - Expected: The second instance with the same folder exits at once, and the
    first one gets a restore and focus call (recorded). The one with a different
    folder runs as its own instance.
  - Source: spec 01 "Windows" (proposal); `docs/WORKFLOW.md` (app data folders).

### C. Column widths

Sources for the whole section: MILESTONES criterion 3; the `Layout` README
"Behavior" and "States"; `docs/briefs/shell.md`; `docs/spec/02-data.md`
"`app.json` in the app data folder".

- **C1 Gaps**
  - Steps: S2. Find the gap between the left and center columns and the gap
    between the center and right columns, hover each, and press Tab through the
    whole window.
  - Expected: Each gap is 4 wide and as high as the work area, and its cursor is
    `col-resize`. Tab never stops on a gap.
  - Source: `Layout`; shell brief task 6.
- **C2 Left range**
  - Steps: S2. P-drag(left, +500), then P-drag(left, -500).
  - Expected: The left column stops at 400, then at 200. The right column
    doesn't move.
  - Source: `Layout` "Behavior".
- **C3 Right range**
  - Steps: S2. P-drag(right, -500), then P-drag(right, +500).
  - Expected: The right column stops at 720, then at 320. The left column
    doesn't move.
  - Source: `Layout` "Behavior".
- **C4 Center floor in a narrow window**
  - Steps: S1 (220 and 360, center 684). P-drag(right, -300), then P-drag(left,
    +300).
  - Expected: The right column stops at 484 (center 560), and then the left
    column doesn't widen at all. The center is at least 560 after every step.
  - Source: MILESTONES; `Layout`.
- **C5 Center floor in a normal window**
  - Steps: Width 1600 (280 and 480, center 824). P-drag(right, -400), then
    P-drag(left, +200).
  - Expected: The right column stops at 720 (center 584), then the left column
    stops at 304 (center 560).
  - Source: MILESTONES; `Layout`.
- **C6 Pointer outside the window**
  - Steps: S2. Press on the left gap, move the pointer past the left and right
    window edges and back, and release outside the window.
  - Expected: The width follows the pointer within its range while the pointer
    is outside (pointer capture), the drag ends on release, and the widths are
    valid.
  - Source: shell brief task 4.
- **C7 Panels don't re-render during a drag**
  - Steps: S2. Put a `MutationObserver` on the content of every panel, then run
    a 50-step drag.
  - Expected: No mutation inside the panels during the drag. Only the grid's
    widths change.
  - Source: shell brief task 4; `CLAUDE.md` ("Re-render only what changed").
- **C8 One pointer at a time**
  - Steps: S2. Start a drag of the left gap with the mouse, and during it send a
    touch drag on the right gap (CDP `Input.dispatchTouchEvent`). Then start a
    drag with the right mouse button.
  - Expected: The second pointer changes nothing while the first drags. Record
    what the right button does.
  - Source: shell-1 fix ("allow one pointer at a time").
- **C9 Resize during a drag**
  - Steps: S2. Start a drag of the right gap, shrink the window to 1280 from the
    main process, keep moving, and release.
  - Expected: The widths fit the new window at once, the center stays at least
    560 throughout, and the console has no error.
  - Source: shell-1 fix ("fit after a resize during a drag").
- **C10 Save when a drag ends**
  - Steps: Watch the modification time and the content of `app.json` during and
    after a 50-step drag, and after a drag that ends where it started.
  - Expected: No write during the drag, and one write after the release. A drag
    that ends at the starting width writes nothing.
  - Source: `Layout` "States" ("Save that width when the drag ends"); shell-1
    fix ("save a column only when its width changed").
- **C11 Widths per size class**
  - Steps: S2: set the left column to 350 and the right to 600. Resize to 1280,
    and set the left to 250. Resize to 2560, and set the right to 650. Then
    resize to 1920, 1280, and 2560.
  - Expected: Each class shows its own widths: `normal` 350 and 600, `narrow`
    250 and 360, `wide` 320 and 650. A class with no saved widths shows its
    defaults.
  - Source: MILESTONES; `Layout` "Behavior".
- **C12 Shrink rule in a narrow window**
  - Steps: Width 1599: set the left column to 400 and drag the right as wide as
    it goes (623, center 560). Shrink the window to 1280, then grow it back
    to 1599.
  - Expected: At 1280 the right column shows 320 and the left 384: the right
    shrinks first to its minimum, then the left. The center is 560. Back at
    1599, the columns show 400 and 623 again, and `app.json` still holds 400
    and 623.
  - Source: `Layout` "Behavior"; shell brief task 3.
- **C13 Shrink rule in a normal window**
  - Steps: Width 2399: set 400 and 720. Shrink to 1600, then grow back to 2399.
  - Expected: At 1600 the columns show 400 and 624 (center 560). Back at 2399
    they show 400 and 720.
  - Source: `Layout` "Behavior".
- **C14 Restart keeps the widths**
  - Steps: Run C11, then P-restart at 1920 and resize to 1280 and 2560. Repeat
    with the restart at 1280 and at 2560.
  - Expected: After each restart, every class shows the widths saved before it.
  - Source: MILESTONES criterion 3.
- **C15 Restart at another scale**
  - Steps: After C14, P-restart at 125% with 1536×864 (`narrow`) and with
    2048×1152 (`normal`).
  - Expected: Each class shows its saved CSS widths unchanged.
  - Source: design system README (CSS pixels after scaling).
- **C16 The saved file**
  - Steps: After C14, read `<LLP_USER_DATA>\app.json` and parse it with the
    `app.json` schema (P-schema).
  - Expected: UTF-8 JSON with LF line endings, a final newline, and no byte
    order mark. `layout.narrow`, `layout.normal`, and `layout.wide` hold the
    saved `left` and `right`. The file parses with no error.
  - Source: spec 02 "`app.json` in the app data folder" and "Common rules".
- **C17 Unknown fields in `app.json`**
  - Steps: Quit, add `"qaUnknown": {"a": [1, null]}` at the top level and
    `"qaInner": true` inside `layout.normal`, restart, and drag once.
  - Expected: Both fields are still in `app.json`, unchanged, after the save.
  - Source: `CLAUDE.md` ("Preserve unknown fields"); spec 02 "Unknown fields".
- **C18 Force-quit right after a drag**
  - Steps: 20 times: drag, then P-kill 0, 10, 50, or 200 ms after the release,
    then start again.
  - Expected: `app.json` always holds either the old or the new content, never
    an empty or half-written file. A leftover temporary file doesn't break the
    next start. Every start shows valid widths.
  - Source: `CLAUDE.md` ("Write files atomically"); spec 02 "Atomic writes".
- **C19 Broken `app.json`**
  - Steps: Start with `app.json` as (a) text that isn't JSON, (b) an empty file,
    (c) a JSON array, (d) a wrong `format` if the file has one, (e)
    `layout.normal.left` set to `"wide"`, (f) left 50 and right 5000, (g) a
    higher `schemaVersion`. After each start, drag once.
  - Expected: The app starts every time with no dialog and logs one entry that
    names the file and the field. (a) to (e) show the defaults. (f) shows widths
    inside the ranges (record whether the schema rejects them or the shell
    clamps them). The app never overwrites a broken file on its own: widths
    dragged in that session stay in memory, the file stays as it was, and one
    warning is logged (lead decision, 2026-10-25). (g) opens read-only: the
    widths show, and the drag doesn't write the file.
  - Source: spec 02 "Schema versions and migration"; `docs/TECH.md` "Storage".
- **C20 No `app.json` yet**
  - Steps: Start with an empty `LLP_USER_DATA` folder, then with a folder path
    that doesn't exist yet. Drag once in each.
  - Expected: The defaults show, and the drag creates `app.json` (and the
    folder).
  - Source: spec 02 ("create any missing file").
- **C21 Save failure**
  - Steps: Set the read-only attribute on `app.json` and drag. Clear it and drag
    again.
  - Expected: The drag works on screen, the failed write is logged, no dialog
    opens, and the app keeps running. The next drag after the fix writes the
    file. The "저장할 수 없음" notification comes with M2.
  - Source: spec 02 "Save failures".
- **C22 Ranges at each scale**
  - Steps: Repeat C2 to C4 in S4 and S7.
  - Expected: The same CSS ranges and the same center floor at each scale.
  - Source: design system README.
- **C23 Repeated drags stay flat**
  - Steps: S2. P-counters, 500 drags of each gap with a save after each,
    P-counters, then another 500 drags and P-counters.
  - Expected: DOM nodes and JS event listeners return to the baseline. The JS
    heap and the main process memory, after garbage collection, end within 1 MB
    of the baseline and don't grow in the second round. The last width wins in
    `app.json` (writes run in order).
  - Source: `CLAUDE.md` ("Release everything you register"); `docs/TECH.md`
    "Memory"; spec 02 ("If writes to one file overlap, run them in order").

### G. Gallery

Sources for the whole section: MILESTONES criterion 4; `docs/briefs/ui.md` tasks
4 to 7; the design system README; the README of each component.

- **G1 The gallery opens**
  - Steps: P-gallery.
  - Expected: The page loads with no console error and no failed request. It has
    a section for each of the 16 M1 components, and every icon loads.
  - Source: MILESTONES; ui brief task 5.
- **G2 The gallery stays out of the build**
  - Steps: `npm run build`, list `out/renderer`, and search the built files for
    a string that only the gallery uses.
  - Expected: No `gallery.html` and no gallery code in the build.
  - Source: ui brief task 5.
- **G3 Content security policy**
  - Steps: Compare the policy in `src/renderer/gallery.html` with the one in
    `src/renderer/index.html`.
  - Expected: The same policy.
  - Source: ui brief task 5.
- **G4 Every state is shown**
  - Steps: For each component, check part (a) of its case below against the rows
    of the "Sizes and variants" and "States" tables in its README.
  - Expected: Every row appears in the gallery, pinned or reachable by forcing
    its pseudo-state.
  - Source: MILESTONES criterion 4.
- **G5 Token references in the authored CSS**
  - Steps: Read the CSS rules of the ui components as the dev server serves them
    (`document.styleSheets` in the gallery, which keeps the CSS module source
    values). List every declaration of a color, size, spacing, radius, border,
    shadow, font, or transition property whose value isn't built from
    `var(--…)`. Literals that carry no design value are allowed: `0`, `auto`,
    `none`, `inherit`, `transparent`, `currentColor`, `100%`, and `1`. The look
    itself is compared in part (b) of each component case, under the same layout
    conditions as the card.
  - Expected: No other literal value. Each one found is listed with its file and
    rule.
  - Source: design system README "Implementation notes" ("use only
    `var(--token-name)` in component CSS"); `CLAUDE.md` (design tokens for every
    value).
- **G6 Red only for output**
  - Steps: Scan the computed color, background, outline, and box shadow of every
    element for the `live` color.
  - Expected: `live` appears only on the LIVE badge, the live dot, `ring-live`,
    the dot of an output toggle that is on, and `ring-field-error`.
  - Source: design system principle 4; spec 01 "Red is only for output".
- **G7 Focus ring only from the keyboard**
  - Steps: Click each focusable sample with the mouse, then reach it with Tab.
  - Expected: No ring after the click. After Tab, a 2px `accent` outline with a
    1px offset (inside, at -2px, on list rows and window buttons), and
    `ring-field-focus` on text fields.
  - Source: design system README "States and motion".
- **G8 Disabled samples**
  - Steps: Inspect each disabled sample, hover it, try to use it (click, Enter,
    Space, arrows), and Tab through the page.
  - Expected: For every component: `text-off` text and icons, `opacity` 1, no
    hover change, no action, and the reason in a tooltip on hover. Focus and the
    attribute follow each README:
    - `aria-disabled="true"` and still focusable, so the tooltip shows on
      keyboard focus too: Button, IconButton, ToolbarButton (as the `Tooltip`
      README asks of every disabled button), the segments of a disabled
      SegmentedControl, and the primary button of an AlertDialog with every
      check off.
    - Menu items: `aria-disabled="true"`; the arrows point to them, but Enter
      and Space don't run them.
    - TextField: native `disabled` on the input, which Tab skips.
    - ListRow: `disabled` or `aria-disabled`, either one.
    - Select, Checkbox, Switch, Slider, and Panel tabs and the service switcher
      set only the look in their READMEs: record the attribute and whether Tab
      reaches them.
  - Source: design system README "States and motion"; the "Behavior" and
    "Implementation notes" of each component README; `Tooltip` README.
- **G9 Motion**
  - Steps: Read the transitions of hover backgrounds, menus, tooltips, dialogs,
    and the switch. Then emulate `prefers-reduced-motion: reduce` (CDP
    `Emulation.setEmulatedMedia`) and read them again.
  - Expected: 100 ms ease-out for hover and the switch, a 120 ms fade in for
    menus and tooltips that close at once, and a 160 ms fade for dialogs. All
    are 0 under reduced motion. No other motion.
  - Source: design system README "States and motion".
- **G10 No native tooltips**
  - Steps: Scan the DOM for `title` attributes.
  - Expected: None. Every tooltip is the `Tooltip` component.
  - Source: `Tooltip` README "Behavior".
- **G11 Accessible names and roles**
  - Steps: CDP `Accessibility.getFullAXTree`.
  - Expected: Every button, field, slider, switch, checkbox, tab, menu item, and
    dialog has a name. Icons are hidden. Roles match each README.
  - Source: the aria rules of each component README.
- **G12 Writing**
  - Steps: Collect every text node, `aria-label`, placeholder, and tooltip.
  - Expected: Korean UI text. No word from the glossary's "Don't use" column, no
    middle dot (U+00B7) or em dash (U+2014), no tooltip that ends with a period,
    no button name that ends in "하기", and no explanatory sentence.
  - Source: design system README "Writing" and glossary; `CLAUDE.md` "Language".
- **G13 Pretendard**
  - Steps: Read `document.fonts` and each sample's computed `font-family`.
  - Expected: Pretendard Variable loads from the bundle, not the network, and
    every component uses it.
  - Source: design system README "Typography".
- **G14 Floating surfaces are released**
  - Steps: P-counters. Open and close each Menu, Select menu, Tooltip, Dialog,
    and AlertDialog sample 200 times. P-counters.
  - Expected: DOM nodes, listeners, and portals return to the baseline, and the
    background loses `inert` after each dialog closes.
  - Source: ui brief task 4; `CLAUDE.md` ("Release everything you register").
- **G15 Narrow forms**
  - Steps: View the gallery at widths 1280 and 1920.
  - Expected: The compact ToolbarButton and Slider forms show, and no sample
    overflows.
  - Source: `ToolbarButton` and `Slider` READMEs.
- **G16 Floating surfaces at the window edges**
  - Steps: Open each Menu, Select, and Tooltip sample with its target at each
    window edge (by resizing the viewport or scrolling).
  - Expected: Menus open 4px below their button and tooltips 6px below their
    target, flip above when there is no room below, and move 8px inward at the
    side edges. A right-click menu flips left or up at the edges. A menu is
    never taller than the window minus 16 and scrolls inside.
  - Source: `Menu`, `Tooltip`, and `Layout` READMEs.

Each component case below has three parts. Part (a) lists the variants and
states that must appear. Part (b) is P-compare against the component's card
(P-card) for every state in the card. Part (c) lists the behavior to check from
the README's "Behavior" section.

- **G20 Button**
  - (a) Primary, secondary, and ghost, each in sm and md, with and without a
    leading icon. Default, hover, pressed, focus, and disabled.
  - (c) Enter and Space press it. A disabled button (`aria-disabled`) ignores
    clicks and keys but stays focusable and shows its tooltip. Icons are
    `aria-hidden`. The text never wraps, and the width fits the text.
- **G21 IconButton**
  - (a) sm and md. Default, hover, pressed, on (`aria-pressed`), menu open
    (`aria-expanded`), focus, and disabled.
  - (c) The `aria-label` and the tooltip carry the same name, with the shortcut
    in the tooltip ("닫기 Esc"). An on/off button flips `aria-pressed` on each
    press and keeps its name. A menu button has `aria-haspopup="menu"`. A button
    at the end of a list row doesn't trigger the row.
- **G22 SegmentedControl**
  - (a) Default, fill, icon segments, and counts (with a warning count).
    Default, hover, pressed, selected, focus, and disabled.
  - (c) The radio, tabs, and toggle roles. Tab reaches only the selected
    segment. Left and Right select at once and wrap, and Home and End go to the
    ends. A click on the selected segment doesn't call `onChange`. The group has
    an `aria-label`. A disabled group sets `aria-disabled` on each segment. Fill
    names truncate with an ellipsis.
- **G23 ToolbarButton, ToolbarTabs, OutputToggle**
  - (a) Workspace tab selected and not selected, 미디어 on and off, Look with
    its arrow, output live, off, and warning, each in the regular and the
    compact form (미디어 as an icon only in the compact form). Hover, pressed,
    menu open, focus, and disabled.
  - (c) The tab list "작업 공간": arrows switch at once, and Tab stops only on
    the selected tab. 미디어 has `aria-pressed` and the tooltips "미디어 열기"
    and "미디어 닫기". Look has `aria-haspopup="menu"` and `aria-expanded`. An
    output has `aria-pressed` (true for live and warning) and `data-state`, the
    three sit in the group "화면 출력", and the tooltips read "본 화면 출력 끄기
    (모니터 2)", "본 화면 출력 켜기 (모니터 2)", and "본 화면: 모니터 2를 찾을
    수 없습니다". An output that is off has no dot. The dot's ring takes the
    hover and pressed backgrounds.
- **G24 TextField, NumberField, TextArea**
  - (a) md, sm, search with its clear button, number with a unit, title, the
    toolbar field with its ring, and multiline. Default, hover, focus, error,
    and disabled.
  - (c) A click on the icon focuses the input. Search: Esc clears the value, and
    a second Esc releases focus; the clear button keeps focus in the field and
    isn't in the tab order. Number: Up and Down change the value by 1, and by 10
    with Shift; an out-of-range value snaps on blur. Error: `aria-invalid` and
    `aria-describedby` point to the reason, and the error ring stays with focus.
    Multiline: grows to 8 lines, then scrolls inside, with no resize handle.
    Placeholders are examples, not sentences.
- **G25 Select, SelectMenu**
  - (a) sm, md, block width, leading media, leading color tile, leading icon,
    and extra information. Default, hover, pressed, open, focus, and disabled.
  - (c) A click, Enter, Space, or Down opens the menu 4px below, aligned left,
    and no narrower than the button. The current value has the check. Choosing
    closes the menu and returns focus, and Esc closes it without choosing.
    `aria-expanded` and `aria-haspopup="listbox"` are set. A long value
    truncates with an ellipsis.
- **G26 Checkbox, CheckRow**
  - (a) Box off, on, and mixed. Check row, list row, group header row, and row
    with a value. Hover on list rows, focus, disabled off, and disabled on and
    mixed.
  - (c) A click anywhere in the row toggles it, and so does Space. A group
    header that is mixed or off turns the group on, and one that is on turns it
    off; the header recounts after each item changes. In a tree list, Tab enters
    once, Up and Down move, and Space toggles. `aria-checked` is `true`,
    `false`, or `mixed`.
- **G27 Switch, SwitchRow**
  - (a) Off, on, focus, disabled off, and disabled on. The property row
    placement (at the left of the control cell) and the name and switch row.
  - (c) A click and Space toggle it, and so does a click on its name. The arrows
    don't. `role="switch"` with `aria-checked` and a linked name. The thumb
    moves 12px in 100 ms, and at once under reduced motion.
- **G28 Slider**
  - (a) Default (120 wide), compact (96), and block. Default, dragging, focus,
    and disabled. Rows with a leading icon.
  - (c) A click on the track moves the knob there, and the drag continues from
    it. Arrows move one step, PageUp and PageDown 10%, and Home and End to the
    ends. It has an `aria-label`, and the volume slider has
    `aria-valuetext="70%"`. The filled part follows `--ll-value`. The focus ring
    is only on the knob.
- **G29 Menu**
  - (a) A menu bar menu, a submenu, a right-click menu, a popover list with
    search and dates, and an 이름표 menu with swatches. Default, pointed,
    submenu open, current item, delete item, disabled, and search focus.
    Dividers and group names.
  - (c) Opens on click, Enter, Space, and Down (the right-click menu on
    right-click, Shift+F10, and the Menu key), with the first item pointed or
    the search field focused. Up and Down move (disabled items are pointed but
    don't run), Home and End go to the ends, Right opens a submenu and Left
    closes it, Enter and Space run an item, Esc closes one level, Tab closes
    all, and a letter jumps to the item that starts with it. Down moves from the
    search field into the list. A submenu opens after 150 ms of hover and stays
    open during a diagonal move of up to 300 ms. An outside click closes the
    menu and doesn't reach what is under it. Running an item closes all menus
    and returns focus. It fades in over 120 ms and closes at once. Roles `menu`,
    `menuitem`, `menuitemradio`, `menuitemcheckbox`, `separator`, and `group`.
    The width is 180 to 320.
- **G30 Tooltip**
  - (a) Name only, with a shortcut, two lines, wrapping at 280, on a disabled
    target, and on a field with an error.
  - (c) Appears after 600 ms. Moving to another target within 300 ms shows its
    tooltip at once. Keyboard focus shows it after the delay, and mouse focus
    doesn't. It closes at once on leave, click, any key (Esc included), scroll,
    and window blur, and it never takes the pointer. `role="tooltip"`,
    `aria-describedby` on the target, and `aria-keyshortcuts` for a shortcut. It
    sits 6px below, centered on the target, or left-aligned to a target wider
    than itself. It wraps at word boundaries (`keep-all`), and a path with no
    break points breaks anywhere.
- **G31 Dialog**
  - (a) The s, m, l, and xl widths. A header with title, subtitle, and close.
    The option bar and the input bar. A body, and a split body with an aside and
    a list box. The footer. Close button states, a disabled primary button, and
    a body that overflows.
  - (c) Focus goes to the first text field with its text selected, or to the
    primary button. Tab and Shift+Tab cycle inside. Enter triggers the primary
    button, except in a multiline field or a list. Esc and the close button do
    the same as 취소. A click on the scrim doesn't close it. Focus returns to
    the opener. The scrim leaves the menu bar uncovered. The background is
    `inert`. `role="dialog"`, `aria-modal`, and `aria-labelledby`. A keydown of
    F1 to F7 still reaches the window while the dialog is open. At 1280×720, the
    dialog is at most the window width minus 32 and the window height minus 64,
    and only the body scrolls.
- **G32 AlertDialog**
  - (a) One question (460) with the icon cell, the title, and extra information.
    The list type (600) with group names and check rows. Secondary and primary
    buttons, and all checks off.
  - (c) Focus goes to the primary button. Enter triggers it, and Esc triggers
    취소, or the other action when there is no 취소. No close button, and a
    click on the scrim doesn't close it. 취소 sits at the left end and the
    primary button at the far right. With all checks off, the primary button is
    `aria-disabled`. `role="alertdialog"`, `aria-labelledby`, and
    `aria-describedby`. A second confirmation dialog can't open on top. F1 to F7
    pass as in G31.
- **G33 Panel**
  - (a) A tab header, a tab with the service switcher, a tab with a count, a
    title header with a position, a tool row, a list body, a flush body, and a
    footer row with a slider. Tabs selected, unselected, hover, focus, and
    disabled. The switcher default, hover, pressed and open, focus, and
    disabled.
  - (c) The tab list selects at once with the arrows, Tab stops only on the
    selected tab, and the body is a `tabpanel` linked to it. The switcher opens
    a popover list 4px below, aligned left, with `aria-haspopup="menu"` and
    `aria-expanded`. The `section` has the panel's `aria-label`. Only the body
    scrolls. The focus order is header, tool row, body, footer. A long title
    truncates.
- **G34 ListRow, ListBox**
  - (a) One-line rows with an icon, extra information, a warning icon, and the
    LIVE badge. A group header, a two-line item, an empty slot, the drop
    position, and the drag ghost row. Default, hover, pressed, focus (the ring
    inside), selected, live, past item, missing file, 퀵 실행 on, and disabled.
  - (c) `listbox` and `option` with `aria-selected`. Tab enters once, Up and
    Down move, and Home and End go to the ends, skipping group headers. A click
    only selects. A 퀵 실행 row toggles `aria-pressed` and its `live` bar. A
    truncated name shows its tooltip. The LIVE badge replaces the extra
    information. A disabled row keeps its icon visible in `text-off`.
- **G35 StatusMarks**
  - (a) The LIVE badge, also on a selected row. Dots ok, warning, live, off, and
    with the cut ring. The count badge, hidden at 0. The progress bar and the
    playback bar.
  - (c) The badge reads "LIVE". Dots are `aria-hidden`, and the parent carries
    the name. A count is read with its tab name. Progress has
    `role="progressbar"` with its minimum, maximum, current value, and label,
    and the playback bar has `aria-valuetext`. A bar's length changes without
    animation.

### D. Data formats

Sources for the whole section: MILESTONES criterion 5; `docs/spec/02-data.md`;
`docs/briefs/data.md`; `docs/TECH.md` "Storage".

Inputs:

- **Spec samples:** the `.llsong` and `.llservice` samples in spec 02 and in
  `design/drafts/llp-design/project/Main.dc.html`, with each `...` filled in
  with a lowercase UUID v4 or with lines of hymn 1 (만복의 근원 하나님).
- **Full samples:** one sample for each format that sets every field in its spec
  table, optional fields included.
- **Minimal samples:** one sample for each format with only its required fields.
- **Mutations:** P-mutate on each full sample, plus the rules in D20 to D37.

Common cases:

- **D1 A parser and a serializer for every format**
  - Steps: List the exports of `src/shared/schema/` at the tag.
  - Expected: `parse<Format>` and `serialize<Format>` exist for all 18 formats:
    `.llsong`, `.llservice`, 틀, `screens.json`, `looks.json`,
    `stage-layouts.json`, `macros.json`, `quick.json`, `messages.json`,
    `notices.json`, `props.json`, `timers.json`, `labels.json`,
    `preferences.json`, `shortcuts.json`, `bible.json`, `media.json`, and
    `app.json`.
  - Source: MILESTONES; data brief "Done when".
- **D2 Samples parse**
  - Steps: P-schema with the spec, full, and minimal samples.
  - Expected: Each returns success with `access` editable and `sourceVersion` 1,
    and the data equals the input.
  - Source: MILESTONES.
- **D3 Each parser takes only its own format**
  - Steps: Parse each sample with the parser of every format whose `format`
    value differs from the sample's.
  - Expected: A `format` error for every such pair. The `format` values are
    those in spec 02 (`llsong`, `llservice`, `llsettings.screens` and the other
    settings values, and `llmedia`). Services and 틀 share `llservice`, so their
    parsers aren't crossed here; D21 and D22 check the date and time rules that
    tell them apart.
  - Source: spec 02 "Header fields", "Templates", and "App-wide settings".
- **D4 Broken JSON**
  - Steps: Empty text, `{`, a trailing comma, a single-quoted string, `NaN`, the
    first half of a valid sample, a valid sample with CRLF line endings, and a
    valid sample with a byte order mark.
  - Expected: Broken text returns a `json` error with an empty `field` and the
    file name. The CRLF and byte order mark samples parse. No exception.
  - Source: spec 02 "Schema versions and migration"; data brief task 4.
- **D5 Not an object**
  - Steps: `null`, `[]`, `42`, `"text"`, and `true`.
  - Expected: An error result for each (record its kind), and no exception.
  - Source: data brief task 4.
- **D6 Header fields**
  - Steps: Remove `format`; use `"LLSONG"`; remove `schemaVersion`; set
    `schemaVersion` to 0, -1, 1.5, `"1"`, and `null`.
  - Expected: `format` errors for the `format` cases, and `invalid` errors with
    the field `schemaVersion` for the version cases.
  - Source: spec 02 "Common rules".
- **D7 A newer version**
  - Steps: Each full sample with `schemaVersion` 2; then with 2 and a broken
    field; then serialize the data of the first.
  - Expected: The first returns success with `access` read-only and
    `sourceVersion` 2. The second returns a `newer` error with the field. The
    serializer refuses data of a newer version, so the app can't write it.
  - Source: spec 02 ("open the file read-only").
- **D8 Migration hook**
  - Steps: With the exported pipeline, build a test format with one step from
    version 1 to 2. Parse a version 1 file; then use a step that throws; then a
    step that returns data the schema rejects.
  - Expected: Upgraded data with `sourceVersion` 1; a `migration` error; an
    `invalid` error with the field. Version 1 has no real steps, so this checks
    only the hook.
  - Source: data brief task 5; spec 02 "Schema versions and migration".
- **D9 Unknown fields survive a round trip**
  - Steps: Add unknown fields, with values of every JSON type, at every object
    level of each full sample: the top level, 장, 구성, items, Bible passages,
    screen displays and bounds, Look screens and layers, lyric styles, stage
    elements with their text and box, 매크로 actions and collections, media
    items and their props, playlists, the preference groups, and the `app.json`
    layout entries. Parse, serialize, and parse again.
  - Expected: Every unknown field comes back at its level with a deep-equal
    value. Known fields keep the schema order, and unknown fields follow in
    their original order.
  - Source: MILESTONES; spec 02 "Unknown fields".
- **D10 The written text**
  - Steps: Serialize each sample twice and look at the bytes.
  - Expected: The same text both times: UTF-8 without a byte order mark, LF
    only, 2-space indent, a final newline, and Korean written as is, not as `\u`
    escapes.
  - Source: spec 02 "Common rules".
- **D11 The serializer refuses invalid data**
  - Steps: Serialize data with a required field removed and with a field of the
    wrong type.
  - Expected: An `invalid` error result with the field, no text, and no
    exception.
  - Source: data brief task 4.
- **D12 Hostile input**
  - Steps: A song with 10,000 장 (about 10 MB), JSON nested 100,000 levels deep,
    a 1 MB string field, unknown fields named `__proto__` and `constructor`, and
    numbers such as `1e309` and `-0`.
  - Expected: No exception. The big song parses in under 1 second (record the
    time). Deep nesting returns an error. `__proto__` changes no prototype:
    `Object.prototype` stays clean, and the parsed object's prototype is
    `Object.prototype` (record whether the field is kept). `1e309` is refused
    wherever the spec expects a number.
  - Source: `CLAUDE.md` ("Validate every value from outside the process");
    `docs/TECH.md` "Preventing runtime errors".
- **D13 IDs**
  - Steps: In every UUID field: an uppercase UUID, a UUID v1, a UUID without
    dashes, an empty string, and a number. Duplicate IDs in a list: two items in
    `order`, two Looks, two screens, two media items.
  - Expected: Only a lowercase UUID v4 passes, and each failure names its field.
    A duplicate fails with the path of the second one.
  - Source: spec 02 "Common rules" ("Never reuse an ID").
- **D14 Dates and times**
  - Steps: The service `date` as `2026-11-01T11:00`, `2026-11-01`,
    `2026-11-01T11:00:00`, `2026-11-01T11:00+09:00`, `2026-13-01T11:00`,
    `2026-02-30T11:00`, and `2026-11-01T24:00`. `updatedAt` with and without an
    offset. A 틀 `time` as `09:30`, `9:30`, and `24:00`.
  - Expected: Only the forms in the spec pass: `YYYY-MM-DDTHH:mm` for a service
    date, ISO 8601 with an offset for timestamps, and `HH:mm` for times. Each
    failure names its field.
  - Source: spec 02 "Common rules" ("Dates").
- **D15 The error result**
  - Steps: Check every failure in this section.
  - Expected: `file` is the name passed in. `field` is the dot path of the
    failing field (for example `slides.0.lines` or `order.2.song`), or empty for
    a whole-file error. `message` is in English and names the problem.
  - Source: MILESTONES ("with the field that failed"); data brief task 4.
- **D16 Parsers never throw**
  - Steps: Run every input of this section through every parser, then 10,000
    random mutations of the samples (delete, duplicate, or retype a random
    node).
  - Expected: Every call returns a result, with no exception.
  - Source: data brief task 4.
- **D17 Live commands are validated**
  - Steps: In S2, send through `window.llp.live.send` from CDP each valid
    command type, then malformed ones: an unknown type, a missing payload,
    fields of the wrong type, extra fields, an empty `screenId`, a negative
    `position`, `lines` with a number, a 1 MB text, `null`, a string, an array,
    and an object with a `__proto__` key. Read `llp.live.get()` and the log
    after each.
  - Expected: Valid commands change the state as `src/main/live/reducer.ts`
    defines. Each malformed command is dropped with one log warning, the state
    stays the same, the main process throws nothing, and the app stays
    responsive.
  - Source: MILESTONES task data-4; `CLAUDE.md` ("Validate every value ... IPC
    messages").
- **D18 Window actions are validated**
  - Steps: `window.llp.window.control` with each valid action (recorded by the
    launcher), then with `"exit"`, `null`, and `{}`.
  - Expected: The invalid values do nothing and throw nothing.
  - Source: `src/main/ipc.ts`; `CLAUDE.md`.

Rules for each format. Each listed input fails with its field named, unless it
says "passes" or "record".

- **D20 `.llsong`**: `title` empty or only spaces; `slides` empty; a 장 whose
  `lines` is missing, a string, or holds a number; `lines` `[]` passes (a blank
  장); `label` absent or `""` passes; `background` that isn't a media ID; a 구성
  `name` that is empty, `"기본"`, or a duplicate; 구성 `slides` with 0, -1, 1.5,
  or a number above the 장 count; a repeated number passes; `arrangements` `[]`
  passes, and so does a 구성 with `slides` `[]` (the spec keeps an empty 구성);
  `updatedAt` without an offset.
- **D21 `.llservice`**: `name` missing; `date` as in D14, missing, or replaced
  by a `time`; `order` missing or not an array; an item with no kind key, or
  with two (`header` and `song`); an item with an unknown kind key
  (`"score": {}`) passes and comes back unchanged; an item `id` that is missing
  or duplicated. Song items: `song` that isn't a song ID; `arrangement`,
  `background`, `macro`, and `memo` are optional; `macro` `"찬양"` (a name, as
  in the `Main` sample) passes; a memo with several lines passes. Slots: `slot`
  `"song"`, `"bible"`, and `"slides"` pass and `"video"` fails; `title` missing.
  Bible passages: `split` and `reference` outside their enums; `verseNumbers`
  that isn't a boolean. Media and 공지 items: an ID that isn't a UUID.
- **D22 틀**: no `date` passes; `time` (`HH:mm`) as in D14, and no `time`
  passes; slot items and filled items (song, media, 공지) pass; a 틀 with a
  `date` (record whether it is kept as an unknown field or refused). On the
  service side, D21 checks that a service without `date`, or with a `time` in
  place of `date`, fails with the field `date`.
- **D23 `screens.json`**: `kind` outside its enum; `method` `"ndi"` passes;
  `"fullscreen"` with and without `display` passes; `display.bounds` missing a
  field; `scaleFactor` 0 or a string; `resolution` with 0 or a negative size;
  `onDisconnect` and `previewBackground` outside their enums; `edgeMargin` -1
  and 101 (record, the spec sets no range); an `ndi` object with any content
  passes and comes back unchanged. If the module exports defaults: 본 화면
  (audience, full screen, no monitor), 방송 자막 (audience, capture window,
  1920×1080, green preview background), 무대 화면 (stage, full screen).
- **D24 `looks.json`**: `current` that names no Look in `looks` (record);
  `screens` keyed by a string that isn't a screen ID; a `layers` value that
  isn't a boolean; `lyricStyle` and `stageLayout` that aren't IDs; `background`
  with an unknown `kind`; colors `#fff`, `red`, and `#GGGGGG` fail, and
  `#3D8BF0` is recorded; lyric style `align` `"right"`, `vAlign` `"center"`,
  `maxLines` 0 and 1.5, `size` 0, `margin` -1, and `weight` 50 and 1000
  (record). If the module exports defaults: the 평상시 Look as spec 02 describes
  it.
- **D25 `stage-layouts.json`**: `width` or `height` 0 or 1.5; an element `kind`
  outside the seven values; `show` on an element that isn't a 장 element
  (record); `frame` without `w`; `text.autoFit` that isn't a boolean; `box` with
  unknown fields comes back unchanged. If the module exports a default: 현재와
  다음 with its seven elements.
- **D26 `macros.json`**: `color` `"none"` and `"red"` fail, and the eight colors
  pass; an `icon` outside the design system icon list (record); an action of an
  unknown kind (record whether it is kept like an unknown item); `runOnStartup`
  that isn't a boolean; `schedule` with any content passes; a collection whose
  `macroIds` names no 매크로 (record).
- **D27 `quick.json`**: `kind` outside its enum; `"black"` without `ref` passes;
  `"bible"` with a passage object passes; `"song"` with a passage object fails.
- **D28 `messages.json`**: `icon` outside its enum; `targets` `"all"` and a list
  of screen IDs pass, and `[]` is recorded; `duration` `null` passes, -5 fails,
  and 0 is recorded; `stagePresets` holding a number; a `{blank` with no closing
  brace (record).
- **D29 `notices.json`**: `media` holding a non-ID; `interval` 0 or negative;
  `loop` that isn't a boolean; `targets` that aren't screen IDs.
- **D30 `props.json`**: an image `content` without `media`; a text `content`
  without `text`; a text `style` with a bad color; a `{timer:<ID>}` token in the
  text passes.
- **D31 `timers.json`**: `kind` outside its enum; `countdownTo` or `elapsedFrom`
  without `time`; `countdown` without `duration`; `clock` with neither passes;
  `time` `"25:00"`; a negative `duration`.
- **D32 `labels.json`**: a duplicate `name`; `color` outside the eight colors
  and `"none"`; `key` `""` and `"Ctrl+A"` (record what counts as one key); `key`
  `null` passes. If the module exports defaults: 1절, 2절, 3절 (teal),
  프리코러스 (green), 후렴 (yellow), 브리지 (violet), 간주 (gray), 엔딩 (none),
  all with `key` `null`.
- **D33 `preferences.json`**: each field with a wrong type and with a value
  outside its enum or range (`language` `"en"`, `backupCopies` 0, `previewFps`
  0, `backup.keep` 0, `bible.maxLines` 0, and each `import.txt` field); an
  `import.pptx` object with any content passes. The defaults equal the spec 02
  table: `ko`, `lastService`, 10, false, true, true, `window`, true, 30, true,
  30, true, 4, `bottomRight`, `blankLine`, `bracketLine`, `title`, `auto`. A
  file with only some fields parses; record whether the parser or the store
  fills in the rest.
- **D34 `shortcuts.json`**: `bindings` with `[]` (none) and with
  `[["Ctrl", "1"]]` pass; a binding that is a string fails; an unknown command
  ID (record whether it is kept for later versions).
- **D35 `bible.json`**: two translations with `default` true (record); 11
  `recents` (record against the cap of 10); a `file` with a path separator
  (record).
- **D36 `media.json`**: `kind` `"input"` (record, the spec leaves room for later
  values); an absolute and a relative `file` pass; `size` negative or 1.5; no
  `duration` passes; `props.end` and `props.fit` outside their enums; `volume`
  -1 and 101 fail, 0 and 100 pass; `speed` 0 or negative; `in` after `out`
  (record); a playlist item that names no media (record); one media item in two
  playlists passes; `audioPlaylists[].loop` that isn't a boolean.
- **D37 `app.json`**: every field in the spec 02 table with a wrong type;
  `layout.<class>.left` and `right` negative or outside their ranges (record
  whether the schema or the shell clamps); `columns` 1 and 9 (record against the
  2 to 8 in spec README question 26); `songsPath` `""` passes (the default
  folder); `previewBig` that isn't a screen ID; `mediaStrip` that isn't a
  boolean; `lastBackupAt` without an offset.

### B. Shell against the design system

Failures here are recorded as "known, M2 backlog" (see [Scope](#scope)).
Sources: `docs/spec/01-concepts.md` "Menu bar", "Toolbar", and "Status bar"; the
`MenuBar`, `Toolbar`, `ToolbarButton`, and `StatusBar` READMEs.

- **B1 Menu bar layout**
  - Steps: S1, S2, and S3: measure and screenshot the menu bar.
  - Expected: 30 high on `bg-app`. "LoveLight" in 12px 700 at the left. 파일,
    편집, 보기, 출력, 창, and 도움말, 24 high with 9px padding, in `label`
    `text-2`. The current service name centered in the window (empty with no
    service), at most 36% wide, with an ellipsis. Window buttons 46×30 with 14px
    icons, the `aria-label`s 최소화, 최대화, and 닫기, the same names as
    tooltips, and no red hover on close.
- **B2 Menu bar behavior**
  - Steps: Click and hover the menu names; press Alt, F10, the arrows, Enter,
    Space, Down, and Esc; double-click an empty spot (recorded).
  - Expected: The row is a drag area except for the menus and the buttons. A
    double-click toggles maximize. `role="menubar"` with `menuitem`,
    `aria-haspopup`, and `aria-expanded`. Menus open below their name, switch on
    hover while one is open, and hold the items in the spec 01 tables (no 저장,
    열기, or 최근, and PowerPoint 파일 unavailable with a tooltip). The keyboard
    follows the `MenuBar` README.
- **B3 Toolbar layout**
  - Steps: In each class, measure the toolbar and its items.
  - Expected: The order: workspace tabs, divider, 미디어, the search field,
    Look, divider, and the three outputs. The search field is md 30 with a ring,
    420 wide (280 in `narrow`), with the placeholder "곡, 가사, 초성", and it
    shrinks first when space runs short. No `role="toolbar"`. The focus order
    follows the `Toolbar` README.
- **B4 Toolbar behavior**
  - Steps: Use the workspace tabs, 미디어, Look, and the three outputs with the
    mouse and the keyboard.
  - Expected: As G23, on the real toolbar. An output button follows the main
    process state: clicking it sends `output.set`, and the button shows what
    `llp.live.get()` returns.
- **B5 Status bar**
  - Steps: Measure the status bar with every output off, then with each on.
  - Expected: 28 high, `caption` `text-3`, the items 본 화면, 무대 화면, and
    방송 자막 in that order at the right. An output that is off shows its name
    only, in `text-off`, with no dot. Dots use only `ok` and `warning`, never
    `live`. It takes no focus, and its output group has `role="status"`.
- **B6 Shell tooltips and writing**
  - Steps: Run G6, G10, and G12 on the shell in each workspace.
  - Expected: As in those cases. In the shell, `live` appears only on output
    toggles that are on.

### S. Stability

Sources for the whole section: `CLAUDE.md` "Code"; `docs/TECH.md` "Quality bar"
and "Verification"; `docs/spec/08-problems.md`.

- **S1 No dialogs**
  - Steps: Count the calls that the launcher records across every run in this
    plan.
  - Expected: Zero calls to `dialog.showErrorBox`, `dialog.showMessageBox`, and
    `dialog.showMessageBoxSync`, and no window other than the main window.
  - Source: `CLAUDE.md`; spec 08; the NOTE in `src/main/index.ts`.
- **S2 Exception in the main process**
  - Steps: Through the inspector, run
    `setTimeout(() => { throw new Error('qa uncaught'); })` in the main process,
    then call `llp.live.get()`.
  - Expected: The log has `uncaught exception` with the stack, no dialog opens,
    and the call returns the state.
  - Source: `docs/TECH.md` "Preventing runtime errors".
- **S3 Rejection in the main process**
  - Steps: Run `Promise.reject(new Error('qa rejection'))` the same way.
  - Expected: The log has `unhandled rejection`, and the app keeps running.
  - Source: `docs/TECH.md` "Preventing runtime errors".
- **S4 Control window crash**
  - Steps: Turn on one output and drag a column. Then crash the renderer
    (`webContents.forcefullyCrashRenderer()` from the main process). Repeat 20
    times, with P-counters before and after.
  - Expected: Each time, the log has `control window process gone` and the
    window reloads by itself, with no dialog. After the reload, the toolbar
    shows the output as on (the state lives in the main process), and the
    columns show their saved widths. Main process memory and its IPC listeners
    don't grow, and each state change is broadcast once.
  - Source: spec 08 "Control window crash"; `docs/TECH.md` "Process structure".
- **S5 Navigation is blocked**
  - Steps: From CDP, set `location.href` to `https://example.com` and to
    `file:///C:/Windows/win.ini`, call `window.open('https://example.com')`, and
    drop a file on the window (CDP `Input.dispatchDragEvent`).
  - Expected: The page stays on the app, no window opens, and no request goes
    out.
  - Source: `src/main/windows/control.ts`; spec 08 ("What must never happen
    during a service").
- **S6 No network**
  - Steps: Record CDP `Network` events during W1 to W15 and C1 to C23.
  - Expected: No request except `file:` URLs.
  - Source: spec 01 "No network during a service"; `docs/TECH.md` principle 5.
- **S7 Content security policy**
  - Steps: Read the policy of `index.html`, and from CDP add an inline
    `<script>` that sets a global.
  - Expected: A policy is present, and the inline script doesn't run.
  - Source: `src/renderer/index.html`; ui brief task 5.
- **S8 What the renderer can reach**
  - Steps: Read `typeof require`, `typeof process`, and the keys of `window.llp`
    in the renderer.
  - Expected: No Node globals. `window.llp` holds `live` (`get`, `send`,
    `subscribe`), `window` (`control`), and the UI state API of shell-2, and
    nothing else.
  - Source: `docs/TECH.md` "Process structure"; `src/main/windows/control.ts`
    (sandbox and context isolation).
- **S9 IPC flood**
  - Steps: Send 10,000 malformed commands and then 10,000 valid `output.set`
    toggles as fast as possible from the renderer. Time a `llp.live.get()` right
    after, and run P-counters.
  - Expected: The round trip after the burst takes under 100 ms, memory returns
    to the baseline after garbage collection, the log stays within its size cap
    (record the cap and whether it rotates), and the last valid command decides
    the state.
  - Source: `CLAUDE.md` ("Cap the size of every cache and list"); `docs/TECH.md`
    "Memory".
- **S10 The log file**
  - Steps: Read `<LLP_USER_DATA>\logs` after a run.
  - Expected: One current log file, UTF-8, one entry per line with a time, a
    level, and an English message. `started` has the app and Electron versions.
  - Source: `docs/TECH.md` "Stack" (logging); `CLAUDE.md` "Language".
- **S11 Clean exit**
  - Steps: P-quit after a run.
  - Expected: Every Electron process of the run exits within 5 seconds with exit
    code 0, and the log's last entries are on disk.
  - Source: `src/main/index.ts`; spec 02 (clean exit).
- **S12 Force-quit and start again**
  - Steps: P-kill while idle, start again, P-kill during a save, start again.
  - Expected: Each start is normal, with the saved layout and no dialog. (The
    output state recovery dialog comes with M2.)
  - Source: `docs/TECH.md` "Verification" (failure tests).
- **S13 Thirty minutes of shell use**
  - Steps: A QA script switches the workspace every second, drags a gap every 10
    seconds, and crosses a size class every 30 seconds, for 30 minutes. It
    samples memory every 10 seconds in the soak record format, and
    `npm run soak -- --judge` judges the record.
  - Expected: The judge passes (no steady growth), and the console has no error.
  - Source: `docs/TECH.md` "Memory"; `CLAUDE.md` ("keep memory and performance
    flat over hours of use").
- **S14 One version everywhere**
  - Steps: Compare the version in the `started` log entry, `package.json`, and
    the `v` tag on the `m1` commit.
  - Expected: All three are the same.
  - Source: devops-2 ("The version lives only in `package.json`").

## Order of work

1. V1 to V7 on the clean clone, so a broken install or check shows up first.
2. V8 to V18 and S14 (GitHub, the hook, and the soak judge).
3. W and C on the build, then S.
4. G on the dev server, then D with the harness.
5. B, if the lead keeps it in M1.

Blocker and major bugs go to the lead at once. The report is written as the
cases run, so a compaction loses nothing.

## Retest

When a fix merges, QA reruns the failed case and the other cases of its area on
`main`, records the commit and the version, and updates the bug's entry in the
report. QA signs off when no blocker or major bug is open.
