# Review request: `ui-7`

- Team member: `ui`
- Branch: `feat/ui/live-parts`
- Review range: `4b72a17...feat/ui/live-parts` (round 1 was
  `99cb546...feat/ui/live-parts`, stacked on ui-4, and round 2
  `77be252...feat/ui/live-parts`; each later round rebased onto `main` without
  conflicts, so the hashes in the round 2 reply are the rebased ones)
- Base commit (`main`): `4b72a17`
- Round 3, what to check: the round 2 finding in "Team member's reply", with the
  test that fails on the old code
- Last commit: the commit that adds this file (see the review request message)
- Related brief: `docs/briefs/ui.md`, M2 in `docs/MILESTONES.md`
- Shared changes: 43 new design tokens (42 in round 1, `size-preview-small-max`
  in round 2) in `design/system/project/tokens.json`, regenerated into
  `design/system/project/tokens.css` and copied into
  `src/renderer/src/styles/tokens.css`; a fourth floating layer, `notification`,
  in `src/renderer/src/ui/layers.ts`, and the modal Tab cycle through it (round
  2); rules in the reference CSS `design/system/css/30-panel.css`, and in round
  2 `41-previewframe.css` and `13-toolbarbutton.css` (rebuilt into `bundle.css`)
- What to check: the 지우기 row, the preview frame, and the notification cards
  against their READMEs and `docs/spec/08-problems.md` ("Notifications"); the
  stack rules in `notices.ts`; that the notification layer stays outside a
  modal's `inert` and first in the Tab order; that every new behavior has a
  test; the token names and values

## What changed and why

The parts of the 진행 workspace that M2 needs next, built and checked the same
way as ui-1 to ui-4: each follows its README in
`design/system/project/components/` and its reference CSS, ported to a CSS
module that uses only tokens.

| Component    | Exports                                                                                                   | Notes                                                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ClearButton  | `ClearRow`, `ClearButton`, `ClearUndo`, `clearLabel`, `defaultClearShortcut`                              | The 지우기 row (`role="group"`, name 지우기) and its compact form; one button per `ClearTarget` with its key in the tooltip and `aria-keyshortcuts`; 되돌림 after its divider       |
| PreviewFrame | `PreviewFrame`, `previewReason`, `smallPreviewName`, `PreviewScreen`, `PreviewStatus`, `PreviewTarget`    | One screen large with its name row, the others small; a click on a small one swaps it in; on, off, and warning states with their tooltip; `renderScreen` draws each screen's output |
| Notification | `NotificationCard`, `NotificationStack`, `NOTICE_LIFETIME_MS`, `addNotice`, `removeNotice`, `MAX_NOTICES` | Warning and information cards, the 6 second close that waits for the pointer and focus, the stack at the top right that reports the height of its warning cards                     |

Shared pieces:

- `notices.ts`: the stack rules as pure functions. `addNotice` puts a card on
  top, replaces the card with the same `key` (the same cause, so "disconnected"
  turns into "reconnected"), and beyond three cards closes the oldest
  information card first, else the oldest card. `removeNotice` takes one off.
- `layers.ts`: the `notification` layer. It is the first child of `body`, so the
  cards come before the right column in the Tab order, and it sits outside the
  app root, so a modal's `inert` doesn't reach it (spec 08: "their buttons work
  while a dialog is open").

Also in this branch:

- The component token sweep of the ui-1 and ui-2 modules: every anatomy value
  that was a literal size is now a token (`size-checkbox`, `size-slider-knob`,
  `size-menu-min`, `space-tooltip-block`, and so on). 1px and 2px line, ring,
  and outline widths stay literal (the lead's rule).
- README wording from spec: KeyCap and TextField (the key recording rules and
  key names from spec-1 and its correction), ClearButton (where F1 to F7 and
  Ctrl Z work), and the implementation notes of ClearButton, PreviewFrame, and
  Notification, rewritten to the real API.
- The Panel rule that both the Panel and ListRow cards draw: a list body right
  under the tool row has no top padding (`.tools + .list`), in the module, the
  reference CSS, and the README.
- Gallery: sections for ClearButton, PreviewFrame, and Notification; the ui-2
  gaps that qa listed (Panel "Thumbnail size only (장 panel)", ListRow "준비
  (counts)", the drag specimen, "Media list", StatusMarks "On an icon, --cut",
  "Output off", "Status bar", "Zero, hidden", "Inside a media tile"); the
  LabelChip specimens the ui-3 gallery missed ("Insert", "Insert, hover", "None,
  hover", the tag "Focus", "Under the 준비 preview"); the ListRow panel
  specimens now have the card's headers, width (296), and rows.

## Changed files

- `src/renderer/src/ui/`: `ClearButton`, `PreviewFrame`, `Notification`,
  `notices`, their CSS modules and tests; `layers.ts`, `modalStack.ts` (its
  TSDoc), `index.ts`; the CSS modules of the token sweep (AlertDialog, Checkbox,
  Dialog, ListRow, Menu, SegmentedControl, Select, Slider, StatusMarks, Switch,
  TextField, ToolbarButton, Tooltip) and `Panel.module.css`.
- `src/renderer/src/ui/gallery/`: the Clear, Preview, and Notification sections
  (with `PreviewSection.module.css`), and the Panel, ListRow, StatusMarks, and
  LabelChip sections (with `StatusMarksSection.module.css` and
  `LabelSection.module.css`); `Gallery.test.tsx`.
- `src/renderer/src/styles/tokens.css`, `design/system/project/tokens.json`,
  `design/system/project/tokens.css`: the new tokens.
- `design/system/css/30-panel.css`,
  `design/system/project/components/bundle.css`: the Panel rule.
- The READMEs of ClearButton, KeyCap, Notification, Panel, PreviewFrame, and
  TextField.

## Checks run

| Command or test                              | Result                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                             | Round 3: 4 of 5 steps pass (274 s); `test:coverage` fails only on the known `main` failure in `scripts/soak/media.test.ts` ("ends the stalled maker and every process it started", fixed by devops-17), 2045 other tests pass. Round 2: pass, 237 s; round 1: pass, 158 s |
| `npx vitest run --project renderer` (ui)     | Pass, 42 files, 386 tests (378 in round 2, 370 in round 1)                                                                                                                                                                                                                |
| Gallery beside the preview cards (see below) | Done for every card this branch touches, in Chromium (offscreen Electron)                                                                                                                                                                                                 |

### Comparison with the preview cards

My offscreen script loads each card and its gallery section, puts the pinned
hover and focus states on the gallery with real input, and compares the computed
styles of every part.

| Card                                                                   | Result                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ClearButton                                                            | 12 of 12 identical                                                                                                                                                                                                                               |
| PreviewFrame, Notification                                             | Checked from screenshots: the same apart from the sample screens; the live stack measured 4px under the toolbar and from the right, 480 wide, cards 4px apart, the layer first in `body`                                                         |
| Button, IconButton, SegmentedControl, Select, Checkbox, Switch, KeyCap | Every matched specimen identical after the token sweep; the in-context specimens that the ui-1 gallery lacks are listed under "Known gaps"                                                                                                       |
| ListRow                                                                | 17 of 17 matched; what differs is `box-sizing` (the card's `content-box` heights read 297 where the app's `border-box` reads 309, the same box), the tooltip wrapper of the warning icon, and the drag ghost sitting beside the panel, not in it |
| LabelChip                                                              | 20 of 20 matched; the two differences are where my script picks the root (the card's swatch or strip against the gallery's row or chip)                                                                                                          |
| StatusMarks                                                            | 15 of 15 matched; the three dot specimens differ only in the picked root (the card's dot against the gallery's button or status bar), except "Output off" (decision 6)                                                                           |
| Panel                                                                  | All matched; the gallery's stand-in body (an extra 12px block) shifts the pairing of the parts after it                                                                                                                                          |
| ToolbarButton                                                          | 26 of 29 matched; the buttons are `inline-flex` where the card's are `flex` (same box), and the output toggles wrap the icon and its dot in one 18px span                                                                                        |
| Slider                                                                 | 9 of 9 matched; the input inherits its row's `text-3` `color`, which the slider doesn't draw with, and the "Media properties" specimen pairs with the card's switch                                                                              |
| TextField                                                              | 18 of 18 matched; `outline-offset` differs where no outline is drawn, the card's disabled icon lacks the `:has(:disabled)` color, and the number field's unit wrapper shifts the pairing                                                         |

### Known gaps (for my next branch)

The same script shows card specimens that the ui-1 gallery sections never drew,
mostly parts shown in their context. I kept them out of this branch so it stays
focused:

- Button: "Confirmation dialog buttons, md, gap 8, one primary at far right",
  "In a panel header, sm".
- IconButton: "Panel header +, 내리기 at row end (hover)", "On/off tools, 비율
  고정 off, 격자에 맞추기 on", "Dialog close, md".
- SegmentedControl: "Fill variant in property fields, equal widths, horizontal
  8", "In a panel header, screen tabs (aria-selected), 구성 picker (radio)".
- Checkbox: "Group rows, off, hover, focus, disabled", "Inside a dialog, row 30,
  no hover".
- Switch: "Switch at the left end of the control cell", "화면 설정 (Screen
  settings)".
- ToolbarButton: "Tooltip, on", "Tooltip, off", "Tooltip, no monitor".
- KeyCap: "Recording a key, TextField sm", "Tooltip, ll-tooltip__key of
  Tooltip", "Menu, ll-menu__meta of Menu", and two specimens without a label.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (round 3: 4 of 5 steps; `test:coverage` fails only
      on the known soak test, see "Checks run")
- [x] `npm run format:check` passes
- [x] Every new behavior has unit tests
- [x] Values from outside the process are validated with a schema (none here)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered listener is released (the 6 second timer, the
      ResizeObserver, tooltips)
- [x] Caches and lists have size caps (the stack keeps at most 3 cards)
- [x] An exception in the output path doesn't stop the output (not in the output
      path; `renderScreen` belongs to the caller)
- [x] Only what's needed re-renders: the stack measures in a layout effect and
      reports only a changed height
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md` (TSDoc on exported APIs only)
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused per commit

## Decisions I made (for the lead to confirm)

1. **The caller keeps the notice list.** `NotificationStack` draws what it gets;
   `addNotice` and `removeNotice` are pure functions, so shell can keep the list
   in its store and test the rules without React. An information card calls
   `onClose` itself after 6 seconds.
2. **The notification layer goes first in `body`.** The other layers are
   appended at the end. The cards never take focus, but Tab reaches their
   buttons before the right column, and the layer stays outside the app root
   that a modal makes inert.
3. **PreviewFrame keeps every screen mounted across swaps** (round 2; the lead
   decided). Each screen keeps one cell in the same place of the tree, and the
   grid puts the large one on top; a small cell has its button laid over it. A
   swap changes only classes, the name row, and that button, so a renderer is
   never rebuilt and a preview video never restarts. Its README says so.
4. **ClearUndo draws its own divider**, so `ClearRow` takes only `ClearButton`
   and `ClearUndo` children and needs no divider part.
5. **Gallery stand-ins** for parts the shell owns: the sample preview screens,
   the status bar around the dots, and the name row under the 준비 preview, each
   with a NOTE.
6. **The output off dot** (round 2; the lead decided). The StatusMarks card
   wins: an output that is off keeps a `line-strong` dot, so state shows by
   shape and color. `OutputToggle`, the ToolbarButton README, its card title,
   and the reference CSS now draw it (reply item 5).

## Shared contract change requests

None.

## Where to look

- `src/renderer/src/ui/notices.ts`: the stack rules.
- `src/renderer/src/ui/Notification.tsx`: the 6 second close and what holds it,
  and the warning height.
- `src/renderer/src/ui/PreviewFrame.tsx`: the swap and the state texts.
- `src/renderer/src/ui/ClearButton.tsx`: the row, the keys, and the off state.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (codex5): Request changes with three findings: a replaced notice kept
  its old timer, notification buttons were out of the Tab cycle while a dialog
  was open, and the large preview had no key per screen.
- Round 2 (codex5): Request changes with one finding: Esc from a notification
  button no longer cancelled the open dialog.
- Round 3 (efd0a29): reviewer (Codex, codex5) Approve with no findings. Lead
  Approve; PreviewFrame keeps every screen mounted across swaps (lead decision
  on round 1 finding 3, the same rule as shell-12), the small previews are
  capped at 160 px, the output-off toolbar mark is a gray dot (lead decision),
  and Esc on a notification card does what 취소 does in the open dialog. Rebased
  by the lead onto local `main` without conflicts.

## Team member's reply

Round 1 findings from codex5, all fixed, and the README nit from codex2's review
of shell-12. Each fix has a test that fails on the old code.

1. An information card that replaced another with the same key kept the old
   timer. The lifetime now follows the notice object, so a new notice starts its
   six seconds again; `NotificationStackProps.notices` says to keep each object
   while its card shows (`c6ce292`). Test with the fake clock: a replacement
   five seconds in still shows 5.999 seconds later and closes at six.
2. Tab couldn't reach the notification buttons while a dialog was open.
   `useModal` now runs Tab through one cycle: the notification cards' buttons
   (they come first in the page and stay live) and then the topmost modal.
   Inside either one the browser moves focus as before; between them and at the
   ends the modal does. A document listener does it, so Tab from a card is
   handled too; it acts only for the topmost modal (`ModalStack.isTop`) and
   finds the layer without creating it (`findLayerContainer`) (`7028cc0`). Test:
   with a `Dialog` and a `NotificationStack` open, Tab from 만들기 goes 모니터
   다시 찾기, 창 보기, 알림 닫기, 닫기, 취소, and Shift Tab walks back the same
   way and wraps to 만들기. The dialog tests still pass.
3. I didn't add `key={large.id}`: the lead decided the opposite of the remount.
   CLAUDE.md asks us to reuse what we can and not to rebuild renderers or
   restart video per change, and shell-12's preview panel already keeps its
   three renderers across swaps. So `PreviewFrame` now keeps one cell per screen
   in the same place of the tree, lets the grid put the large one on top, and
   lays the small cell's button over it instead of around it (`d763a09`). Test:
   with a renderer that records its mounts, two swaps mount and unmount nothing,
   and the drawn elements are the same nodes. The README and decision 3 say so.
   In Chromium the gallery section still matches the card, with the two small
   rows side by side in the narrow form.
4. Nit: the README said small previews are half the column wide, while shell
   caps them at 160px so a widened column leaves the height to the large
   preview. The cap is now the token `size-preview-small-max` (160px), used by
   `PreviewFrame`, the reference CSS, and the README's size table
   (`min((width - 10) / 2, 160) × 9/16`) (`d763a09`).
5. The lead's answer to decision 6: `OutputToggle` now draws the StatusMarks off
   dot (`line-strong`, with the cut ring) on an output that is off, and the
   ToolbarButton README, its card title, and `13-toolbarbutton.css` say so
   (`b067930`). Test: each state draws exactly one dot of its own tone (`live`,
   `off`, `warning`); the off case fails on the old code. In Chromium the
   gallery's "Off" toolbar button now matches the card's dot.

Round 2 finding from codex5, fixed.

1. After Tab moved focus onto a notification card, Esc no longer cancelled the
   open dialog: the key went from the card straight to the window. The document
   listener that runs the Tab cycle now also takes an Esc that comes from a
   notification card, isn't part of an IME composition, and that nothing handled
   yet, and runs the topmost modal's [취소] (`onEscape`) once; it acts only for
   the topmost modal, and a modal without `onEscape` leaves the key alone. The
   card itself still never closes with Esc (`docs/spec/08-problems.md`).
   `isComposingKey` in `ime.ts` is the same IME check for a DOM event
   (`cfed1ea`). Test that fails on the old code: with a `Dialog` and a
   `NotificationStack` open and 창 보기 in focus, Esc calls `onCancel` once and
   the warning card stays.
