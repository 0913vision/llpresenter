# M2 check 1 drafts, part A

Status: the user chose preview B, service header A, and the Windows type scale
on October 25, 2026. The clear undo button setting defaults to off. No product
source, production tokens, or saved user settings changed in this drafts
request. Implementation follows in separate requests.

Request: `.llp/task.md`, part A, covering rows 6, 1, and 11 of
[`m2-check1-feedback.md`](../../../docs/plans/m2-check1-feedback.md). Baseline:
local `main` at `3e31e01`. The type comparison renders the actual `App` and its
components from this baseline, with an invented sample service and an in-memory
fake API. It never opens an output or connects to live data.

## User choices

The lead relayed these choices on October 25, 2026:

1. **Preview B:** keep the fixed row of 본 화면, 무대 화면, and 방송 자막. Show
   a marker in the selected small slot and that screen's picture in the large
   preview above. Keep three preview renderings in total, with stable renderer
   and video instances across selection changes.
2. **Service header A:** replace the generic header label with the open
   service's name. Keep the 34px header and the chosen 16/22 semibold name.
   Retain the menu bar title, ellipsis for long names, and the full name on
   hover. The 16/22 service name remains specific to this component when the
   general heading style changes to 18/24 in the selected type scale.
3. **Windows type scale:** adopt the proposed mapping below, including body
   14/20, caption 12/16, and no UI text below 12px. Keep Pretendard. Output
   pictures continue to scale their contents as described below.
4. **Clear undo setting:** `지우기 되돌리기 단추 보이기` defaults to off.
   Enabling the setting shows the 되돌리기 button; it does not restore the
   removed Ctrl Z binding for clears.

These choices authorize implementation in the UI parts, design tokens, and
component specifications through separate small requests with tests. The slide
terminology change remains separate: `장` becomes `슬라이드` only when it means
a slide. Bible chapter names keep `장`, for example `창세기 1장`.

The alternative boards and original PNGs are preserved as the record of the
comparison the user chose from. They are not screenshots of the implemented
choices. The full implementation is outside part A.

## Research before drawing the preview

Checked on October 25, 2026:

- Renewed Vision's
  [Understanding The ProPresenter User Interface](https://support.renewedvision.com/hc/en-us/articles/360041345954-Understanding-The-ProPresenter-User-Interface),
  section **Preview Window/Clear Cues**, describes one large live-output
  preview. A dropdown underneath selects the screen to monitor. Clear controls
  sit on the right, and transport controls sit below. Its
  [August 2025 screenshot](https://support.renewedvision.com/hc/article_attachments/43856805802259)
  shows that arrangement. I inspected the screenshot, not a running copy of
  ProPresenter.
- Renewed Vision's
  [Using Windowed Output in ProPresenter](https://support.renewedvision.com/hc/en-us/articles/35155785296787-Using-Windowed-Output-in-ProPresenter)
  documents separately resizable monitoring windows, created from the preview
  dropdown. Adjusting those windows does not change the live outputs. That
  feature is research context, not part of these drafts.
- I found no official example of this task's fixed row of 본 화면, 무대 화면,
  and 방송 자막. Both alternatives below are our proposals. They borrow the
  distinction between choosing a monitor view and changing live output.
- The legacy `learn.renewedvision.com/propresenter/interface` URL redirects to
  the knowledge base. The old ProPresenter 7 PDF returned HTTP 522. Neither is
  used as evidence for current appearance. Source screenshots stay in ignored
  local research files and are not included in this public repository.

## Preview alternatives

Open [previews.png](renders/previews.png). The two panels each have the actual
regular right-column width of 480px. Both start with 무대 화면 selected.

| Alternative | Selected small slot                  | Preview surfaces          | Tradeoff                                                                      |
| ----------- | ------------------------------------ | ------------------------- | ----------------------------------------------------------------------------- |
| A           | A second picture, outlined in blue   | One large and three small | All three small pictures stay visible, including a duplicate of the large one |
| B           | A blue upward arrow in the same slot | One large and two small   | Keeps the selected screen's place without rendering its picture twice         |

All three names keep the order 본 화면, 무대 화면, 방송 자막. Clicking any slot
changes only the large monitoring picture. A blue outline and a check identify
selection; red is reserved for live output elsewhere. The large caption repeats
the selected screen's name. Placeholder Look and stage layout names are absent.

The stage picture and lower-third picture are schematic, with invented text.
They illustrate distinct screens, not a new stage layout or a functioning NDI
output. No recording or streaming control is added.

The current product uses three preview renderers, one large and two small.
Alternative B would preserve that count; A would add one. These are counts of
preview renderings, not output windows, GPU processes, or measured savings.
Implementation of the selected B must retain existing renderer/video instances
and change their layout without restarting playback. The static draft does not
implement that lifecycle.

## Service header alternatives

Open [headers.png](renders/headers.png). All panels are 280px wide and show the
same real service list. The leftmost is today's header for comparison. The menu
bar's service name remains in the actual workspace and is not replaced.

| Alternative   | Header                   | Name                                                          | Tradeoff                                                                          |
| ------------- | ------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A, name first | 34px, the current height | Existing heading style, 16/22 semibold, with a dropdown arrow | Gives the name the whole header; the panel's generic label is its accessible name |
| B, two lines  | 52px                     | Category 12/16 above the same 16/22 name                      | Keeps the visible category and name, using 18px more vertical space               |

Both proposals make the name the service-picker target. The picker itself is
outside this draft. Long-name strips below the panels demonstrate ellipsis at
the same width; the full name is in the hover title. Header dimensions and
existing heading type are independent of the type-scale proposal below.

## Windows type ramp comparison

Microsoft's
[Typography in Windows](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography#type-ramp)
lists Caption at 12/16, Body and Body Strong at 14/20, and Body Large at 18/24
effective pixels. The same page's Windows 11 guidance gives minimums of 12px
regular and 14px semibold. These drafts adapt those sizes to the existing
Pretendard font. They do not switch to Segoe UI or adopt the entire Windows
visual style.

Open the native 1920 x 1080 files at 100%:

- [Today's scale](renders/type-today.png)
- [Proposed scale](renders/type-windows.png)
- [Both side by side](renders/type-pair.png), 3840 x 1144, including a 64px
  comparison label above each full-size workspace

The fixture, selected item, live slide, columns, controls, and panel size tokens
are identical. Only the draft's type mapping changes. It uses no UI zoom. The
current preview layout and placeholder captions deliberately remain in both type
captures to isolate typography from the preview alternatives.

| Style                 | Today, size/line height/weight | Proposed  |
| --------------------- | ------------------------------ | --------- |
| heading               | 16/22/600                      | 18/24/600 |
| title                 | 13/18/600                      | 14/20/600 |
| body                  | 13/18/400                      | 14/20/400 |
| body-strong           | 13/18/600                      | 14/20/600 |
| label                 | 12/16/400                      | 12/16/400 |
| label-strong          | 12/16/600                      | 14/20/600 |
| band                  | 12/16/700                      | 14/20/600 |
| caption               | 11/14/400                      | 12/16/400 |
| caption-strong        | 11/14/600                      | 14/20/600 |
| toolbar-label         | 11/14/500                      | 12/16/400 |
| micro, including LIVE | 10/12/700                      | 12/16/400 |

Strong text moves to Body Strong; small regular text uses Caption. Two shell
styles currently use literal sizes: panel tabs and the status bar. The draft
also maps those to 14/20 semibold and 12/16 regular, respectively. No product
CSS is edited. Group headers grow naturally with their larger line height;
ordinary 30px rows keep their height.

The 12px minimum is for UI text. Text inside a picture of an output or slide
still scales with that picture; forcing its rendered pixels to 12px would change
the output composition. The font audit excludes those picture contents.

## Artifacts

| PNG                          | Size        | Contents                                   |
| ---------------------------- | ----------- | ------------------------------------------ |
| `renders/previews.png`       | 1032 x 840  | Both preview proposals and their tradeoffs |
| `renders/preview-a.png`      | 480 x 466   | Alternative A panel at actual size         |
| `renders/preview-b.png`      | 480 x 466   | Alternative B panel at actual size         |
| `renders/headers.png`        | 936 x 800   | Current header, A, B, and long-name cases  |
| `renders/header-current.png` | 280 x 400   | Today's service panel                      |
| `renders/header-single.png`  | 280 x 400   | Header A, name first                       |
| `renders/header-stacked.png` | 280 x 400   | Header B, two lines                        |
| `renders/type-today.png`     | 1920 x 1080 | Current type on the actual workspace       |
| `renders/type-windows.png`   | 1920 x 1080 | Proposed type on the same workspace        |
| `renders/type-pair.png`      | 3840 x 1144 | Two complete workspaces at native size     |

## Reproduce and check

From this worktree in PowerShell, with the existing dependencies:

```powershell
npx --no-install tsc --project design/drafts/m2-check1/tsconfig.json
node --check design/drafts/m2-check1/render.cjs
$env:LLP_TEST_WINDOWS = 'offscreen'
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
& '.\node_modules\.bin\electron.cmd' 'design/drafts/m2-check1/render.cjs'
```

The committed PNGs and checks preserve the original `3e31e01` product baseline,
captured in local pre-rebase commit `6a5f6e2`. This review branch was
subsequently rebased onto newer `main`. Running the harness now uses the
checked-out product source and updates the captures; it does not reproduce that
historical baseline automatically. Use the committed PNGs to review the user's
recorded comparison.

The script refuses to run without the offscreen flag. Every window has
`show: false` and `webPreferences.offscreen: true`. Its Vite server binds only
to `127.0.0.1:5186`; the server and window close when rendering ends. No other
server, browser, or downloaded program is needed.

`renders/checks.json` records the assertions: fixed slot order and coordinates
after selecting every screen; matching large selection; four versus three
picture surfaces; one marker in B; 34/34/52px service header heights and
long-name ellipsis with full hover titles; UI fonts at least 12px in the
proposed workspace; viewport 1920 x 1080 with device scale 1; exact PNG
dimensions; both comparison images loaded at native size; and no renderer
console errors. TypeScript checks the draft with the repository's strict
renderer options. This is a documents/design-only request, so the repository
gate is `npm run format:check`, per `docs/decisions.md`, rather than the full
product verify.
