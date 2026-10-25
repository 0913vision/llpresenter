# Review request: `output-27`

- Team member: `output`
- Branch: `feat/output/look-slice`
- Base and range: updated after rebasing.
- Scope: M3-O4 rendering groundwork and the output-26 shutdown-marker nit.
- CI: pending the branch push.

## Changes

Lyric shadow and outline switches now use spec 03's fixed reference values: 3 px
outline, 4 px shadow offset down and right, 8 px blur and 60% opacity. The pixel
values scale from 1920 x 1080 with the text, independently of its fitted font
size. Their previous em values and 70% opacity are removed.

Style edits update both retained pages at once, without a dissolve. The next
slide still uses the normal dissolve. Font family names are escaped as CSS
strings and retain the bundled Pretendard Variable fallback. Slide and
background durations now come from one `OUTPUT_TRANSITIONS` constant with the
fixed spec defaults.

Shrink-to-fit now starts from a whole pixel size, floors fractional scaled
sizes, and bounds extremely large or overflowing values to safe integers. Its
binary search remains bounded and the original lines are never split.

The output-26 nit is documented at launch: the shutdown save limit can expire
before marker cleanup, so a retained marker is not proof of a process crash. The
launch warning names crash, save-limit expiration and cleanup failure as
possible causes. The opaque marker cannot distinguish those causes; the log does
not claim a more precise diagnosis than the available evidence supports.

## Changed files

- `src/renderer/src/render/{lyricStyle,slideLayer}.ts` and `layers.module.css`:
  reference effects, scaling, immediate style application and safe font-family
  strings.
- `src/renderer/src/render/{transitions,backgroundLayer}.ts`: one transition
  default source, retaining the existing exported duration names.
- `src/renderer/src/render/fitText.ts` and its test: integer sizes and bounded
  search for large inputs.
- `src/renderer/src/render/slideLayer.test.ts`: style/page retention, fallback,
  switch values, line-count refitting and 720p/1080p/2160p behavior.
- `src/main/index.ts`: the shutdown-marker NOTE and honest launch diagnostic.

No shared, preload, store, shell or UI file is changed.

## Verification

- 106 tests across six relevant files passed in 3.53 seconds. Typecheck,
  targeted ESLint after Prettier and whitespace checks passed.
- Five regressions failed against the actual old slide/fit implementations:
  reference effects at three resolutions, immediate style changes and whole
  pixel sizing. The old files were restored in `finally`, then the corrected
  suite passed. No deliberately hanging old-input case was run.
- Tests use jsdom layout stubs and main-process fakes. No local Electron,
  visible window, soak, memory measurement or full verify was started.

## Following work

This is the independent rendering portion of O4. The Look slice, active Look in
live state, saved `looks.current` selection, visibility masks and live output
wiring follow data's `LiveState.lookId` and `selectLook` port. The lead assigned
those contracts to data after its recovery record contract. When the recovery
contract merges, O8 takes priority, then O4 continues.

## Review

Awaiting the lead and independent reviewer.
