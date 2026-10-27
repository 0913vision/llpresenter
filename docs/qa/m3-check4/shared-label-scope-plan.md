# Shared label scope regression plan

Prepare at least two invented songs using the same label name. Give that label a
color and a jump key in the shared list. Use a separate QA data folder and keep
automated windows offscreen. Record song contents before changing shared
metadata so label operations can be distinguished from lyric edits.

## Color scope

| Case                    | Steps                                                            | Expected                                                                                          |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Explain before applying | Open the label picker from a song block and hover another color. | The tooltip identifies the color and says that it applies to all songs before any change is made. |
| Hover only              | Move between palette colors without selecting one.               | Shared metadata and song contents remain unchanged.                                               |
| Apply color             | Select the new color.                                            | The shared label stores that color; the songs retain their label names, lyrics and other content. |

## Rename scope

| Case              | Steps                                                                           | Expected                                                                                         |
| ----------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Identify target   | Open a shared label's row menu and choose Rename.                               | The dialog subtitle identifies the label being changed.                                          |
| Explain scope     | Hover the name field before saving a draft.                                     | The tooltip explains that this label is renamed in all songs.                                    |
| Cancel            | Enter a different name and cancel the dialog.                                   | No shared name or song content changes.                                                          |
| Commit            | Save a distinct valid name, then wait for both the dialog and editor to settle. | Every matching label reference in the songs changes; the open editor shows the new name.         |
| Retain other data | Compare affected songs and shared metadata after the rename.                    | Lyrics, ordering and unrelated content remain; the renamed label retains its color and jump key. |

Include a label with a jump key in these cases so key-cap content and nested
menus do not interfere with reaching its management actions.

## Delete scope

| Case            | Steps                                                                          | Expected                                                                            |
| --------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Identify effect | Request deletion of the shared label.                                          | The confirmation names the label and explains that labels in all songs remain.      |
| Explain action  | Hover the confirmation's Delete control.                                       | Its tooltip says that deletion affects the shared list while song labels are kept.  |
| Cancel          | Cancel the first confirmation.                                                 | The shared definition and all song contents remain.                                 |
| Confirm         | Reopen the confirmation and delete the definition.                             | Only the shared entry disappears; stored song label names and lyrics remain intact. |
| Teardown        | Close the remaining label picker and move away from the former tooltip target. | No stale menu, tooltip or dialog remains over the editor.                           |

Sources: [Prep label behavior](../../spec/05-prep.md) and
[shared label data](../../spec/02-data.md).
