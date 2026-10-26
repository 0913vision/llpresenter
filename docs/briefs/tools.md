# Brief: `tools`

- Session name: `tools` (a Codex session in tmux window `cx-tools`)
- Branch: `<tag>/tools/<feature>` (own worktree `.claude/worktrees/tools`; rules
  in `docs/WORKFLOW.md`)
- Dev server port: `5183`; app data folder: `D:\llp-dev\tools`
- Phase: M3 (`docs/plans/m3-breakdown.md`, "M3-T1 to M3-T4")

## Goal

Build the 진행 tools bundle: the Bible and 퀵 실행 panels, then the 진행 도구
tabs and the 매크로 tab, on the contracts and main-process parts that are
already merged (T3a 매크로 execution, T4a Bible data and reference parsing).

## Tasks

In this order, each split into review requests of about 600 to 800 lines:

1.  M3-T4b: the 퀵 실행 panel and the Bible field and panel.
2.  M3-T1a: the 표시 중, 무대, and 메시지 tabs.
3.  M3-T1b: the 공지 and 소품 tabs.
4.  M3-T3b: the 매크로 tab and the action palette.

T2 (오디오 and 타이머 tabs) waits for output's O6b and O7.

## Out of scope

The main-process Bible store and macro runner beyond what a task needs, the 진행
layout itself (shell), and the output rendering (output).

## Owned files (change only these)

`src/renderer/src/show/tools/`, `src/renderer/src/show/quick/`,
`src/renderer/src/show/bible/`, `src/main/macros/`, `src/main/bible/`. Other
paths follow the code-owner rule in `CLAUDE.md`, "Your files": change what the
request needs and list it under "Changes outside my paths".

## What to read

- `CLAUDE.md`, `docs/WORKFLOW.md`, `docs/reviews/CODEX-MEMBER.md`
- Spec: `docs/spec/04-show.md` (진행 도구, 퀵 실행, Bible),
  `docs/spec/02-data.md`, `docs/spec/08-problems.md`,
  `docs/spec/10-shortcuts-and-settings.md`
- Design system components: `design/system/project/README.md` and the component
  READMEs the panels use (`Panel`, `ListRow`, `TextField`, `SegmentedControl`,
  `Menu`, `Tooltip`)

## Contracts to follow

- Use the shared types, commands, and schemas in `src/shared/`. Additive changes
  go in your own request with schemas, valid and invalid tests, and caps; a
  change to an existing contract is `break` and goes to data first.

## Allowed dependencies

None beyond `package.json`.

## Done when

Each task meets its acceptance in `docs/plans/m3-breakdown.md`, with tests, and
its review request is approved and merged.

## How to verify

Fast checks on your files (`npm run typecheck`, the Vitest files you touched
with `--no-fsModuleCache` if a glob looks stale, ESLint, Prettier), then push
and wait for the GitHub CI run.

## Commits

- One line only, as `CLAUDE.md` defines, with no body or trailer.

## When you finish

Follow `docs/reviews/CODEX-MEMBER.md`: end your turn with a member report whose
last line is `LLPDONE:tools:<HHMMSS>`. The lead reads your screen.
