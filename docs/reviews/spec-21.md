# Contract request: `spec-21`

- Team member: `spec`
- Branch: `feat/spec/bible-data`, from `main` at `a79e817`
- Task: `.llp/task.md`, M3-T4a Bible data
- Status: Waiting for the shared translation-file contract, before
  implementation
- Ownership exception: new `src/main/bible/` only

## Missing contract

`src/shared/schema/bible.ts` describes the installed-translation list and recent
passages in `bible.json`, with format `llsettings.bible`.
`src/shared/schema/biblePassage.ts` describes a passage's selection and display
options. Neither describes the `.llbible` text file required by
[spec 02, Bible translations](../spec/02-data.md#bible-translations).

The task explicitly requires stopping and reporting a missing shared contract.
No runtime implementation or shared-file changes have been made.

## Requested data-owned API

Suggested module: `src/shared/schema/bibleTranslation.ts`. Use the existing
`TranslationId`, `ReadonlyKnown`, `Result`, `LoadedFile`, and `FileError` types.
The shape below describes the known fields; retain unknown JSON fields using the
existing file-format conventions.

```ts
export type BibleTranslationFile = ReadonlyKnown<{
  format: 'llbible';
  schemaVersion: number;
  id: TranslationId;
  name: string;
  shortName: string;
  language: string;
  source: {
    title: string;
    publisher: string;
    url: string;
    license: string;
    retrieved: string;
  };
  books: Array<{
    id: number;
    chapters: string[][];
  }>;
}>;

export function parseBibleTranslation(
  text: string,
  file: string,
): Result<LoadedFile<BibleTranslationFile>, FileError>;
```

Required structural checks from spec 02:

- `format` is `llbible`; current `schemaVersion` is 1, with the common
  file-version and unknown-field handling.
- `id` is a nonblank lowercase translation identifier, retaining the existing
  `TranslationId` brand. Do not change the existing settings-file contract.
- `name` and `shortName` name the translation; `language` is a BCP 47 tag.
  Source fields carry the metadata in the spec, with `retrieved` a date in
  `YYYY-MM-DD` form.
- Book IDs are integers from 1 through 66 in strictly increasing order. Books
  may be absent, so a partial translation is valid.
- A book has an ordered array of chapters. Each chapter is a nonempty array of
  strings. An empty verse string is allowed for an omitted verse. Preserve verse
  text rather than trimming, renumbering, or otherwise rewriting it.

The main-side loader will also check that each book's chapter count equals the
66-book metadata assigned to `src/main/bible/`, and that verse strings already
have the required trimmed form. Keeping these checks in the loader avoids a
shared module depending on main-process metadata. It will skip a failed file and
emit one problem event using the existing `FileError` shape, and check installed
translation identities when assembling the collection.

No serializer or new IPC channel is requested: translations are read-only, and
this task can expose a main-side API and problem callback. Existing
`RecentPassage` supplies the recent-list entry shape.

## Remaining work after the contract merges

- Read-only asynchronous `.llbible` loading and invalid-file problem events.
- The 66-book metadata and copible-style name matching.
- Reference grammar, normalization, endpoint checks, and omitted verses.
- A bounded, deduplicated recent list using the existing settings shape.
- Invented-text tests, fast local checks, own-branch push, and fully green CI.

This is a contract request, not an implementation review request. No Bible text
was crawled or added, and no app window was started.
