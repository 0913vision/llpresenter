# Review request: `spec-64`

- Team member: `spec` (Codex)
- Branch: `fix/spec/unavailable-menus`
- Base, range, and exact-head CI: see the request message
- Review round: 1
- Task: M3-UX-05, inert menu triggers presented as enabled
- Stack: initially prepared on spec-63, now rebased onto local main after its
  merge

## What changed and why

편집, 창 and 도움말 previously advertised an available popup but opened nothing.
These unfinished menus now use the design system's disabled treatment:
`aria-disabled`, `text-off`, no hover/pressed highlight, and a reason tooltip.
They remain focusable so keyboard users can read the reason. They no longer
advertise a popup or expansion state. Existing 파일, 보기 and 출력 menus keep
their actions and switching behavior.

This takes the lead's explicitly permitted minimal unavailable state for the
three unfinished menus. It does not invent missing commands or destinations.

## Validation

All 23 MenuBar/FileMenu regressions pass, including pointer/keyboard no-op
activation and reason tooltips for all three unavailable menus. Typecheck,
scoped lint, production build, formatting and diff checks pass. CI pending (API
403); the lead checks the exact pushed head.

## Checked in the app

Ran the actual built Electron main/preload and renderer, isolated invented data,
port 5193 and CDP 9517 with `LLP_TEST_WINDOWS=offscreen`. The driver passed
`node --check` before launch. No API was mocked. All owned processes stopped.

- Checked disabled semantics and pointer reason tooltips for
  [편집](spec-64/edit-unavailable.png), [창](spec-64/window-unavailable.png),
  and [도움말](spec-64/help-unavailable.png). Click, Enter, Space and Down did
  not open anything. Keyboard activation used CDP key events after explicitly
  focusing the target, because native Tab navigation in the hidden window did
  not return focus reliably; native Tab behavior is not claimed here.
- Opened/closed 파일 and 출력 twice, warmed them ten round trips, then switched
  between them twenty round trips. Both remained operable with correct closing.
- Repeated the build/checks and actual app check after rebasing. Matching
  closed-menu checkpoints stayed at 399 elements, 1445 DOM nodes, 29 documents
  and 665 listeners. Collected heap was 5,517,300, 5,587,200 and 5,634,120
  bytes, about 114 KiB growth in the short sample. No renderer exception
  occurred. See [measurements](spec-64/measurements.json).

## Changes outside my paths

None. Shell implementation/tests/styles and this review record are owned paths.

## Verdicts (recorded by the lead at merge)

- Round 1 (9875ad33): reviewer (Codex) Approve. Lead Approve through the lead's
  merge check: the exact-head CI run passed, the branch rebased onto local
  `main` without conflicts, and typecheck passes. Earlier rounds' findings and
  replies are above.
