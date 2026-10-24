# MenuBar

The 30px row at the top of the window. It holds the app name, the menus, the service name in the center, and the window control buttons, and it also serves as the window title bar (frameless Electron window).

## Where to use

- The top of the main window, with the same look in every workspace.
- The title bar of secondary windows such as Preferences (the window name and close only, no menus).

## Where not to use

- The toolbar (workspace tabs, search, output): Toolbar.
- The open menu list itself: Menu. The menu bar only sets where the menu opens.
- Dialog headers: Dialog. A dialog opens below the menu bar, not as a window.

## Anatomy

- Row: height `size-menubar` (30px), background `bg-app`, left padding `space-12`. No bottom line (it runs into the toolbar on the same background).
- App name "LoveLight": 12px 700 (the same values as `band`), letter spacing −0.01em, `text`, right margin `space-14`.
- Menu items: 파일 (File), 편집 (Edit), 보기 (View), 출력 (output), 창 (Window), 도움말 (Help). Height 24px, horizontal padding 9px, corner radius `radius-sm`, text `label` (12/16) `text-2`, no gap between items.
- Center title: the name of the current service (주일 예배). Centered in the window width, text `label` `text-3`. Its maximum width is 36% so that it doesn't overlap the menus or the window control buttons. Truncate it with an ellipsis when it overflows.
- Window control buttons: minimize `min`, maximize `max`, close `x`. 46×30, icon `size-icon-14` `text-2`, no corner radius, flush with the right end.
- Secondary window title bar: the same 30px row, with the window name in `label-strong` `text` at left `space-14` and one close button on the right.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Main window menu bar | `size-menubar` 30 | Menus `label`, title `label` | Main window |
| Menu item | 24 | `label` `text-2` | Inside the menu bar |
| Window control button | 46×30 | Icon 14 | Right end of the menu bar |
| Secondary window title bar | 30 | Window name `label-strong` | Preferences |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Menu item, default | None | `text-2` | |
| Menu item, hover | `bg-raised` | `text-2` | 100ms ease-out |
| Menu item, pressed or menu open (`aria-expanded`) | `bg-control-hover` | `text` | Stays while the menu is open |
| Window control, default | None | `text-2` | |
| Window control, hover | `bg-raised` | `text-2` | The same for close (no red hover) |
| Window control, pressed | `bg-control-hover` | `text` | |
| Focus | Unchanged | Unchanged | Menu items offset 1px. Window control buttons draw it inside (offset −2px) so that the window edge doesn't clip it |

## Behavior

- The whole row is the window drag area (`-webkit-app-region: drag`). Only the menus and the window control buttons are `no-drag`. A double-click on an empty spot toggles between maximize and restore (Windows default behavior).
- Menus: the row is `role="menubar"`, and each item is `role="menuitem"` + `aria-haspopup="menu"` + `aria-expanded`. A click opens the menu below the item, aligned to its left edge. While one menu is open, hovering another item switches to that menu.
- Keyboard: Alt or F10 focuses the first item, Left and Right arrows move between items, Enter, Space, or Down arrow opens a menu, and Esc closes it and leaves the menu bar. Don't add Alt + underlined letter access keys.
- Give the window control buttons an `aria-label` (최소화, 최대화, 닫기) and a tooltip with the same name. In a maximized window, change the name to "이전 크기로 복원" (the double-square icon isn't in the icon list yet).
- The center title isn't clickable. Switch services in the 예배 순서 (service order) panel header.

## Writing

- Fix menu names as nouns of two or three characters: 파일, 편집, 보기, 출력, 창, 도움말.
- Put only the service name in the center title (주일 예배). Don't add the app name, a file path, or a "저장 안 됨" (not saved) mark. StatusBar shows the save state.

## Implementation notes

```jsx
<MenuBar title={service.name} menus={['파일', '편집', '보기', '출력', '창', '도움말']} />
<MenuBar variant="window" title="환경설정" />
```

- The window controls call minimize, maximize/unmaximize, and close on the Electron `BrowserWindow`. Draw the menu contents with the Menu component, and don't use the default Electron menu.
- Classes: row `ll-menubar`, secondary window `ll-menubar--window`, app name `ll-menubar__brand`, menu group `ll-menubar__menus`, item `ll-menubar__item`, title `ll-menubar__title`, window name `ll-menubar__name`, window control group `ll-menubar__controls`, button `ll-menubar__win`.

## Changes from the drafts

- All boards (assemble.js `menubar`): menu bar background #0b0b0b → `bg-app` (#0e0e0e).
- Prefs, Shortcuts: secondary window title bar height 32 → 30, background #0b0b0b → `bg-app`, close 46×32 → 46×30.
