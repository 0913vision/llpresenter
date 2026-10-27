# Missing Look reference regression plan

Use invented content in a separate QA data folder. Keep automated windows
offscreen and muted. Prepare damaged references through validated settings IPC;
the normal editor must continue to refuse deletion of the current Look.

Output a non-final song slide to audience, capture and stage windows. Prepare
two Looks with visibly different main-screen appearances. Give the fallback Look
a distinct lyric color so its use can be distinguished from the default style.

| Case                    | Steps                                                                                                              | Expected                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hidden layer control    | Select a Look with the main lyric layer disabled.                                                                  | Its opacity is zero while the live slide and retained drawing content remain available. Hiding does not clear output state.                         |
| Missing live Look       | After the live selection has persisted, remove that Look from settings and select the other Look as saved current. | The renderer uses saved current immediately, including its distinct style, without changing the live slide.                                         |
| Menu fallback           | Open the Output menu while the live ID refers to the removed Look.                                                 | The existing saved fallback is checked instead of leaving every choice unchecked.                                                                   |
| Open menu update        | Rename that fallback in settings while the Output menu stays open.                                                 | The row adopts the new name and retains its check.                                                                                                  |
| Both references missing | Remove both the live Look and saved current target.                                                                | All three outputs retain visible lyrics; audience lyrics use the default style, capture retains its chroma background and stage uses direct lyrics. |
| Missing screen card     | Provide a valid current Look with no card for the output screen.                                                   | That screen draws its supported content with the default appearance instead of blanking.                                                            |
| Missing lyric style     | Give an audience card a style ID that does not exist.                                                              | Visible lyrics use the default style and retain their current content.                                                                              |
| Missing stage layout    | Give the stage card a layout ID that does not exist.                                                               | The layout canvas is hidden and direct lyrics remain visible.                                                                                       |
| State isolation         | Compare the live slide and unknown settings fields across the damaged-reference cases, then restore the fixture.   | Reference recovery preserves the slide and unrelated fields; restoration re-enables the normal Look and layout.                                     |

Inspect rendered opacity and style as well as text content. A hidden layer keeps
its drawing nodes, and an unavailable stage layout retains a hidden canvas. DOM
text or canvas presence alone does not establish visible output.

Sources: [unresolvable Looks and hiding rules](../../spec/03-output.md) and
[current Look deletion guard](../../spec/06-settings.md).
