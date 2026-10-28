# ToolbarButton

A toolbar control for workspace tabs, the independent media-bin toggle, Look,
and screen output. The media toggle is a short horizontal outlined button;
workspace tabs retain their full-height form. They must not look like the same
kind of navigation.

## Where to use

- Workspace tabs: 진행 (Show), 준비 (Prep), 화면 설정 (Screen settings)
- View toggle: 미디어 (opens and closes the shared bottom bin in 진행 and 준비)
- Action button that opens a menu: Look picker (평상시)
- Screen output: 본 화면 (main screen), 무대 (stage), 방송 자막 (broadcast captions)
- On the 40px toolbar of a narrow window (1366), use the compact form of the same buttons.

## Where not to use

- Inside panels and dialogs: Button, IconButton.
- The search field on the toolbar: TextField (`ll-field`). Toolbar sets the layout.
- Don't add text or chips for the output state. Use only the dot and the icon color. Put the detailed reason in the tooltip.

## Anatomy

- Other buttons: height `size-toolbar-button` (48px), corner radius `radius-lg`
  (5px), no background. The media toggle uses its separate anatomy below.
- Icon `size-icon-18` on top and name `toolbar-label` (14/20/400) below, with a gap of `space-4`. The icon and the name are centered.
- Workspace tab: width 64, no horizontal padding.
- Action and output buttons: horizontal padding `space-8`, minimum width 64. A button that opens a menu, like Look, has horizontal padding `space-12` and a `size-icon-12` down arrow (`text-3`) `space-4` to the right of the icon.
- Status dot on output buttons: a 6px circle (`radius-full`) over the top right corner of the icon (top −3px, right −4px). `ring-dot-cut` sets it apart from the icon. When the button is hovered or pressed, the ring color also changes to the button background (`bg-toolbar-hover`, `bg-raised`).
- Icons: 진행 `slides`, 준비 `edit`, 화면 설정 `gear`, 미디어 `film`, Look `layers` + `down`, 본 화면 and 무대 `mplay`, 방송 자막 `capture`.
- Compact form: height 32, icon `size-icon-16` to the left of the name, gap `space-6`, name `label` (14/20), horizontal padding `space-8` `space-10`. Look puts the arrow after the name, with right padding `space-6`. Workspace tabs also fit their width to the text. The media toggle keeps its separate form below.

### Media view toggle

- Height `size-control-md` (30px) at every window width, centered in the toolbar.
  Horizontal `film` icon 16px and visible 미디어 label 14/20, separated by
  `space-6`; `space-10` side insets, `radius-md`, minimum width
  `size-toolbar-button-min`. Keep the label visible in the narrow window too.
- Off: `bg-control`, `text`, a 1px `line-control` border. On: `selection`,
  `text` and an `accent` border. Workspace selection remains gray, without
  this outlined control shape. Keep the existing divider after workspace tabs.
- Hover: off uses `bg-control-hover`; on uses `accent-fill-hover`. Pointer
  press uses `bg-raised` and keeps the state's border. Keyboard focus uses
  the shared outer 2px accent outline. Disabled: `bg-control`, `line-strong`,
  `text-off`, no hover. Use existing hover motion and reduced-motion handling.
- Use `aria-pressed`, never a workspace tab role or `aria-selected`. The
  button only invokes its existing controlled callback. Tooltip is 미디어 열기
  or 미디어 닫기. In 화면 설정 it is disabled with the reason in its tooltip.
- Integration with data-74: retain `mediaOpen` / `onMediaOpenChange` on Toolbar
  and `pressed` / `onPressedChange` on ToolbarButton. Data owns the shared
  bottom-bin mount and visibility state. This style does not switch workspaces.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Workspace tab | `size-toolbar-button` 48, width 64 | `toolbar-label` | 진행, 준비, 화면 설정 |
| View toggle | 30, minimum width 64, horizontal | `label` 14/20 | 미디어 at every width |
| Menu action | 48, horizontal padding 12 | `toolbar-label` | Look (평상시) |
| Screen output | 48, minimum 64 | `toolbar-label` | 본 화면, 무대, 방송 자막 |
| Compact | 32 | `label` | Other buttons on the 40 toolbar (`size-toolbar-compact`) |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Default (action button) | None | `text` | Arrow `text-3` |
| Workspace tab, not selected | None | `text-3` | |
| Workspace tab, selected | `bg-raised` | `text` | Stays the same on hover |
| 미디어 off | `bg-control` | `text` | 1px `line-control` border |
| 미디어 on | `selection` | `text` | 1px `accent` border |
| Output on | None | `text` | 6px `live` dot + `ring-dot-cut` |
| Output off | None | `text-off` | 6px `line-strong` dot (`ll-dot--off` of StatusMarks) + `ring-dot-cut` |
| Output, no monitor | None | Icon `warning`, name `text` | 6px `warning` dot + `ring-dot-cut` |
| Hover, other controls | `bg-toolbar-hover` | Unchanged | 100ms ease-out, the dot ring takes the same color |
| Pressed, menu open (`aria-expanded`) | `bg-raised` | Unchanged | |
| Focus | Unchanged | Unchanged | `outline: 2px solid accent`, offset 1px, on keyboard focus only |
| Disabled, other controls | None | `text-off` | No hover. Give the reason in a tooltip |
| Disabled media toggle | `bg-control` | `text-off` | `line-strong` border, no hover |

## Behavior

- Unmodified Enter and Space activate toolbar and screen-output buttons. Modified activation keys pass to their owner without activating them.
- Workspace tabs: group the three tabs in `role="tablist"` (name "작업 공간"), and give each tab `role="tab"` + `aria-selected`. Left and Right arrows move between tabs and switch at once. Tab stops only on the selected tab. Modified Enter and Space pass through without switching.
- 미디어: `aria-pressed` reports the on state. Tooltip "미디어 열기" / "미디어 닫기".
- Look: `aria-haspopup="menu"`, and `aria-expanded="true"` while the menu is open. Open the menu below the button, aligned to its left edge. The name shows the current Look name (평상시).
- Screen output: a click turns 출력 for that screen on or off. `aria-pressed` reports whether the output is turned on (`true` for on and for no monitor), and `data-state="live|off|warning"` gives the drawn state. Group the three buttons in `role="group"` (name "화면 출력").
- When the monitor is found again, the button goes back to on at once. A click in the no-monitor state turns the output off.
- Tooltips (after 600ms, following the Tooltip rules):
  - On: "본 화면 출력 끄기 (모니터 2)", "무대 화면 출력 끄기 (모니터 3)", "방송 자막 출력 끄기 (NDI)"
  - Off: "본 화면 출력 켜기 (모니터 2)"
  - No monitor: "본 화면: 모니터 2를 찾을 수 없습니다"
- The media toggle's name remains visible in every form. Other icon-only
  controls keep an `aria-label`.

## Writing

- Names are nouns of one or two words: 진행, 준비, 화면 설정, 미디어, 본 화면, 무대, 방송 자막.
- Write an output button tooltip as "what a click does (target)": "본 화면 출력 끄기 (모니터 2)". For the target, use the output target name from 화면 설정 as it is.
- Write a problem tooltip as "screen name: what doesn't work": "본 화면: 모니터 2를 찾을 수 없습니다". Don't write out a long fix.

## Implementation notes

```jsx
<ToolbarTab icon="slides" label="진행" selected={ws === 'show'} onSelect={() => setWs('show')} />
<ToolbarButton icon="film" label="미디어" pressed={binOpen} onPressedChange={setBinOpen} />
<ToolbarButton icon="layers" label={look.name} menu expanded={lookOpen} />
<OutputToggle icon="mplay" label="본 화면" target="모니터 2" state="live" onToggle={toggleMain} />
<OutputToggle icon="capture" label="방송 자막" target="NDI" state="off" compact />
```

- `state` of `OutputToggle`: `'live'` | `'off'` | `'warning'`. Build the tooltip text from `label` (the full name in the tooltip, such as "무대 화면"), `target`, and `state`.
- Give every button a `compact` (compact form) prop. The compact form moves the arrow after the name, so the markup order differs.
- Classes: `ll-tbtn`, variants `ll-tbtn--tab` `ll-tbtn--toggle` `ll-tbtn--menu` `ll-tbtn--output`, compact form `ll-tbtn--compact`, icon only `ll-tbtn--icon-only`. Parts `ll-tbtn__icon` (groups the icon, arrow, and dot), `ll-tbtn__chevron`, `ll-tbtn__dot`, `ll-tbtn__label`.

```html
<button class="ll-tbtn ll-tbtn--output" aria-pressed="true" data-state="live">
  <span class="ll-tbtn__icon"><span class="ll-i ll-i-mplay"></span><span class="ll-tbtn__dot"></span></span>
  <span class="ll-tbtn__label">본 화면</span>
</button>
```

## Changes from the drafts

- All boards (assemble.js `toolbar()`): output dot 7px (right −5, top −3) → 6px (right −4, top −3).
- ShowH, Bible: gray dot (#3a3a3a) on an output that is off → the StatusMarks off dot (`line-strong`), so on, off, and no monitor each keep a dot in the same place. Output names use `text-2` when off so they remain readable.
- Problems: no-monitor output with a #2a2210 background and #e3a23b painted all the way to the name → no background, only the icon and the dot in `warning`, name `text`. Dot ring #2a2210 → `ring-dot-cut`. Tooltip "모니터 3 연결 끊김, 창으로 표시 중" → "무대 화면: 모니터 3을 찾을 수 없습니다".
- All boards: Look arrow 14px → 12px.
- Compact: removed the track behind the workspace tabs (#161616, padding 2, radius 6). Selected tab #2f2f2f → `bg-raised`. Tab, Look, and output button height 30 → 32, radius 4 → `radius-lg`. Tab name weight 500 → 400. 미디어 34×34 → 32×32.
