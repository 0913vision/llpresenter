# Stage appearance and item background regression plan

Use invented content in a separate QA data folder. Keep automated windows
offscreen and muted. Output a non-final song slide before checking stage text.

## Stage box appearance

Select the current-lyrics element of an assigned stage layout. Set its text
weight and size before changing its box appearance.

| Case             | Steps                                                                            | Expected                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Property tabs    | Switch between text and appearance properties, then reopen the selected element. | Both tabs retain their saved values and selection.                                                                    |
| Color commit     | Enter a valid lowercase hex color and commit it.                                 | The saved color is normalized and the stage renderer uses it.                                                         |
| Invalid color    | Commit an incomplete hex color, then cancel a different valid draft with Escape. | Both actions preserve the last saved color.                                                                           |
| Opacity range    | Commit values above 100 and below zero, then 35.                                 | Values clamp to 100 and zero; 35 is stored as 0.35.                                                                   |
| Background alpha | Inspect the stage output after applying color and opacity.                       | The background uses the chosen alpha without fading the text or its container.                                        |
| Clear background | Empty the color field and commit.                                                | The background property is removed and output becomes transparent; opacity, text style and unknown box fields remain. |
| Navigation       | Leave and return to screen settings after clearing the color.                    | The color remains empty, opacity remains 35, and the live slide is unchanged.                                         |

## Service item background scope

Use two occurrences of the same library song, with a default media background.
Keep the library song unchanged throughout these cases.

| Case                | Steps                                                                       | Expected                                                                                                        |
| ------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Scope hint          | Hover the item's background selector before editing.                        | The hint identifies item-only scope and immediate application for the live item; hovering writes nothing.       |
| Live item           | Output the first occurrence, then choose another background for it.         | Its override and live background change immediately; the other occurrence and library song keep their defaults. |
| Non-live item       | Select the other occurrence without outputting it, then choose an override. | Only that occurrence changes; the live background and first occurrence remain unchanged.                        |
| Reset non-live item | Choose the song-default option for the non-live occurrence.                 | Its override is removed without changing live output.                                                           |
| Reset live item     | Choose the song-default option for the live occurrence.                     | Its override is removed and the song's default media returns immediately without changing the slide.            |

An item with no effective background keeps the current background under the
output specification. Resetting an override does not imply clearing that layer.

## Linked timer name contract

Keep these checks separate from operator signoff until a timer-definition rename
control is connected. Prepare duplicate quick-row references while the quick
panel is unmounted so legacy reference separation cannot alter the fixture.

| Case              | Steps                                                                                                             | Expected                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Linked rename     | Rename a paused, stage-selected definition through validated settings IPC, with three quick rows referring to it. | The trimmed name reaches the definition and all linked rows; unrelated rows and unknown fields remain. |
| Runtime isolation | Compare the paused run, stage selection and live layers before and after the rename.                              | Their identities and state remain unchanged.                                                           |
| Invalid request   | Submit a blank name and a missing timer ID.                                                                       | Both are rejected without modifying either settings document.                                          |
| No-op             | Submit the already saved name.                                                                                    | Neither document's value or revision changes.                                                          |

Sources: [output background rules](../../spec/03-output.md),
[service item properties](../../spec/05-prep.md),
[screen properties](../../spec/06-settings.md), and the validated timer rename
contract in `src/shared/schema/timerEdit.ts`.
