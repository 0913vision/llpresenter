# Review request: `ui-8`

- Team member: `ui`
- Branch: `feat/ui/gallery-context`
- Review range: `da4aae7...feat/ui/gallery-context` (round 1 was
  `ed45be2...feat/ui/gallery-context`, stacked on ui-7; ui-7 has merged and
  round 2 sits on `main` with the same round 1 patches)
- Base commit (`main`): `da4aae7`
- Round 2, what to check: the finding and the lead's answers in "Team member's
  reply"; the two nits the lead sent
- Last commit: see the review request message
- Related brief: `docs/briefs/ui.md`, M2 in `docs/MILESTONES.md`
- Shared changes: none
- What to check: that each new gallery specimen uses the real part where one
  exists, and that the stand-in frames (with a NOTE) only draw what the shell or
  a dialog owns

## What changed and why

The ui-1 gallery sections never drew the specimens their preview cards show in
context, so qa couldn't compare them. This branch adds them under the cards'
names and in the cards' order (the comparison script pairs specimens by name and
order):

| Card             | Added specimens                                                                                                  | Built from                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Button           | "Confirmation dialog buttons, md, gap 8, one primary at far right", "In a panel header, sm"                      | `Button` in a stand-in dialog footer; `Panel` with `PanelTitle` and `PanelActions`              |
| IconButton       | "Panel header +, 내리기 at row end (hover)", "On/off tools, 비율 고정 off, 격자에 맞추기 on", "Dialog close, md" | `Panel`, `PanelTabs`, `ListRow` with `end`; pressed `IconButton`s; a stand-in dialog header     |
| SegmentedControl | "Fill variant in property fields, equal widths, horizontal 8", "In a panel header, screen tabs, 구성 picker"     | `PropertyRow` with `fill`; `Panel` with the `tabs` kind in `PanelActions`, a stand-in 구성 row  |
| Checkbox         | "Group rows, off, hover, focus, disabled", "Inside a dialog, row 30, no hover"                                   | The existing `CheckList` and `CheckRow` specimens, now named, plus the card's checked focus row |
| Switch           | "Switch at the left end of the control cell", "화면 설정 (Screen settings)"                                      | `Properties` (window and panel), `PropertyGroup`, `PropertyRow`, `Switch`                       |

## Changed files

- `src/renderer/src/ui/gallery/`: the Button, IconButton, SegmentedControl,
  Checkbox, and Switch sections, and the CSS modules of the stand-ins
  (`ButtonSection.module.css`, `IconButtonSection.module.css`,
  `SegmentedSection.module.css`).
- `design/system/project/components/IconButton/README.md` and `preview.html`:
  the lead's panel header gap decision.
- `design/system/project/components/MenuBar/README.md`: the menubar group nit.
- `docs/reviews/ui-9.md`: the historical verify checkbox nit.

## Checks run

### Round 2

| Command or test                                                | Result                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run verify`                                               | Pass, all five steps, 111.7 s, one run with `LLP_TEST_WINDOWS=offscreen` |
| Gallery and five component test files (`--maxWorkers 2`)       | Pass, six files, 45 tests                                                |
| Offscreen Chromium comparison after recovering the gallery CSS | Pass, Checkbox row geometry and IconButton header gap match the cards    |

Rebased once onto `main` at `da4aae7`. The three recovery rows each measure 412
by 30px and start at relative y positions 0, 30, and 60px. Each value column
starts 230px from its row's left edge, matching the card. All seven list rows
above remain 440 by 30px and stack at 30px intervals. The two panel header tool
buttons sit 8px apart, with off and on states matching the card. Inspected the
full Checkbox and IconButton gallery screenshots. Every window used
`show: false` and `webPreferences.offscreen: true`; the check and its servers
have exited.

### Round 1

| Command or test                              | Result                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run verify`                             | Pass, 5 steps run at once, 105 s (the new verify prints no test counts on a pass) |
| Gallery beside the preview cards (see below) | Done for the five cards, in Chromium (offscreen Electron)                         |

### Comparison with the preview cards

| Card             | Result                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Button           | 32 of 32 identical                                                                                                                                           |
| IconButton       | 17 of 17 matched; the three new specimens differ only in the root my script picks (the card's first button against the gallery's tab or row), and look alike |
| SegmentedControl | 12 of 12 matched; the property field names are 84 wide (`PropertyRow`), where the card's own frame uses 72, so the fill tracks are 12px narrower             |
| Checkbox         | 10 of 10 matched; the card puts a title inside the two list specimens, which my script takes as their root                                                   |
| Switch           | 10 of 10 matched; the same title-as-root difference                                                                                                          |

Not drawn on purpose:

- ToolbarButton "Tooltip, on", "Tooltip, off", "Tooltip, no monitor", and KeyCap
  "Tooltip, ll-tooltip__key of Tooltip" and "Menu, ll-menu__meta of Menu": the
  card draws a tooltip and a menu as static boxes. The app draws them only from
  a target, so the gallery would need a static tooltip and menu part used
  nowhere else. Pointing at the gallery's buttons shows the real tooltips.
- KeyCap "Recording a key, TextField sm": it comes with the key recording field
  under M3's U1.
- The two unlabeled specimens of the KeyCap card (the shortcut settings table).

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior has unit tests (no new behavior; gallery only)
- [x] Values from outside the process are validated with a schema (none here)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered listener is released (none added)
- [x] Caches and lists have size caps (none here)
- [x] An exception in the output path doesn't stop the output (not in the output
      path)
- [x] Only what's needed re-renders (gallery only)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md` (NOTE on each stand-in)
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused per commit

## Decisions I made (for the lead to confirm)

1. **Two icon buttons in a panel header** (round 2; the lead decided). They sit
   `space-8` apart like every header control (`PanelActions`, as the Panel
   README says); `space-4` is for a group of icon buttons outside a panel
   header. The IconButton README and card say so, and the gallery drops its
   stand-in group.

## Shared contract change requests

None.

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

Round 1 finding from codex5, fixed, with the lead's answer to decision 1 and two
README nits from the lead.

1. The three 출력 상태 복구 rows sat side by side in the specimen's flex row, so
   their values were squeezed and the fixed-width names overflowed. They now sit
   in one block inside the specimen, one full-width row each, as on the card
   (`8b0df36`). In Chromium the three rows stack at 30px, the value column
   starts where the card's does, and the list rows specimen above is unchanged.
   The card's "복구할 상태" caption belongs to the dialog that will use these
   rows, so the gallery doesn't draw it.
2. Decision 1, the lead's answer: icon buttons in a panel header sit 8px apart
   (`c238736`). The gallery's 비율 고정 and 격자에 맞추기 are plain
   `PanelActions` children now (8px apart in Chromium), the IconButton README
   keeps 4px for groups outside a panel header, and the card's tool group uses
   `space-8`.
3. Nit: the MenuBar README put `role="menubar"` on the whole row, but a menubar
   may hold only menu items. It now puts it on the group of the six menus
   (`ll-menubar__menus`), as shell-17 does (`48844d5`).
4. Nit: `docs/reviews/ui-9.md` checked the verify box although round 2 passed
   four of five steps; the box is unchecked now and points at the known soak
   failure (`11e94f5`).
