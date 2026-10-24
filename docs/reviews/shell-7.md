# Review request: `shell-7`

- Team member: `shell`
- Branch: `feat/shell/clear-row` (stacked on `feat/shell/show-header`, shell-6,
  which is stacked on `feat/shell/show-keys`, shell-5)
- Base commit: the last commit of shell-6 round 2 (`d27678d`). It merges after
  shell-5 and shell-6.
- Last commit: see the commit that adds this file
- Related brief: the lead's queue (the 지우기 row)

## What changed and why

The 지우기 row of the 진행 workspace (`docs/spec/03-output.md`, "Clearing and
undo", and the design system `ClearButton` README), built with plain elements
until the `ui` components merge.

1. **The row.** 모두, 가사, 미디어, 소품, 오디오, 메시지, 공지, a divider, and
   되돌림, under the preview in the right column, as a panel without a header.
   The regular form shows an icon and the name (모두 is 1.4 times as wide); the
   narrow size class shows icons only and a 40 px height. A button is bright
   when its layer holds something and dim when not (`aria-disabled`,
   `data-state="off"`, still focusable, a click does nothing). 모두 is bright
   while any layer holds something. Every button has `aria-label` ("가사
   지우기"), `aria-keyshortcuts`, and a tooltip with the shortcut ("가사 지우기
   F2"). 되돌림 is labeled "되돌리기".
2. **What the buttons send.** A click sends the existing `layer.clear` command
   with the layer (or `all`), and 되돌림 sends `clear.undo`. The brightness is
   computed from the live state's layers (`hasSomethingToClear`), so it follows
   what the main process says is on output.
3. **Keys.** `clearKeys.ts` is a thin global handler for the control window: F1
   to F7 clear (in a text field too, as the spec says), and Ctrl Z undoes the
   last clear outside text fields. Keys are matched by `code`, a held key runs
   once, and repeats are swallowed. The bindings are keyed by the command IDs of
   spec 10 (`clear.all`, `clear.slide`, and so on), so the M4 shortcut registry
   can replace the table.

## Changed files

- `src/renderer/src/show/` (`clear.ts`, `ClearRow.tsx`, `ClearRow.module.css`,
  `clearKeys.ts`, and the tests)
- `src/renderer/src/state/clear.ts` (new)
- `src/renderer/src/shell/Workspace.tsx`, `Workspace.module.css` (a panel can be
  `bare`; the right column gets the 지우기 row)
- `src/renderer/src/control/App.tsx` (starts the key handler)

## Checks run

`npm run verify` on commit `020e239` (stacked on shell-6, `8f0dc14`) passed all
five steps in 160.1 s: `typecheck`, `lint`, `format:check`, `test:coverage`, and
`build`.

Tests: `ClearRow.test.tsx` (10: the group and the order, shortcuts and tooltips,
dim and bright buttons, the all button, the clicks, the undo click, and the
regular and compact forms) and `clearKeys.test.ts` (15: every F key, text
fields, repeats, modifiers, Ctrl Z, and handled events).

### Running app (port 5187)

At 1920x1080 with real mouse and key events: at the start every layer button was
dim; after clicking a 장 the 가사 and 모두 buttons turned bright; clicking 가사
cleared the live tile and dimmed both; clicking 되돌림 brought the same 장 back;
F2 cleared it again and Ctrl Z brought it back. A screenshot matched the design
system: 모두 wider, dim buttons, and 되돌림 one step lower.

Not checked: the other layers (미디어, 소품, 오디오, 메시지, 공지) in the real
app, because nothing in the app puts content on them yet. They use the same code
path and the unit tests cover them.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Checks run")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (none)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the `keydown` listener is removed on
      unmount)
- [x] Caches and lists have size caps (not applicable)
- [x] An exception in the output path doesn't stop the output (these changes
      only send commands)
- [x] Only what's needed re-renders (each button selects one boolean)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md` (TSDoc and one `TODO(0913vision)`)
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- 되돌림 is always in the "undo available" state, because the live state has no
  `canUndo` yet (the lead asked data for it in data-6). The main process ignores
  an empty undo. A `TODO(0913vision)` in `state/clear.ts` marks it.
- The clear keys are a global handler in `control/` for now, as the lead agreed.
  F1 to F7 clear in text fields and during an IME composition (the spec says F1
  to F7 still clear then).
- The tooltip is the native `title` until the `ui` `Tooltip` lands.

## Shared contract change requests

- `canUndo` in `LiveState` (already requested through the lead).

## Where to look

- `clearKeys.ts`: the order of the checks, and Ctrl Z in text fields.
- `Workspace.tsx`: the `bare` panel.

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

Round 1 (codex2), answered once:

1. Finding 1 (Ctrl Z in 준비): `handleClearKey` and `useClearKeys` take the
   workspace on screen, and Ctrl Z undoes a clear only in 진행 and 화면 설정. In
   준비 it is left alone, as the edit undo. `App` passes its workspace, and the
   listener follows it. Tests: "undoes the last clear in the show and screens
   workspaces", "is the edit undo in 준비 and does not undo a clear", and
   "follows the workspace on screen".
2. Finding 2 (text editing against other controls): the check is now text entry:
   a `textarea`, anything `contenteditable` except `false` (so `true`, the empty
   value, and `plaintext-only`), and an `input` of a text type (text, search,
   url, tel, email, password, number, and the date and time types, and an input
   without a type). A range slider, checkbox, radio, button input, select, and
   button are not text entry, so Ctrl Z undoes a clear from them. Both lists are
   tests.
3. Finding 3 (IME): Ctrl Z is left alone while `isComposing` is true. F1 to F7
   still clear during a composition. Tests for both.
4. Finding 4 (capture phase): the listener is added in the capture phase, so a
   field or popup handler below it cannot consume F1 to F7 first. Test: "clears
   with F2 even when a handler below it consumes the key" (a real input with a
   keydown handler that calls `preventDefault` and `stopPropagation`). A field
   that records a shortcut is the exception: any element inside
   `[data-shortcut-recording]` is left alone, for both the F keys and Ctrl Z.
   That attribute name is my choice, because no component sets it yet; the
   settings page must set it while the key field records. Please confirm the
   name with whoever builds that page.
5. Finding 5 (nit): the TSDoc on the private `defaultCodes` is gone.
6. Also: `ClearRow.test.tsx` builds its API with `fakeLlpApi`, since data-5 is
   on `main`. The branch is restacked onto shell-6 round 2 with
   `git rebase --onto`, without conflicts.
7. Round 2: `npm run verify` on commit `f033712` (stacked on shell-6 round 2,
   `d27678d`) passed all five steps in 150.6 s: `typecheck`, `lint`,
   `format:check`, `test:coverage`, and `build`.
