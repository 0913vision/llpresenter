# Review request: `spec-9`

- Team member: `spec`
- Branch: `docs/spec/wave-a-readiness`, from `main` (not stacked)
- Base commit (`main`): `20ffc86`
- Shared files changed: none
- Last commit: see the commit that adds this file
- Related request: the lead's message of October 25 (spec-9, M3 wave A
  readiness)

## What changed and why

### Round 1

For each wave A request in `docs/plans/m3-breakdown.md`, I read the spec
sections it implements and asked: can the owner build it and write its tests
without guessing? Where not, this change fills the gap in `docs/spec/`. Edits
stay out of the lines that spec-5, spec-7, and spec-8 change.

| Request | Spec it builds from                                                                  | Ready?                            | Gaps filled here                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O0      | 01 command path, 03 "Layers and stacking order"                                      | Yes, after this change            | 01: an unknown command or a payload that fails its schema is dropped and logged with no state change; a command naming a deleted object is dropped the same way; each state carries a rising number, and a window ignores an older one.                                                                                                                                                                                                                                                        |
| D1a     | 02 file formats, 05                                                                  | Yes, after this change            | 05 "Search": the result gives the song ID, title or lyrics match, and the first matching line (the search request and result contract).                                                                                                                                                                                                                                                                                                                                                        |
| D1b     | 03, 04 진행 도구, 07                                                                 | Yes, after this change            | 01 and 07: a batch (`live.batch`) is applied in order as one change; a 매크로 run is one batch, nested 매크로 included. 03: `item.start` and the first 장 go as one batch. 04 오디오: a track is (playlist, position); previous and next at the ends; pause and resume; volume 0 to 100, starts at 100, not saved. 04 메시지: the tab's chips and time apply to one send only; 모든 화면 means every screen at send time. 04 공지: interval, 반복, and targets save to the set and apply live. |
| D1c     | 03, 06, 08, 02 recovery record                                                       | Yes                               | None needed. Test pattern (06), monitor numbers for 3 seconds (06), live screen property changes (06, 03, ranges in 10), and the recovery rows (08, 02) are defined.                                                                                                                                                                                                                                                                                                                           |
| D2      | 02 "App-wide settings", "Save rules", "Schema versions"                              | Yes, after this change            | 02: a defaults table for every settings file and `app.json` (nine files had none). 02: a broken settings file or media list loads the newest readable recovery copy, else the defaults, and is copied aside before the next write (see decision 1).                                                                                                                                                                                                                                            |
| D4      | 05 "Search", 04 "Toolbar search", `docs/TECH.md`                                     | Yes, after this change            | 05: normalization (NFC, lowercase Latin, spaces removed), the 19 initials including double ones, mixed queries match as plain text, the empty query. 04: the toolbar list shows at most 20 songs, with the first matching line for a lyrics match.                                                                                                                                                                                                                                             |
| U1      | 10 "Focus precedence", "Reserved keys", the number field note; the ui list in spec-5 | Yes, once spec-5 and spec-7 merge | None here. ui has the README wording (sent October 25, corrected after spec-7 round 2 for the key field order).                                                                                                                                                                                                                                                                                                                                                                                |
| Q1      | The plan's acceptance criteria and integration checks                                | Yes                               | None. qa builds from the plan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| W1      | `docs/spec/`, `docs/plans/`                                                          | Ongoing                           | This request is part of W1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### What still needs a user decision for wave A

These open decisions (`docs/plans/open-decisions.md`) change the shape of data
that wave A requests define. The proposals apply until the user decides, so no
request has to wait, but a later decision means a schema change.

| Entry | Decision                         | Wave A request it touches | What changes if the user picks another option                                           |
| ----- | -------------------------------- | ------------------------- | --------------------------------------------------------------------------------------- |
| 3     | The settings proposal as a whole | D2                        | `preferences.json` and `screens.json` fields move or go (10, "Storage changes for 02"). |
| 4     | Prevent sleep                    | D2                        | `screens.json` `.preventSleep` and `preferences.json` `preventSleep` stay or go.        |
| 10    | A style for Bible passages       | D1a, D2                   | `looks.json` gets a 말씀 style per screen.                                              |
| 23    | Bible reference frequency        | D1a                       | The passage `reference` value gains or loses options.                                   |
| 13    | Which stage layout applies       | D1b                       | The stage layout override command's lifetime.                                           |
| 25    | 메시지 appearance                | D2 (later X1a)            | `looks.json` gets a 메시지 style per screen.                                            |
| 26    | Outline and shadow detail        | D2 (later X2a)            | Lyric style `outline` and `shadow` become objects.                                      |

## Changed files

- `docs/spec/01-concepts.md`, `02-data.md`, `03-output.md`, `04-show.md`,
  `05-prep.md`, `07-macros.md`
- `docs/reviews/spec-9.md` (new)

## Checks run

| Command or test           | Result                                                                                                                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`          | Pass on base `8273192`: typecheck 21.5 s, lint 44.9 s, format:check 33.4 s, test:coverage 75.1 s (88 files, 903 tests, 1 skipped), build 2.4 s; 177.2 s in all. Then rebased onto `20ffc86`, which changes no file in `docs/spec/` or `docs/plans/` |
| Middle dots and em dashes | None in the changed files (checked with `grep -c`)                                                                                                                                                                                                  |

## Decisions I made (for the lead to confirm)

1. **Broken settings files.** `docs/TECH.md` says not to touch a broken file and
   to skip it. For a settings area, skipping leaves the app without that area,
   and the first save would overwrite the broken file anyway. 02 now keeps the
   content instead: the area runs from the newest readable recovery copy or the
   defaults, and the broken file is copied aside before the next write. If you
   agree, `docs/TECH.md` "Storage" needs the same wording (your file).
2. **First-launch defaults** that no board shows: 검은 화면 as the only 퀵 실행
   item, the seven stage message presets from the 무대 tab, and no templates,
   sets, 소품, 타이머, or 매크로.
3. **Search ignores spaces** in both the query and the text. Korean operators
   often type song titles without spaces.

## Where to look

- The D2 defaults table and the broken file rule in 02.
- The batch rules in 01, 03, and 07, which D1b, O10, S1a, and T3a share.
