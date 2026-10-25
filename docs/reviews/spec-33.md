Review range: `98080f6...feat/spec/prep-mount`

# Review request: `spec-33`

- Team member: `spec`
- Branch: `feat/spec/prep-mount`
- Base commit: `98080f6`, main including ui-24 and data-37
- Review round: 2
- Task: `.llp/task.md`, preparation panel mounting
- Ownership exception: the lead's shell, control, and show paths for this mount

## What changed and why

The 준비 frame mounts the merged P1 library in the left column and the song
editor in the center, including P2a's blocks and ui-24's title header. The
library owns its existing panel header; a bounded flex slot avoids nesting
another header around it. The editor receives a bounded panel body. Selecting or
creating a library song opens its checked document in the editor, without
sending a live command. Selecting a service row returns to item context,
including a row that was already selected. The right column follows library
versus item context, with its future panels unfilled.

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

Carried the two spec-32 nits: the paused video preview now preloads metadata,
and the background menu uses the shared Menu search. Media names filter with
normalized, trimmed, case-insensitive text like the service picker. The song
default stays available during filtering. Reopening clears the search query.

## Round 2 response

The mount left a TODO for title focus even though ui-24 had already supplied
`open(document, {focusTitle})`. Rebased onto main including that contract,
passed `selection.focusTitle` through the library handoff, and removed the TODO.
A mounted StrictMode regression creates 새 곡 through the real library panel and
checks the real title input's value, focus, and full selection. It fails on the
focus assertion before the handoff fix and passes afterward. No panel source
changed.

## Remaining work

The mount uses the merged panels, including ui-24's title field and new-song
focus. The rest of P2b supplies default background, 구성, source preview, and
the slide list. P3 supplies service item editing and settings. P4's 새 예배,
다른 예배에서 가져오기, and 지금 예배를 틀로 저장 remain separate, as recorded
in spec 04. P6a supplies media relinking.

The editor can retain up to one second of typing before a save boundary. As the
lead requested, the main-to-renderer flush handshake before native close is a
separate task. Pagehide cleanup is best effort and does not guarantee saving
that pending typing on quit or keeping a refused draft alive. No new close IPC
or shutdown safety claim is part of this request.

## Checks run

| Check                                                         | Result                                 |
| ------------------------------------------------------------- | -------------------------------------- |
| Round 2 preparation host, bootstrap, App, and workspace tests | Pass: 40 tests in 5 files              |
| Renderer TypeScript check                                     | Pass                                   |
| Changed-file ESLint and Prettier                              | Pass                                   |
| `git diff --check`                                            | Pass                                   |
| Local full verify                                             | Not run, per the lead's rule           |
| GitHub branch CI                                              | Exact submitted HEAD run in the report |

Integration tests use the real P1/P2a panels in StrictMode with invented song
fixtures. They cover opening and creating a song, new-title focus and full
selection, lyric save and undo across workspace changes, service context on
reselection, the shared load warning and retry, no live commands from
library/editor actions, and feed disposal on pagehide. Background tests cover
metadata-only preload, filtering, query reset, and choosing a filtered result.
No Electron process, visible window, soak, or memory run was started.

## Verdicts (recorded by the lead at merge)

- Round 1 (Claude, trial-97): Request changes: the mount opened the editor
  without `focusTitle`, so 새 곡 did not focus the title end to end.
- Round 2 (563d1d3): reviewer (Claude, trial-97) Approve: a mount test creates
  새 곡 in the 준비 frame and checks the title is focused and fully selected
  with no live command. Lead Approve. Written by the Codex session that took
  over spec's work, under the lead's exception for shell's paths. Rebased by the
  lead onto local `main` without conflicts. M3-P1 is complete.
