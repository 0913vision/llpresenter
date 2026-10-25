Review range: `da0d299...feat/spec/library-panel`

# Review request: `spec-23`

- Team member: `spec`
- Branch: `feat/spec/library-panel`, from `main` (not stacked)
- Base commit (`main`): `da0d299`
- Code commit: `fab3b70`
- Review round: 2
- Task: `.llp/task.md`, M3-P1 library and search
- Ownership exception: new `src/renderer/src/prep/library/`, the requested
  gallery registration, and the lead's two spec-22 nits

## What changed and why

The independent 라이브러리 panel now reads the main-owned song list, searches
the merged index, opens songs for editing, creates songs, confirms deletion, and
provides the shared song drag payload. An interactive `Library` gallery entry
shows it with a real editor-title focus target.

This request follows spec 05 and the design system's Panel, ListRow, TextField,
Menu, and AlertDialog components. The 준비 draft's library section was checked
against those components; design-system sizes and type tokens take precedence.

## List, search, and lifetime

- The header shows the full song count and 새 곡. Rows show the song icon,
  title, and slide count, ordered with Korean numeric collation.
- Empty searches show the entire library, including libraries beyond the search
  response cap. Only visible rows and overscan are mounted. Row geometry comes
  from `--size-row`; scrolling and Home, End, Up, and Down can reach songs
  outside the current render window.
- Nonempty queries call `library.search` with the shared maximum limit. The main
  index supplies initial-consonant and lyric matching and title-first ordering.
  The renderer preserves that order and the original query. Esc clears a
  nonempty field, then leaves an empty field through TextField's existing
  behavior.
- Query changes and clearing invalidate old responses. A pushed list wins over
  an older initial read. Lyric-only document pushes rerun the current query;
  those edits do not necessarily change the list metadata.
- Song-list and song-document subscriptions and the resize observer are released
  on unmount. Late reads cannot open a removed song. Failed calls pass complete
  notices to the host; preload retains its existing logging. Only a failed
  library load includes a 다시 불러오기 action.

## Creation, opening, deletion, and dragging

Creation uses D1a's `song.create`, so main owns unique titles and the blank
slide. The new document is read back, selected, and passed to `onOpenSong` with
`focusTitle: true`. The gallery host opens its title field and focuses it. Tests
create 새 곡 and 새 곡 2 in sequence and check the focused field and slide
count. Normal row selection passes the read document with `focusTitle: false`.

The row menu's 삭제 opens AlertDialog with the song title and the current
`usedBy` service count when it is positive. Zero has no usage meta line. Cancel
makes no edit. Confirm uses `song.delete`; a read-only song cannot be deleted.
List pushes update the count while the question is open. Pending edits reject
duplicate presses. A write failure that was already applied is handled according
to the merged edit-result contract.

Native dragging uses `SONG_DRAG_MIME` and `serializeSongDragPayload`, with a
copy effect. This is the merged data-owned payload for the later service drop
target; there is no new wire format or preload change.

## Integration boundary

**The panel is not mounted in the 준비 workspace frame. Shell owns that mount
and it comes later.** The host supplies the existing API and consumes
`onOpenSong({document, focusTitle})` to open the song editor and, after
creation, focus its title. It also supplies `onProblem(notice)` and owns the one
shared notification list for all its panels: `addNotice` caps it at three and
replaces by cause key, and `removeNotice` closes a card. The host mounts one
NotificationStack and uses `onWarningHeightChange` to keep its right column
clear of warnings. The panel mounts no notification stack of its own.

The gallery host demonstrates both handoffs, including dismissing a load warning
before running its supplied retry action, and applying the warning height to the
editor column. The title field is not the P2 song editor. No output command is
sent from this panel.

## Round 2 response

1. Removed the panel-owned NotificationStack and problem-list state. Added the
   required `onProblem` callback. Notices include a stable cause key and any
   applicable action. The gallery host owns its single bounded list and stack,
   replaces by key, handles closing, and receives warning-height changes. Tests
   cover emission without a panel stack and host composition, including
   replacement and the three-card limit.
2. Omitted the deletion dialog's usage metadata when the current count is zero.
   The existing live-count test now checks that the zero line disappears.
3. Included 다시 불러오기 only for failed loads. Create and delete failures have
   no action; tests check both. The callback retains the load retry action.
4. Kept the unselected row index at -1, so the first ArrowDown selects and
   focuses the first row. Added a regression for that case.

## Included nits

- Corrected spec-22's race explanation: the asynchronous
  `preferences.get().then(setVisible)` in `UndoControls` caused the test timing
  issue. The runtime ClearRow implementation is unchanged.
- Moved the Bible parse test's Node imports to its import group. The test's
  behavior and saved diagnostics are unchanged.

## Checks run

| Check                                     | Result                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| Library acceptance and lifecycle tests    | Pass: 16 tests                                                               |
| Existing gallery tests with the new entry | Pass: 8 tests                                                                |
| Renderer TypeScript check                 | Pass in round 2                                                              |
| Node TypeScript check                     | Pass in round 1; no Node changes in round 2                                  |
| Changed-file ESLint and Prettier          | Pass                                                                         |
| `git diff --check`                        | Pass                                                                         |
| Dedicated gallery production bundle       | Pass: `gallery.html` entry                                                   |
| Local full verify                         | Not run, per the lead's rule                                                 |
| GitHub branch CI                          | Exact submitted HEAD's run URL and result are recorded in the request report |

Tests cover the required initial-consonant query, both Esc actions, Korean
numeric ordering, new-title focus, deletion confirmation and cancel, live use
counts, read-only deletion, shared drag data, stale searches and reads,
lyric-only changes, subscription cleanup, failed reads and retry, duplicate
creation presses, and End navigation across 3,000 virtualized songs.

Local round 2 evidence: `.llp/spec23-round2-tests.log`. The gallery bundle is in
`.llp/spec23-round2-gallery/`. Fixtures contain only invented text and the
required public-domain hymn title. No Electron process, visible window, soak, or
memory measurement was started.

## Changed files

- New `src/renderer/src/prep/library/`: the panel, data hook, virtualized list,
  gallery specimen, fixtures, styles, and tests.
- `src/renderer/src/ui/gallery/Gallery.tsx`: the specimen's import and entry.
- `src/main/bible/parsePerformance.test.ts`: import order only.
- `docs/reviews/spec-22.md`: the authorized cause correction.
- `docs/reviews/spec-23.md`.

The branch was rebased onto main at `da0d299`. A fully green CI run of the
submitted HEAD is required. The request report records its URL and result
without adding another unverified commit for CI metadata.

## Verdicts (recorded by the lead at merge)

- Round 1 (Claude, trial-97): Request changes: the panel mounted its own
  `NotificationStack`; nits: no meta for an unused song, 다시 불러오기 only for
  a failed load, ArrowDown from no selection.
- Round 2 (e03dd2e): reviewer (Claude, trial-97) Approve. Nit for the next
  branch that touches the panel: `useLibrary.ts` `problemTitles.missing` reads
  "곡을 찾을 수 없습니다"; use the noun phrase "곡을 찾을 수 없음" (Notification
  README, spec 08). Lead Approve. Written by the Codex session that took over
  spec's work, under the lead's exception for `src/renderer/src/prep/library/`.
  Rebased by the lead onto local `main` without conflicts. Mounting in the 준비
  frame is shell's. M3-P1 is complete apart from that mount.
