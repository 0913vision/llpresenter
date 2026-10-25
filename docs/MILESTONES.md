# Milestones

The team works toward one milestone at a time, in parallel. When a milestone's
work is merged, the lead freezes it with a tag, QA tests that tag, and everyone
else moves on to the next milestone. Bugs that QA finds come back as fix tasks
with priority over new work. Only the lead edits this file.

## How a milestone runs

1. **Plan:** the lead splits the milestone into tasks, one owner each, with no
   two owners on the same files. Each task gets a brief in `docs/briefs/` and
   ends in one or more review requests.
2. **Build:** members work in parallel and merge into `main` as usual (review by
   the lead and Codex, fast-forward, version bump by the bot).
3. **Freeze:** when every task of the milestone is merged and `main` is green,
   the lead tags the bot's version commit as `m<number>` (annotated) and pushes
   the tag.
4. **QA:** the qa member tests the frozen tag in its own worktree against the
   milestone's acceptance criteria, while the rest of the team starts the next
   milestone on `main`.
5. **Fix:** each bug goes to the owner of the area as a `fix/<name>/<bug>`
   branch. Blockers come before next-milestone work. QA retests the fixes on
   `main`.
6. **Close:** the milestone closes when QA signs off (no open blocker or major
   bug) and the user has seen it run.

Bug severity: **blocker** (output stops, data loss, crash), **major** (a feature
in the criteria doesn't work), **minor** (works with a flaw), **cosmetic** (look
differs from the design system).

## File ownership

One owner per path. Change only your own paths; ask the owner for anything else.
Every member owns their own `docs/reviews/<name>-<number>.md`, and a member who
rebases regenerates `package-lock.json` (take `main`'s file, then
`npm install`).

| Owner   | Paths                                                                                                                                                                                                                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| devops  | `.github/`, `.githooks/`, `scripts/` (lint, soak, version, verify, gallery, and the SessionStart hook), `src/main/soak/`, `test/`, `vitest.config.mts`, `eslint.config.mjs`, `tsconfig*.json`, and the `scripts` and `devDependencies` of `package.json`                                       |
| data    | `src/shared/` (types, commands, IPC channels, schemas), `src/preload/`, `src/main/store/`, `src/main/search/`, `src/main/import/`, and the `dependencies` of `package.json`                                                                                                                    |
| ui      | `src/renderer/src/ui/`, `src/renderer/gallery.html`, `src/renderer/src/styles/`, `design/system/`                                                                                                                                                                                              |
| shell   | `src/renderer/src/shell/`, `src/renderer/src/control/`, `src/renderer/src/state/`, `src/renderer/src/show/` (except `tools/`, `quick/`, `bible/`), `src/main/uiState/`                                                                                                                         |
| output  | `src/main/index.ts` (wiring), `src/main/log.ts`, `src/main/ipc.ts`, `src/main/live/`, `src/main/windows/`, `src/main/displays/`, `src/main/outputs/`, `src/renderer/index.html`, `src/renderer/output.html`, `src/renderer/src/output/`, `src/renderer/src/render/`, `electron.vite.config.ts` |
| spec    | `docs/spec/`, `docs/plans/`                                                                                                                                                                                                                                                                    |
| qa      | `docs/qa/`                                                                                                                                                                                                                                                                                     |
| prep    | `src/renderer/src/prep/`, `src/main/media/` (from the M2 freeze; no member yet, Codex members work here under one-feature lead exceptions)                                                                                                                                                     |
| screens | `src/renderer/src/screens/` (from the M2 freeze; output takes it if no member joins)                                                                                                                                                                                                           |
| tools   | `src/renderer/src/show/tools/`, `src/renderer/src/show/quick/`, `src/renderer/src/show/bible/`, `src/main/macros/`, `src/main/bible/` (from the M2 freeze; no member yet)                                                                                                                      |
| lead    | `CLAUDE.md`, `README.md`, the rest of `docs/`, `design/drafts/`, `.claude/`, `.gitignore`, `.prettierrc.json`, `.editorconfig`                                                                                                                                                                 |

A member who needs a new module wired into the main process exports a
`register...` function and asks output to call it from `src/main/index.ts`.

## M1: Foundation

Status: frozen as tag `m1` on October 25, 2026. qa runs the M1 test plan on the
tag; fixes go into M2 branches.

| Task                                                            | Owner  | Review requests        |
| --------------------------------------------------------------- | ------ | ---------------------- |
| Check command, lint, coverage, CI, soak runner                  | devops | devops-1 (merged)      |
| Pre-push verify hook and the version bot                        | devops | devops-2               |
| Form controls and toolbar buttons                               | ui     | ui-1                   |
| Menu, Tooltip, Dialog, AlertDialog, Panel, ListRow, StatusMarks | ui     | ui-2                   |
| Column dragging and widths per size class                       | shell  | shell-1                |
| UI state IPC and the `app.json` store for the column widths     | shell  | shell-2                |
| Schemas for every file format, the file pipeline                | data   | data-1, data-2, data-3 |
| Live commands on the schema library                             | data   | data-4                 |
| Shortcut and settings proposal (research)                       | spec   | spec-1                 |
| Shared contracts, tokens, reviews, merges                       | lead   | -                      |

Acceptance criteria (QA):

- `npm ci` and `npm run verify` pass on a clean clone; CI is green on `main`; a
  push to `main` produces a `Bump version` commit and a `v` tag; a failing check
  blocks a push to `main`.
- The app starts at 1280×720, 1920×1080, and 2560×1440, shows the three
  workspaces, and switches size classes at 1600 and 2400.
- The column gaps drag within their ranges, the center never goes under 560, and
  the widths per size class survive a restart.
- The gallery shows every M1 component in every state, and each matches its
  design system card.
- Every file format in `docs/spec/02-data.md` parses its samples, rejects broken
  files with the field that failed, and keeps unknown fields.

## M2: Vertical slice

Status: frozen on October 26, 2026 as tag `m2` (at 3d8a38b, the build the user
checked on real monitors). The 60-minute two-monitor run, the force-quit check,
and two HDMI unplug checks passed (`docs/qa/m2-notes.md`). The one open
criterion, GPU process memory growth (bug M2-8, about +10 MiB/h), moved to M3 by
the user's decision (`docs/decisions.md`, October 25).

| Task                                                                                                                                                         | Owner (planned) |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| Main-process file store: atomic writes, autosave, recovery copies, backups, the song library and services read through the schemas                           | data            |
| Output windows: one per screen, display detection, connect and disconnect, relaunch after a crash, output toggles                                            | output          |
| Render a 장 over a looping background video in the 본 화면 output                                                                                            | output          |
| 진행 workspace: 예배 순서 list, 장 panel with thumbnails, click to output, previews, the 지우기 row with F1 to F7 and undo                                   | shell           |
| Remaining shared components: SlideThumbnail, PreviewFrame, ClearButton, LabelChip, KeyCap, PropertyRow, MediaTile, MacroTile, Notification, LabelColorPicker | ui              |
| App-side soak recording, the first UI tests                                                                                                                  | devops          |
| M1 acceptance testing, then the M2 test plan                                                                                                                 | qa              |

Acceptance criteria (QA), from `docs/PLAN.md` phase 2:

- A song in a 예배 순서 shows as thumbnails in 진행, and a click shows its
  lyrics over a looping background video on the 본 화면. In M2 the song gets
  into the 예배 순서 through a service file prepared on disk (a test fixture);
  adding it from the library in the UI comes in M3.
- The Notification component and the main-process problem events ship in M2; the
  host that shows them in the control window comes in M3.
- F1 to F7 clear the right layers, and undo restores the last clear.
- 60 minutes of continuous output (looping video, 장 changes) on two monitors
  shows no stutter and no memory growth (soak test).
- The app recovers when an output window is force-quit, when a monitor is
  unplugged, and when the app itself is force-quit. In M2, recovering after the
  app itself is force-quit means it starts again cleanly with its data intact
  and the same 예배 순서 open, outputs off, so the operator resumes by hand; the
  출력 상태 복구 dialog that restores the live state comes in M3 (O8, S2b) (lead
  decision, October 25).

## M3: Feature bundles

Status: in progress since the M2 freeze; the plan and its requests are in
`docs/plans/m3-breakdown.md`, and M2-8 is carried into it. The prep, output, and
tools bundles from `docs/PLAN.md` phase 3, split among the members by area.

## M4: Polish, settings, and shortcuts

Status: planned. The settings window and shortcut system from the spec proposal
(`docs/spec/10-shortcuts-and-settings.md`, once the user decides), narrow and
wide window details, problem notifications, accessibility, and one real service
rehearsal.

## M5: Later features

Status: planned. NDI, an installer, PowerPoint import, sheet music, and camera
input, each starting with a spike.
