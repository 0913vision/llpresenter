# Review request: `spec-1`

- Team member: `spec`
- Branch: `docs/spec/shortcuts-settings`
- Base commit (`main`): `18c9943`
- Shared files changed: none
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/spec.md` (as widened in b510a3e)

## What changed and why

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
   keys work with the Korean IME on, a table of where shortcuts work, reserved
   keys, conflicts, storage by `code`, and a command list of 81 rows in 12
   groups (some rows stand for one command per Look, 소품, 매크로, or 타이머),
   each with an ID, a default or none, the ProPresenter key, a basis, where it
   works, and the version. A default key map shows that no two defaults collide.
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

On the branch rebased onto `8b623b3`, after `npm ci`. The later rebase onto
`18c9943` brought in documents only (`CLAUDE.md`, `docs/`), so these results
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

- [ ] `npm run verify` passes (fails only at the timeout above)
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

All of these are marked as proposals in the file, and the user decides. The ones
most likely to draw comments:

1. Bare letters and digits belong only to 이름표 jump keys; every command needs
   a modifier or a non-character key (follows ProPresenter's split between slide
   hot keys and Key Mappings, S2 and S4 p. 58).
2. Ctrl S opens 진행 (ProPresenter's Show Mode), except in the imported song
   editor, where it runs 저장 (open question 1).
3. In 진행, → ← Space Page Up Page Down always go to the live commands, even
   when the 장 grid or a list has focus. This differs from the `SlideThumbnail`
   README (open question 2).
4. On the last 장, → stops by default instead of moving into the next item,
   because moving on runs the next item's start 매크로 (open question 3).
5. The prevent sleep switches in `Prefs` and `Screens` go away; sleep is always
   blocked while any output is on (open question 11).
6. The 환경설정 output stability defaults go away, because version 1 can't add
   screens and the per-screen values already exist (answers README open question
   14).
7. Transitions become 환경설정 > 출력 > 전환, global like ProPresenter's master
   transitions (open question 7).
8. Media copy on import is a switch, default on (differs from ProPresenter's
   default off, open question 10); new videos import with sound off (open
   question 9).
9. Shortcut and jump key storage changes from display names to `code` values
   (open question 15).

## Shared contract change requests

None now. If the user accepts the proposal, the command registry and the key
matcher belong in `src/shared/` (a shared change that a member's brief must
allow), and 02 needs the field changes in "Storage changes for 02".

## Where to look

- "Command list" and "Default key map": collisions I missed, and whether the
  "Works in" scopes hold together with "Where shortcuts work".
- "ProPresenter research": spot-check a few rows against S1 and the cited S4
  pages.
- "Fixed behaviors" and "Rejected candidates": anything you think should be a
  setting after all, or the reverse.
- The 18 open questions, which go to the user.

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
