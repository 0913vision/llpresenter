# Review request: `data-66`

- Team member: data
- Branch: `feat/data/bible-converter`
- Base commit: `61cbf9ed`, the head of `data-65`. The report supplies the final
  range, head and CI URL.
- Related decision: October 26, prepared chunked Bible translations delivered
  with app updates; specification `data-62` and reader `data-63` to `data-65`.

## What changed and why

This request adds the build-time v1 JSON to v2 container converter requested by
the user. Run
`npm run bible:convert -- source-v1.llbible destination-v2.llbible` from the
repository root. It uses the existing pinned Vite to bundle a Node entry into
ignored `.llp/bible-converter/main.mjs`, then runs that entry. No Electron
process or server starts and no dependency is added.

The encoder validates strict UTF-8, the legacy v1 schema and version, and each
chapter using the runtime block validator. It preserves metadata, including
unknown root/source/book fields and prototype-like data keys, original verse
strings and empty omitted-verse slots. Actual UTF-8 block lengths determine
relative offsets. The completed header passes runtime metadata, canonical
chapter-count, size and span validation before writing any destination bytes.

The file command rejects the same normalized path and existing physical file
aliases. It reuses `writeFileAtomically`: a temporary file in the destination
folder is written, flushed, closed and renamed with the existing Windows retry
policy. Failed validation, flush or rename preserves the previous destination
and source. CLI exit codes distinguish invalid arguments from conversion
failure. The README describes invocation and prepared-file handling.

This tool does not install translations or update `bible.json`. Prepared assets
and their settings entries arrive with an app update. Tests and manual checks
use invented text only; generated translation files and Bible texts are never
committed.

## Changes outside my paths

- `scripts/bible/`: devops owns scripts. The user explicitly assigned this
  converter to data. The directory holds the encoder, file command, CLI entry,
  Vite configuration, README and focused tests.
- `package.json`: one script exposes the converter using existing dependencies.
  No dependency or lockfile change is needed.

No runtime reader, renderer or IPC files are changed in this request.

## Checks

- Encoder, file command and CLI tests: 21 pass.
- Node TypeScript, changed-file ESLint, formatting and diff checks: final
  results in the report.
- `npm run bible:convert -- --help`: Node bundle and command pass, with no UI.
- Full `npm run verify`: GitHub CI on the request head; URL in report.

Coverage includes Unicode byte offsets, omitted slots, unknown fields, malformed
UTF-8/JSON, wrong versions and metadata, canonical chapter counts, size/text
limits, completed output readable by the runtime reader, flush-before-rename,
rename failure and retry recovery, flush failure, temporary cleanup, alias
rejection, source preservation, argument validation and exit codes.

## Team member's reply

1.
