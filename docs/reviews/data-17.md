# Review request: `data-17`

Review range: `3329f81...fix/data/app-json-owner`

Changed outside data's paths, with output's permission: `src/main/index.ts`
(`openAppConfig` runs first, its file goes to `registerStore`, and a 'save
app.json' shutdown step follows 'save the UI state') and
`src/main/index.wiring.test.ts` (an `./store/appConfigFile` mock, the new order,
and two tests).

- Team member: `data`
- Branch: `fix/data/app-json-owner`
- Base commit (`main`): `3329f81`
- Last commit: see the commit that adds this file
- Related brief: qa's bug M1-12; `docs/decisions.md`, "One owner of `app.json`"
  (2026-10-25); qa's M1 case C19

What to check:

1.  `src/main/store/appConfigFile.ts`: `openAppConfig` reads and checks
    `app.json` once. A broken file, or one it can't read, logs exactly one
    warning whose detail names the file and the field, and is never written. A
    file from a newer version logs one warning and is never written either.
    Writes run in order, half a second after the last change, and keep unknown
    fields.
2.  `UiStateFields` (`read()` and `change(fields)` for `layout`, `previewBig`,
    `macroView`, `macroCollection`, and `mediaStrip`): the interface that shell
    moves `uiState` onto.
3.  `loadStore` (`fileStore.ts`) no longer reads `app.json`; it takes the
    location fields and `lastServiceId` from the opened file, and the app.json
    problem is no longer among the store's problems. `registerStore` no longer
    logs its own app.json warning.
4.  `openAppConfig` never rejects (output's condition for `index.ts`): reading
    returns a result, checking returns a result, and a failure only logs.

## Shared changes

None.

## What changed and why

qa found three warnings for each broken `app.json` case: one from the UI state
store and two from the data store. The lead decided that the data store alone
reads, checks, and writes `app.json`.

| Part                   | Before                                                    | After                                                                                               |
| ---------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Reading                | `uiState` and `loadStore` each read and parsed the file   | `openAppConfig` reads it once at launch; the others use the opened file                             |
| A broken file          | Three warnings: `uiState`'s and two from the data store   | One warning from the data store, naming the file and the field (plus `uiState`'s until shell moves) |
| Writing                | `uiState` wrote the whole file; nothing else wrote it yet | `AppConfigFile` writes in order after a burst, keeping every field, including unknown ones          |
| A newer or broken file | Never written                                             | Never written; changes live in memory                                                               |

Order of the change (decision "Data lands the interface and the single warning
first"): this request lands the file owner, the interface, and the wiring. Until
shell's follow-up moves `uiState` onto `UiStateFields`, `uiState` still parses
the file and logs its own warning, so a broken file shows two warnings for that
short time: `uiState`'s and this one.

`setLastServiceId` is ready for the code that opens a 예배 순서; nothing calls
it yet.

## Changed files

- `src/main/store/appConfigFile.ts` and its test (new).
- `src/main/store/fileStore.ts` and `register.ts` with their tests.
- `src/main/index.ts` and `src/main/index.wiring.test.ts` (output's, with
  permission).
- `docs/reviews/data-17.md` (new).

## Checks run

`npm run verify` on the commit before this document (1119bb4), on `main`
3329f81: every step passed (253.4 s, steps at once).

| Command or test                    | Result                       |
| ---------------------------------- | ---------------------------- |
| `npm run typecheck`                | Passed (37.0 s)              |
| `npm run lint`                     | Passed (91.9 s)              |
| `npm run format:check`             | Passed (137.2 s)             |
| `npm test`                         | Passed as `test:coverage`    |
| `npm run build`                    | Passed (14.2 s)              |
| `npm run verify` (from phase 1 on) | Passed: every step (253.4 s) |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests: C19 (a) to (e) each
      log exactly one warning and leave the file as it was; (g) shows the file
      and never writes it; C20 creates the file on the first change; a UI change
      and a `lastServiceId` change in a row both survive with unknown fields; a
      burst of changes writes once.
- [x] Values from outside the process are validated with a schema: `app.json`
      goes through `parseAppConfig`.
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: the save timer is cleared by
      `dispose`, and the shutdown step flushes.
- [x] Caches and lists have size caps: one file in memory.
- [x] An exception in the output path doesn't stop the output: nothing here runs
      in the output path; `openAppConfig` never rejects.
- [x] Only what's needed re-renders (control window): no UI.
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not measured.

## Decisions I made (for the lead to confirm)

1.  `LoadedStore.appConfigBroken` is gone: nothing read it besides the warning
    that `openAppConfig` now logs, and `AppConfigFile.isBroken` answers it.
2.  The warning for a broken file reads "app.json is broken, so the app keeps it
    as it is and never writes over it", with the file error as the detail
    (`kind`, `file`, `field`, `message`).

## Where to look

- `src/main/store/appConfigFile.ts`.

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
