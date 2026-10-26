# Review request: `data-60`

- Team member: data (Codex takeover of the Claude implementation)
- Branch: `feat/data/media-preview`, stacked on data-59 round 2
- Base commit: `a3feb01e`; the request reports the head, range and CI URL.
- Related brief: `docs/briefs/data.md`; M3-P6b part 4, preview player and 파일
  위치 열기 (spec 05, Media view).

## What changed and why

The media properties panel now previews the selected file above its properties
and information. Video and audio play in the control window with the saved
range, end rule, speed, sound and volume. The transport shows play or pause,
position and remaining time. Images show their picture without transport; audio
shows its icon. The file name, path and 파일 위치 열기 remain visible. The
player uses `mediaUrl` and never sends an output command.

The selected range restarts both at its explicit end and at the native file end
for 반복. 멈춤 returns the transport to play. Playback rejection is logged.
Changing selection, unmounting, or marking a file missing releases its media
element with pause, source removal and load. A file restored by relinking gets
the saved sound, volume and speed, and its replacement element is released on
unmount. Missing-file controls are unavailable and explain why in tooltips.

파일 위치 열기 sends only a schema-checked media ID. Main resolves the ID in the
media store and applies `realPathInside` against the library folders before
calling `shell.showItemInFolder`. A renderer cannot supply a path. Missing or
out-of-root files do not open. Offscreen mode suppresses the Explorer action, as
it suppresses native import dialogs, so tests never open visible windows.

## Changed files

- `src/shared/schema/mediaFiles.ts` and tests: bounded reveal request.
- `src/shared/ipc.ts`, `src/preload/index.ts`, preload tests and the fake API:
  additive `media:reveal` and `LlpApi.media.reveal(mediaId)`.
- `src/main/media/register.ts` and tests: ID resolution, real path containment,
  offscreen refusal and listener cleanup. `MediaBackendStore` exposes roots.
- `src/renderer/src/prep/media/MediaPreviewPlayer.tsx`, its styles and tests:
  preview, transport and media element lifecycle.
- `MediaPropertiesPanel.tsx`, its test and `mediaLibrary.ts`: mount the player
  for the effective selection and send reveal requests.
- `mediaProps.ts`: share speed bounds with the properties panel, which retains
  its existing bound exports.

## Changes outside my paths

- `src/main/media/` and `src/renderer/src/prep/media/` (prep, no member):
  assigned to data for P6a and P6b. The remaining shared and preload changes are
  data's paths.

## Shared contract changes

Additive `Channels.mediaReveal`, `MediaRevealRequest` and
`parseMediaRevealRequest`, plus `LlpApi.media.reveal(MediaId)`. The payload uses
the existing UUID schema; unknown fields are dropped. Main revalidates it and
accepts no renderer-supplied file path. Existing contracts are unchanged.

## Round 1 checks

| Check                                       | Result                                       |
| ------------------------------------------- | -------------------------------------------- |
| `npm run typecheck`                         | Pass                                         |
| Targeted Vitest with `--no-fsModuleCache`   | Pass: 120 tests in five files after restack  |
| ESLint on changed TypeScript files          | Pass                                         |
| `npm run format` and `npm run format:check` | Pass                                         |
| Full `npm run verify`                       | GitHub CI on the request head; URL in report |

Coverage includes video play and pause, saved playback properties, range end
behavior, natural file end, position and time left, images, missing files and
their tooltips, playback rejection, release on unmount or missing-file changes,
restoration and replacement release, panel reveal wiring, valid and invalid
preload/schema input, reveal inside roots, refusal outside roots or for a
missing file, offscreen suppression and IPC listener removal.

No native window or dialog was opened. Browser media playback is simulated in
unit tests; native decoding, audible sound and a visible Explorer window need
the user's normal-mode build check.

## Quality checklist

- [x] New behavior has unit coverage.
- [x] External IPC input is schema checked in preload and main.
- [x] Reveal paths are checked in main after following filesystem links.
- [x] Media elements and the reveal listener are released.
- [x] No dependencies, caches, unbounded lists or output-state changes.
- [x] UI strings are Korean and styles use the existing tokens.
- [x] Comments follow the repository rules.
- [ ] Full GitHub verify must be green before requesting review.

## Decisions I made

1. Reveal is suppressed in offscreen mode to preserve the no-visible-window test
   rule. Normal mode opens the containing folder through Electron.
2. A missing file disables play and reveal; the existing 다시 연결 action stays
   on its tile. The panel follows data-59's constrained playlist selection.

## Stack comparison

Both original implementation commits compare equal after restacking on data-59
round 2. Before requesting review, the takeover adds natural-end handling,
missing-file lifecycle coverage, playback refusal logging and disabled reasons,
plus the offscreen reveal guard and this document.

After data-58 merged and data-59 moved to current main, all three preview
commits again compared equal when restacked on data-59's new head. Only the base
metadata and subsequent check result are updated after that restack.

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1. StrictMode: the source-owning effect now restores the media URL and calls
   load when setup finds the source missing. It still pauses, removes the source
   and loads on cleanup. Normal setup avoids a redundant load when the source is
   already set. Video and audio regressions mount under StrictMode, check the
   source and play control after the cleanup/setup probe, and verify release on
   final unmount.
2. Playback rate: apply the properties panel's shared 0.25 to 4 range to the
   element while preserving the saved value. A failed assignment is logged and
   retried at the default 1x speed; a failed fallback is also logged and cannot
   escape the effect. Tests cover saved speeds 0.001 and 100, rejection of an
   otherwise bounded value and rejection of the fallback. The existing
   property-panel bound exports remain available.

## Round 2 checks

All six new regressions failed against round 1 before applying the fixes: both
StrictMode sources were absent, both saved speeds were unbounded, and engine
assignment errors escaped rendering. They pass with the fixes.

| Check                                       | Result                                   |
| ------------------------------------------- | ---------------------------------------- |
| Targeted Vitest with `--no-fsModuleCache`   | Pass: 38 tests in three files            |
| `npm run typecheck`                         | Pass                                     |
| ESLint on changed TypeScript files          | Pass                                     |
| `npm run format` and `npm run format:check` | Pass                                     |
| Full `npm run verify`                       | GitHub CI on round 2 head; URL in report |
