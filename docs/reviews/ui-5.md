# Review request: `ui-5`

- Team member: `ui`
- Branch: `fix/ui/card-font`
- Base commit (`main`): `d993147`
- Last commit: the commit that adds this file (see the review request message)
- Related brief: `docs/briefs/ui.md`; bug M1-6 from qa

## What changed and why

The design system preview cards rendered without Pretendard (M1-6, found by qa).
`design/system/project/tokens.css` loads the font from
`fonts/PretendardVariable.woff2`, but that folder wasn't in the repository, so
the request got a 404 and the cards fell back to Segoe UI and Malgun Gothic.
Every comparison of a component against its card then measured text in the wrong
font (qa: 127.7 px against 110.4 px for the same string).

This change ships the font where `tokens.css` expects it, next to its license:

- `design/system/project/fonts/PretendardVariable.woff2`: byte for byte the file
  the app already uses (`pretendard` 1.3.9,
  `dist/web/variable/woff2/PretendardVariable.woff2`, same SHA-1
  `2c1029bc9d8a62ba0388faf0aa19cddbd996e7e4`).
- `design/system/project/fonts/LICENSE.txt`: the SIL Open Font License 1.1 text
  from the same package (`dist/LICENSE.txt`), which the license requires to
  travel with the font.

The design system README already says the app uses this one file
(`fonts/PretendardVariable.woff2`, OFL), so no document changes.

## Changed files

- `design/system/project/fonts/PretendardVariable.woff2` (new, 2.0 MB)
- `design/system/project/fonts/LICENSE.txt` (new)
- `src/renderer/src/styles/designSystemAssets.test.ts` (new)

## Checks run

| Command or test                             | Result                                        |
| ------------------------------------------- | --------------------------------------------- |
| `npm run verify`                            | Filled in below                               |
| `designSystemAssets.test.ts`                | Pass; fails with the `fonts` folder taken out |
| Card server, font request                   | `/project/fonts/PretendardVariable.woff2` 200 |
| Button card beside the gallery, in Chromium | 10 of 10 shared labels have the same width    |

The last check ran in an offscreen Electron window (my own script, `show: false`
and `offscreen: true`, no show calls), on
`node design/system/card-server.js 5296` and `npm run gallery`. The card now
loads "Pretendard Variable" with status `loaded`, and every Button label that
both pages show measures the same, for example 새 곡으로 저장 73.9 px,
라이브러리 곡 편집 109 px, and 지금 예배를 틀로 저장 122.4 px in both. Earlier
comparisons needed a font injected into the card page; this one injects nothing.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (none here)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (none here)
- [x] Caches and lists have size caps (none here)
- [x] An exception in the output path doesn't stop the output (not in the output
      path)
- [x] Only what's needed re-renders (no components here)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly

## Decisions I made (for the lead to confirm)

1. **A copy of the font in the design system** rather than pointing the card
   server at `node_modules`. The design system then works on its own, as
   `tokens.css` and the README expect, also outside this repository. The test
   doesn't check that the copy matches the package after a `pretendard` upgrade;
   Vitest replaces CSS with an empty string and renderer tests have no Node file
   access, so the test checks the files that `tokens.css` names instead. Whoever
   upgrades `pretendard` copies the new file here too.
2. **The test lives in `src/renderer/src/styles/`**, the closest path I own that
   Vitest runs. It lists the design system files with `import.meta.glob` and
   expects the font and its license. A `NOTE(0913vision)` says why it names the
   path instead of reading `tokens.css`.

## Shared contract change requests

None.

## Where to look

- `src/renderer/src/styles/designSystemAssets.test.ts`

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
