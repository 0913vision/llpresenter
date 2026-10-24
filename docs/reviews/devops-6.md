# Review request: `devops-6`

- Team member: `devops`
- Branch: `chore/devops/gallery-server`
- Base commit (`main`): `86f5926`
- Last commit: see the commit that adds this file
- Related brief: the lead's request (an urgent task before M1-3)

## Shared changes

- `package.json`: a new `gallery` script in `scripts`.

## What changed and why

`LLP_DEV_PORT=<port> npx electron-vite dev --rendererOnly` starts the Electron
app with electron-vite 6.0.0 anyway. qa's run put a real control window on the
user's screen for 30 seconds. `npm run gallery` serves the gallery and the
renderer with plain Vite, which has no way to start Electron.

- `scripts/gallery/vite.config.mts`, based on qa's QA-only config:
  - root `src/renderer`, so `/gallery.html` and the renderer both work,
  - the renderer aliases (`@shared`, `@renderer`),
  - the React plugin,
  - the port from `LLP_DEV_PORT` (5173 without it) with `strictPort`,
  - `host: '127.0.0.1'`, so the Windows firewall never asks,
  - `open: false`, so no browser opens.
- `package.json`: `"gallery": "vite --config scripts/gallery/vite.config.mts"`.
- `scripts/lint/config.mts`: the default-export allowance now covers
  `*.config.*` files in any folder, not only at the root, because Vite reads the
  config from a default export.
- `scripts/README.md`: a section on `npm run gallery`.

## Tests (`scripts/gallery/gallery.test.ts`)

- The script is exactly `vite --config scripts/gallery/vite.config.mts`.
- In a child Node process with a resolve hook that records every import of
  `electron` or `electron-vite`, the test imports the config, starts Vite on a
  free port, fetches `/gallery.html` (200, an HTML page), and expects no
  Electron imports. Electron can't start without its package, so this shows the
  gallery never starts it.
  - I first passed the config file to Vite directly, and an added
    `electron-vite` import went unnoticed: Vite loads a config file where the
    hook can't see it. Importing the config in the child process itself fixed
    that. With an `electron-vite` import added to the config, the test now fails
    and lists `electron-vite`.
- The aliases match `renderer.resolve.alias` in `electron.vite.config.ts`, so
  the two can't drift apart.
- The port comes from `LLP_DEV_PORT`, with 5173 as the default.

By hand: `LLP_DEV_PORT=5185 npm run gallery` printed
`Local: http://127.0.0.1:5185/`, `/gallery.html` answered 200, no `electron.exe`
from this worktree was running, and I stopped both processes afterwards.

## Changed files

- `scripts/gallery/vite.config.mts`, `scripts/gallery/gallery.test.ts`
- `package.json` (`gallery`)
- `scripts/lint/config.mts`
- `scripts/README.md`
- this document

## Checks run

| Command          | Result                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Pass, 123.8 s: typecheck 2.8 s, lint 27.5 s, format:check 36.1 s, test:coverage 55.2 s (367 tests), build 2.2 s |

## For the lead

- The aliases now live in two configs, with a test that keeps them equal.
  `electron.vite.config.ts` belongs to output. If output wants one source, it
  can import `RENDERER_ALIASES` from `scripts/gallery/vite.config.mts`.
- qa's QA-only config can go once this merges.

## Verdicts (recorded by the lead at merge)

- Round 1 (b0c2f80): reviewer (Codex, 0:6; the prompt reached 0:6 instead of
  codex3) Approve with one nit: `scripts/gallery/gallery.test.ts:97` uses
  `toMatchObject`, so an alias added only to the Electron config passes; compare
  the full alias maps with `toEqual`. The nit goes into devops' next branch.
  Lead Approve. Rebased by the lead onto `main` fff7fdd without conflicts.
