# Brief: spec

- Session name: spec
- Branch: `docs/spec/shortcuts-settings` (own worktree)
- Dev server port and app data folder: given by the lead (machine-specific, kept
  outside the repository).
- Phase: phase 1 research, in parallel with the other members. Implementation
  comes in phase 4.

## Goal

The user wants a complete shortcut system and a settings window that covers what
ProPresenter's settings offer, adapted to this app. Today
`docs/spec/06-settings.md` has only 13 default shortcuts and a 환경설정 window
drawn from our own draft board. Research what ProPresenter really does, then
write a spec proposal that the user can decide on before any design or code.

The user's intent, in their words: fonts were only an example, and ProPresenter
may not have them. "설정창에 뭐가 있어야 될지는 생각을 해보고 만들어달라는 거야
... 진짜 프로그램을 만드는 사람 입장에서는 정말 섬세하게 API 하나하나 설정
하나하나를 다 고민하면서 만든단 말이야." So the settings proposal comes from
going through every behavior of the app, not from copying ProPresenter. For each
candidate setting, decide whether an operator should change it, its default,
range, storage, when it applies, and why; list rejected candidates with reasons,
including behaviors that stay fixed because a fixed safe behavior is better
during a service. ProPresenter, EasyWorship, and OBS serve as evidence of what
operators expect, with sources.

## Tasks

1. In your worktree, rewrite `.llp/notes.md` for this task. Your branch is
   already `docs/spec/shortcuts-settings`.
2. **ProPresenter keyboard shortcuts:** collect ProPresenter 7's default
   shortcuts and how they are customized (its own preferences page for
   shortcuts, per-item hot keys, MIDI or other triggers if they matter). Use
   Renewed Vision's documentation, support articles, and release notes. Cite the
   source URL for every entry. Don't claim anything you didn't find.
3. **ProPresenter preferences:** collect every preferences page and setting in
   ProPresenter 7 (General, Screens, Import, Updates, Advanced, and so on), with
   sources, including text and font settings (default fonts, theme text styles,
   fallback fonts) and anything about typography.
4. **Map them to this app** in a new proposal file
   `docs/spec/10-shortcuts-and-settings.md`:
   - **Shortcuts:** a full command list grouped by area (진행, 지우기, 화면 and
     outputs, Look, 예배 순서 navigation, 장 navigation, 이름표 jump keys, 작업
     공간 switching, search, editing in 준비, windows and menus), with a default
     key for each where it makes sense, the ProPresenter key it follows, or the
     reason it differs. Avoid conflicts. Consider Windows conventions and the
     Korean keyboard: shortcuts must work while the Korean IME is on, so they
     are matched by physical key (`KeyboardEvent.code`), not by character.
   - **Settings:** the 환경설정 pages and rows for this app, including fonts (UI
     font is fixed by the design system; lyric and output fonts belong to Looks
     and styles, so say where each font setting lives). Mark each row as version
     1 or later, and as following ProPresenter or our own.
   - Mark what you decided as "(proposal)" and list open questions at the end,
     as `docs/spec/README.md` does.
5. Update `docs/spec/06-settings.md` and `docs/spec/README.md` only to point to
   the new file and to note which of their rows the proposal would replace.
   Don't rewrite them; the user decides first.

## Out of scope

- Code, design boards, and the design system. If the proposal needs new boards,
  list them as a follow-up.

## Owned files (change only these)

- `docs/spec/10-shortcuts-and-settings.md` (new)
- `docs/spec/06-settings.md` and `docs/spec/README.md`, pointers only
- `docs/reviews/spec-<number>.md`

## What to read

- `CLAUDE.md`, `docs/WORKFLOW.md`
- `docs/spec/README.md`, `docs/spec/01-concepts.md`, `docs/spec/03-output.md`
  (clears F1 to F7), `docs/spec/04-show.md`, `docs/spec/06-settings.md`
- `docs/product-log.md` (decisions; "follow ProPresenter" applies)
- `design/system/project/README.md` (typography rules, glossary)

## Done when

- The proposal file covers every command and every settings page, each with a
  source or a reason, and the open questions are listed.
- The review request is merged into `main` by fast-forward.

## How to verify

- `npm run format:check` (Markdown), and no middle dots or em dashes.

## Commits

- One line, `tag(scope): <sentence>`, scope `spec`. Run `npm run format` first.

## When you finish

Rebase onto the latest `main`, run the check, write `docs/reviews/spec-1.md`,
commit it, and send the lead:

```text
Review request: docs/reviews/spec-1.md, branch docs/spec/shortcuts-settings, commit <hash>
```
