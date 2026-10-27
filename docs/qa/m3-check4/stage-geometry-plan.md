# Stage geometry regression plan

Use an isolated QA data folder and invented song content. Create a separate
layout for geometry experiments. Keep automated output windows hidden. Tests of
rendering and stored coordinates do not establish native screen placement.

## Numeric fields

| Case                | Steps                                                                        | Expected                                                                                       |
| ------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| No selection        | Create an empty stage layout and inspect X, Y, W and H.                      | Fields are read-only with a selection reason until an element is selected.                     |
| Independent edits   | Add an element and commit distinct X, Y, W and H values with ratio lock off. | Each edit saves reference-picture pixels and preserves the other fields.                       |
| Arrow increments    | Focus a position field and use an arrow, then Shift Arrow.                   | The field changes by 1 px and 10 px respectively without another canvas movement.              |
| Invalid draft       | Type an invalid number and commit, then try a valid draft and Escape.        | Both paths preserve the previously saved geometry.                                             |
| Mouse navigation    | Type a position draft and click another workspace tab, then return.          | The draft commits before the field unmounts.                                                   |
| Keyboard navigation | Repeat using Ctrl S and Ctrl E to leave Screen Settings.                     | The same focused draft commits before the workspace changes.                                   |
| Reference units     | Shrink the control window and edit a position numerically.                   | Saved coordinates remain in the layout's reference pixels; canvas zoom does not multiply them. |

## Aspect ratio and range

Start with a 600 x 300 element and a fixed origin. Compare saved geometry with
the visible field values after each operation settles.

| Case                   | Steps                                                                                              | Expected                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Locked width           | Enable ratio lock and change W.                                                                    | H changes proportionally; the origin remains fixed.                                               |
| Locked height          | Change H while the lock remains enabled.                                                           | W changes proportionally without drifting the origin.                                             |
| Minimum and maximum    | Enter dimensions near the control's limits while locked.                                           | The frame respects its permitted range and retains its ratio within pixel rounding.               |
| Unlocked range         | Disable the lock and enter positions and dimensions beyond their displayed ranges.                 | Each field clamps to its declared range without corrupting another field.                         |
| Pointer versus numeric | Reduce width with a handle, then request the same width through W from a different starting value. | Both input methods use a consistent permitted range and the field accurately declares that range. |
| No change              | Select an element without moving it or resize back to the original frame before release.           | No geometry write occurs.                                                                         |

## Pointer and output

| Case              | Steps                                                                                                | Expected                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Corner resize     | With ratio lock enabled, drag a corner handle.                                                       | Width and height change proportionally while the opposite corner remains fixed.                        |
| Side resize       | Drag a side handle while locked.                                                                     | The opposite edge and perpendicular center remain fixed, with the ratio preserved.                     |
| Cancel gesture    | Press Escape before releasing a locked resize.                                                       | The draft is discarded and the saved frame remains intact.                                             |
| Small window      | Repeat at the minimum supported control-window size.                                                 | Zoom changes the canvas presentation; coordinate conversion still uses the reference layout.           |
| Live numeric edit | Output a non-final song slide, enable its assigned stage output and commit numeric geometry changes. | The output renderer follows the saved frame while current and next content remain unchanged.           |
| Live locked edit  | Change a dimension with ratio lock enabled on that assigned layout.                                  | Both output dimensions follow the proportional frame immediately; live slide identity does not change. |

Wait for both the settings frame and field readout before comparing successive
gestures. A frame read before save completion is not a completed resize result.
When testing an input bound, type a value different from the current displayed
text so the test actually creates a numeric draft.

Sources: [stage editing](../../spec/06-settings.md),
[output rendering](../../spec/03-output.md), and
[keyboard behavior](../../spec/10-shortcuts-and-settings.md).
