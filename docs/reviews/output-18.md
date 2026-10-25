# Review request: `output-18`

- Team member: `output`
- Branch: `feat/output/preview-row`
- Base commit (`main`): `b7c61e3fd283b6ccba6f542bdad088bf1e436356`
- Code commit: `d3c83121354f5b91102714b43e602b050cc53e65`
- Review range: `b7c61e3...feat/output/preview-row`
- Related brief: `docs/briefs/output.md`; the lead's M2 check 1 row 6 task.
- Shared contract changes: none.
- Ownership exception: the lead explicitly granted the UI PreviewFrame part, its
  README, and the Show preview panel for this feature.

## What changed and why

The chosen [alternative B](../../design/drafts/m2-check1/README.md) keeps the
three small slots in the order 본 화면, 무대 화면, 방송 자막. Previously, the
selected screen disappeared from the small row. Now its fixed slot shows a blue
upward arrow, outline, and checked name. Its single picture moves to the large
preview above, leaving two small pictures and three renderings total.

Show now uses the shared PreviewFrame instead of maintaining a second layout.
Every screen has a stable keyed picture cell and a separate fixed slot button.
CSS grid positions the existing picture cell in the large row or its small
column. The renderer content stays in the same React tree and DOM parent.

All three buttons remain in keyboard order, expose `aria-pressed`, and support
Enter and Space. Clicking any slot, including the selected one, changes only the
local monitoring selection. The adapter still derives output status from the
live store; live layers keep flowing directly to each renderer. Output off and
warning reasons use the shared tooltip behavior.

Large and small captions join their pictures. Only the large caption shows the
target and an actual Look name if one exists. The narrow form also keeps all
three slots horizontal. Small pictures and markers share the 160px cap. The
large picture shrinks at 16:9 when panel height is limited. Existing design
tokens provide colors, spacing, sizes, and type; production tokens are
unchanged.

## Changed files

- `ui/PreviewFrame.tsx` and its CSS: persistent pictures, fixed buttons,
  selected marker, joined captions, fitting and interaction.
- `ui/PreviewFrame.test.tsx`: selection, keyboard order, marker and rendering
  count, tooltips, target icons, and stable mounted picture content.
- `ui/gallery/PreviewSection.tsx`: examples and labels for the fixed row.
- `show/PreviewPanel.tsx` and its CSS: adapt default screens and output status
  to the shared component, preserving the unknown-selection fallback.
- `show/ScreenPreview.tsx` and its CSS: retain renderer construction,
  subscription, chroma backing, error reporting, and disposal while delegating
  framing to PreviewFrame.
- `show/PreviewPanel.test.tsx`, `PreviewPanel.layout.test.ts`, and new
  `PreviewPanel.lifecycle.test.tsx`: fixed layout, monitoring isolation,
  renderer lifecycle, real renderer video retention, and cleanup.
- [PreviewFrame specification](../../design/system/project/components/PreviewFrame/README.md)
  and this review.

## Regression evidence

Five new selection cases were run against the unchanged baseline production
files from `4bcba7b`. All five failed: both regular/compact fixed-slot cases
could not find the main slot, the UI row cases had two buttons, and keyboard
selection lacked `aria-pressed`. The helper restored the working implementation
in `finally`. The final focused suite passes all 44 tests across four files.

The additional lifecycle test mounts real OutputRenderer instances in jsdom,
with media APIs and ResizeObserver stubbed. It checks three renderer roots, six
reusable video nodes, three active sources, unchanged video parents and
positions across selection and compact changes, and no play/pause/load calls or
live commands. Unmount clears all sources, disconnects the nodes, and leaves no
timers. Existing mocked-renderer tests also ensure selection creates, disposes,
and redraws no renderer and live pushes still reach all three.

No new Electron startup was added to the parallel unit suite.

## Short offscreen app check

Two short actual-app probes passed using an isolated copy of the QA sample. The
final probe ran for 3.119 seconds inside Electron, 3.603 seconds including
process lifetime. All windows used `LLP_TEST_WINDOWS=offscreen`, `show:false`,
shared textures released on paint, and hidden child processes. Helpers passed
`node --check` before launch and had bounded process and app deadlines.

The final probe made 16 selections, including repeated selection, across these
viewports. Values are CSS pixels, rounded to two decimals. The final case
simulates resizing the right column to 560px at a low window height.

| Viewport    | Panel width | Large picture   | Each small slot, including caption |
| ----------- | ----------- | --------------- | ---------------------------------- |
| 1920 x 1080 | 480         | 451.97 x 254.22 | 145.33 x 107.73                    |
| 1280 x 720  | 360         | 243.11 x 136.73 | 105.33 x 85.25                     |
| 1536 x 864  | 360         | 332.00 x 186.75 | 105.33 x 85.25                     |
| 1920 x 720  | 560         | 124.44 x 69.98  | 160.00 x 116.00                    |

Every sample retained the fixed slot order, one marker, three picture roots, the
same six video nodes and parents, and three playing sources. The large picture
kept 16:9 and slots stayed inside the panel. The selected slot contained no
image or video. All three original videos advanced from 0 to 1.84-1.87 seconds.
The full live snapshot was unchanged after selection; outputs stayed off and
only the hidden control window existed. Captured panels were inspected against
the chosen B image.

Local ignored artifacts are under `.llp/output-18/`: `app-proof.json`,
`app.log`, `stage-*.png`, `preview-*.png`, and `old-code-tests.log`. These are
short layout/playback checks, not a long-run soak.

## Checks run

| Command or test                            | Result                                           |
| ------------------------------------------ | ------------------------------------------------ |
| `npm run typecheck`                        | Passed                                           |
| Targeted ESLint                            | Passed                                           |
| Focused four Vitest files                  | 44/44 passed, 3.84 s                             |
| New selection cases on old production code | Five expected failures                           |
| Actual-app offscreen probes                | Passed; final 16 selections in 3.119 s           |
| `npm run format` and `git diff --check`    | Passed before code commit                        |
| Rebase onto main                           | Once, no conflicts; confirmed complete and clean |
| `npm run verify`                           | Passed all five steps, 263.6 s                   |
| Final review document formatting           | Passed                                           |

Full verify ran exactly once on code `d3c8312` after the completed rebase. Step
times: typecheck 27.4 s, lint 90.1 s, format check 24.5 s, coverage tests 263.4
s, build 9.9 s. No failures or reruns. The full log is
`.llp/output-18/verify.log`.

## Quality checklist

- [x] Full verify passes and formatting passes.
- [x] New behavior has selection, layout, and lifecycle regression coverage.
- [x] No new external input or shared contract; existing validation remains.
- [x] No `any`, unchecked assertions, or non-null assertions.
- [x] Renderer subscriptions, media resources, and timers are released on
      unmount.
- [x] The panel keeps a bounded three renderers and six video elements.
- [x] Output error reporting and layer isolation remain in the renderer.
- [x] Monitoring selection does not redraw live content or send output commands.
- [x] Clear responsibilities, shared layout, existing tokens, and permitted
      comments.
- [x] Only the requested preview feature and its documentation changed.

## Decisions for the lead to confirm

- Both window forms keep the same fixed three-slot row, following B.
- Reuse the shared PreviewFrame in Show so its gallery and app share behavior.
- Keep the existing preview content and Look TODO; selection does not implement
  the future stage layout or NDI target.
- Use jsdom for the new real-renderer lifecycle regression. Keep native app
  startup in the short manual offscreen probe rather than adding another
  Electron launch to the unit suite.

## Where to look

Review the ScreenCell siblings and grid placement first, then the real-renderer
lifecycle test and the monitoring-only assertions in PreviewPanel tests. The
component README records the selected-slot design and responsive behavior.

## Verdicts (recorded by the lead at merge)

- Round 1 (cb6a3ec): reviewer (Codex, codex3) Approve with no findings. Lead
  Approve; the user's alternative B from the first M2 check drafts: a fixed row
  of 본 화면, 무대 화면, and 방송 자막, the selected slot showing a marker
  instead of a second picture, and the large preview above showing the
  selection, with three preview renderings and no playback restart on a
  selection change. Written by the Codex session that took over output's work,
  with the lead's permission to change ui's `PreviewFrame` and shell's preview
  panel for this feature. Rebased by the lead onto local `main` without
  conflicts.

## Team member's reply
