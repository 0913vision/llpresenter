# Timer row rename regression plan

Use invented timer names in a separate QA data folder. Keep automated windows
offscreen and muted. Prepare a timer referenced by a quick-run row and select it
for the stage. Start and pause it before testing rename.

| Case                | Steps                                                                                                              | Expected                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Context keyboard    | Focus the timer row and open its context menu with the context-menu key.                                           | The timer menu offers 이름 바꾸기 and opens the name dialog with the saved name selected.                         |
| Unchanged and blank | Inspect Save without editing, then enter only spaces.                                                              | Save is disabled for both; the blank field reports invalid input.                                                 |
| Cancel              | Cancel the blank draft and compare timer and quick-run documents.                                                  | Both values and revisions remain unchanged.                                                                       |
| Alternate keyboard  | Reopen the menu with Shift F10, enter a name with surrounding spaces and save.                                     | The trimmed name appears in the timer row and linked quick-run row.                                               |
| Live isolation      | Compare the paused run, stage selection and live layers before and after saving.                                   | Their identities and state remain unchanged.                                                                      |
| Reopen              | Open the renamed timer again and cancel.                                                                           | The saved name is shown and cancelling does not change it.                                                        |
| Windowed last row   | Prepare 500 definitions, including a clock at the end. Use End in the timer list and open its menu with Shift F10. | Focus reaches the clock row while only the visible rows and overscan are mounted; rename targets that clock's ID. |
| Dialog navigation   | Type a new name for the last row, then press Home and End before saving.                                           | Focus remains in the name field and the timer list does not scroll.                                               |
| Other records       | Save the last clock's name and compare the first timer, quick-run rows and live state.                             | Only the chosen definition changes; unrelated names, quick rows and live state remain intact.                     |

The linked-row contract also needs coverage for multiple references, unknown
fields and rejected writes. Keep fixture-based contract checks distinct from
operator controls and native display or audio checks.

Sources: [timer controls](../../spec/04-show.md),
[quick-run data](../../spec/02-data.md), and
[progress tools](../../spec/07-macros.md).
