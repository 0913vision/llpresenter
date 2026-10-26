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
   candidate groups. Cuts are added before and after every consecutive stretch
   in all stored arrangements. The combined cuts partition the slides into
   groups. Every source slide is retained in its exact original order.
3. **Preserving labels**: Each slide's known `label` is consumed into the
   group's `name`. Unnamed slides produce `name: ""`.
4. **Preserving repeats and arrangements**: Each arrangement stretch maps to the
   new group IDs covering that stretch. Repeated references map to repeated
   group IDs. Expanding each migrated arrangement reproduces the exact sequence
   of slides as version 1.
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

The following areas currently read, write, or project songs:

### 3.1 Shared Contracts and IPC (`src/shared/`, `src/preload/`)

- `src/shared/schema/contentDocuments.ts`: `songDocumentSchema` uses
  `songSchema` (v1). `librarySongSchema.slideCount` counts `slides.length`.
- `src/shared/schema/contentEdit.ts`: `song.update` carries `song: songSchema`.
- `src/shared/songOrder.ts`: `playbackOrder(song: Song, name?: string)` returns
  `readonly number[]` of 1-based slide numbers.
- `src/preload/index.ts`: registers `parseSongDocument` and `parseSongChange`.

### 3.2 Main Process Store and Persistence (`src/main/store/`)

- `src/main/store/fileStore.ts`: loads `.llsong` folder using `parseSong`.
- `src/main/store/contentStore.ts`:
  - `SONG: Kind<Song> = {name: 'song', serialize: serializeSong}`.
  - `DocumentCollection<Song>` tracks in-memory song documents.
  - `createSong`: creates `{format: 'llsong', schemaVersion: 1, ...}`.
  - `updateSong`: validates with `songSchema`.
  - `renameLabel`: scans `song.data.slides.some(s => s.label === edit.from)` and
    updates `slide.label`.
  - `importSong`: validates draft with `songSchema`.
- `src/main/store/contentLists.ts`: `librarySongs` reads `data.slides.length`.
- `src/main/store/contentEdits.ts`: `withRenamedArrangement` /
  `withoutArrangement` modify arrangements typed as `Song`.

### 3.3 Main Process Search and Live Recovery (`src/main/search/`, `src/main/live/`)

- `src/main/search/songIndex.ts`: `upsert(song: Song)` indexes `song.slides`.
- `src/main/live/recovery/plan.ts`: uses `content.song(id)?.song` and
  `songTiles`.

### 3.4 Projection to 진행 Tiles (`src/main/store/showService.ts`, `librarySong.ts`)

- `src/main/store/showService.ts`: `songTiles(song: Song, ...)` maps
  `playbackOrder` numbers to slides. Does not populate `hotKey` or
  `sourceSlide`.
- `src/main/store/librarySong.ts`: `showLibrarySong` calls
  `songTiles(song, ...)`.

### 3.5 Renderer 진행 Workspace (`src/renderer/src/show/`, `src/renderer/src/state/`)

- `src/renderer/src/state/show.ts`: `jumpLabelFor` / `outputLabel` use jump keys
  from labels. Hotkey lookup via `findSlideHotKey` is not yet connected.
- `src/renderer/src/show/SlideGrid.tsx` / `SlidePanel.tsx`: renders tiles
  without showing hotkey indicators or resolving per-slide hotkeys.

### 3.6 Renderer Song Editor (`src/renderer/src/prep/editor/`)

- `src/renderer/src/prep/editor/blockEdits.ts`: `blockSnapshot`, `editBlocks`,
  and `remapReferences` manipulate `Song.slides` and remap numeric indices.
- `src/renderer/src/prep/editor/songHistory.ts`: stores `BlockSnapshot` with
  `Song` and `setArrangementSlides(name, slides: number[])`.
- `src/renderer/src/prep/editor/songSession.ts`: exposes `arrangementSlides` as
  `number[]`.
- `src/renderer/src/prep/editor/songArrangements.ts`: `editedOrder` /
  `newArrangement` work on `number[]`.
- `src/renderer/src/prep/editor/SongBlock.tsx`: displays `slide.label` tag on
  every slide; Backspace merges across any slide without boundary check.
- `src/renderer/src/prep/editor/LabelMenu.tsx`: setting a label sets
  `slide.label` instead of renaming/splitting groups.
- `src/renderer/src/prep/editor/SongSlidePanel.tsx`: displays thumbnails in
  file/arrangement order.

### 3.7 Renderer 예배 순서 Item Settings & 구성 Chips (`src/renderer/src/prep/service/`)

- `src/renderer/src/prep/service/ItemArrangement.tsx`: chips represent slide
  numbers (`order: readonly number[]`). Insertion/deletion operates on slide
  indices.
- `src/renderer/src/prep/service/songItemModel.ts`: `orderChips`, `slideLabel`,
  `movedOrder`, `withoutPosition` all operate on slide numbers.
- `src/renderer/src/prep/service/serviceItemStore.ts`:
  `setOrder(slides: number[])` calls `song.setArrangementSlides`.

### 3.8 Text Import (`src/renderer/src/prep/import/`, `src/main/import/`)

- `src/shared/schema/songImport.ts`: `songImportDraftSchema` uses `slideSchema`.
- `src/main/import/convert.ts`: parses text into sections and slide lines.
- `src/renderer/src/prep/import/TextImportFlow.tsx`: creates import draft.

## 4. Planned Request Breakdown (~600 Lines Each)

To respect the ~600-line review limit and Google engineering practices, the work
is partitioned into 7 focused requests following `group-1`:

```text
group-1 (this plan)
  │
  ▼
group-2 (Shared contracts, document schemas, grouped playback helper)
  │
  ▼
group-3 (Main store, file format activation, double review)
  │
  ▼
group-4 (Projection to 진행 tiles, sourceSlide, and hotkey navigation)
  │
  ▼
group-5 (Song editor: group-aware blocks, history, Backspace refusal)
  │
  ▼
group-6 (Song editor: label menu group splitting, thumbnails, preview)
  │
  ▼
group-7 (Service item panel: group chip strip, drag/drop, arrangement editing)
  │
  ▼
group-8 (Text import grouped drafts, verification, offscreen CDP check)
```

---

### Request `group-2`: Shared Contracts, Document Schemas, and Grouped Playback Helper

- **Owner**: `data` (File ownership: `src/shared/`, `src/preload/`)
- **Branch**: `feat/group/shared-contracts`
- **Scope**:
  - Update `src/shared/schema/contentDocuments.ts`: change `songDocumentSchema`
    to use `groupedSongSchema` instead of `songSchema`. Update
    `librarySongSchema` typing/helpers.
  - Update `src/shared/schema/contentEdit.ts`: change `song.update` schema to
    `groupedSongSchema`.
  - Add `src/shared/songOrder.ts`:
    `groupedPlaybackOrder(song: GroupedSong, name?: string)` returning source
    group occurrences and slide positions.
  - Update `src/preload/index.ts`: export and validate `parseSongDocument` and
    `parseSongChange` against `GroupedSong`.
- **Paths changed**:
  - `src/shared/schema/contentDocuments.ts`
  - `src/shared/schema/contentEdit.ts`
  - `src/shared/songOrder.ts`
  - `src/preload/index.ts`
  - Tests: `src/shared/schema/contentDocuments.test.ts`,
    `src/shared/schema/contentEdit.test.ts`, `src/shared/songOrder.test.ts`,
    `src/preload/index.test.ts`
- **Estimated lines**: ~520 lines.

---

### Request `group-3`: Main Process Store & File Format Activation (Double Review)

- **Owner**: `data` (File ownership: `src/main/store/`, `src/main/search/`,
  `src/main/live/`)
- **Branch**: `feat/group/store-activation`
- **Scope**:
  - Switch `.llsong` loader in `src/main/store/fileStore.ts` to
    `parseGroupedSong`.
  - Switch serializer in `src/main/store/contentStore.ts` to
    `serializeGroupedSong`.
  - Update `ContentStore`:
    - `songs: DocumentCollection<GroupedSong>`.
    - `createSong`: writes `schemaVersion: 2` with initial default group.
    - `updateSong`: validates with `groupedSongSchema`.
    - `renameLabel`: updates matching `group.name === edit.from`.
    - `importSong`: migrates or constructs `GroupedSong`.
  - Update `src/main/store/contentLists.ts`: sum `slideCount` across all groups.
  - Update `src/main/store/contentEdits.ts`: update `withRenamedArrangement` and
    `withoutArrangement` for `GroupedSong`.
  - Update `src/main/search/songIndex.ts`: index slide lines from
    `song.groups.flatMap(g => g.slides)`.
  - Update `src/main/live/recovery/plan.ts`: typing compatibility for
    `GroupedSong`.
- **Double Review Documentation**: Review document explicitly details:
  - File format before (v1) and after (v2).
  - Migration behavior on first read.
  - Failure cases: corrupted file (returns typed error, skipped with report),
    write failing halfway (atomic write via temp file preserves existing), file
    from newer version (`access: 'readOnly'`, prevented from overwrite).
- **Paths changed**:
  - `src/main/store/fileStore.ts`
  - `src/main/store/contentStore.ts`
  - `src/main/store/contentLists.ts`
  - `src/main/store/contentEdits.ts`
  - `src/main/search/songIndex.ts`
  - `src/main/live/recovery/plan.ts`
  - Tests: `src/main/store/contentStore.test.ts`,
    `src/main/store/fileStore.test.ts`, `src/main/search/songIndex.test.ts`,
    `src/main/store/labelRename.test.ts`, `src/main/live/recovery/plan.test.ts`
- **Estimated lines**: ~620 lines.

---

### Request `group-4`: Projection to 진행 Tiles & Slide Hotkey Navigation

- **Owner**: `data` (store projection) & `shell` (진행 keyboard & tile dispatch)
- **Branch**: `feat/group/show-projection-hotkeys`
- **Scope**:
  - Update `src/main/store/showService.ts`:
    `songTiles(song: GroupedSong, colors, arrangement)` expands group sequence
    (or file-order groups when default/empty), populating: `label`,
    `labelColor`, `lines`, `hotKey`, and
    `sourceSlide: {songId: song.id, groupId: group.id, slideIndex}`.
  - Update `src/main/store/librarySong.ts`: project grouped library song tiles.
  - Update `src/renderer/src/state/show.ts`: handle keyboard hotkeys
    `KeyA`..`KeyZ` and `Digit0`..`Digit9` by querying
    `findSlideHotKey(tiles, event.code)` and navigating directly to the first
    projected occurrence.
  - Update `src/renderer/src/show/SlideGrid.tsx` / `SlidePanel.tsx`: ensure
    tiles correctly render and handle projected tiles.
- **Paths changed**:
  - `src/main/store/showService.ts`
  - `src/main/store/librarySong.ts`
  - `src/renderer/src/state/show.ts`
  - `src/renderer/src/show/SlideGrid.tsx`
  - Tests: `src/main/store/showService.test.ts`,
    `src/main/store/librarySong.test.ts`, `src/renderer/src/state/show.test.ts`,
    `src/renderer/src/show/SlidePanel.test.tsx`
- **Estimated lines**: ~540 lines.

---

### Request `group-5`: Prep Song Editor - Group-Aware Blocks & Backspace Boundary Rule

- **Owner**: `prep` (File ownership: `src/renderer/src/prep/editor/`)
- **Branch**: `feat/group/editor-blocks`
- **Scope**:
  - Update `src/renderer/src/prep/editor/blockEdits.ts`:
    - Linear block model mapping to `(groupId, slideIndex)`.
    - Line text typing within slide.
    - Enter on empty line / Ctrl Enter / Ctrl Shift N: splits/inserts slide
      within the same group (group ID and arrangement references remain stable).
    - Backspace at start of block:
      - At group boundary (`slideIndex === 0`): refuse merge, do nothing, show
        tooltip `그룹 경계에서는 슬라이드를 합칠 수 없습니다`.
      - Within group (`slideIndex > 0`): merge lines into previous slide.
  - Update `src/renderer/src/prep/editor/songHistory.ts`: history snapshot with
    `GroupedSong`, `setArrangementGroups`.
  - Update `src/renderer/src/prep/editor/songSession.ts`: group-aware session
    state.
  - Update `src/renderer/src/prep/editor/SongBlock.tsx`: display group chip only
    at group start; show Backspace boundary tooltip when refused.
- **Paths changed**:
  - `src/renderer/src/prep/editor/blockEdits.ts`
  - `src/renderer/src/prep/editor/songHistory.ts`
  - `src/renderer/src/prep/editor/songSession.ts`
  - `src/renderer/src/prep/editor/songArrangements.ts`
  - `src/renderer/src/prep/editor/SongBlock.tsx`
  - Tests: `src/renderer/src/prep/editor/blockEditing.test.ts`,
    `src/renderer/src/prep/editor/songSession.test.ts`,
    `src/renderer/src/prep/editor/SongBlock.test.tsx`
- **Estimated lines**: ~610 lines.

---

### Request `group-6`: Prep Song Editor - Label Menu Group Splitting & Thumbnails

- **Owner**: `prep` (File ownership: `src/renderer/src/prep/editor/`)
- **Branch**: `feat/group/editor-labels-thumbnails`
- **Scope**:
  - Update `src/renderer/src/prep/editor/LabelMenu.tsx`:
    - Choosing a label sets the group's `name`.
    - Starting a new group at a slide splits the group at that slide and
      replaces every arrangement occurrence with the two parts in order.
    - Renaming a group keeps its ID and does not merge same-named groups.
  - Update `src/renderer/src/prep/editor/SongSlidePanel.tsx`: thumbnail strip
    reflecting group expansion in chosen arrangement.
  - Update `src/renderer/src/prep/editor/songPreviewModel.ts`: preview caption
    showing group label name, color, and position.
  - Update `src/renderer/src/prep/editor/ArrangementRow.tsx` /
    `ArrangementDialog.tsx`.
- **Paths changed**:
  - `src/renderer/src/prep/editor/LabelMenu.tsx`
  - `src/renderer/src/prep/editor/SongSlidePanel.tsx`
  - `src/renderer/src/prep/editor/songPreviewModel.ts`
  - `src/renderer/src/prep/editor/ArrangementRow.tsx`
  - Tests: `src/renderer/src/prep/editor/LabelMenu.test.tsx`,
    `src/renderer/src/prep/editor/SongSlidePanel.test.tsx`,
    `src/renderer/src/prep/editor/songPreviewModel.test.ts`,
    `src/renderer/src/prep/editor/ArrangementRow.test.tsx`
- **Estimated lines**: ~580 lines.

---

### Request `group-7`: Prep 예배 순서 Item Panel - Group Chip Strip & Arrangement Editing

- **Owner**: `prep` (File ownership: `src/renderer/src/prep/service/`)
- **Branch**: `feat/group/service-item-chips`
- **Scope**:
  - Update `src/renderer/src/prep/service/ItemArrangement.tsx`:
    - Chip strip displays one chip per group occurrence
      (`arrangement.groups: SongGroupId[]`).
    - Chip displays group name in label color; unnamed groups display "이름표
      없음" and source position.
    - Dragging chips reorders group occurrences via `useChipDrag`.
    - Keyboard Alt+← / Alt+→ moves selected chip.
    - Delete key removes group occurrence from arrangement.
    - "그룹 넣기" menu lists song's groups in master order and appends chosen
      group.
    - Read-only tooltip on 기본: `기본 구성은 변경할 수 없습니다`.
  - Update `src/renderer/src/prep/service/songItemModel.ts`: group-based chips,
    position calculations, and item preview drawing.
  - Update `src/renderer/src/prep/service/serviceItemStore.ts`:
    `setOrder(groups: SongGroupId[])` saves updated arrangement in song
    document.
- **Paths changed**:
  - `src/renderer/src/prep/service/ItemArrangement.tsx`
  - `src/renderer/src/prep/service/songItemModel.ts`
  - `src/renderer/src/prep/service/serviceItemStore.ts`
  - `src/renderer/src/prep/service/useChipDrag.ts`
  - `src/renderer/src/prep/service/SongItemPanel.tsx`
  - Tests: `src/renderer/src/prep/service/ItemArrangement.test.tsx`,
    `src/renderer/src/prep/service/songItemModel.test.ts`,
    `src/renderer/src/prep/service/serviceItemStore.test.ts`,
    `src/renderer/src/prep/service/SongItemPanel.test.tsx`
- **Estimated lines**: ~590 lines.

---

### Request `group-8`: Text Import Group Drafts, End-to-End Verification, & Real-App Offscreen Checks

- **Owner**: `prep` / `shell`
- **Branch**: `feat/group/import-and-verify`
- **Scope**:
  - Update `src/main/import/convert.ts` and
    `src/renderer/src/prep/import/TextImportFlow.tsx` / `TextImportDialog.tsx`:
    text import generates grouped song structures with bracketed labels as
    groups.
  - Integration checks across `ServiceOrderList` and `SlidePanel`.
  - End-to-end offscreen CDP verification script:
    - Real app started with `LLP_TEST_WINDOWS=offscreen`, dev port 5194, app
      data `D:\llp-dev\group`.
    - Exercise: load legacy v1 song, verify group migration, edit text, verify
      Backspace refusal on group boundary, change label to split group, edit
      arrangement chip strip in service item panel, output slides in 진행 with
      hotkey navigation.
    - Capture screenshots and record flat DOM/element count across repeated
      runs.
- **Paths changed**:
  - `src/main/import/convert.ts`
  - `src/renderer/src/prep/import/TextImportFlow.tsx`
  - `src/renderer/src/prep/import/TextImportDialog.tsx`
  - `docs/reviews/group-8.md` ("Checked in the app" section with screenshots)
  - Tests: `src/main/import/convert.test.ts`,
    `src/renderer/src/prep/import/TextImportFlow.test.tsx`
- **Estimated lines**: ~530 lines.

## 5. Open Questions for the Lead

Per the workflow guidelines, the following questions are raised for the lead's
decision:

1. **Per-Slide Hotkey Assignment UI in the Song Editor**:
   - _Context_: `docs/spec/02-data.md` and `data-83` define stored `hotKey` on
     `groups[].slides[].hotKey` (`KeyA`..`KeyZ`, `Digit0`..`Digit9`) and
     `docs/decisions.md` states "A label hot key goes to that particular slide."
     However, `docs/spec/05-prep.md` does not specify the UI mechanism for an
     operator to assign or clear a hot key on an individual slide block.
   - _Options_: (a) Add a small hotkey button/badge next to the slide number in
     `SongBlock`, which opens a key-press capture popover or context menu item
     ("단축키 지정 / 삭제"). (b) Include "바로 가기 키 설정" inside the slide
     block's context menu. (c) Defer the editor hotkey assignment UI to M4
     (shortcuts milestone), while keeping storage and playback projection active
     for imported/assigned songs.
   - _Recommendation_: Option (c) for this vertical slice, or (b) if immediate
     operator assignment is required.

2. **Text Import Draft Schema (`songImportDraftSchema`)**:
   - _Context_: Text import creates `songImportDraft` validated by
     `songImportDraftSchema`. `src/main/import/convert.ts` parses bracket
     headers `[1절]`, `[후렴]`.
   - _Options_: (a) Keep `songImportDraft` using slides/labels on the wire, and
     have `ContentStore.importSong` automatically convert the draft into
     `GroupedSong` via `migrateSongGroups`. (b) Update `songImportDraftSchema`
     directly to carry `groups`.
   - _Recommendation_: Option (a) in `group-3`, then optionally (b) in
     `group-8`. Option (a) avoids breaking existing import consumers during the
     rollout.

3. **Unnamed Group Label Display in Chip Strip**:
   - _Context_: Spec 05 states "unnamed groups show 이름표 없음 and their source
     position."
   - _Options_: (a) Chip text reads `이름표 없음 (그룹 N)`. (b) Chip text reads
     `그룹 N` with tooltip `이름표 없음`.
   - _Recommendation_: Option (b) for clean layout within the chip width
     constraint.
