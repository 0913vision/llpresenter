# Review request: `devops-19`

- Team member: `devops`
- Branch: `fix/devops/ci-electron-software`
- Review range: `51b9e62...fix/devops/ci-electron-software`
- Related brief: `docs/briefs/devops.md` and the lead's request to make the real
  Electron regressions pass on GitHub's Windows runners.
- The lead explicitly requested changes to the two test launch sites below.

## What to check

1. `test/electron-launch.ts` selects the documented CPU ANGLE driver only when
   `GITHUB_ACTIONS` is exactly `true`. Fixture positional arguments stay first;
   the helper appends switches without modifying the original array.
2. Both real Electron tests use the helper when launching their fixture, with
   offscreen windows and isolated user data. Their assertions still run.
3. The matching review-head CI run passes on `windows-latest`. Its URL, SHA, and
   final result accompany the review-request report.

## What changed and why

The first docs-only branch run,
[40188614053](https://github.com/0913vision/llpresenter/actions/runs/40188614053),
failed in two tests that launch Electron. Its logs show GPU process exits with
code 34, a fatal unusable GPU in the UI zoom fixture, and `UnknownVizError` in
the transparent PNG fixture. Typecheck, lint, formatting, and build passed. The
later devops branch run
[40188619757](https://github.com/0913vision/llpresenter/actions/runs/40188619757)
also failed on the transparent PNG GPU error. Read the original job logs and
public failure annotations before changing the tests.

`electronTestArgs` now appends these switches for GitHub test launches:

```text
--use-gl=angle --use-angle=swiftshader
```

Chromium documents this combination as the
[CPU OpenGL ES driver](https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md),
which exercises GPU rendering paths on machines without a GPU. This keeps the
fixtures' shared-texture/composited rendering path active. Electron's
[offscreen rendering documentation](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering)
explains the shared GPU texture and CPU rendering modes.

The switches follow the fixture's existing arguments because putting them before
its entry shifts Electron's `process.argv` and breaks the fixture's
page/user-data parsing. Both tests retain `LLP_TEST_WINDOWS=offscreen` and their
process cleanup. The helper returns the original argument sequence outside
GitHub; it doesn't set environment variables or change app startup.

The regressions remain in the standard unit/coverage suite:

- UI zoom exercises IME composition keys, native zoom shortcuts, persistence,
  and repair of native zoom drift when the stored zoom is already 100.
- Transparent PNG rendering checks transparent, translucent, and opaque pixels
  during crossfades and after the outgoing image is removed, in both output and
  preview viewports.

No dependencies or application startup code changed. Soak peak-memory work
remains a separate devops-20 task.

## Changed files

- `test/electron-launch.ts`
- `test/electron-launch.test.ts`
- `src/main/windows/uiZoom.electron.test.ts`
- `src/renderer/src/render/transparentBackground.node.test.ts`
- This document

## Checks run

| Check                                                                   | Result                                                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Focused run with `GITHUB_ACTIONS=true` and `LLP_TEST_WINDOWS=offscreen` | Passed, 3 files and 7 tests in 3.83 s, including both real Electron fixtures       |
| `npm run typecheck`                                                     | Passed                                                                             |
| ESLint on the four changed TypeScript files                             | Passed                                                                             |
| `npm run format` and `git diff --check`                                 | Passed                                                                             |
| Full verification                                                       | GitHub CI for the matching review head; URL and final result in the review request |

The local focused run forces the same SwiftShader launch path as GitHub. The
helper's unit tests cover GitHub selection, local/default CI isolation, fixture
argument ordering, and preservation of the input array. The hosted run supplies
the actual GPU-less Windows verification. Full local verify was not run under
the new team rule.

## Decisions I made

- Restrict software-driver selection to test-process command lines on GitHub.
- Use the documented ANGLE driver switches so the existing compositing checks
  can run on hosted workers.
- Share argument construction between the two tests and preserve their fixture
  arguments at the front.

## Review: lead

Pending.

## Review: reviewer

Pending.
