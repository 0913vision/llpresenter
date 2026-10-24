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
