# Layout

The layout rules that set the size classes of the main window (narrow window, regular window, wide window) and the column widths, bar heights, and defaults that follow from them. This isn't a reusable widget. It is the document to follow when you build the app shell.

## Where to use

- The whole layout of the 진행 (Show), 준비 (Prep), and 화면 설정 (Screen settings) workspaces in the main window (menu bar, toolbar, left, center, and right columns, status bar).
- Size limits for dialogs and menus that are larger than the window.

## Where not to use

- Output windows (본 화면 (main screen), 무대 화면 (stage screen), 방송 자막 (broadcast captions)): separate windows that open at the native resolution of their display. They don't follow these rules.
- Layout inside a panel: follow the document of each component, such as Panel, SlideThumbnail, and PreviewFrame.

## Anatomy

All values are CSS pixels after Windows display scaling (the same as Electron DIPs). A 1920×1080 screen at 125% is 1536×864 CSS pixels, and at 150% it is 1280×720.

- Minimum window: `window-min-width` 1280 × `window-min-height` 720.
- From top to bottom: menu bar `size-menubar` (30), toolbar (regular window `size-toolbar` 56, narrow window `size-toolbar-compact` 40), work area, status bar `size-statusbar` (28). The background of the gaps between bars and panels is `bg-app`.
- Work area: an upper row with left, center and right workspace columns, followed by the shared 미디어 bin when open. The bin spans all three columns in 진행 and 준비. Gaps at the window edges, between columns, between the two rows and between panels are `panel-gap` (4). Don't put a gap above or below the work area.
- Left column: 예배 순서 (service order) (remaining height) + 퀵 실행 (quick launch) (content height). In the 준비 workspace: 예배 순서 + library.
- Center column: all remaining width, minimum 560. The 슬라이드 panel or 준비 source/item editor fills the upper row's height. The shared bin does not occupy the center column or replace the editor.
- Right column: preview (content height) + 지우기 (clear) (content height) + 진행 도구 (show tools) (remaining height, minimum 240).
- If the height runs short and the 진행 도구 would get smaller than 240, the preview panel shrinks. The large preview keeps 16:9, gets smaller to fit the height, and is centered. With the bin closed at 1280×720, this gives preview 306, 지우기 68, and 진행 도구 240, including two 4px gaps. With the bin open, reserve the upper row as defined below; preview content scrolls when its other controls cannot fit.

## Shared media bin height

The October 26 shared-bin decision replaces the former 170px center-column
strip. The same height allocation applies in 진행 and 준비. The upper editor,
workspace preview and lists remain mounted and usable above the bin.

- Let `H` be the visible work-area height in CSS pixels, after subtracting the
  current menu bar, toolbar and status bar heights from the content viewport.
  The open bin adds one `panel-gap` (`G`, currently 4px) between the two rows.
- Reserve `workspace-upper-min-height = 440px` for the upper row. This includes
  진행 도구 at 240px, the narrow clear row at 68px, two 4px gaps and at least
  124px for the workspace preview panel, including its header. 준비 uses the
  same reservation for its editor, source lists and preview.
- The bin's minimum is `media-bin-min-height = 168px`. Its preferred maximum
  is twice `size-media-strip-tile`, currently 300px. These are complete row
  heights, including panel headers and footers, not content heights.
- If `H >= 440 + G + 168`, allocate the bin
  `B = min(2 * size-media-strip-tile, 0.4 * H, H - G - 440)` and the upper row
  `U = H - G - B`. Do not let flex shrink reduce either allocated row. Closing
  the bin removes its row and gap, giving the work area to the upper row.
- If `H < 440 + G + 168`, keep the open bin at 168px and the upper row at
  440px. Give the work area a vertical scrollbar over that combined minimum
  height. Keep the menu bar, toolbar and status bar outside that scrolling
  region. Both rows remain reachable; never auto-close a saved-open bin or
  clip their controls to force them into the viewport. This also applies when
  app UI zoom reduces the available CSS viewport. When closed, the work area
  scrolls only if its upper row cannot fit its 440px minimum.
- Panel headers and footers do not scroll. Lists, virtual media grid, editor,
  properties and preview content scroll inside their own bounded bodies.
  A long playlist/property list cannot enlarge either row. The bin's media and
  audio playlist panels share its left column; audio takes its content height
  up to half that column, and both bodies scroll when needed. Fit the preview
  image proportionally inside its panel; scroll excess preview controls.

At 1280×720 and 100% app UI zoom, the narrow bars use 30 + 40 + 28px, so `H`
is 622px. A saved-open bin gets 178px, the inter-row gap gets 4px, and the upper
workspace keeps 440px. No work-area scrollbar is needed. At 1366×768 the same
calculation gives a 226px bin. At 1920×1080 with the regular 56px toolbar, the
bin reaches its 300px cap and leaves 662px above it. Smaller usable heights use
the scrolling fallback, preserving the saved visibility choice.

## Sizes and variants

| Class | Window width | Toolbar | Left | Right | Media bin default | 진행 도구 tabs | Small previews | 지우기 buttons | Default thumbnail columns |
|---|---|---|---|---|---|---|---|---|---|
| Narrow window | 1280–1599 | 40 `size-toolbar-compact` | 220 `col-left-compact` | 360 `col-right-compact` | Starts closed | 표시 중, 무대, 더 보기 | 64px rows | Icon only (모두 has a name) | 3 |
| Regular window | 1600–2399 | 56 `size-toolbar` | 280 `col-left` | 480 `col-right` | Open | All 8 | Two cells | Icon + name | 4 |
| Wide window | 2400 or more | 56 | 320 | 560 | Open | All 8 | Two cells | Icon + name | 6 |

The column widths of the wide window are `col-left-wide` (320) and `col-right-wide` (560), and the minimum center width is `col-center-min` (560). In the narrow window, "더 보기" (more) opens the remaining tabs (오디오, 타이머, 메시지, 공지, 소품, 매크로) as a menu.

| Screen | Scaling | CSS pixels | Class |
|---|---|---|---|
| 1366×768 | 100% | 1366×768 | Narrow window |
| 1920×1080 | 100% | 1920×1080 | Regular window |
| 1920×1080 | 125% | 1536×864 | Narrow window, height under 900 |
| 1920×1080 | 150% | 1280×720 | Narrow window, minimum size |
| 2560×1440 | 125% | 2048×1152 | Regular window |
| 2560×1440 | 100% | 2560×1440 | Wide window |
| 3840×2160 | 150% | 2560×1440 | Wide window |

## States

| State | What changes | Other |
|---|---|---|
| Shared media bin open / closed | Uses a full-width bottom row with the bounded height above / the upper workspace takes all work-area height | The toolbar 미디어 button controls visibility (`aria-pressed`), independently of 진행/준비 |
| Height under 900 DIP | The bin starts closed only when no choice is saved | A saved or explicitly opened choice stays open; allocate rows or scroll as above |
| 진행 도구 would go under 240 | The preview panel shrinks | See Anatomy above |
| Dragging a column width | Cursor `col-resize` | Save that width when the drag ends |

## Behavior

- The user drags the 4px gap between columns to change their widths. Left 200–400, right 320–720, and a column doesn't widen further once the center reaches 560.
- The size classes set only the defaults. Save the left and right widths that the user changes separately for each size class. When the window size crosses into another class, use the widths saved for that class (or the defaults if there are none).
- If shrinking the window would make the center smaller than 560, shrink the right column first and then the left column, down to the minimum of their ranges, on screen only (keep the saved widths). Even at the minimum window of 1280, left 200 + right 320 leaves 744 for the center, so it always fits.
- The default of the thumbnail size slider is the default column count of the size class. If the user changes it, save that value.
- Dialogs: keep the `dialog-s/m/l/xl` width tokens. If the window is narrower than the width + 32, width = window − 32. The maximum height is window − 64, and only the body scrolls (the header and footer stay fixed). With the current tokens, even the widest `dialog-xl` (1080) fits in the minimum window of 1280, so the width rule is for future sizes.
- Menus: the maximum height is window − 16. When a menu overflows, scroll inside it.
- Output windows use the display resolution as it is, regardless of the size class of the main window.

## Writing

- Don't show size class names ("좁은 창") on screen. Use them only in developer documents and in saved settings keys.
- The item names in the "더 보기" menu are the same as the tab names.

## Implementation notes

```ts
type SizeClass = 'narrow' | 'normal' | 'wide'
const sizeClass = (w: number): SizeClass => (w >= 2400 ? 'wide' : w >= 1600 ? 'normal' : 'narrow')
const defaults = {
  narrow: { toolbar: 40, left: 220, right: 360, mediaStrip: false, columns: 3 },
  normal: { toolbar: 56, left: 280, right: 480, mediaStrip: true, columns: 4 },
  wide:   { toolbar: 56, left: 320, right: 560, mediaStrip: true, columns: 6 },
}
const limits = { left: [200, 400], right: [320, 720], center: 560, toolsMin: 240 }
const heightDip = window.innerHeight * uiZoomFactor
const mediaStrip = settings.mediaStrip ?? (defaults[c].mediaStrip && heightDip >= 900)
// Save: settings.layout[c] = { left, right, columns }
```

- Give the Electron `BrowserWindow` `minWidth: 1280, minHeight: 720`.
- In the app shell, `<AppShell>` puts `data-size="narrow|normal|wide"` on the root and passes `--ll-col-left` and `--ll-col-right` through style. The toolbar, 지우기, 진행 도구, and preview read `data-size` and use the narrow window form (`ll-toolbar--compact`, `ll-clear-row--compact`, `ll-monitor--compact`).
- The diagram classes in this card (`ll-layout*`) are for documentation only. Don't move them into the app.

## Changes from the drafts

- Compact (1366×768): toolbar 44 → 40 (`size-toolbar-compact`), status bar 24 → 28, 진행 도구 tabs "표시 중, 무대, 메시지 + 더 보기" → "표시 중, 무대 + 더 보기".
- The historical ShowH/Problems center strip (220px in the drafts, later 170px)
  is superseded by the full-width shared bin and bounded allocation above.
