# Review request: data-36

- Team member: data
- Branch: `feat/data/screen-identity`
- Base: `867330a998a77e2237cbc26fb90c64a5b45a341d` (`main`)
- Review range: `867330a...feat/data/screen-identity`
- Request: `.llp/task.md`, "After data-34 (from the lead, 03:45)" and the "Also
  in data-36 (from the lead, 04:00)" addition.
- Proposals inspected read-only: output's `screen-identity-proposal.ts` and
  `capture-defaults.patch` in its `.llp/output-25/` folder.
- Final commit and final HEAD CI URL/result accompany the review request.

## What changed and why

`@shared/screens` now exports `STARTER_SCREEN_IDS` and
`resolveOutputScreen(id, screens)`. The constants name the same UUIDs already
used by D2 defaults, with one definition shared by the screen defaults and their
Look references:

| Default role | Stable UUID                            |
| ------------ | -------------------------------------- |
| `main`       | `00000000-0000-4000-8000-000000000001` |
| `broadcast`  | `00000000-0000-4000-8000-000000000002` |
| `stage`      | `00000000-0000-4000-8000-000000000003` |

The resolver returns the exact configured ID first. For an M2 alias (`main`,
`broadcast`, `stage`, or the legacy `captions` alias for `broadcast`), it then
looks for that role's starter UUID. It returns the original configured object,
or `undefined` when it cannot find the target. Names, list order, screen kind,
and output method do not determine identity, so renaming or changing a capture
screen to a window keeps the same target. A deleted starter is not silently
replaced by a different screen. Custom saved UUIDs work by exact ID; an alias
never guesses which custom UUID has a matching name or method.

New default files now derive `alwaysOnTop` from the configured method:
fullscreen is on; window and capture are off. The default capture screen is off,
while the two fullscreen defaults remain on. This only changes creation of new
defaults. Loading an existing `screens.json` retains its IDs and names, explicit
`alwaysOnTop` values (including capture/window on and fullscreen off), and
absent optional fields. There is no migration or saved-file rewrite.

Output O9a can import the shared helper for both main and renderer consumers.
The proposal's consumer wiring remains in output's branch.

## Changed files

- `src/shared/screens.ts`: documented starter IDs and the pure shared resolver.
- `src/shared/screens.test.ts`: starter aliases, custom exact UUIDs, renaming,
  reordering, all four output methods, and missing/unknown targets.
- `src/main/store/settingsDefaults.ts`: reuse the fixed screen IDs and derive
  new defaults' always-on-top value from the method.
- `src/main/store/settingsDefaults.test.ts`: actual first-install file creation
  and reload, default Look references, and saved custom-ID/explicit-value
  preservation without rewriting the file.
- `docs/reviews/data-36.md`.

## Checks run

| Check                                                   | Result                                          |
| ------------------------------------------------------- | ----------------------------------------------- |
| `npm run typecheck`                                     | Passed                                          |
| Focused Vitest, including existing screens schema tests | Three files, 23 tests passed                    |
| ESLint on changed TypeScript files                      | Passed                                          |
| `npm run format` and `git diff --check`                 | Passed                                          |
| Rebase onto latest main                                 | Result accompanies request                      |
| Local full verify                                       | Not run, per lead instruction                   |
| GitHub full verification                                | Final HEAD URL and result accompany the request |

No new dependency, cache, timer, subscription, or IPC channel. No visible
windows, dialogs, soak, or memory measurements were started. Filesystem tests
use isolated temporary data.

## Verdicts (recorded by the lead at merge)

- Round 1 (c128e19): reviewer (Claude, trial-97) Approve with no findings: the
  starter screen UUIDs keep the old values, so existing installs and their
  cross-file references still resolve; an exact id wins over the M2 aliases; new
  defaults set 항상 위 by method. Lead Approve. Written by the Codex session
  that took over data's work. Rebased by the lead onto local `main` without
  conflicts.

## Team member's reply

Pending review.
