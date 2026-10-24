# Brief: ui

- Session name: ui
- Branch: `rewrite/ui` (own worktree)
- Dev server port: 5186; app data folder: `D:\llp-dev\ui`
- Phase: phase 1, in parallel with trial, devops, and the lead

## Goal

Build the shared design system components as React components in
`src/renderer/src/ui/`, so that every workspace is built from the same parts.
They must match the design system exactly: sizes, colors, states, keyboard
behavior, and writing. The workspaces will use these parts for years, so make
them small, typed, accessible, and well tested.

## Tasks

1. Before anything else, rename your branch: `git branch -m rewrite/ui`. Then
   create `.llp/notes.md` as `CLAUDE.md` describes under "Context and
   compaction".
2. **First batch (review request `ui-1`):** `Button`, `IconButton`,
   `SegmentedControl`, `ToolbarButton`, `TextField`, `Select`, `Checkbox`,
   `Switch`, `Slider`.
3. **Second batch (review request `ui-2`):** `Menu`, `Tooltip`, `Dialog`,
   `AlertDialog`, `Panel`, `ListRow`, `StatusMarks`. Start it right after you
   send `ui-1`. If the lead requests changes to `ui-1`, fix those first.
4. For each component:
   - Read `design/system/project/components/<Name>/README.md` and
     `preview.html`, and the matching `design/system/css/<nn>-<name>.css`. The
     CSS there is the reference for every value. Port it to a CSS module that
     uses only the token variables in `src/renderer/src/styles/tokens.css`.
   - Give it typed props. Controlled inputs take `value` and `onChange`.
     Disabled, focus, hover, pressed, selected, and error states follow the
     README.
   - Give it the right role, accessible name, and keyboard behavior from the
     README (for example, arrow keys in `SegmentedControl` and `Menu`, Escape
     and focus return in `Dialog` and `Menu`, focus trapping in `Dialog`).
   - Write tests with Testing Library in the `renderer` Vitest project: states,
     keyboard behavior, ARIA attributes, and callbacks. Test behavior, not class
     names.
   - Release everything you register: listeners, timers, and portals.
5. Build a development gallery that shows every component in every state:
   `src/renderer/gallery.html` (copy the content security policy from
   `src/renderer/index.html`) and `src/renderer/src/ui/gallery/`. The Vite dev
   server serves it, and the production build leaves it out.
6. Compare each component in the gallery with its design system preview card,
   side by side, at real size:
   - Gallery: `LLP_DEV_PORT=5186 npx electron-vite dev --rendererOnly`, then
     open `http://localhost:5186/gallery.html` in the built-in browser.
   - Cards: `node design/system/card-server.js 5296`, then open
     `http://localhost:5296/card/<Name>`.
   - Record what you compared, and any difference you kept on purpose, in the
     review request.
7. Export the components from `src/renderer/src/ui/index.ts`.

## Out of scope

- The app shell (`MenuBar`, `Toolbar`, `StatusBar`, the column layout) stays
  with the lead. The lead switches the shell to your components after `ui-1` is
  merged.
- Don't change `src/shared/`, `src/renderer/src/shell/`,
  `src/renderer/src/control/`, `src/renderer/src/state/`,
  `src/renderer/src/styles/`, `package.json`, or any configuration file. If a
  token is missing, ask the lead; don't hard-code a value.
- Don't add explanatory text, status chips, or anything else the design system
  doesn't show.

## Owned files (change only these)

- `src/renderer/src/ui/` (except `icons/`, which comes from the design system)
- `src/renderer/gallery.html`
- `docs/reviews/ui-<number>.md`

## What to read

- `CLAUDE.md`, `docs/WORKFLOW.md`
- `design/system/project/README.md` (principles, states and motion, writing,
  glossary), then each component's README
- Spec: `docs/spec/01-concepts.md` for terms. Components carry no product
  behavior.

## Contracts to follow

- Use the shared types in `src/shared/` if a component needs one. If one needs
  to change, ask the lead.
- Reuse `Icon` from `src/renderer/src/ui/Icon.tsx` for every icon.

## Allowed dependencies

- None. Position menus and tooltips yourself (a few dozen lines), as
  `docs/TECH.md` asks.

## Done when

- Every component in both batches matches its README in every state, in the
  gallery and beside its preview card.
- Each component has tests for its states, keyboard behavior, and callbacks, and
  they pass.
- Both review requests are merged into `rewrite` by fast-forward.

## How to verify

- `npm run typecheck`, `npm test`, `npm run format:check`, and `npm run build`.
- Once devops lands `npm run verify`, rebase and use it instead.

## Commits

- Write one line only, as `CLAUDE.md` defines:
  `tag(scope): <one English sentence starting with a base-form verb>`. Use the
  scope `ui`, for example `feat(ui): add the Button component`.
- Run `npm run format` before you commit.

## When you finish a batch

1. Rebase onto the latest `rewrite` and resolve conflicts yourself.
2. Run the checks above. If anything fails, don't send the review request.
3. Write `docs/reviews/ui-<number>.md` from `docs/reviews/_template.md` and
   commit it.
4. Send the lead this message with SendMessage:

   ```text
   Review request: docs/reviews/ui-<number>.md, branch rewrite/ui, commit <hash>
   ```

5. If changes are requested, address them and start again from step 1.
