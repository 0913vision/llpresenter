# Review request: `group-2` (round 2)

- Team member: `group` (Gemini)
- Branch: `feat/group/show-projection-hotkeys`, stacked on `docs/group/plan` at
  `dfcfbb9b`
- Base commit: `dfcfbb9b`
- Task: grouped song projection to 진행 tiles, 10,000-tile expansion cap, slide
  hotkey dispatch and thumbnail keycaps
- CI: pending.

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

2. **Tile Expansion Cap & Boundary Validation (`showService.ts` schema &
   store)**:
   - Defined `SHOW_SERVICE_LIMITS = {tiles: 10_000}` in
     `src/shared/schema/showService.ts` (matching
     `SHOW_LIBRARY_SONG_LIMITS.tiles` in
     `src/shared/schema/showLibrarySong.ts`), capping tile arrays in
     `showServiceSchema` with `v.maxLength(SHOW_SERVICE_LIMITS.tiles)` for
     runtime boundary validation.
   - In `src/main/store/showService.ts`, checked
     `tiles.length >= SHOW_SERVICE_LIMITS.tiles` inside the iteration loop for
     both v1 and v2 branches, halting early and preventing large array
     allocations (finding 2).
   - When exceeding 10,000 tiles (tested at 10,001 tiles): emits empty tiles and
     marks `problem: 'unknown-kind'` on `ShowRow` (`problem: 'newer-version'` on
     `ShowLibrarySong`). Added `TODO(0913vision)` in `showService.ts` and
     `librarySong.ts` to switch to a dedicated typed row problem in `group-7`.
   - Tested that songs with exactly 10,000 tiles succeed without error or
     problem flag.

3. **Slide Hotkey Dispatch (`show.ts` & `shortcuts.ts`)**:
   - Added `hasSlideHotKey(code)` and `outputHotKey(code)` to query active item
     tiles via `findSlideHotKey`.
   - Intercepts physical keys `KeyA`..`KeyZ` and `Digit0`..`Digit9` on keydown.
   - When matched, outputs the tile immediately via the main command path
     (`outputTile({itemId, index})`) and updates `selectedTile`.
   - Priority rule: slide hotkeys take precedence over label jump keys for the
     active item. Unmatched keys fall back to `jumpLabelFor(code)`.
   - Verified and tested suppression rules: ignored when no item is open
     (`openItemId === null`), bypassed when modifier keys (Ctrl/Alt/Meta) are
     held, suppressed when focus is in a text input/textarea, and repeated
     keydown (`event.repeat === true`) ignored. Added 4 named tests in
     `shortcuts.test.ts`.

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

None. Shared schema (`data`), store projection (`data`), show keyboard shortcuts
/ state (`shell`), and thumbnail badge (`ui`) are within scope for this vertical
unit.

## Checked in the app

Built the app with `npm run build` and ran offscreen with
`LLP_TEST_WINDOWS=offscreen`, `LLP_DEV_PORT=5194`, CDP port 9514 and an isolated
data profile under `D:\llp-dev\group`. Syntax-checked the CDP runner with
`node --check` before launching Electron. All windows stayed strictly offscreen;
no window was displayed.

- Verified that the open presentation renders thumbnails with label colors and
  keycap badges (`A`, `C`, `1`) via presentation tiles carrying slide hotkeys
  (injected via renderer state `window.__llpShowStore.setState(...)`).
- Dispatched physical slide hotkey `KeyC` via CDP `Input.dispatchKeyEvent`,
  confirming that the `hasSlideHotKey` / `outputHotKey` path fired, outputting
  Tile 1 ('후렴') to live and updating selection to Tile 1.
- Exercised 10 repeated trigger cycles (`KeyA` / `KeyC` alternating). Measured:
  - Thumbnail DOM node count (`button[role='option']`): flat at exactly 3
    throughout all cycles.
  - Total DOM element count: flat at exactly 533 elements across cycles 1
    through 10, confirming zero DOM leak during repeated hotkey output.
- Saved screenshots:
  - Initial presentation state (with keycap badges):
    `docs/reviews/group-2/show-initial.png`
  - Hotkey output state (Tile 1 selected & live):
    `docs/reviews/group-2/show-hotkey-output.png`
  - After 10 repeated triggers: `docs/reviews/group-2/show-after-10.png`
- Measurements: [measurements.json](group-2/measurements.json).

![Initial presentation state with keycap badges](group-2/show-initial.png)
![Hotkey output state](group-2/show-hotkey-output.png)
![After 10 repeated triggers](group-2/show-after-10.png)

## Checks run

- Unit tests: 180 passed across `showService.test.ts` (schema & store),
  `librarySong.test.ts`, `show.test.ts`, `shortcuts.test.ts`, and
  `SlideThumbnail.test.tsx`.
- Typecheck: passed (`npm run typecheck`).
- ESLint: passed (`npx eslint <changed files>`).
- Formatting: passed (`npm run format:check`).
- Git diff check: passed (`git diff --check`).
- Production build: passed (`npm run build`).
- Offscreen CDP verification: passed with screenshots and measurements.
- CI: pending.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: reviewer (round 1)

- Verdict: Request changes
- Findings:

  1. docs/reviews/group-2.md:46-59 The "Checked in the app" section states that
     the open presentation renders thumbnails with keycap badges and that slide
     hotkeys were triggered. However, the open song in all three screenshots
     (show-initial.png, show-hotkey-output.png, show-after-10.png) is the
     default v1 song ("만복의 근원 하나님"), which has no slide hotkeys.
     Consequently, no keycap badges are visible on any thumbnail, and the CDP
     keypresses (KeyC / Digit1) exercised the legacy jumpLabelFor fallback
     rather than the new hasSlideHotKey/outputHotKey path. Capture offscreen
     screenshots with presentation tiles that carry hotKey assignments (e.g.
     injected via renderer state or a presentation with slide hotkeys) so the
     keycap badge appearance can be inspected against the design system and
     hotkey dispatch is verified.
  2. src/main/store/showService.ts:166-173 Nit: In projectSongTiles, the v1
     branch executes playbackOrder(song, arrangement).flatMap(...) over all
     slide numbers before checking if tiles.length > SHOW_SERVICE_LIMITS.tiles,
     allocating an unbounded array when expanding an oversized arrangement.
     Check the length limit inside the loop and halt iteration early (as
     projectGroupedSongTiles does) to avoid large allocations.

## Team member's reply (round 2)

1. Reran offscreen CDP verification with presentation tiles carrying slide
   hotkeys (`KeyA`, `KeyC`, `Digit1`) injected via renderer state
   (`window.__llpShowStore.setState(...)`). Captured new screenshots showing the
   keycap badges rendered clearly on the thumbnails (`A`, `C`, `1`), verified
   physical hotkey dispatch (`KeyC` outputting Tile 1 '후렴'), and recorded flat
   element counts (thumbnail count flat at 3, total elements flat at 533) across
   10 repeated trigger cycles in `measurements.json`.
2. Updated `projectSongTiles` v1 branch in `src/main/store/showService.ts` to
   check `tiles.length >= SHOW_SERVICE_LIMITS.tiles` inside the loop, halting
   iteration early and preventing large array allocations. Also updated
   `src/shared/schema/showService.ts` defining
   `SHOW_SERVICE_LIMITS = {tiles: 10_000}` and capping `showServiceSchema.tiles`
   with `v.maxLength(SHOW_SERVICE_LIMITS.tiles)`. Added boundary tests covering
   both exactly 10,000 tiles and 10,001 tiles for both v1 and v2 songs in
   `showService.test.ts`.

## Verdicts (recorded by the lead at merge)
