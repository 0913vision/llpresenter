Review range: `589e7b59...feat/spec/media-strip-mount`

# Review request: `spec-38`

- Team member: `spec`
- Branch: `feat/spec/media-strip-mount`
- Base commit: `589e7b59`, main after spec-37 and the ownership rule change
- Review round: 1
- Task: M3-S1b media strip mount and saved panel state

## What changed and why

Mounted the real media panel in 진행 and connected the toolbar 미디어 button.
Closing it or leaving 진행 unmounts the panel and releases both media feeds and
its previews. Panel problems go to the app's one notification list.

Without a saved choice, the strip starts open at heights of at least 900 DIP in
normal and wide windows, and closed in narrow or shorter windows. Resize follows
that default until the operator chooses. An explicit choice is saved as
app.json's existing mediaStrip boolean and restored before the first render; it
wins the size/height default, including false. Resizes and workspace switches do
not write the file. A failed send logs its cause and keeps the local choice
without changing output. 준비's separate media view remains P6a work.

The first commit adds the shared contracts and main/preload path: UiState now
exposes mediaStrip, ui.setMediaStrip({visible}) updates it, and layout accepts
an optional leftCollapsed boolean per size class, alone or with existing fields.
The existing width pair and numeric ranges stay intact. Commands are bounded to
one media boolean or the three known layout size classes; no collection is
added. Invalid booleans are rejected, unknown IPC fields are dropped, and file
fields are preserved with data's existing schemas. These additions are feat.

The main UI store hands both changes to the existing AppConfigFile. There is one
app.json writer. Tests save panel state alongside service id, zoom, widths, and
unknown fields and reopen the file to confirm all survived. The narrow collapse
control and 더 보기 tabs follow separately, using the new layout field. Toolbar
search uses data-40 in its own requests.

Also carried the lead's small spec 03 request: the initial fallback placement
does not make the app raise it automatically or restore the old window order
after the operator switches windows. The explicit 창 보기 action stays intact.

## Changes outside my paths

These paths are kept by their code owners under the new rule:

- `src/shared/schema/appConfig.ts` and `.test.ts`: optional stored sidebar
  boolean, old-file compatibility, and valid/invalid tests.
- `src/shared/schema/uiState.ts` and `.test.ts`: UI read and command schemas,
  additive types, boolean checks, unchanged numeric bounds and paired widths.
- `src/shared/ipc.ts`: the typed media visibility method and one new channel.
- `src/shared/testing/fakeLlpApi.ts`: default no-op for the additive method.
- `src/preload/index.ts` and `.test.ts`: validate and send the new command,
  accept saved UI flags, and reject malformed reads/requests with logging.
- `src/main/uiState/uiStateStore.ts` and `.test.ts`: validate panel changes and
  merge them through the existing shared app fields.
- `src/main/uiState/register.ts` and `.test.ts`: register/release the new
  channel and test both saved flags.
- `src/main/store/appConfigFile.test.ts`: prove persistence and coexistence
  through the existing single writer; no data-store implementation is changed.
- `src/renderer/src/control/main.tsx` and `.test.ts`: pass the loaded state to
  the app before first render and test that handoff.
- `src/renderer/src/control/App.tsx`: bind loaded visibility to toolbar/frame.
- `src/renderer/src/shell/Toolbar.tsx`: controlled media toggle and its
  unavailable reason outside supported workspaces.
- `src/renderer/src/shell/Workspace.tsx`: real panel and conditional mount.
- `src/renderer/src/shell/useMediaStripVisibility.ts`: size/height defaults,
  saved choice, explicit-only persistence, and resize listener cleanup.
- `src/renderer/src/control/MediaStripMount.test.tsx`: mounted defaults,
  restoration, saving, failed send, feed disposal, resizing, workspace switches,
  and one notification host.

The spec 03 clarification and this review document are in my own paths. No
dependency is added.

## Validation

- Contract/main/preload tests: 163 tests pass in six files.
- Mounted renderer and startup tests: 60 tests pass in seven files.
- Both TypeScript checks, changed-file ESLint, Prettier, and diff checks pass.
- Final submitted HEAD's successful GitHub CI URL accompanies the request.
- Local full verify is not run, per the lead's rule. No Electron process,
  visible window, soak, or memory measurement is started.

## Review focus

Check restoration of false before render, explicit-only writes, independent
sidebar merges with the old width bounds, the single writer, and feed disposal
when hiding the strip.
