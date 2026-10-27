# Plan: Grouped Songs Activation

Follow ProPresenter-style groups for songs (`docs/decisions.md`, 2026-10-27:
"Follow ProPresenter where qa-12 found a difference"). This plan details the
end-to-end activation of version 2 grouped songs across the store, IPC, song
editor, 예배 순서 구성 chips, and projection to the 진행 tiles.

## 1. Context and Baseline

The inactive foundation has already been merged into `main`:

- `docs/spec/02-data.md` and `docs/spec/05-prep.md` (commit `de36b9d2`):
  specification of grouped song schema, arrangements, Backspace boundary rules,
  and migration.
- `src/shared/schema/groupedSong.ts`, `songGroupMigration.ts`, and tests (commit
  `7178909c`): `parseGroupedSong`, `serializeGroupedSong`, `migrateSongGroups`,
  and `SONG_GROUP_LIMITS`.
- `src/shared/schema/slideHotKey.ts`, `src/shared/slideHotKeys.ts`, and
  `src/shared/schema/showService.ts` (commit `81623da6`): `SlideHotKey`,
  `findSlideHotKey`, and `ShowTile.sourceSlide` / `ShowTile.hotKey`.

Currently, the active song codec (`Song`, `parseSong`, `serializeSong`), the
main process store (`ContentStore`, `fileStore`), IPC contracts, the song editor
(`SongEditor`), the service item panel (`ItemArrangement`), and the projection
to 진행 tiles (`songTiles`) all continue to use version 1 songs.

## 2. File Format and First-Read Migration

### 2.1 Format Comparison

| Aspect          | Version 1 (`.llsong`)                                                      | Version 2 (`.llsong`)                                                                                       |
| --------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `schemaVersion` | `1`                                                                        | `2`                                                                                                         |
| Slide structure | Flat `slides: [{label?: string, lines: string[]}]`                         | Hierarchical `groups: [{id: SongGroupId, name: string, slides: [{lines: string[], hotKey?: SlideHotKey}]}]` |
| Group identity  | None; slides optionally carried `label`                                    | Stable UUID v4 (`SongGroupId`) per group; name stored once on group                                         |
| Arrangements    | `arrangements: [{name: string, slides: number[]}]` (1-based slide indices) | `arrangements: [{name: string, groups: SongGroupId[]}]` (group occurrences)                                 |
| Hot keys        | Not formally in v1 schema (unknown field)                                  | Optional per-source-slide `hotKey: "KeyA".."KeyZ" \| "Digit0".."Digit9"`                                    |
| Bounds          | Unbounded                                                                  | `SONG_GROUP_LIMITS`: max 10k slides, 10k groups, 1k arrangements, 100k occurrences                          |

### 2.2 First-Read Conversion Without Data Loss

When reading an existing version 1 song from disk:

1. **In-memory migration on read**: `parseGroupedSong` executes
   `migrateSongGroups(file)` via the file format migration hook.
2. **Preserving slides**: Adjacent runs of identical `label` values form
   candidate groups. Cuts are marked before the first source slide and after the
   last of every maximal increasing consecutive stretch in all stored
   arrangements. Combined cuts partition the source slides into groups. Every
   source slide is retained in its exact original order.
3. **Preserving labels**: Each slide's known `label` is consumed into the
   group's `name`. Unnamed slides produce `name: ""`.
4. **Preserving repeats and arrangements**: Each arrangement stretch maps to the
   new group IDs covering that stretch in order. Repeated references map to
   repeated group IDs. Expanding each migrated arrangement reproduces the exact
   sequence of slides as version 1; the default arrangement also remains
   identical.
5. **Preserving unknown fields**:
   - Unknown fields on the song root, arrangements, and slides survive intact.
   - If a version 1 file contained an unknown `groups` property, it is archived
     under `legacyV1.groups` (and recursively if `legacyV1` existed).
   - If a version 1 slide contained an unknown `hotKey` property, it is archived
     under `legacyV1.hotKey` rather than being parsed as an active hot key.
6. **Disk persistence rule**: The original version 1 file on disk remains
   untouched until the first successful user edit save. The normal pre-save
   recovery copy is placed in `.복구 사본` before writing version 2 atomically.

## 3. Comprehensive Code Audit

The following inventory identifies all places in the codebase reading, writing,
or projecting songs, categorized by component and owner:

### 3.1 Shared Contracts and IPC (Owner: `data`)

- `src/shared/schema/contentDocuments.ts`: `songDocumentSchema` uses
  `songSchema` (v1); `librarySongSchema.slideCount` counts `slides.length`.
- `src/shared/schema/contentEdit.ts`: `song.update` carries `song: songSchema`.
- `src/shared/songOrder.ts`: `playbackOrder(song: Song, name?: string)` returns
  `readonly number[]` of 1-based slide numbers.
- `src/shared/schema/textImport.ts`: imports `slideSchema` for text import draft
  validation.
- `src/preload/index.ts`: registers `parseSongDocument` and `parseSongChange`.

### 3.2 Main Process Store and Persistence (Owner: `data`)

- `src/main/store/fileStore.ts`: loads `.llsong` folder using `parseSong`.
- `src/main/store/contentStore.ts`:
  - `SONG: Kind<Song> = {name: 'song', serialize: serializeSong}`.
  - `DocumentCollection<Song>` tracks in-memory song documents.
  - `createSong`: creates `{format: 'llsong', schemaVersion: 1, ...}`.
  - `updateSong`: validates with `songSchema`.
  - `renameLabel`: scans `song.data.slides.some(s => s.label === edit.from)` and
    updates `slide.label`.
  - `importSong`: collects labels from `song.slides` at line 496 to add to
    `labels.json`, validates draft with `songSchema`, and checks import slide
    count at line 571.
- `src/main/store/contentLists.ts`: `librarySongs` reads `data.slides.length`.
- `src/main/store/contentEdits.ts`: `withRenamedArrangement` /
  `withoutArrangement` modify arrangements typed as `Song`.

### 3.3 Main Process Search and Live Recovery (Owners: `data`, `output`)

- `src/main/search/songIndex.ts` (Owner: `data`): `upsert(song: Song)` indexes
  `song.slides`.
- `src/main/live/recovery/plan.ts` (Owner: `output`): uses
  `content.song(id)?.song` and `songTiles`.
- `src/main/live/testing/recovery.ts` (Owner: `output`): uses `parseSong` and v1
  fixtures for recovery testing.

### 3.4 Projection to 진행 Tiles (Owners: `data`, `shell`, `ui`)

- `src/main/store/showService.ts` (Owner: `data`): `songTiles(song: Song, ...)`
  maps `playbackOrder` numbers to slides. Does not populate `hotKey` or
  `sourceSlide`.
- `src/shared/schema/showService.ts` (Owner: `data`): defines `ShowTile` and
  `showServiceSchema`. Add new constant `SHOW_SERVICE_LIMITS.tiles = 10_000` and
  cap tile arrays with `v.maxLength(SHOW_SERVICE_LIMITS.tiles)` (additive shared
  contract change).
- `src/main/store/librarySong.ts` (Owner: `data`): `showLibrarySong` calls
  `songTiles(song, ...)`.
- `src/renderer/src/show/SlidePanel.tsx` (Owner: `shell`): displays meta count
  and thumbnail grid.
- `src/renderer/src/show/SlideGrid.tsx` (Owner: `shell`): renders
  `SlideThumbnail`s, passes `hotKey={tile.hotKey}`, and handles output tile
  clicks.
- `src/renderer/src/show/shortcuts.ts` and `shortcuts.test.ts` (Owner: `shell`):
  `handleShowKey` intercepts keyboard events for 진행 live navigation and jump
  keys; checks `hasSlideHotKey(code)` and triggers `outputHotKey(code)`.
- `src/renderer/src/state/show.ts` (Owner: `shell`): `jumpLabelFor` /
  `outputLabel` use jump keys from labels. Hotkey lookup via `findSlideHotKey`
  is queried by `hasSlideHotKey` and `outputHotKey`.
- `src/renderer/src/ui/SlideThumbnail.tsx` and `SlideThumbnail.module.css`
  (Owner: `ui`): renders thumbnail canvas and `.hotKey` keycap badge with
  accessibility announcement.

### 3.5 Renderer Song Editor (Owner: `prep`)

- `src/renderer/src/prep/editor/songEditorStore.ts`: manages editor sessions,
  saving (`:135`, `:209`), title renaming (`:384`), and import persistence
  (`:571`).
- `src/renderer/src/prep/editor/songSession.ts`: session state tracking
  `arrangementSlides: readonly number[]`.
- `src/renderer/src/prep/editor/songHistory.ts`: history snapshot with `Song`
  and `setArrangementSlides(name, slides: number[])`.
- `src/renderer/src/prep/editor/blockEdits.ts`: `blockSnapshot`, `editBlocks`,
  and `remapReferences` manipulate `Song.slides` and remap numeric indices.
- `src/renderer/src/prep/editor/songArrangements.ts`: `editedOrder` /
  `newArrangement` work on `number[]`.
- `src/renderer/src/prep/editor/useSongBlockWindow.ts`: calculates virtualized
  block windowing offsets over `song.slides`.
- `src/renderer/src/prep/editor/VirtualSlides.tsx`: renders virtualized block
  rows at line 210.
- `src/renderer/src/prep/editor/SongEditor.tsx`: lines 67-184 handle block tab
  navigation and label menu invocation.
- `src/renderer/src/prep/editor/SongBlock.tsx`: displays `slide.label` tag on
  every slide; Backspace merges across any slide without group boundary check.
- `src/renderer/src/prep/editor/SongHeader.tsx`: line 72 accesses
  `session.document.song`.
- `src/renderer/src/prep/editor/LabelMenu.tsx`: setting a label sets
  `slide.label` instead of renaming/splitting groups.
- `src/renderer/src/prep/editor/ArrangementRow.tsx`: segmented control for
  arrangements.
- `src/renderer/src/prep/editor/ArrangementDialog.tsx`: modal dialog for
  creating or renaming arrangements.
- `src/renderer/src/prep/editor/SongSlidePanel.tsx`: line 50 calls
  `playbackOrder` to render thumbnails.
- `src/renderer/src/prep/editor/SongPreview.tsx`: lines 171 and 227 access
  `song.slides` to render preview frames.
- `src/renderer/src/prep/editor/songPreviewModel.ts`: formats slide preview
  captions.
- `src/renderer/src/prep/editor/editorFixture.ts`: provides song document
  fixtures used across editor tests.

### 3.6 Renderer 예배 순서 Item Settings & 구성 Chips (Owner: `prep`)

- `src/renderer/src/prep/service/ItemArrangement.tsx`: chips represent slide
  numbers (`order: readonly number[]`). Insertion/deletion operates on slide
  indices.
- `src/renderer/src/prep/service/songItemModel.ts`: `orderChips`, `slideLabel`,
  `movedOrder`, `withoutPosition` operate on slide numbers; line 79 calls
  `playbackOrder`.
- `src/renderer/src/prep/service/serviceItemStore.ts`:
  `setOrder(slides: number[])` calls `song.setArrangementSlides`.
- `src/renderer/src/prep/service/SongItemPanel.tsx`: line 97 calls
  `playbackOrder` and renders item settings.
- `src/renderer/src/prep/service/useChipDrag.ts`: handles chip drag-and-drop.

### 3.7 Text Import (Owners: `prep`, `data`)

- `src/main/import/convert.ts` (Owner: `data`): parses text into sections and
  slide lines.
- `src/shared/schema/songImport.ts` (Owner: `data`): `songImportDraftSchema`
  uses `slideSchema`.
- `src/renderer/src/prep/import/TextImportFlow.tsx` (Owner: `prep`): creates
  import drafts.
- `src/renderer/src/prep/import/TextImportDialog.tsx` (Owner: `prep`): modal
  dialog for importing text.

## 4. Rollout Strategy and Ordering

Spec 02 establishes the mandatory rollout rule:

> "The data schema/migration API lands first; activating it in the store and IPC
> waits until editor, grid, chip and live consumers accept groups. During that
> transition the existing version 1 entry points stay active and must not write
> a grouped file through an old editor."

To keep `main` 100% green, fully typed, and usable at every commit:

1. **Version 1 store and IPC stay active** throughout consumer implementation.
2. **Consumers are upgraded first** to support grouped songs using additive pure
   helpers, adapters, and parallel grouped pipelines, tested with grouped
   fixtures.
3. **Every request affecting the operator UI includes its own real-app offscreen
   check** (`LLP_TEST_WINDOWS=offscreen`, port 5194, `D:\llp-dev\group`), with
   screenshots and flat element counts across repeated flows, as required by
   `CODEX.md`.
4. **Final activation request** flips the store, IPC, and shared contracts
   together in one atomic change tagged `break(data)`, submitted for the
   mandatory double review after all consumers accept groups.

```text
group-1: Plan & Architecture Specification (current)
  │
  ▼
group-2: Projection to 진행 Tiles, Tile Cap & Slide Hotkeys (data / shell)
  │
  ▼
group-3: Song Editor Core: Grouped Block Edits & Backspace Boundary (prep)
  │
  ▼
group-4: Song Editor Shell: Label Menu, Group Split & Virtual Thumbnails (prep)
  │
  ▼
group-5: 예배 순서 Item Panel: Group Chip Strip & Arrangement Editing (prep)
  │
  ▼
group-6: Text Import Grouping & Fixture Migration (prep / data)
  │
  ▼
group-7: Store & IPC Final Activation (break/group/activate-contracts, double review)
```

---

### Request `group-2`: Projection to 진행 Tiles, Tile Expansion Cap, and Slide Hotkeys

- **Role & Owners**: `data` (store projection and shared schema contract),
  `shell` (진행 keyboard & tile dispatch), `ui` (thumbnail badge)
- **Tag & Branch**: `feat/group/show-projection-hotkeys` _(Includes additive
  shared contract change defining `SHOW_SERVICE_LIMITS.tiles` and capping
  `showServiceSchema.tiles` in `src/shared/schema/showService.ts`)_
- **Scope**:
  - Add grouped tile projection helpers `projectSongTiles` and
    `projectGroupedSongTiles` in `src/main/store/showService.ts` and
    `src/main/store/librarySong.ts` supporting both `Song` (v1) and
    `GroupedSong` (v2): populates `label`, `labelColor`, `lines`, `hotKey`, and
    `sourceSlide: {songId, groupId, slideIndex}`.
  - **Tile Expansion Cap (Boundary & Store)**:
    - In `src/shared/schema/showService.ts`, define new constant
      `SHOW_SERVICE_LIMITS = {tiles: 10_000}` (matching
      `SHOW_LIBRARY_SONG_LIMITS.tiles` in
      `src/shared/schema/showLibrarySong.ts`). Cap the tile array in
      `showServiceSchema` with `v.maxLength(SHOW_SERVICE_LIMITS.tiles)`,
      ensuring boundary validation.
    - In `src/main/store/showService.ts` and `src/main/store/librarySong.ts`,
      check the tile count inside projection loops (both v1 and v2 branches) and
      stop iterating immediately if the count reaches 10,000 to prevent large
      memory allocations.
    - When exceeding 10,000 tiles (tested at 10,001 tiles): emit empty tiles and
      mark `problem: 'unknown-kind'` on `ShowRow` (`problem: 'newer-version'` on
      `ShowLibrarySong`). Reusing `unknown-kind` (which triggers tooltip "이
      버전에서 알 수 없는 항목입니다.") is intentional temporary staging to keep
      the active shared contract `showRowProblems` completely unchanged before
      group-7.
    - Add `TODO(0913vision)` in `src/main/store/showService.ts` and
      `src/main/store/librarySong.ts` to switch to a dedicated typed row problem
      in group-7.
    - Never truncate silently. Ensure `songTiles(song, ...).length` returns 0 at
      the cap, safeguarding recovery `plan.ts:135`.
  - **Hotkey Dispatch**:
    - In `src/renderer/src/show/shortcuts.ts` (`handleShowKey`), intercept
      physical keys `KeyA`..`KeyZ` and `Digit0`..`Digit9`. Query active item
      tiles via `hasSlideHotKey(code)` in `src/renderer/src/state/show.ts`
      (using `findSlideHotKey`).
    - When matched, output the tile immediately through the main command path
      (`outputHotKey(code)` calling `outputTile({itemId, index})`, which sends
      `SlideLayer` to output windows) and update `selectedTile`.
    - **Edge Cases & Suppression**:
      - If pressed with **no open item** (`openItemId === null`), keypress is
        ignored; does not throw or trigger output.
      - If **modifier keys are held**
        (`event.ctrlKey || event.altKey || event.metaKey`), hotkey dispatch is
        bypassed, preserving OS and application shortcuts.
      - If focus is in a **text input or textarea**
        (`targetIsInputElement(event.target)`), hotkey dispatch does not fire,
        preventing typed characters from triggering tiles.
      - If the key is **held down** (`event.repeat === true`), repeated events
        are ignored so a held key does not re-output.
      - Add these as named unit tests in
        `src/renderer/src/show/shortcuts.test.ts`.
  - **Conflict Resolution**:
    - If a key matches both a slide hot key in the open presentation and an
      app-wide label jump key in `labels.json`, the slide hot key takes
      precedence.
    - If no slide hot key matches, it falls back to `jumpLabelFor(code)`.
    - Spec 10 shortcut conflict checking applies only across global shortcuts;
      presentation-local slide hot keys are scoped to their song by
      `groupedSongSchema`.
  - **Thumbnail Hotkey Badge**: in `src/renderer/src/ui/SlideThumbnail.tsx` and
    `SlideThumbnail.module.css`, render a compact keycap badge in the top-right
    corner when `tile.hotKey` is present with `aria-hidden="true"`, and include
    `, 단축키 <key>` in `thumbnailName`. In
    `src/renderer/src/show/SlideGrid.tsx`, pass `hotKey={tile.hotKey}` to
    `<SlideThumbnail />`.
  - Keep active v1 projection paths operational for existing files.
- **Paths changed**:
  - `src/shared/schema/showService.ts`
  - `src/main/store/showService.ts`
  - `src/main/store/librarySong.ts`
  - `src/main/live/recovery/plan.ts` (test helper compatibility at limit)
  - `src/renderer/src/state/show.ts`
  - `src/renderer/src/show/shortcuts.ts`
  - `src/renderer/src/show/SlideGrid.tsx`
  - `src/renderer/src/ui/SlideThumbnail.tsx`
  - `src/renderer/src/ui/SlideThumbnail.module.css`
  - Tests: `src/shared/schema/showService.test.ts`,
    `src/main/store/showService.test.ts`, `src/main/store/librarySong.test.ts`,
    `src/renderer/src/state/show.test.ts`,
    `src/renderer/src/show/shortcuts.test.ts`,
    `src/renderer/src/ui/SlideThumbnail.test.tsx`
- **Checked in the app**:
  - Offscreen run: open presentation with hotkey tiles (injected via renderer
    state or presentation with slide hotkeys), verify thumbnails render keycap
    badges, press hotkey, capture screenshot showing output triggered and
    selected tile updated. Verify flat element counts over 10 repeated triggers
    (measuring thumbnail DOM node count
    `document.querySelectorAll("button[role='option']").length` in the 진행 grid
    and total element count `document.querySelectorAll('*').length`).
- **Estimated lines**: ~640 lines.

---

### Request `group-3`: Song Editor Core: Grouped Block Edits & Backspace Boundary Rule

- **Role & Owner**: `prep` (File ownership: `src/renderer/src/prep/editor/`)
- **Tag & Branch**: `feat/group/editor-blocks`
- **Scope**:
  - In `src/renderer/src/prep/editor/blockEdits.ts`:
    - Implement linear block indexing over `(groupId, slideIndex)`.
    - Typing within lines updates that slide within its group.
    - Enter on empty line / Ctrl Enter / Ctrl Shift N: splits or inserts a slide
      within the current group; group ID and arrangement occurrences remain
      stable.
    - Backspace at start of block:
      - At group boundary (`slideIndex === 0`): refuse merge, do nothing, and
        trigger tooltip `그룹 경계에서는 슬라이드를 합칠 수 없습니다`.
      - Within group (`slideIndex > 0`): merge lines into previous slide.
  - In `src/renderer/src/prep/editor/songHistory.ts`:
    - Add history support for `GroupedSong` snapshots and
      `setArrangementGroups`.
  - In `src/renderer/src/prep/editor/songSession.ts`:
    - Support grouped document editing, dirty tracking, and Backspace refusal
      notification.
  - In `src/renderer/src/prep/editor/SongBlock.tsx`:
    - Render group header / label tag only at group start (first slide of
      group).
    - Unnamed groups show `이름표` placeholder at group start.
    - Non-first slides omit label tags.
    - Attach Backspace refusal tooltip.
  - Add new test file `SongBlock.test.tsx` and update `blockEditing.test.ts`.
- **Paths changed**:
  - `src/renderer/src/prep/editor/blockEdits.ts`
  - `src/renderer/src/prep/editor/songHistory.ts`
  - `src/renderer/src/prep/editor/songSession.ts`
  - `src/renderer/src/prep/editor/SongBlock.tsx`
  - `src/renderer/src/prep/editor/SongBlock.test.tsx` (new file)
  - Tests: `src/renderer/src/prep/editor/blockEditing.test.ts`,
    `src/renderer/src/prep/editor/songSession.test.ts`
- **Checked in the app**:
  - Offscreen run: exercise line editing, Enter block split within group,
    Backspace merge inside group, and Backspace refusal at group start
    displaying tooltip. Record screenshots and verify flat element count.
- **Estimated lines**: ~620 lines.

---

### Request `group-4`: Song Editor Shell: Label Menu, Group Splitting & Virtual Thumbnails

- **Role & Owner**: `prep` (File ownership: `src/renderer/src/prep/editor/`)
- **Tag & Branch**: `feat/group/editor-labels-thumbnails`
- **Scope**:
  - In `src/renderer/src/prep/editor/LabelMenu.tsx`:
    - Choosing a label sets the group's `name`.
    - Starting a new group at a slide splits the current group into two groups
      with fresh UUIDs and replaces every arrangement occurrence with the two
      parts in order (`[A]` -> `[A1, A2]`).
    - Renaming a group keeps its UUID and does not merge with other same-named
      groups.
  - In `src/renderer/src/prep/editor/SongEditor.tsx`, `useSongBlockWindow.ts`,
    and `VirtualSlides.tsx`:
    - Update virtualized block calculation and keyboard navigation across
      groups.
  - In `src/renderer/src/prep/editor/ArrangementRow.tsx` and
    `ArrangementDialog.tsx`:
    - Manage named arrangements referencing `SongGroupId[]`.
  - In `src/renderer/src/prep/editor/SongSlidePanel.tsx`:
    - Render thumbnail grid expanding groups in arrangement order; line 50 calls
      grouped expansion helper.
  - In `src/renderer/src/prep/editor/SongHeader.tsx`, `SongPreview.tsx`, and
    `songPreviewModel.ts`:
    - Render preview captions with group label name and color.
  - In `src/renderer/src/prep/editor/editorFixture.ts`:
    - Add grouped song fixtures.
  - Add new test file `SongSlidePanel.test.tsx`.
- **Paths changed**:
  - `src/renderer/src/prep/editor/LabelMenu.tsx`
  - `src/renderer/src/prep/editor/SongEditor.tsx`
  - `src/renderer/src/prep/editor/useSongBlockWindow.ts`
  - `src/renderer/src/prep/editor/VirtualSlides.tsx`
  - `src/renderer/src/prep/editor/ArrangementRow.tsx`
  - `src/renderer/src/prep/editor/ArrangementDialog.tsx`
  - `src/renderer/src/prep/editor/SongSlidePanel.tsx`
  - `src/renderer/src/prep/editor/SongHeader.tsx`
  - `src/renderer/src/prep/editor/SongPreview.tsx`
  - `src/renderer/src/prep/editor/songPreviewModel.ts`
  - `src/renderer/src/prep/editor/editorFixture.ts`
  - `src/renderer/src/prep/editor/SongSlidePanel.test.tsx` (new file)
  - Tests: `src/renderer/src/prep/editor/LabelMenu.test.tsx`,
    `src/renderer/src/prep/editor/ArrangementRow.test.tsx`,
    `src/renderer/src/prep/editor/songPreviewModel.test.ts`
- **Checked in the app**:
  - Offscreen run: select slide, assign new label to split group, verify new
    group header and updated thumbnail strip. Record screenshots and flat
    element count.
- **Estimated lines**: ~630 lines.

---

### Request `group-5`: Prep 예배 순서 Item Panel: Group Chip Strip & Arrangement Editing

- **Role & Owner**: `prep` (File ownership: `src/renderer/src/prep/service/`)
- **Tag & Branch**: `feat/group/service-item-chips`
- **Scope**:
  - In `src/renderer/src/prep/service/ItemArrangement.tsx`:
    - Chip strip displays one chip per group occurrence
      (`arrangement.groups: SongGroupId[]`).
    - Chip displays group name in label color; unnamed groups display
      `이름표 없음` and their source position (e.g. `이름표 없음 1`).
    - Drag-and-drop reorders group occurrences via `useChipDrag`.
    - Keyboard Alt+← / Alt+→ moves selected chip one position.
    - Delete key removes that group occurrence from the arrangement.
    - "그룹 넣기" (insert group, plus box) menu opens song's groups in master
      order with name, source position, and first line, and appends the chosen
      group.
    - Read-only tooltip on 기본: `기본 구성은 변경할 수 없습니다`.
    - Read-only tooltip on newer files: `새 버전의 파일이라 바꿀 수 없습니다`.
  - In `src/renderer/src/prep/service/songItemModel.ts`:
    - Update `orderChips`, `itemPicture`, `movedOrder`, and `withoutPosition` to
      operate on group occurrences.
  - In `src/renderer/src/prep/service/serviceItemStore.ts`:
    - `setOrder(groups: SongGroupId[])` saves updated group order to song
      session.
  - In `src/renderer/src/prep/service/SongItemPanel.tsx`:
    - Line 97 calls grouped expansion for thumbnail grid.
  - Add new test file `ItemArrangement.test.tsx`.
- **Paths changed**:
  - `src/renderer/src/prep/service/ItemArrangement.tsx`
  - `src/renderer/src/prep/service/songItemModel.ts`
  - `src/renderer/src/prep/service/serviceItemStore.ts`
  - `src/renderer/src/prep/service/SongItemPanel.tsx`
  - `src/renderer/src/prep/service/useChipDrag.ts`
  - `src/renderer/src/prep/service/ItemArrangement.test.tsx` (new file)
  - Tests: `src/renderer/src/prep/service/songItemModel.test.ts`,
    `src/renderer/src/prep/service/serviceItemStore.test.ts`,
    `src/renderer/src/prep/service/SongItemPanel.test.tsx`
- **Checked in the app**:
  - Offscreen run: drag chip to reorder arrangement, delete chip, insert group
    from menu, verify thumbnails update. Record screenshots and flat element
    count.
- **Estimated lines**: ~610 lines.

---

### Request `group-6`: Text Import Grouping & Fixture Migration

- **Role & Owners**: `prep` (import UI) and `data` (conversion helper)
- **Tag & Branch**: `feat/group/text-import-groups`
- **Scope**:
  - In `src/main/import/convert.ts`:
    - Bracketed lines (`[1절]`, `[후렴]`) parsed in sections map directly to
      candidate groups.
  - Text import draft policy (Option a):
    - `songImportDraft` continues using standard wire structures.
    - `convertTextImport` maps parsed sections into draft slide boundaries
      preserving bracket labels so migration constructs groups cleanly on
      import.
  - In `src/renderer/src/prep/import/TextImportFlow.tsx` and
    `TextImportDialog.tsx`:
    - Update import previews to reflect candidate group boundaries and labels.
- **Paths changed**:
  - `src/main/import/convert.ts`
  - `src/renderer/src/prep/import/TextImportFlow.tsx`
  - `src/renderer/src/prep/import/TextImportDialog.tsx`
  - Tests: `src/main/import/convert.test.ts`,
    `src/renderer/src/prep/import/TextImportFlow.test.tsx`
- **Checked in the app**:
  - Offscreen run: open text import dialog with bracketed lyrics text (`[1절]`,
    `[후렴]`), verify candidate group preview sections and labels render, commit
    import, and verify flat element count over 10 repeated dialog preview
    updates. Record screenshots.
- **Estimated lines**: ~510 lines.

---

### Request `group-7`: Final Activation: Store, IPC & Shared Contracts (Double Review)

- **Role & Owner**: `data` (File ownership: `src/shared/`, `src/preload/`,
  `src/main/store/`, `src/main/search/`)
- **Tag & Branch**: `break/group/activate-contracts` _(Tagged `break` per
  CLAUDE.md because it alters the active shared contracts `songDocumentSchema`
  and `song.update`)_
- **Double Review**: Reviewed twice (Lead + Codex).
- **Lead Directive**: Build the consumer units in order, but do not start
  group-7 (the store, IPC, and contract flip) until the lead tells you to. When
  reaching group-7, report `Waiting for the lead`.
- **Scope**:
  - Switch `src/shared/schema/contentDocuments.ts`: `songDocumentSchema` uses
    `groupedSongSchema`. `librarySongSchema.slideCount` counts total source
    slides across all groups.
  - Switch `src/shared/schema/contentEdit.ts`: `song.update` carries
    `groupedSongSchema`.
  - Switch `src/preload/index.ts`: validates `GroupedSong` on
    `parseSongDocument` and `parseSongChange`.
  - Switch `src/main/store/fileStore.ts`: loads `.llsong` using
    `parseGroupedSong` (in-memory migration of v1 files).
  - Switch `src/main/store/contentStore.ts`:
    - `SONG: Kind<GroupedSong> = {name: 'song', serialize: serializeGroupedSong}`.
    - `songs: DocumentCollection<GroupedSong>`.
    - `createSong`: writes `schemaVersion: 2` with initial default group.
    - `updateSong`: validates with `groupedSongSchema`.
    - `renameLabel`: scans `group.name === edit.from` and updates group names.
    - `importSong`: converts import drafts into `GroupedSong` via
      `migrateSongGroups`.
    - Line 496: collects labels from `group.name` to add to `labels.json`.
    - Line 571: updates slide count check for library list notification.
  - Update consumers expecting `Song` to now accept `GroupedSong`:
    - `src/main/store/showService.ts` (`SongLibrary` / `buildShowService`)
    - `src/main/store/librarySong.ts` (`showLibrarySong`)
    - `src/main/live/recovery/plan.ts` (`RecoveryContent.song`)
    - `src/shared/songOrder.ts` (`playbackOrder`)
  - Update `src/main/store/contentLists.ts`: sums `slideCount` across groups.
  - Update `src/main/store/contentEdits.ts`: `withRenamedArrangement` /
    `withoutArrangement` on `GroupedSong`.
  - Update `src/main/search/songIndex.ts`: indexes slide lines across groups.
  - Update `src/main/live/testing/recovery.ts`: migrate test fixtures to
    `GroupedSong`.
  - Update `src/renderer/src/prep/editor/songEditorStore.ts`: lines 135, 209,
    384, and 571 connect to active grouped song IPC.
  - **Review Documentation**:
    - File format before (v1) and after (v2).
    - First-read migration behavior.
    - Failure cases:
      - Corrupt file: returns typed error, skipped with report.
      - Write failing halfway: atomic temp file write preserves existing file.
      - Newer version file: marked `access: 'readOnly'`, write refused.
- **Paths changed**:
  - `src/shared/schema/contentDocuments.ts`
  - `src/shared/schema/contentEdit.ts`
  - `src/preload/index.ts`
  - `src/main/store/fileStore.ts`
  - `src/main/store/contentStore.ts`
  - `src/main/store/showService.ts`
  - `src/main/store/librarySong.ts`
  - `src/main/store/contentLists.ts`
  - `src/main/store/contentEdits.ts`
  - `src/main/search/songIndex.ts`
  - `src/main/live/recovery/plan.ts`
  - `src/main/live/testing/recovery.ts`
  - `src/shared/songOrder.ts`
  - `src/renderer/src/prep/editor/songEditorStore.ts`
  - Tests: `src/main/store/contentStore.test.ts`,
    `src/main/store/fileStore.test.ts`, `src/main/search/songIndex.test.ts`,
    `src/main/store/labelRename.test.ts`,
    `src/shared/schema/contentDocuments.test.ts`,
    `src/shared/schema/contentEdit.test.ts`, `src/preload/index.test.ts`,
    `src/main/store/openServiceFeed.test.ts`,
    `src/renderer/src/prep/editor/songEditorStore.test.ts`
- **Checked in the app**:
  - Full end-to-end offscreen run: load existing v1 song from disk, verify
    automatic migration in memory, edit lyrics, verify v2 atomic save with
    `.복구 사본` backup, verify 진행 tile projection and hotkey output. Record
    screenshots and flat element count.
- **Estimated lines**: ~650 lines.

## 5. Open Questions and Clarifications for the Lead

Per the workflow guidelines, the following open item is submitted for lead
decision:

1. **Per-Slide Hotkey Assignment UI in the Song Editor**:
   - _Context_: `docs/spec/02-data.md` and `data-83` define stored `hotKey` on
     `groups[].slides[].hotKey` (`KeyA`..`KeyZ`, `Digit0`..`Digit9`) and
     `docs/decisions.md` states "A label hot key goes to that particular slide."
     However, `docs/spec/05-prep.md` does not specify the UI mechanism for an
     operator to assign or clear a hot key on an individual slide block in the
     editor.
   - _Options_: (a) Add a small hotkey button/badge next to the slide number in
     `SongBlock`, which opens a key-press capture popover or context menu item
     ("단축키 지정 / 삭제"). (b) Include "바로 가기 키 설정" inside the slide
     block's context menu. (c) Defer the editor hotkey assignment UI to M4
     (shortcuts milestone), while keeping storage and playback projection active
     for imported/assigned songs.
   - _Recommendation_: Option (c) for this vertical slice, or (b) if immediate
     operator assignment is required.

2. **Port and App Data Folder Documentation**:
   - Dev port 5194 and app data folder `D:\llp-dev\group` were assigned by the
     lead in `.llp/restart.md`. We request the lead add the `group` row (Port
     5194, Folder `D:\llp-dev\group`) to the port table in `docs/WORKFLOW.md`.
