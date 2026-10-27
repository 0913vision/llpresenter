# Bible focus and screen identity regression plan

Use invented Bible content that contains John but not Ephesians. Run automated
windows offscreen with a separate QA data folder. Preserve live output while
testing input and selection.

## Bible book availability

| Case                       | Steps                                                                                                | Expected                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Ambiguous unavailable book | In Show, type the prefix 베, use Arrow Down to select Ephesians, then press Tab. Repeat three times. | The book completes, reports unavailable content and retains focus instead of advancing to chapter.         |
| Exact unavailable book     | Enter the unavailable book's full name and press Tab.                                                | The same validation and focus rule applies.                                                                |
| Available recovery         | Replace the unavailable book with 요, press Tab and enter the sample chapter and verse range.        | John completes, focus advances to chapter and the passage preview becomes available without outputting it. |
| Prep validation            | Open Add Item, choose Bible Passage and repeat the unavailable-prefix selection.                     | The book retains focus and Add remains disabled.                                                           |
| Cancel and reopen          | Recover to the available reference, cancel and reopen the dialog twice.                              | The form accepts the valid reference each time; cancel adds no service item and changes no live layers.    |

Delayed availability replies must also respect later operator edits, focus
changes and translation changes. Cover those transport races separately from
ordinary offscreen interaction.

## Saved screen identity

| Case               | Steps                                                                                           | Expected                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Rename             | Rename a screen in its properties and inspect the toolbar, output menu, preview and status bar. | Every surface uses the saved name and commands retain the screen ID.                                                 |
| Invalid name blur  | Enter a blank name or another screen's name, leave the workspace and return.                    | The saved name returns and neither invalid draft writes settings.                                                    |
| Additional screens | Prepare 20 saved screens through validated settings IPC.                                        | The toolbar keeps three inline controls and one overflow control; all remaining screens are reachable from its menu. |
| Overflow output    | Turn the last overflow screen on, reopen the menu and turn it off.                              | The menu check follows that ID's state; other outputs and live layers remain unchanged.                              |
| Bounded views      | Select the last preview and inspect the preview panel and status bar.                           | Their lists scroll within their regions without widening the document; the selected picture stays within its panel.  |
| Existing pictures  | Add screens while existing preview elements are mounted.                                        | Existing screen IDs retain their DOM elements.                                                                       |
| Reorder            | Reorder saved screens while one is selected.                                                    | Controls follow saved order and selection follows the same ID.                                                       |
| Remove selection   | Remove the selected screen, then restore the initial screen fixture.                            | Selection falls back to the first saved screen; unnecessary overflow controls disappear.                             |
| Remounts           | Alternate screen settings and Show 20 times after warming both workspaces.                      | Final element and listener counts remain stable; names and output targets remain correct.                            |

Sources: [Bible entry and preview](../../spec/04-show.md),
[Prep Bible items](../../spec/05-prep.md),
[screen properties](../../spec/06-settings.md), and
[output identity](../../spec/03-output.md).
