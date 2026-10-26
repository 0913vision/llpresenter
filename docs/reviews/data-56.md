# Review request: `data-56`

- Team member: data (Claude session)
- Branch: `feat/data/media-view`, stacked on data-55
  (`feat/data/media-view-store`)
- Base commit: the data-55 head; the request message gives the range, the head
  commit, and its CI run.
- Related brief: `docs/briefs/data.md`; request from the lead (M3-P6b, the media
  view, grid and import first). Second half of P6b part 1; data-55 is the store.

## What changed and why

In 준비, the toolbar's 미디어 button was unavailable. With this request it opens
the media view in the center column (spec 05, "Layout": "With 미디어 (Media) on,
the media view"), so media can be imported and checked in the m3-check1 build.

1. **The view** (`src/renderer/src/prep/media/MediaView.tsx`). A 모든 미디어
   panel with the count and 가져오기, a `MediaGrid` of `MediaTile`s, and a
   footer with the count and total size and the tile size slider:
   - tiles show the thumbnail from `llp-media://thumbnail/<id>` (data-54) for
     video and images, the duration for video and audio, the loop icon for a
     looping video, and the live ring for the current background;
   - a file being imported is a copying tile with its percent, and a missing
     file is a missing tile with its path in the tooltip (MediaTile README);
   - a click selects a tile, and on a missing file opens 다시 연결; a double
     click outputs video or an image as the background (spec 03), never a
     copying, missing, or audio tile;
   - the menu offers 복사 멈추기 on a copying tile and 다시 연결 on a missing
     one, and doesn't open on other tiles yet;
   - the slider sets 2 to 8 columns (MediaTile README, "Grid").
2. **Wiring** (`src/renderer/src/control/App.tsx`,
   `src/renderer/src/shell/Workspace.tsx`). 준비 keeps its own 미디어 choice,
   apart from the 진행 media strip's. While it is on, the media view replaces
   the center column; the left and right columns stay.

Not yet, in the next P6b parts: the 미디어 and 오디오 playlist panels with 새
재생목록, the properties panel and its preview player, the list view, 삭제 and
재생목록에서 빼기, and dropping files from Explorer, which needs the files'
paths from the preload (an additive contract).

## Changed files

- `src/renderer/src/prep/media/MediaView.tsx`, `.module.css`, and `.test.tsx`
  (new).
- `src/renderer/src/control/App.tsx`, `src/renderer/src/shell/Workspace.tsx`:
  the toggle and the column.
- `src/renderer/src/control/PrepMount.test.tsx`: the toggle in 준비.
- `src/renderer/src/control/MediaStripMount.test.tsx`: 미디어 is now available
  in 준비.
- `docs/reviews/data-56.md`: this request.

## Changes outside my paths

- `src/renderer/src/control/App.tsx`, `src/renderer/src/shell/Workspace.tsx`,
  and their mount tests (shell): the toggle and the column.
- `src/renderer/src/prep/media/` (prep, no member): given to data for P6b.

## Shared contract changes

None.

## Checks run

| Command or test                                    | Result                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                                | Pass                                       |
| Vitest (`--no-fsModuleCache`) on the changed areas | Pass: 522 tests in 57 files                |
| `npx --no-install eslint` on the changed files     | Pass                                       |
| `npm run format:check`                             | Pass                                       |
| `npm run verify`                                   | GitHub CI on the head commit (see request) |

Tests: every item's tile with its thumbnail and duration (none for an image, no
picture for audio) and the footer total; 가져오기 through the dialog and a
copying tile with its progress; a click selecting, a double click outputting a
video, and none for audio; a missing file relinked from a click, once for two
quick clicks, and from its menu, never output; 복사 멈추기 from a queued tile's
menu, and no menu on a plain tile; 미디어 in 준비 opening and closing the view
with the 라이브러리 still there; the 진행 strip's choice kept apart.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (the preload,
      data-55)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the store stops on unmount)
- [x] Caches and lists have size caps (the media list's own cap)
- [x] An exception in the output path doesn't stop the output (a failed output
      command is a notice)
- [x] Only what's needed re-renders (control window): `MediaTile` is memoized
      and the entries change only with the list or the jobs
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly (about 310 lines of code and 170 of tests)
- [ ] Measured performance values (when relevant): not measured

## Decisions I made (for the lead to confirm)

1. Moving the slider right makes tiles bigger (fewer columns), as a size slider
   reads; it reads out the column count, such as 5열.
2. 준비's 미디어 choice isn't saved yet; it starts off at launch.
3. Audio items show in 모든 미디어 as tiles without a picture until the audio
   list view (spec 05) arrives.

## Where to look

- `src/renderer/src/prep/media/MediaView.tsx`: activation, output, and the menu
  entries.

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
