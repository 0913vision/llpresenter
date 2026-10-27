# Remaining check4 integration coverage

Use invented content in a separate QA data folder. Keep automated windows
offscreen and muted. Native screen placement and audible playback require a user
check.

## Grouped song persistence

Run these checks first against a fresh sample containing a version 1 song.

| Case               | Steps                                                                                                                                          | Expected                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read legacy        | Open the existing version 1 song and inspect its groups and arrangements.                                                                      | The app presents version 2 in memory without modifying the original file on read. Slide content, labels and arrangement order are preserved.                                     |
| First save         | Edit the song title and save. Inspect the saved song and its recovery copy.                                                                    | The saved song is version 2 with the intended title change and preserved background, slides, group IDs and arrangements. The recovery copy matches the original version 1 bytes. |
| Legacy extensions  | Add invented unknown fields to a separate version 1 fixture, including fields that collide with new group and shortcut keys. Open and save it. | Unknown data is retained or archived under the legacy fields. An old shortcut value is not activated, and the recovery copy matches the original fixture bytes.                  |
| Import sections    | Import invented text with two labeled sections and save the edited song.                                                                       | The saved version 2 file retains both groups, their slide boundaries and content.                                                                                                |
| Restart            | Close and reopen the app, then open the imported and converted songs.                                                                          | Both reload with their saved group IDs and content; the original version 1 recovery copy remains available.                                                                      |
| Arrangement output | In Show, select the converted song's nonsequential arrangement and output every slide, including repeated slides.                              | Each output matches its source slide in the selected arrangement order.                                                                                                          |

## Bible passage insertion

| Case           | Steps                                                                                                    | Expected                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Show section   | Select a service section, preview a valid sample passage in Show and insert it twice.                    | Two distinct Bible items appear before the next section; insertion leaves live layers unchanged.                |
| Recent passage | Inspect recent references after the repeated insertions.                                                 | The passage appears once in recent history.                                                                     |
| Prep section   | Select another section, add a different sample passage through Add Item, then inspect recent references. | The new item belongs to the selected section and its reference appears in history without changing live output. |

## Timer deletion

Prepare a timer with a linked quick-run row. Start and pause the timer and
select it for the stage before deleting it.

| Case            | Steps                                                             | Expected                                                                                                                                        |
| --------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Cancel twice    | Open Delete from the timer row and cancel the confirmation twice. | The confirmation explains linked quick-run removal; neither settings document changes.                                                          |
| Delete selected | Confirm deletion and inspect settings and live state.             | The definition and linked quick row disappear, the paused run is reclaimed and stage selection clears. Other quick rows and live layers remain. |

## Text import and service arrangements

Use an invented text file with two labeled sections, each with four lines.

| Case                | Steps                                                                                                              | Expected                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Group preview       | Import the file with label recognition and two lines per slide.                                                    | Four slides appear; each section label appears on its first slide only.                                        |
| Discard preview     | Discard the import preview.                                                                                        | No imported song is saved and live layers remain unchanged.                                                    |
| Missing arrangement | Set a service song item's arrangement to an unavailable name in a validated fixture, then select the item in Prep. | The default arrangement is shown with a warning and accessible explanation naming the unavailable arrangement. |
| Restore arrangement | Choose an existing arrangement for that item.                                                                      | Its warning clears; the library song and live layers remain unchanged.                                         |

## Look names and fonts

| Case               | Steps                                                                                                                                     | Expected                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Invalid Look name  | Rename a Look to blank or an existing name, then press Enter.                                                                             | The invalid draft stays editable and does not write settings. A corrected name can be saved.                                      |
| Invalid style name | Rename a lyric style to an existing style name, press Enter, then leave the field.                                                        | Enter keeps the invalid draft open; blur restores the saved name without a write.                                                 |
| Missing font       | Set an audience lyric style to an unavailable font in a validated fixture and select its Look.                                            | The Look warns that the font falls back; its saved family name is retained.                                                       |
| Font weights       | Inspect a missing font's out-of-range saved weight and switch to a valid weight. Choose the bundled font and inspect weights 450 and 999. | Unsupported saved weights remain visible but disabled; valid choices save. The bundled variable font accepts 450 and rejects 999. |
| Clear warning      | Select the bundled font after a missing-font warning.                                                                                     | The warning clears without changing unrelated style fields.                                                                       |
| Installed font     | Search the installed font list, select an available family and one of its supported weights.                                              | The list remains windowed, the chosen family and weight save, and the output renderer uses the selected style.                    |

## Stage layout integrity and guides

Duplicate a populated stage layout twice using its context menu. Rename one
copy, first trying the original name and then a new name with surrounding
spaces. Edit an element in the renamed copy. Both copies receive distinct names
and IDs, preserve the source elements and unknown fields, and leave the source,
Look assignment and live layers unchanged. A duplicate name stays editable; the
valid name saves without surrounding spaces.

| Case                     | Steps                                                                                                                | Expected                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Used layout              | Attempt to remove a stage layout referenced by a Look.                                                               | The settings edit is refused without changing the document or revision.                                        |
| New reference            | Assign a valid temporary layout to a Look, then try to remove it.                                                    | Assignment succeeds; removal is refused while the reference exists.                                            |
| Remove and assign        | Restore the Look's original layout, remove the temporary layout, then attempt to assign the removed ID.              | Removal succeeds and the new missing reference is refused without changing the Look.                           |
| Guide precedence         | With grid snapping on, drag one element near another element's edge where the guide and grid differ.                 | The guide wins on its matched axis; the draft is not saved before release.                                     |
| Alt bypass               | During that drag, press and release Alt without moving the pointer.                                                  | The guide disappears and snapping is bypassed while Alt is held; alignment returns when Alt is released.       |
| Guide cleanup            | Release the drag and inspect the saved frame and stage output.                                                       | The aligned frame saves, guide lines disappear and no guide is rendered on output. Live slide content remains. |
| Numeric draft navigation | Type a stage position and switch workspaces using a keyboard shortcut without pressing Enter.                        | The focused valid draft is committed before the workspace changes.                                             |
| Width minimum            | Reduce an element's width below the declared numeric minimum using a pointer, then enter the same value numerically. | Both editing methods apply the same intended minimum and the displayed control agrees.                         |

The grouped-slide shortcut components require connected operator controls before
that flow can be signed off. Test existing missing references separately from
attempts to create new missing references.

Sources: [output and stage behavior](../../spec/03-output.md),
[Show](../../spec/04-show.md), [Prep](../../spec/05-prep.md), and
[screen and Look settings](../../spec/06-settings.md).
