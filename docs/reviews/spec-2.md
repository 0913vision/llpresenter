# Review request: `spec-2`

- Team member: `spec`
- Branch: `docs/spec/boards-list`. It was stacked on spec-1; after spec-1
  merged, it was moved onto `main` with only its own commits.
- Base commit (`main`): `63d0dbc`
- Last commit: see the commit that adds this file
- Shared files changed: none
- Related brief: `docs/briefs/spec.md`, and the lead's requests of October 25

## What changed and why

This change adds two sections to `docs/spec/10-shortcuts-and-settings.md`, under
"Follow-up work". It changes no decided spec row, code, configuration, or
dependency.

1. **Boards this proposal needs.** 19 rows: the `Prefs` page list and its eight
   pages, the page reset, `Shortcuts` and its reset dialog, the `Looks` lyric
   style and a 메시지 style, the `StageEditor` clock format, `Screens`, the quit
   and empty data folder dialogs, and the 타이머 editor later. Each row names
   the design system components it uses and the open question it depends on. The
   shortcut rows depend on nothing now (decided); the settings rows name their
   open question (10 to 18).
2. **Design system note: number field steps.** For the ui member (M3-U1 in
   `docs/plans/m3-breakdown.md`). The `TextField` README steps number fields by
   1 and 10 only. That breaks every fractional field: the seconds fields in this
   proposal, and two fields that already exist, 줄 간격 (06) and 속도 (05). The
   note proposes `step` and `largeStep`, decimals from the step, typing rules,
   counting in whole steps to avoid float drift, units, a table of steps and
   ranges per field, and an API sketch.

The "Follow-up work" bullets now point to these sections. Moving the branch onto
`main` needed two conflict resolutions in "Follow-up work", where spec-1 round 2
had also changed the design system bullet; the merged bullet keeps both sets of
items. The open question numbers in the board list follow the numbering the user
decided on in spec-1 round 2.

## Changed files

| File                                     | Change                                                |
| ---------------------------------------- | ----------------------------------------------------- |
| `docs/spec/10-shortcuts-and-settings.md` | Two new sections; the follow-up bullets point to them |
| `docs/reviews/spec-2.md`                 | New. This review request.                             |

## Checks run

| Command or test           | Result                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`          | Pass: typecheck 8.0 s, lint 58.6 s, format:check 13.5 s, test:coverage 79.0 s (21 files, 185 tests), build 6.9 s; 166.0 s in all |
| Middle dots and em dashes | None in the changed files (checked with `grep -c`)                                                                               |

## Decisions I made (for the lead to confirm)

1. The board list includes a `Looks` 메시지 style row with "to decide", because
   open question 13 has no answer yet.
2. The ranges for 줄 간격 (0.8 to 3.0) and 속도 (0.25 to 4.0) in the step note
   are proposals; 05 and 06 don't give ranges. The settings inventory merged
   with spec-1 uses the same ranges.

## Where to look

- Whether each board row names the right design system components.
- Whether the step note is enough for the ui member to change the `TextField`
  README and component.
- The resolved "Follow-up work" bullets.
