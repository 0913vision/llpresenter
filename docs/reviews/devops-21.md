# Review request: `devops-21`

- Team member: `devops`
- Branch: `chore/devops/no-bom`
- Review range: `140563b4...chore/devops/no-bom`
- Related brief: `.llp/task.md`, "Small task (from the lead, 05:50): no byte
  order marks", and `.editorconfig`'s `charset = utf-8`.
- The lead grants this task only permission to strip BOM prefixes from other
  owners' tracked files. Every remaining byte in those files is preserved.

## What to check

1. Cleanup commit `13c344f2` removes exactly the initial `EF BB BF` bytes from
   13 files. Compare raw blobs; no body, newline, or formatting changes belong
   in this commit.
2. `scripts/lint/config.mts` adds `unicode-bom: ['error', 'never']` to code
   linting. The probe demonstrates rejection of a BOM and acceptance of BOM-free
   Unicode text.
3. `scripts/check-bom.mts` runs before Prettier in `format:check`, includes
   tracked Markdown and JSON that Prettier ignores, and fails with file paths.
4. The exact review-head hosted CI is green. Its URL, SHA, and result accompany
   the review-request report.

## What changed and why

`.editorconfig` requires UTF-8 without a BOM, but Prettier accepts files that
retain one. The repository had 13 tracked files beginning with `EF BB BF`. The
first commit strips those three bytes using raw buffers. A byte comparison
against the original Git blobs passed before committing and again after the
rebase: each result equals the original blob with exactly its first three bytes
removed.

The five code files are `settingsChannels.ts`, `settingsStore.ts`,
`LabelMenu.tsx`, `SongEditor.tsx`, and `useMediaStrip.ts`. The eight documents
are review files `data-22`, `data-23`, `data-24`, `data-25`, `data-28`,
`data-29`, `devops-18`, and `spec-18`. A full tracked-file prefix scan after the
rebase found no remaining UTF-8 BOMs.

The guard has two parts:

- ESLint's [`unicode-bom`](https://eslint.org/docs/latest/rules/unicode-bom)
  rejects BOMs in code with the explicit `never` setting.
- `npm run format:check` first runs `node scripts/check-bom.mts`, then the
  existing cached Prettier check. The script enumerates tracked paths with NUL
  separators, checks `.md`, `.markdown`, and `.json` case-insensitively, and
  reads only three bytes per file. It closes each file handle, reports offending
  paths, and returns a failure without rewriting files. It checks
  formatter-ignored files such as `package-lock.json` too.

No dependencies or application behavior changed.

## PowerShell writes without a BOM

Windows PowerShell 5.1's `Set-Content -Encoding UTF8` adds a BOM; its encoding
options don't include `utf8NoBOM`. Use the .NET encoder instead:

```powershell
$path = Join-Path (Get-Location) 'docs/reviews/example.md'
$text = "# Example`n"
[IO.File]::WriteAllText($path, $text, [Text.UTF8Encoding]::new($false))
```

Keep LF line endings in the prepared text. This guidance also lives in
[scripts/README.md](../../scripts/README.md#utf-8-without-a-byte-order-mark).
Microsoft's
[PowerShell encoding reference](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding?view=powershell-5.1)
documents the Windows PowerShell behavior.

## Tests and checks

| Check                                                               | Result                                                   |
| ------------------------------------------------------------------- | -------------------------------------------------------- |
| Raw-byte cleanup audit                                              | Passed for all 13 files, before commit and after rebase  |
| Full tracked-file UTF-8 BOM scan                                    | No remaining BOMs                                        |
| `npm test -- scripts/check-bom.test.ts scripts/lint/config.test.ts` | Passed, 2 files and 50 tests in 2.99 s                   |
| `node --check scripts/check-bom.mts`                                | Passed                                                   |
| `npm run typecheck`                                                 | Passed                                                   |
| ESLint on the four changed script/config files                      | Passed                                                   |
| `npm run format` and `npm run format:check`                         | Passed                                                   |
| Hosted full verify                                                  | Matching-head URL and final result in the review request |

The new lint probe first failed against the old config, then passed with the
rule. Scanner tests cover tracked Markdown/JSON, formatter ignores, Unicode and
spaced paths, untracked files, empty/short files, marks inside the body,
read-only behavior, CLI pass/fail exits, and Git enumeration failure. Full local
verify is not run under the current rule.

## Changed files

- The 13 byte-only cleanup files listed above.
- `scripts/lint/config.mts`, `scripts/lint/config.test.ts`
- `scripts/check-bom.mts`, `scripts/check-bom.test.ts`
- `package.json` (`format:check` only)
- `scripts/README.md`
- This document

## Review: lead

Pending.

## Review: reviewer

Pending.

## Verdicts (recorded by the lead at merge)

- Round 1 (f4eba7be): reviewer (Claude, trial-97) Approve: the cleanup touches
  exactly 13 files, each only losing its leading EF BB BF, and no tracked file
  has a BOM afterwards. Nit, as a small follow-up when devops is next asked:
  `scripts/check-bom.mts:7` checks only Markdown and JSON, and ESLint only what
  it lints; widen it to CSS, HTML, YAML, and SVG, or check every tracked text
  file. Lead Approve. Written by the Codex session that took over devops's work.
  Rebased by the lead onto local `main` without conflicts.
