# Output window lifecycle regression plan

Use invented content and a separate QA data folder. Keep automated windows
offscreen and audio muted. Output a non-final song slide with a looping video to
audience, capture and stage screens. Let initial loading finish before recording
window and listener inventories.

## Existing screen transitions

| Case             | Steps                                                                                          | Expected                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Rapid toggles    | Turn all three outputs off and on in 30 consecutive command cycles.                            | Window IDs, web contents IDs and registered listeners remain unchanged; no additional windows appear. |
| Media retention  | Retain the active video node and inspect it after toggling.                                    | The node and renderer time origin remain the same, with no new media-empty or metadata-load events.   |
| Live isolation   | Compare all live layers before and after output switching.                                     | Output switches do not replace the slide, media or overlays.                                          |
| Pattern adoption | Enable each output's test pattern and wait until its renderer adopts the visible state.        | Each renderer shows its own pattern without replacing its context.                                    |
| Pattern removal  | Turn outputs off while their patterns are active, then enable outputs again. Repeat ten times. | Off removes pattern state; the retained pattern elements stay hidden after re-enabling output.        |

Renderer state adoption and retained nodes do not establish native reveal
timing, focus, stacking or freedom from visible flashes. Check those on real
screens.

## Screen removal and cleanup

Prepare temporary capture screens through validated settings IPC. Use a distinct
screen ID for every round and keep the original three screens active.

| Case                     | Steps                                                                  | Expected                                                                                                |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Prepare temporary screen | Add a temporary capture screen and wait for its output window to load. | Exactly one corresponding window is added.                                                              |
| Remove active screen     | Enable that temporary output, then remove its screen document entry.   | Its window disappears and its output-state ID is pruned.                                                |
| Repeat removal           | Repeat creation, activation and removal for 20 distinct IDs.           | Each round returns to the baseline window and listener inventory; orphan output keys do not accumulate. |
| Other outputs            | Compare original window IDs and live layers throughout removal.        | Existing outputs retain their identities, listeners and content.                                        |
| Close application        | Disable outputs and close the control window normally.                 | The application exits and releases its retained output windows.                                         |

Keep memory observations separate from the identity checks. Short creation and
removal cycles can warm renderer and GPU caches; they do not establish an
hours-long memory plateau or recovery from an actual renderer crash.

Sources: [output switches and test patterns](../../spec/03-output.md),
[screen removal](../../spec/06-settings.md), and
[service continuity requirements](../../TECH.md).
