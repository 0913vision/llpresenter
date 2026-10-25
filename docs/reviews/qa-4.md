# Review request: `qa-4`

Review range: `b08a8bf...docs/qa/m2-check`

- Team member: `qa`
- Branch: `docs/qa/m2-check`
- Base commit (`main`): `b08a8bf68a964cddf61f9d202e4ca883aa2623b9`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/qa.md`; the lead's m2-check restart task

## What changed and why

Add a portable sample and a Korean 30-minute check sheet for the user's 15:00 to
16:00 app check. The sheet clones the future `m2-check1` tag into a new folder,
installs dependencies, copies sample data outside the clone, sets
`LLP_USER_DATA`, builds, and starts preview. It covers service and slide
selection, item keys, preview swapping, clears and undo, output toggles, and an
optional second monitor.

The sample has five service rows, three invented songs, a 12-second VP8 loop,
and an original PNG. No copyrighted lyrics or downloaded media are included. The
local-main smoke record separates working UI from gaps and reports two findings:
large-preview choice resets after restart (minor, shell), and valid PNG media
cannot render as a background (major for image output, output).

## Changed files

- `docs/qa/m2-check.md`: Korean user instructions, known gaps, and report form.
- `docs/qa/m2-check/README.md`: fixture contents and media provenance.
- `docs/qa/m2-check/sample/`: portable user data, with seven text files and two
  media files.
- `docs/qa/m2-check/smoke.md`: local-main results, limits, and reproductions.
- `docs/reviews/qa-4.md`: this request.

## Checks run

| Command or test                                                 | Result                                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| `npm ci`                                                        | Pass, 275 packages, zero audit vulnerabilities              |
| `npm run build`                                                 | Pass                                                        |
| `npm run preview` with offscreen QA diagnostics                 | Pass, sample opens and graceful close exits 0               |
| Fixture schema and reference validation                         | Pass, seven text files, no dropped fields                   |
| One-monitor and fake-second-monitor smoke                       | Working flow passes; F1 and F2 recorded in the smoke report |
| Targeted clear rendering, PNG decoding, and image-output checks | Clear and undo pass; PNG decodes, image output fails as F2  |
| `npm run format:check`                                          | Pass, full repository check                                 |
| `npm run verify`                                                | Not run, docs-only exception in `.llp/restart.md`           |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

Documents and fixtures only. No app code, test code, shared contract,
configuration, or dependency manifest changed. The fixture was checked through
the app's parsers and runtime. No middle dots or em dashes. All QA windows
remained offscreen; the wrapper's window/dialog call audit was empty.

## Decisions I made (for the lead to confirm)

1. The requested Korean user sheet is the task's explicit exception to the
   English document rule. The fixture README, smoke report, and review are in
   English.
2. Keep the surviving original fixture media. Validate the PNG and WebM rather
   than replacing them after the power loss.
3. Describe black-background lyric output and missing media UI honestly. The
   video is tested through the existing live API; the sheet does not ask the
   user to send development commands.
4. Test the exact local-main commit in this worktree after rebasing, using
   ignored local copies of the sample. The tag remains the lead's action after
   merge. No remote-tag or full milestone sign-off is claimed.
5. Retain F1 and F2 in this scoped report for the lead to route. Do not edit
   another member's code or create shared bug records outside QA ownership.

## Shared contract change requests

None.

## Where to look

- The copy command in the Korean sheet: `LLP_USER_DATA` points to the parent of
  both `app.json` and `LoveLight`, outside the user's clone.
- The fixture's named arrangements and relative media paths.
- F1 and F2 in `docs/qa/m2-check/smoke.md`, and the limits stated in the sheet.
- The lead must merge, publish `m2-check1`, and tell the user it is available
  before the clone command can be used.

## Review: lead

- Verdict:
- Findings:

## Review: reviewer

- Verdict:
- Findings:

## Team member's reply

None yet.
