# Review request: `data-1`

- Team member: `data`
- Branch: `feat/data/schemas`
- Base commit (`main`): `13d88b1`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/data.md`

Shared changes (allowed by the brief and the lead):

- `package.json`, `package-lock.json`: valibot 1.5.0 in `dependencies`.
- `src/shared/result.ts` (new): the `Result` type.
- `src/shared/schema/` (new): the file pipeline, the schemas, and `safeKeys.ts`,
  which keeps keys that valibot drops.

## What changed and why

This is the first of two review requests for the brief. It adds the schema
library, the shared file pipeline, and the schemas of the song file, the service
file, templates, and `app.json`. The lead asked for `app.json` in the first
request because shell needs its `layout` part early. The other app-wide settings
files and the media list follow in `data-2`.

### Schema library (brief task 2)

valibot 1.5.0 is in `dependencies`, pinned exactly, in its own commit. The lead
approved it and recorded it in `docs/TECH.md` and `docs/decisions.md` (5b09a98).
Only `src/shared/schema/` imports it.

I compared the libraries with a spike outside the repository. Each library built
the same `.llsong` schema with loose objects, branded ids, and exact optional
fields. I type-checked the spikes with the repository's TypeScript 7.0.2 and
compiler options, and bundled them with the repository's rolldown 1.2.15
(minify, gzip level 9).

| Library        | Bundle (gzip) | TS 7 check      | Parse per song | Unknown fields                 | Weekly downloads |
| -------------- | ------------- | --------------- | -------------- | ------------------------------ | ---------------- |
| valibot 1.5.0  | 2.7 KB        | Passes, 0.040 s | 4.4 us         | Kept, new object               | 14M              |
| zod/mini 4.6.7 | 8.4 KB        | Passes, 0.039 s | 8.8 us         | Kept, new object               | 222M (zod)       |
| zod 4.6.7      | 24.6 KB       | Passes, 0.013 s | 5.5 us         | Kept, new object               | 222M             |
| arktype 2.2.9  | 45.9 KB       | Passes, 0.077 s | 0.8 us         | Kept, returns the input object | 1.4M             |

- zod/mini prints only "Invalid input" unless its English locale is loaded. The
  8.4 KB includes the locale.
- valibot messages include the received value, for example
  `slides.0.lines.1: Invalid type: Expected string but received 3`.
- valibot and zod have no dependencies. arktype has three. All are MIT.
- valibot was chosen for its size, because it also validates IPC messages in the
  renderer and the output windows, and because `looseObject`, `exactOptional`,
  `brand`, and dot paths cover what the spec needs.

### File pipeline (`fileFormat.ts`, `migration.ts`)

Every format goes through the same two functions:

- `parseFile` reads text in this order: JSON, then the header (`format`, then
  `schemaVersion`), then migration, then the schema. It returns a `Result`,
  never an exception. Success carries the data, the access (`editable` or
  `readOnly`), and the version the file had on disk, so the phase 2 store knows
  when to keep a recovery copy before the first write in the new version.
- Failures are a `FileError` with `kind`, `file`, `field` (a dot path such as
  `slides.0.lines`), and `message`. The kinds follow `docs/spec/02-data.md`:
  - `json`: broken JSON.
  - `format`: another kind of file, or no `format` field.
  - `invalid`: a field breaks the schema.
  - `newer`: a newer schema version whose content doesn't fit this version.
  - `migration`: a migration step threw.
- A newer schema version that still fits the current schema opens as `readOnly`.
- `serializeFile` checks the data against the schema again and refuses any
  version other than the current one. It writes stable JSON: known fields in
  schema order, then unknown fields in their original order, two spaces, LF, and
  a final newline. It returns a `Result` too, so an edit can never write a file
  that the next launch would skip.
- The migration hook is an ordered list of steps; step N converts version N to
  N + 1. The current version is the number of steps plus 1, so it can't drift
  from the list. Every format has an empty list in version 1. The tests use a
  fake step that renames a field.

### Formats in this request

| Module         | File                              | Exports                                                                                                                                       |
| -------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `song.ts`      | `.llsong`                         | `Song`, `Slide`, `Arrangement`, `DEFAULT_ARRANGEMENT_NAME`, `parseSong`, `serializeSong`                                                      |
| `service.ts`   | `.llservice` (services, 틀)       | `Service`, `Template`, `ServiceItem`, `serviceItemKind`, `parseService`, `serializeService`, `parseTemplate`, `serializeTemplate`             |
| `appConfig.ts` | `app.json` in the app data folder | `AppConfig`, `AppLayout`, `SizeClass`, `ColumnLayout`, `parseAppConfig`, `serializeAppConfig`                                                 |
| `ids.ts`       |                                   | Branded ids: `SongId`, `ServiceId`, `TemplateId`, `ServiceItemId`, `MediaId`, `NoticeSetId`, `ScreenId`, `MacroCollectionId`, `TranslationId` |

- Every object in every schema is loose, so unknown fields survive at every
  level, including the Bible passage object and the `app.json` size classes.
- The exported types show only the known fields and are read-only at every level
  (`ReadonlyKnown`). Unknown fields stay on the objects at runtime, so
  `{...song, title}` keeps them.
- A service item's kind is the one kind key it has. `v.lazy` picks the item
  schema by that key, so errors point at the right field. An item with a kind
  key this version doesn't know is kept unchanged and `serviceItemKind` returns
  `unknown`.

## Changed files

- `package.json`, `package-lock.json`: valibot 1.5.0.
- `src/shared/result.ts` (new, allowed by the lead): the `Result` type.
- `src/shared/schema/`: `fileFormat.ts`, `migration.ts`, `primitives.ts`,
  `ids.ts`, `song.ts`, `service.ts`, `appConfig.ts`, `testHelpers.ts`, and a
  test file for each module except `ids.ts`, `primitives.ts`, and
  `testHelpers.ts`, which the format tests cover.
- `docs/reviews/data-1.md` (new).

## Checks run

`npm run verify` on the commit before this document, on `main` 13d88b1: every
step passed.

| Command or test                    | Result                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| `npm run typecheck`                | Passed. Type assertions (`expectTypeOf`) included                     |
| `npm test`                         | Passed: 27 files, 294 tests (115 in the schemas)                      |
| `npm run format:check`             | Passed                                                                |
| `npm run build`                    | Passed                                                                |
| `npm run verify` (from phase 1 on) | Passed: typecheck, lint, format:check, test:coverage, build (129.7 s) |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: none are registered.
- [x] Caches and lists have size caps: no caches or lists are kept.
- [x] An exception in the output path doesn't stop the output: parse and
      serialize never throw (a test feeds 500 random texts).
- [x] Only what's needed re-renders (control window): no UI.
- [x] The clean code rules in `CLAUDE.md` hold: clear names, small functions
      that do one thing, a single responsibility per module and class, no
      repetition, named constants instead of magic values, explicit side
      effects, no silently swallowed errors, and fast, independent, repeatable,
      and readable tests
- [x] Comments follow `CLAUDE.md`: TSDoc only (`/** ... */`),
      `// NOTE(0913vision): ...`, `// TODO(0913vision): ...`, and nothing else
      (no other comments and no commented-out code)
- [x] The code uses the modern language features that `CLAUDE.md` lists (for
      example, `const` and `let`, `async` and `await`, optional chaining and
      `??`, `readonly`, and `satisfies`), except where the Google TypeScript
      style guide decides otherwise
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [x] Measured performance values (when relevant): in the spike, valibot parsed
      a two-장 song in about 4.4 us. The round trips of 200 random songs and 200
      random services run in well under a second.

## Decisions I made (for the lead to confirm)

1. `app.json` uses `format: "llapp"`. The spec gives no value for it.
2. A field that breaks the schema makes the whole file invalid, so the store
   skips that file and reports it, as the spec says for broken files. The
   exception is a service item of an unknown kind, which is kept.
3. Service items: every item needs an `id`, ids are unique within the file, and
   an item with two kind keys is invalid.
4. Songs: a blank title (only spaces) is invalid. 구성 names are not blank,
   unique, and not "기본". A 구성 that points past the last 장 makes the file
   invalid, so the rest of the app can trust the numbers. Empty 구성 and empty
   `lines` (a blank 장) are valid.
5. `macro` on items stays a plain string, not a branded id, because the spec
   falls back to a lookup by name (open question 8).
6. Translation ids are non-blank strings, not UUIDs, because the spec's UUID
   list doesn't include translations.
7. A byte order mark is skipped on read. Files are written without one.
8. Every `app.json` field is optional. Widths accept any non-negative number,
   and thumbnail columns any positive integer. Shell clamps them to the `Layout`
   ranges (left 200 to 400, right 320 to 720, columns 2 to 8). `macroView` is
   `grid` or `list`, from `docs/spec/07-macros.md`.
9. Service names, header texts, and slot titles may be empty. The spec marks
   them required but sets no length.
10. `Result` lives in `src/shared/result.ts`, so the main process and IPC can
    share it. The lead asked for this in the review and allowed this one shared
    file.

Open questions from `docs/spec/README.md` that touch this request:

- 7: 구성 stay on the song, and items pick one by name, as in version 61.
- 8: `macro` holds an id or a name.
- 15: `slot: "slides"` is accepted, and no item kind fills it yet.
- 26: thumbnail columns are clamped to 2 to 8 by the UI, not the schema.
- 2, 12, and 14 concern files in `data-2`.

## Shared contract change requests

- Shell can import `SizeClass` and `ColumnLayout` from
  `src/shared/schema/appConfig.ts` instead of defining its own.
- If `app.json` fails validation, the store would fall back to the default data
  folder and the operator's songs would seem to vanish. Please decide in phase 2
  whether the store should then read only the location fields, or keep the
  generic rule.
- valibot declares TypeScript as an optional peer dependency. npm therefore
  marks `typescript` and its platform packages `devOptional` instead of `dev` in
  `package-lock.json`, and adds `hasInstallScript` for our `postinstall`.
  Nothing changes now. The installer (phase 5) should check that it doesn't ship
  TypeScript.
- Brief task 7 (replacing the guards in `guards.ts` and `commands.ts` with
  valibot) is not in this request. I will ask before I start it.

## Where to look

- `src/shared/schema/fileFormat.ts`: the order of checks in `load`, and the
  version rules in `checkWritableVersion`.
- `src/shared/schema/service.ts`: `itemSchemaFor`, which picks an item schema by
  its kind key.
- The decisions above, especially 2 to 4, which decide when a file is skipped.

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

Replies to the lead:

1. Move `Result` to `src/shared/result.ts`: done in "move Result to src/shared".
   The schema modules import it from there.
2. Write the byte order mark as an escape: done in "write the byte order mark as
   an escape", in `fileFormat.ts` and its test. The editor tool had turned the
   escape into the character itself.
3. Rebase onto `main` with devops-1 (1298408, then 8b623b3): `package-lock.json`
   conflicted. I took `main`'s lock file and ran `npm install`, which added
   valibot back with the same `devOptional` change as before. Nothing else
   conflicted.
4. Lint (new with devops-1) reported three problems, fixed in "fix what the
   type-aware lint rules report": `ReadonlyKnown` now writes
   `ReadonlyArray<infer Item>`, and two tests read `JSON.parse` output as
   `unknown` instead of `any`. No lint exclusions.
5. Coverage showed two untested branches, now tested in "test a non-object
   service item": a service item that isn't an object, and a schema without
   `schemaVersion`.

Round 2, replies to the reviewer's findings:

1. Keys named `__proto__`, `prototype`, and `constructor`: fixed. valibot drops
   them on purpose (prototype pollution). `safeKeys.ts` now escapes them before
   every schema check, with a one-to-one prefix, and gives them their own names
   back afterwards as own data properties, in their original order. Nothing is
   ever assigned through `__proto__`. The tests cover the root, nested known
   objects, nested unknown values, a song's slides and 구성, the error path, and
   that the prototype stays `Object.prototype`.
2. Arrays as objects: fixed. Every object in the schemas is now `jsonObject`,
   which rejects an array before `v.looseObject` sees it. Tests cover
   `layout: []`, `layout.normal: []`, a slide that is an array, and a nested
   object in the file pipeline.
3. Unknown field inside the Bible passage: the test now adds one inside `bible`
   and checks it after writing and reading back.

data-2 and data-3 have the same gap: their objects and records also use
`v.looseObject` and `v.record` directly. They switch to `jsonObject` (and a
record that rejects arrays) when I rebase them onto this branch. The key
escaping already covers them, because it runs in the shared pipeline.

Round 3, replies to the reviewer's findings:

1. Deep or cyclic data: fixed. `escapeKeys` and `restoreKeys` no longer recurse.
   `escapeKeys` walks with its own task list and a depth limit of 64 (a NOTE
   gives the reason), and returns an error result past it. Cyclic data always
   passes the limit, so it gives the same error. The pipeline turns that result
   into a `FileError`, so `parseFile` and `serializeFile` still never throw. New
   tests: unknown JSON nested 1,000 and 200,000 levels deep in a file, a cyclic
   value passed to `serializeFile`, the exact limit, and a cyclic value passed
   to `escapeKeys`.
2. Pollution test: it now checks that `Object.prototype` has no `polluted`
   property and that a fresh object doesn't inherit one.
