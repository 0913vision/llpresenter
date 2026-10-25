# Review request: `output-27`

- Team member: `output`
- Branch: `feat/output/look-slice`
- Base: `c581dd45` (`main`); range: `c581dd45..feat/output/look-slice`.
- Scope: M3-O4 part 1, lyric rendering and additive Look contracts, plus the
  output-26 shutdown-marker nit.
- Code CI:
  [Windows verification passed](https://github.com/0913vision/llpresenter/actions/runs/40238729512)
  at `cba48305`. The final rebased head, including this result and the two UUID
  boundary tests, is pushed and checked again before the review request.

## Changes

`LiveState.lookId` is an optional, nullable branded Look UUID. Older states
without it still parse unchanged. Explicit `undefined`, non-v4 IDs, malformed
values and IDs longer than 36 characters are rejected. No existing field or
command is removed or changed.

The main-only `selectLook` port validates its input, checks that the saved Look
exists and uses the settings store's revisioned writer to change only
`looks.current`. It preserves unknown fields, uses the latest revision for
concurrent selections and skips a repeated selection without writing. Read-only
files, unavailable settings, disposal and save errors return classified results.
The existing writer's debounce is reused; there is no new cache or list.

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

## Changes outside my paths

- `src/shared/live.ts`: additive optional `lookId` field for the active Look.
- `src/shared/schema/liveState.ts`: validate and retain the new optional field.
- `src/shared/schema/liveState.test.ts`: valid and invalid states, including
  legacy omission and the existing 36-character UUID cap.
- `src/shared/schema/ids.ts`: a Result-returning Look ID parser so main does not
  import the schema library outside `src/shared/schema/`.
- `src/main/store/settingsAccess.ts`: a main-only selection port backed by the
  existing settings writer, preserving the read-only reader interface.
- `src/main/store/settingsLookSelection.test.ts`: real in-memory settings-store
  coverage for selection, revision, preservation and failure handling.
- `src/main/store/register.ts`: expose the selection port to the live backend.

These are the additive Look contracts assigned to output by the lead's 07:00
queue change. No preload, shell or UI file is changed.

## Verification

- 145 tests across nine relevant files passed in 4.72 seconds. Typecheck,
  targeted ESLint after Prettier and whitespace checks passed.
- The new port tests cover two concurrent selections with sequential revisions,
  one debounced write, preserved nested unknown fields, repeated selection,
  malformed and missing IDs, read-only settings, disposal during loading,
  unavailable settings and a failed save that retains the in-memory change.
- Both the live-state field and the main selection port reject a valid UUID
  followed by a newline. These boundary tests confirmed the existing ID schema
  already enforces the cap, so the stored ID contract is unchanged.
- Five regressions failed against the actual old slide/fit implementations:
  reference effects at three resolutions, immediate style changes and whole
  pixel sizing. The old files were restored in `finally`, then the corrected
  suite passed. No deliberately hanging old-input case was run.
- Tests use jsdom layout stubs and main-process fakes. No local Electron,
  visible window, soak, memory measurement or full verify was started.

## Following work

This request provides O4's renderer groundwork and its additive contracts. The
Look slice, visibility masks and live output wiring follow in the next O4
request; this request does not claim the complete O4 acceptance. When data-42's
recovery record contract merges, O8 takes priority, then O4 continues. The close
handshake is no longer in output's queue; data owns it as data-44.

## Review

Awaiting the lead and independent reviewer.
