# 09. Later

This document lists the features that the sources defer past version 1, and the
hooks that version 1 must leave open so that each feature can come later without
restructuring. It ends with the ideas that the sources dropped, which aren't
planned at all.

Terms: 슬라이드 (slide), 방송 화면 (broadcast captions), 퀵 실행 (quick launch),
매크로 (macro), 라이브러리 (library), 구성 (arrangement). See 01.

## NDI network controls (later)

The NDI sender for the 방송 화면 is in 03. The network interface, NDI group,
receiver count in the display layout, and preview background selector remain
later work. Their saved fields are kept (02 and 06).

## PowerPoint import

### What it is

- 파일 > 가져오기 > PowerPoint 파일 (PowerPoint file) converts a `.pptx` file
  into an `.llsong` song, like the text import.
- The 환경설정 import page already shows the options: 슬라이드 하나 (one slide)
  → 슬라이드 하나 (one 슬라이드), and 배경 이미지 가져오기 (import background
  images, off).
- Sermon slide items such as "설교" (슬라이드 12개) in the board samples may
  come from this import (open question).

### Hooks version 1 must leave open

- Make import formats a registry (`docs/TECH.md`).
- Keep the import flow independent of the format: read, split, preview dialog,
  song editor, save with the duplicate title check (see 05). A PowerPoint reader
  then only adds the read step.
- In version 1, show the menu item as unavailable (see 01).

Source: product log (2026-10-24: txt and pptx import as converters into
`.llsong`; version 57 menu entries), `ImportMenu`, `Prefs`.

## Score display

### What it is

- Scores are for the congregation screen, not for musicians. A 슬라이드 shows
  only as much of the score as the lyrics on that 슬라이드.
- The method is undecided: images, MusicXML, or other data. The user treats it
  as a separate axis to keep thinking about.
- Musician features (chords, transposition, arrangement versions for players)
  are out of scope.

### Hooks version 1 must leave open

- Draw each content kind with its own renderer, registered in a content kind
  registry.
- Keep unknown song fields, including fields inside each 슬라이드, when you save
  (see 02).
- Keep media kinds and importers extensible.

Source: product log (2026-10-24: score display deferred past version 1, built so
it can be added without restructuring), `Main` decision "1차 버전은 가사만",
`Main` remaining items ("악보 방식"). The backup boards `Sheets` and
`OutputsSheet` aren't part of this spec.

## Camera input

### What it is

- The user plans to add camera input later.
- ProPresenter registers video inputs (USB, Thunderbolt, SDI, NDI, Syphon)
  app-wide in Preferences > Input (S4 pp. 177 to 180), and uses them in the
  Media Bin (p. 21), as a slide action (p. 86), as a fill for slide objects (p.
  61), and on the Video Input layer of a Look (p. 39). The plan is to add
  cameras the same way.

### Hooks version 1 must leave open

- Keep room for an app-wide input list next to the screen list (for example, a
  future `inputs.json`, proposal).
- Keep media kinds open for a future `"input"` kind (see 02).
- Keep 매크로 action kinds in a registry, so that "turn on an input" is an
  addition (see 07).
- Keep 슬라이드 element and content kinds in a registry.
- Let the media layer hold a live video source, not only a file.

Source: product log version 63, `Main` decision "카메라 입력은 나중에", `Main`
"프로프리젠터와 다른 점", `docs/TECH.md` registries.

## Cloud or multi-machine use

### What it is

No source describes this feature. This section only lists properties of version
1 that keep the option open.

### Properties version 1 already has

- Every object has a UUID ID (see 02).
- Songs and services are self-contained JSON files that refer to media by ID.
  File paths exist only in the media list.
- Every change to the output state is a serializable command that goes through
  one path in the main process (see 01). A remote control or a second machine
  could send the same commands later.
- The song, media, and backup locations are configurable.

## Lobby screen

- The app doesn't use a lobby screen for now. It has three screens.
- Hook: keep the screen list as data, and key 테마 screens by screen ID (see
  12).

Source: product log (2026-10-24), `Main` decision "화면 세 개".

## Installer and updates

- `docs/PLAN.md` puts the installer in a later stage. `docs/TECH.md` says the
  app never updates itself and the user installs new versions by hand.
- The 환경설정 update page in the board (지금 확인 check now, 자동 확인 check
  automatically, 채널 channel, 예배 중에는 미루기 postpone during a service)
  waits until then. Version 1 shows only the current version (see 06, open
  question).

## Scheduled 매크로

- Running a 매크로 at a set time (the clock badge with "10:30") waits until a
  board shows where to set the time. Version 1 keeps the `schedule` field
  reserved (see 07, open question).

## Dropped ideas (not planned)

These ideas moved to the backup page of the boards or were replaced. Don't build
them.

| Idea                                                                                          | What replaced it                                               | Source                                   |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| Cue-then-take output                                                                          | A click outputs at once                                        | product log version 61                   |
| Loading a 구성 from past services                                                             | Named 구성 stored in the song                                  | product log version 61                   |
| A service file that also holds screens, 테마, 매크로, and other settings (version 62 "scene") | App-wide settings, a 테마 per item or switched by start 매크로 | product log version 63                   |
| A 다중 레이어 지우기 (Clear Groups) button                                                    | 매크로 with clear actions (see 07)                             | product log 2026-10-24, `Main` decisions |
| Broadcast streaming and recording                                                             | OBS                                                            | product log 2026-10-23                   |
| Musician features                                                                             | None (out of scope)                                            | product log 2026-10-24                   |
| Bible PowerPoint export, TXT export, and styled clipboard copy from Copible                   | LoveLight outputs Bible passages directly                      | Bible scope decision, November 9         |
