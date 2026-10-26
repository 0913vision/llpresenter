# Prepare a chunked Bible translation

Run from the repository root with the existing development dependencies:

```sh
npm run bible:convert -- source-v1.llbible destination-v2.llbible
```

The command bundles a Node-only tool into the ignored
`.llp/bible-converter/main.mjs` and runs it. It does not start Electron or a web
server. `npm run bible:convert -- --help` prints the usage. Exit codes are 0 for
success/help, 1 for a conversion failure and 2 for invalid arguments.

The input must be a UTF-8 `.llbible` v1 JSON translation. The tool validates its
schema, metadata, canonical book/chapter counts and verse text. It writes the
approved v2 header and UTF-8 chapter blocks, preserving unknown metadata, verse
strings and empty omitted-verse slots. Offsets use actual UTF-8 byte lengths.
Header and chapter limits match the runtime reader.

Use a different source and destination. Same-path and existing hard-link or
symlink aliases are rejected. After validating the complete output index, the
tool writes a temporary file beside the destination, flushes and closes it, then
atomically renames it. A failed write preserves the previous destination. The
source is never rewritten. A missing destination folder is created.

Prepare translations before packaging an app update. The running app reads v2
files and offers no translation installation, removal or runtime conversion.
This command does not update `bible.json` or package translation assets.

Never commit Bible text, translation downloads or generated translation files.
Tests use invented sentences only. See `docs/spec/02-data.md`, Bible
translations, for the container contract.
