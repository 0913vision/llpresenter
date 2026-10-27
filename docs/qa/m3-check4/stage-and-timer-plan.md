# Stage canvas and timer controls regression plan

Use invented song content and a separate QA data folder. Keep automated windows
offscreen and audio muted. Output-state and renderer checks do not establish
native monitor placement, focus, stacking or audible playback.

## Timer tab

| Case              | Steps                                                                         | Expected                                                                                  |
| ----------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Cancel creation   | Open the timer tab's Add dialog and cancel it twice.                          | No definition or quick-run row is created.                                                |
| Create countdown  | Add a short countdown with Stop After Zero selected.                          | A uniquely named definition appears without adding an unsolicited quick-run row.          |
| Pause and resume  | Start the new row, pause it, wait, then resume it.                            | The paused reading stays fixed; resume continues its own run.                             |
| Finish and reset  | Let that countdown finish, then use Reset.                                    | It holds at zero when complete; reset restores its configured duration and stopped state. |
| All kinds         | Provide countdown, countdown-to, elapsed, elapsed-from and clock definitions. | Each row has the correct kind and reading; a clock has no start, pause or reset controls. |
| Definition limit  | Prepare 500 definitions through validated settings.                           | Add is disabled with a reason. Only the viewport's rows and overscan are mounted.         |
| Distant row       | Use End to reach the last definition, start it, then use Home.                | Focus reaches the correct row after scrolling; its controls target its own timer.         |
| Removal isolation | Start a second definition, then remove it while the distant timer runs.       | The removed run disappears and the unrelated run remains unchanged.                       |
| Output isolation  | Compare live layers around these timer operations.                            | Timer controls do not replace slide, media or overlay content.                            |

## Stage canvas geometry

These cases cover the mounted canvas controls. They do not establish delivery of
the full proposed text-property, numeric-geometry or snapping interfaces.

| Case                | Steps                                                                                                                 | Expected                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| New layout          | Create a layout from Screen Settings.                                                                                 | A distinct empty 1920 x 1080 layout becomes selected.                                                                            |
| Add element         | Add Current Lyrics and select its canvas element.                                                                     | The element is saved and shows eight resize handles.                                                                             |
| Keyboard movement   | Press an arrow, Shift Arrow, then several separate arrows quickly.                                                    | Movements use 1 px and 10 px steps; queued edits retain every accepted movement.                                                 |
| Cancel drag         | Move an element with the pointer, press Escape and release.                                                           | The draft is discarded and saved geometry remains unchanged.                                                                     |
| Commit drag         | Move an element and inspect settings before and after releasing.                                                      | Movement is local during the gesture and saves at release.                                                                       |
| Resize              | Drag a corner handle.                                                                                                 | The intended width and height change without moving unrelated elements.                                                          |
| Reopen              | Leave Screen Settings, return and select the same layout.                                                             | Its saved geometry remains intact.                                                                                               |
| Delete selected     | Select an element and press Delete.                                                                                   | Only that element is removed.                                                                                                    |
| Other kind          | Add a clock through the element-kind menu.                                                                            | The new element has the selected kind and a clock preview.                                                                       |
| Live geometry       | First output a non-final song slide. Open its assigned stage layout, enable the stage output and move Current Lyrics. | Current and next lyrics are present; the output renderer follows the saved geometry immediately without changing the live slide. |
| Navigation lifetime | Repeatedly alternate Show and the selected stage canvas, including warm repetitions.                                  | No stale canvas or dialog remains, retained views and handlers stay bounded, and output remains unchanged.                       |

## Screen rows and save warnings

When a valid stage layout is still loading, avoid reporting it as missing. After
loading settles, a genuinely unavailable layout must still report its problem.
Exercise this ordering separately from a failed settings write.

| Case                     | Steps                                                                                              | Expected                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Rename validation        | Create a window screen, open its row menu and try an empty name and another screen's name.         | Both drafts remain invalid without saving.                                                                |
| Commit and cancel        | Commit a distinct name, then begin another rename and cancel.                                      | The valid name persists; cancellation restores it.                                                        |
| Cancel active deletion   | Enable the audience outputs, request deletion of the new screen, then cancel.                      | The screen definition and its output remain.                                                              |
| Confirm active deletion  | Reopen that confirmation and delete the screen.                                                    | Its definition, active output and output window disappear; unrelated audience outputs retain their state. |
| Warning after navigation | Open a Look editor, select a screen instead, then inject a failed Look-list save and use New Look. | A visible save warning reaches the operator and the last good Look settings remain.                       |

Restore injected failures before continuing. Real screen placement and desktop
behavior remain separate checks on a physical display.

Sources: [timer behavior](../../spec/04-show.md),
[screen and stage editing](../../spec/06-settings.md),
[output behavior](../../spec/03-output.md), and
[data contracts](../../spec/02-data.md).
