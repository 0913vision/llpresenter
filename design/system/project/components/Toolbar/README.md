# Toolbar

The 56px row under the menu bar. It holds the workspace tabs and media on the left, the search field in the center, and Look and the 출력 (output) buttons for the three screens on the right. In a narrow window it becomes a 40px row.

## Where to use

- Directly under the menu bar of the main window. Use the same place and the same buttons in every workspace: 진행 (Show), 준비 (Prep), and 화면 설정 (Screen settings).

## Where not to use

- Panel header tools: use the IconButton and sm Button at the right of the panel header.
- Secondary windows (Preferences) and dialogs: don't give them a toolbar.
- Don't add or remove buttons per workspace. The screen output buttons and Look must be in the same place in every workspace.

## Anatomy

- Row: height `size-toolbar` (56px), background `bg-app`, horizontal padding `space-4`, gap between items `space-6`. Buttons are ToolbarButton (48), vertically centered.
- Left: workspace tabs (진행, 준비, 화면 설정), divider, the separate horizontal
  30px media-bin toggle. The toggle keeps its label and outlined on/off states.
- Center: the search field, centered in a cell that takes the remaining width. The search field is TextField md (`ll-field ll-field--ring`, `size-control-md` 30, `bg-well`, magnifier 16 `text-3`, gap `space-8`), width 420, and it shrinks when space runs short. Placeholder "곡, 가사, 초성".
- Right: Look (평상시), divider, the three screen output buttons (본 화면 (main screen), 무대 (stage), 방송 자막 (broadcast captions)).
- Divider: 1×24, `line`, horizontal margin `space-8` (14 together with the gap between items).
- Narrow window: height `size-toolbar-compact` (40px), other buttons in the
  narrow ToolbarButton form (32), media remains a labeled 30px horizontal
  toggle, search field width 280 (still md), divider margin `space-4`.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Regular | `size-toolbar` 56 | Buttons `toolbar-label`, search `body` | Window width 1600 or more |
| Narrow window | `size-toolbar-compact` 40 | Buttons `label`, search `body` | Window width 1280–1599 (1366×768 and similar) |

The window width that separates the two forms follows Layout (window sizes and layout).

## States

The toolbar itself has no states. Each button follows ToolbarButton, and the search field follows TextField.

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Default | `bg-app` | | No bottom line |
| Search field focus | Field `bg-well` | | `ring-field-focus` |
| Dialog open | `scrim` covers the toolbar too | | Doesn't cover the menu bar |

## Behavior

- Focus order: workspace tabs (the one selected tab) → media → search field → Look → 본 화면 → 무대 → 방송 자막.
- Search field: the clear-text button and the Esc behavior follow TextField. This component doesn't decide where results appear.
- Don't use `role="toolbar"` on the toolbar. It mixes a tab group (`tablist`) and an output group (`group`), so each group follows its own keyboard rules.
- When the window gets narrower, the search field shrinks first (no minimum width). Don't shorten button names. If space still runs short, switch to the narrow window form.

## Writing

- Don't put explanatory text in the toolbar. Use only button names and tooltips.
- In the search field placeholder, list what can be found, separated by commas: "곡, 가사, 초성". Don't write something like "검색어를 입력하세요" (Enter a search term).

## Implementation notes

```jsx
<Toolbar compact={narrow}>
  <Toolbar.Group role="tablist" aria-label="작업 공간">…ToolbarTab×3</Toolbar.Group>
  <Toolbar.Divider />
  <ToolbarButton icon="film" label="미디어" pressed={binOpen} />
  <Toolbar.Center><TextField className="ll-toolbar__search" ring icon="search" placeholder="곡, 가사, 초성" aria-label="검색" /></Toolbar.Center>
  <ToolbarButton icon="layers" label="평상시" menu />
  <Toolbar.Divider />
  <Toolbar.Group role="group" aria-label="화면 출력">…OutputToggle×3</Toolbar.Group>
</Toolbar>
```

- Classes: row `ll-toolbar`, narrow window `ll-toolbar--compact`, group `ll-toolbar__group`, center cell `ll-toolbar__center`, divider `ll-toolbar__divider`, search field width `ll-toolbar__search` (added to `ll-field ll-field--ring`).

## Changes from the drafts

- All boards (assemble.js `toolbar()`): search field 420×32, background #1c1c1c, radius 5, magnifier 14, horizontal padding 12 → 420×30 (md), `bg-well` + `ring-field`, `radius-md`, magnifier 16, horizontal padding 10.
- All boards: divider height 32 → 24.
- Compact: toolbar 44 → 40. Search field background #1c1c1c, magnifier 14, text 12px → `bg-well` + `ring-field`, magnifier 16, text 13px (md). Width 280 unchanged.
