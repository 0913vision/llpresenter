# Review request: `data-58`

- Team member: data (Codex session, taking over from Claude)
- Branch: `feat/data/media-playlist-edit`, rebased onto `main`
- Base commit: `c7912cfa`; the request message gives the range, the head commit,
  and its CI run.
- Related brief: `docs/briefs/data.md`; request from the lead (M3-P6b part 2b:
  renaming and deleting playlists, 재생목록에서 빼기, and 삭제).

## What changed and why

Spec 05 ("Media view", "Behavior") gives a tile's menu 재생목록에서 빼기 and
삭제, asks before deleting media, and proposes that 새 재생목록 starts in rename
mode. data-57 listed and created playlists; this request edits them and their
media.

1. **Renaming in a row** (`src/renderer/src/ui/ListRow.tsx`). `ListRow` takes
   the same `rename` that `ListGroup` already does: the name becomes a field
   that saves on Enter or leaving it and cancels on Esc. The field is shared
   with group headers.
2. **Playlist rows** (`src/renderer/src/prep/media/MediaListPanels.tsx`). A
   playlist row's menu (right click, Shift F10, or the Menu key) has 이름
   바꾸기, which renames it in its row, and 삭제, which asks first and says how
   many media stay in 모든 미디어. A new playlist opens in its row for its name.
   모든 미디어 and a list a newer version wrote have no menu.
3. **Tiles** (`MediaView.tsx`). A tile's menu adds 재생목록에서 빼기 in a
   playlist, and 삭제, which asks first: the media leaves every playlist, a song
   or item that uses it as its background loses it, and the file stays. A
   missing file's tile keeps 다시 연결 first, and a copying tile still offers
   only 복사 멈추기. A list a newer version wrote offers no changes.
4. **The store** (`mediaLibrary.ts`). Renaming and taking media out send the
   playlist's update at the list's current revision; a blank or unchanged name,
   or media that isn't in the playlist, sends nothing. Deleting sends
   `media.playlist.delete` or `media.delete`. Refusals and rejected calls get
   Korean notices, with main's reason in the log, as before.

## Changed files

- `src/renderer/src/ui/ListRow.tsx` and `.test.tsx`: `rename` on rows.
- `src/renderer/src/prep/media/mediaLibrary.ts`, `MediaListPanels.tsx`,
  `.module.css`, `MediaView.tsx`, and their tests.
- `docs/reviews/data-58.md`: this request.

## Changes outside my paths

- `src/renderer/src/ui/ListRow.tsx` and its test (ui): `rename` on rows, the
  group field reused (additive).
- `src/renderer/src/prep/media/` (prep, no member): given to data for P6b.

## Shared contract changes

None.

## Checks run

| Command or test                                    | Result                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                                | Pass                                       |
| Vitest (`--no-fsModuleCache`) on the changed areas | Pass: 623 tests in 64 files                |
| `npx --no-install eslint` on the changed files     | Pass                                       |
| `npm run format:check`                             | Pass                                       |
| `npm run verify`                                   | GitHub CI on the head commit (see request) |

Tests: a row's name saved on Enter once, kept on Esc, and saved on leaving the
field; renaming at the list revision, a blank and an unchanged name sending
nothing, and a stale refusal's notice; deleting a playlist and a rejected
delete; taking media out of a playlist, nothing for media not in it, deleting
media, and the refusals' notices; a playlist renamed in its row from its menu;
an audio playlist deleted after asking; a new playlist named in its row; no menu
on 모든 미디어; a tile's menu in a playlist (재생목록에서 빼기, 삭제) and the
playlist's update; media deleted from 모든 미디어 after asking; no changes
offered for a list a newer version wrote.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (the preload)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (no new ones)
- [x] Caches and lists have size caps (no new lists)
- [x] An exception in the output path doesn't stop the output (no output change)
- [x] Only what's needed re-renders (control window): `ListRow` stays memoized
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly (about 320 lines of code and 340 of tests)
- [ ] Measured performance values (when relevant): not relevant

## Decisions I made (for the lead to confirm)

1. Deleting media always asks, since the renderer can't tell which songs or
   items use it; the dialog says what happens if one does. Telling the users
   apart needs a usage lookup in main (a contract), which I can add.
2. Deleting a playlist asks too, though its media stay, because its order is
   lost.
3. 삭제 takes the media out of the list only; the copied file stays in the media
   folder.

## Where to look

- `src/renderer/src/prep/media/MediaListPanels.tsx`: the menu, the rename, and
  the delete dialog.
- `src/renderer/src/prep/media/MediaView.tsx`: the tile menu's entries.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex, codex2): Request changes: taking a tile out of a playlist
  filtered the snapshot from when the menu opened and saved it at the latest
  revision, so a newer item could be dropped; nit: an orphaned TSDoc in
  `ListRow.tsx`.
- Round 2 (b04b636e): reviewer (Codex, codex2) Approve. Lead Approve; the
  removal now reads the current playlist, so nothing newer is lost. Round 1 was
  written by the Claude data member and round 2 by its Codex successor. Rebased
  by the lead onto local `main` after tools-6 without conflicts; typecheck
  passes.

## Team member's reply

1. P2: `removeFromPlaylist` resolves the playlist in the newest document before
   checking membership and filtering. A menu opened on `[A, B]` followed by a
   push of `[A, B, C]` now removes A as `[B, C]` at the new revision. Its latest
   name, audio loop setting and other fields are preserved. Tests cover media
   and audio playlists, an item already removed, one added after the menu
   opened, and a deleted playlist. Rename also compares against the current
   name, preserving new items when renaming back to the menu's earlier name.
2. Nit: removed the orphaned TSDoc above `FIELD_COMMAND_CODES` in `ListRow`.
3. data-57 successor nit: both creation buttons now use `IconButton.title` for
   loading, creation in progress and a read-only list. Tests inspect each
   button's tooltip for all three states, prevent duplicate creation, and verify
   that completion restores the enabled button and its normal tooltip.

## Round 2 checks

| Check                                                 | Result                                        |
| ----------------------------------------------------- | --------------------------------------------- |
| `npm run typecheck`                                   | Pass                                          |
| Vitest with `--no-fsModuleCache` on the changed areas | Pass: 71 tests in four files                  |
| ESLint on changed TypeScript files                    | Pass                                          |
| `npm run format` and `npm run format:check`           | Pass                                          |
| `npm run verify`                                      | GitHub CI on the round 2 head; URL in request |

Rebased the original five request commits onto main without conflicts. The round
2 code changes are the findings above. data-59 and data-60 will be restacked in
order; their own changes will be compared with `git range-diff`.
