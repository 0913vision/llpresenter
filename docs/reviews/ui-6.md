# Review request: `ui-6`

- Team member: `ui`
- Branch: `fix/ui/overlay-keys`
- Review range: `6559a9b...fix/ui/overlay-keys`
- Base commit (`main`): `6559a9b`
- Last commit: the commit that adds this file (see the review request message)
- Related brief: `docs/briefs/ui.md`; bugs M1-8, M1-9, and M1-10 from qa
- Shared changes: none
- What to check: each fix against its bug and its README rule, the test that
  fails on the old code, and that the shared menu button rule replaces the two
  copies in `Select` and `PanelSwitch` without changing them

## What changed and why

Three small bugs that qa found in the ui-2 components, with the gallery and real
input.

| Bug   | Problem                                                                                                                                         | Fix                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1-8  | A press on a dialog's scrim moved focus to `<body>`, out of reach of the dialog's Esc handler and focus trap, until Tab brought it back         | `ModalScrim` (shared by `Dialog` and `AlertDialog`) cancels the `mousedown` of a press that lands on nothing focusable: the scrim, or text and padding inside the modal. Focus stays where it was, so Esc still cancels. Presses on fields and buttons focus them as before                                                                                           |
| M1-9  | The Down arrow didn't open the gallery's 파일 menu button or the service picker; `Select` and `PanelSwitch` each had their own copy of the rule | New `menuButton.ts`: `openOnArrowDown(event, state)` holds the Menu README rule ("click, Enter, Space, or the Down arrow" opens the menu; Enter and Space press the button itself), and `menuButtonProps(state)` gives any button `aria-haspopup`, `aria-expanded`, the toggle click, and the Down arrow. `Select`, `PanelSwitch`, and the two gallery buttons use it |
| M1-10 | `<Tooltip shortcut="F2"><Button>` drew no `aria-keyshortcuts`: `withTooltipProps` overwrote the shortcut it got with the Button's own (none)    | `withTooltipProps` joins the target's own `aria-keyshortcuts` with the tooltip's, the same way it joins `aria-describedby` ids                                                                                                                                                                                                                                        |

Also in this branch: `menuButtonProps` and `openOnArrowDown` are exported from
the ui package for the app's menu buttons, and the nit from the ui-3 round 2
review (the PropertyRow example in `docs/reviews/ui-3.md` now shows
`{controlId, labelId}`).

## Changed files

- `src/renderer/src/ui/Dialog.tsx`, `Dialog.test.tsx` (M1-8)
- `src/renderer/src/ui/menuButton.ts`, `menuButton.test.tsx`, `Select.tsx`,
  `Panel.tsx`, `gallery/OverlaySection.tsx`, `gallery/Gallery.test.tsx`,
  `index.ts` (M1-9)
- `src/renderer/src/ui/Tooltip.tsx`, `Tooltip.test.tsx` (M1-10)
- `docs/reviews/ui-3.md` (the ui-3 nit)

## Checks run

| Command or test                           | Result                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm run verify`                          | Pass, 5 steps, 129 files, 1407 tests (1 skipped under coverage by design, not ui), 378 s |
| New tests on the old code (each reverted) | All fail                                                                                 |

Tests that fail on the old code:

- M1-8: in `Dialog.test.tsx`, a press on the scrim and then on the dialog's
  title keeps focus in the dialog, and Esc then cancels it; the same for the
  `AlertDialog` scrim, where focus stays on 덮어쓰기.
- M1-9: in `Gallery.test.tsx`, ↓ on 파일 and on 주일 예배 opens their menus.
  `menuButton.test.tsx` covers the shared rule: the popup state, opening with ↓,
  a click, Enter, and Space, and nothing while disabled. The `Select` and
  `PanelSwitch` tests for ↓ pass unchanged.
- M1-10: in `Tooltip.test.tsx`, a `Button` in `<Tooltip shortcut="F2">` has
  `aria-keyshortcuts="F2"`, and an `IconButton` in one with `Ctrl Z` has
  `Control+Z`.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every bug fix has unit tests that fail on the old code
- [x] Values from outside the process are validated with a schema (none here)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Nothing new is registered that needs releasing
- [x] Caches and lists have size caps (none here)
- [x] An exception in the output path doesn't stop the output (not in the output
      path)
- [x] Only what's needed re-renders (no new state)
- [x] The clean code rules in `CLAUDE.md` hold: the Down arrow rule now lives
      once instead of twice
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused per commit

## Decisions I made (for the lead to confirm)

1. **M1-8 covers text inside the modal too.** The dialog surface takes no focus,
   so a press on its title or padding had the same problem as the scrim. The fix
   cancels the `mousedown` only when the press lands on nothing focusable, so
   fields and buttons still focus on a press, and text in the app can't be
   selected anyway (`user-select: none` on `body`).
2. **The shared rule is a pair of helpers, not a component.** Menu buttons in
   this app are a `Button`, an `IconButton`, a `Select`, or the panel switcher,
   each with its own look, so `menuButtonProps` spreads onto any of them.

## Shared contract change requests

None.

## Where to look

- `src/renderer/src/ui/Dialog.tsx`: `keepFocusInModal`.
- `src/renderer/src/ui/menuButton.ts`.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (9699bcd): reviewer (Codex, codex4) Approve with one nit:
  `menuButton.ts:39` needs an IconButton composition example and test, since
  IconButton overrides the forwarded aria attributes and callers must also pass
  its `menu` and `expanded` props. The nit goes into ui's next branch. Lead
  Approve; this fixes qa's M1-8, M1-9, and M1-10. Rebased by the lead onto local
  `main` without conflicts.

## Team member's reply

1.
