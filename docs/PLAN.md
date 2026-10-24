# Implementation plan

Every phase ends with the lead's integration test and the user's check. Phases 1
and 2 set the shared contracts (folder structure, shared types, commands, UI
parts), so they aren't split. From phase 3 on, the work is split among work
sessions. Progress is tracked in `docs/STATUS.md`.

## Folder structure (settled in phase 1)

The tree uses the app's Korean names: the workspaces 진행 (Show), 준비 (Prep),
and 화면 설정 (Screen settings), the 예배 순서 (service order), the 틀
(template), and the 진행 도구 (show tools).

```text
src/
  main/              Main process
    live/            Live output state store, command handling, undo,
                     recovery record
    store/           File store (songs, 예배 순서, 틀, settings, media list),
                     autosave, backups
    displays/        Finding monitors, detecting connects and disconnects
    outputs/         Output window management (one window per screen)
    import/          Import conversion
    media/           Media analysis
    macros/          Macro execution
  preload/
  shared/            Shared types, command and IPC contracts, file schemas
                     (owned by the lead)
  renderer/src/
    ui/              Design system components (built in phase 1; changed
                     later only with the lead's approval)
    shell/           App shell: menu bar, toolbar, status bar, three-column
                     layout, window size ranges, column dragging
    show/            진행 workspace (진행 도구 tabs under tools/)
    prep/            준비 workspace
    screens/         화면 설정 workspace
    settings/        Settings and shortcut windows
    output/          Output window UI
    render/          Output rendering (layers, content type registry)
    state/           Renderer state
```

## Phases

### Phase 0: Handoff (done)

- `rewrite` starts empty. The first commit has no old code. It has only the
  document set (`CLAUDE.md`, `docs/`), the draft and design system sources
  (`design/`), and the repository rules (`.gitattributes`, `.gitignore`). The
  old code stays in `main` and in the git history.
- The early skeleton built before the drafts is in the local archive branch
  `archive/prototype-2026-10` (not pushed). When you build the initial scaffold,
  take only what's useful from it.

### Phase 1: Foundation (the lead builds the initial scaffold first, then team members build on it)

1. **Initial scaffold (lead):** From the lead's share below, the lead first
   builds the folder structure, the configuration and version pinning, the
   shared contracts (`src/shared/`), the design tokens, the app shell skeleton,
   and the dev environment variables, then commits them to `rewrite` and pushes.
   Every team member starts from this commit.
2. **Trial run (trial):** On top of the initial scaffold, trial runs the team
   workflow once with `docs/briefs/trial.md`.
3. **devops and the rest of the lead's share:** These run in parallel.

#### devops member (brief: `docs/briefs/devops.md`)

- Make `npm run verify` run the type check, lint, format check, unit tests, and
  build in one command. Use the same command before a review request and before
  a merge.
- Lint configuration (rules against type assertions that bypass checks, `any`,
  `!`, unreleased subscriptions, and similar), including rules that enforce the
  comment rules and TSDoc syntax. Vitest configuration and test helpers
  (temporary folders, a fake clock), and coverage reports.
- GitHub Actions configuration (`npm ci` and `npm run verify` on a Windows
  runner), stored in the repository. Pushing to GitHub happens only when the
  user asks, so until then the local `npm run verify` acts as CI.
- The skeleton of the soak test script for phase 2 (runs 장 (slide) changes and
  looping video for 60 minutes and records per-process memory and output fps).
- Owns: `.github/`, `scripts/`, the lint and Vitest configuration files, and
  `scripts` and the dev dependencies in `package.json` (allowed as an exception
  for this bundle only; the lead's review is required).

#### ui member (brief: `docs/briefs/ui.md`)

- The 16 shared design system components (`Button`, `IconButton`,
  `SegmentedControl`, `ToolbarButton`, `TextField`, `Select`, `Checkbox`,
  `Switch`, `Slider`, `Menu`, `Tooltip`, `Dialog`, `AlertDialog`, `Panel`,
  `ListRow`, `StatusMarks`) in `src/renderer/src/ui/`, with tests and a
  development gallery. Moved from the lead's share so that it runs in parallel.

#### lead

- Pin Electron to 44.9.x and pin every version exactly (`docs/TECH.md`).
- Restructure into the folder structure above. Move only what's useful from the
  early skeleton (`src/`): the configuration files and the idea behind the live
  output state store.
- Shared contracts: data format schemas (`.llsong`, `.llservice`, settings),
  live output state types, the command list, and the IPC channels.
- Bring the design tokens (`design/system/project/tokens.css`) into the app, and
  build the app shell and the shared parts among the 30 design system components
  (`Button`, `IconButton`, `SegmentedControl`, `TextField`, `Select`,
  `Checkbox`, `Switch`, `Slider`, `Menu`, `Tooltip`, `Dialog`, `AlertDialog`,
  `Panel`, `ListRow`, `StatusMarks`, `MenuBar`, `Toolbar`, `ToolbarButton`,
  `StatusBar`).
- App shell: switching among the three workspaces, the three-column layout, the
  three window size ranges, dragging and remembering column sizes, and the
  minimum window size.
- Dev environment: take the dev server port and the app data folder from
  environment variables (assignment table in `docs/WORKFLOW.md`), a log file,
  and logging of unhandled exceptions.
- Unit tests for the shared parts and the live output state handling.
- **Done when:** the three empty workspaces appear as the design system
  specifies, and the layout changes by the rules at 1280×720, 1920×1080, and
  2560×1440. `npm run verify` passes.

### Phase 2: Vertical slice (lead)

- Read one song file → 예배 순서 → thumbnails in 진행 → click → lyrics and a
  looping background video in the 본 화면 (main screen) output window.
- 지우기 (clear) F1 to F7, undo, turning output on and off, handling monitor
  connects and disconnects, relaunching a crashed output window, and the live
  output state recovery record.
- The first version of the UI tests (Playwright) and the soak test script.
- **Done when:** 60 minutes of continuous output (looping video, 장 changes) on
  two real monitors shows no stutter and no memory growth, and the app recovers
  in the failure tests (force-quitting an output window, unplugging a monitor,
  force-quitting the app).

### Phase 3: Feature bundles (three work sessions, in parallel)

| Session | Scope                                                                                                                                                                                                                                                                                                | Owned paths (proposal)                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| prep    | Library and search (including initial consonants), song editor, 이름표 (label) and the 이름표 list, 구성 (arrangement) presets, 예배 순서 item settings, adding songs, new service, 틀, importing from another service, switching 예배 순서, text and clipboard import                               | `renderer/src/prep/`, the song and 예배 순서 parts of `main/store/`, `main/import/`                        |
| output  | 화면 설정 (screen configuration, monitor layout, test pattern), Looks and the Look editor, the 무대 화면 (stage screen) and the stage layout editor, the 방송 자막 (broadcast captions) capture window, rendering the message, notice, prop, and timer layers, the live output state recovery dialog | `renderer/src/screens/`, `renderer/src/output/`, `renderer/src/render/`, `main/outputs/`, `main/displays/` |
| tools   | The 8 tabs of 진행 도구, the media workspace and the media strip, audio, macros (action palette, start macro), 퀵 실행 (quick launch), Bible verses                                                                                                                                                  | `renderer/src/show/tools/`, `main/media/`, `main/macros/`                                                  |

- Changes to the shared contracts (`src/shared/`) go to the lead as requests.
  The lead lands them on `rewrite` first, and then each branch is rebased onto
  it.
- **Done when:** the spec (`docs/spec/`) items of each bundle work, and that
  bundle's unit tests and UI tests pass. After the lead integrates the bundles,
  the 60-minute soak test passes again.
- (Optional) Add Codex as a read-only outside reviewer that reviews branches
  before they're merged.

### Phase 4: Polish (polish session)

- Settings, shortcut editing with conflict warnings, details for narrow and wide
  windows, problem notifications (monitor disconnected, media missing),
  accessibility (keyboard navigation, focus), and performance.
- **Done when:** every item in the design system and the spec is checked against
  a checklist, and one real service rehearsal is done.

### Phase 5: Later features

- NDI output (alpha channel), an installer, PowerPoint import, sheet music
  display, and camera input. For each one, decide the approach with a spike
  before you start.

## Sessions

| Name                | Phase                          | Location and branch                                                              | Role                                                                                                                                                                           |
| ------------------- | ------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| lead                | 0 to the end                   | Main repository folder, `rewrite`                                                | Team lead. The session that handled phase 0 continues in this role. Builds the initial scaffold and phase 2 directly, starts team members, reviews, and merges by fast-forward |
| trial               | 1 (after the initial scaffold) | Own worktree, `rewrite/trial`                                                    | Trial run. Goes once through the flow from review request to fast-forward merge                                                                                                |
| devops              | 1                              | Own worktree, `rewrite/devops`                                                   | Check command, lint, test configuration, GitHub Actions configuration, soak test script skeleton                                                                               |
| ui                  | 1                              | Own worktree, `rewrite/ui`                                                       | Shared design system components, their tests, and the gallery                                                                                                                  |
| Reviewer            | Every review request           | A read-only review agent that the lead starts fresh for each review; later Codex | Independent review and approval                                                                                                                                                |
| prep, output, tools | 3                              | Own worktree, `rewrite/<name>`                                                   | Feature bundles                                                                                                                                                                |
| polish              | 4                              | Own worktree, `rewrite/polish`                                                   | Polish                                                                                                                                                                         |
| review (optional)   | From 3 on                      | Read-only, low-cost model                                                        | Review before a merge                                                                                                                                                          |

At most three work sessions run at the same time (this computer has 32 GB of
memory and 8 logical cores).
