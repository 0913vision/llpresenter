# Smart guides

Temporary alignment lines for moving and resizing elements in the 무대 화면
layout editor. This is the design contract for M3-O3, before editor behavior is
implemented. It follows the user's decision in `docs/decisions.md`, not a
verified ProPresenter behavior.

## Tokens and coordinates

| Token | Value | Meaning |
| --- | --- | --- |
| `guide` | Alias of `accent` | Alignment line color; no new status color |
| `size-guide-line` | 1px | Solid line width in viewport CSS pixels |
| `size-guide-snap` | 6px | Inclusive distance to acquire an alignment |

Measure the distance after applying canvas zoom, in CSS pixels, not output
pixels or physical display pixels. At zoom `z`, the document-space threshold
is `6 / z`: 12 units at 50%, 6 at 100%, 3 at 200%. Draw the line in an unscaled
overlay so it remains 1 CSS pixel wide at each zoom. Windows display scaling
uses the same CSS-pixel convention as Layout.

## Geometry and states

- Match left/center/right and top/center/bottom anchors of the moving or resized
  rectangle to the canvas and other eligible element rectangles. Exclude the
  manipulated elements themselves. Resizing follows the moving edge; preserve
  the opposite edge. Acquisition is within `size-guide-snap`, including 6px.
- Resolve each axis independently. Show only the chosen match on each axis,
  at most one vertical and one horizontal line. Use the nearest match; keep tie
  resolution stable rather than flickering between equal candidates.
- Extend each line across the canvas, clipped at its bounds, above the element
  artwork. Use a solid `guide` stroke. Keep selection outlines and resize
  handles above the guides. A canvas-edge guide is inset within the clipped
  edge so its full stroke remains visible.
- Outside the snap distance, show no line. At pointer release, cancellation,
  selection change or Alt bypass, remove the lines at once. Alt suppresses
  smart-guide snapping while held during the drag. Releasing it resumes guide
  eligibility at the current pointer position.
- `격자에 맞추기` remains a separate 20px document grid. If a guide and grid
  both match on an axis, the guide wins there; the other axis may still use the
  grid. The grid option does not turn off smart guides.

## Appearance and lifecycle

No arrowheads, dots, distance badges, text, shadows or animation. Appearance,
movement and removal are immediate, also under reduced motion. Do not fade a
line after the pointer leaves its match. The different geometry distinguishes
the one-pixel alignment line from the thicker selection outline.

Guides are editor decoration: `aria-hidden="true"`, no role, no Tab stop and
`pointer-events: none`. They must never intercept a drag or enter the saved
layout, preview/output frame, thumbnail or export. Their overlay is bounded to
two lines and releases pointer/key listeners when the gesture or editor ends.

## Gallery

The reference card shows a canvas edge, another element's edge, both canvas
centers, a resize edge, outside-range idle and Alt bypass. Coordinates are
schematic static states, not a working stage editor or a snapping simulation.
M3-O3 must exercise real dragging, resizing, zoom and Alt in its own request.
