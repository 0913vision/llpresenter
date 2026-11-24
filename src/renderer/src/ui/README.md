# ui

This folder holds the design system components. Follow
`design/system/project/components/<name>/README.md` exactly for appearance,
size, states, and behavior, and write values only as token variables. Don't
change the shared parts in this folder without the lead's approval.

## Folders

Each folder holds one family of components with the hooks and helpers only that
family uses. A component's CSS module sits beside it.

| Folder      | Holds                                                               |
| ----------- | ------------------------------------------------------------------- |
| `buttons/`  | Things a person presses: buttons, toolbar buttons and tabs          |
| `fields/`   | Fields a person types into, the calendar, and renaming in place     |
| `choices/`  | Controls that pick a value: check boxes, segments, selects, sliders |
| `menus/`    | Menus: the menu bar's, a button's, and the right-click menu         |
| `popups/`   | Dialogs, popovers, tooltips, notices, and the layers they float in  |
| `lists/`    | Lists and grids of rows or tiles, with selection, keys and drag     |
| `tiles/`    | The tiles and marks a list shows: slides, media, macros             |
| `labels/`   | 이름표: the chip and its colors                                     |
| `panels/`   | Panels, property rows, and how the window lays them out             |
| `previews/` | The 미리보기 frames of the screens                                  |
| `canvas/`   | The canvas a theme or a slide is edited on                          |
| `keys/`     | Shortcuts and commands, their names, and key caps                   |
| `text/`     | Words the UI builds: particles, counts, cut-off text                |
| `icons/`    | 86 Phosphor Regular icons (MIT, `icons/LICENSE-phosphor.txt`)       |

The root keeps what every family uses: `Icon`, `classNames`, the shared types,
and the load and lifetime hooks.

## Empty list or grid

`EmptyState` is what a panel body shows with no rows. The rule is the "Empty
state" section of `design/system/project/components/Panel/README.md`: one short
line in `text-3`, centered, in the app's words, plus one button only when an
obvious next action already exists. Show it only after a successful read.
