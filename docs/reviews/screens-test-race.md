# Review request: `screens-test-race`

- Team member: `screens`
- Branch: `fix/screens/workspace-test-race`
- Base commit (`main`): `1986804e`
- Related brief: `docs/briefs/screens.md`; lead's priority CI repair.
- Last commit, range, and CI result: see the request line.

## What changed and why

The data-60 CI run on `0bd44f2f` failed the initial screen-selection assertion:
the row existed but still had `aria-selected="false"`. Waiting for the row's
existence does not wait for its selection. `ListBox` publishes the selected
value in a layout effect and `ListRow` follows that separate store. An async
query can observe the row before that subsequent update settles.

The fix is already in current local main: `d5b41dec` from ui-42 waits for
`selected: true` in the initial role query. The failing data-60 commit predates
that fix. This request preserves it, also waits for the clicked row's selected
state, and adds coverage for settings arriving after the other lists. That
regression verifies the initial fallback without requiring a persisted pick.
There is no change to production selection behavior or global timeouts.

Failure evidence: GitHub's annotation for
[run 40295908564](https://github.com/0913vision/llpresenter/actions/runs/40295908564)
reports expected `true`, received `false` at line 170. Reading that commit
confirms its query waited for existence only.

## Changed files

- `src/renderer/src/screens/ScreensWorkspace.test.tsx`: wait for the clicked
  selection and cover a deferred initial settings read.
- `docs/reviews/screens-test-race.md`: this request.
- Changes outside my paths: none.

## Checks run

| Check                                       | Result                      |
| ------------------------------------------- | --------------------------- |
| Baseline file on current main               | Pass: 15 tests              |
| Repeated updated file                       | Pass: 5 runs, 16 tests each |
| ESLint on changed test                      | Pass                        |
| `npm run typecheck`                         | Pass                        |
| `npm run format` and `npm run format:check` | Pass                        |
| GitHub `npm run verify`                     | See request line            |

## Quality checklist

- [x] The regression covers delayed settings and the initial fallback.
- [x] No production code, shared contracts, dependencies, or global timeout
      changes.
- [x] No new listeners, timers, output commands, or caches.
- [x] Comments and commit messages follow `CLAUDE.md`.
- [ ] GitHub verify passes on the request head; see request line.

## Decisions and open points

The first wait was already repaired by ui-42. Keeping that fix and proving it
against this file avoids duplicating it in production code or widening the
shared `ListRow` change. The asynchronous assertion describes the condition the
test actually needs.

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
