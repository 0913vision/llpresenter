# Brief: `<name>`

- Session name: `<name>`
- Branch: `rewrite/<name>` (own worktree)
- Dev server port: `<port>`; app data folder: `D:\llp-dev\<name>`
- Phase: `<phase>`

## Goal

## Tasks

## Out of scope

## Owned files (change only these)

## What to read

- `CLAUDE.md`, `docs/WORKFLOW.md`
- Spec:
- Design system components:

## Contracts to follow

- Use the shared types, commands, and schemas in `src/shared/`. If one needs to
  change, ask the lead.

## Allowed dependencies

## Done when

## How to verify

## Commits

- Write one line only, as `CLAUDE.md` defines:
  `tag(scope): <one English sentence starting with a base-form verb>`.
- Use one of these tags:
  - `break`: breaks existing behavior, a file format, or a shared contract.
  - `feat`: adds a feature or changes behavior.
  - `fix`: fixes a bug.
  - `refactor`: changes structure without changing behavior, including
    performance work.
  - `style`: changes appearance without changing behavior (formatting, names,
    matching UI values to the design system).
  - `docs`: changes documents only.
  - `chore`: changes configuration, dependencies, build, CI, or test tooling.
- The scope is the area you changed, for example `live`, `shell`, `ui`, `store`,
  `prep`, `output`, `design`, or `repo`.
- Don't add a body, a blank line, `Co-Authored-By`, or any other trailer, even
  when a tool adds one by default.
- Run `npm run format` before you commit.

## When you finish

1. Rebase onto the latest `rewrite` and resolve conflicts yourself.
2. Run the checks in "How to verify" and in `CLAUDE.md`. If anything fails,
   don't send the review request.
3. Write `docs/reviews/<name>-<number>.md` and commit it.
4. Send the lead this message with SendMessage, and wait:

   ```text
   Review request: docs/reviews/<name>-<number>.md, branch rewrite/<name>, commit <hash>
   ```

5. If changes are requested, address them and start again from step 1.
