# Review request: `data-57`

- Team member: data (Claude session)
- Branch: `feat/data/media-playlists`, stacked on data-56
  (`feat/data/media-view`)
- Base commit: the data-56 head; the request message gives the range, the head
  commit, and its CI run.
- Related brief: `docs/briefs/data.md`; request from the lead (M3-P6b part 2,
  the 미디어 and 오디오 playlist panels). Renaming and deleting playlists and
  재생목록에서 빼기 follow in part 2b.

## What changed and why

Spec 05 ("Media view") puts the 미디어 and 오디오 panels in the left column
while the media view is open, and the center shows the chosen list. data-56
showed 모든 미디어 in the center only.

1. **One shared state** (`src/renderer/src/prep/media/MediaViewProvider.tsx`).
   `MediaViewProvider` gives the media view's columns one media store (data-55)
   and the chosen list: 모든 미디어, a media playlist, or an audio playlist.
   `useMediaView` reads both; a chosen playlist that is gone from the list reads
   as 모든 미디어.
2. **The left column** (`MediaListPanels.tsx`). The 미디어 panel has 보관함 with
   모든 미디어 and the 재생목록 group, each with its count; the 오디오 panel has
   the audio playlists. Both lists share one selection. 새 재생목록 and 새
   오디오 재생목록 ask main for a playlist, which main names, and choose it;
   they are unavailable for a list a newer version wrote.
3. **The center follows the choice** (`MediaView.tsx`, `mediaEntries.ts`). The
   tab and the grid take the list's name, and the grid shows its items once
   each, in its order, skipping ids that aren't in the media list. 가져오기
   imports into the chosen playlist, and that playlist shows its imports in
   progress: the store remembers the playlist of each import started here, only
   while the job waits or runs, so the map never outgrows the capped jobs. 모든
   미디어 shows every item and every import, as before.
4. **Wiring** (`src/renderer/src/shell/Workspace.tsx`). With the media view on,
   the left column holds 미디어 and 오디오 (sized to its content), the center
   holds 미디어 보기, and the provider wraps the columns.

Audio playlists show their tracks in the grid for now; spec 05's audio list view
comes with the list view.

## Changed files

- `src/renderer/src/prep/media/MediaViewProvider.tsx`, `MediaListPanels.tsx`,
  `.module.css`, and `.test.tsx` (new).
- `src/renderer/src/prep/media/mediaLibrary.ts`, `mediaEntries.ts`,
  `MediaView.tsx`, `mediaTesting.ts`, and their tests: the chosen list, import
  destinations, and playlist creation.
- `src/renderer/src/shell/Workspace.tsx`: the media view's columns.
- `src/renderer/src/control/PrepMount.test.tsx`: the left column in the media
  view.
- `docs/reviews/data-57.md`: this request.

## Changes outside my paths

- `src/renderer/src/shell/Workspace.tsx` and the 준비 mount test (shell): the
  columns and the provider.
- `src/renderer/src/prep/media/` (prep, no member): given to data for P6b.

## Shared contract changes

None.

## Checks run

| Command or test                                    | Result                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                                | Pass                                       |
| Vitest (`--no-fsModuleCache`) on the changed areas | Pass: 310 tests in 35 files                |
| `npx --no-install eslint` on the changed files     | Pass                                       |
| `npm run format:check`                             | Pass                                       |
| `npm run verify`                                   | GitHub CI on the head commit (see request) |

Tests: 모든 미디어, the playlists, and the audio playlists with their counts,
and an unnamed playlist; choosing a playlist showing its items in the grid,
importing into it, and choosing an audio playlist moving the selection; 새
재생목록 asking main and showing the new playlist once the list has it; no new
playlist for a list a newer version wrote; a playlist's items once each in order
with only its imports; the chosen playlist found with its own ids, or none when
it is gone; each import's playlist remembered until it ends, and none for a file
that failed at once; playlist creation answering its id, also when the save
failed, and a rejected one reported; the 준비 media view's left column.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (the preload)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the provider stops the store on
      unmount)
- [x] Caches and lists have size caps (destinations only for active jobs)
- [x] An exception in the output path doesn't stop the output (no output change)
- [x] Only what's needed re-renders (control window): the provider's value
      changes only with the store or the choice
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly (about 390 lines of code and 360 of tests)
- [ ] Measured performance values (when relevant): not relevant

## Decisions I made (for the lead to confirm)

1. A new playlist is chosen at once rather than opened in rename mode; rename
   (spec 05's proposal) comes in part 2b with 이름 바꾸기 and 삭제.
2. Icons: 모든 미디어 `grid`, a media playlist `film`, an audio playlist
   `audio`. The 효과음 playlist gets no icon of its own while its behavior is an
   open question.
3. The 오디오 panel sizes to its content, and the 미디어 panel takes the rest.

## Where to look

- `src/renderer/src/prep/media/mediaEntries.ts`: the chosen list's entries.
- `src/renderer/src/shell/Workspace.tsx`: the provider around the columns.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

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
