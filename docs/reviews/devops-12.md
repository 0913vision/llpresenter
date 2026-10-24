# Review request: `devops-12`

- Team member: `devops`
- Branch: `chore/devops/node-tests-in-renderer`
- Review range: `c4bbd3a...chore/devops/node-tests-in-renderer`
- Related brief: ui's request for ui-5 round 2. Codex asked for a test that
  reads the real `@font-face` URL in `design/system/project/tokens.css` and
  compares the font's bytes with the one in `node_modules/pretendard`, which
  needs `node:fs` and `node:crypto`.

## What to check

1.  `vitest.config.mts`: a file named `src/renderer/**/*.node.test.ts` runs in
    the node project only, and the renderer project keeps Vitest's default
    excludes (`node_modules`, `.git`).
2.  `tsconfig.node.json` and `tsconfig.web.json`: such a file typechecks with
    Node types, once, and the renderer program gains no Node types.
3.  `test/vitest-projects.test.ts`: the tests fail if any of the four places
    loses the pattern.

## What changed and why

The renderer project can't host that test. Vitest replaces every CSS import with
an empty string there, even with `?raw`, and `tsconfig.web.json` has only
`vite/client` types, so `node:fs` doesn't typecheck. Adding
`/// <reference types="node" />` would give the whole renderer program Node
types, which would hide a renderer file that uses Node by mistake.

- One pattern, `RENDERER_NODE_TESTS` (`src/renderer/**/*.node.test.ts`),
  exported from `vitest.config.mts`, is in the node project's `include` and the
  renderer project's `exclude`. Setting `exclude` replaces Vitest's defaults, so
  the list starts with `configDefaults.exclude`.
- `tsconfig.node.json` includes the pattern and `tsconfig.web.json` excludes it.
- Lint needs no change: typescript-eslint's project service finds the file in
  `tsconfig.node.json`, and the renderer rules (React hooks) still apply.

The pattern covers any folder under the renderer, not only `styles/`, so a later
test of the same kind needs no config change. Such a test can't import
`@renderer/...`, because `tsconfig.node.json` maps only `@shared`; it reads
files instead.

## Tests

`test/vitest-projects.test.ts` reads the config and both tsconfig files:

- `src/renderer/src/styles/assets.node.test.ts` runs in the node project and not
  in the renderer project (`path.matchesGlob` on each project's `include` and
  `exclude`).
- `src/renderer/src/styles/assets.test.ts` still runs in the renderer project
  and not in the node project.
- `tsconfig.node.json` includes the pattern and `tsconfig.web.json` excludes it.

## Changed files

- `vitest.config.mts`
- `tsconfig.node.json`, `tsconfig.web.json`
- `test/vitest-projects.test.ts`
- this document

## Checks run

| Command          | Result                                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Pass at 100% CPU, 391.5 s: typecheck 7.7 s, lint 55.7 s, format:check 145.6 s, test:coverage 178.8 s (123 files, 1353 passed and 1 skipped, no timeouts), build 3.6 s |

## Verdicts (recorded by the lead at merge)

- Round 1 (621ca2a): reviewer (Codex, codex5) Approve, no findings. Lead
  Approve; renderer `*.node.test.ts` files now run in the node project, which
  ui-5 needs. Rebased by the lead onto local `main` without conflicts.
