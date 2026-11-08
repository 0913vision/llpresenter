# 테마, 오버레이, and per-item screens

Status: M4. The concept was agreed with the user on October 30, and the open
points on October 31 (the approval page, accepted as proposed).

This file is the single source for what a screen shows. 메시지 styles and 그래픽
keep their own files and behavior.

## Why

The user's needs (October 30):

1. Each 예배 순서 item can lay out its screens differently.
2. Some items show completely different things on each screen.
3. Some items leave a screen unused.
4. Each item places elements freely on each screen.
5. The freedom is limited, like a very simple Photoshop.

Showing or hiding layers, with one 배경 layer for every screen, cannot give
"video A on the 청중 화면, video B on the 무대 화면, lyrics on the 방송 화면".
ProPresenter's Looks turn layers on and off per screen (S4 pp. 37 to 38), so
they have the same limit. A 테마 sets the elements of each screen itself.

## Concepts

- A 테마 (theme) is a saved preset that sets all three screens at once: 청중
  화면, 무대 화면, and 방송 화면.
- Each screen of a 테마 has one mode:
  - 직접 배치 (own layout): the screen has its own canvas of elements.
  - `<screen>`과 동일 (same as another screen): a live link. The screen always
    shows exactly what the named screen shows, including later edits. It is not
    a copy.
  - 비움 (empty): nothing from the item. The screen shows its empty color (see
    "Empty screens").
- A screen with no layout in a 테마, such as one added in 화면 설정 after the
  테마 was made, takes the mode `<first screen of its kind>`과 동일 in every
  테마, so it shows what its group shows the moment it is added. The first
  screen of a kind with no layout is 비움. Picking a mode and then the earlier
  one back leaves the 테마 without edits. If the first screen of a kind is
  deleted or moved, the screens that follow it by default follow the new first
  screen.
- Ctrl Z and Ctrl Y (실행 취소, 다시 실행) in the 테마 workspace step through
  the unsaved edits of the working copy, mode changes included, back to the last
  save.
- A canvas is 1920 x 1080 reference pixels. Every size and position is in
  reference pixels and scales to the screen's real resolution.
- The editor fits that canvas to a measurement area independent of its
  scrollbars. Selecting an element, dragging, typing or editing a property keeps
  the canvas size and position unchanged. Selection handles fit inside the
  reserved canvas margin; only explicit zoom or workspace resizing changes the
  fit.
- An element is one of a fixed set of kinds (see "Elements"). There are no
  free-form objects.
- Every 예배 순서 item uses one 테마: the one it names, or else the default 테마
  of its kind (곡, 성경, 미디어).
- The 대기 화면 (standby screen) is a special 테마 that shows when nothing is
  live. See "항목 끄기 and the 대기 화면".
- An 오버레이 (overlay) is content that stays on screen across a range of
  슬라이드 in one item. See "오버레이".

## Elements

| Element        | Content comes from                                                                 | Screens        | Per screen |
| -------------- | ---------------------------------------------------------------------------------- | -------------- | ---------- |
| 현재 가사      | The live 슬라이드's text: lyrics or a Bible verse                                  | All            | One        |
| 성경 출처      | The live Bible 슬라이드's reference, or its item's whole passage range             | All            | One        |
| 다음 가사      | The next 슬라이드's text                                                           | All            | One        |
| 이름표         | The live 슬라이드's 이름표                                                         | All            | One        |
| 다음 이름표    | The next 슬라이드's 이름표                                                         | All            | One        |
| 미디어         | The live 슬라이드 when it is a photo or a video                                    | All            | One        |
| 배경           | The item's background (the 곡 배경 today)                                          | All            | One        |
| 오버레이       | The item's 오버레이 for the live 슬라이드                                          | All            | One        |
| 항목 이름      | The live item's name                                                               | All            | One        |
| 슬라이드 이름  | The live 슬라이드's name (`slideName`), an 광고 text slide's name; empty otherwise | All            | One        |
| 글             | Fixed text written in the 테마                                                     | All            | Several    |
| 이미지         | A fixed image from the media list                                                  | All            | Several    |
| 사각형         | A filled box                                                                       | All            | Several    |
| 시계           | The current time                                                                   | All            | One        |
| 타이머         | A 타이머 picked in the element                                                     | All            | Several    |
| 영상 남은 시간 | Time left of the video playing on the media layer                                  | All            | One        |
| 무대 메시지    | The stage message sent from 진행 도구                                              | 무대 화면 only | One        |
| 메모           | The live 슬라이드's memo                                                           | 무대 화면 only | One        |

- 무대 메시지 and 메모 exist only on the 무대 화면 so that the audience never
  sees them. The editor offers them only there, and a paste onto another screen
  is refused.
- A Bible verse is a 슬라이드, so 현재 가사 shows it. Only 성경 출처 is extra.
- 메시지 and 그래픽 are not elements. Each keeps its own appearance and the
  screens it is sent to, and they always draw on top of the 테마 in the order
  그래픽, 메시지. A 테마 can't hide them.
- A 메시지 sent to several screens draws in each screen's 메시지 style, chosen
  over ProPresenter's style per 메시지 (user decision, October 28). Each screen
  picks its style in its 메시지 스타일 row in the 화면 설정 window, not in the
  테마, so a 메시지 keeps its look when the item and its 테마 change (06; user
  decision, November 2).
- When an item's content has no element to show it, for example a 곡 item whose
  테마 has no 현재 가사 on the 청중 화면, the item's settings show a warning
  mark with the reason in its tooltip and a 테마 편집 button.

### Element properties

Geometry fields in the 테마 editor display the nearest 0.1 reference-canvas
pixel, omitting trailing zeroes. Ties round toward positive infinity. Typing
retains the entered precision within the allowed range; display rounding does
not change the saved number. Dragging and resizing save the rounded geometry
shown on the canvas and in the fields. Arrow keys retain their existing
one-pixel increment (ten with Shift).

| Property         | Applies to                                  | Range                                                   |
| ---------------- | ------------------------------------------- | ------------------------------------------------------- |
| X, Y, W, H       | All                                         | Shown to 0.1 px; inside the canvas; W and H at least 8  |
| 글꼴, 굵기       | Text elements                               | An installed family; 100 to 900                         |
| 크기             | Text elements                               | 12 to 400                                               |
| 색               | Text elements, 사각형                       | `#RRGGBB`                                               |
| 줄 간격          | Text elements                               | 0.8 to 3.0                                              |
| 자간             | Text elements                               | -20 to 40 reference px; default 0                       |
| 출처 내용        | 성경 출처                                   | 현재 절 (default), 항목 범위                            |
| 가로 정렬        | Text elements                               | 왼쪽, 가운데, 오른쪽                                    |
| 세로 위치        | Text elements                               | 위, 가운데, 아래                                        |
| 성경 분할 줄 수  | Bible split-source text, in 화면 > 성경     | 1 to 12; Bible split budget at the configured size (04) |
| 외곽선, 그림자   | Text elements                               | On or off                                               |
| 채우기, 불투명도 | 사각형, and the box behind any text element | `#RRGGBB`; 0 to 100                                     |
| 모서리           | 사각형, 이미지, 미디어, 배경                | 0 to 200                                                |
| 맞춤             | 이미지, 미디어, 배경, 오버레이              | 맞추기, 채우기, 늘리기 (the media properties' 맞춤)     |

Text elements are 현재 가사, 성경 출처, 다음 가사, 이름표, 다음 이름표, 항목
이름, 슬라이드 이름, 글, 시계, 타이머, 영상 남은 시간, 무대 메시지, and 메모.
`slideName` has only the common text element properties.

성경 출처 with 항목 범위 shows the Bible item's whole passage on every slide,
including split continuations. Without an item range it falls back to the
slide's reference. Clearing the slide clears this element. 현재 절 keeps the
slide's reference and its passage visibility setting.

All text keeps its theme size while wrapped lines fit the full element frame;
only actual overflow shrinks it (03). The stored `maxLines` property is the
Bible split budget, exposed as 성경 분할 줄 수 under 화면 > 성경 for every
theme's first audience screen in saved screen order (or its first saved screen
if there is no audience screen). The editor's display sorting does not change
this choice. Follow screen links to the source screen to edit its first
current-text element's budget. Other screens and the text element properties do
not expose it. This editing path also covers nondefault themes assigned to Bible
items or blank items containing verses, without changing any default assignment.
Stored line budgets are retained when a theme's default assignment changes. It
does not shrink lyrics, including current/next text on stage and broadcast
layouts. The legacy `nextText.maxLines` field remains readable for compatibility
but has no editor control and does not constrain text fitting.

On and off properties (외곽선, 그림자, 채우기) are checkboxes, not switches
(user, October 31).

영상 남은 시간 follows ProPresenter's Video Countdown; ProPresenter has no
native next-item name, only through Planning Center (S4 pp. 41 to 42), so there
is no 다음 항목 이름 element.

### Limits

- At most 10 elements per screen. The 요소 header shows the count and the limit,
  for example "4 / 10".
- No rotation, effects beyond outline and shadow, masks, or blend modes.
- Snap to the grid and to other elements' edges and centers.

## Which 테마 applies

- When a 예배 순서 item's first 슬라이드 goes out, its 테마 applies to every
  screen, in the same batch as the item start (03, "When the operator clicks a
  슬라이드"). The start 매크로 runs before it, as today.
- A 슬라이드 output from outside the 예배 순서 (퀵 실행, the Bible panel, the
  toolbar search) counts as a new item: it uses the default 테마 of its kind and
  ends a 테마 picked by hand.
- The 테마 stays until another item starts or the operator changes it by hand.

### 테마 바꾸기

- The toolbar button shows only the live 테마's name under its icon, with 테마
  바꾸기 in its tooltip and accessible name. Its menu lists the 테마 as radio
  rows, a separator, and 테마 편집, which opens the 테마 workspace. The 출력
  menu rows follow it.
- The 매크로 action 테마 바꾸기 has a 테마 as its target (07).
- A 테마 picked by hand or by a 매크로 holds until the next item starts; then
  the new item's 테마 applies.
- Edits to the live 테마 reach the output when the editor saves them ("The 테마
  editor").

Switching the 테마 with the item is our design. In ProPresenter a Look stays
until the operator or an action changes it (S4 pp. 37 to 38).

## Drawing a screen

1. Resolve the screen's mode in the live 테마. `<screen>과 동일` draws the named
   screen's composition; the editor never lets two screens point at each other.
2. In 직접 배치, draw the elements from the bottom of the element list to the
   top. The top of the list is in front.
3. Draw 그래픽 and 메시지 above them, each only on the screens it was sent to.
4. A cleared layer draws nothing in the elements that show it: 지우기 가사
   empties 현재 가사, 다음 가사, 이름표, and 성경 출처; 지우기 미디어 empties
   미디어 and 배경; 지우기 모두 empties every element that shows live content.
   Fixed elements (글, 이미지, 사각형, 시계) stay, so a cleared 청중 화면 can
   still show the church logo.

### Empty screens

- Each screen has one 빈 화면 색 (empty color), set in the 화면 설정 window:
  black by default, and `chroma` green on the 방송 화면 when its method is the
  capture window, as today.
- A screen in 비움, or a screen with nothing live and no 대기 화면 element,
  shows its 빈 화면 색.
- A 테마 screen in 직접 배치 has one 배경: 화면 기본 (the screen's 빈 화면 색),
  단색, or 그라데이션. It sits behind all elements. Linked screens use the
  source screen's background; 비움 uses the screen's 빈 화면 색.
- A gradient is linear, with a clockwise angle from 0 to 359 degrees: 0 runs
  left to right, 90 top to bottom, and 135 top-right to bottom-left. It uses the
  screen rectangle's projected gradient line, including its aspect ratio.
- A gradient has 2 to 4 colors with positions from 0 to 100 percent in
  nondecreasing order. Equal positions create a hard edge. The angle, color
  swatches and hex fields, positions, and add/remove actions live together in
  the 화면 properties. Position edits stay between their neighbors; adding a
  color splits the widest interval. Changes preview immediately and use the same
  undo, redo, save, and leave-draft behavior as element properties.
- Every gradient uses OKLCH with the shorter hue path, as defined by
  [CSS Color 4](https://www.w3.org/TR/css-color/#interpolation); there is no
  mixing selector. Neutral and near-neutral endpoints (RGB channel spread at
  most 2 levels) borrow the adjacent endpoint's hue. The same renderer paints
  editor canvases, thumbnails and outputs, with a static, low-amplitude noise
  tile over the gradient to reduce projector banding. Solid colors remain
  untextured. A gradient is not treated as a uniform chroma-key background for
  message bands.

The Sunday background palette uses angle 135 and these exact stops; the two
three-stop entries keep their approved look with the single mixing method.

| Name     | Stops (percent, hex)                 |
| -------- | ------------------------------------ |
| 청록     | 36 #00303A, 87 #00667A               |
| 적갈     | 36 #3A0000, 61.5 #5A2500, 87 #7A4900 |
| 초록     | 36 #003A24, 87 #007A43               |
| 자주     | 36 #3A002E, 87 #AC00A0               |
| 청록초록 | 36 #003A28, 87 #00AC98               |
| 남보라   | 36 #2C003A, 87 #0073AC               |
| 올리브   | 36 #3A1900, 61.5 #5C4800, 87 #7D7A00 |
| 연초록   | 36 #7A9F5A, 67 #30A26A               |

### Transitions

- A 슬라이드 change inside one item uses the slide transition (03,
  "Transitions") on the elements whose content changed.
- A 테마 change between items uses the same transition on the whole screen;
  there is no separate setting.

### When a 테마 can't be used

A gap never blanks a screen:

- If the item's 테마 no longer exists, the screen uses its kind's default 테마.
- If that is gone too, or `themes.json` can't be read or hasn't been read yet,
  the screen uses the built-in 테마 of the kind: 현재 가사 full screen in the
  기본 text style over 배경, and 성경 출처 for Bible items.
- A missing font draws in Pretendard; a missing image or media file draws
  nothing in its element and reports the problem once (08).
- Each output window logs a missing 테마, font, or media once per screen and ID,
  for a bounded number of gaps, and logs again after `themes.json` changes.

## The 테마 editor

The 테마 workspace edits 테마 (draft E, version 28, accepted October 30). It is
today's 화면 설정 workspace, renamed. Screens and monitors (the screen list, the
display layout, the output preview, the test pattern, and the screen properties,
now with 빈 화면 색) move to the 화면 설정 window, opened by 출력 › 화면 설정…,
as ProPresenter keeps them in its Configure Screens window (S4 p. 32).

- **Left column:** the 테마 list, with the 대기 화면 at the top. Below it, 요소:
  the elements used on the current screen, top first (top is in front); drag a
  row to reorder; a hovered row shows a trash button. Below that, 요소 추가: the
  kinds not used yet on this screen, as tiles with kind icons in two columns.
- **Center:** the canvas of the current screen, header `<테마> / <screen>`. A
  bottom bar holds 격자에 맞추기 and 비율 고정 on the left, and zoom out, the
  zoom percentage, zoom in, and 화면에 맞춤 on the right.
- **Right column:** the three screens small on top (a click switches the
  canvas), then panel-header tabs 요소 | 화면. 요소 shows the selected element's
  properties. 화면 shows the mode, the 배경, and the size. Selecting an element
  opens 요소; clicking empty canvas opens 화면.

Editing:

- Add an element by dragging a 요소 추가 tile into the 요소 list (at that place
  in the order, centered on the canvas) or onto the canvas (at that spot). Enter
  on a focused tile adds it at the center.
- Delete with the row's trash button, Delete, or right-click 삭제. The element
  goes back to 요소 추가.
- Right-click an element: 맨 앞으로 가져오기, 앞으로 가져오기, 뒤로 보내기, 맨
  뒤로 보내기, then 복사, 붙여넣기, 삭제.
- Ctrl C and Ctrl V copy elements, with position and style, between screens and
  테마. Ctrl A selects every element of the screen. Pasting a one-per-screen
  kind the screen already has replaces its position and style.

Saving (user decision, November 1):

- Edits change a working copy of the open 테마 (canvas, element and screen
  properties, element order) and nothing else, so a stray drag never changes the
  items that share the 테마. The 테마 list row shows a small dot after the name
  while its working copy has unsaved edits.
- **Saving.** 저장 (Ctrl S), top right of the canvas, asks "<이름> 테마를
  덮어쓸까요?" with 취소 and 덮어쓰기. Under the question it counts the 예배
  순서 항목 that use the 테마 directly or as their kind's default ("쓰는 곳:
  예배 순서 항목 4곳"), and shows nothing at 0. 덮어쓰기 writes the 테마. 저장
  is disabled while there are no edits; its tooltip says so. 다른 이름으로 저장…
  (Ctrl Shift S) sits beside it: it asks for a name in the shared rename dialog,
  prefilled `<이름> 복사본` (`복사본 2`, 3, … when taken), and makes a new 테마
  from the working copy while the original keeps its saved state. 새 테마로 저장
  does not exist.
- **Leaving.** Choosing another 테마 row, another workspace, or closing the
  window or quitting while the working copy has edits asks 저장, 저장 안 함, or
  취소. 취소 keeps the window open on the 테마. The 저장 중 dialog of the close
  flush shows only after the answer.
- The output of the live 테마 changes only after 덮어쓰기. Other 테마 list
  changes (새 테마, 복제, 이름 바꾸기, 삭제, 기본으로 지정) write at once, as
  other settings do (06).

The 테마 list row's right-click (list-row rules, 11): 기본으로 지정 › (곡, 성경,
미디어, with a check on the kinds that use it) | 복제, 이름 바꾸기 | 삭제. The
row shows the kinds that use it as small tags. The live 테마's row shows LIVE to
the left of those tags (user, October 31), because saving it changes the output
at once. 복제 makes `<name> 복사본` (`복사본 2`, 3, … when taken). 삭제 asks
first when a kind or an item uses the 테마; its items fall back to their kind's
default. The 대기 화면 row has no 삭제 and no 기본으로 지정.

## 오버레이

- An item may have several 오버레이. Each has content (a video, an image, or
  text), a range (슬라이드 n부터 m까지), the screens it shows on, and for a
  video 반복 or 정지 and 소리.
- Ranges never overlap: at most one 오버레이 per 슬라이드.
- Where it shows on a screen is the 테마's 오버레이 element. No default 테마 has
  one, so most items never use 오버레이. Whoever needs one makes a 테마 for the
  item (복제, then add the element).
- Edit it on the 슬라이드, in 순서 편집 and in 준비's 슬라이드 list (05,
  "오버레이 on 슬라이드").
- When an item has an 오버레이 but its 테마 has no 오버레이 element on a screen
  the 오버레이 targets, the 슬라이드 list in 준비 shows a warning mark above the
  thumbnails with the reason in its tooltip and 테마 편집.
- Example (user, October 30): a 특송 item with an MR video on the 무대 화면
  only, across every lyric 슬라이드, while the 청중 화면 and the 방송 화면 show
  the lyrics as usual.

## 항목 끄기 and the 대기 화면

- 항목 끄기 takes the live item off every screen in one step: its 슬라이드, its
  배경, and its 오버레이. Its control is a 항목 button first in 진행's 지우기
  row, shaped like the other clear buttons, with the tooltip 항목 끄기, and a
  출력 menu row. Its shortcut comes with the shortcut review (B7). Unlike 지우기
  모두, it leaves 그래픽 and 메시지 on screen. 실행 취소 (undo) brings the item
  back, as for a clear (03, "Undo").
- After stopping, the 항목 button stays bright and pressed with the tooltip 항목
  복원. Pressing it again restores that item's 슬라이드, 배경, and 오버레이,
  resuming captured playback positions. It does not change the current 그래픽,
  메시지, or audio, including their clocks. Its one capture is temporary and new
  output content invalidates it, as for the other clear keys.
- With nothing live, every screen shows the 대기 화면 테마, for example the
  church logo on the 청중 화면, the clock on the 무대 화면, and nothing on the
  방송 화면. The same screens show at launch when outputs turn on and nothing is
  live.
- The 대기 화면 is edited in the same editor and can't be deleted. Elements that
  show live content (현재 가사, 미디어, 오버레이, and the like) aren't offered
  on it.

## Data

### `Settings\themes.json`

| Field      | Type                        | Meaning                                                                    |
| ---------- | --------------------------- | -------------------------------------------------------------------------- |
| `standby`  | Theme                       | The 대기 화면.                                                             |
| `themes[]` | Array of Theme, at most 200 | The 테마 list.                                                             |
| `defaults` | Object: kind to theme ID    | Optional default 테마 IDs for `song`, `bible`, `blank`, `ad`, and `media`. |

Theme:

| Field        | Type                               | Meaning                                                                                                                 |
| ------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `id`, `name` | String                             | ID and name, at most 80 characters.                                                                                     |
| `screens`    | Object: screen ID to Screen layout | One entry per screen; a missing entry is `<first screen of its kind>`과 동일, or 비움 for the first screen of its kind. |

Screen layout:

| Field      | Type                                                                               | Meaning                                |
| ---------- | ---------------------------------------------------------------------------------- | -------------------------------------- |
| `mode`     | `{ "kind": "own" }` \| `{ "kind": "same", "screen": ID }` \| `{ "kind": "empty" }` | 직접 배치, `<screen>`과 동일, or 비움. |
| `elements` | Array of Element, at most 10, bottom first                                         | Used only in `own`.                    |

`background` is optional. Its absence means 화면 기본. A `#RRGGBB` string is the
legacy 단색 representation and remains valid. A gradient uses this shape:

```json
{
  "kind": "linear",
  "angle": 135,
  "mixing": "oklch",
  "stops": [
    {"color": "#000000", "position": 0},
    {"color": "#FFFFFF", "position": 100}
  ]
}
```

`angle` is an integer from 0 to 359. `mixing` is fixed to `oklch`. There must be
2 to 4 stops with finite positions from 0 to 100 in nondecreasing order; every
color is a six-digit hex string. Unknown gradient and stop fields round-trip
like other settings extensions. Existing files need no migration; the layout
field is validated in both settings and live output payloads.

Element: `id`, `kind` (`currentText`, `reference`, `nextText`, `label`, `media`,
`background`, `overlay`, `itemName`, `slideName`, `text`, `image`, `box`,
`clock`, `timer`, `stageMessage`, `memo`, `nextLabel`, `videoTimeLeft`), `frame`
`{ x, y, w, h }`, and the properties of its kind from "Element properties"
(`text` fields as the text style of 02, `box` with fill, opacity, and radius,
`fit`, and per kind `content` for 글, `mediaId` for 이미지, `timerId` for
타이머, `clockFormat` for 시계, optional `source: "slide" | "item"` for 성경
출처, and optional `text.tracking` in reference pixels, default 0). Keep unknown
fields, as every settings file does (02).

### Item fields (`.llservice`)

| Field        | Type                        | Meaning                                                                                                                                                          |
| ------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme`      | String (theme ID), optional | The item's 테마. Absent: the kind's default.                                                                                                                     |
| `overlays[]` | Array, at most 50, optional | `id`, `name`, `from`, `to` (슬라이드 positions, 1-based), `screens[]`, `content` (`{ "media": ID, "loop": Boolean, "sound": Boolean }` or `{ "text": String }`). |

### Defaults

- New libraries include three ordinary, replaceable 1920 x 1080 pictures for
  말씀 and the two sermon title layouts. Existing catalogs and saved themes are
  kept as they are.
- 말씀 on 청중 화면 uses its full-screen teal picture, white NanumSquare Bold
  text without outline or shadow: an item-range 성경 출처 at 72 px, and 현재
  가사 at 104 px, left/top aligned, with -3 px tracking and 150 px line spacing.
  The text frame starts at (130.6, 248), is 1660 x 750, and has a five-line
  Bible split budget. Missing fonts fall back to Pretendard. 방송 화면 and 무대
  화면 retain their existing 말씀 layouts. The normal 배경 and 미디어 elements
  above the shipped picture retain item background overrides and blank picture
  slides, since blank items also use this theme by default.
- 설교 제목 and 설교 제목 (두 줄) are additional themes, not kind defaults. In a
  blank 슬라이드 item, set the item name to the passage range and the slide text
  to the sermon title, with a line break for the two-line layout. Choose the
  corresponding theme. The audience picture contains the rules; 항목 이름 uses
  white KoPubWorldDotum Medium 86 px with 6 px tracking and 현재 가사 uses Bold
  140 px with -6 px tracking, centered between the rules. Other screens retain
  their 말씀 layout. The picture and both text elements remain editable in the
  normal theme editor.
- `defaults.blank` selects 말씀 and `defaults.ad` selects 광고 in a new
  `themes.json`. Both can be changed like the other kind defaults.
- The 광고 theme draws these elements bottom to top on every screen: a
  full-screen #141c2e 사각형, a 24 px #e6b54a bar at the left, fixed text "교회
  소식", full-screen 미디어 with 채우기, 슬라이드 이름, and 현재 가사. The
  heading starts at (150, 190); the slide name uses 132 px, weight 800; body
  text uses 60 px, line height 1.55, and #c9d1e0. A picture slide has no current
  text or name, so its media covers the fixed frame below it.
- Item settings warn when a screen's resolved theme lacks 현재 가사 for text,
  슬라이드 이름 for an 광고 name, or 미디어 for a picture. Linked screens use
  the source screen's elements when checking.
- The other built-in defaults are 찬양 for 곡, 말씀 for 성경, and 영상 for
  미디어. The 대기 화면 starts with a clock and timer on stage.

## Where the rest of the spec uses 테마

- 03: the layers of an output and the stacking order follow "Drawing a screen".
- 02: `themes.json` holds the 테마. `messageStyles` live in `messages.json` with
  the 메시지.
- 06 and the 화면 설정 workspace: the workspace is 테마 and holds the 테마
  editor. Screens and monitors are in the 화면 설정 window.
- 07: the 매크로 action 테마 바꾸기 ("테마 바꾸기" above).
- 11: the toolbar 테마 button and the 출력 menu's 테마 바꾸기 row; 출력 › 화면
  설정… opens the 화면 설정 window; the 지우기 row has 항목.
- 04: the 진행 지우기 row starts with 항목 (항목 끄기).
