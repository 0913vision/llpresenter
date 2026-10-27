# Saved content and clear effects regression plan

Use invented content and an isolated QA data folder. Keep original media outside
the managed media library and record its hash before importing it. Mute all
audio and keep automated output windows offscreen. A hidden renderer can
establish state and rendering behavior, but cannot establish native focus,
monitor placement or audible playback.

## Saved Bible passages

Use a small invented translation with two valid ranges of different lengths.
Store a second occurrence with verse numbers disabled. Include an invalid verse
and a reference to an uninstalled translation as negative fixtures.

| Case               | Steps                                                                   | Expected                                                                                         |
| ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Prep insertion     | Add both valid ranges through Prep's Bible dialog.                      | Each service item has its own projected slide count; insertion never changes live output.        |
| Local navigation   | Select a saved passage in Prep, then use its slide grid and arrow keys. | Selection and preview change locally; live output remains unchanged.                             |
| Show navigation    | Select the saved passage in Show, output its first tile, then advance.  | The correct saved range supplies the next slide and reference.                                   |
| Number preference  | Select the saved occurrence with verse numbers disabled.                | Its projected text respects the item's stored preference.                                        |
| Missing content    | Alternate valid, invalid-verse and unavailable-translation items.       | Unavailable items expose a problem and no stale tiles; valid items recover their own slides.     |
| Output protection  | Attempt to output an unavailable item after outputting a valid passage. | The last good live slide remains.                                                                |
| Repeated selection | Alternate the valid and unavailable rows repeatedly in both workspaces. | No earlier item's preview appears under another title; obsolete handlers and views are released. |
| Persistence        | Restart, reopen the service and select each saved range.                | References, per-item preferences and projected slides survive without reinsertion.               |

## Timer definition removal

The live timer limit is 200 runs. Capacity tests may prepare definitions through
the validated settings interface instead of repeating operator entry. Exercise
the actual quick-run and stage-picker paths before and after removal.

| Case               | Steps                                                                                            | Expected                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Full capacity      | Start 200 distinct timers, pause one and select it for the stage. Try an additional quick timer. | The extra start is refused without changing existing timers or output.                        |
| Definition pruning | Remove the running and paused definitions.                                                       | Their runtime records disappear, the removed stage selection clears and capacity is released. |
| Capacity reuse     | Start the previously refused quick timer.                                                        | It starts immediately without restarting the app.                                             |
| Unrelated state    | Keep a slide live during removal and retain an unrelated timer definition.                       | Slide output and unrelated timer state remain unchanged.                                      |
| Repeated removal   | Repeatedly add, start and remove a temporary definition.                                         | No stale runtime entry accumulates and each next start remains available.                     |

## External media ownership

Use an unreferenced imported image with copying disabled. Wait for import
analysis to finish before opening its normal context menu. During an active
import, the cancellation-only menu is intentional.

| Case             | Steps                                                              | Expected                                                                                                         |
| ---------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Playlist removal | Import into a playlist, then remove that membership.               | The media remains in All Media and the original file is unchanged.                                               |
| Cancel deletion  | Open the library deletion confirmation, cancel it, then reopen it. | Cancellation retains the catalog entry and playlist references.                                                  |
| Library deletion | Confirm deletion from All Media.                                   | The catalog entry and all playlist memberships disappear; the original file still exists with its original hash. |

## Independent clear effects

Prepare a non-final slide and two distinct text props on the same audience
screen. Inspect logical live state separately from outgoing rendered content.
Use different fade durations long enough to inspect both effects.

| Case              | Steps                                                                             | Expected                                                                                    |
| ----------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Key fade          | Enable a fade for the slide clear key and press F2.                               | Logical slide state clears immediately while the outgoing slide fades.                      |
| Key restore       | Press F2 again before the effect ends.                                            | The same slide returns at full opacity and its effect is cancelled.                         |
| Independent props | Clear the first prop with a long effect, then the second with a short effect.     | Both retain their original stacking order; the short effect ends while the first continues. |
| Last-clear undo   | Undo the second prop clear during the first prop's remaining fade.                | Only the most recent logical clear is undone; the earlier outgoing prop continues fading.   |
| Whole clear       | Restore both props, then clear and restore all with F1.                           | The slide and props return together without a residual effect.                              |
| Future fields     | Save additional unknown preference fields at document, key-map and option levels. | A subsequent read preserves those fields and the known options.                             |
| Invalid shape     | Submit an array where a fade option object is required.                           | Validation rejects it and preserves the last good preferences or live state.                |

Sources: [Show behavior](../../spec/04-show.md),
[Prep media](../../spec/05-prep.md), [data contracts](../../spec/02-data.md),
[macro clear actions](../../spec/07-macros.md), and
[preferences](../../spec/10-shortcuts-and-settings.md).
