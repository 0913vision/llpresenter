Review range: `feat/spec/media-strip-panel...feat/spec/media-strip-mount`

# Review request: `spec-38`

- Team member: `spec`
- Branch: `feat/spec/media-strip-mount`
- Base: spec-37 round 2, stacked until its approval
- Task: M3-S1b media strip mount and toolbar toggle
- Ownership exception: shell's renderer frame paths

## What changed and why

Mounted the real media strip panel in the 진행 frame and connected the toolbar
미디어 button. Closing it or leaving 진행 unmounts the panel and releases its
document/import feeds and previews. Panel problems go to the app's existing
notification list.

The strip starts open at heights of at least 900 DIP in normal and wide windows,
and closed in narrow or shorter windows. Resize follows that default until the
operator chooses; an explicit choice lasts for this control-window session.
Switching workspaces preserves that choice. 준비's separate media view remains
unavailable until P6a.

This is the display mount only. Persisting the choice waits for the lead's
data-41 merge announcement. Left-column collapse and the narrow 더 보기 tabs are
separate remaining S1b work. Toolbar search uses data-40 in a separate request.
No shared contract is added here.

Also carried the lead's 05:45 documentation request: spec 03 distinguishes the
initial fallback-window placement from later operator window switches. The app
never raises the fallback automatically or restores the old window order after
the operator switches windows. The explicit 창 보기 action is unchanged.

## Changed files

- `src/renderer/src/control/App.tsx`: window-owned visibility and toolbar/frame
  binding.
- `src/renderer/src/shell/Toolbar.tsx`: controlled media toggle, with an
  unavailable tooltip in workspaces without a handler.
- `src/renderer/src/shell/Workspace.tsx`: real panel and conditional mount.
- `src/renderer/src/shell/useMediaStripVisibility.ts`: size/height defaults and
  explicit session choice; releases its resize listener.
- `src/renderer/src/control/MediaStripMount.test.tsx`: real mounted panel,
  defaults, toggling, feed disposal, resizing, workspace switches, and one
  notification host.
- `docs/spec/03-output.md`: fallback-window ordering clarification.
- `docs/reviews/spec-38.md`: this request.

## Validation

The last scoped check passed 56 tests across six frame files, plus renderer
TypeScript, changed-file ESLint, Prettier, and `git diff --check`. The mounted
tests use a fake API and mocked output renderer; no Electron process or visible
window is started. No soak, timing, or memory measurement is run.

The final rebased HEAD and its GitHub CI URL/result accompany the review
request. Full verify runs only on GitHub, per the lead's instruction.

## Review focus

Check that hiding the strip disposes its feeds, the app keeps one notice host,
and explicit choices survive workspace switches and later resize events.
