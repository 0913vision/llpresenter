Review range: `81cc2b9...feat/spec/prep-mount`

# Review request: `spec-33`

- Team member: `spec`
- Branch: `feat/spec/prep-mount`
- Base commit: `81cc2b9`, main after data-34
- Review round: 1
- Task: `.llp/task.md`, preparation panel mounting
- Ownership exception: the lead's shell, control, and show paths for this mount

## What changed and why

The 준비 frame mounts the merged P1 library in the left column and P2a lyric
block editor in the center. The library owns its existing panel header; a
bounded flex slot avoids nesting another header around it. The editor receives a
bounded panel body. Selecting or creating a library song opens its checked
document in the editor, without sending a live command. Selecting a service row
returns to item context, including a row that was already selected. The right
column follows library versus item context, with its future panels unfilled.

A control-window session creates the editor once, on the first preparation entry
event, outside React render. StrictMode and workspace unmounts therefore keep
the same store, pending edits, and per-song undo history. The frame subscribes
only to whether a song is open, so lyric keystrokes do not redraw the whole
workspace. Pagehide unmounts React, stops the live and service feeds, and
disposes editor resources once.

Library and editor problems enter the App's single notice stack. The existing
addNotice policy caps it at three cards and replaces by key. Retry actions
dismiss their current card before retrying; another failure can report again.
Warning height continues to reserve room above the right column.

No library or editor panel source changed. No shared or preload contract,
dependency, output command, or native window was added.

## Remaining work

The lead explicitly limited this mount to merged P1 and P2a. P2b adds the title
field, honors LibrarySelection.focusTitle after 새 곡, and supplies the editor
header, source preview, and slide list. P3 supplies service item editing and
settings. P4's 새 예배, 다른 예배에서 가져오기, and 지금 예배를 틀로 저장 remain
separate, as recorded in spec 04. P6a supplies media relinking.

The editor can retain up to one second of typing before a save boundary. As the
lead requested, the main-to-renderer flush handshake before native close is a
separate task. Pagehide cleanup is best effort and does not guarantee saving
that pending typing on quit or keeping a refused draft alive. No new close IPC
or shutdown safety claim is part of this request.

## Checks run

| Check                                                                  | Result                                 |
| ---------------------------------------------------------------------- | -------------------------------------- |
| Preparation host, bootstrap, App, workspace, and service editing tests | Pass: 49 tests in 5 files              |
| Renderer TypeScript check                                              | Pass                                   |
| Changed-file ESLint and Prettier                                       | Pass                                   |
| `git diff --check`                                                     | Pass                                   |
| Local full verify                                                      | Not run, per the lead's rule           |
| GitHub branch CI                                                       | Exact submitted HEAD run in the report |

Integration tests use the real P1/P2a panels in StrictMode with invented song
fixtures. They cover opening and creating a song, lyric save and undo across
workspace changes, service context on reselection, the shared load warning and
retry, no live commands from library/editor actions, and feed disposal on
pagehide. No Electron process, visible window, soak, or memory run was started.
