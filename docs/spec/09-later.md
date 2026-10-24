# 09. Later

This document lists the features that the sources defer past version 1, and the
hooks that version 1 must leave open so that each feature can come later without
restructuring. It ends with the ideas that the sources dropped, which aren't
planned at all.

Terms: 장 (slide), 방송 자막 (broadcast captions), 퀵 실행 (quick run), 매크로
(macro), 라이브러리 (library), 구성 (arrangement). See 01.

## NDI output

### What it is

- The 방송 자막 goes to OBS over NDI with an alpha channel, so OBS needs no
  chroma key. The user prefers this method because it matches the idea of a
  virtual display.
- The green capture window stays as the fallback for setups without NDI.
- The app still doesn't stream. OBS streams.

### What the boards already show

| Place                               | Content                                                                                                                                                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screen properties, 출력 group       | 방식 (method): NDI, 소스 이름 (source name, "LOVELIGHT 방송 자막"), 해상도 (resolution), 프레임 수 (frame rate, 30fps), 알파 채널 (alpha channel, on), 미리보기 배경 (preview background: 초록 green, 검정 black, 체크 무늬 checkerboard; default green) |
| Screen properties, 네트워크 group   | 보낼 곳 (network interface, "이더넷 192.168.0.12"), NDI 그룹 (NDI group, "public")                                                                                                                                                                       |
| Display layout                      | An NDI box that shows "보내는 중 수신 1" (sending, 1 receiver)                                                                                                                                                                                           |
| Status bar                          | "방송 자막 NDI 30fps"                                                                                                                                                                                                                                    |
| Toolbar tooltip and preview caption | Target name "NDI"                                                                                                                                                                                                                                        |

### Requirements outside the app

- OBS needs the DistroAV plugin and the NDI Runtime.
- The NDI SDK is free to use here because the app is non-commercial, used in one
  church, and not distributed. If that changes (for example, the app is
  distributed), check the SDK redistribution terms and the NDI trademark rules
  again.

### Hooks version 1 must leave open

- Accept and keep the screen value `method: "ndi"` and the screen's `ndi` object
  (see 02).
- Make output targets a registry (monitor window, capture window, later NDI), as
  `docs/TECH.md` describes.
- Draw the background as a layer, not as the window or page background, so the
  renderer can produce frames with a transparent background later.
- Keep the 방송 자막 preview background choice in the data
  (`previewBackground`).
- Run native modules only in a helper process (`docs/TECH.md`).

Source: product log (2026-10-24 NDI update, version 56, version 61 SDK note),
`Main` decisions "방송 자막은 NDI로" and "NDI SDK", `Main` remaining items,
`ScreensNDI`, `docs/TECH.md`.

## PowerPoint import

### What it is

- 파일 > 가져오기 > PowerPoint 파일 (PowerPoint file) converts a `.pptx` file
  into an `.llsong` song, like the text import.
- The 환경설정 import page already shows the options: 슬라이드 하나 (one slide)
  → 장 하나 (one 장), and 배경 이미지 가져오기 (import background images, off).
- Sermon slide items such as "설교" (12장) in the board samples may come from
  this import (open question).

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

- Scores are for the congregation screen, not for musicians. A 장 shows only as
  much of the score as the lyrics on that 장.
- The method is undecided: images, MusicXML, or other data. The user treats it
  as a separate axis to keep thinking about.
- Musician features (chords, transposition, arrangement versions for players)
  are out of scope.

### Hooks version 1 must leave open

- Draw each content kind with its own renderer, registered in a content kind
  registry.
- Keep unknown song fields, including fields inside each 장, when you save (see
  02).
- Keep media kinds and importers extensible.

Source: product log (2026-10-24: score display deferred past version 1, built so
it can be added without restructuring), `Main` decision "1차 버전은 가사만",
`Main` remaining items ("악보 방식"). The backup boards `Sheets` and
`OutputsSheet` aren't part of this spec.

## Camera input

### What it is

- The user plans to add camera input later.
- ProPresenter registers video inputs (USB capture devices, SDI, NDI) app-wide
  under Settings > Inputs, and uses them as media bin items, as slide and 매크로
  actions, and as slide elements. The plan is to add cameras the same way.

### Hooks version 1 must leave open

- Keep room for an app-wide input list next to the screen list (for example, a
  future `inputs.json`, proposal).
- Keep media kinds open for a future `"input"` kind (see 02).
- Keep 매크로 action kinds in a registry, so that "turn on an input" is an
  addition (see 07).
- Keep 장 element and content kinds in a registry.
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

## 퀵 실행 shortcuts

- The user deferred shortcut keys for 퀵 실행 items. The 퀵 실행 list shows no
  shortcuts.
- The shortcuts board shows a 퀵 실행 group (검은 화면 Ctrl B, 로고 화면 with no
  shortcut). Version 1 leaves it out (open question).
- Hook: store shortcuts by command ID (see 02 and 06), so that per-item commands
  such as `quick.<item ID>` can be added later.

Source: product log (진행 screen direction), `Main` decision "단축키",
`Shortcuts`.

## Lobby screen

- The app doesn't use a lobby screen for now. It has three screens.
- Hook: keep the screen list as data, and key Looks by screen ID (see 02).

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

| Idea                                                                                           | What replaced it                                          | Source                                   |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------- |
| Cue-then-take output                                                                           | A click outputs at once                                   | product log version 61                   |
| Loading a 구성 from past services                                                              | Named 구성 stored in the song                             | product log version 61                   |
| A service file that also holds screens, Looks, 매크로, and other settings (version 62 "scene") | App-wide settings, several Looks switched by start 매크로 | product log version 63                   |
| A 다중 레이어 지우기 (Clear Groups) button                                                     | 매크로 with clear actions (see 07)                        | product log 2026-10-24, `Main` decisions |
| Broadcast streaming and recording                                                              | OBS                                                       | product log 2026-10-23                   |
| Musician features                                                                              | None (out of scope)                                       | product log 2026-10-24                   |
