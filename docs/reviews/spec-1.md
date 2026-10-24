# Review request: `spec-1`

- Team member: `spec`
- Branch: `docs/spec/shortcuts-settings`
- Base commit (`main`): `13d88b1`
- Shared files changed: none
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/spec.md` (as widened in b510a3e)

## What changed and why

### Round 2

Codex (codex3) requested changes, and the user decided the shortcut questions on
2026-10-25 (`docs/decisions.md`). Round 2 changes only
`docs/spec/10-shortcuts-and-settings.md` and the pointer notes in
`docs/spec/06-settings.md`:

1. **Missing commands (finding 1).** Added 무대 메시지 보내기, 메시지 보내기,
   미디어 가져오기, and 14 more rows found the same way: 오디오 반복, 새 매크로,
   새 재생목록, 다시 연결, 구성 추가, 장 넣기, 모니터 번호 표시, Look 추가, 새
   배치, 요소 추가, 창 보기, 최소화 and 최대화, the Windows text keys, and
   PowerPoint import (later). A new table, "Actions without a command", gives
   the reason for every kind of action that has no command.
2. **Focus precedence (finding 2).** "Where shortcuts work" now starts with a
   seven-step precedence. A focused control such as a 매크로 tile (07) keeps its
   own keys ahead of the global live keys; the 장 grid and the 예배 순서 list
   pass ← → Space Page Up Page Down to live navigation, as in ProPresenter (S4
   p. 70). A new rule keeps a mouse click in 진행 from moving keyboard focus to
   buttons and tiles, so clicking a 매크로 and then pressing Space can't run it
   again. A table names the rules this replaces or narrows (`SlideThumbnail`
   README, 04 "Keyboard", 07 "Keyboard", component READMEs).
3. **Inventory (finding 3).** "Settings on screens, Looks, and objects" is now a
   complete inventory: control, range, default, storage field, and timing for
   every row of the screens (edge margin 0 to 20 %, offset -200 to 200 px, and
   the rest), Looks, lyric styles, stage layouts, media properties (speed 0.25
   to 4.0), and the other objects. Defaults come from the boards where they show
   values; ranges the spec left open are marked as proposals.
4. **Nit at line 938 (finding 4).** Its text was cut off, so it isn't addressed
   here. If codex3 still has it, it goes into my next branch.
5. **The user's shortcut decision.** The intro has a "Decision status". Every
   shortcut row's basis reads "Decided, follows ProPresenter" with the source,
   or "Decided, no ProPresenter source found" (for example the last 장, default
   jump keys, and → after picking another item). The open questions use the
   numbering the user decided on: shortcuts 1 to 9 decided, settings 10 to 18
   open. Every reference follows the new numbers.

### Round 1

This change adds a proposal for the user to decide before any design or code:
`docs/spec/10-shortcuts-and-settings.md`. It also adds pointer notes to
`docs/spec/06-settings.md` and `docs/spec/README.md`. No code, configuration, or
dependency changed, and no decided spec row changed.

The proposal has three parts:

1. **ProPresenter research, with sources S1 to S18.** The current default
   shortcut table (S1), Key Mappings (S2, S3), slide and group hot keys, MIDI
   and other triggers, every Preferences tab of the 7.5 user guide with page
   numbers (S4), notes from the current release notes (versions 21 and 22, S6),
   and how ProPresenter handles fonts (no font setting in Preferences; fonts
   live on text objects; a Missing Font dialog in current versions). EasyWorship
   (S9, S10) and OBS (S11) serve as extra evidence. MDN, Microsoft, Wikipedia,
   Logitech, and Electron sources back the Korean IME, remote control, and
   default menu points.
2. **The shortcut system.** Principles (one command registry, bare letters and
   digits only for 이름표 jump keys, live keys where ProPresenter has them,
   ignore key repeat for live commands), matching by `KeyboardEvent.code` so
   keys work with the Korean IME on, focus precedence and where shortcuts work,
   reserved keys, conflicts, storage by `code`, and a command list of 98 rows in
   12 groups (after round 2) (some rows stand for one command per Look, 소품,
   매크로, or 타이머), each with an ID, a default or none, the ProPresenter key,
   a basis, where it works, and the version. A default key map shows that no two
   defaults collide.
3. **The settings.** Principles (a setting only where operators really differ,
   safety is never a setting, one place per value, no single-option controls),
   nine 환경설정 pages with every row's control, range, default, storage field,
   timing, version, basis, and reason, the changes to screen, lyric style, stage
   element, and object settings, where each font setting lives, remembered
   state, 22 fixed behaviors, 32 rejected candidates, the storage changes 02
   would need, what the proposal would replace, follow-up work, and 18 open
   questions.

The brief was widened on b510a3e after the user's clarification ("설정창에 뭐가
있어야 될지는 생각을 해보고 만들어달라는 거야"). So the settings list comes from
going through every behavior in 01 to 09 and `docs/TECH.md`, and ProPresenter,
EasyWorship, and OBS serve as evidence, not as the template.

### How the research was done

- Renewed Vision's learning site (`learn.renewedvision.com`) now redirects to
  the support knowledge base, and the user guide PDF on
  `files.renewedvision.com` returned HTTP 522. I read the guide from the
  Internet Archive copy of the same URL (snapshot of August 2, 2025, "Updated
  for Version 7.5, April 27, 2021") and checked every cited page number against
  the extracted text.
- The ProPresenter 6 shortcut article needs a sign-in, so it isn't used.
- Where no source exists, the document says so ("None found", "None documented")
  instead of guessing, for example a default key for the next playlist item, or
  a keyboard shortcut for Clear Groups.

## Changed files

| File                                     | Change                                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `docs/spec/10-shortcuts-and-settings.md` | New. The proposal.                                                                                                     |
| `docs/spec/06-settings.md`               | Pointer notes only: one at the top, and one each in Screen properties, Look editor, 환경설정 window, and Shortcuts.    |
| `docs/spec/README.md`                    | Pointer only: a row in "Reading order", and a note above the open questions naming the rows the proposal would answer. |
| `docs/reviews/spec-1.md`                 | New. This review request.                                                                                              |

## Checks run

Round 2, on the branch rebased onto `13d88b1`:

| Command or test           | Result                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`          | Pass: typecheck 1.8 s, lint 25.2 s, format:check 25.4 s, test:coverage 83.1 s (21 files, 179 tests), build 5.5 s; 141.0 s in all |
| Middle dots and em dashes | None in the changed files (checked with `grep -c`)                                                                               |

Round 1:

On the branch rebased onto `8b623b3`, after `npm ci`. The later rebase onto
`7d46151` brought in documents only (`CLAUDE.md`, `docs/`), so these results
still hold:

| Command or test           | Result                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`       | Pass (inside `verify`, 11.5 s)                                                                                                |
| `npm run lint`            | Pass (inside `verify`, 99.5 s)                                                                                                |
| `npm run format:check`    | Pass (inside `verify`, 11.4 s)                                                                                                |
| `npm run test:coverage`   | Fail: 128 passed, 1 failed. The failure is a timeout in `scripts/lint/config.test.ts` (see below). The build step didn't run. |
| `npm run verify`          | Fail at step 4/5 for the same reason                                                                                          |
| Middle dots and em dashes | None in the three changed spec files (checked with `grep -c`)                                                                 |

The failing test is "the lint config > reports a floating promise". Its first
`eslint.lintText` call builds the TypeScript program and took more than the
60-second `LINT_TIMEOUT_MS` on this computer. Run alone with
`npx vitest run scripts/lint/config.test.ts`, the file took 142 s and the same
case timed out. The computer was shared by about 49 node, Electron, and Claude
processes at 51% CPU load. This branch changes only Markdown files, so the
failure comes from `main` on a loaded computer, not from this change. The lead
confirmed it's a known defect that devops is fixing, and that a verify run whose
only failure is this test counts as passing while the review file says so.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (round 2; round 1 failed only at the timeout
      above)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests (not applicable:
      documents only)
- [x] Values from outside the process are validated with a schema (not
      applicable; the proposal requires schema validation for `shortcuts.json`
      and `labels.json`)
- [x] No `any`, no type assertions that bypass checks, and no `!` (no code)
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (no code)
- [x] Caches and lists have size caps (no code)
- [x] An exception in the output path doesn't stop the output (no code)
- [x] Only what's needed re-renders (no code)
- [x] The clean code rules in `CLAUDE.md` hold (no code)
- [x] Comments follow `CLAUDE.md` (no code)
- [x] The code uses the modern language features that `CLAUDE.md` lists (no
      code)
- [x] The change is small and focused, and "What changed and why" describes it
      clearly. The proposal file is long because the brief asks for every
      command and every setting; it changes no decided row.
- [ ] Measured performance values (not applicable)

## Decisions I made (for the lead to confirm)

Items 1 to 4 and 9 are now decided by the user's shortcut decision. Items 5 to 8
are settings proposals that stay open (numbers as in round 2):

1. Bare letters and digits belong only to 이름표 jump keys; every command needs
   a modifier or a non-character key (follows ProPresenter's split between slide
   hot keys and Key Mappings, S2 and S4 p. 58).
2. Ctrl S opens 진행 (ProPresenter's Show Mode), except in the imported song
   editor, where it runs 저장 (decided, open question 1).
3. In 진행, → ← Space Page Up Page Down always go to the live commands, even
   when the 장 grid or a list has focus. This differs from the `SlideThumbnail`
   README (decided, follows ProPresenter; open question 2).
4. On the last 장, → stops by default instead of moving into the next item,
   because moving on runs the next item's start 매크로 (decided, no ProPresenter
   source found; open question 3).
5. The prevent sleep switches in `Prefs` and `Screens` go away; sleep is always
   blocked while any output is on (open question 10).
6. The 환경설정 output stability defaults go away, because version 1 can't add
   screens and the per-screen values already exist (answers README open question
   14).
7. Transitions become 환경설정 > 출력 > 전환, global like ProPresenter's master
   transitions (open question 12).
8. Media copy on import is a switch, default on (differs from ProPresenter's
   default off, open question 15); new videos import with sound off (open
   question 14).
9. Shortcut and jump key storage changes from display names to `code` values
   (decided, open question 8).

## Shared contract change requests

None now. The command registry types and the key matcher belong in
`src/shared/`, which data owns; the member who builds shortcuts sends data the
shapes first. 02 needs the field changes in "Storage changes for 02".

## Where to look

- "Command list" and "Default key map": collisions I missed, and whether the
  "Works in" scopes hold together with "Where shortcuts work".
- "ProPresenter research": spot-check a few rows against S1 and the cited S4
  pages.
- "Fixed behaviors" and "Rejected candidates": anything you think should be a
  setting after all, or the reverse.
- Round 2: the new "Focus precedence", "Actions without a command", and the
  inventory tables under "Settings on screens, Looks, and objects".
- Open questions 10 to 18, which still go to the user.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (d3edc45): reviewer (Codex, codex3) Request changes: missing commands
  (media import, 무대 메시지, messages), no focus precedence between 매크로
  tiles and live keys, and settings kept by reference without defaults or
  ranges. A fourth nit was cut off.
- Round 2 (57de899): spec added the missing commands and a table of actions
  without a command, a seven-step focus precedence with the rules it replaces,
  and the full settings inventory; the user's shortcut decision is applied to
  every row. Reviewer (Codex, codex3) Approve with two nits: the Page Up and
  Page Down row at line 1259 credits ProPresenter although the command rows say
  no source was found, and the window rules should require
  `Menu.setApplicationMenu(null)`. The nits go into spec's next branch. Lead
  Approve, and the lead confirms decisions 1 to 9 as written (5 to 8 stay open
  for the user, with the proposal's defaults in the meantime). Rebased by the
  lead onto `main` 5cfd4f4 without conflicts.
