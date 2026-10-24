# Review request: `ui-2`

- Team member: `ui`
- Branch: `feat/ui/overlays`
- Base commit (`main`): `9e2496a`
- Last commit: the commit that adds this file (see the review request message)
- Related brief: `docs/briefs/ui.md`

## What changed and why

The second batch of shared design system components, in `src/renderer/src/ui/`,
built and checked the same way as ui-1: each follows its README in
`design/system/project/components/` and its reference CSS in
`design/system/css/`, ported to a CSS module that uses only token variables.

| Component   | Exports                                                                                                                                           | Notes                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| StatusMarks | `LiveBadge`, `StatusDot`, `CountBadge`, `Progress`                                                                                                | `OutputToggle` now draws its dot with `StatusDot`, so the 6px dot is defined once                                                                     |
| Tooltip     | `Tooltip`, `useTooltip`                                                                                                                           | One controller and one layer for the window: 600ms delay, 300ms grace, closes on a click, a key, a scroll, or window blur; shows on keyboard focus    |
| Menu        | `Menu` (+ entry types)                                                                                                                            | Items, groups, dividers, check marks, swatches, submenus, a search field; arrows, Home, End, Right, Left, Enter, Space, Esc, Tab, first-letter search |
| Select list | `SelectMenu`                                                                                                                                      | The ui-1 `Select` button with its `Menu` list, check mark on the current value, no narrower than the button                                           |
| Dialog      | `Dialog`, `DialogField`, `DialogBox`                                                                                                              | Scrim under the menu bar, inert app behind, focus trap, Enter presses the primary button, Esc cancels, focus goes back to the opener                  |
| AlertDialog | `AlertDialog`                                                                                                                                     | Same modal layer; focus starts on the primary button; Esc presses 취소 or the action marked `escape`; optional list section                           |
| Panel       | `Panels`, `Panel`, `PanelHeader`, `PanelTabs`, `PanelTitle`, `PanelMeta`, `PanelSwitch`, `PanelActions`, `PanelTools`, `PanelBody`, `PanelFooter` | Tabs with arrow keys and one Tab stop, the body as the tab panel, the service switcher button                                                         |
| ListRow     | `ListBox`, `ListRow`, `ListActionRow`, `ListGroup`, `ListSlot`, `ListSlotBox`, `ListInsertLine`, `ListDragGhost`                                  | One-line and two-line rows, LIVE, past, problem, disabled, 퀵 실행 on, empty slot, drop line, drag ghost; list keyboard control                       |

Shared pieces: `placement.ts` (all position math: below or above, at the
pointer, submenus, 8px from the window edges), `floating.ts` (measure and place
from a ref callback), `layers.ts` (one body-level container per floating layer),
`tooltipController.ts`, `modalStack.ts` and `useModal.ts` (the modal behavior
that Dialog and AlertDialog share), `menuModel.ts` and `menuKeys.ts`,
`TruncatedText` (a tooltip with the full name only when the name is cut off).

Every `title` prop of the ui-1 components (Button, IconButton, SegmentedControl,
the toolbar buttons, the fields, Select, Checkbox, Switch, Slider) now draws the
Tooltip instead of the native `title`, as the ui-1 review agreed, and the
`TODO(0913vision)` comments are gone.

The gallery has new sections for StatusMarks, Panel, ListRow, and the floating
components (buttons that open each menu, dialog, and tooltip).

## Changed files

- `src/renderer/src/ui/`: the components above, their CSS modules, helpers, and
  tests, and the Tooltip change in the ui-1 components.
- `src/renderer/src/ui/index.ts`: exports.
- `src/renderer/src/ui/gallery/`: the new sections.
- `src/renderer/src/styles/base.css`: the two layer values for menus and
  tooltips over a dialog (round 1).
- No shared files, no configuration, no `package.json`.

## Checks run

| Command or test                              | Result                                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run verify` (round 2)                   | Pass, 5 steps, 68 files, 692 tests (1 skipped under coverage by design, not ui), 655 s |
| `npx tsc`, `npx eslint src/renderer/src/ui`  | Pass                                                                                   |
| `npx vitest run --project renderer` (ui)     | Pass, 27 files, 233 tests                                                              |
| Gallery beside the preview cards (see below) | Done for all seven cards                                                               |
| Floating components in Electron (see below)  | Open, focus, Esc, placement, and tooltips checked                                      |
| Layers over a dialog in Chromium (round 1)   | Menu 301 and tooltip 302 over the scrim (300)                                          |

### Comparison with the preview cards

Same method as ui-1: an offscreen Electron script in my temp folder (not
committed) compares the computed styles of every specimen on the card and in the
gallery, applying hover and pressed with real mouse input and focus with
`CSS.forcePseudoState`. The floating components can't sit still on a page, so a
second script opens them in the gallery (clicks, hovers, keys) and compares them
with the card's static specimens.

| Card        | Result                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| StatusMarks | 11 of 11 specimens identical; the 4 card compositions (status bar, toolbar icon, media tile) belong to other components |
| Panel       | Headers, tab states, switcher states, and footer identical; differences only in the card's mini-body wrapper            |
| ListRow     | 11 of 14 identical; the rest are the warning icon wrapper (needed for its tooltip) and two whole-panel compositions     |
| Tooltip     | Surface, text, and shortcut identical; position differs only because the gallery tooltip is placed for real             |
| Menu        | Surface, item, pointed item, extra info, divider, group name, and search field identical                                |
| Dialog      | Dialog, header, title, bar, field name, footer, list box header identical; heights differ with the window size          |
| AlertDialog | Surface, icon cell, title, extra info, and button row identical                                                         |

The scripts also check in Chromium what jsdom can't: the menu takes focus when
it opens and Esc gives focus back to its button; the search field of the service
picker takes focus; the scrim starts under the 30px menu bar; tooltips show on a
disabled slider, a disabled switch row, and a text field with an error.

Found and fixed this way:

1. A disabled list row hid its icon: a shared rule set the icon's background to
   transparent, and icons are painted with `background-color`.
2. A menu opened with its contents hidden for one measuring pass, so focus could
   not move into it. Placing floating surfaces from their ref callback, before
   the browser paints, removed the hidden pass altogether.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests (the two CSS fixes
      above were found and checked in Electron; jsdom applies no CSS)
- [x] Values from outside the process are validated with a schema (none here)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: the tooltip controller removes its
      window listeners whenever nothing shows or waits, menu timers are cleared
      on unmount, the modal stack removes `inert` from everything it marked
- [x] Caches and lists have size caps (none here)
- [x] An exception in the output path doesn't stop the output (not in the output
      path)
- [x] Only what's needed re-renders: each `useTooltip` selects only its own
      tooltip from the shared controller
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused per commit, and "What changed and why"
      describes it

## Decisions I made (for the lead to confirm)

1. **Layers.** Floating surfaces render through portals into one container per
   layer at the end of `body` (`data-llp-layer` = `popover`, `tooltip`,
   `dialog`), created on first use. While a modal is open, every other child of
   `body` is `inert` except the popover and tooltip layers, so a Select inside a
   dialog still opens its list. A future notification layer stays live the same
   way. A menu or tooltip that opens while a modal is open carries
   `data-over-modal` and takes `--z-popover-over-modal` (`--z-dialog` + 1) or
   `--z-tooltip-over-modal` (`--z-dialog` + 2) from `base.css`, so it shows over
   the dialog and stays under notifications (`--z-notification`, 400). A menu
   that was already open in the main window stays under a dialog that opens
   later, because the dialog covers it.
2. **Tooltip.** `useTooltip(content)` returns the target props and the tooltip
   to render; `Tooltip` wraps one element. The tooltip describes its target only
   while it shows, and a shortcut also goes to `aria-keyshortcuts` ("Ctrl Z"
   becomes "Control+Z"). The grace period ignores a clock that went backwards.
3. **Menu.** Focus stays on the menu surface with `aria-activedescendant`; with
   a search field, focus stays in the field (a combobox) and the arrows still
   move through the items. A transparent layer under the menu catches the click
   outside, so that click doesn't reach what is underneath. Switching between
   menu bar menus on hover is for MenuBar to build on top of this. Esc closes
   one level: the submenu that the focused menu has open (also one the pointer
   opened), else the focused submenu, else the menu. Focus follows the pointer
   into a submenu and back. While a submenu is open, pointing at another parent
   opens its submenu only after the 300ms close delay, so the pointer can cross
   other items on its way into the open one. An open menu fits itself to the
   window again when the window resizes.
4. **Dialog API.** The footer is structured (`onCancel` and `cancelLabel`,
   `secondary`, one `primary`) so that Enter and the initial focus can find the
   primary button. `aside` and `asideFoot` make the two-column body; `topBar`
   and `bottomBar` take the option and input bars.
5. **Enter in a modal** presses the primary button from text fields, checkboxes,
   and switches, and not from a multiline field, a focused button (which presses
   itself), a list, or a menu. F1 to F7 are never stopped, so the 지우기 keys
   work while a dialog is open. Enter and Esc do nothing while an IME
   composition is open (Korean input that isn't confirmed yet), in a dialog, in
   a menu, in the search field, and in the number field.
6. **ListBox.** The arrows move and select at once, skipping group headers and
   disabled rows; Tab enters on the selected row. A control at the end of a row
   (`end`) never selects the row: it stops only the row keys (Enter, Space, ↑,
   ↓, Home, End), so Esc, F1 to F7, and the other commands still pass. 퀵 실행
   rows are `ListActionRow` buttons that run on a click. Dragging (the 4px
   threshold and snapping) is left to the feature that drags; the drop line and
   the ghost row are here.
7. **Panel** is a set of small parts rather than one component with many props,
   so a header can hold any mix of tabs, title, switcher, and actions.

## Shared contract change requests

None.

## Where to look

- `useModal.ts` and `modalStack.ts`: inert, focus trap, Enter and Esc, focus
  return.
- `tooltipController.ts`: the single timer, the grace period, and the window
  listeners it adds and removes.
- `Menu.tsx` and `menuKeys.ts`: submenu timers and keyboard rules.
- `ListRow.tsx`: list keyboard control through the DOM, so it works with groups
  and, later, virtualized lists.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

Round 1 findings from codex4, all fixed. Each fix has a test that fails on the
old code.

1. Menus and tooltips showed behind an open dialog. A menu or tooltip that opens
   while a modal is open now carries `data-over-modal` and takes the layer
   values `--z-popover-over-modal` and `--z-tooltip-over-modal` from `base.css`
   (`--z-dialog` + 1 and + 2), below `--z-notification` (`71e3c08`). Tests
   (`overlayLayers.test.tsx`): a menu opened in a dialog is marked, not inert,
   and runs its item; a tooltip in a dialog is marked; a menu of the main
   window, before and after the dialog, is not. jsdom applies no CSS, so I also
   checked it in Chromium (an offscreen Electron window on the plain Vite
   gallery): with the 텍스트 가져오기 dialog open, a marked menu computes to
   z-index 301 and is the element at the dialog's center, an unmarked one
   computes to 100 and is hidden; tooltips compute to 302 and 200; the scrim is
   300 and notifications stay at 400.
2. An end control stopped every key. `RowEnd` now stops only the row keys: Enter
   and Space (row activation) and ↑, ↓, Home, End (list navigation) (`63f00c2`).
   Tests: Esc, F1, and F7 from the end control reach a window listener; ↑, Home,
   and End on it don't move or select the row.
3. Enter ran commands during an IME composition. New `isComposing(event)`
   (`ime.ts`) checks `isComposing` and the `Process` key. It replaces the
   deprecated `keyCode === 229`, which the lint rule against deprecated APIs
   rejects; Chromium reports both for IME keys. The modal ignores Enter and Esc
   while composing, and the menu ignores every key of a composition. The same
   check now also guards Esc in the search field and Enter in the number field,
   which had the same problem (`b7feec5`). Tests: composing Enter, `Process`,
   and composing Esc in a dialog field run nothing and a plain Enter still
   presses the primary button; composing ↓, Enter, and Esc in the menu search
   field move, run, and close nothing; the search field keeps its text on a
   composing Esc; the number field doesn't commit on a composing Enter.
4. A hover-opened submenu left focus on the root, so Esc closed the whole chain.
   Esc now closes one level: the submenu that the focused menu has open, else
   the focused submenu, else the menu (`closeChild` in `menuKeys.ts`). Focus
   also follows the pointer into a submenu and back, so the menu under the
   pointer takes the arrows and Esc (`05fdd97`). Tests: hover-open, Esc closes
   only the submenu and a second Esc closes the menu; after the pointer enters
   the submenu it has focus, and Esc there returns focus to the parent.
5. A pending sibling open replaced the submenu the pointer was reaching. While a
   submenu is open, pointing at another parent no longer starts the 150ms open
   timer; it starts the 300ms close timer, which opens the other submenu when it
   ends. Entering the open submenu, or pointing back at its parent, cancels both
   timers (`05fdd97`). Tests on the fake clock: crossing 내보내기 on the way
   into 가져오기's submenu within 299ms keeps 가져오기 open and never opens
   내보내기; resting on 내보내기 opens it at 300ms exactly.
6. Placement and the maximum height changed only on React commits. The menu now
   sets its maximum height and position in one `fit` step, from its ref callback
   and from a window `resize` listener that it removes when it closes
   (`05fdd97`). Test: a smaller `innerHeight` and a `resize` event set the new
   maximum height; closing the menu removes the listener.
7. TSDoc on private declarations. TSDoc now sits only on exported APIs in every
   ui file (`6c5d158`): the private helpers lost it where the name says enough
   (`useMenuTimers`, `useMenuNavigation`, `Submenu`, `keepOneTabStop`,
   `belowOrAbove`), names took over the rest (`OpenSubmenu.takesFocus`,
   `closeSubmenu`, `keepSubmenuOpen`, `PanelIds` became `PanelIdBase`), and the
   gallery entry name kept its context as a `NOTE(0913vision)`.
