# Review request: `spec-8`

- Team member: `spec`
- Branch: `docs/spec/pp-audit`, stacked on spec-5
  (`docs/spec/decided-shortcuts`) and rebased with it onto `main`
- Base commit (`main`): `8273192`
- Shared files changed: none
- Last commit: see the commit that adds this file
- Related request: the lead's message of October 25 (spec-8, the ProPresenter
  claim audit), plus the spec-4 round 2 nit

## What changed and why

### Round 1

The user's rule: nothing may say that it follows ProPresenter unless someone
checked. This request checks every place in `docs/spec/` that names
ProPresenter, "PP", or the `Main` "프로프리젠터와 다른 점" list, against the
ProPresenter 7.5 user guide (S4) and the other sources in 10.

The branch is stacked on spec-5, because spec-5 rewrites most of the shortcut
lines in 01 to 07 and adds new "Follows ProPresenter" rows; auditing `main`
alone would have checked text that spec-5 replaces. When spec-5 merges first,
its commits drop out of this branch.

How it was checked:

- **S1, the current shortcut table.** Fetched again on October 25 and compared
  row by row with 10's "Default shortcuts" table and every "follows
  ProPresenter" key in 03, 04, 05, 06, 07, and 10. All match.
- **S4, the 7.5 guide.** About 70 page citations in 10 were checked with a
  script that looks for each cited term on the cited page; all match. The new
  citations in 01 to 09 were read on their pages.
- **S2, S3, S5, S6, S7, S8.** Fetched again; the statements in 10's research
  sections match, except one version range (below).
- **Two new sources** join 10's list: S19 (Playlist Templates, 7.10 and later)
  and S20 ("ProPresenter automatically saves all of your changes"). The README
  "Sources" table now points to S1 to S20 and states the citation rule.

What changed, sorted by how much it changes behavior:

| #   | File and place                                                                                       | Change                                                                                                                                                                                                                               | Behavior change                                       | Merged code                |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | -------------------------- |
| 1   | 02 "Reference grammar", endpoint rules                                                               | The spec-4 nit: endpoints compare as (chapter, verse) pairs. 요 3:16-4:2 is a valid range, not "reversed"; 요 3:16-4:16 stays a range, not one verse.                                                                                | Yes, for the reference parser (M3-T4a, not built yet) | None                       |
| 2   | 10 question 17 and the 성경 page 참조 row                                                            | ProPresenter has four reference options (Verse References, Passage Each, Passage Last, No Reference, S4 p. 142), not three. The proposal itself is unchanged; the decision sheet (spec-6, entry 23) already uses four.               | No (the question is open)                             | None                       |
| 3   | 05 song editor editing rules                                                                         | "Modeled on the Reflow editor, where an empty line separates slides" had no source: the guide's Reflow editor breaks slides with Ctrl Enter (S4 p. 74). The rules stay, marked as our design.                                        | No                                                    | None                       |
| 4   | 03 "Visibility rule", Look edits apply live                                                          | "Assumed to match ProPresenter" had no source. Now our design, with what the guide does say (S4 pp. 37 to 38).                                                                                                                       | No                                                    | None                       |
| 5   | 01 "Follow ProPresenter" table                                                                       | Every row now cites its source. Two rows corrected: macro editing (the action palette for 매크로 is our design; ProPresenter's palette adds actions to slides, S4 p. 83, S5) and small screens (no source on a small window layout). | No                                                    | None                       |
| 6   | 07 매크로 editing                                                                                    | Same correction as row 5; "no separate editor window" is marked as our design.                                                                                                                                                       | No                                                    | None                       |
| 7   | 06 test pattern                                                                                      | ProPresenter shows a test pattern with Show and removes it with Clear (S4 p. 45); tying it to the 화면 설정 preview is our design.                                                                                                   | No                                                    | None                       |
| 8   | 04 jump key occurrence                                                                               | "Guessed from ProPresenter group hot keys" became "no ProPresenter source says which occurrence", with S4 pp. 58 and 176 for the hot keys themselves.                                                                                | No                                                    | 04 진행 keys: none changed |
| 9   | 09 camera input                                                                                      | The ProPresenter description is corrected to the guide (Preferences > Input, Media Bin, slide action, object fill, Look layer; S4 pp. 21, 39, 61, 86, 177 to 180). The macro action claim had no source and is gone.                 | No                                                    | None                       |
| 10  | 03 F1 to F7                                                                                          | Cites S1, and notes that the 7.5 guide lists F3 as Clear Background and F6 as Clear Logo (S4 pp. 25 to 26).                                                                                                                          | No                                                    | 03 output: none changed    |
| 11  | 03, 04, 05, 07: Ctrl 1, Ctrl 2, Ctrl Y, Key Mappings, Clear Groups, startup macros, keyboard summary | Source IDs and pages added (S1, S2, S3, S5, S7, S4 pp. 24, 70, 172).                                                                                                                                                                 | No                                                    | 10 keys: none changed      |
| 12  | 10 research, workspaces                                                                              | The release notes mention workspaces in 21.3 and 22, not "21.2 to 22" (S6).                                                                                                                                                          | No                                                    | None                       |
| 13  | 05 new service and importing                                                                         | Playlist Template cites S19; "isn't in the ProPresenter documentation" became "no ProPresenter source describes copying items from another playlist".                                                                                | No                                                    | None                       |

**For the owners:** no change in this request alters behavior that merged code
in 03 (output), 04 (진행), or 10 (keys) already implements. Nothing needs to go
to output or shell. Row 1 matters for tools' M3-T4a parser.

Not in this request: spec-7's new text in 04 "Preview panel" and 08 (still in
review) already cites guide pages. spec-6's decision sheet is in `docs/plans/`,
outside this audit's scope.

## Changed files

- `docs/spec/01-concepts.md`, `02-data.md`, `03-output.md`, `04-show.md`,
  `05-prep.md`, `06-settings.md`, `07-macros.md`, `09-later.md`,
  `10-shortcuts-and-settings.md`, `README.md`
- `docs/reviews/spec-8.md` (new)

## Checks run

| Command or test           | Result                                                                                                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`          | Pass on base `d993147`: typecheck 4.0 s, lint 35.3 s, format:check 30.2 s, test:coverage 66.6 s (88 files, 893 tests, 1 skipped), build 2.5 s; 138.7 s in all. Then rebased onto `8273192`, which changes no file in `docs/spec/` |
| Middle dots and em dashes | None in the changed files (checked with `grep -c`)                                                                                                                                                                                |

## Decisions I made (for the lead to confirm)

1. The branch is stacked on spec-5 so that the audit covers spec-5's new
   "Follows ProPresenter" lines.
2. A row of 10's command list keeps "Decided, follows ProPresenter" without its
   own source ID, because the table states that the ProPresenter column comes
   from S1 unless noted, and S1 was checked row by row.
3. "Our design" marks a behavior that this project chose; "no ProPresenter
   source found" marks a place where this project looked for ProPresenter's
   behavior and didn't find it.

## Where to look

- Row 1 (02 endpoint rules), since the parser builds from it.
- The 01 table, which now cites a source in every row.
