# Review request: `spec-6`

- Team member: `spec`
- Branch: `docs/spec/open-decisions`, from `main` (not stacked)
- Base commit (`main`): `9e2496a`
- Shared files changed: none
- Last commit: see the commit that adds this file
- Related request: the lead's message of October 25 (spec-6, the decision sheet)

## What changed and why

### Round 1

The lead asked for one sheet from which the user decides every open question, to
be presented in Korean. `docs/plans/open-decisions.md` (new) collects:

- README open questions 1 to 26, 10's settings questions 10 to 18, the two Bible
  questions of spec-4 (text source, files in the public repository), and the
  settings proposal as a whole, which 10's "Decision status" leaves open.
- 30 entries, sorted by when the answer is needed: M2 (2), M3 by wave A to D and
  the waiting X requests (24), M4 (3), and later (1). Each entry gives the
  question in one sentence, the options, the proposal and why, what it blocks
  (M3 request IDs from `docs/plans/m3-breakdown.md`), the ProPresenter answer
  with a source, and where the question comes from.
- A summary table at the top, and a **Batch** mark on 14 low-risk entries that
  the user can accept together.
- "Already decided": README 1, 2, 3, 4 (version 1 part), 8, and 19, and 10's
  questions 1 to 9, each with where it was decided. README 12, 14, and 24 fold
  into entries 20, 4, and 7.

The ProPresenter lines come from the 7.5 user guide (S4) already used for
spec-1, checked page by page for this sheet; they add pages 32, 37, 41, 81, 87,
90, 91, 123, 124, 140, and 142 to 144.

Two findings change a proposal compared with the spec:

1. **Entry 23, Bible reference frequency.** The guide (S4 p. 142) has four
   options: Verse References, Passage Each, Passage Last, and No Reference. 10's
   question 17 named three. The sheet proposes ProPresenter's four and drops
   02's "first 장 only", which no source has. 10 and 02 change after the user
   decides (M3-W1).
2. **Entry 10, a style for Bible passages.** 04 draws passages with the current
   lyric style. ProPresenter formats Bible slides with their own theme (S4 pp.
   142 to 144), and the `Bible` board names a "말씀" style, so the sheet
   proposes a 말씀 style per screen in the Look.

## Changed files

- `docs/plans/open-decisions.md` (new)
- `docs/reviews/spec-6.md` (new)

## Checks run

| Command or test           | Result                                                                                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify`          | Pass on base `4aa7901`: typecheck 7.9 s, lint 102.6 s, format:check 23.7 s, test:coverage 162.5 s (57 files, 573 tests, 1 skipped), build 31.3 s; 327.9 s in all. Then rebased onto `9e2496a` (documents only) and checked the two files with Prettier |
| Middle dots and em dashes | None in the changed files (checked with `grep -c`)                                                                                                                                                                                                     |

## Decisions I made (for the lead to confirm)

1. The branch is `docs/spec/open-decisions`, not `docs/plans/open-decisions`,
   because branch names follow `<tag>/<name>/<feature>` and the session hook
   reads the middle part as the member's name.
2. The settings proposal as a whole is entry 3, needed in M3 wave A, because D2
   creates the settings files in the shape that 10 changes.
3. About 350 smaller "(proposal)" marks in 01 to 08 are left out; "Not for the
   user" says so. Questions that only the lead decides (the es-hangul
   dependency) are left out the same way.
4. Entry 13 cites the `Main` board decision for Looks that switch stage layers,
   as 03 does, although ProPresenter's Looks cover only audience screens.

## Where to look

- That every README and 10 question appears once, either as an entry or in
  "Already decided".
- The "Blocks" lines against the M3 plan.
- Entries 20 and 25, where the proposal departs from ProPresenter on purpose.

## Verdicts (recorded by the lead at merge)

- Round 1 (550e01f): lead Approve. The Codex request never reached its window (a
  tmux delivery fault), and the sheet is a documents-only list of open questions
  for the user, so the lead reviewed it alone. The lead already presented its
  summary to the user; the proposals apply until the user answers. Merged onto
  local `main` without conflicts.
