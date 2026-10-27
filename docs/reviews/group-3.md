# Review request: `group-3` (round 1)

- Team member: `group` (Gemini)
- Branch: `feat/group/editor-blocks`, based on
  `feat/group/show-projection-hotkeys` at `cc42a190`
- Base commit: `cc42a190`
- Task: Song Editor Core: Grouped Block Edits & Backspace Boundary Rule
- CI: pending.

## What changed and why

Implements the song editor core block editing rules for grouped songs, linear
block indexing over `(groupId, slideIndex)`, and the spec Backspace boundary
refusal rule:

1. **Linear Block Indexing & Grouped Block Editing (`blockEdits.ts`)**:
   - Implemented `linearSlidesOf` and `linearBlockAddress(song, blockIndex)` to
     map 1D flat editor block indices into 2D
     `(groupIndex, groupId, groupName, slideIndex, isGroupStart, slide)`.
   - Linear slides populate `label` only at group start
     (`index === 0 && group.name !== ''`), and mark `isGroupStart: index === 0`.
   - Grouped editing commands:
     - `replaceGrouped`: replaces text within a slide's lines inside its group.
     - `splitGrouped`: splits text within a slide inside its group into two
       slides; preserves group ID and arrangement references.
     - `enterGrouped`: Enter on an empty line splits the slide within the
       current group.
     - `insertGrouped`: Ctrl Shift N inserts an empty slide directly after the
       current block within the same group.
     - `pasteGrouped`: multi-paragraph paste splits blank-line-separated text
       into slides within the current group.
     - `labelGrouped`: updates group name for the target group.
     - `mergeGrouped`: Backspace at index 0 within a group (`slideIndex > 0`)
       merges lines into the preceding slide in that group.

2. **Backspace Boundary Refusal Rule (`blockEdits.ts`, `songSession.ts`,
   `SongBlock.tsx`)**:
   - At a group boundary (`slideIndex === 0`), pressing Backspace at
     `start === 0 && end === 0` is strictly refused: `mergeGrouped` returns
     `mergeRefused: true` without altering slides or group structure.
   - `SongSession.edit({type: 'merge'})` detects `mergeRefused: true` and
     triggers `notifyBackspaceRefused(block)`.
   - `SongBlock.tsx` registers `session.onBackspaceRefused(block)` and attaches
     a floating portal tooltip: `"그룹 경계에서는 슬라이드를 합칠 수 없습니다"`.
     Hovering the group header tag on slide 0 also reveals this refusal
     explanation.

3. **Group Header & Label Tag Presentation (`SongBlock.tsx`)**:
   - Slide 0 of each group (`isGroupStart === true`) renders the group label tag
     and group header.
   - Unnamed groups (`group.name === ''`) render the placeholder label `이름표`.
   - Non-first slides of a group omit the label tag entirely, maintaining
     standard 3-column CSS grid alignment (`grid-column: 2`).

4. **History & Session Grouped Support (`songHistory.ts`, `songSession.ts`)**:
   - `SongHistory`: added
     `setArrangementGroups(name, groups: readonly SongGroupId[])` for reordering
     groups as an undoable step; updated undo/redo snapshot tracking to preserve
     grouped structure.
   - `SongSession`: added `arrangementGroups` getter, `setArrangementGroups`,
     and equality check in `acceptGlobalEdit`.
   - Persistence guard in `drain()`: guarded against saving `GroupedSong`
     through the active v1 IPC `song.update` contract during the rollout
     transition until the final `group-7` activation request.

5. **Editor Consumers Compatibility**:
   - `SongEditor.tsx`: memoizes `linearSlidesOf(song)` and bounds keyboard
     navigation over grouped blocks.
   - `SongHeader.tsx`: calculates total slides using
     `slideCountOf(snapshot.song)` instead of `.slides.length`.
   - `SongPreview.tsx` & `songPreviewModel.ts`: formats previews for `AnySong`
     without crashing on `.slides`.
   - `SongSlidePanel.tsx` & `VirtualSlides.tsx`: supports virtualized right-side
     slide previews for grouped songs.
   - `controlSession.ts`: exposes
     `window.__llpSongEditorStore = this.editorStore` gated on
     `import.meta.env.DEV` for automated offscreen CDP testing without any type
     assertions.

## Paths changed

- `src/renderer/src/prep/editor/blockEdits.ts`
- `src/renderer/src/prep/editor/songHistory.ts`
- `src/renderer/src/prep/editor/songSession.ts`
- `src/renderer/src/prep/editor/SongBlock.tsx`
- `src/renderer/src/prep/editor/SongEditor.tsx`
- `src/renderer/src/prep/editor/SongHeader.tsx`
- `src/renderer/src/prep/editor/SongPreview.tsx`
- `src/renderer/src/prep/editor/songPreviewModel.ts`
- `src/renderer/src/prep/editor/SongSlidePanel.tsx`
- `src/renderer/src/prep/editor/VirtualSlides.tsx`
- `src/renderer/src/prep/editor/useSongBlockWindow.ts`
- `src/renderer/src/control/controlSession.ts`
- `src/renderer/src/prep/editor/SongBlock.test.tsx` (new file)
- `src/renderer/src/prep/editor/blockEditing.test.ts`
- `src/renderer/src/prep/editor/songSession.test.ts`
- `docs/plans/grouped-songs.md`

## Checked in the app

Verified offscreen via CDP (`LLP_TEST_WINDOWS=offscreen`, dev server port 5194,
CDP port 9514) using `D:\llp-dev\group\verify-editor-cdp.mjs`:

- Switched to '준비' mode and opened grouped song document in editor via
  `window.__llpSongEditorStore`.
- Verified initial block rendering:
  - Block 0: Number 1, Label Tag `1절` (`teal`).
  - Block 1: Number 2, blank label area (omitted label tag, maintaining 3-column
    CSS grid alignment).
  - Block 2: Number 3, Label Tag `후렴` (`yellow`).
  - Block 3: Number 4, Label Tag `이름표` (unnamed group start placeholder).
- Dispatched Backspace at group boundary (Block 2, cursor at start 0 / end 0):
  - Refusal tooltip portal displayed:
    `"그룹 경계에서는 슬라이드를 합칠 수 없습니다"`.
  - Block 2 lyrics retained unchanged (`저 천사여 찬송하세...`).
- Repeated 10 Backspace refusal cycles:
  - Slide blocks remained flat at exactly 4 across all 10 cycles.
  - Textarea inputs remained flat at exactly 4 across all 10 cycles.
  - Total DOM element count remained flat at exactly 441 elements across all 10
    cycles (zero DOM leaks).

### Offscreen Verification Screenshots & Measurements

- Initial editor view with grouped blocks, label tags, and placeholder:
  ![Initial grouped song editor](group-3/editor-initial.png)
- Backspace boundary refusal tooltip:
  ![Backspace boundary refusal tooltip](group-3/editor-refusal-tooltip.png)
- View after 10 Backspace cycles:
  ![Editor view after 10 cycles](group-3/editor-after-10.png)

### Repeated Cycle Element Counts (`docs/reviews/group-3/measurements.json`)

| Cycle | Blocks | Textareas | Total DOM Elements | Block 2 First Line | Tooltip Text                                |
| :---: | :----: | :-------: | :----------------: | :----------------- | :------------------------------------------ |
|   1   |   4    |     4     |        441         | 저 천사여 찬송하세 | 그룹 경계에서는 슬라이드를 합칠 수 없습니다 |
|   2   |   4    |     4     |        441         | 저 천사여 찬송하세 | 그룹 경계에서는 슬라이드를 합칠 수 없습니다 |
|   3   |   4    |     4     |        441         | 저 천사여 찬송하세 | 그룹 경계에서는 슬라이드를 합칠 수 없습니다 |
|   4   |   4    |     4     |        441         | 저 천사여 찬송하세 | 그룹 경계에서는 슬라이드를 합칠 수 없습니다 |
|   5   |   4    |     4     |        441         | 저 천사여 찬송하세 | 그룹 경계에서는 슬라이드를 합칠 수 없습니다 |
|   6   |   4    |     4     |        441         | 저 천사여 찬송하세 | 그룹 경계에서는 슬라이드를 합칠 수 없습니다 |
|   7   |   4    |     4     |        441         | 저 천사여 찬송하세 | 그룹 경계에서는 슬라이드를 합칠 수 없습니다 |
|   8   |   4    |     4     |        441         | 저 천사여 찬송하세 | 그룹 경계에서는 슬라이드를 합칠 수 없습니다 |
|   9   |   4    |     4     |        441         | 저 천사여 찬송하세 | 그룹 경계에서는 슬라이드를 합칠 수 없습니다 |
|  10   |   4    |     4     |        441         | 저 천사여 찬송하세 | 그룹 경계에서는 슬라이드를 합칠 수 없습니다 |

## Checks run

- `npm test -- src/renderer/src/prep/editor/` (20 test files, 193 tests passed)
- `npm run typecheck` (tsc node + web passed with 0 errors)
- `npx eslint src/renderer/src/prep/editor/ src/renderer/src/control/controlSession.ts`
  (0 errors, 0 warnings)
- `npm run format:check` (Prettier code style passed)
- `git diff --check` (passed with 0 output)
- `npm run build` (electron-vite build production passed)
