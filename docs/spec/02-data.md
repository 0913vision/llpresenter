# 02. Data and files

This document defines the format, location, and save rules for everything the
app stores. Field names are the names used in the JSON. Fields that appear in
the source samples keep their names. Fields that the sources don't show are
marked as proposals.

Terms: 장 (slide), 예배 순서 (service order), 틀 (template), 구성 (arrangement),
이름표 (label), 라이브러리 (library), 매크로 (macro), 소품 (prop), 공지
(notice), 메시지 (message), 타이머 (timer), 퀵 실행 (quick run), 본 화면 (main
screen), 무대 화면 (stage screen), 방송 자막 (broadcast captions). See 01 for
the full list.

## Common rules

| Rule           | Requirement                                                                                                                                                                                                                     | Source                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Encoding       | Every file is UTF-8 JSON without a byte order mark.                                                                                                                                                                             | `Main` song file sample                                          |
| Header fields  | Every file starts with `format` (a string that names the file type) and `schemaVersion` (an integer, 1 in version 1).                                                                                                           | `Main` samples                                                   |
| IDs            | Songs, 예배 순서, 틀, media, screens, Looks, lyric styles, stage layouts, 매크로, collections, 퀵 실행 items, 메시지 templates, 공지 sets, 소품, 타이머, and 예배 순서 items have a UUID v4 ID in lowercase. Never reuse an ID. | `Main` samples (song and media IDs). The rest is a proposal.     |
| Unknown fields | When you read a file, keep every unknown field in memory and write it back unchanged. This also applies to nested objects (장, 구성, items).                                                                                    | `Main` song file notes, product log 2026-10-24 (room for scores) |
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

Each song is one file.

```json
{
  "format": "llsong",
  "schemaVersion": 1,
  "id": "6f1c2a9e-...",
  "title": "만복의 근원 하나님",
  "background": "3b9d0c52-...",
  "slides": [
    {"label": "1절", "lines": ["...", "..."]},
    {"label": "프리코러스", "lines": ["...", "..."]},
    {"label": "후렴", "lines": ["...", "..."]},
    {"label": "", "lines": ["...", "..."]}
  ],
  "arrangements": [
    {"name": "주일용", "slides": [1, 2, 3, 4, 2, 3, 4, 3, 4]},
    {"name": "짧게", "slides": [1, 2, 3, 4]}
  ]
}
```

| Field                   | Type                        | Required | Meaning                                                                                                     |
| ----------------------- | --------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `format`                | `"llsong"`                  | Yes      | File type.                                                                                                  |
| `schemaVersion`         | Integer                     | Yes      | 1 in version 1.                                                                                             |
| `id`                    | String (UUID)               | Yes      | Song ID. A 예배 순서 points to the song with this value.                                                    |
| `title`                 | String                      | Yes      | Title. It can't be empty. Titles are unique in the 라이브러리 (proposal, see 05).                           |
| `background`            | String (media ID) or absent | No       | Default background. If absent, outputting the song doesn't change the background (see 03).                  |
| `slides`                | Array                       | Yes      | The 장 list. This order is the default 구성. A song has at least one 장 (proposal).                         |
| `slides[].label`        | String                      | No       | 이름표 name. Absent or `""` means no 이름표.                                                                |
| `slides[].lines`        | Array of strings            | Yes      | The lines that show on the 장. Line breaks are exactly this array. An empty array is a blank 장 (proposal). |
| `arrangements`          | Array                       | No       | Named 구성. If absent, the song has only the default 구성.                                                  |
| `arrangements[].name`   | String                      | Yes      | 구성 name. Unique within the song. "기본" (default) is reserved (proposal).                                 |
| `arrangements[].slides` | Array of integers           | Yes      | The order of 장 numbers, starting at 1. A number can appear more than once.                                 |
| `updatedAt`             | String (ISO 8601)           | No       | Time of the last edit (proposal). The duplicate title dialog uses it ("10월 20일 수정", edited October 20). |

Rules:

- Don't store the default 구성. It's always the file order of `slides`.
- A 구성 belongs to the song, not to any service. A 예배 순서 item picks a 구성
  by name.
- Don't store 이름표 colors or jump keys in the song file. See the 이름표 list.
- When you insert, delete, or move a 장, rewrite the 장 numbers in every 구성. A
  deleted 장 drops out of each 구성, and higher numbers shift down
  (implementation requirement). If a 구성 becomes empty, keep it, but show it in
  진행 like the default 구성 (proposal).
- Version 1 has no per-장 images or notes in songs.
- If a later version adds fields such as a score, version 1 must not remove them
  (unknown fields are kept).

Source: `Main` song file sample and notes, `Main` decisions "가사는 자체 형식"
and "곡 구성은 프리셋", product log version 61, design system README (이름표
colors).

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
    {"id": "...", "slot": "song", "title": "찬양"}
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

| Kind          | Kind key                    | Other fields                                 | Source                                                                   |
| ------------- | --------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| Header        | `header`: name              | None                                         | `Main` sample, `ShowH` (예배 전, 찬양, 말씀, 마무리)                     |
| Song          | `song`: song ID             | `arrangement`, `background`, `macro`, `memo` | `Main` sample, `PrepService`                                             |
| Slot          | `slot`: the kind it accepts | `title`                                      | `Main` sample, `NewService`                                              |
| Bible passage | `bible`: object (see below) | `macro`, `memo` (proposal)                   | `AddSongsQuick`, `ShowH`, `Bible`. The format is a proposal.             |
| Media         | `media`: media ID           | `macro`, `memo` (proposal)                   | `AddSongsQuick`, `ShowH` (예배 전 카운트다운). The format is a proposal. |
| 공지          | `notice`: 공지 set ID       | `macro`, `memo` (proposal)                   | `AddSongsQuick`, `ShowH` (주일 광고). The format is a proposal.          |

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

| Field             | Type                               | Meaning                                                                                                   |
| ----------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `translation`     | String (translation ID)            | Translation.                                                                                              |
| `ref`             | String                             | Normalized reference, for example "요한복음 3:16-18".                                                     |
| `split`           | `"verse"` \| `"two"` \| `"fit"`    | 나누기 (split): 한 장에 한 절 (one verse per 장), 두 절씩 (two verses), 길이에 맞춤 (fit to length).      |
| `reference`       | `"every"` \| `"first"` \| `"none"` | Where the reference shows: every 장, first 장 only, or nowhere. The board shows only "장마다" (every 장). |
| `verseNumbers`    | Boolean                            | 절 번호 (verse numbers).                                                                                  |
| `translationName` | Boolean                            | 역본 이름 (translation name).                                                                             |

### Slot items

- `slot` names the kind that fits: `"song"` (찬양, praise), `"bible"` (성경
  구절, Bible passage), or `"slides"` (설교, sermon). These are the values the
  boards show. Version 1 has no item kind that fills a `"slides"` slot (open
  question).
- `title` is the name in the list, for example "찬양".
- When the operator drops an item of the right kind on a slot, the item fills
  the slot and becomes a normal item. See 05.

Source: `Main` service sample and notes, `NewService`, `ServiceImport`,
`AddSongsQuick`, `ListRow` README.

## Templates

- A 틀 uses the service file format (`format: "llservice"`). Store it in the
  `틀\` folder of the data folder (proposal).
- A 틀 has no `date`. It can have a `time` (`HH:mm`) that sets the default time
  of a new service (proposal).
- A 틀 can hold slot items. It can also hold filled items such as songs, media,
  and 공지. For example, the `NewService` board shows 예배 전 카운트다운, 주일
  광고, and 축도 in a 틀.

Source: `Main` service notes ("틀도 같은 형식이며, 빈 자리 항목을 가질 수
있습니다"), `NewService`.

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

On first launch, create any missing file with the defaults below.

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
| `..show`            | `"text"` \| `"image"` \| `"memo"`                                                                                    | 보여 줄 것 (what to show): 글자 (text), 그림 (image), 메모 (memo). 장 elements only.                                              | `StageEditor`                                                                                                                                               |
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

### 메시지 templates and stage message presets (`messages.json`)

| Field            | Type                                        | Meaning                                                                                                   | Source                                                 |
| ---------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `templates[]`    | Array                                       | 메시지 templates, for example 차량 이동 (move your car), 영아부 호출 (nursery call), 자리 안내 (seating). | `Overlays` 메시지 tab                                  |
| `.id`, `.name`   | String                                      | ID and name.                                                                                              | `Overlays`                                             |
| `.icon`          | `"msg"` \| `"user"`                         | List icon.                                                                                                | `Overlays` (차량 이동 uses msg, 영아부 호출 uses user) |
| `.text`          | String                                      | The sentence. `{blank name}` marks a blank, for example "{차량 번호} 차량 이동 부탁드립니다".             | `Overlays`                                             |
| `.targets`       | Array of screen IDs, or `"all"`             | Default target screens (proposal).                                                                        | `Overlays` 보낼 화면 (send to)                         |
| `.duration`      | Seconds, or `null` for 계속 (until cleared) | Default display time (proposal).                                                                          | `Overlays` 표시 시간 (display time)                    |
| `stagePresets[]` | Array of strings                            | Preset stage messages, for example 후렴 한 번 더 (chorus once more) or 마지막 후렴 (last chorus).         | `Overlays` 무대 tab. Location is a proposal.           |

### 공지 sets (`notices.json`)

| Field          | Type                | Meaning                                                  | Source                 |
| -------------- | ------------------- | -------------------------------------------------------- | ---------------------- |
| `sets[]`       | Array               | 공지 sets, for example 주일 광고 (Sunday announcements). | `Overlays` 공지 tab    |
| `.id`, `.name` | String              | ID and name.                                             | `Overlays`             |
| `.media`       | Array of media IDs  | The images, in order.                                    | `Overlays` (6장)       |
| `.interval`    | Seconds             | Time between images, for example 8.                      | `Overlays` "8초"       |
| `.loop`        | Boolean             | Loop.                                                    | `Overlays` loop button |
| `.targets`     | Array of screen IDs | Target screens.                                          | `Overlays` 보낼 화면   |

### 소품 (`props.json`)

| Field          | Type                | Meaning                                                                                                                                                                                                     | Source                                                                                   |
| -------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `props[]`      | Array               | 소품, for example 로고 (logo), 설교 본문 자막 (sermon text caption), 시작 카운트다운 (start countdown), 온라인 헌금 안내 (online giving).                                                                   | `Overlays` 소품 tab                                                                      |
| `.id`, `.name` | String              | ID and name.                                                                                                                                                                                                | `Overlays`                                                                               |
| `.content`     | Object              | `{ "kind": "image", "media": media ID }` or `{ "kind": "text", "text": string, "style": the same fields as a lyric style }`. A `{timer:<timer ID>}` token in the text draws that 타이머's value (proposal). | `Overlays` (a logo image, text such as "예배 시작까지 04:32"). The format is a proposal. |
| `.targets`     | Array of screen IDs | Target screens.                                                                                                                                                                                             | `Overlays` (each 소품 shows its target screen)                                           |

### 타이머 (`timers.json`)

| Field          | Type                                                             | Meaning                                                                                                                   | Source                                  |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `timers[]`     | Array                                                            | The 타이머.                                                                                                               | `Overlays` 타이머 tab                   |
| `.id`, `.name` | String                                                           | ID and name, for example 예배 시작 (service start), 설교 (sermon), 예배 경과 (service elapsed), 현재 시각 (current time). | `Overlays`                              |
| `.kind`        | `"countdownTo"` \| `"countdown"` \| `"elapsedFrom"` \| `"clock"` | Time left until a set time ("10:30까지"), a fixed duration ("35분"), time since a set time ("10:30부터"), or a clock.     | `Overlays`. Value names are a proposal. |
| `.time`        | `HH:mm`                                                          | Reference time for `countdownTo` and `elapsedFrom`.                                                                       | `Overlays`                              |
| `.duration`    | Seconds                                                          | Duration of a `countdown`.                                                                                                | `Overlays`                              |

Don't save whether a 타이머 is running or how much time is left. That is output
state (see the recovery record).

### 이름표 list (`labels.json`)

| Field      | Type                                       | Meaning                                             | Source                                        |
| ---------- | ------------------------------------------ | --------------------------------------------------- | --------------------------------------------- |
| `labels[]` | Array                                      | The 이름표 list, in the order of the 이름표 menu.   | `Reflow` 이름표 menu                          |
| `.name`    | String                                     | Name. Unique in the list.                           | `Reflow`                                      |
| `.color`   | One of the eight colors above, or `"none"` | Color.                                              | `Reflow` color row, `LabelColorPicker` README |
| `.key`     | One key, or `null`                         | Jump key that outputs this 이름표 in 진행 (see 04). | Product log (each 이름표 has a jump key)      |

Defaults: 1절 (teal), 2절 (teal), 3절 (teal), 프리코러스 (green), 후렴 (yellow),
브리지 (violet), 간주 (gray), 엔딩 (none). Jump keys start empty (proposal). The
board spells 브릿지 and the design system spells 브리지. This spec follows the
design system.

### 환경설정 (`preferences.json`)

| Area       | Field                  | Type and default                             | UI name                                                                 | Source                |
| ---------- | ---------------------- | -------------------------------------------- | ----------------------------------------------------------------------- | --------------------- |
| General    | `language`             | `"ko"`                                       | 언어: 한국어 (language: Korean). Version 1 has Korean only.             | `Prefs`               |
| General    | `onLaunch`             | `"lastService"`                              | 시작할 때: 마지막 예배 열기 (on launch: open the last service)          | `Prefs`               |
| General    | `backupCopies`         | Integer, 10                                  | 복구 사본 10개 (10 recovery copies). See recovery copies below.         | `Prefs`               |
| Output     | `showOnLaunch`         | Boolean, false                               | 켤 때 화면 출력 (output on launch)                                      | `Prefs`               |
| Output     | `preventSleep`         | Boolean, true                                | 출력 중 절전 막기 (prevent sleep during output)                         | `Prefs`               |
| Output     | `alwaysOnTop`          | Boolean, true                                | 출력 창 항상 위 (output windows always on top)                          | `Prefs`               |
| Output     | `onDisconnect`         | `"window"`                                   | 화면 연결이 끊기면: 창으로 바꾸기                                       | `Prefs`               |
| Output     | `hardwareAcceleration` | Boolean, true                                | 하드웨어 가속 (hardware acceleration). Takes effect on the next launch. | `Prefs`               |
| Output     | `previewFps`           | Integer, 30                                  | 미리보기 30fps (preview frame rate)                                     | `Prefs`               |
| 라이브러리 | `backup.auto`          | Boolean, true                                | 자동 백업 (automatic backup)                                            | `Prefs`               |
| 라이브러리 | `backup.keep`          | Integer, 30                                  | 보관 30개 (keep 30)                                                     | `Prefs`               |
| Bible      | `bible.verseNumbers`   | Boolean, true                                | 절 번호 (verse numbers)                                                 | `Prefs`               |
| Bible      | `bible.maxLines`       | Integer, 4                                   | 한 장 최대 줄 수 (maximum lines per 장)                                 | `Prefs`               |
| Bible      | `bible.sourcePosition` | `"bottomRight"`                              | 출처 위치: 오른쪽 아래 (reference position: bottom right)               | `Prefs`               |
| Import     | `import.txt.split`     | `"blankLine"` \| `"lineBreak"` \| `"symbol"` | 장 나누기: 빈 줄 (split: blank line)                                    | `Prefs`, `ImportText` |
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

- Store only the shortcuts that differ from the defaults:
  `{ "bindings": { "<command ID>": [["Ctrl", "1"]] } }`. An empty array means
  "none".
- 06 lists the command IDs and default shortcuts.

Source: `Shortcuts`, `KeyCap` README.

### Bible (`bible.json`)

| Field            | Type  | Meaning                                                                                                                | Source                |
| ---------------- | ----- | ---------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `translations[]` | Array | Installed translations: `id`, `name` (개역한글), `lang` (한국어), `file` (translation file name), `default` (Boolean). | `Prefs` 성경 (Bible)  |
| `recents[]`      | Array | Recent passages: `ref` and `translation` from the Bible passage object. Up to 10 (proposal).                           | `Bible` 최근 (recent) |

### `app.json` in the app data folder (proposal)

| Field                                           | Meaning                                                                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `dataRoot`                                      | The data folder.                                                                                                       |
| `songsPath`, `mediaPath`, `backupPath`          | The 환경설정 song, media, and backup locations. Empty means the default folder under the data folder.                  |
| `lastServiceId`                                 | The last opened 예배 순서.                                                                                             |
| `layout.narrow`, `layout.normal`, `layout.wide` | Per size class: the left and right column widths and thumbnail columns that the operator set (design system `Layout`). |
| `previewBig`                                    | The screen ID shown large in the 진행 preview.                                                                         |
| `macroView`, `macroCollection`                  | View and collection of the 매크로 tab.                                                                                 |
| `mediaStrip`                                    | Whether the operator left the media strip open. The size class and window height rules apply first.                    |
| `lastBackupAt`                                  | Time of the last backup.                                                                                               |

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
- Importing media copies the file into the media folder (see 05, open question).

## Bible translations

- Store each translation text as one file in the `bible\` folder of the app data
  folder. The format follows the offline data of the user's copible repository
  (`D:\programming\copible`) (open question).
- Version 1 ships 개역한글 and KJV. 개역한글 is the default. Don't include
  개역개정 until the Korean Bible Society permits its use.
- 역본 추가 (add translation) in 환경설정 adds a file in the same format.
  See 06.

Source: `Main` remaining items (Bible translations), `Prefs` 성경, `Bible`,
product log (copible, offline data preferred), `docs/HANDOFF.md` (개역한글 and
KJV).

## Schema versions and migration

- If a file's `schemaVersion` is lower than the version the app knows, convert
  it to the current version in memory. Write the file in the new version the
  next time it changes. Before the first write in the new version, keep the old
  version as a recovery copy (proposal).
- If a file's `schemaVersion` is higher than the version the app knows, open the
  file read-only. The operator can't edit it. Its row shows a warning icon, with
  the reason in a tooltip (proposal).
- If `format` is wrong or the JSON is broken, don't touch the file. Skip that
  file and keep running. Write a log entry and show one warning notification
  (`docs/TECH.md` storage).
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
  Copy the song, service, 틀, and settings folders into a `<date time>\` folder
  in the backup location (proposal). Leave out media files because of their size
  (proposal).
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

Content of `recovery\live.json` (proposal):

| Field                 | Meaning                                                                       | Row in the recovery dialog                 |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| `savedAt`             | Write time                                                                    | The time in the dialog's details           |
| `outputs`             | Screen ID to output on or off                                                 | 화면 출력 (screen output)                  |
| `serviceId`, `itemId` | Current service and current item                                              | 마지막 장 (last 장)                        |
| `slide`               | The live 장: song ID or Bible reference, 구성 name, position in the sequence  | 마지막 장                                  |
| `media`               | Current background media ID                                                   | 마지막 장 (proposal)                       |
| `props`               | IDs of the 소품 that are on                                                   | 표시 중이던 항목 (items that were showing) |
| `messages`            | 메시지 that are showing: template ID, blank values, target screens, time left | 표시 중이던 항목                           |
| `stageMessage`        | Stage message text                                                            | 표시 중이던 항목                           |
| `notice`              | 공지 set ID, current image position, targets, paused                          | 표시 중이던 항목                           |
| `stageLayouts`        | Stage screen ID to current stage layout ID                                    | 표시 중이던 항목 (proposal)                |
| `timers`              | 타이머 ID to state, start time, time left                                     | Not restored (proposal)                    |
| `audio`               | Audio that was playing                                                        | Not restored (proposal)                    |

- Create `recovery\session.lock` at launch and delete it on a clean exit. If the
  file exists at launch, treat the last exit as a crash and open the output
  state recovery dialog. See 08.
- These things aren't saved either: undo history of clears, undo history of
  edits, an imported song before 저장, and the selection and open menus in 진행.

Source: `Main` service notes ("출력 상태는 파일에 넣지 않습니다"), `Main`
decision "복구는 출력 상태만", `Recovery` (three restore rows), product log
versions 61 and 62.
