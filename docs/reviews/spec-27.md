Review range: `b6a2304...feat/spec/service-panel-drag`

# Review request: `spec-27`

- Team member: `spec`
- Branch: `feat/spec/service-panel-drag`
- Base commit: `b6a2304`
- Review round: 1
- Task: `.llp/task.md`, M3-S1a service panel, third slice
- Stack: started on spec-25, then rebased onto main after its approval
- Ownership exception: renderer show paths for S1a and own review documents

## What changed and why

Both workspaces now accept native row dragging to reorder the service. Headers
can move independently. The target row's upper and lower halves select the
insertion boundary; empty list space appends. The existing ListInsertLine shows
the destination. Internal drags keep their source only in a component ref.
External text cannot supply an internal reorder command.

Library drops use the merged `SONG_DRAG_MIME` and `readSongDragData` contract.
Only a validated song payload reaches spec-24's editing engine. Main checks the
current document and song; each insert gets an independent item id, default
arrangement, no override, and no start macro. Invalid or unrelated data is
ignored. Read-only and pending lists refuse drops. Drag end and leaving the list
clear the insertion line. Reorder and insert remain undoable edits with no
output.

## 준비 details

Song, Bible, and notice rows show the projected slide count. This counts the
selected song arrangement, including repeated slides. 진행 keeps its existing
compact rows. A LIVE badge retains the design system's precedence over meta.

Media rows show their main-owned duration as minutes and seconds. Reads and
subscriptions start only while 준비 has media rows. A service-document feed maps
item ids to media ids, and the media feed supplies durations. Unknown durations
have no meta. A newer push wins over an older startup read; older revisions are
ignored. Both subscriptions stop on unmount, workspace change, or removal of the
last media row. Failed reads go to the existing host notice callback. No shared
contract or file format changes were needed.

## Spec-25 nits

Service-list undo and redo now use physical `KeyZ` and `KeyY` codes. Tests use
Korean key values with those codes. The edit-dispatch catch logs its original
cause through `window.llp.log` before reporting the warning to the host. Also
corrected spec-25's follow-up number: the lead's added docs task is spec-26.

## Checks run

| Check                                                    | Result                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| Service editing, prep duration, and existing panel tests | Pass: 45 tests                                              |
| Renderer TypeScript check                                | Pass                                                        |
| Changed-file ESLint and Prettier                         | Pass                                                        |
| `git diff --check`                                       | Pass                                                        |
| Local full verify                                        | Not run, per the lead's rule                                |
| GitHub branch CI                                         | Exact submitted HEAD's run URL and result are in the report |

Coverage includes moving songs and headers, appending, validated copy drops,
malformed payloads, read-only refusal, output isolation, projected arrangement
counts, physical undo keys, cause logging, duration updates, stale reads and
pushes, disabled loading, read failures, and feed cleanup. No Electron process,
visible window, soak, or memory measurement was started.

## Remaining S1a work

Done-state tracking and `item.start` ordering, the slide header's position and
background controls, and service switching remain assigned follow-ups. The
service picker waits for the lead's data-33 merge announcement. S1b is excluded.

The report records the exact submitted HEAD's green CI URL and result without
adding an unverified metadata commit.
