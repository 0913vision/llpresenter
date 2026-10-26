# Review request: `screens-4`

- Team member: `screens`
- Branch: `feat/screens/output-preview`, stacked on `screens-3`
  (`feat/screens/display-layout-panel`)
- Base commit (`main`): `7296ddd5`
- Last commit: see the request line
- Related brief: `docs/briefs/screens.md`

## What changed and why

M3-O1 part 3: the output preview with 화면 내용 and 테스트 패턴, in the center
column panel `출력 미리보기` under the display layout (spec 06, "Output
preview").

- A segmented control switches between 화면 내용 and 테스트 패턴.
- 화면 내용 shows the selected screen's current output through the existing
  `ScreenPreview`.
- 테스트 패턴 sends `screen.testPattern.set`, which puts the screen into the
  live state's pattern list. The preview, which stays mounted, then draws the
  pattern through output's own layer (output-39) with the screen's correction
  and its name only, and the real output shows it too.
- The caption shows the screen name, the target with the monitor name
  (`모니터 2 EPSON 프로젝터`), and the resolution and refresh rate
  (`1920×1080 60Hz`). The monitor is the one main placed the screen on
  (`screenIds`, screens-3), and the resolution is in device pixels.
- The pattern sits above every layer of the real output and a clear doesn't
  remove it, so every exit hides it: picking 화면 내용, selecting another screen
  (a newly selected screen starts in 화면 내용), a Look or stage layout taking
  the selection, the panel or the workspace unmounting, and the window's
  `pagehide`.

## Changed files

- `src/renderer/src/screens/`: `OutputPreview.tsx` and its stylesheet,
  `previewCaption.ts`, and their tests.
- `src/renderer/src/screens/screenRows.ts`: exports `targetByMethod` and
  `UNASSIGNED_TARGET`, so the caption uses the same words as the screen list.
- Changes outside my paths: `src/renderer/src/shell/Workspace.tsx` (shell's
  path), the panel title `출력 미리보기` in the center column of 화면 설정 and
  its `case`.

## Checks run

| Command or test                         | Result               |
| --------------------------------------- | -------------------- |
| `npm run typecheck`                     | Passes               |
| `eslint`                                | Clean                |
| `vitest` on the screens and shell tests | Pass                 |
| `npm run format:check`                  | Passes               |
| GitHub CI                               | See the request line |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (GitHub CI run in the request)
- [x] `npm run format:check` passes
- [x] Every new behavior has unit tests, including each exit path of the pattern
- [x] No `any`, no bypassing type assertions, and no `!`
- [x] Every listener and observer is released (tested)
- [x] Colors, sizes, and spacing use design tokens
- [x] Not in the output path

## Decisions and open points

1. A selection change always resets the preview to 화면 내용. Sending the
   pattern to another projector because the operator clicked its row would be a
   surprise during a service.
2. The `pagehide` listener is a second line of defense for a closing or
   reloading window, where React may not run its cleanups. Main should also
   clear the pattern when a window closes; that is output's side.

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

1. [P2] Separate pattern: removed. `TestPattern.tsx`, its stylesheet, and its
   test are gone. The preview stays mounted in both modes, and the pattern comes
   from the existing layer once the live state lists the screen, so the
   correction and the name-only label are output's. Tests: one preview renderer
   is created in `preview` mode and kept across both modes, and with an edge
   margin of 10 % and an offset of (20, -10) the frame the preview draws has
   `testPattern: true` and that correction.
