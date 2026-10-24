# Review request: `data-2`

- Team member: `data`
- Branch: `feat/data/settings`, stacked on `data-1` (`feat/data/schemas`)
- Base commit (`main`): `fc0cbc9`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/data.md`

Shared changes (all in `src/shared/schema/`, which data owns):

- New: `screens.ts`, `looks.ts`, `stageLayouts.ts`, `labels.ts`, `shortcuts.ts`,
  `bible.ts`, `mediaList.ts`, `textStyle.ts`, and their tests.
- Changed: `fileFormat.ts` (a `prune` hook and `LoadedFile.dropped`, round 2),
  `primitives.ts`, `ids.ts`, `service.ts`, and `testHelpers.ts`, as described
  below.

## What changed and why

The second of three review requests for the brief (the lead approved the split
into `data-2` and `data-3`). It adds the schemas of the settings files that
describe the screens and their look, plus the media list. It builds on the file
pipeline from `data-1` and follows the same rules: a `parse` that never throws,
a `serialize` that writes stable JSON, loose objects at every level, branded
ids, and an empty migration list in version 1.

| Module            | File                 | `format`               | Exports                                                                                  |
| ----------------- | -------------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| `screens.ts`      | `screens.json`       | `llsettings.screens`   | `ScreensFile`, `Screen`, parse, serialize                                                |
| `looks.ts`        | `looks.json`         | `llsettings.looks`     | `LooksFile`, `Look`, `ScreenLook`, `LyricStyle`, parse, serialize                        |
| `stageLayouts.ts` | `stage-layouts.json` | `llsettings.stage`     | `StageLayoutsFile`, `StageLayout`, `StageElement`, `stageElementKinds`, parse, serialize |
| `labels.ts`       | `labels.json`        | `llsettings.labels`    | `LabelsFile`, `Label`, parse, serialize                                                  |
| `shortcuts.ts`    | `shortcuts.json`     | `llsettings.shortcuts` | `ShortcutsFile`, parse, serialize                                                        |
| `bible.ts`        | `bible.json`         | `llsettings.bible`     | `BibleFile`, `Translation`, `RecentPassage`, parse, serialize                            |
| `mediaList.ts`    | `media.json`         | `llmedia`              | `MediaList`, `MediaItem`, `MediaPlaylist`, `AudioPlaylist`, parse, serialize             |

Each module's parse and serialize functions are named after it, for example
`parseScreens` and `serializeScreens`.

Changes to the `data-1` modules:

- `primitives.ts` gains `jsonRecord`, a record that rejects arrays like
  `jsonObject`. Every object and record in the settings schemas uses
  `jsonObject` or `jsonRecord`, the fix for the array gap that codex2 found in
  `data-1`. Only the two options inside the Look background's `v.variant` stay
  `v.looseObject`, because `v.variant` needs plain object schemas; an array
  fails there anyway, because it has no `kind`.
- `primitives.ts` also gains `listWithUniqueIds` (an array whose items have
  unique ids, with the issue on the repeated item), and the number, color, and
  size primitives the settings need. `service.ts` now uses `listWithUniqueIds`
  for its items instead of its own check.
- `ids.ts` gains `LookId`, `LyricStyleId`, `StageLayoutId`, `MediaPlaylistId`,
  `AudioPlaylistId` (UUIDs), and `StageElementId` (a non-blank name, because the
  spec doesn't list stage elements among the UUID ids).
- `textStyle.ts` holds the text fields that lyric styles and stage layout text
  share (`data-3` reuses them for 소품 text).
- `ReadonlyKnown` now keeps the index signature of records, whose values have a
  type (the Look's screens, the shortcut bindings). It still drops the `unknown`
  index signature of loose objects. The type tests of `data-1` still pass.
- `testHelpers.ts` gains `expectRoundTrip` and `expectInvalidField`, so each
  format's test reads as samples and a table of invalid inputs.

## Changed files

- `src/shared/schema/`: `screens.ts`, `looks.ts`, `stageLayouts.ts`,
  `labels.ts`, `shortcuts.ts`, `bible.ts`, `mediaList.ts`, `textStyle.ts`, a
  test file for each format, and changes to `fileFormat.ts`, `primitives.ts`,
  `ids.ts`, `service.ts`, and `testHelpers.ts`.
- `docs/reviews/data-2.md` (new).

## Checks run

`npm run verify` on the commit before this document, on `main` fc0cbc9 with
`data-1` below it: every step passed.

| Command or test                    | Result                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| `npm run typecheck`                | Passed. Type assertions included                                      |
| `npm test`                         | Passed: 54 files, 579 tests (216 in the schemas)                      |
| `npm run format:check`             | Passed                                                                |
| `npm run build`                    | Passed                                                                |
| `npm run verify` (from phase 1 on) | Passed: typecheck, lint, format:check, test:coverage, build (119.1 s) |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: none are registered.
- [x] Caches and lists have size caps: the schemas keep no lists. The recent
      Bible passages are capped by the code that adds them (decision 6).
- [x] An exception in the output path doesn't stop the output: parse and
      serialize never throw.
- [x] Only what's needed re-renders (control window): no UI.
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not relevant.

## Decisions confirmed by the lead

- The split into `data-2` (this request) and `data-3` (macros, 퀵 실행, 메시지,
  공지, 소품, 타이머, preferences).
- First-launch defaults of these files belong to the phase 2 store, not to the
  schemas.

## Decisions I made (for the lead to confirm)

1. Required fields are the ones that identify a thing or define what it is (a
   screen's `id`, `name`, `kind`, and `method`; every field of a lyric style;
   the top-level lists of each file). Settings that have a default elsewhere are
   optional, and an absent value means that default: a screen's `onDisconnect`,
   `alwaysOnTop`, and `preventSleep` (the 환경설정 values), edge margin and
   offset (none), preview background (green), capture resolution (1920 x 1080),
   and a media item's `props`. A missing optional field then never makes the app
   skip `screens.json` during a service.
2. A layer that a screen Look doesn't list is hidden, so audience screens don't
   need `clock` or `stageMessage`.
3. Ids are unique within each list. References to other ids (`current` Look, a
   screen's lyric style or stage layout, playlist items) are not checked,
   because many point into other files and the code that uses them must handle a
   missing target anyway. Song 구성 in `data-1` are different: their numbers are
   positions in the same file.
4. A media item's `kind` accepts only `video`, `image`, and `audio`. A later
   kind such as `input` comes with a new schema version, so older apps open that
   file read-only.
5. Colors are `#RRGGBB` in either case. Font weights are integers from 1
   to 1000. Opacity is from 0 to 1. Percentages (edge margin, lyric margin,
   volume) are from 0 to 100.
6. Recent Bible passages have no length limit in the schema. The spec's 10 is a
   cap for the code that adds them, so an 11th entry never makes the app skip
   the file.
7. Shortcut bindings keep command ids the app doesn't know, and a combination
   needs at least one key. Command ids and key names aren't checked against a
   list.
8. A stage element's text uses the lyric style's alignment values (`left`,
   `center`), because the spec gives none for stage text.
9. An 이름표 jump key is a non-blank string or `null`. Two 이름표 may share a
   key; 06 shows that as a conflict in the UI.

## Shared contract change requests

- None. Every change stays in `src/shared/schema/`.

## Where to look

- `src/shared/schema/fileFormat.ts`: the `ReadonlyKnown` change for records.
- `src/shared/schema/screens.ts` and decision 1, which decides what can be
  missing from `screens.json`.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (fe75ec8): reviewer (Codex, codex2) Request changes: shortcuts in the
  old display-name format, unchecked jump keys, one bad binding rejecting the
  whole file, unchecked media ranges, and plain numbers for units.
- Round 2 (4256352, rebased as 794c0fd with no change): reviewer (Codex, codex2)
  Approve with two nits: TSDoc on the private `jumpKeySchema`, and a test that
  `serializeLabels` rejects an invalid key. The nits go into data's next branch.
  Lead Approve; the lead accepts that the schema doesn't refuse reserved keys
  (the key field does, and data-3's loader drops them). Merged onto `main`
  430ce9a without conflicts.

## Team member's reply

1.

Round 2, replies to the reviewer's findings (built on
`docs/spec/10-shortcuts-and-settings.md`):

1. Shortcuts: a binding is now `{code, mods}`. `code` is a `KeyboardEvent` code
   from a fixed list of code families. The list leaves out modifier keys and the
   input method keys, which have an empty code; a NOTE says so. `mods` holds
   `ctrl`, `alt`, and `shift`, each at most once and in that order. Bare letters
   and digits (numpad digits too) need a modifier, because spec 10 gives them to
   the 이름표 jump keys. Unknown fields in a binding are kept. The old
   display-name tests are replaced.
2. Label jump keys: a key is `Key[A-Z]`, `Digit[0-9]`, or `null`. Tests cover
   `KeyC`, `Digit1`, and invalid keys (`C`, `1`, `F5`, `Numpad1`, `keyc`, a
   number, and an empty string).
3. One bad binding: `FileFormat` has an optional `prune` step that runs before
   the schema. It drops the parts that may fail alone and reports each one in
   `LoadedFile.dropped` (`field` and `message`), for the caller to log.
   - A command whose keys break the schema is dropped, so it falls back to its
     default. A blank command id is dropped the same way.
   - A label whose jump key is invalid or missing keeps its other fields and
     gets `key: null`.
   - Tests mix valid and invalid bindings and labels.
   - Writing stays strict, so the app never writes a binding it would drop on
     the next read.
4. Media ranges: `in` (default 0) must come before `out`, `in` must come before
   the end of the media, and `out` must not pass it, when the duration is known.
   Tests cover a reversed range, an empty range, an end past the duration, a
   start at the duration, an end exactly at the duration, and an unknown
   duration.
5. Units: `Seconds`, `Percent`, and `Pixels` are named types, made with
   valibot's `flavor`. A plain number becomes one, but a value of one unit
   doesn't pass as another. They're used for durations and ranges, edge margins,
   lyric margins, volume, screen and stage positions and sizes, text sizes, and
   media sizes. Type tests check that the units stay apart.

Not changed here: the `app.json` column widths (`data-1`) and `LayoutChange`
(`data-5`) are still plain numbers. I'd switch them to `Pixels` in a later
branch, so the requests under review don't move.

New decision for the lead to confirm: the schema doesn't refuse keys that spec
10 reserves (Tab, Esc alone, Enter alone, and so on). The key field refuses them
when the operator records a key; the stored file only has to name real keys.
