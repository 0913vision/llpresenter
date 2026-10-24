# Review request: `data-8`

Review range: `12c77a9...feat/data/show-service`

- Team member: `data`
- Branch: `feat/data/show-service`, stacked on `data-7` (`feat/data/file-store`,
  12c77a9)
- Base commit (`main`): `814781b`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/data.md`; M2 in `docs/MILESTONES.md`,
  "Main-process file store"; `docs/TECH.md`, "Storage"; `docs/spec/02-data.md`,
  "App-wide settings" and "Save rules"

What to check:

1.  `src/main/store/settingsFile.ts` against the rule in `docs/TECH.md`,
    "Storage": a broken settings file runs from its newest readable recovery
    copy, or else the defaults, and is reported; the file itself is never
    touched.
2.  `src/main/store/library.ts` and `fileStore.ts`: a broken song or 예배 순서
    file is skipped and reported, and the rest load; a broken `app.json` only
    gives its valid location fields.
3.  `src/main/store/showService.ts`: the rows and tiles against shell's shape in
    "How 진행 gets its rows" below, and the stable row ids.
4.  `src/shared/schema/service.ts`: the declared return type of `itemSchemaFor`,
    and the type tests that guard `ServiceItemOf`.
5.  Every read returns a result and never throws; every test uses a temporary
    folder.

## Shared changes

Each of these is in `src/shared/`, which data owns:

1.  `src/shared/schema/showService.ts` (new): the `ShowService` contract that
    진행 shows, in the shape shell asked for. `parseShowService` checks a
    `service:get` reply or a `service:changed` push and accepts `null`. The
    channels themselves come in `data-11`.
2.  `src/shared/schema/service.ts`:
    - Adds `ServiceItemOf<K>` and `isItemOfKind(item, kind)`, so code can read
      an item's fields with their types.
    - Fixes a type bug: `itemSchemaFor` now declares its return type. Before,
      TypeScript folded the item schemas into the unknown item schema, so
      `ServiceItem` lost the fields of each kind. Type tests guard it.
3.  `src/shared/schema/fileFormat.ts`: a new `FileErrorKind`, `read`, for a file
    that couldn't be read from disk. No code switches on the kind.

## What changed and why

The second of three requests for the M2 file store. This one is the read path
and the `ShowService` builder. The channel and the wiring into the main process
follow in `data-11`, and the backups in `data-9`. Nothing calls these modules
yet.

| Module            | What it does                                                                                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `readFiles.ts`    | `readTextFile`, `loadFile`, and `listFolder`: a missing file or folder is `null` or empty, and every other failure is a `read` problem. They never throw. `library.ts` and `fileStore.ts` used to have their own copies of these. |
| `library.ts`      | `loadFolder`: every file with the extension through its schema. A broken file is skipped and reported, and so is a second file with an id that another file already has.                                                          |
| `settingsFile.ts` | `settingsLocation` and `readSettingsFile`: the lead's rule for a broken app-wide settings file (below).                                                                                                                           |
| `fileStore.ts`    | `loadStore`: `app.json`, the songs, the 예배 순서, and the 이름표 at launch, with every problem. `chooseOpenService` picks the 예배 순서 진행 opens.                                                                              |
| `showService.ts`  | `buildShowService`: a row per item with the item's id, the tiles of each song item in its 구성 order with 이름표 colors, and the jump keys.                                                                                       |
| `defaults.ts`     | `DEFAULT_LABELS`: the spec's 이름표 list, with no jump keys.                                                                                                                                                                      |

The lead's rules for broken files (`docs/TECH.md`, "Storage"), as built:

- A broken song or 예배 순서 file is skipped and reported, and nothing writes to
  it. The rest of the folder loads.
- A broken app-wide settings file runs that area from its newest readable
  recovery copy in `.복구 사본/settings/<area>/`, or else from the defaults. The
  problem's message says which ran. The broken file isn't touched. Only
  `labels.json` is read at this stage; every other settings area goes through
  the same `readSettingsFile`.
- A broken `app.json`: only its valid location fields are used, `loadStore` sets
  `appConfigBroken`, and nothing here writes to it.

Not in this request: copying a broken settings file aside before the next write.
Nothing writes settings yet. That belongs to the first request that adds a
settings write.

How 진행 gets its rows (shell's shape):

- A song item shows the song's title. A song that isn't in the library shows an
  empty title and `missing-song`, and has no tiles.
- A Bible item shows its reference, such as `요한복음 3:16-18`.
- A header and an empty slot show their own titles.
- A media or 공지 item shows an empty title for now, because the media list and
  the 공지 sets aren't read yet.
- An item of a kind this version doesn't know shows `unknown-kind`.
- A song item's tiles follow its 구성. A 장 that repeats gets a tile each time.
  An empty 구성, or one the song doesn't have, falls back to the file order.

## Changed files

- `src/shared/schema/`: `showService.ts` and its test (new), `service.ts` and
  its test, `fileFormat.ts`.
- `src/main/store/`: `readFiles.ts`, `library.ts`, `settingsFile.ts`,
  `fileStore.ts`, `showService.ts`, `defaults.ts`, and `testFiles.ts` (the test
  fixtures), each with a test file except the last two. `locations.ts` now also
  returns the whole `app.json` when it passes validation.
- `docs/reviews/data-8.md` (new).

## Checks run

`npm run verify` on the commit before this document (9d44b6d), on `main` 814781b
with `data-7` below it: every step passed. The one skipped test belongs to
another member's suite. Coverage of `src/main/store/`: 98.3% of lines, 92.9% of
branches.

| Command or test                    | Result                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `npm run typecheck`                | Passed                                                                 |
| `npm test`                         | Passed: 114 files, 1123 tests and 1 skipped (105 in the changed files) |
| `npm run format:check`             | Passed                                                                 |
| `npm run build`                    | Passed                                                                 |
| `npm run verify` (from phase 1 on) | Passed: typecheck, lint, format:check, test:coverage, build (241.5 s)  |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema: every file
      goes through its parser, and `ShowService` has `parseShowService` for the
      preload.
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: none are registered.
- [x] Caches and lists have size caps: nothing is cached. The loaded library is
      as large as the folder.
- [x] An exception in the output path doesn't stop the output: nothing here runs
      in the output path, and every function returns a result.
- [x] Only what's needed re-renders (control window): no UI.
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not measured. Launch reads
      each file once, off the output path.

## Decisions I made (for the lead to confirm)

1.  A missing settings file runs with the defaults and isn't reported, as on the
    first launch.
2.  A broken recovery copy is passed over without a problem of its own. The
    problem names the copy that ran, or says the defaults ran. A copies folder
    that can't be read is reported as a second problem.
3.  Settings copies use the kind `settings` and the file's name without `.json`
    as the id, such as `.복구 사본/settings/labels/`. The settings write path
    must use the same `RecoveryTarget`; `settingsLocation` holds both paths.
4.  When two files share an id, the first by file name loads and the second is
    reported.
5.  A file deleted between listing the folder and reading it is left out without
    a problem.
6.  진행 opens the last opened 예배 순서 when it loaded, otherwise the one with
    the latest date.
7.  When two 이름표 share a jump key, the first in the list keeps it.

## Where to look

- `src/main/store/settingsFile.ts`: the recovery copy fallback.
- `src/shared/schema/service.ts`: the declared return type and its NOTE.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1.
