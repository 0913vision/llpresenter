# 02. Data and files

This document defines the format, location, and save rules for everything the
app stores. Field names are the names used in the JSON. Fields that appear in
the source samples keep their names. Fields that the sources don't show are
marked as proposals.

Terms: 슬라이드 (slide), 예배 순서 (service order), 틀 (template), 구성
(arrangement), 이름표 (label), 라이브러리 (library), 매크로 (macro), 소품
(prop), 공지 (notice), 메시지 (message), 타이머 (timer), 퀵 실행 (quick launch),
본 화면 (main screen), 무대 화면 (stage screen), 방송 자막 (broadcast captions).
See 01 for the full list.

## Common rules

| Rule           | Requirement                                                                                                                                                                                                                     | Source                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Encoding       | Files are UTF-8 JSON without a byte order mark. The chapter-based Bible container has the framing defined under "Bible translations".                                                                                           | `Main` song file sample; user decision, 2026-10-26               |
| Header fields  | Each file's JSON header declares `format` (the file type) and `schemaVersion`. Most formats use version 1; the chapter-based Bible container uses version 2 and the prefix defined below.                                       | `Main` samples; user decision, 2026-10-26                        |
| IDs            | Songs, 예배 순서, 틀, media, screens, Looks, lyric styles, stage layouts, 매크로, collections, 퀵 실행 items, 메시지 templates, 공지 sets, 소품, 타이머, and 예배 순서 items have a UUID v4 ID in lowercase. Never reuse an ID. | `Main` samples (song and media IDs). The rest is a proposal.     |
| Unknown fields | When you read a file, keep every unknown field in memory and write it back unchanged. This also applies to nested objects (슬라이드, 구성, items).                                                                              | `Main` song file notes, product log 2026-10-24 (room for scores) |
| Dates          | A service date is local time without a time zone, `YYYY-MM-DDTHH:mm`. Record timestamps such as `updatedAt` are ISO 8601 with a time zone offset (proposal).                                                                    | `Main` service sample                                            |
| Paths          | Song and service files never contain file paths. They refer to media by ID only. File paths exist only in the media list.                                                                                                       | `Main` song file notes                                           |
| Line endings   | Files use LF line endings (proposal).                                                                                                                                                                                           |                                                                  |

## Folder layout (proposal)

Keep user data in the Documents folder, where the user can find and back it up.
Keep data that only makes sense on this computer in the app data folder.

```
Documents\LoveLight\                 data folder (default)
  곡\<song ID>.llsong                 location can change in 환경설정 > 라이브러리 > 위치 > 곡
  미디어\                             imported media files; location can change in 환경설정 > 라이브러리 > 위치 > 미디어
  예배\<service ID>.llservice
  틀\<template ID>.llservice
  설정\                               app-wide settings and the media list
  .복구 사본\                         previous versions of each file

%APPDATA%\LoveLight Presenter\       app data folder
  app.json                           data folder, song, media, and backup locations, window layout
  recovery\live.json                 recovery record
  recovery\session.lock              clean-exit marker
  bible\                             Bible translation files
  cache\                             thumbnails, media durations, and other data you can rebuild
  logs\                              log files
```

- Name each file by its ID. Then a title change or a duplicate title never
  changes a file name (proposal).
- If `LLP_USER_DATA` is set for development, put both the app data folder and
  the data folder under it. This keeps several development sessions from sharing
  one Documents folder. See `docs/WORKFLOW.md`.
- When the operator changes the 곡 (songs) or 미디어 (media) location in
  환경설정 (Preferences), read the new folder. Don't move existing files
  (proposal).

Source: `Prefs` (라이브러리 > 위치: 곡, 미디어, 백업 위치), `Main` notes on song
and service files. The folder names and the rest are proposals.

## Song file (`.llsong`)

Each song is one file. Version 2 uses named groups (user decision, 2026-10-27).
This replaces version 1's slide-number arrangements.

```json
{
  "format": "llsong",
  "schemaVersion": 2,
  "id": "00000000-0000-4000-8000-000000000001",
  "title": "Invented song",
  "groups": [
    {
      "id": "00000000-0000-4000-8000-000000000002",
      "name": "1절",
      "slides": [{"lines": ["Invented first line"]}]
    },
    {
      "id": "00000000-0000-4000-8000-000000000003",
      "name": "후렴",
      "slides": [{"lines": ["Invented second line"]}]
    }
  ],
  "arrangements": [
    {
      "name": "주일용",
      "groups": [
        "00000000-0000-4000-8000-000000000002",
        "00000000-0000-4000-8000-000000000003",
        "00000000-0000-4000-8000-000000000003"
      ]
    }
  ]
}
```

| Field                      | Type                        | Required | Meaning                                                                                                                                    |
| -------------------------- | --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `format`                   | `"llsong"`                  | Yes      | File type.                                                                                                                                 |
| `schemaVersion`            | Integer                     | Yes      | 2 for grouped songs.                                                                                                                       |
| `id`                       | String (UUID)               | Yes      | Song ID. A 예배 순서 points to the song with this value.                                                                                   |
| `title`                    | String                      | Yes      | Title. It can't be empty. Titles are unique in the 라이브러리 (proposal, see 05).                                                          |
| `background`               | String (media ID) or absent | No       | Default background. If absent, outputting the song doesn't change the background (see 03).                                                 |
| `groups`                   | Nonempty array              | Yes      | Groups in master order. Each slide belongs to exactly one group.                                                                           |
| `groups[].id`              | String (UUID v4)            | Yes      | Stable group ID, unique within the song. References use IDs, not names or positions.                                                       |
| `groups[].name`            | String                      | Yes      | Group name, such as 1절 or 후렴. Names may repeat; `""` means unnamed.                                                                     |
| `groups[].slides`          | Nonempty array              | Yes      | This group's slides in their source order. Lyrics are stored once, even when a group repeats in a 구성.                                    |
| `groups[].slides[].lines`  | Array of strings            | Yes      | Exact slide lines. An empty array is a blank slide.                                                                                        |
| `groups[].slides[].hotKey` | String or absent            | No       | Physical `KeyboardEvent.code`: `KeyA`..`KeyZ` or `Digit0`..`Digit9`. Absent means unassigned. Unique among all source slides in this song. |
| `arrangements`             | Array                       | No       | Named 구성. If absent, the song has only the default 구성.                                                                                 |
| `arrangements[].name`      | String                      | Yes      | 구성 name. Unique within the song. "기본" (default) is reserved (proposal).                                                                |
| `arrangements[].groups`    | Array of group IDs          | Yes      | Group occurrences in playback order. Repeated IDs repeat the whole group. All IDs must exist in this song.                                 |
| `updatedAt`                | String (ISO 8601)           | No       | Time of the last edit (proposal). The duplicate title dialog uses it ("10월 20일 수정", edited October 20).                                |

Rules:

- Don't store the default 구성. It expands every group once in file order.
- A 구성 belongs to the song, not to any service. A 예배 순서 item picks a 구성
  by name.
- Don't store 이름표 colors or jump keys in the song file. See the 이름표 list.
- Editing or splitting a slide changes its group's source slides. Every
  occurrence uses the updated group, without rewriting positional references. A
  new slide stays in the active group. Deleting the last slide deletes the group
  and removes its occurrences; keep at least one group and one slide.
- Moving or renaming a group keeps its ID and all arrangement references.
  Explicitly splitting a group replaces every occurrence with its parts in
  order. Backspace merges slides only within one group. At the first slide of
  any group it does nothing, leaving lyrics, group IDs and all arrangements
  unchanged. Show the reason in a tooltip: 그룹 경계에서는 슬라이드를 합칠 수
  없습니다. This applies even when the adjacent groups have the same name.
  Whole-group references cannot represent every cross-group slide merge. See the
  [October 26 split/merge decision](../decisions.md#2026-10-26-a-구성-never-loses-lyrics-through-a-split-or-merge).
- For adjacent single-slide groups A and B, cross-boundary Backspace leaves
  separate arrangements `[A]` and `[B]` unchanged, leaves reversed `[B, A]`
  unchanged, and leaves repeated `[A, B, A, B]` unchanged. No special-case merge
  is attempted for the repeated pairs. Within a group C, merging two source
  slides changes C's source once and every `[C, C]` occurrence uses the
  resulting slide. It does not remove either occurrence.
- An empty named arrangement remains stored and plays the default order, as in
  version 1. A missing arrangement name also falls back to the default.
- Keep unknown fields on songs, groups, slides and arrangements.
- A slide hot key identifies that source slide, independently of its group name
  or palette label. Repeating a group does not create another assignment.
  Duplicate codes on different source slides, within or across groups, are
  refused. Do not store null, display characters, modifiers or numpad codes.
- A grouped 진행 tile carries optional `hotKey` and
  `sourceSlide: {songId, groupId, slideIndex}`. `slideIndex` is zero-based
  within that group's source slides, at the projected revision. Assigned tiles
  require their source identity. All repeated occurrences retain the same
  identity and key. Resolve a key to the first matching occurrence in the
  selected arrangement's tile order, with no cycling based on the current/live
  cursor. If that source is omitted, the key has no target in this projection.
  Legacy tiles without this metadata remain accepted during the format rollout.
- `SONG_GROUP_LIMITS` caps a song at 10,000 source slides, 10,000 groups, 1,000
  named arrangements and 100,000 total stored group occurrences across all
  arrangements. Reject an oversized file without truncation. These limits also
  apply after migration; source slides are counted once, not once per
  arrangement occurrence. Consumers must iterate repeated groups without
  allocating an unbounded expanded song.

### Version 1 migration

Validate the complete version 1 file before converting it. A malformed number,
missing slide or invalid arrangement must fail validation, not disappear.

1. Partition the source slides into maximal adjacent runs with the same `label`.
   Absent and empty labels both mean unnamed. Nonadjacent runs with the same
   name remain different groups.
2. In every stored arrangement, partition its slide numbers into maximal
   increasing consecutive stretches. For each stretch, mark a cut before its
   first source slide and after its last. Combine the cuts from all arrangements
   with the original run boundaries. Empty arrangements add no cuts.
3. Split each run at those cuts. Give each resulting group a new UUID v4 and the
   run's name. Keep the source slide order. Consume each slide's known `label`
   into the group name and retain all its other fields, including unknown nested
   values.
4. Replace each arrangement stretch with the IDs of the groups it covers, in
   order. Keep repeated occurrences and arrangement names. Expanding each
   migrated arrangement must produce exactly its old slide-number sequence; the
   default must also remain identical.

For example, source slides 1..3 all named 1절 and arrangement `[3, 1, 2]`
produce groups A = `[1, 2]` and B = `[3]`, with arrangement `[B, A]`.
Arrangement `[1, 2, 2, 3]` cuts that run into three groups and becomes
`[A, B, B, C]`. Cuts required by any arrangement apply to the whole song.
Migration never duplicates lyric objects or merges nonadjacent groups.

Unknown fields retain their original paths except when a version 1 unknown
`groups` field occupies a newly defined key on the song or an arrangement. In
that case preserve its original value under that object's `legacyV1.groups`. If
`legacyV1` already exists, preserve its entire original value under the new
`legacyV1.legacyV1` before adding the archived fields. Never overwrite unknown
data. Known version 1 `slides` fields are consumed by the conversion.

The new `hotKey` field was unknown in version 1. Archive any such old slide
value under `legacyV1.hotKey`, using the same collision rule for an existing
`legacyV1`, and leave its assignment absent. Do not interpret an extension's old
value as a new key assignment or reject an otherwise valid old song because that
value is not a physical code. Version 2 keys are validated normally.

Convert in memory on read. Keep the original file until the first successful
edit save, with the normal pre-migration recovery copy. New grouped writes use
version 2. The data schema/migration API lands first; activating it in the store
and IPC waits until editor, grid, chip and live consumers accept groups. During
that transition the existing version 1 entry points stay active and must not
write a grouped file through an old editor. This is a rollout rule, not a second
permanent song format.

Source: October 27 user decision and Renewed Vision's
[Using Groups and Arrangements](https://support.renewedvision.com/hc/en-us/articles/360041809973-Using-Groups-and-Arrangements-for-Presentation-Organization),
checked October 27. The source establishes group tokens and arrangements; the
JSON shape, migration and rollout rules are this app's contract.

## Service file (`.llservice`)

Each 예배 순서 is one file. It holds only items. It doesn't hold screens, Looks,
매크로, or other settings.

```json
{
  "format": "llservice",
  "schemaVersion": 1,
  "id": "a41e...",
  "name": "주일 예배",
  "date": "2026-11-01T11:00",
  "order": [
    {"id": "...", "header": "찬양"},
    {
      "id": "...",
      "song": "6f1c2a9e-...",
      "arrangement": "주일용",
      "background": "3b9d0c52-...",
      "macro": "찬양",
      "memo": ""
    },
    {"id": "...", "header": "헌금"}
  ]
}
```

| Field           | Type                      | Required       | Meaning                                                             |
| --------------- | ------------------------- | -------------- | ------------------------------------------------------------------- |
| `format`        | `"llservice"`             | Yes            | File type.                                                          |
| `schemaVersion` | Integer                   | Yes            | 1 in version 1.                                                     |
| `id`            | String (UUID)             | Yes (proposal) | Service ID. "Open the last service" and the recovery record use it. |
| `name`          | String                    | Yes            | Service name.                                                       |
| `date`          | String `YYYY-MM-DDTHH:mm` | Yes            | Service date and time.                                              |
| `order`         | Array                     | Yes            | The items, in the order they show.                                  |

### Items

Each item has exactly one of the kind keys below. Every item has an `id`
(proposal). When you copy items from another service or from a 틀, give them new
item IDs (proposal).

| Kind           | Kind key                    | Other fields                                 | Source                                                                   |
| -------------- | --------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| Section (구역) | `header`: name              | None                                         | User decision, October 26 check; `ShowH` (예배 전, 찬양, 말씀, 마무리)   |
| Song           | `song`: song ID             | `arrangement`, `background`, `macro`, `memo` | `Main` sample, `PrepService`                                             |
| Bible passage  | `bible`: object (see below) | `macro`, `memo` (proposal)                   | `AddSongsQuick`, `ShowH`, `Bible`. The format is a proposal.             |
| Media          | `media`: media ID           | `macro`, `memo` (proposal)                   | `AddSongsQuick`, `ShowH` (예배 전 카운트다운). The format is a proposal. |
| 공지           | `notice`: 공지 set ID       | `macro`, `memo` (proposal)                   | `AddSongsQuick`, `ShowH` (주일 광고). The format is a proposal.          |

Keep an item with an unknown kind key unchanged. Show it as a row with a warning
icon, and don't let the operator output it (proposal).

### Song item fields

| Field         | Type              | Required | Meaning                                                                                                                                                                                                         |
| ------------- | ----------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `song`        | String (song ID)  | Yes      | The 라이브러리 song.                                                                                                                                                                                            |
| `arrangement` | String            | No       | The chosen 구성 name. If absent, or if the song has no 구성 with that name, the item uses the default 구성.                                                                                                     |
| `background`  | String (media ID) | No       | Background override for this service. If absent, the item uses the song's default background.                                                                                                                   |
| `macro`       | String            | No       | The 매크로 to run when the item starts. The source sample shows a 매크로 name ("찬양"). Version 1 stores the 매크로 ID (proposal, open question). When you read a value that matches no ID, look it up by name. |
| `memo`        | String            | No       | Memo. Can have several lines.                                                                                                                                                                                   |

### Bible passage object (proposal)

| Field             | Type                               | Meaning                                                                                                                           |
| ----------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `translation`     | String (translation ID)            | Translation.                                                                                                                      |
| `ref`             | String                             | Normalized reference, for example "요한복음 3:16-18".                                                                             |
| `split`           | `"verse"` \| `"two"` \| `"fit"`    | 나누기 (split): 한 슬라이드에 한 절 (one verse per 슬라이드), 두 절씩 (two verses), 길이에 맞춤 (fit to length).                  |
| `reference`       | `"every"` \| `"first"` \| `"none"` | Where the reference shows: every 슬라이드, first 슬라이드 only, or nowhere. The board shows only "슬라이드마다" (every 슬라이드). |
| `verseNumbers`    | Boolean                            | 절 번호 (verse numbers).                                                                                                          |
| `translationName` | Boolean                            | 역본 이름 (translation name).                                                                                                     |

### Sections and legacy slot items

- The user-facing row is a 구역 (section). Its stored kind key remains `header`,
  with the section's name as the value.
- A section groups the following items until the next section. It may have no
  items. Keep empty sections, including consecutive sections and a final empty
  section, when reading, editing, copying, and saving a service or template.
- The operator can add and remove sections freely. 구역 추가 creates a row named
  새 구역 in rename mode. 항목 추가 inserts content into the selected section,
  including an empty section. See 04 and 05.
- Slot is no longer an item kind. On reading an existing service or template,
  normalize each legacy slot item into a section row with its `title` as
  `header`. Keep its id, order position, and unknown fields; remove the consumed
  `slot` and `title` fields. The conversion adds no song, passage, or other
  content item. New writes contain section rows rather than slot items.
- For example, a legacy item
  `{"id":"...","slot":"song","title":"헌금","future":{"keep":true}}` reads as
  `{"id":"...","header":"헌금","future":{"keep":true}}`. Legacy `bible` and
  `slides` slots follow the same rule. The stored `header` key is unchanged by
  the UI terminology change.

Source: the user's October 26 check decision, recorded under
[Decisions from the m3-check3 user check](../decisions.md#2026-10-26-decisions-from-the-m3-check3-user-check).
It replaces the slot behavior in the earlier service samples and draft boards.

## Templates

- A 틀 uses the service file format (`format: "llservice"`). Store it in the
  `틀\` folder of the data folder (proposal).
- A 틀 has no `date`. It can have a `time` (`HH:mm`) that sets the default time
  of a new service (proposal).
- A 틀 holds empty sections where content will be added later. Empty sections
  stay in its order and in the 새 예배 source tree. It can also hold content
  such as songs, media, and 공지. For example, the `NewService` board shows 예배
  전 카운트다운, 주일 광고, and 축도 in a 틀. It has no slot items.

Source: `Main` service notes (same file format), `NewService`, and the
[October 26 user check decision](../decisions.md#2026-10-26-decisions-from-the-m3-check3-user-check)
(empty sections replace slot items).

## App-wide settings

Split the app-wide settings into one JSON file per area (proposal). If one file
breaks, the other areas still work. File names and `format` values (proposal):

| File (in the data folder `설정\`) | `format`                 | Content                                    |
| --------------------------------- | ------------------------ | ------------------------------------------ |
| `screens.json`                    | `llsettings.screens`     | Screens                                    |
| `looks.json`                      | `llsettings.looks`       | Looks, lyric styles, the current Look      |
| `stage-layouts.json`              | `llsettings.stage`       | Stage layouts                              |
| `macros.json`                     | `llsettings.macros`      | 매크로 and collections                     |
| `quick.json`                      | `llsettings.quick`       | 퀵 실행 items                              |
| `messages.json`                   | `llsettings.messages`    | 메시지 templates and stage message presets |
| `notices.json`                    | `llsettings.notices`     | 공지 sets                                  |
| `props.json`                      | `llsettings.props`       | 소품                                       |
| `timers.json`                     | `llsettings.timers`      | 타이머                                     |
| `labels.json`                     | `llsettings.labels`      | 이름표 list                                |
| `preferences.json`                | `llsettings.preferences` | 환경설정                                   |
| `shortcuts.json`                  | `llsettings.shortcuts`   | Changed shortcuts                          |
| `bible.json`                      | `llsettings.bible`       | Installed translations, recent passages    |
| `media.json`                      | `llmedia`                | Media list                                 |

On first launch, create any missing file with its defaults (proposal where the
sections below don't say otherwise):

| File                 | Defaults                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `screens.json`       | See "Screens" below.                                                                                                                                    |
| `looks.json`         | See "Looks and lyric styles" below.                                                                                                                     |
| `stage-layouts.json` | See "Stage layouts" below.                                                                                                                              |
| `macros.json`        | No 매크로 and no collections. 모든 매크로 isn't stored; it always shows every 매크로 (07).                                                              |
| `quick.json`         | One item, 검은 화면 (`"black"`).                                                                                                                        |
| `messages.json`      | No templates. `stagePresets` holds the seven presets of the 무대 tab: 후렴 한 번 더, 마지막 후렴, 처음부터, 천천히, 조금 빠르게, 5분 남음, 마무리 (04). |
| `notices.json`       | No sets.                                                                                                                                                |
| `props.json`         | No 소품. The 검은 화면 is built in and isn't stored here (04).                                                                                          |
| `timers.json`        | No 타이머.                                                                                                                                              |
| `labels.json`        | See "이름표 list" below.                                                                                                                                |
| `preferences.json`   | The values in the table below. For the import options: `"blankLine"`, `"bracketLine"`, `"title"`, and `"auto"`, as the UI names show.                   |
| `shortcuts.json`     | No bindings: every command uses its default key (10).                                                                                                   |
| `bible.json`         | The two bundled translations, 개역한글 (`default: true`) and KJV, and no recent passages.                                                               |
| `media.json`         | No media and no playlists.                                                                                                                              |

`app.json` starts with `dataRoot` set to the default data folder, empty
locations (the defaults), and no other fields.

### Screens (`screens.json`)

| Field                | Type                                                   | Meaning                                                                                                                                                                                   | Source                                                                   |
| -------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `screens[]`          | Array                                                  | The screens, in list order within the 청중 (audience) and 무대 (stage) groups.                                                                                                            | `Screens`                                                                |
| `.id`                | String                                                 | Screen ID.                                                                                                                                                                                | Proposal                                                                 |
| `.name`              | String                                                 | Name, for example "본 화면".                                                                                                                                                              | `Screens` property 이름 (name)                                           |
| `.kind`              | `"audience"` \| `"stage"`                              | 종류 (kind): 청중 (audience) or 무대 (stage).                                                                                                                                             | `Screens` property 종류                                                  |
| `.method`            | `"fullscreen"` \| `"window"` \| `"capture"` \| `"ndi"` | 방식 (method): 전체 화면 (full screen), 창 (window), 캡처용 창 (capture window), NDI. `"ndi"` comes later. If version 1 reads `"ndi"`, it runs the screen as a capture window (proposal). | `Screens`, `ScreensNDI`                                                  |
| `.display`           | Object or absent                                       | The target monitor for full screen: `{ id, name, number, bounds: { x, y, width, height }, scaleFactor }`. The app uses these values to find the monitor again (see 03).                   | `Screens` property 장치 (device), display layout. Fields are a proposal. |
| `.resolution`        | `{ width, height }`                                    | Size of the capture window. Full screen always uses the monitor's resolution (proposal).                                                                                                  | `Screens` property 해상도 (resolution)                                   |
| `.onDisconnect`      | `"window"` \| `"off"`                                  | 연결이 끊기면 (when disconnected): 창으로 바꾸기 (switch to a window) or turn the output off. `"off"` is a proposal.                                                                      | `Screens`                                                                |
| `.alwaysOnTop`       | Boolean                                                | 항상 위 (always on top).                                                                                                                                                                  | `Screens`                                                                |
| `.preventSleep`      | Boolean                                                | 절전 막기 (prevent sleep).                                                                                                                                                                | `Screens`                                                                |
| `.edgeMargin`        | Number (%)                                             | 가장자리 여백 (edge margin).                                                                                                                                                              | `Screens` 보정 (correction) group                                        |
| `.offset`            | `{ x, y }` (px)                                        | 위치 미세 조정 (position fine-tuning).                                                                                                                                                    | `Screens` 보정 group                                                     |
| `.previewBackground` | `"green"` \| `"black"` \| `"checker"`                  | Background of the in-app preview of the 방송 자막. Default `"green"`.                                                                                                                     | `ScreensNDI`, product log version 56                                     |
| `.ndi`               | Object                                                 | NDI settings, later (see 09): `sourceName`, `resolution`, `fps`, `alpha`, `networkInterface`, `group`.                                                                                    | `ScreensNDI`                                                             |

Defaults: 본 화면 (audience, full screen), 방송 자막 (audience, capture window,
1920 x 1080), 무대 화면 (stage, full screen). Full screen monitors start
unassigned (proposal).

Don't save whether a screen output is on. At launch, the 환경설정 option 켤 때
화면 출력 (output on launch) decides. See 03.

### Looks and lyric styles (`looks.json`)

| Field           | Type                             | Meaning                                                                                                  | Source                            |
| --------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `current`       | String (Look ID)                 | The current Look. Save it on every change, and start with it on the next launch (proposal).              | `ShowH` toolbar Look button       |
| `looks[]`       | Array                            | The Looks.                                                                                               | `Looks`                           |
| `.id`, `.name`  | String                           | Look ID and name, for example 평상시 (normal), 설교 (sermon), 광고 (announcements), 영상만 (video only). | `Looks`                           |
| `.screens`      | Object: screen ID to screen Look | The settings for each screen.                                                                            | `Looks` screen cards              |
| `lyricStyles[]` | Array                            | Lyric styles, for example 기본 (default), 현재와 다음 (current and next), 하단 자막 (lower third).       | `Looks` 가사 스타일 (lyric style) |

Screen Look:

| Field                 | Type                                                               | Meaning                                                                                                 | Source                                                   |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `layers.media`        | Boolean                                                            | Show the background media layer.                                                                        | `Looks`                                                  |
| `layers.slide`        | Boolean                                                            | Show the lyrics layer.                                                                                  | `Looks`                                                  |
| `layers.notice`       | Boolean                                                            | Show the 공지 layer.                                                                                    | `Looks`                                                  |
| `layers.prop`         | Boolean                                                            | Show the 소품 layer.                                                                                    | `Looks`                                                  |
| `layers.message`      | Boolean                                                            | Show the 메시지 layer.                                                                                  | `Looks`                                                  |
| `layers.clock`        | Boolean                                                            | Clock (무대 화면).                                                                                      | `Looks` 무대 화면 card                                   |
| `layers.stageMessage` | Boolean                                                            | Stage message (무대 화면).                                                                              | `Looks` 무대 화면 card                                   |
| `lyricStyle`          | String (lyric style ID)                                            | The lyric style of an audience screen.                                                                  | `Looks` 가사 (lyrics) select                             |
| `stageLayout`         | String (stage layout ID)                                           | The stage layout of the 무대 화면 (proposal, see the stage layout rule in 03).                          | `Looks` 무대 화면 card, "가사: 현재와 다음"              |
| `background`          | `{ "kind": "media" }` \| `{ "kind": "color", "color": "#RRGGBB" }` | Whether the background layer shows media or a solid color. The 방송 자막 default is the `chroma` green. | `Looks` 방송 자막 card, "배경: 초록" (background: green) |

Lyric style:

| Field        | Type                                | Meaning                                                                                    | Source                    |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------- |
| `id`, `name` | String                              | ID and name.                                                                               | `Looks`                   |
| `font`       | String                              | Font family, for example Pretendard.                                                       | `Looks` 글꼴 (font)       |
| `weight`     | Number                              | Font weight, for example 700.                                                              | `Looks` "Pretendard Bold" |
| `color`      | `#RRGGBB`                           | Text color.                                                                                | `Looks` 글자색            |
| `size`       | Number (px)                         | Size in px on a 1920 x 1080 screen. The app scales it to the screen resolution (proposal). | `Looks` 크기 84           |
| `lineHeight` | Number                              | Line spacing, for example 1.4.                                                             | `Looks` 줄 간격           |
| `align`      | `"left"` \| `"center"`              | Horizontal alignment.                                                                      | `Looks` 가로 정렬         |
| `vAlign`     | `"top"` \| `"middle"` \| `"bottom"` | Vertical position.                                                                         | `Looks` 세로 위치         |
| `maxLines`   | Integer                             | Maximum lines (see the rule in 03).                                                        | `Looks` 최대 줄 수        |
| `margin`     | Number (%)                          | Margin.                                                                                    | `Looks` 여백              |
| `shadow`     | Boolean                             | Shadow.                                                                                    | `Looks` 그림자            |
| `outline`    | Boolean                             | Outline.                                                                                   | `Looks` 외곽선            |

Defaults (proposal): one Look, 평상시. The 본 화면 shows background media,
lyrics (기본), 소품, and 메시지, and hides 공지. The 무대 화면 shows lyrics
(현재와 다음), the clock, and the stage message, and hides background media and
메시지. The 방송 자막 shows the background (green) and lyrics (하단 자막), and
hides 공지, 소품, and 메시지. These values copy the 평상시 Look from the `Looks`
board.

### Stage layouts (`stage-layouts.json`)

| Field               | Type                                                                                                                 | Meaning                                                                                                                           | Source                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layouts[]`         | Array                                                                                                                | Stage layouts, for example 현재와 다음, 가사만 (lyrics only), 설교 타이머 (sermon timer), 큰 메시지 (large message).              | `StageEditor`                                                                                                                                               |
| `.id`, `.name`      | String                                                                                                               | ID and name.                                                                                                                      | `StageEditor`                                                                                                                                               |
| `.width`, `.height` | Integer                                                                                                              | Layout canvas size, 1920 x 1080.                                                                                                  | `StageEditor`                                                                                                                                               |
| `.elements[]`       | Array                                                                                                                | Elements.                                                                                                                         | `StageEditor`                                                                                                                                               |
| `..id`, `..name`    | String                                                                                                               | Element ID and name, for example 현재 가사 (current lyrics).                                                                      | `StageEditor` 이름 (name)                                                                                                                                   |
| `..kind`            | `"currentSlide"` \| `"nextSlide"` \| `"currentLabel"` \| `"nextLabel"` \| `"clock"` \| `"timer"` \| `"stageMessage"` | Content kind.                                                                                                                     | `Main` board guide (current lyrics, next lyrics, 이름표, clock, 타이머, stage message), `StageEditor` 내용 종류 (content kind). Value names are a proposal. |
| `..show`            | `"text"` \| `"image"` \| `"memo"`                                                                                    | 보여 줄 것 (what to show): 글자 (text), 그림 (image), 메모 (memo). 슬라이드 elements only.                                        | `StageEditor`                                                                                                                                               |
| `..frame`           | `{ x, y, w, h }`                                                                                                     | Position and size in canvas pixels.                                                                                               | `StageEditor` X, Y, W, H                                                                                                                                    |
| `..text`            | Object                                                                                                               | `font`, `weight`, `size`, `color`, `align`, `vAlign`, `lineHeight`, `autoFit`.                                                    | `StageEditor` 글자 (text) tab                                                                                                                               |
| `..box`             | Object                                                                                                               | Values of the 모양 (appearance) tab, for example `background` and `opacity` (proposal). The board doesn't show the tab's content. | `StageEditor` 모양 tab                                                                                                                                      |

Default: one layout, 현재와 다음, with the current 이름표, current lyrics,
clock, 타이머, next 이름표, next lyrics, and stage message. Element positions
follow the `StageEditor` board.

### 매크로 (`macros.json`)

| Field           | Type                                                                                                 | Meaning                                                                   | Source                                    |
| --------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------- |
| `macros[]`      | Array                                                                                                | The 매크로.                                                               | `Macros`                                  |
| `.id`, `.name`  | String                                                                                               | ID and name, for example 예배 시작 (service start) or 찬양 (praise).      | `Macros`                                  |
| `.icon`         | String                                                                                               | Icon key from the design system icon list.                                | `Macros` 아이콘 바꾸기 (change icon)      |
| `.color`        | `"teal"` \| `"green"` \| `"yellow"` \| `"orange"` \| `"rose"` \| `"violet"` \| `"slate"` \| `"gray"` | Tile color. There is no "none".                                           | `Macros` 색 (color), `MacroTile` README   |
| `.actions[]`    | Array                                                                                                | Actions (see the action kinds in 07).                                     | `Macros` list view "동작 4개" (4 actions) |
| `.runOnStartup` | Boolean                                                                                              | 시작할 때 실행 (run at startup). See 07, open question.                   | `Macros` right-click menu                 |
| `.schedule`     | Object or absent                                                                                     | Run at a set time. See 07, open question. No board shows where to set it. | `MacroTile` README (schedule badge)       |
| `collections[]` | Array                                                                                                | Collections: `id`, `name`, `macroIds[]`.                                  | `Macros` collection 주일 예배             |

### 퀵 실행 (`quick.json`)

| Field          | Type                                                                     | Meaning                                                                                                                 | Source                                                                                                        |
| -------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `items[]`      | Array                                                                    | The 퀵 실행 items, in display order.                                                                                    | `ShowH`                                                                                                       |
| `.id`, `.name` | String                                                                   | ID and display name.                                                                                                    | `ShowH`                                                                                                       |
| `.kind`        | `"song"` \| `"bible"` \| `"prop"` \| `"timer"` \| `"macro"` \| `"black"` | Kind (see 04).                                                                                                          | `ShowH` (verse, song, 검은 화면, 로고 화면, 시작 카운트다운, 축도). Value names and `"macro"` are a proposal. |
| `.ref`         | String or object                                                         | What the item points to: a song ID, a Bible passage object, a 소품 ID, a 타이머 ID, or a 매크로 ID. `"black"` has none. | Proposal                                                                                                      |

Version 1 has no 퀵 실행 shortcuts (see 09).

A newly added `timer` item creates its own timer in `timers.json` and saves that
timer's ID in `.ref`. Two quick rows never share that ID. Adding the timer and
its row is one applied edit: a refusal creates neither; a persistence failure
keeps the applied pair in memory and uses the existing save retry mechanism.
Renaming a timer row updates its `.name` and the referenced timer's `.name`
together. Other quick item names remain independent (user decision, October 26).

When older quick rows share a timer ID, keep that timer's ID for the first row
and give each later row a copy with a new timer ID before those rows can run.
Copy its configuration and unknown fields, and retain the original quick row's
ID, name and position. Stage picks and other references to the original timer
keep that ID. Each resulting timer starts stopped on launch, as before.

Separation copies each definition's original kind and settings, including a
legacy `countdownTo` time/date, `elapsedFrom` reference time, or `clock`. It
does not invent a duration or convert those records. Their quick display and
click behavior is defined by kind in 04. The original definition and references
from stage selections and prop tokens keep their IDs and meaning.

### 메시지 templates and stage message presets (`messages.json`)

| Field            | Type                                        | Meaning                                                                                                   | Source                                                 |
| ---------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `templates[]`    | Array                                       | 메시지 templates, for example 차량 이동 (move your car), 영아부 호출 (nursery call), 자리 안내 (seating). | `Overlays` 메시지 tab                                  |
| `.id`, `.name`   | String                                      | ID and name.                                                                                              | `Overlays`                                             |
| `.icon`          | `"msg"` \| `"user"`                         | List icon.                                                                                                | `Overlays` (차량 이동 uses msg, 영아부 호출 uses user) |
| `.text`          | String                                      | The sentence. `{blank name}` marks a blank, for example "{차량 번호} 차량 이동 부탁드립니다".             | `Overlays`                                             |
| `.targets`       | Array of screen IDs, or `"all"`             | Default target screens (proposal). Optional; absent means `"all"` (04).                                   | `Overlays` 보낼 화면 (send to)                         |
| `.duration`      | Seconds, or `null` for 계속 (until cleared) | Default display time (proposal). Optional; absent means `null` (04).                                      | `Overlays` 표시 시간 (display time)                    |
| `stagePresets[]` | Array of strings                            | Preset stage messages, for example 후렴 한 번 더 (chorus once more) or 마지막 후렴 (last chorus).         | `Overlays` 무대 tab. Location is a proposal.           |

### 공지 sets (`notices.json`)

| Field          | Type                | Meaning                                                  | Source                    |
| -------------- | ------------------- | -------------------------------------------------------- | ------------------------- |
| `sets[]`       | Array               | 공지 sets, for example 주일 광고 (Sunday announcements). | `Overlays` 공지 tab       |
| `.id`, `.name` | String              | ID and name.                                             | `Overlays`                |
| `.media`       | Array of media IDs  | The images, in order.                                    | `Overlays` (슬라이드 6개) |
| `.interval`    | Seconds             | Time between images, for example 8.                      | `Overlays` "8초"          |
| `.loop`        | Boolean             | Loop.                                                    | `Overlays` loop button    |
| `.targets`     | Array of screen IDs | Target screens.                                          | `Overlays` 보낼 화면      |

### 소품 (`props.json`)

| Field          | Type                | Meaning                                                                                                                                                                                                     | Source                                                                                   |
| -------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `props[]`      | Array               | 소품, for example 로고 (logo), 설교 본문 자막 (sermon text caption), 시작 카운트다운 (start countdown), 온라인 헌금 안내 (online giving).                                                                   | `Overlays` 소품 tab                                                                      |
| `.id`, `.name` | String              | ID and name.                                                                                                                                                                                                | `Overlays`                                                                               |
| `.content`     | Object              | `{ "kind": "image", "media": media ID }` or `{ "kind": "text", "text": string, "style": the same fields as a lyric style }`. A `{timer:<timer ID>}` token in the text draws that 타이머's value (proposal). | `Overlays` (a logo image, text such as "예배 시작까지 04:32"). The format is a proposal. |
| `.targets`     | Array of screen IDs | Target screens.                                                                                                                                                                                             | `Overlays` (each 소품 shows its target screen)                                           |

### 타이머 (`timers.json`)

| Field          | Type                                                                            | Meaning                                                                                                                                                               | Source                                               |
| -------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `timers[]`     | Array                                                                           | The 타이머.                                                                                                                                                           | `Overlays` 타이머 tab                                |
| `.id`, `.name` | String                                                                          | ID and name, for example 예배 시작 (service start), 설교 (sermon), 예배 경과 (service elapsed), 현재 시각 (current time).                                             | `Overlays`                                           |
| `.kind`        | `"countdownTo"` \| `"countdown"` \| `"elapsed"` \| `"elapsedFrom"` \| `"clock"` | Date/time countdown, fixed duration, stopwatch elapsed duration, legacy time-of-day elapsed, or clock.                                                                | `Overlays`; October 27 user decision adds `elapsed`. |
| `.time`        | `HH:mm`                                                                         | Reference time for `countdownTo` and `elapsedFrom`.                                                                                                                   | `Overlays`                                           |
| `.duration`    | Seconds                                                                         | Duration of a `countdown`.                                                                                                                                            | `Overlays`                                           |
| `.date`        | `YYYY-MM-DD`, or absent                                                         | Calendar date for `countdownTo`, in the computer's local time zone with `.time`. Required by the new date/time editor. Absence preserves the legacy start-day anchor. | October 27 user decision                             |
| `.overrun`     | Boolean, or absent                                                              | `countdown` and `countdownTo`: true keeps counting with "-" after zero; false stops and holds zero. Absence means true.                                               | October 27 user decision; 10                         |
| `.start`       | Nonnegative seconds                                                             | Initial counted duration of `elapsed`, including zero. It is a duration rather than a time of day.                                                                    | October 27 user decision                             |

Don't save whether a 타이머 is running or how much time is left. That is output
state (see the recovery record).

The quick timer flow in 04 uses the existing `countdown` shape: `.duration` is
the entered minutes times 60 plus seconds, a positive whole number for newly
added quick timers. Each addition creates a new UUID v4 and a name 타이머 1,
타이머 2, and so on, using an unused number. It never reuses another timer's ID
or running state, including when durations match. The configured duration stays
after a stop/reset. The October 27 modes add optional countdown fields and the
distinct `elapsed` kind; earlier kinds and fields keep their original meaning.

Names are for display in 퀵 실행, the timer tab and stage pickers. References
stay ID-based, so 이름 바꾸기 does not break a stage selection or a 소품 token.
Quick start/reset changes only the referenced timer's live state. Passing zero
does not rewrite `.duration`: `.overrun` determines whether the timer stops or
continues with "-". A finished run holds zero and is not running; a fresh start
of a finished duration timer starts from its configured duration. Completion and
pause remain live state, never fields in this settings file.

Existing `elapsedFrom` records retain their `HH:mm` reference and remain
distinct from `elapsed`. New elapsed records use `.start`, keep counting on
main's monotonic clock, hold their value while paused and return to `.start`
when reset. Existing IDs and unknown fields are preserved; stage and prop
references continue resolving by ID (October 27 user decision, see 04).

### 이름표 list (`labels.json`)

| Field      | Type                                                                                                     | Meaning                                                                                                                        | Source                                        |
| ---------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `labels[]` | Array                                                                                                    | The 이름표 list, in the order of the 이름표 menu.                                                                              | `Reflow` 이름표 menu                          |
| `.name`    | String                                                                                                   | Name. Unique in the list.                                                                                                      | `Reflow`                                      |
| `.color`   | One of the eight colors above, or `"none"`                                                               | Color.                                                                                                                         | `Reflow` color row, `LabelColorPicker` README |
| `.key`     | A `KeyboardEvent.code` string for one letter or digit key, for example `"KeyC"` or `"Digit1"`, or `null` | Jump key that outputs this 이름표 in 진행 (see 04). Matched by physical key, so it works with the Korean IME on (decided, 10). | Product log (each 이름표 has a jump key), 10  |

Defaults: 1절 (teal), 2절 (teal), 3절 (teal), 프리코러스 (green), 후렴 (yellow),
브리지 (violet), 간주 (gray), 엔딩 (none). Jump keys start empty (decided: no
source gives default keys for ProPresenter's group labels; 10). The board spells
브릿지 and the design system spells 브리지. This spec follows the design system.

### 환경설정 (`preferences.json`)

`media.copyOnImport` is an optional Boolean, default `false` (October 27 user
decision). Off imports reference the original file in place. On imports copy
into the configured media folder. Read the choice once when an import request is
admitted; changing it affects the next request, not jobs already queued.
Changing the choice does not move, recopy or relink existing media. Preserve an
explicit saved value; an absent value uses off.

Store paths relative to the media folder when inside it, absolute otherwise.
Cancelling or failing an import may remove only copies created by that job,
never the original. Removing an item from the media list does not delete its
source file.

| Area       | Field                  | Type and default                             | UI name                                                                 | Source                |
| ---------- | ---------------------- | -------------------------------------------- | ----------------------------------------------------------------------- | --------------------- |
| General    | `language`             | `"ko"`                                       | 언어: 한국어 (language: Korean). Version 1 has Korean only.             | `Prefs`               |
| General    | `onLaunch`             | `"lastService"`                              | 시작할 때: 마지막 예배 열기 (on launch: open the last service)          | `Prefs`               |
| General    | `backupCopies`         | Integer, 10                                  | 복구 사본 10개 (10 recovery copies). See recovery copies below.         | `Prefs`               |
| Output     | `showOnLaunch`         | Boolean, false                               | 켤 때 화면 출력 (output on launch)                                      | `Prefs`               |
| Output     | `preventSleep`         | Boolean, true                                | 출력 중 절전 막기 (prevent sleep during output)                         | `Prefs`               |
| Output     | `alwaysOnTop`          | Boolean, false                               | 출력 창 항상 위 (output windows always on top)                          | `Prefs`               |
| Output     | `onDisconnect`         | `"window"`                                   | 화면 연결이 끊기면: 창으로 바꾸기                                       | `Prefs`               |
| Output     | `hardwareAcceleration` | Boolean, true                                | 하드웨어 가속 (hardware acceleration). Takes effect on the next launch. | `Prefs`               |
| Output     | `previewFps`           | Integer, 30                                  | 미리보기 30fps (preview frame rate)                                     | `Prefs`               |
| 라이브러리 | `backup.auto`          | Boolean, true                                | 자동 백업 (automatic backup)                                            | `Prefs`               |
| 라이브러리 | `backup.keep`          | Integer, 30                                  | 보관 30개 (keep 30)                                                     | `Prefs`               |
| Bible      | `bible.verseNumbers`   | Boolean, true                                | 절 번호 (verse numbers)                                                 | `Prefs`               |
| Bible      | `bible.maxLines`       | Integer, 4                                   | 한 슬라이드 최대 줄 수 (maximum lines per 슬라이드)                     | `Prefs`               |
| Bible      | `bible.sourcePosition` | `"bottomRight"`                              | 출처 위치: 오른쪽 아래 (reference position: bottom right)               | `Prefs`               |
| Import     | `import.txt.split`     | `"blankLine"` \| `"lineBreak"` \| `"symbol"` | 슬라이드 나누기: 빈 줄 (split: blank line)                              | `Prefs`, `ImportText` |
| Import     | `import.txt.labels`    | `"bracketLine"` \| `"off"`                   | 이름표: 대괄호 줄 (이름표: bracket lines)                               | `Prefs`               |
| Import     | `import.txt.firstLine` | `"title"` \| `"lyrics"`                      | 첫 줄: 제목 (first line: title)                                         | `Prefs`               |
| Import     | `import.txt.encoding`  | `"auto"` \| `"utf-8"` \| `"cp949"`           | 글자 인코딩: 자동 (encoding: auto)                                      | `Prefs`               |
| Import     | `import.pptx.*`        |                                              | Later (see 09)                                                          | `Prefs`               |

- The song, media, and backup locations are needed before the app reads any
  data. Store them in `app.json` in the app data folder, not in this file.
- The output area's prevent sleep, always on top, and when disconnected options
  overlap the per-screen values. In version 1 they are the defaults for a new
  screen (proposal, open question).
- The board's "자동 저장: 1분마다" (autosave: every minute) isn't used. The app
  saves on every change (open question).
- For the board's 오류 보고 보내기 (send error reports), 사용 통계 보내기 (send
  usage statistics), and update area, see 06 and the open questions.

### Shortcuts (`shortcuts.json`)

Decided on 2026-10-25 (10, "Storage").

- Store only the commands whose keys differ from the defaults. Each key is a
  physical key with its modifiers, so a stored key never depends on the layout
  or the IME:

  ```json
  {
    "format": "llsettings.shortcuts",
    "schemaVersion": 1,
    "bindings": {
      "output.audience": [{"code": "Digit1", "mods": ["ctrl"]}],
      "show.next": []
    }
  }
  ```

  - `code` is a `KeyboardEvent.code` value. `mods` holds `"ctrl"`, `"alt"`, and
    `"shift"`, in that order.
  - An empty array means "no key".
  - Keep bindings for command IDs this version doesn't know, so a newer
    version's keys survive.
  - A binding that fails validation is dropped and logged, and the command falls
    back to its default.

- 10 lists the command IDs and their default keys.

Source: `Shortcuts`, `KeyCap` README, 10.

### Bible (`bible.json`)

| Field            | Type  | Meaning                                                                                                                | Source                |
| ---------------- | ----- | ---------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `translations[]` | Array | Installed translations: `id`, `name` (개역한글), `lang` (한국어), `file` (translation file name), `default` (Boolean). | `Prefs` 성경 (Bible)  |
| `recents[]`      | Array | Recent passages: `ref` and `translation` from the Bible passage object. Up to 10 (proposal).                           | `Bible` 최근 (recent) |

### `app.json` in the app data folder (proposal)

M2 check 1 adds `uiZoomPercent` (100 to 200, step 10 percentage points,
default 100) for control windows on this computer. 10 defines UI zoom and the
proposed layout reset, which restores local window bounds, zoom, and all size
classes' column widths and thumbnail percentages. The data store remains the
only writer (`docs/decisions.md`, "One owner of app.json").

Media browser UI choices are optional app-local fields. `mediaStrip` remembers
the shared bottom bin's visibility in 진행 and 준비 (04). `prepMedia` is a
legacy field from the separate 준비 media mode: preserve it on file round trips
but do not use it or write new changes to it. `mediaBrowser.columns` keeps the
media grid's integer column count, 2 to 8 (default 5), separately from lyric
thumbnail scaling. `mediaBrowser.view` is `"grid"` or `"list"` (default
`"grid"`); audio playlists still display tracks as a list. Missing values use
these UI defaults without adding fields to an unchanged file. Partial UI updates
keep other fields and unknown metadata through the same writer.

`mediaImportFolder` is the optional last media file-picker folder, local to this
app data folder. A successful file choice remembers the first chosen file's
parent folder; cancellation keeps the previous folder. The next import opens
there immediately, without waiting for copies, analysis, a folder scan, or a
configuration write. With no absolute saved folder, use the operating system's
Videos folder as the initial location. Dragging files into the app does not
change this picker preference.

| Field                                           | Meaning                                                                                                                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dataRoot`                                      | The data folder.                                                                                                                                                                                                          |
| `songsPath`, `mediaPath`, `backupPath`          | The 환경설정 song, media, and backup locations. Empty means the default folder under the data folder.                                                                                                                     |
| `lastServiceId`                                 | The last opened 예배 순서.                                                                                                                                                                                                |
| `layout.narrow`, `layout.normal`, `layout.wide` | Per size class: left and right column widths and `thumbnailScalePercent` (50 to 200, whole %, default 100). The continuous slider replaces remembered thumbnail column counts (M2 check 1 row 9; proposal details in 10). |
| `previewBig`                                    | The screen ID shown large in the 진행 preview.                                                                                                                                                                            |
| `macroView`, `macroCollection`                  | View and collection of the 매크로 tab.                                                                                                                                                                                    |
| `mediaStrip`                                    | Saved open or closed choice. When present, it wins over the size class and height defaults. With no saved choice, use the defaults in 04.                                                                                 |

## Media list (`설정\media.json`)

| Field                     | Type                                | Meaning                                                                                                                                                                                           | Source                          |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `items[]`                 | Array                               | All media ("모든 미디어", all media, in the 보관함 group).                                                                                                                                        | `Media`                         |
| `.id`                     | String                              | Media ID.                                                                                                                                                                                         | `Main` samples                  |
| `.name`                   | String                              | Name: the file name without the extension.                                                                                                                                                        | `MediaTile` README              |
| `.kind`                   | `"video"` \| `"image"` \| `"audio"` | Kind. Leave room for more values later, such as `"input"` for a camera (see 09).                                                                                                                  | `Media`, product log version 63 |
| `.file`                   | String                              | File path. Relative to the media folder if inside it, absolute otherwise.                                                                                                                         | `Media` (file location)         |
| `.size`                   | Integer (bytes)                     | File size.                                                                                                                                                                                        | `Media` footer "2.1GB"          |
| `.duration`               | Seconds, or absent                  | Duration (video, audio).                                                                                                                                                                          | `Media`                         |
| `.width`, `.height`       | Integer                             | Size of images and videos.                                                                                                                                                                        | Proposal                        |
| `.props.end`              | `"loop"` \| `"stop"`                | 끝나면 (at the end): 반복 (loop) or 멈춤 (stop).                                                                                                                                                  | `Media` properties              |
| `.props.in`, `.props.out` | Seconds                             | 구간 (range) start and end.                                                                                                                                                                       | `Media` properties              |
| `.props.speed`            | Number                              | 속도 (speed), for example 1.0.                                                                                                                                                                    | `Media` properties              |
| `.props.fit`              | `"fit"` \| `"fill"` \| `"stretch"`  | 맞춤 (fit): 맞추기 (fit), 채우기 (fill), 늘리기 (stretch).                                                                                                                                        | `Media` properties              |
| `.props.audio`            | Boolean                             | 소리 켜기 (sound on).                                                                                                                                                                             | `Media` properties              |
| `.props.volume`           | 0 to 100                            | 음량 (volume).                                                                                                                                                                                    | `Media` properties              |
| `playlists[]`             | Array                               | Media playlists, for example 배경 영상 (background videos), 예배 전 반복 (pre-service loop), 광고 이미지 (announcement images), 설교 이미지 (sermon images): `id`, `name`, `items[]` (media IDs). | `Media`                         |
| `audioPlaylists[]`        | Array                               | Audio playlists, for example 예배 전 음악 (pre-service music), 헌금 연주 (offering music), 효과음 (sound effects): `id`, `name`, `items[]`, `loop` (Boolean).                                     | `Media`, `Overlays` 오디오 tab  |

- One media item can be in several playlists (proposal). Removing it from a
  playlist keeps it in the media list.
- Thumbnails and durations live in `cache\`. If they're deleted, rebuild them.
- Importing media references its original file by default. Copying into the
  media folder is optional through `media.copyOnImport`, default off (October 27
  user decision; see 05 and 10).

## Bible translations

- Version 1 bundles 개역한글 and KJV as offline translation files. 개역한글 is
  the default. Don't include 개역개정 until the Korean Bible Society permits its
  use.
- Translations are prepared in advance and delivered with an app update. The
  installed list in 환경설정 offers 기본으로 (make default); the app never
  installs or removes translations (user decision, 2026-10-26). See 06.
- Every Bible feature works without the network (01). The app never fetches
  verse text.

### What comes from copible

The earlier plan was to follow "the offline data of copible". A read-only look
at the user's repository (`D:\programming\copible`, last commit on 2025-07-22,
on 2026-10-25) found no offline Bible text and no file format:

- copible fetches verse text live, one chapter at a time, from the Korean Bible
  Society website (`https://www.bskorea.or.kr/bible/korbibReadpage.php` with
  `version=GAE`, in `src/data/bible-crawler.js`). `GAE` is 개역개정, the
  translation this app excludes. A handoff note in that repository
  (`Summary.md`) names an older source, holybible.or.kr, with EUC-KR pages.
- So this app defines its own translation file format (below), and the text of
  개역한글 and KJV comes from a public-domain source that the user chooses (see
  "Candidate text sources").

What this app reuses, ported to TypeScript with tests, without copying any text:

| Part              | In copible                                                                                                                                                                                                         | In this app                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Book metadata     | 66 books with `id`, `korean`, `koreanShort`, `english`, `englishShort`, `testament`, `chapters` (`src/data/bible-metadata.js`)                                                                                     | The same shape ("Book metadata")                                                                   |
| Book matching     | Exact matches on the four names; partial matches that compare Hangul by its letters (jamo) and also try the input as QWERTY typed with the Korean IME off, with es-hangul (`disassemble`, `convertQwertyToHangul`) | The same rules for the suggestions in the 퀵 실행 Bible field (04)                                 |
| Reference parsing | One pattern, `/^(.+?)\s*(\d+):(\d+)(?:-(\d+))?$/`: book, chapter, verse, optional end verse                                                                                                                        | An extended grammar ("Reference grammar"), because 04 also needs chapter ranges and whole chapters |
| Live fetching     | The crawler above                                                                                                                                                                                                  | Not used                                                                                           |

### Book metadata (proposal)

The app bundles one table of the 66 books in code. It isn't a user file.

| Field          | Type               | Meaning                                                                        |
| -------------- | ------------------ | ------------------------------------------------------------------------------ |
| `id`           | Integer, 1 to 66   | Canonical order, from 창세기 (1) to 요한계시록 (66). Translation files use it. |
| `korean`       | String             | Full Korean name, for example 창세기.                                          |
| `koreanShort`  | String             | Korean abbreviation the operator types, for example 창.                        |
| `english`      | String             | English name, for example Genesis.                                             |
| `englishShort` | String             | Three-character English code, lowercase, for example gen.                      |
| `testament`    | `"old"` \| `"new"` | Testament.                                                                     |
| `chapters`     | Integer            | Number of chapters.                                                            |

- Verse counts aren't in this table. They come from each translation file,
  because versification differs between translations (one dataset counts 31,101
  verses for 개역한글 and 31,102 for KJV).

### Translation file (`.llbible`, schema version 2)

Each installed translation is one read-only, chapter-based file in `bible\`
under the app data folder (user decision, 2026-10-26). The settings file keeps
its existing translation IDs and file names. The runtime reads schema version 2;
the former whole-file JSON schema version 1 is build-time converter input.

The container has this byte layout:

```text
4-byte unsigned little-endian header length H
H bytes of UTF-8 JSON header
chapter blocks in canonical book and chapter order
```

`H` excludes the length prefix. There is no byte order mark or separator after
the header. The chapter data starts at byte `4 + H`. An offset in the table is
relative to that data start, so metadata size changes never change the table's
offsets. All lengths and offsets count UTF-8 bytes, not characters.

| Header field         | Type                      | Meaning                                                                        |
| -------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| `format`             | `"llbible"`               | File type.                                                                     |
| `schemaVersion`      | `2`                       | Chapter-based container version; other file types keep their own versions.     |
| `id`                 | String                    | Lowercase installed translation ID, matching its entry in `bible.json`.        |
| `name`               | String                    | Name in the translation select.                                                |
| `shortName`          | String                    | Name appended to a reference when 역본 이름 is on (04).                        |
| `language`           | String (BCP 47)           | For example `ko` or `en`; chooses reference book names.                        |
| `source`             | Object                    | `title`, `publisher`, HTTP(S) `url`, `license`, and `retrieved` date.          |
| `books[]`            | Array                     | Chapter offset table grouped by books in canonical order. Books may be absent. |
| `books[].id`         | Integer, 1 to 66          | Unique, strictly increasing ID from "Book metadata".                           |
| `books[].chapters[]` | Array                     | One entry for each chapter, in order, with the book metadata's chapter count.  |
| `.offset`            | Non-negative safe integer | Byte offset of the chapter block from the chapter data start.                  |
| `.bytes`             | Positive safe integer     | Length of the chapter block in bytes, including its final LF.                  |
| `.verses`            | Positive safe integer     | Number of verse slots, including omitted verses.                               |

Each chapter block is a compact UTF-8 JSON array of verse strings followed by
one LF byte. Array index 0 is verse 1; an omitted verse is `""`, preserving its
number. The decoded count must match the table's `verses`. Verse strings are
trimmed source text without verse numbers or markup. Neither runtime nor
converter edits the text; an invalid source must be corrected before packing.
The existing source attribution rules apply.

This chapter block contains invented text only and is 32 bytes including LF:

```text
["Invented first sentence.",""]
```

For a file containing only book 57, which has one chapter, its table is
`[{"id":57,"chapters":[{"offset":0,"bytes":32,"verses":2}]}]`.

#### Reading and validation

- Launch reads the four-byte length, exactly the header bytes, and the file's
  size. It validates installed headers without reading chapter blocks. Book
  completion uses "Book metadata"; chapter and verse bounds use the table.
- Validate metadata, `format`, version, installed ID, book ordering and chapter
  counts before publishing an index. Offsets and sums must be safe integers. The
  first offset is zero, each subsequent block starts at the previous end, and
  the final end equals the chapter data size. Reject gaps, overlaps, truncation
  and entries outside the file. An empty book table has no data.
- A lookup first validates its reference and requested verse count against the
  header and existing lookup limits. It reads only the needed uncached chapters,
  using positioned reads at `4 + H + offset`. Fill each requested byte span
  across partial reads; EOF before its end is an error. Validate UTF-8, JSON,
  final LF, verse count and strings before using a block.
- A broken header or unreadable file is skipped with one warning for that file.
  A later broken chapter invalidates its translation and cached chapters, also
  reporting only one warning for that file per library session. Other
  translations stay available. Repeated lookups never repeat the warning.
- Missing books and invalid references retain the existing lookup errors and
  behavior below. The window lookup API and passage objects are unchanged.
- Files remain read-only. File handles close after reading and on failure;
  clearing or disposing the library drops its index and chapter cache. Pending
  work after disposal cannot publish a result or refill the cache.

The reader has these named bounds. Check byte lengths before allocating read
buffers, and reject files or blocks that exceed their applicable bound.

| Constant                        | Value     | Meaning                                                      |
| ------------------------------- | --------- | ------------------------------------------------------------ |
| `BIBLE_HEADER_MAX_BYTES`        | 1,048,576 | Header JSON bytes, excluding its four-byte length.           |
| `BIBLE_CHAPTER_MAX_BYTES`       | 1,048,576 | Bytes of one chapter block, including LF.                    |
| `BIBLE_CHAPTER_CACHE_LIMIT`     | 32        | Decoded chapters retained across all installed translations. |
| `BIBLE_CHAPTER_CACHE_MAX_BYTES` | 8,388,608 | Sum of source block byte lengths retained in that cache.     |

The recent-chapter cache is least recently used. Hits refresh recency; a miss
adds only a fully validated chapter and evicts oldest entries until both cache
bounds hold. Eviction never changes installed files or passages already read.

#### Build-time conversion

A build-time script converts a checked `.llbible` schema version 1 JSON file
into this version 2 container. It preserves metadata, unknown metadata fields,
book order, every verse string and omitted-verse slots. It computes block
lengths and relative offsets from the serialized UTF-8 bytes and validates the
completed index before writing. Input and destination paths must differ.

Write to a temporary file in the destination folder, flush and atomically rename
it over the destination. Failure leaves an existing destination intact. This
prepares files delivered in an app update; the running app does not convert or
install files. Other formats such as USFM, OSIS and SWORD remain build-time
source preparation. Tests and committed examples contain invented sentences
only; never commit Bible text or output derived from a crawl.

### Reference input

The 진행 and 준비 reference form uses four shared fields: 책, 장, 시작절, and
optional 끝절 (user decision, 2026-10-26). The form builds a normalized
single-chapter reference for the grammar below; stored references still accept
whole chapters and ranges across chapters.

- 책 lists every Korean full-name or short-name jamo containment match and every
  English name or code containment match, including input interpreted as Korean
  typed with the IME off, in canonical order. The list is bounded by the 66
  books, with no initial highlight. Exact matches remain in this list along with
  other containment matches. Tab completes the exact match or the only candidate
  to the full name and moves to 장. With several candidates and no exact match,
  Tab stays until an arrow-key selection is made.
- 장 is an integer from 1 to the book's chapter count. 시작절 is an integer from
  1 to the selected chapter's verse count. 끝절 is empty for one verse, or an
  integer from 시작절 through the chapter's last verse. Changing 시작절 clears
  끝절. Invalid fields block forward Tab and expose a short Korean reason only
  through the field tooltip. Shift Tab remains backward navigation.
- A 끝절 above the last verse blocks Tab, but lookup clamps it to that last
  verse. An end below 시작절 remains invalid and blocks lookup.
- Optional `bounds` in a Bible lookup reply contains `bookId` and
  `chapterVerses`, one positive verse-slot count per chapter, including omitted
  verses. A book-only request returns this from the installed header without
  reading chapter text. Bounds are capped at 150 chapters and 40,000 slots per
  chapter. The form ignores bounds for another book or translation.

### Reference grammar (proposal)

Stored references and the lookup API accept these forms. Each form has a colon
form and a Korean form with 장 and 절; one reference uses one of them
throughout, so a mixed reference such as "요 3:16-4장 2절" is invalid. Spaces
between the book, the numbers, and the separators are optional ("요3:16",
"요한복음3장16절"), and "~" works like "-" ("요 3:16~18").

| Form                  | Colon form  | Korean form         | Meaning                      |
| --------------------- | ----------- | ------------------- | ---------------------------- |
| Whole chapter         | 요 3        | 요 3장              | Every verse of chapter 3     |
| One verse             | 요 3:16     | 요 3장 16절         | Verse 16 of chapter 3        |
| Range in one chapter  | 요 3:16-18  | 요 3장 16-18절      | Verses 16 to 18 of chapter 3 |
| Range across chapters | 요 3:16-4:2 | 요 3장 16절-4장 2절 | From 3:16 through 4:2        |

- The book part follows "Book matching" in the table above. An exact match wins;
  otherwise one partial match is used; several partial matches go to the
  suggestion list, where the operator picks one (04).
- Chapter and verse numbers are whole numbers from 1. Anything else is invalid.

Endpoint and order rules, checked against the chosen translation's file. The
start and the end are compared as (chapter, verse) pairs, chapter first: the end
comes before the start when its chapter is earlier, or when the chapters are
equal and its verse is earlier. Only a pair with the same chapter and the same
verse is one verse.

| Case                                         | Result                                              | Example (요한복음 has 21 chapters, and its chapter 3 has 36 verses)                          |
| -------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| The start chapter doesn't exist              | Invalid                                             | 요 22:1                                                                                      |
| The start verse doesn't exist in its chapter | Invalid                                             | 요 3:40                                                                                      |
| The end chapter doesn't exist                | Invalid                                             | 요 3:16-22:1                                                                                 |
| The end verse is past the end of its chapter | Invalid; never shorten the requested range          | 요 3:16-99 is invalid                                                                        |
| The end comes before the start               | Invalid (reversed)                                  | 요 3:18-16, 요 4:2-3:16                                                                      |
| The end is in a later chapter                | A range across chapters, whatever the verse numbers | 요 3:16-4:2 (verse 2 is lower than 16, and the range is valid), 요 3:16-4:16 (not one verse) |
| The end chapter equals the start chapter     | Read as a range in one chapter                      | 요 3:16-3:18 becomes 요 3:16-18                                                              |
| The end equals the start                     | Read as one verse                                   | 요 3:16-16 and 요 3:16-3:16 become 요 3:16                                                   |

- An invalid reference shows the error ring with the reason in a tooltip (04):
  "알아볼 수 없는 구절입니다" (passage not recognized) for a form the grammar
  doesn't accept, "없는 장입니다" (no such chapter) or "없는 절입니다" (no such
  verse) for an endpoint that doesn't exist, and "구절 순서가 거꾸로입니다" (the
  passage is reversed) for a reversed range (proposal for the wording).
- The normalized `ref` of a Bible passage object uses the colon form and the
  full Korean book name, after these rules: "요한복음 3", "요한복음 3:16",
  "요한복음 3:16-18", "요한복음 3:16-4:2". The same grammar reads it back.
- The reference drawn on a 슬라이드 uses the book name in the translation's
  language: 요한복음 3:16 for 개역한글, John 3:16 for KJV.

### Omitted verses (proposal)

A translation file keeps an empty string for a verse that the translation leaves
out, so every other verse keeps its original number. Lookup and display skip
those verses and never renumber the rest:

- **One verse.** A reference to one omitted verse is invalid, with the reason
  "이 역본에는 없는 절입니다" (this translation doesn't have this verse) in the
  tooltip. The operator can choose another translation. The app never outputs a
  blank 슬라이드.
- **A range or a whole chapter.** The omitted verses are left out, and the
  others keep their numbers. If verse 3 of a chapter is omitted, "1-5" gives
  verses 1, 2, 4, and 5, shown with those numbers. The passage's reference keeps
  the range as typed, 1-5. A range in which every verse is omitted is invalid,
  with the same reason as one verse.
- **Splitting into 슬라이드.** 나누기 counts only the verses that are there: 한
  슬라이드에 한 절 makes no 슬라이드 for an omitted verse; 두 절씩 pairs the
  verses that are there (1 and 2, then 4 and 5); 길이에 맞춤 just has fewer
  lines.
- **References on 슬라이드.** With 참조 set to 슬라이드마다, each 슬라이드 shows
  the verses it holds by their original numbers: the 슬라이드 with verses 4 and
  5 shows the range 4-5.
- **Endpoints.** An endpoint that names an omitted verse still counts as an
  existing verse for the endpoint rules above, because the verse exists in the
  numbering.

### Candidate text sources (for the user's choice)

The user chooses where the bundled text comes from. Nothing has been downloaded.
Each row gives what the source itself states.

| Translation | Source                         | Where                                                             | Copyright or license, as stated                                                                                                | Format                                                         |
| ----------- | ------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| 개역한글    | CrossWire SWORD module `KorRV` | https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=KorRV | "Public Domain"; "Korean Revised Version 1952/1961 from Wikisource"; version 2.0.1 (2019-01-07)                                | SWORD module (needs a SWORD reader to convert)                 |
| 개역한글    | Korean Wikisource, 개역한글판  | https://ko.wikisource.org/wiki/개역한글판                         | Public domain notice on the page, with a caution that the work may not be public domain in the United States                   | Wiki pages, one per book                                       |
| 개역한글    | crizin/bible-db                | https://github.com/crizin/bible-db                                | "Korean Bible Society, Public Domain"; 31,101 verses; text crawled from holybible.or.kr; scripts MIT, data licensed per source | JSONL files, SQLite release                                    |
| 개역한글    | scrollmapper/bible_databases   | https://github.com/scrollmapper/bible_databases                   | Repository MIT; lists "KorRV: 개역성경"; the README states no copyright for the text itself                                    | SQLite, CSV, JSON, YAML, TXT, and others                       |
| KJV         | eBible.org, `eng-kjv`          | https://ebible.org/find/details.php?id=eng-kjv                    | "Public Domain"; printing in the United Kingdom needs permission under letters patent (https://ebible.org/kjv/copr.htm)        | USFM, USFX, VPL with SQL, plain text, SWORD module, and others |
| KJV         | scrollmapper/bible_databases   | https://github.com/scrollmapper/bible_databases                   | Repository MIT; "King James Version (1769) with Strongs Numbers and Morphology and CatchWords"                                 | Same as above; the Strong's markup must be stripped            |
| KJV         | crizin/bible-db                | https://github.com/crizin/bible-db                                | "scrollmapper (CrossWire/eBible), PD"; 31,102 verses                                                                           | JSONL files, SQLite release                                    |

Copyright status:

- **개역한글.** The Korean Bible Society lists the first publication as July 10,
  1961, and the end of the economic copyright term as December 31, 2011
  (https://www.bskorea.or.kr/bbs/content.php?co_id=subpage2_3_4_1). Its FAQ says
  the text can be used without paying royalties, provided that the moral rights
  to keep the text unchanged (동일성유지권) and to name the author (성명표시권)
  are respected
  (https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&wr_id=5). The
  app meets both: it never changes a verse, and `source` names the translation
  and its publisher.
- **KJV.** Public domain outside the United Kingdom; in the United Kingdom,
  printing needs permission under letters patent
  (https://ebible.org/kjv/copr.htm). The app is used in one church in Korea and
  isn't distributed.

Proposal: KJV from eBible.org (its USFM is a standard format with a clear
statement); 개역한글 from the CrossWire `KorRV` module, compared verse by verse
with a second source (crizin/bible-db) by the conversion script before it's
used. The user decides.

### Dependency proposal: es-hangul

- copible's book matching uses es-hangul. This app would use it for the same
  matching, and its `getChoseong` could also serve the 초성 search of the
  라이브러리 (05).
- es-hangul 2.4.0 on npm: MIT license, no runtime dependencies, about 148 KB
  unpacked, last modified on 2026-08-24 (npm registry, read on 2026-10-25), from
  Toss (https://github.com/toss/es-hangul).
- It's a proposal only. Adding it needs an entry in `docs/decisions.md` and the
  lead's approval first (`CLAUDE.md`, `docs/TECH.md`, "Criteria for adding a
  dependency"). Splitting Hangul syllables into letters takes a few dozen lines
  and could be written in-house; converting QWERTY input to Hangul is a larger
  piece of logic, which is the main reason to take the library.

Open questions (also in the README, row 4):

- Which text sources to use (table above).
- Whether the bundled translation files may be committed to the public
  repository. Proposal: keep them out of git and have the conversion script
  build them from a pinned source file at build time, so that no Bible text
  lands in the repository and nothing is fetched at run time.

Source: read-only look at `D:\programming\copible` (2026-10-25), the sources in
the table above, `Prefs` 성경, `Bible`, product log (copible, offline data
preferred), `docs/HANDOFF.md` (개역한글 and KJV).

## Schema versions and migration

- If a file's `schemaVersion` is lower than the version the app knows, convert
  it to the current version in memory. Write the file in the new version the
  next time it changes. Before the first write in the new version, keep the old
  version as a recovery copy (proposal).
- If a file's `schemaVersion` is higher than the version the app knows, open the
  file read-only. The operator can't edit it. Its row shows a warning icon, with
  the reason in a tooltip (proposal).
- If `format` is wrong, the JSON is broken, or the content fails its schema,
  never lose the file's content. Write a log entry and show one warning
  notification. What happens next depends on the file (`docs/TECH.md` "Storage",
  lead decision of October 25, 2026):
  - **A song, 예배 순서, or 틀 file** isn't touched. It's skipped: it doesn't
    appear in its list, and items that point to a skipped song show the problem
    state (08).
  - **An app-wide settings file** (a file in the table under "App-wide
    settings") runs its area from the newest recovery copy that reads, or else
    from that area's first-launch defaults, and the app keeps running. Before
    the area's next write replaces the file, the app copies the broken file to
    `(name).broken-(YYYYMMDD-HHmmss).json` in the same folder, so its content
    stays available. The notification's detail names the area and whether a
    recovery copy or the defaults were used.
  - **`app.json`** is never overwritten while it's broken. The app uses only its
    location fields that are valid, uses the defaults for everything else, and
    doesn't write the file until it reads again.
- Keep unknown fields in every version.

## Save rules

### Autosave

- Save songs, 예배 순서, 틀, settings, and the media list on every change. When
  changes come in a burst, such as typing, write once within 0.5 seconds after
  the last change (proposal). Before the app quits, write everything that is
  pending.
- The "HH:MM 저장됨" in the status bar is the time of the last successful write.
- Save asynchronously in the main process. Saving must never stall output or
  input (implementation requirement).
- The board's 환경설정 option "자동 저장: 1분마다" conflicts with the decision
  to save on every change, so the app doesn't have it (open question).

### Atomic writes (implementation requirement)

- Write the whole file to a temporary file in the same folder, flush it to disk,
  and then rename it over the original. A power loss during a write must never
  leave a half-written file.
- If writes to one file overlap, run them in order. The later content must win.

### Recovery copies (implementation requirement)

- Before you overwrite a file, keep the previous version as
  `.복구 사본\<kind>\<ID>\<time>.json` (proposed location).
- Keep as many copies per file as the 환경설정 option 복구 사본 says (default
  10). Delete the oldest first. So that typing doesn't create a copy per
  keystroke, make at most one copy of the same file every 5 minutes (proposal).
- `docs/TECH.md` proposed 5 copies. The board shows 10 as the default. This spec
  follows the board.

### Automatic backup

- If 자동 백업 is on, back up once a day, at launch, when no service is running.
  Copy the song, service, 틀, and settings folders into a folder in the backup
  location named after the backup's start time, `YYYY-MM-DD HHmmss` (proposal).
  Leave out media files because of their size (proposal).
- A backup copies into a folder with `.partial` at the end of its name and
  renames it to the final name only when every file is copied, so a folder
  without `.partial` is always a complete backup (proposal).
- The last backup time (마지막 백업 in 환경설정) is the time in the name of the
  newest complete backup folder; with none, it shows 없음 (none). It isn't
  stored anywhere, so `app.json` keeps a single writer (lead decision, October
  25, 2026).
- 지금 백업 (back up now) runs a backup at once. Keep as many backups as the
  보관 option says (default 30).
- If the backup location isn't writable (for example, the drive is missing),
  skip the backup and show a warning notification (proposal).

### Save failures

- If a write fails (disk full, no permission, missing folder), keep the content
  in memory and show the warning notification "저장할 수 없음" (can't save). The
  notification's 다시 시도 (try again) button writes again. The save time in the
  status bar doesn't change (proposal).
- A save failure never affects the output.

## What isn't saved, and the recovery record

Don't put the output state in song, service, or settings files. Instead, the
main process writes it to the recovery record each time it changes. You can
batch these writes to once per second (proposal).

`recovery\live.json` uses the `llrecovery` file format, schema version 1. Its
`state` is the complete live output state, alongside the service ID. It keeps
the captured live content, including the actual slide lines, rather than only
the references needed to reconstruct it from song or Bible files. Output removes
audio, timer, and clear undo state before writing. The whole record is at most 4
MiB, with 1 KiB of it reserved for the header, so the state must fit in the rest
(01, "The main process owns the output state").

| Field or excluded state | Meaning                                                                                        | Row in the recovery dialog                 |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `format`                | `llrecovery`                                                                                   | Not displayed                              |
| `schemaVersion`         | `1`                                                                                            | Not displayed                              |
| `savedAt`               | Write time                                                                                     | The time in the dialog's details           |
| `serviceId`             | Current service ID, or `null` when no service is open or its content hasn't been read yet      | 마지막 슬라이드 (last 슬라이드)            |
| `state`                 | The complete live output state; its fields provide the three restore rows                      | See the rows below                         |
| `state.version`         | The state's change count                                                                       | Not displayed; restore starts a new count  |
| `state.lookId`          | The selected Look, or absent or `null` for the saved current Look                              | Not displayed; see below                   |
| `state.outputs`         | Screen ID to output on or off                                                                  | 화면 출력 (screen output)                  |
| `state.layers.slide`    | Complete live 슬라이드: source item ID, position, label, and displayed lines                   | 마지막 슬라이드                            |
| `state.layers.media`    | Background media choice, loop setting, and playback start time                                 | 마지막 슬라이드 (proposal)                 |
| `state.layers.prop`     | Complete active 소품 layer, including captured item payloads when present                      | 표시 중이던 항목 (items that were showing) |
| `state.layers.message`  | Complete active 메시지 layer, including displayed text and captured item payloads when present | 표시 중이던 항목                           |
| `state.stageMessage`    | Captured stage message text when present                                                       | 표시 중이던 항목                           |
| `state.layers.notice`   | Complete active 공지 layer, including captured playback state when present                     | 표시 중이던 항목                           |
| Stage layout overrides  | Join the state when the stage slice (M3-O5) adds them (later work)                             | 표시 중이던 항목 (later work)              |
| Timer state             | Excluded before writing; running timers are not recorded for restart                           | Not restored                               |
| `state.layers.audio`    | Cleared before writing; audio playback is not recorded for restart                             | Not restored                               |
| `state.canUndo`         | Written as `false`; the undo history of clears is not recorded                                 | Not restored                               |

- Restore applies the record's `lookId` when that Look still exists, and
  otherwise the saved `looks.current`.
- Create `recovery\session.lock` at launch and delete it on a clean exit. If the
  file exists at launch, treat the last exit as a crash and open the output
  state recovery dialog. See 08.
- These things aren't saved either: undo history of clears, undo history of
  edits, an imported song before 저장, and the selection and open menus in 진행.

Source: `Main` service notes ("출력 상태는 파일에 넣지 않습니다"), `Main`
decision "복구는 출력 상태만", `Recovery` (three restore rows), product log
versions 61 and 62.
