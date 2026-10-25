Review range: `afe945cd...feat/spec/show-media-strip`

# Review request: `spec-36`

- Team member: `spec`
- Branch: `feat/spec/show-media-strip`
- Base commit: `afe945cd`, main after the M2 freeze and version 0.14.0
- Review round: 2
- Task: M3-S1b, media strip data and preview component boundary
- Ownership exception: shell's renderer paths and the two UI changes below

## What changed and why

Added the media strip's data controller on data-34's document and import feeds.
It keeps only newer media revisions, so a slower startup read cannot overwrite a
push. Active copy jobs block output; completion, cancellation, and failure
release them. Failed jobs report their file name and log their cause. The job
map is bounded by the shared media limit, and unmount releases both feeds.

Activation sends only `media.show`, using the canonical item's playback end
rule, and excludes audio. It leaves live confirmation to main. Preview errors
are accepted only for the current media-document revision. A missing preview
prevents output and explains unavailable relinking; a newer document clears the
error so a replacement can load. Read and transport errors go through the host's
problem callback. Late callbacks after unmount do nothing.

The lead explicitly allowed widening MediaTile.picture from string to
`string | ReactElement`, so the host can supply a paused video while keeping the
existing duration, copy, and missing-file visuals. URL strings retain the
existing image behavior. MediaStrip now passes `workspace="show"` to TileList,
matching its documented focus context.

## Changed files

- `src/renderer/src/show/useMediaStrip.ts` and its test: document/copy feeds,
  output activation, current-preview failure guards, and resource cleanup.
- `src/renderer/src/show/mediaCopyJobs.ts` and its test: active-job transitions
  and the shared cap, including progress and slot release while full.
- `src/renderer/src/ui/MediaTile.tsx`: only the allowed picture type/render
  change, stable-element TSDoc, and MediaStrip's workspace prop.
- `src/renderer/src/ui/MediaTile.module.css`: the round-2 requested child fill
  rules for the preview slot.
- `src/renderer/src/ui/MediaTile.test.tsx`: video-slot, missing-frame, and strip
  context regression coverage.
- `docs/reviews/spec-36.md`: scope, checks, and the accepted UI-state request.

No other UI file changed. The design-system MediaTile README has no props table
naming picture's type, so no type-table correction was needed.

## Round 2 response

The element slot now sits in the same picture wrapper as image previews; its
children fill the wrapper at 100% width and height with object-fit cover. The
video test checks that shared wrapper and that missing-file state hides the
element. The prop TSDoc asks the host to keep elements stable with useMemo so
MediaTile's memoization can skip unchanged previews.

Relink warning meta now contains the item's name, matching the copy warning's
file-name value. Removed the unused import/unavailable constants. One local
warningNotice function builds every warning. The initial read uses async/await,
and a separate progress handler keeps the subscription effect short. The cap
regression fills the map to MEDIA_LIMITS.items, refuses a new id, advances an
existing job at the cap, and accepts a new job after a terminal event frees a
slot. It uses the real shared limit.

The duplicated playback-end rule is unchanged, as the lead assigned that nit to
data's later work. No shared contract changes are part of this response.

## Next integration and data-41

This request prepares the feed and shared preview boundary; it does not mount
the strip. The display panel, bounded preview mounting, playlists, and toolbar
toggle follow in their own request to keep this change small. Actual import and
relink remain P6a work; the display request supplies the unavailable controls.

The lead accepted the following shapes as data-41, after data-39 and data-40:

```ts
// Optional on ColumnLayout and LayoutChange, alone or with existing fields:
readonly leftCollapsed?: boolean;

type UiState = Pick<AppConfig, 'layout' | 'mediaStrip'>;

// LlpApi.ui, writes the existing AppConfig.mediaStrip field only:
setMediaStrip(request: {readonly visible: boolean}): void;
```

The existing width-pair/range rules remain. Omitted app-state fields remain
unchanged, and main is the sole app.json writer. State saving will be wired
after the lead announces data-41 merged. Search waits separately for data-40.

## Checks run

| Check                                                 | Result                                                |
| ----------------------------------------------------- | ----------------------------------------------------- |
| Media controller, job cap, and shared component tests | Pass: 17 tests in 3 files                             |
| Renderer TypeScript check                             | Pass                                                  |
| Changed-file ESLint and Prettier                      | Pass                                                  |
| `git diff --check`                                    | Pass                                                  |
| Local full verify                                     | Not run, per the lead's rule                          |
| GitHub branch CI                                      | Exact submitted HEAD run URL and result in the report |

Fixtures contain invented names and paths. No Electron process, visible window,
soak, or memory run was started.
