# 테마, 오버레이, and per-item screens

Status: M4. The concept was agreed with the user on October 30, and the open
points on October 31 (the approval page, accepted as proposed).

This file replaces the Looks section of 03, the lyric styles and stage layouts
of 02 and 06, and the 화면 설정 parts that edit them. 메시지 styles, 공지 sets,
and 그래픽 keep their own files and behavior.

## Why

The user's needs (October 30):

1. Each 예배 순서 item can lay out its screens differently.
2. Some items show completely different things on each screen.
3. Some items leave a screen unused.
4. Each item places elements freely on each screen.
5. The freedom is limited, like a very simple Photoshop.

A Look only shows or hides layers, and one 배경 layer goes to every screen, so
"video A on the 본 화면, video B on the 무대 화면, lyrics on the 방송 자막" is
impossible. ProPresenter's Looks likewise turn layers on and off per screen (S4
pp. 37 to 38), so it has the same limit.

## Concepts

- A 테마 (theme) is a saved preset that sets all three screens at once: 본 화면,
  무대 화면, and 방송 자막.
- Each screen of a 테마 has one mode:
  - 직접 배치 (own layout): the screen has its own canvas of elements.
  - `<screen>`과 동일 (same as another screen): a live link. The screen always
    shows exactly what the named screen shows, including later edits. It is not
    a copy.
  - 비움 (empty): nothing from the item. The screen shows its empty color (see
    "Empty screens").
- A canvas is 1920 x 1080 reference pixels. Every size and position is in
  reference pixels and scales to the screen's real resolution.
- An element is one of a fixed set of kinds (see "Elements"). There are no
  free-form objects.
- Every 예배 순서 item uses one 테마: the one it names, or else the default 테마
  of its kind (곡, 성경, 공지, 미디어).
- The 대기 화면 (standby screen) is a special 테마 that shows when nothing is
  live. See "항목 끄기 and the 대기 화면".
- An 오버레이 (overlay) is content that stays on screen across a range of
  슬라이드 in one item. See "오버레이".

## Elements

| Element        | Content comes from                                           | Screens        | Per screen |
| -------------- | ------------------------------------------------------------ | -------------- | ---------- |
| 현재 가사      | The live 슬라이드's text: lyrics or a Bible verse            | All            | One        |
| 성경 출처      | The live Bible 슬라이드's reference; empty on other 슬라이드 | All            | One        |
| 다음 가사      | The next 슬라이드's text                                     | All            | One        |
| 이름표         | The live 슬라이드's 이름표                                   | All            | One        |
| 다음 이름표    | The next 슬라이드's 이름표                                   | All            | One        |
| 미디어         | The live 슬라이드 when it is a photo or a video              | All            | One        |
| 배경           | The item's background (the 곡 배경 today)                    | All            | One        |
| 오버레이       | The item's 오버레이 for the live 슬라이드                    | All            | One        |
| 항목 이름      | The live item's name                                         | All            | One        |
| 글             | Fixed text written in the 테마                               | All            | Several    |
| 그림           | A fixed image from the media list                            | All            | Several    |
| 사각형         | A filled box                                                 | All            | Several    |
| 시계           | The current time                                             | All            | One        |
| 타이머         | A 타이머 picked in the element                               | All            | Several    |
| 영상 남은 시간 | Time left of the video playing on the media layer            | All            | One        |
| 무대 메시지    | The stage message sent from 진행 도구                        | 무대 화면 only | One        |
| 메모           | The live 슬라이드's memo                                     | 무대 화면 only | One        |

- 무대 메시지 and 메모 exist only on the 무대 화면 so that the audience never
  sees them. The editor offers them only there, and a paste onto another screen
  is refused.
- A Bible verse is a 슬라이드, so 현재 가사 shows it. Only 성경 출처 is extra.
- 공지, 메시지, and 그래픽 are not elements. Each keeps its own look and the
  screens it is sent to, and they always draw on top of the 테마 in the order
  공지, 그래픽, 메시지. A 테마 can't hide them.
- When an item's content has no element to show it, for example a 곡 item whose
  테마 has no 현재 가사 on the 본 화면, the item's settings show a warning mark
  with the reason in its tooltip and a 테마 편집… button.

### Element properties

| Property         | Applies to                                  | Range                                                 |
| ---------------- | ------------------------------------------- | ----------------------------------------------------- |
| X, Y, W, H       | All                                         | Inside the canvas; W and H at least 8                 |
| 글꼴, 굵기       | Text elements                               | An installed family; 100 to 900                       |
| 크기             | Text elements                               | 12 to 400                                             |
| 색               | Text elements, 사각형                       | `#RRGGBB`                                             |
| 줄 간격          | Text elements                               | 0.8 to 3.0                                            |
| 가로 정렬        | Text elements                               | 왼쪽, 가운데, 오른쪽                                  |
| 세로 위치        | Text elements                               | 위, 가운데, 아래                                      |
| 최대 줄 수       | 현재 가사, 다음 가사                        | 1 to 12; the text shrinks to fit (03, "Drawing text") |
| 외곽선, 그림자   | Text elements                               | The ranges of the lyric style effects (02)            |
| 채우기, 불투명도 | 사각형, and the box behind any text element | `#RRGGBB`; 0 to 100                                   |
| 모서리           | 사각형, 그림, 미디어, 배경                  | 0 to 200                                              |
| 맞춤             | 그림, 미디어, 배경, 오버레이                | 맞추기, 채우기, 늘리기 (the media properties' 맞춤)   |

Text elements are 현재 가사, 성경 출처, 다음 가사, 이름표, 다음 이름표, 항목
이름, 글, 시계, 타이머, 영상 남은 시간, 무대 메시지, and 메모.

On and off properties (외곽선, 그림자, 채우기) are checkboxes, not switches
(user, October 31).

다음 이름표 keeps the stage layout element of today (06). 영상 남은 시간 follows
ProPresenter's Video Countdown; ProPresenter has no native next-item name, only
through Planning Center (S4 pp. 41 to 42), so there is no 다음 항목 이름
element.

### Limits

- At most 10 elements per screen. The 요소 header shows the count and the limit,
  for example "4 / 10".
- No rotation, effects beyond outline and shadow, masks, or blend modes.
- Snap to the grid and to other elements' edges and centers, as the 무대 배치
  editor does today.

## Which 테마 applies

- When a 예배 순서 item's first 슬라이드 goes out, its 테마 applies to every
  screen, in the same batch as the item start (03, "When the operator clicks a
  슬라이드"). The start 매크로 runs before it, as today.
- A 슬라이드 output from outside the 예배 순서 (퀵 실행, the Bible panel, the
  toolbar search) counts as a new item: it uses the default 테마 of its kind and
  ends a 테마 picked by hand.
- The 테마 stays until another item starts or the operator changes it by hand.

### 테마 바꾸기

- The toolbar button that was Look shows the live 테마's name. Its menu lists
  the 테마 as radio rows, a separator, and 테마 편집…, which opens the 테마
  workspace. The 출력 menu rows follow it.
- The 매크로 action Look 바꾸기 becomes 테마 바꾸기, with a 테마 as its target.
- A 테마 picked by hand or by a 매크로 holds until the next item starts; then
  the new item's 테마 applies.
- Edits to the live 테마 in the editor apply to the output at once.

Switching the 테마 with the item is our design. In ProPresenter a Look stays
until the operator or an action changes it (S4 pp. 37 to 38).

## Drawing a screen

1. Resolve the screen's mode in the live 테마. `<screen>과 동일` draws the named
   screen's composition; the editor never lets two screens point at each other.
2. In 직접 배치, draw the elements from the bottom of the element list to the
   top. The top of the list is in front.
3. Draw 공지, 그래픽, and 메시지 above them, each only on the screens it was
   sent to.
4. A cleared layer draws nothing in the elements that show it: 지우기 가사
   empties 현재 가사, 다음 가사, 이름표, and 성경 출처; 지우기 미디어 empties
   미디어 and 배경; 지우기 모두 empties every element that shows live content.
   Fixed elements (글, 그림, 사각형, 시계) stay, so a cleared 본 화면 can still
   show the church logo.

### Empty screens

- Each screen has one 빈 화면 색 (empty color), set in the 화면 설정 window:
  black by default, and `chroma` green on the 방송 자막 when its method is the
  capture window, as today.
- A screen in 비움, or a screen with nothing live and no 대기 화면 element,
  shows its 빈 화면 색.
- A 테마 screen in 직접 배치 has a 배경색 that starts as 화면 기본 (the screen's
  빈 화면 색) and can be set per 테마.

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
  zoom percentage, zoom in, and 화면에 맞춤 on the right, as the 무대 배치
  editor.
- **Right column:** the three screens small on top (a click switches the
  canvas), then panel-header tabs 요소 | 화면. 요소 shows the selected element's
  properties. 화면 shows the mode, the 배경색, and the size. Selecting an
  element opens 요소; clicking empty canvas opens 화면.

Editing:

- Add an element by dragging a 요소 추가 tile into the 요소 list (at that place
  in the order, centered on the canvas) or onto the canvas (at that spot). Enter
  on a focused tile adds it at the center.
- Delete with the row's trash button, Delete, or right-click 삭제. The element
  goes back to 요소 추가.
- Right-click an element: 맨 앞으로 가져오기, 앞으로 가져오기, 뒤로 보내기, 맨
  뒤로 보내기, then 복사, 붙여넣기, 삭제.
- Ctrl C and Ctrl V copy elements, with position and look, between screens and
  테마. Ctrl A selects every element of the screen. Pasting a one-per-screen
  kind the screen already has replaces its position and look.
- Every edit saves at once, as other settings do (06).

The 테마 list row's right-click (list-row rules, 11): 기본으로 쓰기 › (곡, 성경,
공지, 미디어, with a check on the kinds that use it) | 복제, 이름 바꾸기 | 삭제.
The row shows the kinds that use it as small tags. The live 테마's row shows
LIVE to the left of those tags (user, October 31), because an edit to it changes
the output at once. 복제 makes `<name> 복사본`. 삭제 asks first when a kind or
an item uses the 테마; its items fall back to their kind's default. The 대기
화면 row has no 삭제 and no 기본으로 쓰기.

## 오버레이

- An item may have several 오버레이. Each has content (a video, an image, or
  text), a range (슬라이드 n부터 m까지), the screens it shows on, and for a
  video 반복 or 멈춤 and 소리.
- Ranges never overlap: at most one 오버레이 per 슬라이드.
- Where it shows on a screen is the 테마's 오버레이 element. No default 테마 has
  one, so most items never use 오버레이. Whoever needs one makes a 테마 for the
  item (복제, then add the element).
- Edit it in the item's 오버레이 table (draft K): one row per 슬라이드, one
  오버레이 column. The start row holds the 오버레이's name and a vertical bar
  covers every row of the range, from the top of the start row to the bottom of
  the end row, through the row borders. A small spacing-token gap at each outer
  end separates adjacent ranges; a one-row range also spans its row.
- When an item has 오버레이 rows but its 테마 has no 오버레이 element on a
  screen the 오버레이 targets, the table header shows a warning mark with the
  reason in its tooltip and 테마 편집….
- Example (user, October 30): a 특송 item with an MR video on the 무대 화면
  only, across every lyric 슬라이드, while the 본 화면 and the 방송 자막 show
  the lyrics as usual.

## 항목 끄기 and the 대기 화면

- 항목 끄기 takes the live item off every screen in one step: its 슬라이드, its
  배경, and its 오버레이. Its control is a 항목 button first in 진행's 지우기
  row, shaped like the other clear buttons, with the tooltip 항목 끄기, and a
  출력 menu row. Its shortcut comes with the shortcut review (B7). Unlike 지우기
  모두, it leaves 공지, 그래픽, and 메시지 on screen. 실행 취소 (undo) brings
  the item back, as for a clear (03, "Undo").
- With nothing live, every screen shows the 대기 화면 테마, for example the
  church logo on the 본 화면, the clock on the 무대 화면, and nothing on the
  방송 자막. The same screens show at launch when outputs turn on and nothing is
  live.
- The 대기 화면 is edited in the same editor and can't be deleted. Elements that
  show live content (현재 가사, 미디어, 오버레이, and the like) aren't offered
  on it.

## Data

### `Settings\themes.json`

| Field      | Type                        | Meaning                                                     |
| ---------- | --------------------------- | ----------------------------------------------------------- |
| `standby`  | Theme                       | The 대기 화면.                                              |
| `themes[]` | Array of Theme, at most 200 | The 테마 list.                                              |
| `defaults` | Object: kind to theme ID    | The default 테마 of `song`, `bible`, `notice`, and `media`. |

Theme:

| Field        | Type                               | Meaning                                        |
| ------------ | ---------------------------------- | ---------------------------------------------- |
| `id`, `name` | String                             | ID and name, at most 80 characters.            |
| `screens`    | Object: screen ID to Screen layout | One entry per screen; a missing entry is 비움. |

Screen layout:

| Field      | Type                                                                               | Meaning                                |
| ---------- | ---------------------------------------------------------------------------------- | -------------------------------------- |
| `mode`     | `{ "kind": "own" }` \| `{ "kind": "same", "screen": ID }` \| `{ "kind": "empty" }` | 직접 배치, `<screen>`과 동일, or 비움. |
| `elements` | Array of Element, at most 10, bottom first                                         | Used only in `own`.                    |

Element: `id`, `kind` (`currentText`, `reference`, `nextText`, `label`, `media`,
`background`, `overlay`, `itemName`, `text`, `image`, `box`, `clock`, `timer`,
`stageMessage`, `memo`, `nextLabel`, `videoTimeLeft`), `frame` `{ x, y, w, h }`,
and the properties of its kind from "Element properties" (`text` fields as the
lyric style in 02, `box` with fill, opacity, and radius, `fit`, and per kind
`content` for 글, `mediaId` for 그림, `timerId` for 타이머, `clockFormat` for
시계). Keep unknown fields, as every settings file does (02).

### Item fields (`.llservice`)

| Field        | Type                        | Meaning                                                                                                                                                          |
| ------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme`      | String (theme ID), optional | The item's 테마. Absent: the kind's default.                                                                                                                     |
| `overlays[]` | Array, at most 50, optional | `id`, `name`, `from`, `to` (슬라이드 positions, 1-based), `screens[]`, `content` (`{ "media": ID, "loop": Boolean, "sound": Boolean }` or `{ "text": String }`). |

### Defaults and old files

- A new `themes.json` holds 찬양, 말씀, 광고, and 영상 as the defaults of 곡,
  성경, 공지, and 미디어 (draft E's names), and a 대기 화면 with nothing on any
  screen. Their layouts copy today's defaults: the 평상시 Look, the lyric styles
  기본 and 하단 자막, and the stage layout 현재와 다음.
- `looks.json` and `stage-layouts.json` are no longer read. No user files exist
  yet, so there is no migration (decision of October 26).

## What changes elsewhere

- 03: the Looks section, the Look parts of "Layers and stacking order", and
  "무대 화면 and stage layouts" are replaced by this file.
- 02: `looks.json` and `stage-layouts.json` are replaced by `themes.json`;
  `messageStyles` move to `messages.json` with the 메시지 templates.
- 06 and the 화면 설정 workspace: the workspace becomes 테마 and holds the 테마
  editor in place of the Look editor, the 가사 스타일 section, and the 무대 배치
  editor. Screens and monitors move to the 화면 설정 window.
- 07: the 매크로 action Look 바꾸기 becomes 테마 바꾸기 ("테마 바꾸기" above).
- 11: the toolbar Look button and the 출력 menu's Look rows become 테마 바꾸기;
  출력 › 화면 설정… opens the 화면 설정 window; the 지우기 row gains 항목.
- 04: the 진행 지우기 row starts with 항목 (항목 끄기).
