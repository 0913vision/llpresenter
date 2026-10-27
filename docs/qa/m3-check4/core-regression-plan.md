# Core check4 regression plan

Use a separate QA data folder and invented sample content. Preserve a clean
sample copy for each independent run. Native display checks require a user with
a real screen; hidden rendering alone does not establish their result.

## Workspaces and services

| Case                       | Steps                                                                                    | Expected                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Workspace navigation       | Visit Show, Prep and screen settings, then return to the same item.                      | Selection remains coherent and no obsolete dialog survives.                               |
| Keyboard navigation        | Use the documented workspace shortcuts and search shortcut.                              | The correct workspace or search field receives focus without changing live content.       |
| Menu switching             | Open File and move across the other available menus.                                     | The open menu follows the pointer; unavailable actions remain disabled with their reason. |
| Search ordering            | Search for a word shared by several invented songs.                                      | Every matching song appears in title order.                                               |
| Quick row drag             | Drop a quick row above and below another row's midpoint.                                 | Ordering follows the drop position; releasing the drag does not launch content.           |
| Drag precedence            | Hold a drag, try a workspace shortcut, then cancel with Escape.                          | The drag retains key precedence and cancellation preserves the old order.                 |
| Section rename             | Rename a section through its context menu.                                               | The rename field retains focus and the committed name survives navigation.                |
| Selected section insertion | Select a section and add a song.                                                         | The new item belongs to that section, before the next header.                             |
| Empty section source       | Create a service from a source with only an empty section selected.                      | The new service retains that header without inventing a song item.                        |
| Calendar                   | Open the date picker, move by day and month, then cancel or choose Today.                | Focus returns to the parent field; Today uses the current local civil date.               |
| Source lifecycle           | Rename and delete disposable templates and past services. Try deleting the open service. | Confirmations preserve unrelated sources; deletion of the open service is refused.        |

## Bible passages

| Case                   | Steps                                                                    | Expected                                                                                            |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Four fields            | Complete a book, enter chapter and a valid start/end range, then submit. | The range resolves to the intended slides and Enter outputs the selected one.                       |
| Invalid endpoints      | Enter an invalid book, chapter, start or end.                            | Invalid forward Tab is blocked and invalid content is never output.                                 |
| Recent passage         | After a manual-field error, select a valid recent passage.               | The error clears and local preview returns before explicit output.                                  |
| Prep insertion         | Add a valid passage through Prep's item dialog.                          | Book suggestions remain above the dialog; adding does not change live output.                       |
| Saved passage          | Select the saved item in Show and Prep, including after restart.         | The stored reference resolves again. Prep changes only local selection; Show can output its slides. |
| Missing passage        | Open a saved reference to an unavailable verse or translation.           | The row identifies the missing passage and preserves the last good output.                          |
| Per-item verse numbers | Store the same reference in two items with different number options.     | Each projection respects its own option without corrupting the shared lookup.                       |
| Converter guard        | Convert invented legacy input and try using the source as destination.   | Conversion succeeds only to a distinct file and refusal preserves the source.                       |

## Media and editor behavior

| Case                      | Steps                                                                         | Expected                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| External reference import | Import a valid external image, video and audio with copying off. Restart.     | Metadata and original references remain usable; source files remain unchanged.                   |
| Copy-on import            | Enable copying and import a distinct valid file.                              | A local copy is created while the original remains intact.                                       |
| Invalid media             | Import a deliberately unplayable fixture.                                     | Analysis refuses it without adding an unusable item or deleting the source.                      |
| Shared bin selection      | Select media in Show, visit Prep, hide and reopen the bin.                    | The same selection is retained; hidden preview players stop.                                     |
| Click behavior            | Single-click media in Show, then single- and double-click it in Prep.         | Show outputs immediately; Prep single-click selects and double-click outputs.                    |
| Playlist rename           | Rename a media and an audio playlist through their menus.                     | The field keeps focus and actual changed names persist.                                          |
| Media removal             | Remove a referenced fixture from a playlist, then from the library.           | Membership and catalog removal are distinct; removing a catalog entry preserves its source file. |
| Imported draft            | Import invented text, edit its title and body, then save.                     | The song enters the library only after the explicit save action.                                 |
| Long editor               | Scroll a long invented song while keeping a field focused, then undo an edit. | Virtualization retains the focused field and undo restores its text.                             |

## Tools and output

| Case                     | Steps                                                                                    | Expected                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Paired quick timer       | Create a quick timer and rename it.                                                      | The row and timer definition remain paired.                                        |
| Countdown restart        | Run a short countdown with overrun disabled, then start it again.                        | It stops at zero and the next run starts fresh.                                    |
| Timer definition removal | Remove running and paused definitions, including the selected stage timer.               | Live runs and the obsolete stage selection are reclaimed; another timer can start. |
| Message lifecycle        | Create, edit, send and clear an invented message; reopen delete confirmation and cancel. | Each operation affects only its intended template or live message.                 |
| Overlay clear            | Clear one prop or message, then undo a mixed-layer clear.                                | Unrelated overlays remain and cleared lifetimes resume consistently.               |
| Muted audio transport    | Use a muted fixture to play, pause, clear, restore and fade audio.                       | Transport state and retained position remain coherent without audible playback.    |
| Monitor assignment       | Attempt control-monitor assignment, then assign an available second screen.              | The guard refuses the control monitor; valid assignment preserves other screens.   |
| Calibration selection    | Select a test pattern and edit calibration properties repeatedly.                        | The chosen preview mode remains selected.                                          |
| Output window bounds     | Resize a windowed output, turn it off and on, then quit normally.                        | The window retains its bounds and the app releases output resources on exit.       |
| Locked close             | Lock an isolated service file, edit its memo, and request close. Unlock and retry.       | The app preserves the memo while saving fails; retry persists it before closing.   |
| Native display           | Check monitor cards, fullscreen topmost behavior and desktop reveal on real displays.    | The user confirms visible behavior independently of hidden rendering checks.       |

Sources: [Show](../../spec/04-show.md), [Prep](../../spec/05-prep.md),
[output](../../spec/03-output.md), [settings](../../spec/06-settings.md), and
[problem handling](../../spec/08-problems.md).
