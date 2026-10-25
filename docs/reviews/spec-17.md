# Contract request: `spec-17`

- Team member: `spec`
- Branch: `feat/spec/song-background`, from `main`
- Base commit (`main`): `3a83ee2`
- Task: `.llp/task.md`, song background on slide output
- State: waiting for the lead before implementation

## Why the existing projection needs a field

`ShowService` carries rows, slide tiles, and jump keys, but no song-item
background. `buildShowService` drops both the service item's background override
and the song's default background. The renderer cannot select the resolved
background from this projection.

The document APIs can read the raw song and service, but they expose neither the
media playback settings nor the file's availability. Rebuilding the projection
in the renderer would also duplicate the main process's resolution and revision
handling. `LiveStore` currently has no content-store resolver.

The task explicitly says to stop and report the exact shape before changing a
shared contract. No application code has been changed.

## Requested shared shape

Add one optional field to song rows in `ShowService`, validated by
`src/shared/schema/showService.ts`:

```ts
readonly background?: {
  readonly mediaId: string;
  readonly loop: boolean;
};
```

This is the existing `MediaChoice` shape. Validate the ID and boolean at the IPC
boundary. Existing rows without the field remain valid. Other row kinds must not
acquire automatic song-background behavior. No live command, IPC channel, or
on-disk format change is requested.

The data owner would populate this field in the main-side show projection:

- Resolve `item.background ?? song.background`. An invalid or missing override
  must not silently fall back to the song's default.
- Use the resolved media's existing playback-end setting for `loop`, including
  its documented default.
- Include the field only when the selected background can be served from an
  allowed media location. A missing entry, missing file, or refused file keeps
  the field absent and sets the existing row problem `missing-background`.
- With no configured background, omit the field without a missing-background
  problem. A missing song continues to use `missing-song`.
- Changes to the resolved background or its availability must participate in the
  show projection's revision and push behavior.

The projection work needs the data owner's `src/main/store/` paths, including
`showService.ts`, `openServiceFeed.ts`, and their data-loading wiring and tests.
These paths are outside this task's current ownership exception. The lead can
have the data owner land this small prerequisite, or explicitly extend the
exception to its implementation and tests.

## Implementation after the prerequisite

Use the existing `media.show` command when entering a song item with an
available background, followed by the existing `slide.show` command. Preserve
the background for another slide of the same item, a backgroundless item, a
Bible slide, or quick launch. The existing main-side `showMedia` already keeps
`startedAt` for the same media ID, so the feature must retain and test that
behavior.

For a background missing at activation, keep the current media and output the
lyrics, with the existing row warning. Check the availability again at
activation if the projected value can have become stale; the existing media
serving path already rejects unknown, missing, and out-of-root files. The
implementation must cover this failure without clearing the current media.

Tests will cover override precedence, default background, no background,
same-media continuity, same-item navigation, quick launch, Bible slides, and
missing media. The offscreen check will use a private copy of
`docs/qa/m2-check/sample`. Run the full verification once after implementation.

## Checks so far

- Read the task, output and problem rules, current projection, preload API, live
  reducer, media lookup/serving path, and QA sample configuration.
- Created the requested branch from clean `main` at `3a83ee2`.
- Only this contract request and ignored working notes changed.
- Full verification and the native sample check have not run: implementation is
  waiting for the task's explicit shared-contract stop point.
