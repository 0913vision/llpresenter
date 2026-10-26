Review range: `01735790...feat/spec/narrow-layout`

# Review request: `spec-43`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/narrow-layout`
- Base commit: `01735790`, main at round 3 (rebased over the 준비 item panel in
  Workspace.tsx)
- Review round: 3
- Task: M3-S1b narrow window layout
- Code owner for the renderer paths: shell

## What changed and why

S1b's acceptance asks that a narrow window (1366 x 768) shows the 더 보기 tabs
and collapses the left column. The other narrow window rows of spec 04 (toolbar,
column widths, media strip, slide grid, clear row, small previews) already
landed in earlier requests.

**진행 도구 tabs.** The 진행 도구 panel now has its tab frame. Regular and wide
windows show all eight tabs in spec 04's order. A narrow window shows 표시 중
and 무대, and a 더 보기 button at the right end of the header opens a menu with
the other six, as in the `Compact` board. Choosing one shows its tab panel, and
더 보기 takes the selected tab's look (text color and underline); the menu marks
the chosen tool. The chosen tool survives a size class change. The tab panels
stay empty: their content is the tools role's (mount points in
`docs/plans/m3-breakdown.md`), marked with a TODO.

**Left column collapse.** In a narrow 진행 window, the 예배 순서 header ends
with 사이드바 접기. Pressing it hides the left column (예배 순서 and 퀵 실행)
and leaves a strip at the window edge, as wide as a panel header, with 사이드바
펼치기. The left gap is not draggable while collapsed. Each press saves
`layout.narrow.leftCollapsed` through spec-38's `ui.setLayout`; a saved choice
is restored at start without being saved again. If the pressed button had the
keyboard focus, the button that replaces it takes it.

## Round 3 response

1. The tool tabs now use ui-35's `PanelTabs` `more` slot, and the split is
   decided by measured width, not only by size class. A narrow window always
   shows 표시 중, 무대, and 더 보기 (spec 04). In regular and wide windows the
   panel watches its own width with a `ResizeObserver`: when the row of eight
   tabs overflows (the right column can shrink to 320 px), it records how much
   wider the panel would need to be and switches to the compact tabs; it shows
   all eight again once the panel is that wide. Measuring adapts to UI zoom and
   to the count badge on 표시 중 later, where a fixed threshold wouldn't. My own
   더 보기 button and its styles are gone, and the tab panel is labelled by ui's
   hidden tab name. Tests: overflow at the 320 px minimum switches to the
   compact tabs; one pixel short stays compact; the needed width shows all eight
   again; a narrow window never measures. `showToolGroups(sizeClass)` became the
   two named groups `ALL_TOOL_TABS` and `COMPACT_TOOL_TABS`, and the unused
   `showToolLabel` is removed.
2. The private `useSidebarToggle` and the new private `useAllTabsFit` explain
   themselves with NOTE comments instead of TSDoc.

## Round 2 response

1. The focus handoff happens only when the pressed button itself is
   `document.activeElement`: `onPress` passes `event.currentTarget`. After a
   click in 진행 (which doesn't move focus), the focus falls to the body. A
   mounted test selects a 예배 순서 item, clicks 사이드바 접기, checks that
   사이드바 펼치기 isn't focused, and that Space sends the next slide. The
   keyboard handoff test stays.
2. The chosen 진행 도구 tab lives in a small store, `state/showToolTab.ts`, for
   the session. Tests: the panel mounting again, and the mounted app going 진행,
   준비, 진행 with 타이머 chosen from 더 보기.
3. TODO(0913vision) markers record decisions 5 (`Workspace.tsx`: the shrink rule
   still counts the hidden left width) and 6 (`state/showToolTab.ts`: spec 10
   remembers the last tab).
4. The 더 보기 slot in `PanelTabs` is left for ui, as the lead said.

`SidebarMount.test.tsx` is now `NarrowLayoutMount.test.tsx`, since it covers the
tool tabs too.

## Carried spec-40 nits

- `WORKSPACE_UNAVAILABLE_TIP` ends without a period, as tooltips do.
- `withinLookupTimeout` rejects with "Song lookup timed out", since it bounds
  the library song read as well as the background read;
  `state/songBackground.test.ts` expects the new text.

## Decisions I made (for the lead to confirm)

1. Collapse exists only in narrow windows, as spec 04's narrow table and spec
   10's remembered state say ("the collapsed left column in narrow windows").
   Regular and wide windows ignore a saved `leftCollapsed`.
2. Only 진행 collapses. 준비 keeps its left column (예배 순서 and the library),
   because spec 04 describes the 진행 layout and 준비 needs the library to add
   songs. The narrow choice still applies when returning to 진행.
3. With no saved choice the column starts open; spec 04 adds a button, not a
   collapsed default.
4. The collapsed strip is `size-panel-header` (34) wide, so the expand button
   sits where the header row would be. No board shows the collapsed state (spec
   04 marks it a proposal).
5. The column math is unchanged while collapsed: the saved widths and the shrink
   rule still use the left width. The center only gets more room; in a tight
   window with very wide saved columns the right column may show narrower than
   it could. I kept `ColumnLayout` untouched to keep this request small.
6. The last 진행 도구 tab is kept for the session only. Spec 10 lists it as
   remembered state, which needs an additive `UiState` field and a main-process
   writer; that follows separately.

## Changes outside my paths

None. Everything is in shell's renderer paths:

- `src/renderer/src/show/showTools.ts` and `.test.ts`: the eight tools, their
  order, and the narrow split.
- `src/renderer/src/show/ShowToolsPanel.tsx`, `.module.css`, `.test.tsx`: the
  tab frame on ui's `Panel` parts and `Menu`, the 더 보기 button, its tests.
- `src/renderer/src/shell/useSidebarCollapse.ts`: narrow-only state, restore,
  and save with logged failures.
- `src/renderer/src/shell/SidebarToggle.tsx` and `.module.css`: the two buttons
  on ui's `IconButton` and the edge strip. The collapse arrow mirrors the whole
  square button instead of reaching into ui's DOM.
- `src/renderer/src/shell/Workspace.tsx` and `.module.css`: an `actions` slot in
  the panel header, the collapsed grid, the non-draggable gap, the focus
  handoff, the 예배 순서 parts extracted from the render, and the tool frame
  mounted as the 진행 도구 panel.
- `src/renderer/src/control/App.tsx`: passes the sidebar state to the workspace.
- `src/renderer/src/control/NarrowLayoutMount.test.tsx`: the mounted app at 1366
  x 768, 1920 x 1080, and 2560 x 1440.
- `src/renderer/src/state/showToolTab.ts`: the session's chosen tool tab.
- `src/renderer/src/shell/ToolbarSearch.tsx`,
  `src/renderer/src/state/showOutput.ts`, and `state/songBackground.test.ts`:
  the spec-40 nits above.

This review document is in my own path. No shared, preload, main, prep, or UI
source is changed, and no dependency is added.

## Validation

| Command or test                                    | Result                 |
| -------------------------------------------------- | ---------------------- |
| `npm run typecheck`                                | Pass                   |
| `npx vitest run --no-fsModuleCache src/renderer`   | Pass, 1,575 tests      |
| `npx eslint --max-warnings 0` on the changed areas | Pass                   |
| `npx prettier --check` on the changed areas        | Pass                   |
| GitHub CI (`npm run verify`)                       | In the request message |

Tests cover: tab sets per size class; the 더 보기 menu items, radio check,
active look, and Down to open; arrow keys between tabs; the chosen tool across
size classes; collapse and expand with the saved payloads and no live command; a
restored choice without a save; no collapse at 1920 x 1080 and 2560 x 1440 even
with saved `true`; 준비 keeping its column; the focus handoff both ways; and
focus left alone when it was outside the column.

No Electron process, visible window, soak, or memory measurement was started.

## Where to look

- `Workspace.tsx`, `useSidebarToggle`: the one-shot focus claim. The toggle
  records whether the focus was inside the left column before the change; the
  button that mounts next claims it once.
- `ShowToolsPanel.tsx`: the tab panel is labelled by the tool name, because a
  tool chosen from 더 보기 has no tab to point to.

## Verdicts (recorded by the lead at merge)

- Round 1 (Claude reviewer): Request changes.
- Round 2 (Codex, codex2): Request changes: eight nonwrapping tool tabs were
  clipped in a 320 px right column; nit on a private TSDoc.
- Round 3 (1dca4c76): reviewer (Codex, codex2) Approve; the tabs fold into 더
  보기 (ui-35) whenever all eight don't fit. Nit for the next shell request: the
  non-exported `measuredPanel()` helper in `ShowToolsPanel.test.tsx` has TSDoc;
  remove it or make it a NOTE. Lead Approve. Rebased by the lead onto local
  `main` without conflicts; typecheck passes. M3-S1b is complete.
