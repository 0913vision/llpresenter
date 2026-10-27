# Brief: `screens`

- Session name: `screens` (an Antigravity CLI session running Claude Sonnet 5.5,
  tmux window `ag-screens`; a model trial, user decision of October 26)
- Branch: `<tag>/screens/<feature>` (own worktree `.claude/worktrees/screens`;
  rules in `docs/WORKFLOW.md`)
- Dev server port and app data folder: given by the lead (machine-specific, kept
  outside the repository).
- Phase: M3 (`docs/plans/m3-breakdown.md`, "M3-O1 화면 설정: screens")

## Goal

Build the 화면 설정 workspace: the frame, the screen list, the display layout,
모니터 번호 표시, the output preview with 화면 내용 and 테스트 패턴, and the
screen properties, on the merged screen contracts (M3-D1c) and `screens.json`
through M3-D2. The Look editor (O2) and the stage layout editor (O3) follow.

## Tasks

1.  M3-O1, split into review requests of about 400 to 600 lines: the frame and
    screen list first, then the display layout and 모니터 번호 표시, then the
    preview with 화면 내용 and 테스트 패턴, then the properties.
2.  M3-O2, then M3-O3, if the lead extends the trial.

## Out of scope

The output side of the test pattern, monitor numbers, and edge margin (output's
M3-O9b), the toolbar and 진행 layout (shell), and the shared components (ui).

## Owned files (change only these)

`src/renderer/src/screens/` (except `looks/` and `stage/` until O2 and O3).
Other paths follow the code-owner rule in `CLAUDE.md`, "Your files".

## What to read

- `CLAUDE.md`, `GEMINI.md`, `docs/WORKFLOW.md`, `docs/reviews/CODEX-MEMBER.md`
- Spec: `docs/spec/06-settings.md` ("The 화면 설정 workspace", "Screens"),
  `docs/spec/10-shortcuts-and-settings.md` ("Screens (화면 설정)"),
  `docs/spec/02-data.md` (`screens.json`), and open questions 10, 13, 14, and 23
  in `docs/spec/README.md`
- Design system: `design/system/project/README.md`, `Layout`, `Panel`,
  `ListRow`, `PropertyRow`, `PreviewFrame`, `SegmentedControl`, `Select`,
  `Switch`, `Slider`, `TextField`

## Contracts to follow

- Use the shared types, commands, and schemas in `src/shared/`. Additive changes
  go in your own request with schemas, valid and invalid tests, and caps; a
  change to an existing contract is `break` and goes to data first.

## Allowed dependencies

None beyond `package.json`.

## Done when

Each request meets its part of the O1 acceptance in
`docs/plans/m3-breakdown.md`, with tests, and is approved and merged.

## How to verify

Fast checks on your files (`npm run typecheck`, the Vitest files you touched,
ESLint, Prettier), then push and wait for the GitHub CI run.

## When you finish

Follow `docs/reviews/CODEX-MEMBER.md`: end your turn with a member report whose
last line is `LLPDONE:screens:<HHMMSS>`. The lead reads your screen.
