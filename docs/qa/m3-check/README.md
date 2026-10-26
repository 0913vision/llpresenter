# M3 user check fixture

The [Korean user sheet](../m3-check.md) targets the upcoming `m3-check2` tag.
The [smoke report](smoke.md) currently records only `m3-check1`; a check2 retest
is required before the user runs it. This directory is added after check1, so
the sheet fetches these QA files separately from the app tag.

Copy `sample/` to a new user-data folder. Its root must contain `app.json`,
`bible/`, and `LoveLight/`. Set `LLP_USER_DATA` to that root. Never run against
the tracked fixture itself.

## Contents and reuse

- Six service rows: two headers, three songs, and one song slot. Source dialogs
  count four items because headers do not count as items.
- Three invented songs reused from the M2 fixture. Their service arrangements
  contain ten, five, and three slides. The first song's default library
  arrangement has six slides, independently of its ten-slide service choice.
- One template with the same six rows and an 11:00 time, used for the new
  service dialog. The initial service date is November 1, 2026.
- Five saved quick actions: song, invented Bible passage, one-minute countdown,
  clear-slide macro, and the currently unavailable black action.
- Screens use the app's starter IDs. Main and stage use window output without
  machine-specific monitor assignments. Main requests always on top; stage does
  not. Broadcast uses a 1920 x 1080 capture window. No outputs are enabled in
  the initial data. The app supplies its default Look and stage layout.
- `bible/sample.llbible` contains original Korean test sentences, explicitly
  labelled as **not Scripture** in the translation metadata and every sentence.
  Only John book positions exist, with 21 chapters, 36 positions in chapter 3,
  and eight positions in each other chapter. It exercises address parsing and
  display without shipping licensed translations. It is not a Bible dataset.
- `import/unplayable.webm` is intentionally plain text, kept outside the data
  sample. It tests decoder refusal when an import entry is available. It is
  never registered as media in the sample.

The media are the original procedural drawings created for the M2 fixture. No
downloaded material, copyrighted lyrics, personal information, machine paths,
logs, backups, crash state, or running timers are included.

| File under `sample/LoveLight/미디어/` | Format                      | Size            | Use                                       |
| ------------------------------------- | --------------------------- | --------------- | ----------------------------------------- |
| `새벽빛-반복.webm`                    | VP8, 1280 x 720, 12 seconds | 1,123,968 bytes | Silent looping blue and violet background |
| `노을.png`                            | PNG, 1920 x 1080            | 152,343 bytes   | Still sunset background                   |

Media paths are relative. First and second songs share the looping video; the
third uses the image. A quick song action leaves the current background
unchanged. Normal service-song activation uses the song or item background. The
copied runtime data will change during the check; keep it separate from the
fixture.

## Tagged baseline provenance

The first smoke used only code present at `m3-check1`. M3 as a whole is still in
progress in `docs/MILESTONES.md`; merged contracts do not establish that a
corresponding operator panel or renderer is mounted.

| Area in check1                                      | Merged review evidence                                                                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| New service sources, selection tree and create flow | [spec-48](../../reviews/spec-48.md), [spec-49](../../reviews/spec-49.md), [spec-50](../../reviews/spec-50.md)                      |
| Service memo, quick add and slot fill               | [ui-37](../../reviews/ui-37.md), [ui-38](../../reviews/ui-38.md), [ui-39](../../reviews/ui-39.md), [ui-40](../../reviews/ui-40.md) |
| Bible input, panel and saved quick rows             | [tools-2](../../reviews/tools-2.md), [tools-3](../../reviews/tools-3.md), [tools-4](../../reviews/tools-4.md)                      |
| Screen lists and monitor arrangement                | [screens-1](../../reviews/screens-1.md), [screens-3](../../reviews/screens-3.md)                                                   |
| Native number cards and always-on-top keeper        | [output-36](../../reviews/output-36.md), [output-37](../../reviews/output-37.md)                                                   |
| Media analysis backend                              | [data-52](../../reviews/data-52.md), [data-53](../../reviews/data-53.md)                                                           |

Quick rename/delete, screen properties, stage editor/rendering, and the media
view need a new inventory against the actual `m3-check2` tag. Their availability
is not inferred from a branch or a planned merge.
