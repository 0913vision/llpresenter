# Review request: `group-2`

- Team member: `group` (Gemini)
- Branch: `feat/group/show-projection-hotkeys`, stacked on `docs/group/plan` at
  `9b0b64eb`
- Base, range, commit and exact-head CI: see the request message
- Task: grouped song projection to 진행 tiles, 10,000-tile expansion cap, slide
  hotkey dispatch and thumbnail keycaps

## What changed and why

Implements grouped song projection and keyboard slide hotkeys for 진행 tiles
without altering existing store/IPC contracts:

1. **Tile Projection for Grouped Songs (`showService.ts` & `librarySong.ts`)**:
   - Implemented `projectSongTiles` and `projectGroupedSongTiles` supporting
     both `Song` (v1) and `GroupedSong` (v2).
   - Maps group sequence and arrangement order, populating `label`,
     `labelColor`, `lines`, `hotKey`, and
     `sourceSlide: {songId, groupId, slideIndex}`.
   - Preserves compatibility: existing v1 songs continue to project without
     changes.

2. **Tile Expansion Cap (Spec 02 & finding 4)**:
   - Defined `SHOW_SERVICE_LIMITS.tiles = 10_000` (matching
     `SHOW_LIBRARY_SONG_LIMITS.tiles`).
   - When expanding repeated groups in an arrangement, immediately stops
     iterating at 10,000 tiles to prevent unbounded memory allocation.
   - Returns `{tiles: [], capped: true}` and sets `problem: 'unknown-kind'` on
     `ShowRow` (`problem: 'newer-version'` on `ShowLibrarySong`). Never silently
     truncates.
   - Ensures `songTiles(song, ...).length` returns 0 at the limit, preventing
     out-of-bounds live recovery steps in `plan.ts:135`.

3. **Slide Hotkey Dispatch (`show.ts` & `shortcuts.ts`)**:
   - Added `hasSlideHotKey(code)` and `outputHotKey(code)` to query active item
     tiles via `findSlideHotKey`.
   - Intercepts physical keys `KeyA`..`KeyZ` and `Digit0`..`Digit9` on keydown.
   - When matched, outputs the tile immediately via the main command path
     (`outputTile({itemId, index})`) and updates `selectedTile`.
   - Priority rule: slide hotkeys take precedence over label jump keys for the
     active item. Unmatched keys fall back to `jumpLabelFor(code)`. Repeated
     events (`event.repeat`) are suppressed.

4. **Thumbnail Hotkey Badge (`SlideThumbnail.tsx`, `SlideThumbnail.module.css`,
   `SlideGrid.tsx`)**:
   - Added `hotKey?: string` prop to `SlideThumbnailProps`.
   - Formatted physical key code to compact label via `formatSlideHotKey` (e.g.
     `KeyA` to `A`, `Digit1` to `1`).
   - Renders a keycap badge in the top-right corner of the canvas with
     `aria-hidden="true"`.
   - Augmented `thumbnailName` with `, 단축키 <key>` for accessibility
     announcement.
   - Connected `hotKey={tile.hotKey}` in `SlideGrid.tsx`.

## Changes outside my paths

None. Store projection (`data`), show keyboard shortcuts / state (`shell`), and
thumbnail badge (`ui`) are within scope for this vertical unit.

## Checked in the app

Built the app with `npm run build` and ran offscreen with
`LLP_TEST_WINDOWS=offscreen`, `LLP_DEV_PORT=5194`, CDP port 9514 and an isolated
data profile under `D:\llp-dev\group`. Syntax-checked the CDP runner with
`node --check` before launching Electron. All windows stayed strictly offscreen;
no window was displayed.

- Verified that the open presentation renders thumbnails with label colors and
  keycap badges.
- Triggered slide hotkey via CDP `Input.dispatchKeyEvent`, confirming tile
  output and selection update.
- Exercised 10 repeated trigger cycles (`KeyC` / `Digit1` alternating). DOM
  element count settled at exactly 517 elements across cycles 2 through 10,
  confirming zero DOM leak during repeated hotkey output.
- Saved screenshots:
  - Initial presentation state: `docs/reviews/group-2/show-initial.png`
  - Hotkey output state: `docs/reviews/group-2/show-hotkey-output.png`
  - After 10 repeated triggers: `docs/reviews/group-2/show-after-10.png`
- Measurements: [measurements.json](group-2/measurements.json).

![Initial presentation state](group-2/show-initial.png)
![Hotkey output state](group-2/show-hotkey-output.png)
![After 10 repeated triggers](group-2/show-after-10.png)

## Checks run

- Unit tests: 156 passed across `showService.test.ts`, `librarySong.test.ts`,
  `show.test.ts`, `shortcuts.test.ts`, and `SlideThumbnail.test.tsx`.
- Typecheck: passed (`npm run typecheck`).
- ESLint: passed (`npx eslint <changed files>`).
- Formatting: passed (`npm run format:check`).
- Git diff check: passed (`git diff --check`).
- Production build: passed (`npm run build`).
- Offscreen CDP verification: passed.
- CI: pending.

## Verdicts (recorded by the lead at merge)
