# Technical decisions

This app must not stop during a service. Every technical choice first asks:
"Does the output keep running during a service?" Before you add a feature, add a
library, or upgrade a version, record the reason in this document and in
`docs/decisions.md`.

## Principles

1. **Output comes first.** Output windows must never stop because of other work,
   such as the control window, saving files, importing, or analyzing media. Do
   heavy work in a process other than the output.
2. **Keep dependencies few and pin exact versions.** Write exact versions in
   `package.json`, without `^`, and commit `package-lock.json`. Upgrade versions
   only in a week without a service, after the checklist below.
3. **Decide when it's needed.** For features we don't use yet (NDI, PowerPoint,
   sheet music, camera), choose the library in that phase with a short spike.
   Choose by "Criteria for adding a dependency" below.
4. **Extend through registries.** A new content type, output target, macro
   action, import format, or input device must take only one new entry in its
   registry. Don't change existing code to wedge it in.
5. **Work without the internet.** Don't rely on the network during a service.
   Bundle the Bible text and fonts with the app. Update only when the user
   clicks, and never during a service.

## Stack

| Area            | Choice                                                          | Version policy                                            | Reason                                                                                                                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App framework   | Electron                                                        | Pinned to 44.9.x (lowered from 45.0.0 in phase 1)         | 45.0.0 is the first release, out on October 21, 2026. 44 has reached its ninth patch and is within its support period. Upgrade to 45 after a few patches, in a week without a service, after the checklist                                                                          |
| Build           | electron-vite 6, Vite 8                                         | Pinned exactly                                            | Builds main, preload, and renderer with one configuration. It's a tool that doesn't affect runtime stability                                                                                                                                                                        |
| Language        | TypeScript 7, strict                                            | Pinned exactly                                            | Used for type checking only (`tsc`, TypeScript 7). Lint runs typescript-eslint, which supports only up to TypeScript 6.0, so `typescript` is aliased to `@typescript/typescript6` for lint and the editor, and TypeScript 7 is installed as `@typescript/native` and provides `tsc` |
| UI              | React 19                                                        | Pinned exactly                                            |                                                                                                                                                                                                                                                                                     |
| Styling         | CSS Modules and design tokens (CSS variables in `tokens.css`)   |                                                           | We build the design system components ourselves instead of using a UI library, to match the look exactly and to stay unaffected by changes in outside libraries                                                                                                                     |
| Renderer state  | Zustand 5                                                       | Pinned exactly                                            | Holds only the copy of the live output state that the main process sends and the state inside the window (selected row, open menu)                                                                                                                                                  |
| Panel resizing  | react-resizable-panels 4                                        | Compare with building it ourselves in phase 1             | We need dragging between columns and remembering sizes per window size range                                                                                                                                                                                                        |
| Font            | Pretendard Variable (OFL), bundled with the app                 |                                                           |                                                                                                                                                                                                                                                                                     |
| Icons           | Phosphor Regular (MIT), 86 icons, `design/system/upload/Icons/` | Decide how to include them in phase 1 (SVG as components) | Use only the same set as the design system                                                                                                                                                                                                                                          |
| Data validation | valibot 1.5.0                                                   | Pinned exactly                                            | Validates formats when files are read and IPC messages arrive. Smallest of zod, zod/mini, valibot, and arktype (2.7 KB gzip for the song schema), keeps unknown fields, has brands and exact optional fields, and reports the field path. Only `src/shared/schema/` imports it      |
| Logging         | One rotating log file (electron-log family)                     | Decide in phase 1                                         | Lets us see what happened after a service                                                                                                                                                                                                                                           |
| Formatting      | Prettier with Google `gts` defaults (`.prettierrc.json`)        | Pinned exactly                                            | Formats code, CSS, JSON, and Markdown the same way in every session. Settings are in `CLAUDE.md`                                                                                                                                                                                    |
| Unit tests      | Vitest                                                          | Add in phase 1                                            | Models, conversions, live output state handling                                                                                                                                                                                                                                     |
| UI tests        | Playwright's Electron support                                   | Add in phase 2                                            | Core flows such as opening a song, output, and clearing                                                                                                                                                                                                                             |

## Process structure

The diagram uses the app's Korean names for the workspaces, the screens, and the
예배 순서 (service order, the item list of one service). The workspaces are 진행
(Show), 준비 (Prep), and 화면 설정 (Screen settings). The screens are 본 화면
(main screen), 무대 화면 (stage screen), and 방송 자막 (broadcast captions).

```text
Main process
  Live output state store (the single source of truth) ← runs commands in order
  File store (songs, 예배 순서, settings, media list, autosave, backups)
  Display management (finds monitors, detects connects and disconnects)
  Output window management (one window per screen; relaunches a crashed
    window and restores its state)
  Recovery record (writes the live output state to disk at short intervals)
Control window (renderer): 진행, 준비, 화면 설정
Output windows (renderer): 본 화면, 무대 화면, 방송 자막 capture window, each
  separate
Utility process (utilityProcess): media analysis, import conversion, later
  NDI sending
```

- The control window and the output windows don't change the live output state.
  They send commands (`{type, payload}`) to the main process, and the main
  process sends the new state it produced (with a revision number) to every
  window.
- Commands run one at a time, in order. That way undo, logging, and recovery
  share the same path.
- Output windows never open dialogs. An error in an output window is only
  logged, and the window keeps the last good frame.
- When an output window process dies (`render-process-gone`), the main process
  relaunches it and sends the current state. The control window reports it only
  in the status bar and with a notification.
- Native modules (NDI and others) run only inside the utility process. If native
  code crashes, the output windows and the main process stay alive.

## Registries (extension points)

| Registry                                         | In v1                                                 | Later                                        |
| ------------------------------------------------ | ----------------------------------------------------- | -------------------------------------------- |
| Content types (what's drawn inside a 장 (slide)) | Lyrics, Bible verses, text                            | Sheet music, camera input elements           |
| Layers                                           | Background media, 장, props, audio, messages, notices |                                              |
| Output targets                                   | Monitor windows, capture window                       | NDI                                          |
| Macro actions                                    | The actions in the action palette of the macro board  | New actions, such as turning on camera input |
| Import formats                                   | Text files, clipboard text                            | PowerPoint                                   |
| Input devices                                    | (None)                                                | Cameras (USB capture, NDI input)             |
| Media types                                      | Video, images, audio                                  | Video input                                  |

Each registry entry registers a type name, a data format (schema), a renderer
(the drawing side), and an editor (property fields) as one bundle.

## Storage

- Songs (`.llsong`) and 예배 순서 (`.llservice`) are JSON files. App-wide
  settings are JSON files too. The formats are in `docs/spec/02-data.md`.
- To write a file, write a temporary file, flush it to disk, then rename it to
  the original name. A power cut in the middle never leaves a half-written file.
- Keep a few earlier versions of each file as backups (proposal: 5).
- Every file carries a format version, and reading converts old versions to the
  new one (migration). Unknown fields aren't deleted; they're written back as
  they are.
- If a file has a bad format, don't touch the original. Skip only that file,
  keep running with the rest, and report it in a notification.
- To keep search fast even with thousands of songs in the library, keep an index
  of titles, lyrics, and initial consonants in memory (phase 3 decides the
  method).

## Media

- Video uses Chromium's video playback. A looping background alternates between
  two video elements so that it joins without a gap. The next background is
  loaded ahead of time.
- A phase 1 test decides the supported formats (proposal: H.264 MP4, VP9 WebM).
  Check the format and duration on import, and report files that can't play at
  that point.
- Turn on hardware acceleration. Measure the output window frame rate and show
  it in the status bar.

## Quality bar

A review request is approved only when it meets everything below. The review
template (`docs/reviews/_template.md`) has the same checklist.

### Preventing runtime errors

- On top of TypeScript strict mode, turn on `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` (phase 1).
- Don't use `any`, type assertions that bypass checks, or `!`. Lint blocks them.
- Validate values that come from outside, such as files, IPC messages, the
  clipboard, and media metadata, with a schema. When validation fails, drop only
  that value and log it.
- Return the result of work that can fail (reading files, opening media, finding
  monitors) as a result type (success, or failure with a reason). Never throw
  exceptions across IPC.
- The main process catches and logs unhandled exceptions and rejections, and
  keeps running. Wrap the UI parts of the control window in error boundaries, so
  that an error in one part doesn't blank the whole window.
- Output windows keep the last good frame even when rendering throws an error.

### Tests

- The data model, format conversion and migration, import conversion, live
  output state handling, macro execution, and autosave and recovery must have
  unit tests.
- When you fix a bug, first add a test that reproduces it.
- Test live output state handling in the form "given a sequence of commands, the
  expected state comes out." Also add a test that random command sequences don't
  break the state.
- Write tests that are fast (the whole unit suite runs in under 1 minute),
  independent of each other, and that never touch real user folders (use
  temporary folders).
- From phase 2 on, UI tests (Playwright Electron) check the core flows
  automatically.

### Memory

- Release everything you register: event subscriptions, timers, IPC listeners,
  `URL.createObjectURL` results, video and audio elements, windows, and utility
  processes.
- Output windows reuse a fixed number of video elements (two for the looping
  background and one for the next background). When a video is done, clear its
  source (remove `src`, then call `load()`) to give back decoder memory.
- Make thumbnails and preview images at their displayed size, and keep them in a
  cache with a size cap.
- Cap the size of lists such as logs, undo history, and recent items.
- Soak tests record the memory of the main process, the control window, and the
  output windows separately. If memory keeps growing for 60 minutes, the test
  fails.

### Performance

- Aim to show a 장 in the output window within one frame of the click (measure
  and record it).
- Output windows must hold 60 fps. If the fps in the status bar drops, find the
  cause.
- Don't read or write files synchronously in the main process (except reading
  settings at startup).
- The control window re-renders only what's needed. Select only the values you
  need from the state store, and render only the visible part of long lists
  (library, media).
- Move heavy work (import conversion, media analysis, building the search index)
  to the utility process, or split it into small chunks.

### Code health

- Follow the clean code rules, the comment rules, and the modern language
  features in `CLAUDE.md`. Reviewers request changes when a rule is broken.
- `npm run format:check` passes.

## Verification

- **Unit tests:** the data model, format conversion, import conversion, and live
  output state handling (given commands, does the expected state come out).
- **UI tests:** from phase 2 on, run the core flows automatically.
- **Soak test:** from phase 2 on, in every phase, run looping video and 장
  changes automatically for 60 minutes on real monitors, and record changes in
  memory and frame rate.
- **Failure tests:** force-quit an output window process, unplug a monitor,
  force-quit the app while it saves, delete a media file, and load a broken song
  file. Check that the app recovers from each.
- **Version upgrade checklist:** the type check and unit tests pass, the UI
  tests pass, a 60-minute soak test, the failure tests, and an output window
  frame rate comparison. If anything gets worse, don't upgrade.

## Criteria for adding a dependency

Add a new library only when it meets all of the following, you've recorded it in
`docs/decisions.md`, and the lead has approved it.

- It's actively maintained (a release within the last year), and its license
  fits this project.
- If it's in the output path, it must be pure JavaScript. Native modules run
  only inside the utility process.
- It sits behind one small wrapper in our code, so that replacing it later means
  changing only the wrapper.
- If we can do the same thing in a few dozen lines, we do it ourselves.

## Operating rules

- Don't install a new version on the day before a service or on the day of a
  service.
- There are no automatic updates. The user installs new versions by hand.
- Crash records stay on this computer only (they're never sent out).

## To be decided

| Item                                                          | Phase                             |
| ------------------------------------------------------------- | --------------------------------- |
| Initial consonant search method                               | Phase 3 (prep)                    |
| Bible text sources (format decided in `docs/spec/02-data.md`) | Phase 3 (tools), the user decides |
| NDI sending (comparing native module candidates)              | Phase 5                           |
| Building the installer                                        | Phase 5                           |
| PowerPoint reading, sheet music rendering, camera input       | The phase of each feature         |
