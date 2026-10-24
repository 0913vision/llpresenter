# Review request: `devops-5`

- Team member: `devops`
- Branch: `fix/devops/soak-slope`
- Base commit (`main`): `fc0cbc9`
- Last commit: see the commit that adds this file
- Related brief: bug M1-3 from qa (minor), as the lead relayed it

## What changed and why

The soak judge passed steady growth below about 13 MB per hour. It compared the
lowest values of the first and last windows (minutes 5 and about 51, for example
244.9 MB and 254.1 MB, 9.2 MB apart) against a fixed 10 MB minimum. That allows
about 40 MB over a 3-hour service day, while `docs/TECH.md` asks for no memory
growth.

`scripts/soak/judge.mts` now judges the trend over the whole required time:

- It takes each window's lowest sample, with the time it was taken.
- It fits a least-squares line through those points (`slopeKbPerHour`).
- A process keeps growing when that line rises at least `maxGrowthKbPerHour` (4
  MB per hour, in place of `minGrowthKb`), both over all the windows and over
  the later half of them. The later-half condition keeps passing a cache that
  fills during the first minutes and then levels off, which the existing startup
  test expects. A leak that starts halfway still fails.
- The verdict carries the rate (`growthKbPerHour`), and the report prints it,
  for example `growing   gpu: +12.0 MB/h (244.1 MB, 256.1 MB)`.

## Tests

New cases in `scripts/soak/judge.test.ts`:

- a steady rise of 12 MB over the hour (starting at 244.9 MB, with the GC
  sawtooth) fails, with a rate of about 12 MB per hour,
- flat memory with noise on top of the sawtooth passes, with a rate below the
  limit,
- a 12 MB per hour leak that starts at minute 30 fails.

The 12 MB cases fail against `main`'s judge (checked by swapping the old file
in). The existing cases still pass, including the 60 MB per hour rise, the 0.6
MB per hour drift, and growth that levels off after minute 20.
`scripts/soak/report.test.ts` covers the new rate in the report lines.

## Changed files

- `scripts/soak/judge.mts`, `scripts/soak/judge.test.ts`
- `scripts/soak/report.mts`, `scripts/soak/report.test.ts`
- `scripts/README.md` (the judging rule)
- this document

## Checks run

| Command          | Result                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Pass, 77.7 s: typecheck 3.3 s, lint 22.6 s, format:check 6.8 s, test:coverage 43.3 s (41 files, 366 tests), build 1.7 s |

## Decisions I made (for the lead to confirm)

1.  The limit is 4 MB per hour, which is 12 MB over a 3-hour service day. It
    sits in `DEFAULT_JUDGE_OPTIONS` and can change once real records from phase
    2 show how much the lowest values wander in a flat run.
2.  Short trial runs (`--minutes 5`) extrapolate a few minutes to a rate per
    hour, so small noise can fail them. They are smoke checks; the verdict that
    counts is the 60-minute run.
