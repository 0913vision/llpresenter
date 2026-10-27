# Stage grid gesture regression plan

Use invented song content in a separate QA data folder. Keep automated windows
offscreen and muted. Select an element in a 1920 x 1080 stage layout and compare
the saved frame with the numeric fields after each completed gesture.

## Grid and free movement

| Case            | Steps                                                                       | Expected                                                                                      |
| --------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Move            | Enable grid snapping and drag an element whose position is not on the grid. | The new X and Y align with the 20-pixel document grid; width and height remain unchanged.     |
| Eight handles   | With ratio locking off, resize separately with each corner and side handle. | Moving edges align with the grid; opposite edges remain fixed and dimensions remain positive. |
| Save on release | Inspect the stored layout while holding a moved pointer, then release it.   | The draft stays local until release; the final frame is saved once the gesture completes.     |
| Cancel          | Move a snapped draft, press Escape and release.                             | The saved frame and settings revision remain unchanged.                                       |
| Zero distance   | Press and release a resize handle without moving.                           | Merely selecting the handle does not snap or save the frame.                                  |
| Grid off        | Disable snapping and make a small pointer move.                             | The position follows document pixels without forcing a grid point.                            |
| Numeric scope   | Enable snapping and commit X as 241 in the numeric field.                   | Direct numeric entry retains 241; snapping applies to pointer gestures.                       |

Avoid exact half-grid boundaries when comparing scaled pointer coordinates, so
fractional device coordinates do not determine which neighboring point wins.

## Ratio, zoom and output

| Case              | Steps                                                                                     | Expected                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Width-led corner  | Lock a 2:1 element's ratio and drag a corner mostly horizontally.                         | The moving horizontal edge snaps and the height follows the ratio without freezing at the other grid axis. |
| Height-led corner | Repeat with a mostly vertical drag.                                                       | The moving vertical edge snaps and the width follows the ratio.                                            |
| Side anchor       | Resize the west side with the ratio locked.                                               | The right edge and vertical center remain fixed while the ratio stays 2:1.                                 |
| Smaller workspace | Repeat a grid move with the control window at 1280 x 720.                                 | Snapping still uses document pixels; the stored result matches the larger workspace.                       |
| Live geometry     | Output a non-final song slide, enable stage output and resize its current-lyrics element. | The renderer adopts the stored frame without replacing the live slide or dropping unknown element fields.  |

Native monitor placement, always-on-top behavior and physical display scaling
need separate user checks. Smart guides and snapping to other elements require
their own acceptance cases when those controls are connected.

Sources: [stage output](../../spec/03-output.md),
[stage layout settings](../../spec/06-settings.md), and the mounted stage grid
control in `src/renderer/src/screens/stage/StageFrameBar.tsx`.
