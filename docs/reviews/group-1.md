# Review request: `group-1` (round 2)

- Team member: `group`
- Branch: `docs/group/plan`
- Base commit (`main`): `dacaf400eb6b8840504504ec94b426dfd0205380`
- Related brief: `.llp/restart.md` / `docs/briefs/data.md`
- CI pending.

## What changed and why

Creates and revises `docs/plans/grouped-songs.md` for activating
ProPresenter-style grouped songs end-to-end across the store, IPC, song editor,
예배 순서 구성 chips, and projection to the 진행 tiles, following the user's
October 27 decision ("Follow ProPresenter where qa-12 found a difference").

Round 2 incorporates all 10 findings from the round 1 review:

1. Reordered the rollout to strictly comply with the Spec 02 rollout rule:
   active v1 store and IPC entry points remain active while consumers (editor,
   chips, projection, text import) are upgraded to accept groups; store, IPC,
   and shared contracts flip together in one final atomic request (`group-7`)
   with the required double review.
2. Formally designated the contract-flipping request as `break(data)` on branch
   `break/group/activate-contracts`.
3. Expanded the code audit to include all missing consumers across
   `songEditorStore`, `SongEditor`, `SongHeader`, `SongPreview`,
   `VirtualSlides`, `useSongBlockWindow`, `editorFixture`, `ArrangementDialog`,
   `textImport.ts`, `recovery.ts`, and `contentStore` (:496, :571); explicitly
   identified new test files `SongBlock.test.tsx`, `SongSlidePanel.test.tsx`,
   and `ItemArrangement.test.tsx`.
4. Defined tile expansion cap `SHOW_SERVICE_LIMITS.tiles = 10_000`, stopping
   iteration immediately to prevent unbounded allocation and setting typed
   problem `unknown-kind` on the row rather than truncating silently; planned
   tests at the limit for service tiles, library tiles, and recovery slide
   count.
5. Specified hotkey behavior: outputs the tile immediately through the main
   command path (`outputTile`); established precedence of slide hot keys over
   label jump keys; confirmed spec 10 shortcut conflict scoping; decided on
   drawing a keycap badge on `SlideThumbnail`.
6. Added mandatory "Checked in the app" offscreen CDP verification with
   screenshots and flat element counts to every operator-visible request
   (`group-2`, `group-3`, `group-4`, `group-5`, `group-7`).
7. Aligned unnamed group display strictly with Spec 05 (`이름표 없음` and source
   position in chip strip; `이름표` placeholder at group start in editor);
   removed contradictory open question 3.
8. Used exact Spec 02 wording: "maximal increasing consecutive stretches".
9. Cited port 5194 and app data `D:\llp-dev\group` assignment from
   `.llp/restart.md` and requested addition to the `docs/WORKFLOW.md` table.
10. Settled text import draft handling on Option (a) (draft wire contract stays
    stable, `importSong` converts to grouped song via migration).

## Changed files

- `docs/plans/grouped-songs.md`: End-to-end activation plan for grouped songs.
- `docs/reviews/group-1.md`: This review request.

## Checks run

| Command or test        | Result |
| ---------------------- | ------ |
| `npm run typecheck`    | Passed |
| `npm run format:check` | Passed |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run typecheck` passes
- [x] `npm run format:check` passes
- [x] The change is small, focused, and thoroughly documented
- [x] Every merged intermediate request keeps `main` green and functional
- [x] Open questions are explicitly surfaced for the lead rather than guessed

## Decisions I made (for the lead to confirm)

- Staged consumer readiness (`group-2` through `group-6`) ahead of store/IPC
  contract flipping (`group-7`), ensuring `main` remains green at all times.
- Defined tile expansion cap of 10,000 tiles with typed row problem reporting.
- Established that slide hotkeys trigger output directly, override global label
  jump keys for the active item, and render a keycap badge on slide thumbnails.

## Shared contract change requests

Staged for `group-7` under `break(data)` on branch
`break/group/activate-contracts`: switch `songDocumentSchema` and `song.update`
to `groupedSongSchema`.

## Where to look

- `docs/plans/grouped-songs.md`: Section 3 (Comprehensive Code Audit), Section 4
  (Rollout Strategy and Request Breakdown), and Section 5 (Open Questions).

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: lead

- Verdict: Request changes
- Findings:

  1. docs/plans/grouped-songs.md:154-176, 180-246 Rollout order contradicts spec
     02 rollout rule.
  2. docs/plans/grouped-songs.md:183, 185-194 Shared contract change must be
     tagged `break` and go to data first.
  3. docs/plans/grouped-songs.md:66-145 Audit missing consumers and new test
     files.
  4. docs/plans/grouped-songs.md:256-262 Projection has no tile cap.
  5. docs/plans/grouped-songs.md:263-264 Hot key behavior, conflict resolution,
     and thumbnail marking must be exact.
  6. docs/plans/grouped-songs.md:250-372 Operator-visible requests need real-app
     offscreen checks.
  7. docs/plans/grouped-songs.md:436-442 Unnamed group display is decided by
     spec 05.
  8. docs/plans/grouped-songs.md:47 Use spec wording "maximal increasing
     consecutive stretches".
  9. docs/plans/grouped-songs.md:387 Port 5194 assignment documentation.
  10. docs/plans/grouped-songs.md:432-433 Settle text import draft policy.

## Review: reviewer

- Verdict: Request changes (same as lead)

## Team member's reply

1. Reordered the rollout so all consumers (projection, editor core, editor
   shell, item chip strip, text import) accept groups first via additive
   helpers, adapters, and parallel models. Store and IPC activation are deferred
   to the final request (`group-7`), keeping `main` green and v1 fully
   functional until the flip.
2. Designated the contract-flipping request as `group-7`, tagged `break(data)`
   on branch `break/group/activate-contracts`, owned by `data`, and slated for
   double review.
3. Expanded the code audit to include all listed consumers (`songEditorStore`,
   `SongEditor`, `SongHeader`, `SongPreview`, `VirtualSlides`,
   `useSongBlockWindow`, `editorFixture`, `ArrangementDialog`, `textImport.ts`,
   `recovery.ts`, `contentStore:496, 571`, `SongSlidePanel:50`,
   `SongItemPanel:97`, `songItemModel:79`) with owners, and explicitly
   identified `SongBlock.test.tsx`, `SongSlidePanel.test.tsx`, and
   `ItemArrangement.test.tsx` as new files. Adjusted unit scopes and line
   estimates accordingly.
4. Defined tile expansion cap `SHOW_SERVICE_LIMITS.tiles = 10_000`. Iteration
   halts immediately without unbounded allocation, emitting empty tiles and
   marking `problem: 'unknown-kind'` on the row. Added planned limit tests for
   service projection, library projection, and recovery slide count.
5. Specified hotkey behavior: pressing physical key in 진행 outputs the tile
   through `outputTile` (main command path); slide hotkeys take precedence over
   label jump keys for the open item; spec 10 shortcut conflict checking applies
   only to global shortcuts; and `SlideThumbnail` renders a keycap badge in its
   top-right corner.
6. Added mandatory "Checked in the app" real-app offscreen CDP checks with
   screenshots and flat element counts to every operator-visible request
   (`group-2`, `group-3`, `group-4`, `group-5`, `group-7`).
7. Removed Open Question 3 and followed Spec 05 directly: unnamed groups show
   `이름표 없음` and their source position in the chip strip, and `이름표`
   placeholder at the group start in editor blocks.
8. Updated wording to "maximal increasing consecutive stretches" matching
   Spec 02.
9. Cited assignment of port 5194 and app data `D:\llp-dev\group` in
   `.llp/restart.md` and requested addition to the `docs/WORKFLOW.md` table.
10. Settled text import draft handling on Option (a): wire drafts stay
    consistent with existing schemas, and `importSong` converts to grouped songs
    in memory on import via `migrateSongGroups`.
