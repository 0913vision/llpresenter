# Look and reference regression plan

Use invented content and a separate QA data folder. This plan defines repeatable
acceptance checks; private run evidence is kept separately. Native display
behavior requires an operator with a real second screen.

## Look controls and shared styles

| Case                   | Steps                                                                                          | Expected                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Per-screen layers      | Select a Look, disable the main screen's slide layer, then enable it.                          | Only that screen card changes; its preview follows the saved switches.                              |
| Shared size            | Edit lyric size, then leave the workspace while the field has focus. Return to the same style. | The committed size survives navigation.                                                             |
| Valid color            | Enter a lowercase six-digit hex color and commit.                                              | The stored color is normalized and the preview uses it.                                             |
| Invalid color          | Enter an incomplete hex color, then leave the field.                                           | Validation explains the problem and preserves the previous valid color.                             |
| Independent properties | Change line spacing, maximum lines, margin and outline in succession.                          | Every committed field survives; later changes preserve earlier ones.                                |
| Preset creation        | Create a style from the selected preset.                                                       | A distinct preset copies its properties without changing screen assignments.                        |
| Preset rename          | Open the style menu and rename its preset.                                                     | The field retains focus until the operator commits or cancels.                                      |
| Preset assignment      | Assign the new preset through a screen card's style menu.                                      | That screen references the selected preset. Merely selecting a style editor tab does not assign it. |
| Used preset deletion   | Open the menu of a preset referenced by a Look.                                                | Delete is unavailable with a reason.                                                                |
| Unused preset deletion | Delete a preset with no references.                                                            | The preset disappears without changing unrelated assignments.                                       |
| Repeated navigation    | Alternate style edits with visits to Show and Prep.                                            | Each edit persists; no obsolete dialog or preview remains on return.                                |

## Screen creation and output groups

| Case                | Steps                                                      | Expected                                                                                                 |
| ------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Audience fullscreen | Create an audience screen with the fullscreen method.      | The screen starts unassigned and always-on-top is explicitly off.                                        |
| Stage window        | Create a stage screen with the window method.              | The new stage row and its properties become selected after the save completes.                           |
| Capture screen      | Create an audience capture screen.                         | The capture method and its default resolution are saved.                                                 |
| Audience group      | Toggle the audience group's local outputs on and off.      | Audience records change together; stage records retain their state.                                      |
| Stage group         | Toggle stage outputs independently.                        | Stage records change together; audience records retain their state.                                      |
| Unassigned output   | Turn on an unassigned fullscreen screen.                   | Missing assignment remains visible; an enabled state alone does not establish successful display output. |
| Native placement    | Assign a real second screen and operate its output window. | The user confirms placement, stacking, focus and desktop reveal.                                         |

## Clear keys

| Case                 | Steps                                                                                               | Expected                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Slide and media      | Output a non-final song slide with a background. Clear and restore each layer with its key.         | The same content returns; restored transport resumes from its retained position.                                       |
| Other layers         | Prepare an invented prop, muted audio, message and notice. Clear and restore each with its own key. | Each layer returns without replacing unrelated layers.                                                                 |
| Independent captures | Clear slide and media separately, then restore slide before media.                                  | Each key restores only its own captured layer.                                                                         |
| New content          | Clear a slide, send new output content, then press the same clear key.                              | Old slide content is not resurrected.                                                                                  |
| Held key             | Hold a clear key long enough to repeat.                                                             | Repeats do not undo the initial clear.                                                                                 |
| Output-window keys   | Click a real output window and use clear/navigation keys.                                           | Commands reach the control workflow without raising or focusing the control window. This requires native confirmation. |

## Bible fields and imported drafts

| Case                  | Steps                                                                                                                                  | Expected                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Ambiguous book        | Enter a prefix matching several books and choose one with the arrow keys. Press Tab.                                                   | The explicit candidate completes; a valid installed book advances to chapter. |
| Unavailable candidate | With a sample translation that omits a candidate, choose it from ambiguous suggestions and press Tab. Repeat with its exact full name. | Both paths keep focus in the book field and identify the unavailable book.    |
| Invalid insertion     | Enter an unavailable book or verse in Prep's Bible dialog.                                                                             | Add stays unavailable and live output remains unchanged.                      |
| Draft save shortcut   | Import invented text, choose Edit, and press Ctrl S from both title and body.                                                          | The valid draft saves through the imported-editor save exception.             |
| Draft save control    | Repeat the import and click Save.                                                                                                      | The song enters the library with its intended slide count.                    |

## Layout and legacy compatibility

| Case                 | Steps                                                                                                  | Expected                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Saved-open media bin | Explicitly open the bin, resize to the minimum supported window, restart, and revisit both workspaces. | The saved choice remains open and the upper workspace retains its specified minimum.           |
| App zoom             | Increase app zoom until the two workspace rows no longer fit.                                          | Work-area scrolling keeps both rows reachable without moving the outer bars.                   |
| Large window         | Expand the control window substantially.                                                               | The bin respects its maximum height instead of consuming the extra space.                      |
| Named arrangement    | Create a named copy, move a chip, remove it and insert another.                                        | The saved song reflects the new order; live output does not change merely from Prep selection. |
| Empty legacy order   | Remove every chip from a named legacy arrangement.                                                     | The empty strip and intentional legacy thumbnail fallback remain consistent.                   |
| Default order        | Select the default arrangement and attempt a chip edit.                                                | Editing is unavailable with the default-order reason.                                          |

Sources: [Show behavior](../../spec/04-show.md),
[Prep behavior](../../spec/05-prep.md),
[screen settings](../../spec/06-settings.md), and
[shortcuts](../../spec/10-shortcuts-and-settings.md).
