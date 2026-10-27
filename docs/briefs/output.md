# Brief: output

- Session name: output
- Branch: `feat/output/<feature>` per review request (own worktree)
- Dev server port and app data folder: given by the lead (machine-specific, kept
  outside the repository).
- Milestone: M2 (vertical slice), see `docs/MILESTONES.md`

## Goal

Build the output side of the vertical slice: one output window per screen,
display detection, and the 본 화면 showing a 장 over a looping background video.
Output must never stop during a service, so this is the most stability-critical
code in the app. The main process owns the live state (`src/main/live/`); output
windows only show it.

## Tasks

1. **output-1, displays and output windows** (`feat/output/windows`):
   - `src/main/displays/`: list the monitors, watch connects, disconnects, and
     changes, and report them to the live state or a small display registry.
   - `src/main/outputs/`: one frameless, fullscreen output window per screen
     that has output on (`output.set` in `src/shared/commands.ts`), on the
     screen's assigned monitor; hide it when the output turns off; keep the
     window across hides instead of recreating it.
   - Relaunch an output window whose renderer crashes, and keep the live state;
     handle a monitor that disappears as `docs/spec/03-output.md` says (lost
     monitors).
   - Until the screens settings store exists, read the screen list from a small
     default (본 화면 on the second monitor, if any) behind an interface, and
     mark it with a `TODO(0913vision)`.
2. **output-2, rendering a 장 and background video** (`feat/output/render`):
   - A second renderer entry for output windows (`src/renderer/output.html` and
     `src/renderer/src/output/`), added to `electron.vite.config.ts`.
   - `src/renderer/src/render/`: a layer renderer driven by the live state
     (`src/shared/live.ts`): the background media layer (looping video with no
     gap at the loop point) and the 장 text layer with the Look's lyric style
     defaults from `docs/spec/03-output.md`. Keep one video element and reuse
     DOM between 장, as `CLAUDE.md` asks for output windows.
   - Clears (F1 to F7 targets) and undo already exist in the live reducer; the
     output must reflect them within one frame.
3. Tests for every main-process piece (display changes, window lifecycle,
   relaunch) with the Electron parts behind small interfaces, and for the layer
   renderer in the renderer test project. Release every listener and window.

## Shared contracts

You may add to `src/shared/ipc.ts` (channels for output windows) and
`src/shared/live.ts` when the output needs it. List every shared change at the
top of your review request; the lead reviews those first. Validate every IPC
message with the schema library (`src/shared/schema/`, from data).

## Out of scope

- The 진행 workspace UI (shell), the file store (data), Looks editing, the 무대
  화면 layout, the 방송 자막 capture window, and NDI. Later milestones.

## Owned files

- `src/main/displays/`, `src/main/outputs/`, `src/renderer/output.html`,
  `src/renderer/src/output/`, `src/renderer/src/render/`, the output entry in
  `electron.vite.config.ts`, the wiring in `src/main/index.ts`, and the shared
  additions above.
- `docs/reviews/output-<number>.md`

## What to read

- `CLAUDE.md`, `docs/WORKFLOW.md`, `docs/MILESTONES.md` (M2 criteria)
- `docs/spec/03-output.md` (all of it), `docs/spec/01-concepts.md`,
  `docs/TECH.md` (process structure, quality bar, output path rules)
- `src/main/live/`, `src/shared/live.ts`, `src/shared/commands.ts`

## Done when

- Turning 본 화면 on opens its window on the right monitor, a 장 command shows
  the lyrics over a looping video, clears and undo reflect at once, an output
  window that crashes comes back, and unplugging the monitor doesn't stop the
  app. Both review requests are merged.

## How to verify

- `npm run verify`, and the app with your port and app data folder on two
  monitors if available. Never show error dialogs on the user's screen: check
  scripts with `node --check` and keep test windows offscreen.

## When you finish a request

Rebase onto the latest `main`, run `npm run verify`, write
`docs/reviews/output-<number>.md`, commit it, and send the lead:

```text
Review request: docs/reviews/output-<number>.md, branch feat/output/<feature>, commit <hash>
```
