# Review request: `spec-64`

- Team member: `spec` (Codex)
- Branch: `fix/spec/unavailable-menus`
- Base, range, and exact-head CI: see the request message
- Review round: 1
- Task: M3-UX-05, inert menu triggers presented as enabled
- Stack: initially prepared on spec-63, to be rebased after its merge

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
- Matching closed-menu checkpoints stayed at 397 elements, 1443 DOM nodes, 29
  documents and 664 listeners. Collected heap was 5,498,904, 5,573,688 and
  5,630,176 bytes, about 128 KiB growth in the short sample. No renderer
  exception occurred. See [measurements](spec-64/measurements.json).

## Changes outside my paths

None. Shell implementation/tests/styles and this review record are owned paths.
