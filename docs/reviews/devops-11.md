# Review request: `devops-11`

- Team member: `devops`
- Branch: `chore/devops/ci-windows-latest`
- Review range: `d9ecca5...chore/devops/ci-windows-latest`
- Related brief: the lead's CI task (CI runs the same verify as the pre-push
  hook, on `windows-latest`) and the devops-7 round 2 nit

## What to check

1.  `.github/workflows/ci.yml`: the verify job runs on `windows-latest`, and
    nothing else in the workflow depends on the old `windows-2025` label. The
    Electron cache key uses `runner.os`, which stays `Windows`.
2.  `scripts/README.md`: the `LLP_SOAK_EXIT_MS` row matches `readSoakSettings`
    (`src/main/soak/recorder.ts:64`), and the CI section matches the workflow.

## What changed and why

1.  **CI runner.** The verify job runs on `windows-latest` instead of
    `windows-2025`, as the lead decided. `windows-latest` has pointed to Windows
    Server 2025 since September 2025
    ([GitHub changelog](https://github.blog/changelog/2025-07-31-github-actions-new-apis-and-windows-latest-migration-notice/)),
    so the image is the same today, and CI now follows each new default image.
    CI already runs `npm run verify`, the command that the pre-push hook runs,
    so it runs the steps at once as soon as devops-8 merges. Nothing else
    changes.
2.  **The devops-7 nit.** The `LLP_SOAK_EXIT_MS` row in `scripts/README.md` says
    that an empty or unset value keeps the app running.

## CI timing

From the public GitHub API (`actions/runs` and their `jobs`), read only:

- The last run, 814781b on 2026-10-24 (`windows-2025`, sequential verify, forks
  pool), took 174 s in all. The verify job took 154 s: checkout 14 s, setup-node
  10 s, Electron cache 3 s, `npm ci` 26 s, `npm run verify` 88 s, coverage
  upload 2 s, and 9 s of cleanup. The `bump` job took 14 s.
- The 19 runs that passed from 3875cd7 to 814781b took 84 to 174 s, growing with
  the test suite.

Pushes now happen only at a milestone freeze or a finished feature bundle, so
the first numbers with `windows-latest` and the parallel verify come from the
next one.

## Tests

A runner label has no unit test; the next CI run on GitHub checks it. Prettier
parses and formats the workflow file.

## Changed files

- `.github/workflows/ci.yml`
- `scripts/README.md`
- this document

## Checks run

Run on `f72d3eb`, before the rebase onto `d9ecca5`, which brought only merged
work from other members.

| Command          | Result                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Pass at 100% CPU, 144.7 s: typecheck 3.7 s, lint 37.0 s, format:check 17.9 s, test:coverage 82.9 s (102 files, 1076 passed and 1 skipped, no timeouts), build 3.2 s |
