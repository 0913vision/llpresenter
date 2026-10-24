# Review request: `ui-8`

- Team member: `ui`
- Branch: `feat/ui/gallery-context`
- Review range: `ed45be2...feat/ui/gallery-context` (stacked on ui-7, whose tip
  is `ed45be2`; after ui-7 merges, the range becomes
  `main...feat/ui/gallery-context`)
- Base commit: `ed45be2` (`feat/ui/live-parts`, ui-7)
- Last commit: the commit that adds this file (see the review request message)
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

## Checks run

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

1. **Two icon buttons in a panel header.** The Panel README puts `space-8`
   between header controls, and the IconButton README puts `space-4` between
   several icon buttons. The gallery wraps the two tools in a stand-in group
   with `space-4`, as the card does. If the IconButton rule should hold in every
   panel header, `PanelActions` could close the gap between adjacent icon
   buttons; I didn't add that without a caller.

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

1.
