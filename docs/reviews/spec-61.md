# Review request: `spec-61`

- Team member: `spec` (Codex)
- Branch: `fix/spec/search-import-keys`, initially stacked on spec-60
- Base, range, and exact-head CI: see the request message
- Review round: 1
- Task: decided S1 search and file-import defaults from the shortcut audit

## What changed and why

Ctrl F now focuses the toolbar search and selects its current query in 진행 and
준비. From 화면 설정, it opens 진행's working search. The focus request is
acknowledged once, so later workspace changes do not replay it.

Ctrl Shift I uses the same import action as File > 가져오기 > 텍스트 파일: open
준비, leave media view, and respect the editor's unsaved-import guard. The menu
displays the same English shortcut hint. Exact modifiers, IME, popup/drag
precedence and held-key suppression use spec-60's shared handler.

## Validation

The focused App, ToolbarSearch and MenuBar tests pass, including search from
each workspace, query selection, one file read after a held import key, and
existing import preview/edit/save guards. Typecheck, scoped lint, build,
formatting and final results are recorded with submission.

## Checked in the app

Built with `npm run build`. Syntax-checked the driver, server and main entry,
then ran the real Electron app with `LLP_TEST_WINDOWS=offscreen`, built renderer
on dev port 5193, CDP 9517 and a fresh isolated fixture folder.

Verified Ctrl F from all workspaces, real library search results and selection
of the entire query. Repeated preparation/search and settings/search round trips
20 times after warm-up. Ran Ctrl Shift I twice from 화면 설정 and opened the
File import submenu to verify its shortcut hint. The native picker is
intentionally cancelled by main's offscreen guard; accepted-file preview/edit is
exercised by the integration tests, rather than claiming a native picker was
displayed. Live layers stayed identical and no renderer exceptions occurred.

Elements stayed at 399, DOM nodes at 1444 and listeners at 384. Collected heap
was 6.64, 6.87 and 6.99 MB, within 0.36 MB over the repeated flow. The driver
stopped its app/server processes. [Measurements](spec-61/measurements.json).

![Ctrl F focuses search and selects the query](spec-61/focused-search.png)

![The file-import action shows its S1 shortcut](spec-61/file-import-accelerator.png)

## Changes outside my paths

The lead assigned shell/control shortcut alignment to this member. No shared
contract, native-dialog policy, or F1 through F7 handling changes.
