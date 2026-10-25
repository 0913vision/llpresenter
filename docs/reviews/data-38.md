# Review request: data-38

- Team member: data
- Branch: `fix/data/screen-apply-and-titles`
- Base: `98080f62097110806d98fb2416e20613347f4c0f` (`main`)
- Review range: `98080f6...fix/data/screen-apply-and-titles`
- Request: `.llp/task.md`, "Next (from the lead, 04:35)".
- Final commit and final HEAD CI URL/result accompany the review request.

## What changed and why

### Saved screen resync

`screen.settings.apply` now takes only
`{type: 'screen.settings.apply', screenId: ScreenId}`. Screen settings are saved
through `settings.edit` first; this live command asks output to resync that
saved screen. The command schema no longer accepts a screen object in place of
the ID. As with other IPC schemas, extra fields are dropped, so a request
containing an ID plus an uncommitted screen cannot forward its draft. Standalone
and batch parsing use the same shape and branded UUID validation.

Output-25's work-in-progress resync path was inspected read-only. Its owner
needs to change the `screenSettings` slice from `{screen}` to `{screenId}` and
pass that ID to the saved-settings resync port, which looks up the saved screen.
This is the handoff for the lead to forward to output; no foreign consumer file
is changed here. There is no merged runtime consumer of this variant in the
request's base. The schema test uses an explicit empty `SliceRegistry`, keeping
its unsupported assertion independent of whichever production slices land.

### Canonical song titles

Main now trims a submitted song title and NFC-normalizes it before duplicate
checking and saving. It applies the same normalization when comparing existing
library titles, including legacy padded or decomposed values. A normalized
duplicate from another ID returns `duplicate-title` without changing revision,
files, or notifications. The same song's ID remains excluded from that check. A
title that becomes blank is refused before any mutation.

The stored song, debounced write, document push, and library row all use the
canonical title. Unknown metadata stays preserved. An equivalent spelling
submitted for the same canonical title does not cause a changed library-row
push. New-song naming also compares normalized existing titles, so legacy
spellings of `새 곡` and `새 곡 2` reserve those names and creation chooses
`새 곡 3`.

This applies the lead's trim/NFC policy in the main process, including callers
that bypass editor validation. It keeps case and interior spacing significant.
Existing files are not bulk-rewritten or migrated; a title is canonicalized when
`song.update` saves that song. Existing revision, read-only, debounce, and
failure handling remain in place. No renderer code changes.

## Changed files

- `src/shared/schema/screenCommands.ts`: replace the unsaved screen payload with
  its saved screen ID.
- `src/shared/schema/screenCommands.test.ts`: standalone/batch normalization,
  branded IDs, legacy/malformed payload rejection, and explicit test registry.
- `src/main/store/contentEdits.ts`: the shared main-side trim/NFC title helper.
- `src/main/store/contentStore.ts`: canonical title matching, update/save/push,
  and default new-song name collision handling.
- `src/main/store/contentStore.test.ts`: file and notification normalization,
  legacy normalized duplicates, own-ID acceptance, blank refusal, and default
  naming collisions.
- `docs/reviews/data-38.md`.

## Checks run

| Check                                                | Result                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| `npm run typecheck`                                  | Passed after rebase                                                 |
| Focused Vitest for screen commands and content store | Two files, 57 tests passed                                          |
| ESLint on changed TypeScript files                   | Passed                                                              |
| `npm run format` and `git diff --check`              | Passed                                                              |
| Rebase onto latest main                              | Completed without conflicts, including data-37's registry isolation |
| Local full verify                                    | Not run, per lead instruction                                       |
| GitHub full verification                             | Final HEAD URL and result accompany the request                     |

No new dependency, cache, subscription, timer, or file format migration. No app,
visible windows, dialogs, soak, or memory measurements were started. New title
fixtures are invented.

## Verdicts (recorded by the lead at merge)

- Round 1 (cf0004c): reviewer (Claude, trial-97) Approve with no findings:
  `screen.settings.apply` is `{type, screenId}` (a resync of the saved screen;
  no slice handles it yet, so nothing on main breaks; tagged `break` for the
  shape change); song titles trim and NFC-normalize for the save, the duplicate
  check, and 새 곡. Lead Approve. Written by the Codex session that took over
  data's work. Rebased by the lead onto local `main` without conflicts.

## Team member's reply

Pending review.
