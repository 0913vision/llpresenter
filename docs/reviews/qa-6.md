# Review request: `qa-6`

Review range: `b7c61e3...docs/qa/soak-2`

- Team member: `qa`
- Branch: `docs/qa/soak-2`
- Base commit (`main`): `b7c61e3fd283b6ccba6f542bdad088bf1e436356`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/qa.md`; the lead's 20-minute soak task
- Tested app commit: `4bcba7b688516361646e1ab1734acda683b315aa`

## What changed and why

Record the requested 20-minute soak after output-15 in `docs/qa/m2-notes.md`.
The existing judge fails `main`, `gpu`, and `output:main` for growing private
memory. Their sampled peaks are 88.2, 449.4, and 103.0 MiB. Control and network
memory are flat; output median and minimum frame rates are both 60 fps.

The note includes the exact tested build, workload, judge settings, per-process
trend and sampled private/working-set peaks, raw-record hash, and local record
and log paths. It distinguishes the resolved large main-memory swings from the
remaining growth verdict and states the limits of an offscreen 20-minute run. No
app code, dependency, fixture, or test changed.

## Changed files

- `docs/qa/m2-notes.md`: soak run 2 result and evidence locations.
- `docs/reviews/qa-6.md`: this request.

## Checks run

| Command or test                                            | Result                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `node --check` on runner, clip scripts, and local launcher | Pass before Electron                                                                  |
| `npm run build` on tested commit                           | Pass                                                                                  |
| `npm run soak -- --minutes 20`                             | Fail, exit 1: growing main, GPU, and output memory; no rerun                          |
| Record parser and original judge extraction                | 119 samples, no dropped lines, no relaunches; failure reproduced from the same record |
| Recorded-process cleanup                                   | All five PIDs ended after the app quit normally                                       |
| `npm run verify`                                           | Fail, one hook-test environment mismatch; details below                               |

The final standalone `npm run format:check` passes.

The soak failure is the finding reported by this documentation request. It is
not a failed implementation check for changed app code.

The additional full verification ran once. Typecheck, lint, format, and build
passed. Coverage completed with 204 test files passing and one failing: 2,235
tests passed, one failed, and one was skipped. The failure was
`scripts/hooks/install.test.ts`, "does nothing outside a git checkout".

QA mistakenly redirected `TEMP` and `TMP` into the worktree for verification as
well as for the soak. That placed the test's intended non-Git temporary folder
inside this Git worktree, so `installHooks` correctly returned true instead of
the test's expected false. Running only that file with the normal system
temporary folder then passed all three tests in 649 ms. No source or test
changed, and full verification was not repeated. Its failed result is retained
in `.llp/qa/soak-2/verify.log` and `verify-result.json`.

This request follows QA's documents-only format check in `docs/briefs/qa.md` and
the standing lead rule recorded in qa-3. The additional full verification is
reported above with its actual failure; it is not recorded as passing.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

Documents only. Results come from the existing runner, parser, and judge with
unchanged thresholds. Local analysis adds sampled peaks without changing the
verdict. The run used no inspector, forced GC, or window wrapper. All Electron
launches were offscreen. No middle dots or em dashes.

## Decisions I made (for the lead to confirm)

1. Keep the tested source fixed at the local-main commit that existed when the
   task began. After recording and extracting the result, rebase this
   documentation branch once onto newer main for review. The two commits are
   identified separately above.
2. Redirect process-local temporary folders into the ignored worktree so all
   generated data stays within the authorized workspace. The runner and app
   otherwise use their normal soak command and environment.
3. Report the single failed run unchanged. A further run or investigation waits
   for the lead; this request changes only the requested result notes and its
   review document.

## Shared contract change requests

None.

## Where to look

- The failed per-process trends and sampled peaks in `docs/qa/m2-notes.md`.
- The original judge settings, the evidence hash, and the recorded build.
- The remaining memory findings require owner investigation. This request does
  not ask for M2 acceptance sign-off.

## Review: lead

- Verdict:
- Findings:

## Review: reviewer

- Verdict:
- Findings:

## Team member's reply

None yet.
