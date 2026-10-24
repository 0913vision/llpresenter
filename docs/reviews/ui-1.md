# Review request: `ui-1`

- Team member: `ui`
- Branch: `feat/ui/form-controls`
- Base commit (`main`): `5b09a98`
- Last commit: the commit that adds this file (see the review request message)
- Related brief: `docs/briefs/ui.md`

## What changed and why

The first batch of shared design system components, built as React components in
`src/renderer/src/ui/`, so that the workspaces and the shell use the same parts.
Each one follows its README in `design/system/project/components/` and its
reference CSS in `design/system/css/`, ported to a CSS module that uses only the
token variables.

| Component        | Exports                                        | Notes                                                                                                                     |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Button           | `Button`                                       | secondary, primary, ghost; sm and md; leading icon                                                                        |
| IconButton       | `IconButton`                                   | sm and md; on/off (`pressed`), menu opener (`menu`, `expanded`), shortcut in the tooltip                                  |
| SegmentedControl | `SegmentedControl`                             | radio, tabs, toggle kinds; fill; icon segments; counts with warning; arrow keys, Home, End, one Tab stop                  |
| ToolbarButton    | `ToolbarButton`, `ToolbarTabs`, `OutputToggle` | action, view toggle, menu opener; workspace tab list with arrow keys; screen output with live, off, and no-monitor states |
| TextField        | `TextField`, `NumberField`, `TextArea`         | sm, md, title, ring, block, affix, search (clear-text button, Esc), error with a described reason                         |
| Select           | `Select`                                       | the trigger button only: value, meta, leading icon, media, or macro tile; opens on click, Enter, Space, Down              |
| Checkbox         | `Checkbox`, `CheckRow`                         | on, off, mixed; plain, list, and group rows; value and meta                                                               |
| Switch           | `Switch`, `SwitchRow`                          | Space toggles, arrows don't                                                                                               |
| Slider           | `Slider`                                       | regular, compact, block; leading icon; arrows, PageUp, PageDown, Home, End; focus ring gap per surface                    |

Shared helpers: `classNames`, `pressHandler` and `spaceOnlyKeyHandler`
(`press.ts`), `useRovingSelection` (`roving.ts`, used by SegmentedControl and
ToolbarTabs), `objectParticle` (`korean.ts`, 을 or 를 for the no-monitor
tooltip), the number field math (`numberText.ts`), and the slider math
(`sliderValue.ts`). Everything is exported from `src/renderer/src/ui/index.ts`.

The development gallery (`src/renderer/gallery.html`,
`src/renderer/src/ui/gallery/`) shows every component in every state, laid out
with the same group titles and specimen labels as the preview cards.
`?c=<Component>` shows one component. The Vite dev server serves it, and
`npm run build` leaves it out (`out/renderer` has only `index.html`).

## Changed files

- `src/renderer/src/ui/*.tsx`, `*.module.css`, `*.ts`: the components, helpers,
  and their tests (one test file per component or helper).
- `src/renderer/src/ui/index.ts`: exports.
- `src/renderer/gallery.html`, `src/renderer/src/ui/gallery/`: the gallery and
  its smoke test.
- No shared files, no configuration, no `package.json`.

## Checks run

| Command or test                              | Result                                     |
| -------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                          | Pass                                       |
| `npm test`                                   | Pass, 25 files, 148 tests                  |
| `npm run format:check`                       | Pass                                       |
| `npm run build`                              | Pass; the gallery is not in `out/renderer` |
| `npm run verify` (from phase 1 on)           | Not on `main` yet                          |
| Gallery beside the preview cards (see below) | Done for all nine cards                    |

### Comparison with the preview cards

I ran the gallery (`LLP_DEV_PORT=5186 electron-vite dev --rendererOnly`) and the
card server (`node design/system/card-server.js 5296`) and compared each card
with its gallery section at 1200 px wide. The built-in browser isn't available
in my session, so I used a throwaway Electron script (offscreen windows, kept in
my temp folder, not committed). For every specimen it reads the computed styles
of the component and all its parts (size, padding, gap, colors, type, radius,
shadow, outline) on both pages and lists the differences. Pinned card states
were reproduced on the real components: hover and pressed with real mouse input,
focus with the DevTools `CSS.forcePseudoState` (`:focus-visible`,
`:focus-within`). I also looked at both screenshots side by side.

| Card             | Specimens identical | Remaining differences (all explained below)            |
| ---------------- | ------------------- | ------------------------------------------------------ |
| Button           | 30 of 30            | None                                                   |
| IconButton       | 14 of 14            | None                                                   |
| SegmentedControl | 10 of 10            | None                                                   |
| ToolbarButton    | 16 of 26            | 1, 2 (markup only; the computed size and colors match) |
| TextField        | 15 of 18            | 3, 4, 5                                                |
| Select           | 14 of 14            | None                                                   |
| Checkbox         | 8 of 8              | None                                                   |
| Switch           | 6 of 8              | 2                                                      |
| Slider           | 8 of 9              | 6                                                      |

Differences I kept on purpose, and things the comparison found:

1. The view toggle (미디어) wraps its icon in the same icon slot as the menu and
   output buttons. The card puts the icon directly in the button. Size, gap, and
   position are the same.
2. Workspace tabs and switch rows report `display: flex` against `inline-flex`
   only because the card places them directly in a flex item and the gallery
   doesn't. Not a component difference.
3. TextField, disabled: the README says the icon turns `text-off`, but the
   reference CSS sets `text-3` on the icon itself, so the card keeps a `text-3`
   icon. I followed the README. The reference CSS may want the same fix.
4. TextField, focus: only `outline-offset` differs, on elements whose outline is
   `none` on both pages. Nothing is drawn.
5. The number field with a unit, the title field, and the range fields sit in
   card-only wrappers (panel header strip, inline span). The fields themselves
   match.
6. Card compositions that belong to other components aren't in the gallery:
   dialog footers and panel headers (Button, IconButton, SegmentedControl),
   property rows (Switch, Slider), and tooltip specimens (ToolbarButton). They
   come with Dialog, Panel, PropertyRow, and Tooltip.
7. The card server can't load Pretendard: `design/system/project/tokens.css`
   points at `fonts/PretendardVariable.woff2`, which isn't in the repository, so
   the cards render in a fallback font (text is about 8% wider). For the
   comparison I loaded the app's Pretendard into the card page. Worth fixing in
   the design folder so that other sessions compare at the right widths.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (not on `main` yet; typecheck, test, format check,
      and build pass)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (none here)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the components register none)
- [x] Caches and lists have size caps (none here)
- [x] An exception in the output path doesn't stop the output (not in the output
      path)
- [x] Only what's needed re-renders (control window)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly (one commit per component)
- [ ] Measured performance values (when relevant): not relevant

## Decisions I made (for the lead to confirm)

1. **Files.** Flat files in `src/renderer/src/ui/`, next to `Icon.tsx`, one
   component (or family) per file with its CSS module and test.
2. **Disabled.** Buttons, segments, toolbar buttons, Select, Checkbox, and
   Switch use `aria-disabled` and ignore presses, so they stay focusable and
   keep their tooltip (README of Button and IconButton). Text fields and the
   slider use the native `disabled` attribute, as their READMEs and the cards
   do.
3. **Focus ring and reduced motion** come from `base.css` (global
   `:focus-visible` ring, global reduced-motion rule) and aren't repeated in the
   modules. Components only override them where the README draws something else:
   `ring-field-focus` on fields, the knob ring on the slider, and the raised
   z-index of a focused segment.
4. **Anatomy sizes** without a global token are custom properties on each
   component's root class (your answer). Motion uses `--motion-hover`, type uses
   `--type-*`.
5. **API shapes that differ from the README sketches**, for typing:
   - `NumberField` and `TextArea` are their own components instead of
     `TextField variant="number"` and `multiline` (a number value and a string
     value can't share one `value` type).
   - `ToolbarTabs` renders the whole tab list, because the arrow keys and the
     single Tab stop need the group. `ToolbarButton` covers action, view toggle,
     and menu opener, and `OutputToggle` the screen output.
   - `Select` takes `lead` as a union (`icon`, `media`, or `tile` with a
     `MacroColor` from `@shared/colors`) instead of three separate props.
   - `Slider` takes `width` (`regular`, `compact`, `block`) and `surface`
     (`panel`, `dialog`) instead of class flags and setting `--ll-slider-cut` by
     hand.
   - `CheckRow` takes `variant` (`plain`, `list`, `group`).
6. **Sequencing with ui-2** (agreed earlier): Select draws only the trigger and
   reports `onExpandedChange`; the list comes with Menu. The `title` prop is the
   native title attribute until Tooltip lands, marked with `TODO(0913vision)`.
   An invalid field's reason is also hidden text linked by `aria-describedby`,
   so screen readers get it now.
7. **Keyboard details from the READMEs**: Checkbox and Switch ignore Enter (it
   belongs to the dialog's primary button). NumberField is a `spinbutton`; typed
   values in range apply at once, out-of-range values snap on blur or Enter, and
   text that isn't a number goes back to the last value. Slider handles its keys
   itself so that PageUp and PageDown move a tenth of the range, at least one
   step.
8. **Accessible names**: a segment with a count is named "바꾼 것 3"; a check
   row names its checkbox by the label and describes it by the value or meta.
9. **No-monitor tooltip**: `objectParticle` picks 을 or 를 from the last
   readable character of the target ("모니터 2를", "모니터 3을"), for Hangul,
   digits, and Latin letters.
10. **TextField `numeric`** right-aligns the value with tabular numbers, as the
    card does for the media range fields (시작, 끝).
11. **Gallery sample image**: the Select specimens import
    `design/system/upload/Media/warm-light.jpg` directly instead of copying it.

## Shared contract change requests

All earlier requests are done (`--type-*`, `--motion-*`, `@shared/colors`).
Small ones for later, not blocking:

1. `--ring-dot-cut-pressed` (`0 0 0 2px var(--bg-raised)`): the output dot ring
   on a pressed toolbar button. `ToolbarButton.module.css` builds it from a
   local width today; there is a token for the hover ring only.
2. The Pretendard file for the card server (item 7 above).

## Where to look

- `roving.ts` and its use in `SegmentedControl.tsx` and `ToolbarTabs.tsx`: the
  shared arrow-key and Tab-stop logic.
- `NumberField.tsx`: the draft text, commit on blur and Enter, and the stepping
  rules.
- `fieldFrame.tsx`: press-to-focus on the field frame and the invalid reason.
- The hover, selected, and disabled selectors in `SegmentedControl.module.css`
  and `ToolbarButton.module.css`, where the reference CSS raised specificity by
  repeating classes; I excluded the other states in `:not()` instead.

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
