# Decision log

Record each new decision made during implementation as one entry with its date.
The full product decisions are in `docs/HANDOFF.md` and `docs/spec/`.

- 2026-10-24: Team workflow. A lead and team members (work sessions). Team
  members work in their own worktrees and send review requests. They're
  responsible for rebasing their own branches, resolving conflicts, and
  addressing reviews. Both the lead and the reviewer must approve, and merges
  into `rewrite` are fast-forward only.
- 2026-10-24: Until Codex joins, the reviewer is a read-only review agent that
  the lead starts fresh for each review. After that, it's Codex (read-only).
- 2026-10-24: Every session runs with permission prompts turned off. That's why
  `CLAUDE.md` has safety rules.
- 2026-10-24: The repository's git configuration turns on long paths and turns
  off automatic line ending conversion. `.gitattributes` fixes line endings to
  LF. The global git configuration wasn't touched.
- 2026-10-24: Pin Electron to 44.9.x. 45.0.0 is a first release, out for three
  days. Change it in phase 1.
- 2026-10-24: `rewrite` starts empty (only the documents and the design
  sources). The early skeleton built before the drafts stays in the local
  archive branch `archive/prototype-2026-10`, and the lead takes only what's
  useful from it when building the initial scaffold. Team members start from the
  commit that contains the initial scaffold.
- 2026-10-24: The session that handled phase 0 continues as the lead (user
  request).
- 2026-10-24: No GitHub PRs for now (no `gh`, and team members don't push).
  devops reconsiders this in phase 1.
- 2026-10-24: The devops team member builds CI. The local `npm run verify` comes
  first, and GitHub Actions runs it once more on Windows for every push to
  `rewrite`.
- 2026-10-24: GitHub is used for backup and CI (the user's permission). Only the
  lead pushes `rewrite`, and reviews happen in review documents in the
  repository. The repository is public, so confirm with the user before the
  first push.
- 2026-10-24: `rewrite` starts from `origin/main` (9b23462), so that `main` can
  fast-forward to `rewrite` after v1.
- 2026-10-24: Multi-layer clearing (Clear Groups) isn't in v1. Macros replace
  it.
- 2026-10-24: Commit messages are one line,
  `tag(scope): <one English sentence starting with a base-form verb>`, with no
  trailer (`Co-Authored-By` or others) (user rule). The tags and examples are in
  `CLAUDE.md`. The messages of the first commits, which weren't pushed yet, were
  rewritten in this format.
- 2026-10-24: Documents, code comments, test names, log messages, and commit
  messages are in English and follow the Google style guides, or another large
  company's guide where Google has none (user rule). Product UI strings stay in
  Korean.
- 2026-10-24: Comments are minimal: TSDoc, `NOTE(0913vision): ...` for context
  the code can't show, and `TODO(0913vision): ...` for later work, and nothing
  else (user rule). The lead picked TSDoc over JSDoc when the user asked for one
  fixed choice, because the code is TypeScript.
- 2026-10-24: Prettier 3.9.10 with the `gts` settings formats code, CSS, JSON,
  and Markdown, and wraps Markdown prose at 80 columns. `design/` is excluded
  because its scripts generate it. Where Prettier and a style guide disagree on
  whitespace, Prettier wins.
- 2026-10-24: Commit tags are the user's break, feat, refactor, style, docs, and
  chore, plus fix, which the lead added for bug fixes (they are neither features
  nor refactors).
- 2026-10-24: Sample lyrics in the repository come from hymn 1 (만복의 근원
  하나님, public domain), because the repository is public.
- 2026-10-24: Members rebase only their own branch onto `rewrite`. Nobody
  rebases `rewrite` itself. `CLAUDE.md` now says the same as `docs/WORKFLOW.md`.
- 2026-10-24: Every session keeps working notes in `.llp/notes.md` (ignored by
  git), and a SessionStart hook prints them with the git state after every start
  and compaction, so a compacted session can carry on (user request).
- 2026-10-24: The product decisions from the drafts phase moved from the lead's
  private notes into `docs/product-log.md`, so every session can read the
  sources that `docs/spec/` cites.
- 2026-10-24: Renderer tests run in jsdom with Testing Library (`jsdom`,
  `@testing-library/react`, `@testing-library/dom`, and
  `@testing-library/user-event`, all MIT, development only, each release at
  least two weeks old). Vitest runs two projects: `node` for the main process,
  preload, shared code, and scripts, and `renderer` for the renderer. The lead
  set this up before the UI work starts, so UI members can test components from
  their first commit.
- 2026-10-24: trial, devops, and ui start at the same time instead of trial
  first, because the purpose of member sessions is parallel development with
  each session keeping its own context (user). The shared UI components moved
  from the lead's share to the ui member. The lead keeps the shell, the data
  schemas, reviews, and merges.
- 2026-10-24: Member branches are `team/<name>` instead of `rewrite/<name>`. Git
  can't hold the `rewrite` branch and a `rewrite/<name>` branch at the same
  time, so the earlier name could never be created. Found when the first member
  worktree failed to create.
- 2026-10-24: Branch names follow `<tag>/<name>/<feature>` (user rule), for
  example `feat/ui/form-controls`, with exactly three parts. This replaces
  `team/<name>`, and each review request gets its own branch.
- 2026-10-24: `npm ci` runs `install-electron` as `postinstall`. Electron 44 no
  longer downloads its binary on install, and electron-vite looks for the binary
  directly, so a fresh worktree failed with `Electron uninstall` (found by
  trial-1). The script skips the download when the binary is already there.
- 2026-10-24: Each type style has a `font` shorthand variable, `--type-<style>`
  (for example `--type-label: 400 12px/16px var(--font-ui)`), generated from
  `tokens.json`. Components use `font: var(--type-label)` instead of the global
  classes, which CSS modules can't compose safely (asked by ui). Named
  `--type-*` so it doesn't collide with the family variables `--font-*`.
- 2026-10-24: The three UI motion values from the design system README are
  tokens: `--motion-hover` (100ms ease-out), `--motion-popover` (120ms
  ease-out), and `--motion-dialog` (160ms ease-out), generated from a new
  `motion` family in `tokens.json` (asked by ui).
- 2026-10-24: Lint with TypeScript 7 (asked by devops). typescript-eslint 8.72.0
  supports only `typescript >=4.8.4 <6.1.0`, and TypeScript 7 has no JS API
  until 7.1, so `typescript` is aliased to `@typescript/typescript6@6.0.2`
  (binary `tsc6`) for typescript-eslint and the editor, and TypeScript 7 stays
  as `@typescript/native` (`npm:typescript@7.0.2`), which provides `tsc` for
  `npm run typecheck`. `@eslint/js` is added (exact pin) for ESLint's core
  recommended rules. gts isn't used: it brings ESLint 9, runs Prettier inside
  ESLint, and turns off `no-non-null-assertion`. Revisit when typescript-eslint
  supports TypeScript 7.
- 2026-10-24: `tsconfig.node.json` includes `test/**/*` (shared test helpers)
  and sets `rewriteRelativeImportExtensions`, so scripts that Node runs directly
  can import siblings as `./x.ts`.
- 2026-10-24: Members that finish a brief get the next one instead of being
  closed (user). The trial session continues as shell (column resizing) and the
  first reviewer session continues as data (schemas). Both tasks moved from the
  lead's share. Codex is the reviewer.
- 2026-10-24: `main` is the integration branch (user). The lead manages it, and
  members' branches are merged into it by fast-forward. `main` was
  fast-forwarded from the 2024 code (9b23462) to the rewrite (3c3efb7) without a
  force push, and the 2024 code is kept as the tag `legacy-2024`. The branch
  `rewrite` is retired and stays on GitHub only as history.
- 2026-10-24: The schema library is valibot 1.5.0 (proposed by data, approved by
  the lead). For the song schema it was the smallest of zod, zod/mini, valibot,
  and arktype (2.7 KB gzip against 8.4, 24.6, and 45.9 KB), passed TypeScript 7
  with the repository's options, keeps unknown fields at every level with
  `looseObject`, supports brands and exact optional fields, and puts the field
  path and the received value in its messages. It has no dependencies (MIT).
  Only `src/shared/schema/` imports it, behind `parse<Format>` and
  `serialize<Format>`, so replacing it later touches only that folder. zod
  remains the fallback if valibot stops being maintained.
- 2026-10-24: The shortcut system and a settings window that covers what
  ProPresenter's settings offer (fonts included) are planned for implementation
  later (user). The spec member researches ProPresenter now and writes a
  proposal (`docs/spec/10-shortcuts-and-settings.md`) for the user to decide
  before design and code.
- 2026-10-24: CI stays as it is (user): `npm run verify` locally is the gate
  before a merge, and GitHub Actions checks `main` after each push. No GitHub
  PRs for now.
- 2026-10-24: Version rules (user): the major version goes up only with the
  user's permission. `break`, `feat`, and `refactor` raise the minor version;
  `fix`, `style`, `chore`, and `docs` raise the patch version. The version lives
  only in `package.json`.
- 2026-10-24: Flow for `main` (user): before a push to `main`, a pre-push hook
  runs `npm run verify` and blocks the push on failure. After a push to `main`,
  GitHub Actions runs verify and then a bot commits `Bump version: x.y.z` and
  tags `vx.y.z`. That commit is the only exception to the commit message format.
  The lead pulls the bot's commit before the next merge. No scheduled tests for
  now. devops-2 builds this; the earlier local bump plan is dropped.
- 2026-10-24: The team works in milestones with a QA member (user): each
  milestone is split among members, frozen with a tag `m<number>`, and tested by
  qa while the others start the next milestone (`docs/MILESTONES.md`). M1 is the
  foundation, M2 the vertical slice, taken over from the lead's phase 2 share
  and split among data, shell, ui, devops, and a new output member.
- 2026-10-24: The lead manages only (user): plans, briefs, reviews, merges, and
  coordination. Members write all code, shared contracts included when their
  brief allows it.
- 2026-10-24: Speed changes after the user saw the team stall: members run fast
  checks while working and the full `npm run verify` once per request (known
  flaky tests recorded, not rerun); the lead rebases conflict-free branches at
  merge time and batches its own document commits; reviewers approve when only
  nits remain, which the author fixes in the next branch; the lead records the
  verdicts in the review document at merge time.
- 2026-10-25: Shortcuts follow ProPresenter (user), since they can be changed
  later in the 단축키 settings. Where ProPresenter has a default or a behavior,
  use it; where it has none, use the spec proposal. Shortcuts are matched by
  physical key, and key names are written in English (Page Up, Home, Ctrl S).
  The settings questions in the proposal (10 to 18) use the proposal's defaults
  until the user decides otherwise.
- 2026-10-25: Reset after the team stalled on conflicts (user). The lead fixed
  the rules in one place (`CLAUDE.md`, "Team member rules"), made them fixed
  until the milestone freeze, gave every path one owner (`docs/MILESTONES.md`,
  "File ownership"; data owns the shared contracts and output owns the
  main-process wiring), and set a single merge queue with one Codex window per
  request (`docs/STATUS.md`). The move to GitHub pull requests with rebase
  merges waits for the M1 freeze.

## 2026-10-25: Fewer pushes, one-line Codex requests

- The lead pushes `main` to GitHub only at a milestone freeze or when a feature
  bundle is complete, not after every merge (user decision). Local `main` stays
  the integration branch for the team.
- A Codex window gets one line that points at the review document and
  `docs/reviews/CODEX.md`; the review document carries the review range and what
  to check (user decision).
- A documents-only review request runs `npm run format:check` instead of the
  full `npm run verify`, to cut machine load.

## 2026-10-25: `test` is a commit tag

- `test(scope): ...` is allowed for commits that add or change tests only (user
  decision). The version bot treats it as a patch change, like `chore` and
  `docs`.

## 2026-10-25: One owner of `app.json`

- The data store (`src/main/store/`) is the only module that reads, validates,
  and writes `app.json` (lead decision, from qa's bug M1-12). It parses the file
  once, logs one warning that names the file and the field when the file is
  broken, keeps unknown fields, and runs writes in order.
- The UI state store (`src/main/uiState/`) stops parsing `app.json`. It reads
  and changes its fields (`layout`, `previewBig`, `macroView`,
  `macroCollection`, `mediaStrip`) through the data store's interface, and the
  data store writes `dataRoot`, the locations, and `lastServiceId` the same way.
  Two whole-file writers would overwrite each other's fields.
- Data lands the interface and the single warning first; shell then moves
  `uiState` onto it.

## 2026-10-25: Verification before the push, only the bump after it

- A push to `main` on GitHub runs only the version bump, never `verify` (user
  decision). Verification ends on our side before the push, as pull request
  checks end before a merge.
- The pre-push hook keeps that guarantee: it runs `npm run verify` unless the
  pushed commit's tree already passed `verify` on a clean tree, which a stamp
  records. The commit message check always runs.
- A pull request, when we use them, runs `verify` on GitHub; the merge then only
  bumps.

## 2026-10-25: A user check build inside every milestone

- Every milestone has at least one point where the user launches the app and
  tries it (user request). The lead cuts `main` as a tag `mN-checkK` after
  `verify`, pushes it, and qa smoke-tests the tag and writes the Korean steps
  with sample data (invented or public-domain lyrics only).
- The first one is `m2-check1`, cut at 13:17 on October 25 for the user's check
  between 15:00 and 16:00. From M3 on, the milestone plan names its check
  points.

## 2026-10-25: A hung output is restarted only when it stops answering

- An output that is on and has drawn sends frame-rate reports. After 5 s without
  one (`FRAME_SILENCE_MS`), the main process pings the page's main thread; only
  a page that doesn't answer within 10 s (`ANSWER_LIMIT_MS`) is crashed on
  purpose, so the restart rules of output-11 reload it and count it toward the
  restart limit (lead decision, output-14). A page that answers but draws
  nothing is logged, never restarted, because a wrong restart blanks a live
  output during a service. Spec 08 takes this rule when spec next changes.
