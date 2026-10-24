# Review request: `devops-7`

- Team member: `devops`
- Branch: `feat/devops/soak-recorder`
- Base commit (`main`): `cca7ea0`
- Last commit: see the commit that adds this file
- Related brief: the M2 task "App-side soak recording" in `docs/MILESTONES.md`,
  and the devops-2 nit

## Shared changes

- None. `src/main/soak/` is mine (the lead's answer). Wiring it into
  `src/main/index.ts` is output's; I sent output this line:

  ```ts
  import {registerSoakRecorder} from './soak';
  // in the whenReady handler, after createControlWindow(log):
  const stopSoakRecorder = registerSoakRecorder(log);
  // and stopSoakRecorder() next to disposeIpc() when the window closes
  ```

## What changed and why

### Soak recorder (`src/main/soak/`)

- `registerSoakRecorder(log, env)` (`index.ts`) does nothing unless
  `LLP_SOAK_RECORD` names a record file. Then it samples `app.getAppMetrics()`
  every 10 seconds, appends one JSON Lines record line per sample, and calls
  `app.quit()` after `LLP_SOAK_EXIT_MS`. It returns a function that stops both
  timers.
- `recorder.ts` holds everything that doesn't need Electron, so it is tested
  without it:
  - `soakSettings` reads the two variables (an exit time that isn't a positive
    number means "keep running"),
  - `pageProcessName` names a renderer by its page: `index.html` is `control`,
    and `output.html?screen=<id>` is `output:<id>` (output confirmed these URLs,
    and that a crashed output reloads the same URL, so its name stays),
  - `processSamples` maps metrics to the record's processes: `main`, `gpu`,
    `utility:<service>`, and the named renderers. Other renderers (DevTools, the
    gallery) and other process types are left out, because a short-lived one
    would make the judge fail on "too few samples". Private memory falls back to
    the working set where Electron gives none,
  - `sampleLine` writes format version 1,
  - `startSoakRecording` runs the timers. Writes are chained so lines keep their
    order, and a failed write is logged without stopping the recording, so the
    output never stops because of it.
- `outputs` is empty for now, with a TODO. Output windows will report their
  frame rates in output's M2 work, and the test scenario (looping video and 장
  changes) comes with it.

### Hooks nit from devops-2 (`scripts/hooks/install.mts`)

`installHooks` now requires `git rev-parse --is-inside-work-tree` to print
exactly `true`, because a bare repository exits 0 and prints `false`. A new
`tryGit` in `scripts/git.mts` returns git's output, or `null` on an error. The
new bare-repository test fails with the old check.

## Tests

- `src/main/soak/recorder.test.ts` (22 tests):
  - the settings,
  - page names, including file URLs from the build and pages that aren't
    tracked,
  - process naming and the fallback to the working set,
  - a record line that `scripts/soak/record.mts` parses back unchanged, so the
    recorder and the runner can't drift apart,
  - and, under the fake clock: one line per interval in order, quitting at the
    exit time, a failed write logged while later lines still arrive, and
    stopping that clears both timers.
- `scripts/hooks/install.test.ts`: the bare repository case.
- Not run end to end: the wiring is output's. Starting the app would also put a
  window on the user's screen until output's `LLP_TEST_WINDOWS` switch lands.
  The runner side was tested in devops-1, and the round-trip test covers the
  format between the two.

## Changed files

- `src/main/soak/index.ts`, `src/main/soak/recorder.ts`,
  `src/main/soak/recorder.test.ts`
- `scripts/git.mts`, `scripts/hooks/install.mts`,
  `scripts/hooks/install.test.ts`
- `scripts/README.md` (the app side of the soak test)
- this document

## Checks run

| Command          | Result                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Pass, 129.7 s: typecheck 4.8 s, lint 28.0 s, format:check 24.0 s, test:coverage 67.2 s (51 files, 476 tests), build 5.7 s |

## Next (for the lead)

- Playwright: `playwright-core` 1.64.1 (October 14) has Electron support, no
  dependencies, and no install script. In a scratch project, with
  `PLAYWRIGHT_BROWSERS_PATH` pointing at an empty folder,
  `npm install -D -E playwright-core@1.64.1` added 1 package (14 MB). The
  browser folder stayed empty, and `%LOCALAPPDATA%\ms-playwright` still doesn't
  exist. I'll add it and the first UI tests after output's test window switch
  merges, driving them from Vitest.
