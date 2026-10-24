# 07. 매크로

A 매크로 (macro) is a button that runs several actions at once. This document
covers the 매크로 tab, running 매크로, the right-click menu, the action palette
and action kinds, collections, start 매크로 on 예배 순서 items, and the decision
to replace Clear Groups with 매크로 in version 1.

Terms: 출력 (output), 지우기 (clear), 장 (slide), 예배 순서 (service order),
진행 도구 (show tools), Look, 소품 (prop), 공지 (notice), 메시지 (message),
타이머 (timer), 무대 화면 (stage screen), 준비 (Prep workspace). See 01.

## What a 매크로 is

- A 매크로 has a name, an icon, a color, and an ordered list of actions. 매크로
  are app-wide settings (see 02).
- 매크로 live in the 매크로 tab of the 진행 도구. Like ProPresenter, the app has
  no separate 매크로 editor window. The operator edits 매크로 with the
  right-click menu and the action palette.

Source: `Main` board guide (매크로), `Main` decision "매크로", `Main`
"프로프리젠터와 다른 점" (매크로 편집), product log (매크로 redrawn after
ProPresenter).

## The 매크로 tab

### Header

- A collection select (folder icon, for example "주일 예배") and the count
  ("8개", 8 매크로).
- A view toggle: 격자 보기 (grid view) and 목록 보기 (list view).
- The collection select lists 모든 매크로 (all 매크로) and each collection
  (proposal for 모든 매크로).

### Grid view

- Each 매크로 is a 64 px colored tile with its icon, and its name below (up to
  two lines).
- A 새 매크로 (new 매크로) tile with a dashed outline sits at the end. Clicking
  it creates a 매크로 named "새 매크로" with a default icon and color, and opens
  its name in rename mode (proposal).

### List view

- Each row has a small color tile with the icon, the name, and at the right the
  scheduled time with a clock icon ("10:30") and the action count ("동작 4개", 4
  actions).

### Tile states

| State                                        | Look                                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Last run                                     | White ring and bold name. Only one 매크로 has it at a time.                                                       |
| Selected (right-click menu open, or editing) | Blue ring. It takes priority over the last run ring.                                                              |
| Scheduled                                    | A clock badge at the top right. The tooltip and the accessible name include the time ("예배 시작, 10:30에 실행"). |
| Problem                                      | An amber warning icon, with the missing target in the tooltip (proposal, see "Running a 매크로").                 |

- A 매크로 isn't something on output, so the last run ring is white, not red.
- The last run mark isn't saved across launches (proposal).

### Keyboard

- When a tile or row has keyboard focus (through Tab), the arrow keys move
  between tiles or rows, and Enter or Space runs the 매크로. Shift+F10 or the
  menu key opens the right-click menu.
- A mouse click on a tile doesn't give it keyboard focus, so Space after a click
  still goes to 다음 장 instead of running the 매크로 again (decided; 10, focus
  precedence).
- Each 매크로 can have its own shortcut, with no default key (decided; follows
  ProPresenter's Key Mappings for macros, 10).

Source: `Macros`, `Overlays` 매크로 tab, `MacroTile` README.

## Running a 매크로

- Clicking a tile runs the 매크로 at once, with no confirmation. The last run
  mark moves to it.
- Run the actions in list order. Each action is a command that goes through the
  main process like any other command (see 01). Version 1 has no wait or delay
  action (proposal).
- If an action's target no longer exists (for example, a deleted Look), skip
  that action and run the rest. The tile shows the problem state, with the
  missing target in the tooltip (proposal).
- An action can run another 매크로. To stop loops, skip a 매크로 that is already
  running in the same chain, and stop at a depth of 4 (proposal).
- All clear actions in one run count as one clear for undo. Undo restores every
  layer that run cleared (proposal; see 03).

Source: `MacroTile` README (runs at once, no confirmation), `docs/TECH.md`
(commands go through one path).

## Right-click menu

| Item                            | Behavior                                                                                                                                                                                                                                 | Source                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 실행 (run)                      | Runs the 매크로.                                                                                                                                                                                                                         | `Macros`                            |
| 이름 바꾸기 (rename)            | Puts the name into rename mode (proposal).                                                                                                                                                                                               | `Macros`                            |
| 아이콘 바꾸기 (change icon)     | Opens a grid of design system icons. Choosing one applies it (proposal).                                                                                                                                                                 | `Macros`                            |
| 색 (color)                      | A row of the eight colors (no "none"). A choice applies at once, and the menu stays open.                                                                                                                                                | `Macros`, `LabelColorPicker` README |
| 동작 추가 (add action)          | A submenu of action kinds. Each kind opens a submenu of targets. Choosing a target appends the action (proposal for the target submenus).                                                                                                | `Macros`                            |
| 동작 편집 (edit action)         | A submenu of the 매크로's actions. Choosing one opens its parameters in a popover (proposal).                                                                                                                                            | `Macros`                            |
| 동작 빼기 (remove action)       | A submenu of the 매크로's actions. Choosing one removes it, without confirmation (proposal).                                                                                                                                             | `Macros`                            |
| 복제 (duplicate)                | Adds a copy named "<name> 복사본" (copy) right after it (proposal).                                                                                                                                                                      | `Macros`                            |
| 모음 (collections)              | A submenu of collections with check marks. Choosing one adds the 매크로 to that collection or removes it. The last item is 새 모음 (new collection) (proposal).                                                                          | `Macros`                            |
| 시작할 때 실행 (run at startup) | A checkable item. See "Run at startup".                                                                                                                                                                                                  | `Macros`                            |
| 삭제 (delete)                   | Asks in a confirmation dialog, for example "‘예배 시작’ 매크로를 삭제할까요?" (Delete this 매크로?). If 예배 순서 items use it as a start 매크로, the detail says how many ("예배 순서 항목 3곳에서 씀") (proposal). The item isn't red. | `Macros`, `Menu` README             |

Separators split the menu into these groups: 실행; 이름 바꾸기, 아이콘 바꾸기,
색; 동작 추가, 동작 편집, 동작 빼기; 복제, 모음, 시작할 때 실행; 삭제.

## Action palette

- The 동작 팔레트 (action palette) is a panel with a close button, a search
  field (placeholder "동작 찾기", find action), and groups of draggable rows:

| Group          | Actions                                                         |
| -------------- | --------------------------------------------------------------- |
| 화면 (screen)  | Look 바꾸기 (change Look), 무대 화면 배치 (stage screen layout) |
| 지우기 (clear) | 모두 지우기 (clear all), 레이어 지우기 (clear layer)            |
| 내용 (content) | 배경 미디어 (background media), 소품, 메시지, 공지              |
| 소리 (sound)   | 오디오 (audio), 오디오 재생 목록 (audio playlist)               |
| 진행 (show)    | 타이머, 매크로                                                  |

- Dragging an action onto a 매크로 tile appends it. A popover then asks for the
  target, for example which Look (proposal).
- No board shows how to open the palette (open question). Version 1 adds "동작
  팔레트" as the last item of the 동작 추가 submenu. The palette floats over the
  진행 도구 panel (proposal).

Source: `Macros`.

## Action kinds

The 동작 추가 submenu lists the same kinds as the palette, with short names:
Look, 지우기, 미디어, 오디오, 소품, 메시지, 공지, 무대, 타이머, 매크로. Register
action kinds in a registry, so that later kinds (such as turning on a camera
input) are additions, not changes (see `docs/TECH.md` and 09).

| Action           | Parameters                                                                                                           | Effect                                                                                         | Example in the board                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Look 바꾸기      | Look ID                                                                                                              | Sets the current Look (see 03).                                                                | "Look 평상시", "Look 설교"                                                                 |
| 무대 화면 배치   | Screen ID (default: the 무대 화면) and stage layout ID                                                               | Changes the current stage layout. Not saved (see 03).                                          | None                                                                                       |
| 모두 지우기      | None                                                                                                                 | Same as F1.                                                                                    | "지우기 모두"                                                                              |
| 레이어 지우기    | A layer (가사 lyrics, 미디어 media, 소품, 오디오 audio, 메시지, 공지), or one 소품 (proposal)                        | Same as F2 to F7 for that layer, or turns off that one 소품.                                   | "지우기 가사"; "지우기 카운트다운" read as turning off the 시작 카운트다운 소품 (proposal) |
| 배경 미디어      | Media ID                                                                                                             | Outputs the media as the background (see 03).                                                  | "배경 따뜻한 빛"                                                                           |
| 소품             | 소품 ID and a mode: 켜기 (on, default), 끄기 (off), 바꾸기 (toggle) (proposal for the mode)                          | Turns the 소품 on, off, or over.                                                               | "소품 설교 본문 자막", "소품 로고"                                                         |
| 메시지           | Template ID, blank values, target screens, display time                                                              | Sends the 메시지 (see 04).                                                                     | None                                                                                       |
| 공지             | 공지 set ID                                                                                                          | Starts the 공지 set on its target screens from its first image (proposal for the start image). | "공지 주일 광고"                                                                           |
| 오디오           | A track (media ID), or 페이드 아웃 (fade out), or 멈춤 (stop) (proposal for the list)                                | Plays the track, or fades out or stops the audio.                                              | "오디오 페이드 아웃", "오디오 헌금 연주"                                                   |
| 오디오 재생 목록 | Audio playlist ID                                                                                                    | Plays the playlist from its first track.                                                       | None                                                                                       |
| 타이머           | 타이머 ID and an operation: 시작 (start, default), 일시 정지 (pause), 처음으로 (reset) (proposal for the operations) | Controls the 타이머.                                                                           | "타이머 예배 경과", "타이머 설교"                                                          |
| 매크로           | 매크로 ID                                                                                                            | Runs that 매크로 (see the loop rule above).                                                    | None                                                                                       |

### The board's sample 매크로

The `Macros` and `Overlays` boards show these 매크로 in the collection 주일
예배. They're examples of what the operator can build. Version 1 starts with no
매크로 (proposal).

| 매크로                                     | Color  | Actions                                                              |
| ------------------------------------------ | ------ | -------------------------------------------------------------------- |
| 예배 시작 (service start), scheduled 10:30 | green  | Look 평상시, 지우기 카운트다운, 오디오 페이드 아웃, 타이머 예배 경과 |
| 찬양 (praise), last run                    | teal   | Look 평상시, 배경 따뜻한 빛                                          |
| 말씀 (sermon)                              | slate  | Look 설교, 소품 설교 본문 자막, 타이머 설교                          |
| 광고 (announcements)                       | yellow | Look 광고, 공지 주일 광고                                            |
| 헌금 (offering)                            | orange | 오디오 헌금 연주, 소품 온라인 헌금 안내                              |
| 영상 (video)                               | rose   | Look 영상만, 지우기 가사                                             |
| 축도 (benediction)                         | violet | 지우기 모두, 소품 로고                                               |
| 예배 끝 (service end)                      | gray   | 오디오 축도 후 연주, 소품 로고                                       |

Source: `Macros`, `Overlays`.

## Collections

- A collection groups 매크로. The collection select in the tab header picks
  which 매크로 the tab shows.
- A 매크로 can be in several collections (proposal). 모든 매크로 shows every
  매크로 (proposal).
- A 매크로 created while a collection is shown joins that collection (proposal).
- 새 모음 in the 모음 submenu creates a collection. The collection select's menu
  has 이름 바꾸기 and 삭제 for the shown collection. Deleting a collection never
  deletes its 매크로 (proposal).

Source: `Macros` (collection 주일 예배, 8개), `Main` decision "매크로".

## Start 매크로 on 예배 순서 items

- The operator sets a start 매크로 in the 시작할 때 (on start) row of the item
  settings in 준비 (see 05).
- It runs when the item starts, before the 장 draws (see 03 and 04).
- It doesn't run when the operator only selects the item, moves between 장 of
  the same item, or looks at the item in 준비.
- Typical uses: change the Look for a section, clear several layers at once, set
  a background, or start a 타이머. To make services look different from each
  other, keep several Looks and switch them with start 매크로.

Source: `PrepService` (시작할 때: 찬양 매크로), `Main` decisions "라이브러리와
예배 순서는 따로" and "설정은 앱 전체에 하나", product log version 63.

## Run at startup (open question)

- The right-click menu has 시작할 때 실행 (run at startup). This spec reads it
  as running the 매크로 once after the app starts, like ProPresenter's trigger
  on startup (proposal, open question).
- Run startup 매크로 in list order, after a normal launch or after the operator
  answers 새로 시작 (start fresh) in the output state recovery dialog. Don't run
  them after 복구 (restore), so that they don't undo the restored state
  (proposal; see 08).
- A startup 매크로 shows the clock badge.

## Scheduled 매크로 (open question)

- The `MacroTile` README shows a clock badge and "10:30에 실행" (runs at 10:30)
  for scheduled 매크로, and the list view shows "10:30". No board shows where to
  set the time or how a scheduled run behaves.
- Version 1 leaves out scheduling by time and keeps the `schedule` field
  reserved (proposal).

## Clearing several layers at once

- Version 1 has no button that clears a chosen set of layers at once
  (ProPresenter's Clear Groups, called "다중 레이어 지우기" here). The user
  decided this on 2026-10-24.
- To clear several layers at once, put several 레이어 지우기 actions in a
  매크로. If the clear belongs to a moment in the service, set that 매크로 as
  the start 매크로 of the 예배 순서 item. For example, a 매크로 with 레이어
  지우기 가사, 레이어 지우기 소품, and Look 설교, set as the start 매크로 of the
  sermon item.
- The comparison board moved to the backup page. The `ClearButton` README says
  the same.

Source: `Main` decision "다중 레이어 지우기는 v1에서 뺌", `Main` "프로프리젠터와
다른 점" (지우기), `ClearButton` README, product log (2026-10-24, version 65),
`docs/decisions.md`.
