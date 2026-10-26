# M3 sample Bible v2 verification

M3-UX-02 is fixed for current main by converting the existing invented fixture
to the chunked v2 container. No sentence, omitted position or metadata was
added, removed or rewritten. This is QA material, not a translation of
Scripture.

The v1 source was copied to an ignored scratch file before conversion:

```sh
npm run bible:convert -- .llp/qa14-source-v1.llbible docs/qa/m3-check/sample/bible/sample.llbible
```

The [official converter](../../../scripts/bible/README.md) validated the source
and atomically replaced the destination. No app code or converter code changed.
The source snapshot was `cd8f44244ed5ec4abe6c0ca9df1b704b016e1d15`, app version
`0.17.0`. A later documentation rebase does not change this tested snapshot.

## Container preservation

An independent decoder read the little-endian prefix, JSON index and each
indexed UTF-8 chapter block. It compared every decoded array with the saved v1
source, checked contiguous byte offsets through the entire body, and compared
all metadata except the intentionally changed schema version and chapter index.

| Check                                              | Result                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| Container schema                                   | 2                                                                  |
| Translation ID                                     | `sample`, preserved                                                |
| Metadata, including original QA provenance/license | Preserved                                                          |
| Book positions                                     | One book, John                                                     |
| Chapters                                           | 21, preserved                                                      |
| Sentence positions                                 | 196, all arrays and strings exactly preserved                      |
| Indexed body                                       | 17,217 bytes, contiguous and complete                              |
| JSON header                                        | 1,209 bytes, after four-byte length prefix                         |
| Entire file                                        | 18,430 bytes                                                       |
| Source v1 SHA-256                                  | `02eeac06173db56a1cebe001a358a21bae15b2c9cf415288b0c0aae1a2415912` |
| Converted v2 SHA-256                               | `15feb20ed3f1b4cc44f97c2e0abd3b4b5a568756b7b51e14b4e3cd101627dd57` |

The complete source was already invented QA text. No downloaded Bible, external
repository, new wording or third-party lyrics were used.

## Hands-on check

On October 27, 2026, at approximately 02:08 KST, the current source was built
with `npm run build`. The newly converted tracked sample was copied to a fresh
ignored user-data folder. Nothing in that copy needed conversion or repair.
Electron ran with `LLP_TEST_WINDOWS=offscreen`, `LLP_DEV_PORT=5189`, a 1920 x
1080 control viewport and DPR 1. All native windows were hidden.

| Surface        | Steps                                                                      | Expected                                                                  | Observed                                                                                         |
| -------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 진행           | Type `요`, press Tab; replace the field with `요 3:16-18` and press Enter  | Complete the book name; accept the sample passage and display its slides  | `요한복음 ` completion; title `요한복음 3:16-18`; three slides; no unavailable-translation error |
| 준비           | Open 항목 추가, choose 성경 구절; type `요`, press Tab; enter `요 3:16-18` | Accept the same reference and offer the passage for insertion             | `요한복음 ` completion; matching menu item reports three verse positions                         |
| 준비 insertion | Choose the matching passage menu item                                      | Add the Bible item to the copied service                                  | The service list contains `요한복음 3:16-18`                                                     |
| Startup/exit   | Inspect the isolated log, then close normally                              | No Bible-container rejection; app exits with no own Electron process left | No skipped-translation or invalid-header error; exit code 0; remaining own processes 0           |

[진행 capture](evidence/bible-v2/show.png) and
[준비 capture](evidence/bible-v2/prep.png) show only the existing invented QA
sentences and reference controls. The
[structured result](evidence/bible-v2/result.json) records container checks and
UI outcomes without copying the sentence arrays.

The original smoke harness initially had an incorrectly escaped newline in its
inspection expression. It was corrected before recording results; that script
error was not an app failure. No native/physical monitor or audible-output
behavior is claimed by this fixture check.

## Historical check builds

Current main reads v2. Historical `m3-check1`, `m3-check2` and `m3-check3`
expect the old v1 JSON fixture. Their saved QA branch `docs/qa/m3-check` was
checked as v1 and was not changed. The old user sheet fetches that branch
explicitly, so its app-tag and sample pairing stays intact. Do not substitute
the current main sample when running those historical tags.

The original
[UX pass](https://github.com/0913vision/llpresenter/blob/6402db3baf14948cd6765c0f028b001dc93a3e21/docs/qa/m3-ux-pass.md)
remains a record of its pinned snapshot. This focused check closes its
sample-container finding; the full UX rerun waits for the other fixes to land on
main.
