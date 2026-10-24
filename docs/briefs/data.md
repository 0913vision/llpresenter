# Brief: data

- Session name: data (the session that reviewed trial-1 continues as data)
- Branch: `feat/data/schemas` (own worktree)
- Dev server port: 5188; app data folder: `D:\llp-dev\data`
- Phase: phase 1, in parallel with devops, ui, and shell

## Goal

Turn the file formats in `docs/spec/02-data.md` into typed schemas that every
part of the app uses to read and write data: parse with validation, keep unknown
fields, and migrate older schema versions. These are shared contracts, so the
lead reviews them closely; a mistake here spreads everywhere.

## Tasks

1. In your worktree, start the new branch from the latest `main`:
   `git switch -c feat/data/schemas main`. Rewrite `.llp/notes.md` for this
   task.
2. **Choose the schema library.** `docs/TECH.md` says "one small schema
   validation library (zod family), decide in phase 1". Compare zod and valibot
   (or another small one) on bundle size, TypeScript 7 type checking, unknown
   field passthrough, error messages, and maintenance, and propose one to the
   lead with SendMessage before you add it. Add it only after the lead approves,
   with an exact pin, and record the reason in your review request.
3. **Schemas and types** in `src/shared/schema/`, one module per file format:
   the song file (`.llsong`), the service file (`.llservice`), templates, and
   the app-wide settings files (screens, looks, stage layouts, macros, quick
   launch, messages, notices, props, timers, labels, preferences, shortcuts,
   bible, `app.json`, and the media list). Use the shared color types in
   `src/shared/colors.ts`. Brand the ids (`SongId`, `ServiceId`, and so on).
4. **Reading and writing:** for each format, a `parse` that returns a result (a
   value, or a typed error that says which file and field failed), never an
   exception, and a `serialize` that writes stable JSON. Keep unknown fields on
   every level, as the spec requires.
5. **Versions:** each format has `format` and `schemaVersion`. Write the
   migration hook (an ordered list of steps from version N to N + 1), and the
   rules for a newer version than the app knows (read-only) and a wrong `format`
   (skip and report), as `docs/spec/02-data.md` describes. Version 1 has no
   steps yet; test the hook with a fake step.
6. **Tests:** valid samples for each format (use hymn 1, 만복의 근원 하나님, for
   sample lyrics), each kind of invalid input, unknown field round trips, and
   migration. Use property-style loops for round trips where it helps.
7. Replace the hand-written guards in `src/shared/guards.ts` and
   `src/shared/commands.ts` with the library only if it makes them simpler; ask
   the lead first, since those are already in use.

## Out of scope

- Reading and writing files on disk (atomic writes, autosave, backups). That is
  the main-process store in phase 2. Your code works on strings and objects.
- UI.

## Owned files (change only these)

- `src/shared/schema/` and its tests
- `docs/reviews/data-<number>.md`
- `package.json` and `package-lock.json` only for the one approved library

## What to read

- `CLAUDE.md`, `docs/WORKFLOW.md`, `docs/TECH.md` (storage, quality bar)
- `docs/spec/02-data.md` (every format, the common rules, versions and
  migration, save rules), `docs/spec/01-concepts.md` (terms)
- `docs/spec/README.md` open questions that touch data (numbers 2, 7, 8, 12, 14,
  15, 26). Follow what the spec does for now and list anything you had to decide
  in your review request.

## Done when

- Every format in `docs/spec/02-data.md` has a schema, a parse that never
  throws, a serialize, and tests, and the migration hook works.
- The review request is merged into `main` by fast-forward.

## How to verify

- `npm run typecheck`, `npm test`, `npm run format:check`, `npm run build`, and
  `npm run verify` once devops lands it.

## Commits

- One line, `tag(scope): <sentence>`, scope `schema`. Run `npm run format`
  first. You may split the work into two review requests (songs and services
  first, settings second) if it gets large.

## When you finish

Rebase onto the latest `main`, run the checks, write `docs/reviews/data-1.md`,
commit it, and send the lead:

```text
Review request: docs/reviews/data-1.md, branch feat/data/schemas, commit <hash>
```
