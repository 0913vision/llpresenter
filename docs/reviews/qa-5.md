# Review request: `qa-5`

Review range: `c4339ff...docs/qa/m2-check-2`

- Team member: `qa`
- Branch: `docs/qa/m2-check-2`
- Base commit (`main`): `c4339ff6c94e7b980a3ef68dd0e1d49d094291d1`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/qa.md`; the lead's follow-up after qa-4 merged

## What changed and why

Remove the M2-5 memory warning from the Korean user check sheet. The lead
confirmed that output-15 is merged and M2-5 came from offscreen test-window
bitmap frames; normal windows never had the issue. The output-15 review records
the isolated measurements and the shared-texture fix.

## Changed files

- `docs/qa/m2-check.md`: remove the obsolete M2-5 known-gap bullet.
- `docs/reviews/qa-5.md`: this request.

## Checks run

| Command or test        | Result                                              |
| ---------------------- | --------------------------------------------------- |
| `npm run format:check` | Pass, full repository check                         |
| Diff inspection        | Only the M2-5 bullet is removed from the user sheet |
| `npm run verify`       | Not run, documents-only check requested by the lead |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

Documents only. No app behavior or fixture changed, and no runtime retest was
needed for this correction. The branch starts at local main after output-15. No
middle dots or em dashes.

## Decisions I made (for the lead to confirm)

None. This applies the lead's requested deletion.

## Shared contract change requests

None.

## Where to look

The known gaps in `docs/qa/m2-check.md`, against the explanation and
measurements in `docs/reviews/output-15.md`.

## Review: lead

- Verdict:
- Findings:

## Review: reviewer

- Verdict:
- Findings:

## Team member's reply

None yet.
