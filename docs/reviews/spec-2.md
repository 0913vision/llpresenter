# Review request: `spec-2`

- Team member: `spec`
- Branch: `docs/spec/boards-list`. It was stacked on spec-1; after spec-1
  merged, it was moved onto `main` with only its own commits.
- Base commit (`main`): `cca7ea0`
- Last commit: see the commit that adds this file
- Shared files changed: none
- Related brief: `docs/briefs/spec.md`, and the lead's requests of October 25

## What changed and why

### Round 2

Codex (codex3) requested changes. Round 2 changes only
`docs/spec/10-shortcuts-and-settings.md`:

1. **Step table (finding 1).** The grouped rows are split into one row per
   field, with the bounds and step of its settings row: 장 전환 시간 0.1 to 2.0
   (step 0.1), 배경 전환 시간 0.1 to 3.0 (step 0.1), 오디오 전환 0 to 5 (step
   0.1), 페이드 아웃 시간 0.5 to 10 (step 0.5, large step 5).
2. **ImportText (finding 2).** A new board row, "`ImportText`: option bar": when
   장 나누기 is 기호, a short text field for the symbol follows the option (05),
   starting from 환경설정 > 가져오기 (default "/"), and the dialog saves its
   last options back to the same fields. Two states (빈 줄, 기호), the
   components, and README open question 25.
3. **Question 3 (nit).** The `Prefs` 진행 row says "Open question 3 (decided)".

The branch is rebased once onto `cca7ea0`.

### Round 1

This change adds two sections to `docs/spec/10-shortcuts-and-settings.md`, under
"Follow-up work". It changes no decided spec row, code, configuration, or
dependency.

1. **Boards this proposal needs.** 19 rows (20 after round 2): the `Prefs` page
   list and its eight pages, the page reset, `Shortcuts` and its reset dialog,
   the `Looks` lyric style and a 메시지 style, the `StageEditor` clock format,
   `Screens`, the quit and empty data folder dialogs, and the 타이머 editor
   later. Each row names the design system components it uses and the open
   question it depends on. The shortcut rows depend on nothing now (decided);
   the settings rows name their open question (10 to 18).
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

| Command or test            | Result                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` (round 2) | Pass: typecheck 4.4 s, lint 30.2 s, format:check 10.8 s, test:coverage 72.2 s, build 5.5 s; 123.0 s in all                       |
| `npm run verify` (round 1) | Pass: typecheck 8.0 s, lint 58.6 s, format:check 13.5 s, test:coverage 79.0 s (21 files, 185 tests), build 6.9 s; 166.0 s in all |
| Middle dots and em dashes  | None in the changed files (checked with `grep -c`)                                                                               |

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

## Verdicts (recorded by the lead at merge)

- Round 1 (381d854): reviewer (Codex, codex3) Request changes: grouped step rows
  contradicted the settings rows, ImportText's delimiter field was missing, and
  a decided question was listed as open.
- Round 2 (81a462d): reviewer (Codex, codex3) Approve, no findings. Lead
  Approve. Rebased by the lead onto `main` 5922438 without conflicts.
