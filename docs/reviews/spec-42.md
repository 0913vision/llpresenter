Review range: `d91ae981...feat/spec/prep-search-handoff`

# Review request: `spec-42`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/prep-search-handoff`
- Base commit: `d91ae981`, main with spec-43 merged (I resolved conflicts in
  `App.tsx` and `Workspace.tsx` with the 준비 item panel's `items` binding)
- Review round: 1
- Task: M3-S1b toolbar search in 준비
- Code owner for the renderer paths: shell; prep for `src/renderer/src/prep/`

## What changed and why

Choosing a toolbar result in 준비 now selects that song in P1's library and
opens it in the editor through the library's existing open path. A library
filter is cleared first, so the chosen row is visible. 진행 keeps spec-39's
standalone source. Neither path adds a 예배 순서 item or sends a live command.
The 준비 toolbar field, which spec-40 left unavailable, is now enabled.

The app holds one selection request (`usePrepSelection`) and the library
acknowledges it after acting on it, so a workspace switch can't replay it.
Opening a 예배 순서 item sends a clear request: the library drops its pending
read and clears the selection before that read can replace the item's view. The
panel's existing lifetime guards cover unmounting, and the editor session keeps
owning document saving.

Codex wrote this branch on spec-40 round 1 and never sent it. I rebased it onto
spec-43, resolved the conflicts against spec-40's split search hook, moved the
request state out of `App` into `usePrepSelection`, and folded the 준비 item
callback into the prep binding instead of adding another `Workspace` prop.

## Changes outside my paths

prep keeps these paths:

- `src/renderer/src/prep/library/LibraryPanel.tsx`: optional `selectionRequest`
  and `onSelectionHandled` props that run the panel's existing open, or the new
  clear, once per request.
- `src/renderer/src/prep/library/useLibrary.ts`: `clearSelection`, which drops a
  pending open and clears the selection.

Shell keeps these paths:

- `src/renderer/src/control/App.tsx` and `usePrepSelection.ts`: the one pending
  request, its acknowledgement, and the clear when a 예배 순서 item opens.
- `src/renderer/src/shell/Toolbar.tsx` and `ToolbarSearch.tsx`: enable the 준비
  field with the host's callback.
- `src/renderer/src/shell/useToolbarSearch.ts`: a 준비 choice goes to the
  library and supersedes any pending 진행 read; 진행 keeps its source path.
- `src/renderer/src/shell/Workspace.tsx`: pass the request to the library and
  call the prep binding's `onServiceItemOpen` before a 준비 item opens.
- `src/renderer/src/control/PrepSearchMount.test.tsx`: the mounted app.

This review document is in my own path. No shared contract, dependency, or UI
primitive is added.

## Validation

| Command or test                                                                                                                     | Result                             |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `npm run typecheck`                                                                                                                 | Pass                               |
| `npx vitest run src/renderer/src/shell src/renderer/src/show src/renderer/src/control src/renderer/src/state src/renderer/src/prep` | Pass, 1,611 tests (whole renderer) |
| `npx eslint --max-warnings 0` on the changed areas                                                                                  | Pass                               |
| `npx prettier --check` on the changed files                                                                                         | Pass                               |
| GitHub CI (`npm run verify`)                                                                                                        | In the request message             |

The three mounted tests cover: a 준비 result selects the song in the library and
opens the editor, clears a hiding filter, and makes no service edit, live
command, or `showSong` read; a consumed request doesn't replay after a workspace
switch; and opening a 예배 순서 item cancels a pending library open. The tests
use invented text and a mocked output renderer. No Electron process, visible
window, soak, or memory measurement was started.

## Verdicts (recorded by the lead at merge)

- Round 1 (e114ded9): reviewer (Codex, codex2) Approve. Nit for the next shell
  request: the non-exported `PrepBinding` interface in `shell/Workspace.tsx` has
  TSDoc on `onServiceItemOpen`; remove it or make it a NOTE. Lead Approve.
  Changes outside 진행's paths (`prep/library/LibraryPanel.tsx`,
  `useLibrary.ts`) checked against prep's rules. Rebased by the lead onto local
  `main` without conflicts; typecheck passes.
