# Panel

The basic surface of the window. It has a 34px header (tabs or a title, controls on the right), a scrolling body under it, and an optional 32px footer row. The 예배 순서 (service order), 퀵 실행 (quick launch), library, 슬라이드 (slide), media, preview, 진행 도구 (show tools), and item settings panels all use this frame.

## Where to use

- Every cell of the 진행 (Show), 준비 (Prep), and media workspaces
- Workspace wrappers, including 슬라이드, 화면, 배치 and 속성, use the same 18/26 `title` token as the shared panel header.
- A narrow window (1366×768) uses the same panels. Column widths and the layout inside the window follow `Layout`.

## Where not to use

- Floating surfaces (menus, popovers, dialogs, notifications): use `Menu`, `Dialog`, and `Notification`. Don't use shadows on panels.
- A box that groups a list inside a dialog: use the list box of `Dialog` (`bg-inset`).
- The individual rows in a panel: use `ListRow`.

## Anatomy

- Surface `ll-panel`: background `bg-panel`, radius `radius-lg` (5px), no shadow, overflow clipped.
- Between panels `ll-panels` (`--column` stacks them vertically): gap `panel-gap` (4px). The left and right edges of the window are 4px too (`ll-panels--window`). Don't put a gap at the top and bottom of the work area, where it meets the toolbar and the status bar (`Layout`). The background that shows through the gaps is `bg-app`.
- Header `ll-panel__header`: height `size-panel-header` (34px, including the 1px bottom line), left `panel-inset` (14px), right `space-8`, a 1px `line` at the bottom.
  - Tab `ll-panel__tab`: `title` (18/26/600). The selected tab is `text`, with a 2px `text` underline right above the header line. Unselected tabs are `text-3`. 18px between tabs (no token, requested). A count badge in a tab is `ll-count` of `StatusMarks`, `space-6` from the name.
  - Count `ll-panel__meta`: `space-10` after a tab or title, `label` (14/20) `text-3`, tabular numbers. For example: 라이브러리 128, 배경 영상 7.
  - Title `ll-panel__title`: song title `ll-panel__title-text` (`title` 18/26/600) + position or count `ll-panel__meta` ("2 / 9", "슬라이드 9개"). Gap `space-10`, aligned on the text baseline. Truncate a long title with an ellipsis.
  - Service switcher `ll-panel__switch`: `space-4` right after the 예배 순서 tab. A ghost sm button: height `size-control-sm` (26px), padding left `space-6` and right `space-4`, `label` (14/20) `text-3`, a 12px `down` arrow, `space-4` between the text and the arrow, radius `radius-md`.
  - Controls on the right `ll-panel__actions`: attached at the right end, `space-8` between controls. Use sm controls only: `IconButton` (26×26), `Button` sm, `Select` sm.
- Tool row `ll-panel__tools`: one row under the header with a search field or a Bible verse field. Padding top 8, left and right 8, bottom 6. The field fills the row width (`TextField` md). A list body right under it has no top padding.
- Body `ll-panel__body`: padding `panel-inset` (14px). It takes all remaining height, and only the body scrolls vertically when the content overflows. A list body `ll-panel__body--list` has `space-4` at the top, `space-8` at the bottom, and 0 left and right (the rows carry the 14px). A body with no padding is `--flush`. Draw a thin scrollbar with a `line-strong` thumb.
- Footer row `ll-panel__footer`: height 32px (no token, requested), left and right 14px, a 1px `line` at the top, `caption` (14/20) `text-3`. Counts and sizes go on the left ("7개 2.1GB"), and the thumbnail size slider (`ll-slider-row` of `Slider`) goes on the right in `ll-panel__footer-end`.

- Keep `space-8` between the media tab and its playlist Select, matching the
  spacing between other header controls. They must not touch.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Tab header | 34 | `title` 18/26/600 | 예배 순서, 퀵 실행, library, media, preview, 진행 도구 |
| Tab + service switcher | 34 | Tab `title`, switcher `label` `text-3` | 예배 순서 |
| Tab + count | 34 | `title` + `label` `text-3` | 라이브러리 128 |
| Title header | 34 | `title` 18/26/600 + `label` `text-3` | 슬라이드 panel (만복의 근원 하나님 2 / 9), 예배 순서 item (슬라이드 9개), 배경 영상 7 |
| Tool row | 44 (8 + 30 + 6) | `body` 16/22 | Library search, 퀵 실행 Bible verse |
| Body | Remaining height | - | Lists (`--list`), thumbnail grid (padding 14) |
| Footer row | 32 | `caption` 14/20 `text-3` | Count and thumbnail size in the 슬라이드 panel and media |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Tab selected | None | `text` | 2px `text` underline below, `aria-selected="true"` |
| Tab unselected | None | `text-3` | |
| Tab hover | None | `text-2` | No underline, 100ms |
| Tab focus | None | Unchanged | outline 2px `accent`, offset 1px |
| Tab disabled | None | `text-off` | No hover, reason in a tooltip |
| Service switcher default | Transparent | `text-3` | |
| Service switcher hover | `bg-raised` | `text-3` | 100ms ease-out |
| Service switcher pressed, open | `bg-control-hover` | `text` | Stays while `aria-expanded="true"` |
| Service switcher focus | Unchanged | Unchanged | outline 2px `accent`, offset 1px |
| Service switcher disabled | Transparent | `text-off` | No hover |

## Behavior

- Tabs: the tab row has `role="tablist"`, each tab has `role="tab"` and `aria-selected`, and the body has `role="tabpanel"` and `aria-labelledby`. In the tab row, moving with the left and right arrows selects a tab at once. The Tab key stops only on the selected tab.
- 더 보기 (more) tabs: when the tabs don't fit, as in the narrow 진행 도구 panel (`Layout`), the rest go behind a ghost sm button "더 보기" with a 12px `down` arrow (`text-3`) at the right end of the header: `label` (14/20) `text-2`, padding left `space-8` and right `space-6`, hover `bg-raised`, pressed or open `bg-control-hover` with `text`. A click, Enter, Space, or the down arrow opens a `Menu` with the remaining tab names and a check mark before the current one. While one of them is selected, no tab in the row is selected, and the button shows as the selected tab: `text` with the 2px `text` underline. `aria-haspopup="menu"`; the button sits after the tab row, not in it. In code: `PanelTabs` `more={{label: '더 보기', tabs}}`.
- Service switcher: a click, Enter, Space, or the down arrow opens the 예배 순서 list (the popover list of `Menu`). The list opens 4px below the button, with its left edge aligned to the button. `aria-haspopup="menu"`, and `aria-expanded="true"` while it is open.
- Focus order: header (tabs, service switcher, controls on the right) → tool row → body → footer row.
- Give a panel's `section` the panel name as its `aria-label`. If the panel has only one tab, that tab name is the panel name.
- Changing column widths by dragging the gap between panels follows `Layout`.

## Writing

- Write tab and panel names as short nouns: "예배 순서", "퀵 실행", "라이브러리", "미리보기", "표시 중". Don't add verbs or descriptions.
- Write a count in a header as a number only, and add a unit only when it isn't clear what is counted: "128", "7", "슬라이드 9개".
- Write a position as "current / total", with spaces around the slash: "2 / 9".
- Don't write help text or state descriptions in a header.

## Implementation notes

- `<Panel label="예배 순서" tabs={[{ id: 'order', label: '예배 순서' }]} switcher={<ServiceSwitch value="주일 예배" />} actions={<IconButton icon="plus" label="항목 추가" />}>…</Panel>`
- `<Panel title="만복의 근원 하나님" meta="2 / 9" actions={<Select size="sm" media={thumb} value="따뜻한 빛" />} footer={<SliderRow icon="grid" />}>`
- Parts: `<PanelTabs>`, `<PanelSwitch>`, `<PanelTools>`, `<PanelBody variant="list" | "grid" | "flush">`, `<PanelFooter>`.
- Classes: `ll-panels`, `ll-panels--column`, `ll-panels--window`, `ll-panel`, `ll-panel__header`, `ll-panel__tabs`, `ll-panel__tab`, `ll-panel__title`, `ll-panel__title-text`, `ll-panel__meta`, `ll-panel__switch`, `ll-panel__actions`, `ll-panel__tools`, `ll-panel__body`, `ll-panel__body--list`, `ll-panel__body--flush`, `ll-panel__footer`, `ll-panel__footer-end`.
- The header is 34px including the 1px line, with `box-sizing: border-box`.

## Changes from the drafts

- Panel headers on all boards: 34px + 1px bottom line (35 in total) → 34 including the line.
- ShowH 진행 도구 tabs: gap between tabs 14 → 18, header right padding 14 → 8, unselected tab weight 500 → 600.
- Compact, all panel headers: padding left 12 and right 6 → 14, 8. 진행 도구 tab gap 12 → 18, unselected tab weight 500 → 600. Gap between the + button and the collapse button in the 예배 순서 header 0 → 8. 퀵 실행 tool row padding 6 6 4 → 8 8 6.
- Service switcher button (예배 순서 header in ShowH, PrepService, Reflow, ServiceSwitch, AddSongs, AddSongsQuick, Bible, ImportEdit, ImportSave, ImportText, NewService, ServiceImport, Problems): height 24 → 26 (sm).
