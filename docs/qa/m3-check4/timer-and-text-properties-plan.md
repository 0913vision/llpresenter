# Timer creation and text properties regression plan

Use invented content in a separate QA data folder. Keep automated windows
offscreen and muted. Compare stored values with the output renderer when testing
appearance; control selection alone does not establish output.

## Timer creation

| Case                  | Steps                                                                                                      | Expected                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Cancel different kind | Open Add Timer, select Date and Time, then cancel twice.                                                   | No definition is created and no quick-run row changes.                                                        |
| Countdown validation  | Try zero duration and seconds outside 0 through 59, then save a valid short duration with Stop After Zero. | Invalid values disable Add; the saved countdown has the chosen duration and overrun option.                   |
| Date and time         | Try an impossible calendar date and invalid 24-hour time, then save a valid future date and time.          | Invalid fields block Add; the complete date, time and overrun setting are stored.                             |
| Elapsed               | Select Elapsed, try a negative duration and then zero.                                                     | Negative values are blocked; zero is a valid start value.                                                     |
| Clock                 | Select Clock and save it.                                                                                  | Irrelevant duration fields disappear and the definition contains no countdown or elapsed configuration.       |
| Independent names     | Create each kind in succession.                                                                            | Distinct automatic names are used; creating definitions does not add unsolicited quick rows or change output. |

## Quick-row capacity and timer deletion contract

Prepare 200 runtime records through validated fixtures. Keep an unstarted
quick-row timer outside that set and a separate quick-row timer inside it.

| Case              | Steps                                                                                                                 | Expected                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Full capacity     | Try to start the unstarted quick-row timer.                                                                           | The row is disabled with a capacity reason and activation sends no start.                                               |
| Existing run      | At capacity, resume an existing paused quick timer and reset an existing running one.                                 | Both controls remain available because they do not require an additional run slot.                                      |
| Delete references | Provide two quick rows referencing a definition, then delete that definition through the validated settings contract. | The definition and all matching quick rows disappear together; unrelated quick rows and unknown document fields remain. |
| Reclaim runtime   | Delete a paused timer selected for the stage while an unrelated timer runs.                                           | The removed runtime record and stage selection clear; the unrelated run remains.                                        |
| Reuse capacity    | Return to the previously refused quick row after one slot is freed.                                                   | It becomes available and starts successfully.                                                                           |

Keep duplicate-reference fixtures outside the mounted quick panel so legacy
separation cannot change their identities during the contract test. When no
definition-delete control is mounted, contract coverage remains separate from
operator signoff.

## Stage element properties

Select an element in an assigned stage layout. Output a non-final song slide
before checking current or next lyric content.

| Case                   | Steps                                                                                                 | Expected                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Text fields            | Change name, font, weight, size, color, line height, horizontal and vertical alignment, and auto-fit. | Each saved field retains earlier edits and unknown document, layout, element and text fields. |
| Invalid color          | Commit an incomplete hex color, then a valid color.                                                   | Invalid input preserves the last saved color; valid input updates it.                         |
| Cancel custom font     | Enter a custom font draft and press Escape.                                                           | The previous font remains stored.                                                             |
| Navigation commit      | Type a new size, change workspace without pressing Enter, then return.                                | The size commits and the other text settings remain intact.                                   |
| Change kind            | Change the element from next lyrics to current lyrics.                                                | Its name and text style remain; its output content changes to the chosen kind.                |
| Output appearance      | Compare the live element's font, weight, size, color, alignment and line height with the saved style. | The output renderer reflects edits immediately.                                               |
| Selection only         | Click another element without moving or resizing it.                                                  | Selection changes without saving, changing the settings revision or reporting a save failure. |
| Delete from properties | Use the selected element's Delete control while stage output is enabled.                              | Only that element disappears; other elements and the main live slide remain.                  |

## Shared lyric style

| Case               | Steps                                                                          | Expected                                                                      |
| ------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Fractional spacing | Commit line height 1.45, press Arrow Up and Arrow Down, then reopen the style. | The step is 0.05 and 1.45 survives storage and navigation.                    |
| Weight             | Choose 400 in the weight menu and inspect an assigned audience output.         | Only the intended weight changes and the renderer uses it.                    |
| Bounds             | Enter values below and above the size, maximum-lines and margin ranges.        | Commits clamp to 12 through 300, 1 through 10, and 0 through 30 respectively. |
| Other fields       | Retain unknown style fields while changing weight and numeric properties.      | Unrelated stored values remain intact.                                        |

Sources: [Show timers](../../spec/04-show.md),
[screen and stage properties](../../spec/06-settings.md), and
[data contracts](../../spec/02-data.md).
