# Review request: `screens-5`

- Team member: `screens`
- Branch: `feat/screens/properties`, stacked on `screens-4`
  (`feat/screens/output-preview`)
- Base commit (`main`): `b99e97d1`
- Last commit: see the request line
- Related brief: `docs/briefs/screens.md`

## What changed and why

M3-O1 part 4, first request: the screen properties in the right column `속성` of
화면 설정 (spec 06, "Screen properties"; spec 10, "Screens"), saved at once to
`screens.json`. The 장치 row and the drag onto a monitor box come in the next
request, with the one-screen-per-monitor and control monitor rules.

- 화면: 이름 (required and unique; an empty or taken name shows the error ring
  with the reason in a tooltip, nothing is saved, and the old name comes back
  when the field loses focus) and 종류 (청중, 무대).
- 출력: 방식 (전체 화면, 창, 캡처용 창, and NDI, which is disabled with the
  reason in a tooltip), 해상도 (read-only monitor resolution in device pixels
  for a full screen; 1920×1080, 1280×720, and 3840×2160 for a capture window),
  and 주사율 (read-only, from the monitor main assigned).
- 안정성: 연결이 끊기면 (창으로 바꾸기, 출력 끄기; full screen only) and 항상 위
  (on by default for a full screen, off for a window).
- 보정: 가장자리 여백 (0 to 20 %) and 위치 미세 조정 (x and y, -200 to 200 px),
  both committed on Enter or blur.
- `ScreenEditor` saves the changes one at a time. Each save starts from the
  revision it saved last, so typing and then a switch never conflict; a refused
  save is dropped and reported as a notice, and a save that only failed to reach
  the disk counts as applied.

## Changed files

- `src/renderer/src/screens/`: `ScreenProperties.tsx` and its stylesheet,
  `screenEdits.ts` (the change, name check, ranges, and defaults),
  `screenEditor.ts`, `useScreenEditor.ts`, and their tests.
- Changes outside my paths: `src/renderer/src/shell/Workspace.tsx` (shell's
  path), the `case '속성'` and its import.

## Checks run

| Command or test                         | Result               |
| --------------------------------------- | -------------------- |
| `npm run typecheck`                     | See the request line |
| `eslint`                                | See the request line |
| `vitest` on the screens and shell tests | See the request line |
| `npm run format:check`                  | See the request line |
| GitHub CI                               | See the request line |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (GitHub CI run in the request)
- [ ] `npm run format:check` passes
- [ ] Every new behavior has unit tests
- [ ] No `any`, no bypassing type assertions, and no `!`
- [ ] Every observer and listener is released
- [ ] Colors, sizes, and spacing use design tokens
- [ ] Not in the output path

## Decisions and open points

1. The ranges and defaults come from spec 10 ("Screens"): 가장자리 여백 0 to 20
   %, 위치 미세 조정 -200 to 200 px, 항상 위 on for a full screen and off for a
   window, 연결이 끊기면 창으로 바꾸기. The 절전 막기 row is left out, as spec
   10 proposes (main already keeps the display awake while an output is on).
2. The writes go through the whole-file `settings.update`, which main merges
   with the unknown fields it already holds, so the file keeps what this window
   doesn't know.
3. Main applies the saved screen when the file changes (it follows
   `screens.json`), so the window sends no separate apply command.
4. 가장자리 여백 and 위치 미세 조정 are saved now; the picture correction on the
   real output is output's (M3-O9b), and the preview already draws it.

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
