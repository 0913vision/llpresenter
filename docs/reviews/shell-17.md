# Review request: `shell-17`

Review range: ffc6833...fix/shell/design-gaps

What to check: that the menu bar, toolbar, status bar, and the 지우기 row now
follow the design system as listed in the qa M1 report, section B (B1, B2, B3,
B5, B6); that the toolbar is built from the ui parts without changing what its
buttons do; and that no native `title` tooltip is left in them.

- Team member: `shell`
- Branch: `fix/shell/design-gaps`
- Base commit (`main`): `ffc6833` (shell-14 is in it; the menu bar shows the
  service name it provides)
- Last commit: see the commit that adds this file
- Related brief: `docs/qa/m1-report.md`, section B

## What changed and why

- B1, menu bar: the app name is 12 px 700 with `text` and −0.01em, the menu
  names are `label` in `text-2` (pressed or expanded `text` on
  `bg-control-hover`), and the center shows the name of the open service
  (`serviceName` of the show store, at most 36% wide, with an ellipsis). The
  window buttons use the design system tooltip with their name.
- B2: the menus are a `role="menubar"` of `role="menuitem"` buttons with
  `aria-haspopup="menu"` and `aria-expanded`. The README puts the role on the
  whole row, but a menu bar may contain only menu items, so it is on the group
  of the six menus. The menus still don't open (`TODO` in `MenuBar.tsx`).
- B3, toolbar: the search field is the ui `TextField` (ring, search icon, clear
  button) and is 420 wide, 280 in the narrow window, and shrinks first. The
  workspace tabs, the media button, the Look button, and the output buttons are
  the ui `ToolbarTabs`, `ToolbarButton`, and `OutputToggle`, which also gives
  the output tooltip ("무대 화면 출력 켜기 (모니터 3)") and a `화면 출력` group.
  There is no `role="toolbar"`, as the README says.
- B5: the status bar is a `role="status"` region.
- B6: the window buttons, the toolbar, and the 지우기 row use the design system
  tooltip (with the shortcut), not `title`.

Not changed: the three `title` tooltips of the preview panel for an output that
is off (they go with the move onto `PreviewFrame`), the name "이전 크기로 복원"
of the maximize button in a maximized window (the window state isn't known in
the renderer yet), and the opening of the menus.

## Changed files

- `src/renderer/src/shell/MenuBar.tsx`, `MenuBar.module.css`, `MenuBar.test.tsx`
- `src/renderer/src/shell/Toolbar.tsx`, `Toolbar.module.css`,
  `Toolbar.test.tsx`, `Toolbar.layout.test.ts`
- `src/renderer/src/shell/StatusBar.tsx`, `StatusBar.test.tsx`
- `src/renderer/src/show/ClearRow.tsx`, `ClearRow.test.tsx`
- `src/renderer/src/control/App.tsx`

## Checks run

Real app (dev build, CDP): the search field frame is 420 wide at 1920 and 1600
and the toolbar is 56 high; at 1280 the toolbar is 40 high and the search field
is 280 wide. The app name and the menu names are 12 px, the menu names are
`text-2`, the menu bar has `role="menubar"`, the status bar has `role="status"`,
and the only `title` attributes left are the three of the preview panel. The bar
looks as in the README (checked on a screenshot at 1920).

See "Verify result" at the end of this file for `npm run verify`.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Verify result")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (not touched)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the ui parts release their own)
- [x] Caches and lists have size caps (not applicable)
- [x] An exception in the output path doesn't stop the output (not touched)
- [x] Only what's needed re-renders
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- `role="menubar"` is on the group of the menus, not on the whole row (see B2).
- The search field keeps its own text in local state; the search itself isn't
  built yet.

## Shared contract change requests

- None.

## Where to look

- `Toolbar.tsx`: that every button still sends the same command as before.
- `Toolbar.module.css`: the search width variables.
- `MenuBar.tsx`: the roles.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Not reviewed yet.

## Verify result

`npm run verify` on commit `1236686` (base `main` ccbf48a, then rebased onto
ffc6833) passed all five steps in 202.6 s: `typecheck`, `lint`, `format:check`,
`test:coverage`, and `build`.
