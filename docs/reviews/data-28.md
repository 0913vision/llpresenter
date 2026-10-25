# Review request: data-28

- Team member: data
- Branch: `feat/data/text-import`
- Base commit: `6f04e7619ae8129132104e49abf2d302f242268d` (`main`)
- Last source commit: `40a7faa9e9ba922e86949e6da5986331ef40eaff`
- Review range: `6f04e76...feat/data/text-import`
- Related brief: `.llp/task.md`, M3-D3 in `docs/plans/m3-breakdown.md`

## What changed and why

Answer data-23's text import read and preview channels. A file selection or
clipboard read returns retained decoded text; preview builds an unsaved song
with its title, lyric lines, and labels. Changing options rebuilds the draft
from the retained source. No song, settings, or label list is written.

Auto decoding chooses a UTF-8 or UTF-16 BOM first, otherwise strict UTF-8 and
then CP949. Explicit UTF-8 never falls back. UTF-8 and UTF-16 use the strict
built-in decoder; CP949 uses the one `iconv-lite` wrapper in `decode.ts`.
Replacement characters reject the input rather than becoming lyrics.

Conversion follows spec 05: file titles use the filename stem and retain the
first lyric line; clipboard title mode removes the first nonlabel text line,
while lyrics mode permits an empty title. Blank-line, line-break, and literal
symbol splitting group the selected number of units. Stanza breaks always end a
line-break slide. Bracket labels end the current slide and label only the next
emitted slide, without becoming lyrics.

Native file selection is blocked offscreen and after the control window closes.
Only one read can be pending. Both IPC requests are validated; failures are
logged and returned as typed results. Disposal removes both handlers and refuses
late results. The app entry registers this lifecycle with shutdown.

Carry the approved data-26/data-27 nits: interruption tests have their own
`describe('interruptsSongOutput')`, and the screen/recovery type comments are
shortened without changing their contracts.

## Changed files

- `src/main/import/convert.ts`, `decode.ts`, `read.ts`, `register.ts`,
  `limits.ts`.
- `src/main/import/convert.test.ts`, `decode.test.ts`, `read.test.ts`,
  `register.test.ts`, and the invented encoding fixtures in `testText.ts`.
- `package.json` and `package-lock.json`: exact production dependency
  `iconv-lite: "0.7.3"`, including its locked `safer-buffer` dependency.
- `src/main/index.ts`: import, registration, and disposal only. The lead
  explicitly allowed this exception to output's ownership for data-28.
- `src/main/index.wiring.test.ts`: matching mock, registration context check,
  and shutdown cleanup check only, under the same explicit exception.
- `src/shared/commands.test.ts`, `src/shared/schema/screenCommands.ts`, and
  `src/shared/schema/recovery.ts`: the requested nits.
- `docs/reviews/data-28.md`.

## Checks run

| Command or test                                | Result                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run typecheck`                            | Passed, including after rebase                                                     |
| Targeted Vitest, ten files                     | 145 tests passed                                                                   |
| Entry and wiring tests after rebase, two files | 20 tests passed                                                                    |
| ESLint on changed TypeScript files             | Passed                                                                             |
| `npm run format` and `git diff --check`        | Passed                                                                             |
| Rebase `git range-diff`                        | All three source changes identical                                                 |
| Local `npm run verify`                         | Not run, per lead instruction                                                      |
| GitHub full verification                       | Runs on the final review HEAD; its run URL and result accompany the review request |

Encoding acceptance covers both byte decoding and real temporary-file reads:
UTF-8 without BOM, UTF-8 BOM, UTF-16 LE BOM, UTF-16 BE BOM, and CP949 with
extended Hangul all produce the same draft. Tests also cover malformed/truncated
bytes, replacement rejection, each split mode and grouping count, stanza
boundaries, labels, title rules, repeated previews, input/output limits,
cancellation, clipboard failure recovery, unsupported request shapes, disposal,
and source file preservation.

Local tests mock Electron. No visible app or dialog, soak, or memory measurement
was run; no local display-dependent failure occurred.

## Quality checklist

- [x] Cross-process requests are checked with the existing public schemas.
- [x] External bytes are decoded strictly and corrupt output is rejected.
- [x] New behavior and failure paths have meaningful tests.
- [x] No `any`, unchecked assertions, non-null assertions, or direct schema
      library imports outside the schema layer.
- [x] File handles close in `finally`; IPC handlers have idempotent cleanup.
- [x] Pending reads and every new list are bounded; nothing is cached.
- [x] No output-state edits or file writes occur during reading or conversion.
- [x] Code, comments, commit messages, formatting, and ownership follow the
      rules.

## Decisions and approved dependency

- `iconv-lite` at exactly `0.7.3` was approved and recorded on main in
  `docs/decisions.md` (commit `c0aa3c9`). Node 24.20.0 with ICU 78.3 recognizes
  the `windows-949` label but fails extended CP949 bytes such as `94 EE` for
  `뷁`; the test includes that case. The dependency is used only in the import
  decoder, with native strict Unicode decoding retained. The committed lockfile
  fixes both installed packages. No application or global program was installed.
- Normalize CRLF/CR to LF, replace each tab with one space, trim trailing line
  whitespace and outer blank lines. Preserve lyric indentation; symbol units are
  trimmed as spec 05 requires. When grouping paragraphs, keep one blank line
  between them. Adjacent labels without lyrics use the last label. Label names
  are retained verbatim, without English-name mapping or color/list changes.
- Reject oversized input with the existing `invalid` refusal: 4 MiB of file
  bytes, 1,000,000 decoded characters, 20,000 input lines or units, 1,000 units
  per slide, and 5,000 slides. Reads remain bounded even if a selected file
  grows after its size check. Nothing is silently truncated into a draft.
- A cancelled selection is a null success. Empty clipboard input or conversion
  without lyric lines returns `empty`. Read/decoder failures retain their
  existing typed reasons. Invalid requests are logged before native input
  access.

## Integration boundaries and where to look

The existing preload API needs no changes. M3-P5 owns the import dialog and
opening the draft in the song editor. Saving a song and updating the saved label
list remain separate from this conversion-only request.

Review the extended Hangul and file-to-draft acceptance tests, literal symbol
and stanza behavior, the bounded read loop and handler disposal, and the narrow
app-entry integration. Rebased onto the latest main immediately before the
review push; output's existing entry behavior is retained.

## Verdicts (recorded by the lead at merge)

- Round 1 (4c912a7): reviewer (Claude, trial-97) Approve. Two nits for the next
  data branch: `src/main/import/read.ts:36` allocates 4 MiB + 1 for every read;
  allocate `Math.min(info.size, TEXT_IMPORT_LIMITS.bytes) + 1`. `read.ts:78`
  accepts clipboard text with U+FFFD that the preview then rejects as
  `decode-failed`; reject it at the clipboard read with a fitting reason or
  accept it for clipboard sources. Lead Approve, including `iconv-lite` 0.7.3
  (`docs/decisions.md`, c0aa3c9) and the wiring in output's `src/main/index.ts`.
  Written by the Codex session that took over data's work. Rebased by the lead
  onto local `main` without conflicts. M3-D3 is complete.

## Team member's reply

Pending review.
