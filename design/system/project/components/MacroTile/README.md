# MacroTile

A button that shows one macro as a 64px color tile with a name. Use it in the macro tab of the 진행 도구 (show tools) (grid view and list view). A click runs the macro's actions at once.

## Where to use

- Grid view of the 진행 도구 macro tab (Macros, Overlays): tile `ll-macro`.
- List view of the same tab (Macros): 30px row `ll-macro-row`.

## Where not to use

- The 22px macro cell inside the "시작할 때" (on start) dropdown of a 예배 순서 (service order) item: use Select's `ll-select__tile`.
- Action rows in the action palette: use the list row (ListRow).
- The 퀵 실행 (quick launch) list: use the list row.

## Anatomy

- Color: one of the 8 이름표 (label) colors (`data-color`, the color mapping from LabelChip). Macros have no "no color" option.
- Tile `ll-macro__tile`: 64×64, corner radius `radius-tile` (14), background `label-*`, icon `size-icon-28` in `text-on-label` in the center.
- Name `ll-macro__name`: `space-8` below the tile, `label` (12/16) `text-2`, centered, up to two lines (truncate with an ellipsis beyond that), `word-break: keep-all`.
- Schedule mark `ll-macro__clock`: only on a macro that runs on start or at a set time. A 20px circle −6px off the top right of the tile, background `bg-control`, 2px `bg-panel` ring, 12px `clock` icon in `text`. Give the time in the title tooltip.
- New macro slot `ll-macro--new`: the same 64px frame with a 1px dashed `line-control` border. The 24px `plus` icon and the name "새 매크로" (new macro) are both `text-3`. At the very end of the grid.
- Grid `ll-macro-grid`: `repeat(auto-fill, minmax(76px, 1fr))`, gap `space-16` vertical and at least `space-8` horizontal, cells centered. Panel padding (after the tool row under the header): 10 at the top, `panel-inset` on the left, right, and bottom. It has 5 columns at a right column of 480 (452 inside) and 4 columns at 360.
- List row `ll-macro-row`: the list row rules (height `size-row` 30, horizontal padding `panel-inset`, text `body`, gap `space-10` between the leading cell and the text), with a 20×20 color cell instead of an icon (`radius-md`, 14px icon in `text-on-label`). Meta on the right in `caption` `text-3`: the scheduled time (12px `clock` + "10:30") and the action count ("동작 4개"), gap `space-10` between them.

## Sizes and variants

| Name | Height | Text | Where to use |
|---|---|---|---|
| Tile `ll-macro` | 64 + 8 + name (16 or 32) | `label` | Grid view |
| New macro `ll-macro--new` | Same | `label` `text-3` | End of the grid |
| List row `ll-macro-row` | 30 `size-row` | `body`, meta `caption` | List view |

## States

| State | Background | Text and icon | Other |
|---|---|---|---|
| Default | `label-*` | Icon `text-on-label`, name `text-2` | |
| Hover | Same | Same | 2px gap (`bg-panel`) + 1px `line-control` |
| Last run | Same | Name `text`, weight 600 | 2px gap + 2px `text` |
| Selected (editing, right-click menu) | Same | Same | 2px gap + 2px `accent`. Takes priority over the last run ring |
| Focus | Same | Same | `outline: 2px solid accent` on the tile, offset 5px |
| Scheduled | Same | Same | Clock circle at the top right |
| New macro hover | `bg-raised` inside the frame | `text-3` | |
| List row hover / selected | `bg-raised` / `selection` | `text`, meta `text-3` / `text-on-selection` | Last run makes the name weight 600 |

The last run ring stays white, as in the draft. A macro isn't something that is "out" on the screens but an action that runs once, so it doesn't use the `live` red. Selected uses the same `accent` as thumbnails, and because the tiles are colored, a 2px gap comes before the ring.

## Behavior

- A click runs the macro at once, without asking for confirmation. After it runs, the last run ring moves to that tile.
- A right-click opens the macro menu (실행, 이름 바꾸기, 아이콘 바꾸기, 색, 동작 추가 …, 삭제) and keeps that tile selected while the menu is open.
- The grid and the list are `role="listbox"`, and the items are `role="option"`. While an item has keyboard focus, the arrow keys move between items, and Enter or Space runs one. Shift F10 or the Menu key opens the right-click menu. Keys the tile doesn't use (F1 to F7, Page Up, Page Down, Ctrl and Alt commands) pass on to their commands.
- In the 진행 workspace, a mouse click runs the macro but doesn't give the tile keyboard focus; only Tab moves keyboard focus into the grid. So Space after a click still goes to 다음 장 instead of running the macro again.
- Write the name and the schedule in the `aria-label`: "예배 시작, 10:30에 실행".
- State attributes: last run `data-state="last-run"`, selected `aria-selected="true"`.

## Writing

- Names are short nouns that point to a moment in the 예배 순서: "예배 시작", "찬양", "말씀", "광고", "헌금", "영상", "축도", "예배 끝".
- In the list row meta, write only the count, as in "동작 4개". The user sees the actions themselves in action editing from the right-click menu.

## Implementation notes

- `<MacroTile name="찬양" icon="song" color="teal" lastRun selected schedule={{kind: 'time', time: '10:30'}} />`; a startup 매크로 has `schedule={{kind: 'startup'}}`.
- `<MacroRow …same props… actionCount={2} />`
- `<MacroGrid label="매크로" selected={index} onRun={…} onMenu={…} onNew={…}>` and `<MacroList …>`: a click, Enter, or Space calls `onRun`, a right-click, Shift F10, or the Menu key calls `onMenu`, and the arrow keys move keyboard focus only. `selected` marks the 매크로 being edited or under its menu.
- Classes: `ll-macro-grid`, `ll-macro`, `ll-macro__tile`, `ll-macro__name`, `ll-macro__clock`, `ll-macro--new`, `ll-macro-row`, `ll-macro-row__swatch`, `ll-macro-row__name`, `ll-macro-row__meta`.
- The block rules are raised one level to `:is(.ll-root, .ll-preview) .ll-macro` so that they beat the default button text reset (`.ll-root button { color: inherit }`).

## Changes from the drafts

- Macros and Overlays grid: name #cfcfcf 500 → `text-2` 400 (last run stays `text` 600), new macro dashed line #4a4a4a → `line-control`, new macro hover on the whole button (radius 6) → only inside the 64px frame. No tile hover → 2px gap + 1px `line-control`. No selected state → 2px gap + 2px `accent`.
- Macros list view: 34px color cell + a row of action chips (two lines, 9px top and bottom padding per row) → 30px list row + 20px color cell + "동작 4개". Last run row background #232323 → name weight 600 only.
