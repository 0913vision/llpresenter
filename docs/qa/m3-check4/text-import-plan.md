# Text import save and confirmation regression plan

Use invented sentences in a separate QA data folder. Prepare two labeled
sections so that saving can be checked against a known slide count. Keep live
output unchanged throughout the workflow.

Automated runs may provide a validated file-read response in place of the native
picker. Disable clipboard availability through a test response before opening
the import menu; do not read or modify the system clipboard. This establishes
the preview and editor workflow, not native file-picker behavior.

## Save from the imported editor

| Case                 | Steps                                                                                       | Expected                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Title field shortcut | Import text, choose Edit, focus the song title and press Ctrl S.                            | The library receives one song with the intended title and slide count; imported-draft actions disappear. |
| Body shortcut        | Repeat with a different title and focus a lyric block before Ctrl S.                        | The same save operation works from the body without inserting a character or changing live output.       |
| Empty title          | Replace the draft title with whitespace and press Ctrl S.                                   | No song is created; Save remains disabled with the title validation reason.                              |
| Duplicate title      | Import using an existing song's title and press Ctrl S.                                     | A confirmation identifies the existing song and shows the proposed unused title for saving a new song.   |
| Modal precedence     | Press Ctrl S while that confirmation is open.                                               | The confirmation remains open and the library is unchanged.                                              |
| Cancel and reopen    | Cancel with Escape, then request the save again.                                            | The imported draft remains available and the confirmation shows the current candidate.                   |
| Save as new          | Choose Save as New, wait for the editor to finish saving, then import the same title again. | The first unused numbered name is saved; the next confirmation proposes the next available name.         |

## Long confirmation and repeated openings

Create an existing song whose title reaches the 512-character import limit. Edit
another imported draft to that title, then request its save. A filename does not
need to reach that length; edit the draft's title field instead.

| Case                  | Steps                                                                                   | Expected                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| No valid candidate    | Open the duplicate confirmation for the maximum-length title.                           | Save as New is disabled because the numbered suffix would exceed the limit; no unavailable candidate is advertised.                           |
| Disabled action       | Attempt the disabled Save as New action.                                                | The library and the open confirmation remain unchanged.                                                                                       |
| Small viewport        | Use the minimum supported control-window size with app zoom at 150%.                    | The confirmation has no horizontal overflow and all decision buttons remain visible. App zoom does not establish OS display-scaling behavior. |
| Keyboard access       | Tab to the scrollable confirmation content and move to its end.                         | The content region is focusable and the full question remains reachable without moving the decision buttons.                                  |
| Repeated cancellation | Return to normal zoom and repeatedly open a fully focused confirmation, then cancel it. | No stale modal or menu remains; the library is unchanged and retained views, nodes and handlers do not grow with each opening.                |
| Output isolation      | Compare live layers before and after importing, cancelling and saving.                  | None of these preparation actions changes output.                                                                                             |

Wait for the confirmation's initial focus before sending the next automated key.
Detecting its DOM node alone can precede the modal's focus installation.

Sources: [Prep text import](../../spec/05-prep.md),
[data contracts](../../spec/02-data.md), and
[keyboard precedence](../../spec/10-shortcuts-and-settings.md).
