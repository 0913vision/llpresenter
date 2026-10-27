# Review request: `group-5`

- Team member: `group` (Gemini)
- Branch: `feat/group/service-item-chips`, rebased onto
  `feat/group/editor-labels-thumbnails` at `7c6bb52e`
- Base commit: `7c6bb52e`
- Task: Prep 예배 순서 Item Panel: Group Chip Strip & Arrangement Editing
- CI: pending.

## Team member's reply

This branch implements request `group-5` and incorporates all 4 nits from the
`group-4` round 4 approval:

- **Nit a (`src/shared/schema/groupedSong.ts:159-163`)**:
  - Corrected the TSDoc on `arrangementGroupIds` to explicitly state that an
    empty named arrangement returns `[]`
    (`An empty named arrangement retains its empty group sequence ([])`).
- **Nit b (`src/main/store/showService.ts` & `src/shared/songOrder.ts`)**:
  - Extracted and exported `playbackGroupIds(song, arrangement)` in
    `src/shared/songOrder.ts` to centralize the fallback logic to file order
    when an arrangement is missing or empty.
  - Simplified `showService.ts` to delegate to `playbackGroupIds`.
  - Added unit test in `src/main/store/showService.test.ts` verifying that an
    empty named arrangement falls back to default file group order during Show
    playback.
- **Nit c (`src/renderer/src/prep/editor/songSession.ts:153`)**:
  - Added test in `src/renderer/src/prep/editor/songSession.test.ts` verifying
    that `copyArrangement` on a grouped song with an empty base arrangement
    copies `[]`.
- **Nit d (`src/renderer/src/prep/editor/SongBlock.tsx:155`)**:
  - Added `labelContainerRef` anchored to `LabelTag`'s button when the block is
    a group start, so `Ctrl+G` pops over the label tag rather than the textarea.
  - Added test in `src/renderer/src/prep/editor/SongBlock.test.tsx` verifying
    that pressing `Ctrl+G` on a group start block anchors the menu to the label
    container.

---

## What changed and why

1. **Group Chip Strip & Arrangement Editing
   (`src/renderer/src/prep/service/ItemArrangement.tsx`)**:
   - For grouped songs (`isGroupedSong(song)`), the arrangement strip renders
     one chip per group occurrence
     (`arrangement.groups: readonly SongGroupId[]`).
   - Group chips display group names in their preset label color; unnamed groups
     display `이름표 없음` followed by their source position (e.g.
     `이름표 없음 1`) with `none` color swatch.
   - Reordering via drag-and-drop (`useChipDrag`) and keyboard shortcuts
     (`Alt+ArrowLeft` / `Alt+ArrowRight`) moves group occurrences within the
     arrangement.
   - Pressing `Delete` on a focused group chip removes that group occurrence
     from the arrangement.
   - The "슬라이드 넣기" button opens a "그룹 넣기" menu for grouped songs,
     listing all song groups in master file order with name/position, color
     swatch, and first line of lyrics. Selecting an item appends that group
     occurrence to the arrangement.
   - Tooltips enforce read-only semantics: `DEFAULT_ORDER_REASON` ("기본 구성은
     변경할 수 없습니다") on 기본 arrangement, and `NEWER_FILE_REASON` ("새
     버전의 파일이라 바꿀 수 없습니다") on read-only files.
   - Generic `session: SongSession | SongSession<GroupedSong>` prop typing
     allows seamless operation on both v1 and grouped songs.

2. **Group Song Item Helpers
   (`src/renderer/src/prep/service/songItemModel.ts`)**:
   - `orderChips`: updated for grouped songs to iterate group occurrences,
     resolve group names/positions, map label swatches, and generate unique chip
     keys (`${id}:${occurrence}`).
   - Added `sameSequence<T>` helper to compare generic arrays (`SongGroupId[]`).
   - Added `groupStartIndicesFromGroups`, `groupStartIndices`, and
     `chipIndexForSlide` to map between slide indices and group chip indices.
   - Updated `itemPicture` to compute total slide counts and position indices
     for grouped songs.
   - Simplified `editedGroupOrder` to call `arrangementGroupIds(song, name)`.

3. **Store & Panel Integration (`serviceItemStore.ts`, `SongItemPanel.tsx`,
   `ItemSettingsRows.tsx`, `ItemSidePanels.tsx`)**:
   - `serviceItemStore.ts`:
     - Introduced `ServiceItemEditor` interface allowing both v1 `SongSession`
       and `SongSession<GroupedSong>` sessions.
     - `setOrder(order: readonly number[] | readonly SongGroupId[])` saves
       updated group orders to the song session via
       `song.setArrangementGroups(arrangement, order)`.
     - Updated `ServiceItemState.song` and `addArrangement` to support
       `SongSession | SongSession<GroupedSong>`.
     - Updated `effectiveArrangement` to check arrangements on
       `Song | GroupedSong`.
   - `SongItemPanel.tsx`:
     - Updated props to `session: SongSession | SongSession<GroupedSong>`.
     - Added `isV1SongDocument` type guard before invoking
       `editor.open(session.document)`.
   - `ItemSettingsRows.tsx` & `ItemSidePanels.tsx`:
     - Supported `session: SongSession | SongSession<GroupedSong>`.
   - `controlSession.ts`:
     - Exposed `window.__llpServiceItemStore` in DEV mode for offscreen CDP
       automated verification.

4. **Comprehensive Test Suites**:
   - `src/renderer/src/prep/service/ItemArrangement.test.tsx`: new dedicated
     test file covering chip rendering with label colors, unnamed group
     labeling, first slide selection on chip click, keyboard reordering
     (`Alt+Arrow`), chip deletion (`Delete`), `그룹 넣기` menu insertion, and
     read-only tooltips (`기본` and `readOnly`).
   - `src/renderer/src/prep/service/songItemModel.test.ts`: added tests for
     grouped song chip generation, unnamed groups, start indices, slide mapping,
     `sameSequence`, and `itemPicture`.
   - `src/renderer/src/prep/service/serviceItemStore.test.ts`: added test
     verifying saving a new group order via `items.setOrder([g2, g1])`.

---

## Paths changed

- `src/main/store/showService.ts`
- `src/renderer/src/control/controlSession.ts`
- `src/renderer/src/prep/editor/SongBlock.test.tsx`
- `src/renderer/src/prep/editor/SongBlock.tsx`
- `src/renderer/src/prep/editor/songSession.test.ts`
- `src/renderer/src/prep/service/ItemArrangement.test.tsx` (new file)
- `src/renderer/src/prep/service/ItemArrangement.tsx`
- `src/renderer/src/prep/service/ItemSettingsRows.tsx`
- `src/renderer/src/prep/service/ItemSidePanels.tsx`
- `src/renderer/src/prep/service/SongItemPanel.tsx`
- `src/renderer/src/prep/service/serviceItemStore.test.ts`
- `src/renderer/src/prep/service/serviceItemStore.ts`
- `src/renderer/src/prep/service/songItemModel.test.ts`
- `src/renderer/src/prep/service/songItemModel.ts`
- `src/shared/schema/groupedSong.ts`
- `src/shared/songOrder.ts`
- `docs/reviews/group-5/item-initial.png` (new file)
- `docs/reviews/group-5/item-reordered.png` (new file)
- `docs/reviews/group-5/item-after-10.png` (new file)
- `docs/reviews/group-5/measurements.json` (new file)

---

## Offscreen CDP verification

Automated verification script `D:\llp-dev\group\verify-group-5-cdp.mjs` was
executed against an offscreen Electron build (`LLP_TEST_WINDOWS=offscreen`, port
5194, CDP port 9514) on clean profile `D:\llp-dev\group`.

The verification executed the following steps:

1. Launched the app in 준비 mode and mounted a service item referencing a
   grouped song with 3 groups (`1절` with 2 slides, `후렴` with 1 slide, and an
   unnamed group with 1 slide) playing arrangement `주일용` (`[1절, 후렴, 1절]`,
   5 virtual thumbnails).
2. Captured `item-initial.png` showing the initial 3 chips (`1절`, `후렴`,
   `1절`) and 5 virtual thumbnails.
3. Reordered chip 0 via `Alt+ArrowRight`, moving it to position 1
   (`[후렴, 1절, 1절]`). Verified that virtual thumbnails updated in real time
   to reflect the new playback order. Captured `item-reordered.png`.
4. Executed 10 repeated reordering and reversal cycles, logging DOM element
   counts and verifying zero leaks.
5. In the restored order, selected chip 2 and captured `item-after-10.png`.
6. Verified that all three captured screenshot blobs have distinct SHA-256
   hashes.

### Element counts across 10 repeated reorder cycles

| Cycle     | Action    | Chips              | Thumbnails | Total DOM Elements |
| --------- | --------- | ------------------ | ---------- | ------------------ |
| Initial   | -         | `[1절, 후렴, 1절]` | 5          | 446                |
| Reordered | moveRight | `[후렴, 1절, 1절]` | 5          | 446                |
| 1         | moveLeft  | `[1절, 후렴, 1절]` | 5          | 446                |
| 1         | moveRight | `[후렴, 1절, 1절]` | 5          | 446                |
| 2         | moveLeft  | `[1절, 후렴, 1절]` | 5          | 446                |
| 2         | moveRight | `[후렴, 1절, 1절]` | 5          | 446                |
| 3         | moveLeft  | `[1절, 후렴, 1절]` | 5          | 446                |
| 3         | moveRight | `[후렴, 1절, 1절]` | 5          | 446                |
| 4         | moveLeft  | `[1절, 후렴, 1절]` | 5          | 446                |
| 4         | moveRight | `[후렴, 1절, 1절]` | 5          | 446                |
| 5         | moveLeft  | `[1절, 후렴, 1절]` | 5          | 446                |
| 5         | moveRight | `[후렴, 1절, 1절]` | 5          | 446                |
| 6         | moveLeft  | `[1절, 후렴, 1절]` | 5          | 446                |
| 6         | moveRight | `[후렴, 1절, 1절]` | 5          | 446                |
| 7         | moveLeft  | `[1절, 후렴, 1절]` | 5          | 446                |
| 7         | moveRight | `[후렴, 1절, 1절]` | 5          | 446                |
| 8         | moveLeft  | `[1절, 후렴, 1절]` | 5          | 446                |
| 8         | moveRight | `[후렴, 1절, 1절]` | 5          | 446                |
| 9         | moveLeft  | `[1절, 후렴, 1절]` | 5          | 446                |
| 9         | moveRight | `[후렴, 1절, 1절]` | 5          | 446                |
| 10        | moveLeft  | `[1절, 후렴, 1절]` | 5          | 446                |
| 10        | moveRight | `[후렴, 1절, 1절]` | 5          | 446                |

DOM element count remained flat at exactly 446 elements across all 10 cycles.

### Captured screenshots

![Initial grouped chip strip and thumbnails](./group-5/item-initial.png) _Figure
1: Initial item panel with group chips (`[1절, 후렴, 1절]`) and 5 virtual
thumbnails._

![Reordered group chips](./group-5/item-reordered.png) _Figure 2: Reordered item
panel after `Alt+ArrowRight` (`[후렴, 1절, 1절]`) with updated thumbnails._

![After 10 cycles](./group-5/item-after-10.png) _Figure 3: Restored item panel
after 10 cycles with chip 2 selected._

Screenshot SHA-256 hashes (all distinct):

- `item-initial.png`:
  `2022a7bb553d43038fec45ae253df0a06a03ac70a5b888604abb7d980b4c7fbd`
- `item-reordered.png`:
  `2d619728dc9e6ce94ac003c66f1d48a52c4d35bfafbce0867fbf31c3eba20405`
- `item-after-10.png`:
  `6f744a86ab06d11c4b3bc671d1fdc287fb5e713427792b0893785a624d83ce4a`
