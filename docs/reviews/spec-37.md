Review range: `140563b4...feat/spec/media-strip-panel`

# Review request: `spec-37`

- Team member: `spec`
- Branch: `feat/spec/media-strip-panel`
- Base commit: `140563b4`, main after spec-36 and output-25
- Review round: 1
- Task: M3-S1b media strip display panel
- Ownership exception: shell's show renderer paths; no new UI edits

## What changed and why

Added the complete media panel on spec-36's controller: the shared panel header,
playlist select, image/video tiles, duration and loop marker, copy progress,
missing-file visuals, and LIVE ring driven only by main. Selecting a media tile
sends the canonical media.show command. The real 진행 keyboard hook test
confirms that a media click keeps focus on the previous control.

The row renders only the viewport and four extra tiles on each side. Spacers
retain the scroll range; Left, Right, Home, and End navigate the whole list and
focus a newly mounted target. Accessible positions refer to the whole filtered
list. One ResizeObserver is disconnected on unmount. Width and spacing come from
the shared media tokens, including a reserved row height before data loads.

Previews are muted, paused, metadata-only video or async images. A tile leaving
the rendered range releases its video's source. Source revisions remount the
preview so a stale failure cannot mark a replacement. The host memoizes each
picture element; selection or LIVE changes keep the video and source intact. The
controller's missing callback is stable to preserve that memoization. Carried
spec-36's naming nit by using UNNAMED_MEDIA for the warning fallback.

The default choice is 전체 미디어. Playlist rows follow their stored order and
exclude audio. A deleted playlist falls back to 전체 미디어. Active copy jobs
not yet in the document appear only in 전체 미디어, because the current progress
contract does not identify playlist membership. 가져오기 stays unavailable with
its reason in a tooltip until P6a; clicking a failed preview keeps it off output
and reports the media name without opening a native picker.

## Integration still to come

This request supplies the panel, not its workspace mount. The following mount
will replace the 미디어 placeholder and bind the toolbar toggle. State saving
waits for the lead's data-41 merge announcement. Search waits for data-40.
Actual import and relink remain P6a work. No shared, preload, main, prep, or UI
source is changed here, and no dependency is added.

## Checks run

| Check                            | Result                                                |
| -------------------------------- | ----------------------------------------------------- |
| Media panel and controller tests | Pass: 11 tests in 2 files                             |
| Renderer TypeScript check        | Pass                                                  |
| Changed-file ESLint and Prettier | Pass                                                  |
| `git diff --check`               | Pass                                                  |
| Local full verify                | Not run, per the lead's rule                          |
| GitHub branch CI                 | Exact submitted HEAD run URL and result in the report |

Tests cover playlist filtering, copy blocking, confirmed LIVE state, current
preview errors, unavailable import, pointer focus, stable paused video and
source release, a 1,000-item virtual row, keyboard traversal, accessible
positions, and observer disposal. They count rendered options rather than
measuring memory or timing. No Electron process or visible window was started.
