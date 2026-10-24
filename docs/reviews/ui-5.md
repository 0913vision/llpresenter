# Review request: `ui-5`

- Team member: `ui`
- Branch: `fix/ui/card-font`
- Review range: `4656e3c...fix/ui/card-font`
- Base commit (`main`): `4656e3c` (round 1 was on `d993147`; rebased onto main
  for round 2, which now has devops-12, the node project route for renderer
  `*.node.test.ts` files)
- Shared changes: none
- Round 2, what to check: the finding in "Team member's reply", and that the new
  test fails when the URL, the file, or its bytes go wrong
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
- `src/renderer/src/styles/designSystemAssets.node.test.ts` (new in round 2; it
  replaces round 1's `designSystemAssets.test.ts`)

## Checks run

| Command or test                             | Result                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm run verify` (round 2)                  | Pass, 5 steps, 133 files, 1439 tests (1 skipped under coverage by design, not ui), 242 s |
| `designSystemAssets.node.test.ts` (round 2) | Pass; fails with other font bytes, a wrong URL in `tokens.css`, or no `fonts` folder     |
| Card server, font request                   | `/project/fonts/PretendardVariable.woff2` 200                                            |
| Button card beside the gallery, in Chromium | 10 of 10 shared labels have the same width                                               |

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
   `tokens.css` and the README expect, also outside this repository (the lead
   approved this in round 1). The round 2 test fails when a `pretendard` upgrade
   leaves the copy behind, so whoever upgrades it copies the new file here too.
2. **The test runs in the node project** (`*.node.test.ts`, from devops-12),
   because the renderer project replaces CSS with an empty string and has no
   Node types. It stays in `src/renderer/src/styles/`, the closest path I own,
   and reads files from `import.meta.dirname`.

## Shared contract change requests

None.

## Where to look

- `src/renderer/src/styles/designSystemAssets.node.test.ts`

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (27eab54): reviewer (Codex, codex3) Request changes: the test checked
  only hard-coded file names, so a broken URL or a stale font copy would pass.
  Lead approved keeping a copy in design/system.
- Round 2 (db0797b): reviewer (Codex, codex3) Approve, no findings: the node
  test reads the real @font-face URL and compares the font's bytes with the
  pinned package. Lead Approve; this fixes qa's M1-6. Rebased by the lead onto
  local `main` without conflicts.

## Team member's reply

Round 1 finding from codex3, fixed (`2941b3b`):

1. The test checked hard-coded file names. The new
   `designSystemAssets.node.test.ts` runs in the node project and reads
   `design/system/project/tokens.css` itself: it finds every `@font-face`,
   checks that each `src` URL points at a file that exists next to `tokens.css`,
   and compares the SHA-256 of the "Pretendard Variable" face's file with the
   pinned package's
   `node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2`.
   It also checks that `fonts/LICENSE.txt` holds the SIL Open Font License 1.1
   text. The round 1 glob test is gone. Checked against broken copies, each put
   back afterwards: one extra byte in the font fails the hash test; a wrong URL
   in `tokens.css` fails the file and hash tests; no `fonts` folder fails all
   three.
