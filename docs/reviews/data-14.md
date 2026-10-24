# Review request: `data-14`

Review range: `94780dc...fix/data/settings-limits`

- Team member: `data`
- Branch: `fix/data/settings-limits`
- Base commit (`main`): `94780dc`
- Last commit: see the commit that adds this file
- Related brief: qa's observations on the settings schemas (through the lead,
  October 25); `docs/spec/10-shortcuts-and-settings.md`, the 환경설정 tables and
  "Keys that never become shortcuts"; `docs/spec/02-data.md`, "Bible"

What to check:

1.  `src/shared/schema/preferences.ts`: the ranges against spec 10:
    - 복구 사본 3 to 50;
    - 보관 1 to 365;
    - 한 장 최대 줄 수 1 to 12;
    - 미리보기 프레임 수 15, 30, or 60. A value outside its range drops alone on
      read, with a reported field, and falls back to its default. Writing
      refuses it.
2.  `src/shared/schema/shortcuts.ts`: the reserved keys are part of the binding
    schema now, so writing refuses one, and reading still drops one with the
    same field path.
3.  `src/shared/schema/bible.ts`: a translation `file` is a bare file name: no
    folder, no drive, and not `.` or `..`.
4.  `src/main/store/recoveryCopies.ts`: a hard cap of 50 copies per file,
    whatever count a caller passes.

## Shared changes

All in data's paths:

1.  `src/shared/schema/preferences.ts`:
    - exports `PREFERENCE_LIMITS` and `previewFpsChoices`, so the 환경설정 UI
      can use the same ranges;
    - `previewFps` is typed `15 | 30 | 60` now; nothing used it as a number;
    - a new `prune` step.
2.  `src/shared/schema/shortcuts.ts`: the binding schema refuses reserved keys.
3.  `src/shared/schema/bible.ts`: the bare file name rule.

## What changed and why

qa found that the settings schemas accepted values the spec rules out:

| Item                                            | Before                                   | After                                                                       |
| ----------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| `backupCopies`, `backup.keep`, `bible.maxLines` | Any positive integer                     | Spec 10's range; outside it, the field drops alone and its default runs     |
| `previewFps`                                    | Any positive integer                     | 15, 30, or 60                                                               |
| Shortcut writing                                | A reserved key, such as Tab, was written | Refused with the binding's field path; reading already dropped it           |
| `bible.json` `file`                             | Any text, such as `../../x`              | A bare file name in the bible folder                                        |
| Recovery copies per file                        | No upper limit in the code               | At most 50, the top of the spec range, even if a bad count reaches the code |

Why a bad count drops alone instead of failing the file: a whole broken
`preferences.json` runs every setting from a recovery copy or the defaults
(`docs/TECH.md`, "Storage"). One number out of range shouldn't cost the other
settings.

The backup count already has its own cap of 365 in `data-9`
(`feat/data/backups`, in review); once both merge, it can read
`PREFERENCE_LIMITS.backupKeep` instead of its own constant.

Not in this request: spec 10's new layout of `preferences.json` (renames such as
`output.previewFps` and new fields). That needs a schema version 2 with a
migration, and is a task of its own.

## Changed files

- `src/shared/schema/`: `preferences.ts`, `shortcuts.ts`, `bible.ts`, and their
  tests.
- `src/main/store/recoveryCopies.ts` and its test.
- `docs/reviews/data-14.md` (new).

## Checks run

`npm run verify` on the commit before this document (2c65575), on `main`
94780dc: every step passed (78.2 s, steps at once).

| Command or test                    | Result                      |
| ---------------------------------- | --------------------------- |
| `npm run typecheck`                | Passed (6.7 s)              |
| `npm run lint`                     | Passed (51.3 s)             |
| `npm run format:check`             | Passed (28.5 s)             |
| `npm test`                         | Passed as `test:coverage`   |
| `npm run build`                    | Passed (2.9 s)              |
| `npm run verify` (from phase 1 on) | Passed: every step (78.2 s) |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema: this request
      tightens three schemas.
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: nothing new is registered.
- [x] Caches and lists have size caps: the recovery copies get a hard cap.
- [x] An exception in the output path doesn't stop the output: nothing here runs
      in the output path.
- [x] Only what's needed re-renders (control window): no UI.
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not measured.

## Decisions I made (for the lead to confirm)

1.  The lower limit of the recovery copy cap stays 1, not spec 10's 3, so the
    code never deletes more than the count asks; 환경설정 enforces the 3.
2.  The review number is `data-14`, after `data-12` and `data-13`.

## Where to look

- `src/shared/schema/preferences.ts`: `dropValuesOutOfRange`.

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
