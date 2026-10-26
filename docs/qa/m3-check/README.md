# M3 user check fixture

The [Korean user sheet](../m3-check.md) targets `m3-check2` at `ca4b745c`,
version `0.15.0`. The [smoke report](smoke.md) retains both tagged runs and the
known C2-1 output cleanup failure. These fixtures were added after the app tags,
so the sheet fetches QA files separately while preserving the app tag.

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

Check2 adds quick rename/delete/target submenus/reorder (tools-5/6), stage
rendering and stage controls (output-41 and tools-8), screen output preview,
media view and properties (data-54 through data-60), prep Bible quick add
(ui-41), service import and template save (spec-51/52), and the close disk-save
fix (data-61). Template/past-service rename/delete (spec-53) is after the tag.
Screen properties and the stage layout editor remain unmounted. Audio is not
wired to a window. Availability is based on the tag and recorded smoke.

## Optional physical display setup

`prepare-display.cjs` is a QA helper, not app implementation. It requires an
explicit copied `LLP_USER_DATA` and offscreen mode, rejects a repository-local
folder or a different initial service ID, and creates no BrowserWindow. Before
Electron is ready it points its own userData at that copy. It atomically updates
only the sample main screen, preserving other fields, to fullscreen with always
on top on the first non-primary display. With one display it changes nothing.
The sheet clears offscreen mode before the user's actual app run.

This bridges the unmounted screen-properties UI for the user's real second
screen/stacking check. QA syntax, ESLint, and an isolated-copy helper run
passed; the physical fullscreen picture, native stacking and monitor cards are
user checks. The default tracked fixture stays portable and uses no monitor IDs.
