# Review request: `data-3`

- Team member: `data`
- Branch: `feat/data/show-tools`
- Base commit (`main`): set when `data-2` merges and this branch is rebased
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/data.md`

## What changed and why

The last of three review requests for the brief. It adds the schemas of the
settings files that the 진행 도구 (show tools) and 환경설정 use. With it, every
format in `docs/spec/02-data.md` has a schema, a `parse` that never throws, a
`serialize`, and tests.

| Module           | File               | `format`                 | Exports                                                                                                               |
| ---------------- | ------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `macros.ts`      | `macros.json`      | `llsettings.macros`      | `MacrosFile`, `Macro`, `MacroCollection`, `MacroAction`, `KnownMacroAction`, `macroActionKinds`, `isKnownMacroAction` |
| `quick.ts`       | `quick.json`       | `llsettings.quick`       | `QuickFile`, `QuickItem`, `KnownQuickItem`, `quickItemKinds`, `isKnownQuickItem`                                      |
| `messages.ts`    | `messages.json`    | `llsettings.messages`    | `MessagesFile`, `MessageTemplate`                                                                                     |
| `notices.ts`     | `notices.json`     | `llsettings.notices`     | `NoticesFile`, `NoticeSet`                                                                                            |
| `props.ts`       | `props.json`       | `llsettings.props`       | `PropsFile`, `Prop`                                                                                                   |
| `timers.ts`      | `timers.json`      | `llsettings.timers`      | `TimersFile`, `Timer`                                                                                                 |
| `preferences.ts` | `preferences.json` | `llsettings.preferences` | `PreferencesFile`, `Preferences`, `defaultPreferences`, `withPreferenceDefaults`                                      |

Each module also exports its `parse` and `serialize` functions, for example
`parseMacros` and `serializeMacros`.

Shared changes:

- `kinds.ts`: `kindsWithUnknown` picks the schema of an object by its `kind`
  value, so issues point at the right field. An object of a kind this version
  doesn't know is kept unchanged, as long as it has the fields every kind
  shares. 매크로 actions and 퀵 실행 items use it. Each module exports a type
  guard (`isKnownMacroAction`, `isKnownQuickItem`) so code can skip unknown
  kinds and then switch over the known ones exhaustively.
- `biblePassage.ts`: the Bible passage object moved out of `service.ts`, because
  퀵 실행 items use it too.
- `textStyle.ts`: `lyricTextEntries` (a lyric style without its id and name),
  shared by `looks.ts` and 소품 text.
- `ids.ts`: `MacroId`, `PropId`, `TimerId`, `MessageTemplateId`, and
  `QuickItemId`.

## Changed files

- `src/shared/schema/`: `macros.ts`, `quick.ts`, `messages.ts`, `notices.ts`,
  `props.ts`, `timers.ts`, `preferences.ts`, `kinds.ts`, `biblePassage.ts`, a
  test file for each format, and changes to `service.ts`, `looks.ts`,
  `textStyle.ts`, and `ids.ts`.
- `docs/reviews/data-3.md` (new).

## Checks run

On the commit before this document, on top of `data-2`.

| Command or test                    | Result                                           |
| ---------------------------------- | ------------------------------------------------ |
| `npm run typecheck`                | Passed. Type assertions included                 |
| `npm test`                         | Passed: 28 files, 254 tests (217 in the schemas) |
| `npm run format:check`             | Passed                                           |
| `npm run build`                    | Passed                                           |
| `npm run verify` (from phase 1 on) | Run after the rebase onto `main` with devops-1   |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes: run after the rebase.
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: none are registered.
- [x] Caches and lists have size caps: the schemas keep no lists.
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

1. 매크로 actions are loose objects keyed by `kind`, and an unknown kind is
   kept. Layer names come from `layerKinds` in `src/shared/live.ts`, ids are
   branded UUIDs, `schedule` is reserved, and `runOnStartup` is optional. There
   is no `clearProp`: `{kind: "prop", mode: "off"}` takes one 소품 off.
2. 퀵 실행 items validate `ref` by kind, and an unknown kind is kept.
3. Every `preferences.json` field is optional, and an absent field means its
   default from 02. Enums accept only the values the spec lists.
   `defaultPreferences` and `withPreferenceDefaults` keep the defaults in one
   place.
4. Other first-launch defaults belong to the phase 2 store.

The action fields, as approved:

| `kind`          | Fields                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| `look`          | `look`                                                                                                     |
| `stageLayout`   | `screen`, `layout`                                                                                         |
| `clearAll`      |                                                                                                            |
| `clearLayer`    | `layer`: one of `layerKinds`                                                                               |
| `media`         | `media`                                                                                                    |
| `prop`          | `prop`, `mode`: `on`, `off`, or `toggle`                                                                   |
| `message`       | `template`, `values` (blank name to text), `targets` (screen ids or `all`), `duration` (seconds or `null`) |
| `notice`        | `notice`                                                                                                   |
| `audio`         | `operation`: `play` (with `media`), `fadeOut`, or `stop`                                                   |
| `audioPlaylist` | `playlist`                                                                                                 |
| `timer`         | `timer`, `operation`: `start`, `pause`, or `reset`                                                         |
| `macro`         | `macro`                                                                                                    |

## Decisions I made (for the lead to confirm)

1. An audio action has `media` only when `operation` is `play`, and needs it
   then.
2. A 매크로's `icon` is a non-blank key that isn't checked against the icon
   list, and its `color` is a palette color (no `none`, as the `MacroTile`
   README says). A collection's `macroIds` aren't checked against the 매크로,
   like every other reference to another id.
3. A 메시지 template's `targets` and `duration` are optional, because 02 calls
   them proposed defaults for sending. The blanks in `values` aren't checked
   against the template text.
4. A 공지 set's `interval` is more than 0 seconds, and its `targets` is a list
   of screens (02 gives no `all` for 공지).
5. A 소품's content is an image or text, and another content kind makes the file
   invalid, because 02 gives no registry for it. Text uses every lyric style
   field.
6. A 타이머's fields depend on its kind: `time` (`HH:mm`) for `countdownTo` and
   `elapsedFrom`, `duration` (more than 0 seconds) for `countdown`, and neither
   for `clock`.
7. `preferences.json` `onDisconnect` accepts `window` and `off`. 02 lists only
   `window` in the 환경설정 table, but it lists both for the same setting on a
   screen, and 환경설정 holds the defaults for new screens (open question 14).
8. `defaultPreferences` is a complete file with the header, so the store can
   write it on first launch. `withPreferenceDefaults` keeps the stored file's
   unknown fields, such as `import.pptx`.

## Shared contract change requests

- None. Every change stays in `src/shared/schema/`.

## Where to look

- `src/shared/schema/kinds.ts` and the guards that use it.
- `src/shared/schema/preferences.ts`: `withPreferenceDefaults`, which merges
  each group separately.

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
