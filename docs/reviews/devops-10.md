# Review request: `devops-10`

- Team member: `devops`
- Branch: `fix/devops/soak-nits`
- Base commit (`main`): `20ffc86`
- Last commit: see the commit that adds this file
- Related brief: the two Codex nits from devops-5 round 2

## What changed and why

1.  `scripts/soak/judge.test.ts:146`: the high-window fixtures raised minutes 40
    to 44 and 10 to 14, which don't match a window. Normal samples at the window
    edges then set its minimum, so the "outlier" never reached the judge. The
    tests now take the window bounds from `DEFAULT_JUDGE_OPTIONS`
    (`windowMinutes`, `inWindow`) and raise exactly one whole window. They also
    check that the window's minimum really went up: 250 MB in the flat case, and
    at least the raised value in the rising case. Both cases still end `flat`
    and `growing`.
2.  `scripts/soak/judge.mts:49`: the four-window minimum makes windows shorter
    than a minute for runs below about 4.4 minutes, against the documented
    one-minute minimum. I documented the exception in `judgeOptionsFor` and
    `scripts/README.md`, because four windows are what the later-half fit needs.
    Boundary tests: 327,273 ms gets 5 windows of at least a minute, 327,272 ms
    gets 4, and 2 minutes gets 4 windows of 27.5 s.

## Changed files

- `scripts/soak/judge.test.ts`, `scripts/soak/judge.mts` (TSDoc only)
- `scripts/README.md`
- this document

## Checks run

| Command          | Result                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Pass, 169.8 s: typecheck 8.1 s, lint 38.1 s, format:check 43.4 s, test:coverage 75.5 s (88 files, 904 passed and 1 skipped), build 4.7 s |
