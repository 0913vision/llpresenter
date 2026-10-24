# Brief: devops

- Session name: devops
- Branch: `rewrite/devops` (own worktree)
- Dev server port: 5185; app data folder: `D:\llp-dev\devops`
- Phase: phase 1 (in parallel with the lead's foundation work)

## Goal

Make every team member and the lead check quality with one and the same check.
This project must not stop during a service, so the core of this work is rules
that prevent runtime errors ahead of time and a fast, reliable test environment.
Your job is to make tools enforce the "Quality bar" in `docs/TECH.md`.

## Tasks

- **`npm run verify`:** Runs the type check, lint, the format check
  (`npm run format:check`), unit tests (with a coverage report), and the build
  in order, and fails if any one of them fails. It must behave the same whether
  you run it in Git Bash or in PowerShell on Windows. Prettier is already
  configured by the lead in `.prettierrc.json`.
- **Lint configuration (flat config):** Bans `any`, type assertions that bypass
  checks, and `!`. Bans unhandled promises. Requires exhaustive switches.
  Applies the React hooks rules. Bans unused variables. For each rule, add one
  `// NOTE(0913vision): ...` comment that says why it's there.
- **Comment rules in lint:** Enforces the comment rules in `CLAUDE.md` with a
  lint rule: the only comments allowed are TSDoc comments (`/** ... */`),
  `// NOTE(0913vision): ...`, and `// TODO(0913vision): ...`. Also checks TSDoc
  syntax (for example, with `eslint-plugin-tsdoc`). Consider Google's `gts`
  package if it works with TypeScript 7. Otherwise, write equivalent rules.
- **Vitest:** The initial scaffold already has a minimal configuration
  (`vitest.config.mts`) and five test files. Extend them: coverage reports,
  helpers such as creating and deleting temporary folders and a fake clock, and
  a configuration that runs main process code and renderer code separately. Keep
  the whole unit suite under 1 minute.
- **GitHub Actions configuration (`.github/workflows/ci.yml`):** Runs `npm ci`
  and `npm run verify` on a Windows runner when `rewrite` is pushed and when
  someone runs it by hand (`workflow_dispatch`). Caches Electron downloads. The
  lead pushes after merging, so devops, as a team member, doesn't push.
- **Soak test script skeleton (`scripts/soak/`):** Starts the app in test mode,
  runs it for 60 minutes, collects the measurement records that the app writes
  (per-process memory, output window fps), and judges them (the test fails if
  memory keeps growing for 60 minutes). Propose the record format in the review
  document. The lead builds the recording on the app side in phase 2.
- **Usage notes:** Write short usage notes in `scripts/README.md`.

## Out of scope

- Don't change the app code in `src/`. If code in the initial scaffold breaks a
  new lint rule, don't fix it. List it in the review document and hand it to the
  lead (by the team rule that authors fix their own code, the lead fixes it).
  Until then, exclude only those spots from lint. Do it in the lint
  configuration, with the narrowest scope possible, not with comments in `src/`
  (the comment rules don't allow them). List the exclusions in the review
  document.
- `tsconfig*.json` belongs to the lead. The strict options
  (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and others) are
  already on in the initial scaffold.
- Don't push.

## Owned files

- `.github/`, `scripts/`, the lint configuration files, `vitest.config.mts`, and
  a test helper folder (proposal: `test/`).
- `scripts` and `devDependencies` in `package.json` (allowed as an exception for
  this bundle only; don't touch `dependencies` or other fields).
- `package-lock.json` (only the changes that follow from the above).

## Allowed dependencies (dev only)

- `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `vitest`,
  `@vitest/coverage-v8`, `prettier` (already added by the lead),
  `eslint-plugin-tsdoc`, and `gts` (only if it works with TypeScript 7).
- If you need anything else, write the reason in the review document and ask the
  lead first.
- Pin versions exactly, without `^`.
- Note: this repository uses TypeScript 7 (the version rewritten in Go). First
  check that the type-aware rules of `typescript-eslint` run on TypeScript 7. If
  they don't, write an alternative in the review document (for example, a
  separate TypeScript 6 used only for lint) and get the lead's decision.

## What to read

- `CLAUDE.md`, `docs/WORKFLOW.md`, and `docs/TECH.md` ("Quality bar" and
  "Verification").

## Done when

- In a clean clone, `npm ci` followed by `npm run verify` passes.
- You've confirmed that lint catches violations you added on purpose (for
  example, `any`, `!`, an unhandled promise, a plain `//` comment, and broken
  TSDoc syntax), and you've written the results in the review document. Delete
  the violations before you commit.
- The whole unit suite finishes within 1 minute.

## When you finish

Follow the steps in "When you finish" in `docs/briefs/_template.md`.
