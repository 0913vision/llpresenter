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

| Element        | Content comes from                                                                                 | Screens        | Per screen |
| -------------- | -------------------------------------------------------------------------------------------------- | -------------- | ---------- |
| 현재 가사      | The live 슬라이드's text: lyrics or a Bible verse                                                  | All            | One        |
| 성경 출처      | The live Bible 슬라이드's reference, or its item's whole passage range                             | All            | One        |
| 다음 가사      | The next 슬라이드's text                                                                           | All            | One        |
| 이름표         | The live 슬라이드's 이름표                                                                         | All            | One        |
| 다음 이름표    | The next 슬라이드's 이름표                                                                         | All            | One        |
| 미디어         | The live 슬라이드 when it is a photo or a video                                                    | All            | One        |
| 배경           | The item's background (the 곡 배경 today)                                                          | All            | One        |
| 오버레이       | The item's 오버레이 for the live 슬라이드                                                          | All            | One        |
| 항목 이름      | The live item's name                                                                               | All            | One        |
| 슬라이드 이름  | The live 슬라이드's name (`slideName`), an 광고 text slide's name; empty otherwise                 | All            | One        |
| 슬라이드 번호  | The live 광고 text slide's position among text slides, 1-based; empty for pictures and other kinds | All            | One        |
| 글             | Fixed text written in the 테마                                                                     | All            | Several    |
| 이미지         | A fixed user image or bundled theme picture                                                        | All            | Several    |
| 사각형         | A filled box                                                                                       | All            | Several    |
| 시계           | The current time                                                                                   | All            | One        |
| 타이머         | A 타이머 picked in the element                                                                     | All            | Several    |
| 영상 남은 시간 | Time left of the video playing on the media layer                                                  | All            | One        |
| 무대 메시지    | The stage message sent from 진행 도구                                                              | 무대 화면 only | One        |
| 메모           | The live 슬라이드's memo                                                                           | 무대 화면 only | One        |

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

| Property            | Applies to                                  | Range                                                                             |
| ------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| X, Y, W, H          | All                                         | Shown to 0.1 px; inside the canvas; W and H at least 8                            |
| 글꼴, 굵기          | Text elements                               | An installed family; 100 to 900                                                   |
| 크기                | Text elements                               | 12 to 400                                                                         |
| 색                  | Text elements, 사각형                       | `#RRGGBB`                                                                         |
| 줄 간격             | Text elements                               | 0.8 to 3.0                                                                        |
| 자간                | Text elements                               | -20 to 200 reference px; default 0                                                |
| 짧은 글 자간        | Text elements                               | Off by default; 최대 글자 수 1 to 10, alternate 자간 -20 to 200 px                |
| 글머리 기호         | Text elements                               | Checkbox, off by default; one hanging bullet per nonempty paragraph               |
| 출처 내용           | 성경 출처                                   | 현재 절 (default), 항목 범위                                                      |
| 가사 없을 때 가운데 | 항목 이름                                   | Checkbox, off by default; use the frame's vertical center when 현재 가사 is empty |
| 가로 정렬           | Text elements                               | 왼쪽, 가운데, 오른쪽                                                              |
| 세로 위치           | Text elements                               | 위, 가운데, 아래                                                                  |
| 성경 분할 줄 수     | Bible split-source text, in 화면 > 성경     | 1 to 12; Bible split budget at the configured size (04)                           |
| 외곽선, 그림자      | Text elements                               | On or off                                                                         |
| 채우기, 불투명도    | 사각형, and the box behind any text element | `#RRGGBB`; 0 to 100                                                               |
| 모서리              | 사각형, 이미지, 미디어, 배경                | 0 to 200                                                                          |
| 맞춤                | 이미지, 미디어, 배경, 오버레이              | 맞추기, 채우기, 늘리기 (the media properties' 맞춤)                               |

Text elements are 현재 가사, 성경 출처, 다음 가사, 이름표, 다음 이름표, 항목
이름, 슬라이드 이름, 글, 시계, 타이머, 영상 남은 시간, 무대 메시지, and 메모.
`slideName` has only the common text element properties.

슬라이드 번호 counts the item's text slides in saved order, excluding picture
slides. Reordering, inserting or deleting slides updates that number in output
and previews, including automatic advance. It is empty when no slide is live, on
picture slides, and on other item kinds. Its common text properties remain
editable; it is not available in the 대기 화면.

With 글머리 기호 enabled, operators type plain text. Each explicit line starts a
paragraph with an Arial bullet; automatic wrapping stays under the paragraph
text. Empty lines remain blank. Hanging indent is 90/86 em and the paragraph gap
is 23/86 em, scaling with the font size. 줄 간격 sets spacing within a wrapped
paragraph. At 86 px these styles have a 90 px indent and a 23 px paragraph gap;
with 104.5 px line spacing their paragraph pitch is about 128 px. The optional
`disc` bullet style uses a round marker instead: at 86 px, its diameter is 20
px, its top-left is (19, 56) relative to the paragraph, and the hanging indent
is 107 px. It has no extra paragraph gap and wraps only at spaces; 줄 간격
determines the pitch of both wrapped and explicit lines. Marker geometry scales
with the font size. Without this style, existing Arial bullets remain unchanged.
Both output and thumbnails use this layout; the stored text is unchanged.

Measured Bible wrap rows retain the verse's paragraph instead of starting a new
bullet or paragraph gap on every row. A later part of the same verse keeps the
hanging indent without repeating the bullet. Output, next-text elements, split
previews and thumbnails use the measured part identity for this rule.

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
- A gradient has 2 to 4 colors at nondecreasing positions from 0 to 100 percent.
  Equal positions create a hard edge. Its 화면 properties show preset picture
  tiles, 각도, and a full-width left-to-right stop bar. New gradients start from
  청록. Presets are hidden for 화면 기본 and 단색.
- A preset replaces angle and stops in one undo step and selects the first stop.
  Its tile is selected only while those visible values match. The list lives in
  one core constant, in the palette order below.
- A handle selects one stop; only its 색 swatch/hex, 위치 percentage and delete
  button appear below the bar. Dragging moves it across neighbors, updates the
  preview and position immediately, and makes one undo step. Position fields
  also allow crossing neighbors; color identity follows the moved stop.
- Clicking empty track adds and selects a stop at that position, sampled with
  the output's OKLCH interpolation and native sRGB conversion. Addition stops at
  four colors; deletion stops at two. Delete or Backspace removes a focused
  handle. Left/Right move it by 1 percent, or 10 with Shift. Handles are
  focusable and named with their ordinal and position, such as 색 1, 36 %.
- Changes use the same undo, redo, save and leave-draft behavior as element
  properties. Read-only and linked layouts retain their existing edit guards.
- Every gradient uses OKLCH with the shorter hue path, as defined by
  [CSS Color 4](https://www.w3.org/TR/css-color/#interpolation); there is no
  mixing selector. Neutral and near-neutral endpoints (RGB channel spread at
  most 2 levels) borrow the adjacent endpoint's hue. The same renderer paints
  editor canvases, thumbnails and outputs, with a static, low-amplitude noise
  tile over the gradient to reduce projector banding. Solid colors remain
  untextured. A gradient is not treated as a uniform chroma-key background for
  message bands.

The gradient preset list uses angle 135 and these exact stops, in the order
below. The first eight are the church palette, followed by the extra choices.
밝은 초록 preserves the deck's 36/67 stops. 어두운 초록 is the former 연초록;
its stops and position in the list stay unchanged. Themes store gradient values,
not preset names or indices, so the rename does not change existing themes.

| Name        | Stops (percent, hex)                |
| ----------- | ----------------------------------- |
| 청록        | 0 #002E38, 100 #00768C              |
| 적갈        | 0 #3A0000, 50 #5A2500, 100 #7A4900  |
| 초록        | 0 #13452C, 100 #3B8440              |
| 자주        | 0 #3A002E, 100 #AC00A0              |
| 청록초록    | 0 #003A28, 100 #008474              |
| 남보라      | 0 #2C003A, 100 #0073AC              |
| 올리브      | 0 #3A1900, 50 #5C4800, 100 #7D7A00  |
| 어두운 초록 | 0 #567A40, 100 #1F7D4E              |
| 새벽        | 20 #141B3F, 95 #4A2A78              |
| 노을        | 20 #2E0A2C, 70 #7A2238, 100 #B0522A |
| 바다        | 20 #0A1F3F, 95 #0F6470              |
| 밤하늘      | 10 #070B18, 100 #1C2856             |
| 성탄        | 20 #0B3325, 95 #6E0E1C              |
| 부활        | 20 #261246, 95 #8C6A22              |
| 성령        | 20 #2E0606, 95 #A8381A              |
| 은혜        | 20 #1A222D, 95 #465565              |
| 묵상        | 10 #121212, 100 #343434             |
| 감사        | 20 #321F0E, 95 #8E5E27              |
| 오로라      | 15 #0A2433, 55 #1F5E4A, 95 #4A2F78  |
| 밝은 초록   | 36 #7A9F5A, 67 #30A26A              |

### Transitions

- A slide's own transition overrides the between-item or within-item default
  (03, "Transitions"). Lyric elements move across the same screen distance and
  share the same wipe edge, including layouts with separate text boxes.
- A 테마 change between items applies the incoming slide effect to the whole
  screen after its content is ready; there is no separate setting. The same
  timing covers a changed item or song background within one theme. Media items
  that are their own cues retain the media transition (03).
- Theme editing previews redraw immediately without any transition. This also
  applies to 준비, song and slide editing previews; only live output and its
  진행 preview animate.

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
  배경, and its 오버레이. Its control is a 대기 화면 button first in 진행's
  지우기 row, shaped like the other clear buttons, with the tooltip 대기
  화면으로. A `space-12` group gap separates it from the six clears at every
  width, including the narrow icon-only row. The 출력 menu and shortcut list
  keep the command name 항목 끄기. It has no default shortcut: the standard-key
  audit in 10 found no equivalent item-only toggle. The operator can assign one.
  Unlike 지우기 모두, it leaves 그래픽 and 메시지 on screen. 실행 취소 (undo)
  brings the item back, as for a clear (03, "Undo").
- After stopping, the 대기 화면 button stays bright and pressed with the tooltip
  항목 되돌리기. Pressing it again restores that item's 슬라이드, 배경, and
  오버레이, resuming captured playback positions. It does not change the current
  그래픽, 메시지, or audio, including their clocks. Its one capture is temporary
  and new output content invalidates it, as for the other clear keys.
- With nothing live, every screen shows the 대기 화면 테마: initially the
  church's service times on the 청중 화면, the clock and timer on the 무대 화면,
  and nothing on the 방송 화면. The same screens show at launch when outputs
  turn on and nothing is live.
- The 대기 화면 is edited in the same editor and can't be deleted. Elements that
  show live content (현재 가사, 미디어, 오버레이, and the like) aren't offered
  on it.

## Data

### `Settings\themes.json`

Built-in themes and the standby layout come from the running version. The file
contains user themes and only built-in themes explicitly saved after editing,
marked `edited: true`. Unmarked built-in entries are ignored and removed on
load. An unedited `standby` is omitted from storage. Theme IDs and defaults
remain stable, so existing item references continue to resolve. Up to 200 user
themes may coexist with the built-in themes.

| Field      | Type                                                   | Meaning                                                                    |
| ---------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `standby`  | Optional Theme                                         | The 대기 화면.                                                             |
| `themes[]` | Array of Theme, at most 200 user themes plus built-ins | The 테마 list.                                                             |
| `defaults` | Object: kind to theme ID                               | Optional default 테마 IDs for `song`, `bible`, `blank`, `ad`, and `media`. |

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
`background`, `overlay`, `itemName`, `slideName`, `slideNumber`, `text`,
`image`, `box`, `clock`, `timer`, `stageMessage`, `memo`, `nextLabel`,
`videoTimeLeft`), `frame` `{ x, y, w, h }`, and the properties of its kind from
"Element properties" (`text` fields as the text style of 02, `box` with fill,
opacity, and radius, `fit`, and per kind `content` for 글, `mediaId` for 이미지,
`timerId` for 타이머, `clockFormat` and optional boolean `seconds` for 시계
(absent means false), optional `source: "slide" | "item"` for 성경 출처,
optional `text.tracking` in reference pixels, default 0, optional
`text.bullets`, a Boolean defaulting to false, and optional
`text.bulletStyle: "disc"` for the round hanging markers). Keep unknown fields,
as every settings file does (02).

### Item fields (`.llservice`)

| Field        | Type                        | Meaning                                                                                                                                                          |
| ------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme`      | String (theme ID), optional | The item's 테마. Absent: the kind's default.                                                                                                                     |
| `overlays[]` | Array, at most 50, optional | `id`, `name`, `from`, `to` (슬라이드 positions, 1-based), `screens[]`, `content` (`{ "media": ID, "loop": Boolean, "sound": Boolean }` or `{ "text": String }`). |

### Defaults

- New libraries include seven 구역 이름 color themes for a blank 슬라이드 item.
  항목 이름 supplies the Korean name without inserted spaces; its one slide text
  supplies the English name, which may be empty. On 청중 화면 both use white
  KoPubWorldDotum without shadow or outline: Bold 152 px at y=412, tracking 52
  px, and Light 56 px at y=613, tracking 34 px. The Korean frame is 240 px high
  and enables 가사 없을 때 가운데: with an empty English line, its ink starts
  near y=460 between the rules; otherwise it starts near y=415. Korean names of
  up to two characters use 152 px tracking. The centered short-text option
  compensates for the change in CSS trailing spacing so the visual center stays
  fixed. Counts use Unicode code points excluding whitespace and generated
  continuation markers, so wrapping does not change the decision. Literal marker
  text still counts. Empty text keeps ordinary tracking. Measurement, output and
  thumbnails use the same rule, including edits and scaling. The two gray rules
  are an ordinary transparent picture, at x=700, y=305/759, 520 x 5 px, #737D87.
- The section theme's short-text option includes per-name tracking overrides:
  회개와간구의기도 uses 40 px and 봉헌 uses 52 px, both without short-text
  center compensation. All section names retain 152 px type. 찬양, 광고 and 축도
  retain 152 px tracking; the other names use 52 px. These defaults apply to new
  themes; saved themes are not overwritten. Output, measurement and thumbnails
  share the overrides, including renaming and scaling.
- Changing a service item's theme also updates its section card theme in the
  same undo step, including when the item returns to its kind default.
- Each section card selects its color's 구역 이름 theme, with no item background
  media. Its audience layout uses the matching `GRADIENT_PRESETS` gradient
  directly, including OKLCH mixing and dither. The seven generated section PNGs
  are not shipped. The core section list contains, in order: 묵상기도, 사도신경,
  회개와간구의기도, 찬양, 합심기도, 봉헌, 봉헌기도, 성찬식, 축복기도, 세례식,
  간구기도, 광고, 축도. Their colors are 청록, 청록, 적갈, 초록, 적갈, 자주,
  자주, 청록초록, 남보라, 청록초록, 적갈, 남보라, 올리브. English is empty for
  묵상기도; the others use Apostle's Creed, Repentance Prayer, Praise, Corporate
  Prayer, Offering, Offering Prayer, Holy Communion, Blessing, Baptism,
  Supplication Prayer, Notice, Benediction. These themes are not kind defaults;
  Broadcast shows the Korean name and uppercase English in its blue card; stage
  shows only the Korean name as current text. Untouched saved section layouts
  resolve the same way; edited layouts stay unchanged. The stage choice follows
  the November 11 user decision.
- In new libraries, 찬양 on 청중 화면 uses white NanumSquare ExtraBold
  (weight 800) at 108 px, centered horizontally and top aligned, with -3 px
  tracking, 137 px line spacing, and no shadow or outline. Its text frame is
  (14, 141, 1892, 411), the full PowerPoint lyric box minus its insets, leaving
  room for three lines at the same size and pitch; the first line's ink starts
  near y=157. Missing fonts fall back to Pretendard. The theme inherits 화면
  기본; each song keeps its own background picture through the normal background
  and media elements. The broadcast screen uses the new lower third, the stage
  uses the new-library stage layout below, and saved themes are not migrated.
- New libraries also include 찬양 (밝은 배경) in the same theme list. Its
  audience lyrics use black (#000000) in the wider frame (36, 141, 1848, 411),
  with the same typography as 찬양. Its title and optional subtitle are also
  black. The white 찬양 frame stays (14, 141, 1892, 411). It keeps the song's
  normal picture over a white (#FFFFFF) background and the existing broadcast
  and stage layouts. Operators pick this variant explicitly; the song default
  and saved catalogs are unchanged.
- The app includes three bundled 1920 x 1080 background pictures for 말씀 and
  the two sermon title layouts. Their backgrounds use the 청록 preset above,
  rendered with the output's OKLCH mixing and dither; the two title pictures
  retain their original rule pixels and positions. Existing catalogs and saved
  themes are kept as they are.
- 말씀 on 청중 화면 uses its full-screen teal picture, white NanumSquare Bold
  text without outline or shadow: an item-range 성경 출처 at 72 px, and 현재
  가사 at 104 px, left/top aligned, with -3 px tracking and 150 px line spacing.
  The text frame starts at (130.6, 248), is 1660 x 750, and has a four-line
  Bible split budget. Missing fonts fall back to Pretendard. The broadcast
  screen uses the lower third and the stage uses the new-library stage layout
  below. The normal 배경 and 미디어 elements above the shipped picture retain
  item background overrides and blank picture slides, since blank items also use
  this theme by default.
- 사도신경, 주기도문 is an additional built-in theme. Its 청중 화면 shares the
  말씀 background asset without a title or scripture reference. Both 사도신경
  and 주기도문 omit their names. 현재 가사 uses NanumSquare Bold 104 px, -3 px
  tracking, 137 px line spacing, left/top alignment, and at most four lines in
  the verse box at x 129, y 95, width 1676 px. 방송 화면 and 무대 화면 retain
  the 말씀 layouts. Adding a prayer installs this theme if an older catalog
  lacks it, without replacing saved themes. Its background ID always resolves to
  the bundled 말씀 asset.
- The sermon title theme is an additional theme, not a kind default. Set the
  blank slide item name to the passage range and the slide text to the title.
  Audience bars follow the visible letter ink with equal gaps above and below;
  titles wrap automatically to at most two lines, retaining 162 px between the
  reference and title first-line centers. The reference uses KoPubWorldDotum
  Medium 86 px and the title Bold 140 px. Other screens retain their Bible
  layout.
- `defaults.blank` selects 말씀 and `defaults.ad` selects 광고 in a new
  `themes.json`. Both can be changed like the other kind defaults.
- On 청중 화면 the 광고 theme uses a shipped 1920 x 1080 blue-purple picture and
  a separate transparent slash picture, both app assets. The background uses the
  남보라 preset above with the output's OKLCH mixing and dither; the slash group
  includes an opaque triangle filled from the background picture at the same
  coordinates. Above the background are 배경 for an item override, 슬라이드
  번호, the slash picture, 슬라이드 이름, 현재 가사, and full-screen 미디어 with
  채우기 so picture slides cover the whole frame. All text is white
  KoPubWorldDotum without shadow or outline. The number is Bold 160 px with -6
  px tracking; the title is Bold 108 px with -3 px tracking; the body is Medium
  86 px with -3 px tracking and disc 글머리 기호 enabled. Its frame is (129,
  287, 1676, 776), with the right edge at 1805 and room for six 128 px lines.
  The text starts 107 px inside the frame; continuation lines hang under the
  text. The number frame is (97, 21, 113, 208); the title frame is (240, 107,
  1540, 145). Both move up with the slash group by 65 px from the original
  notice draft. The slash is white at 26% opacity, 2 px wide, and extends 18%
  farther around (198, 200) along the line through (117, 280) and (278, 119),
  then moves up 65 px with its background-filled cutting triangle. Both pictures
  belong to the app, outside the user media catalog. The slash group sits above
  the number and below the title, cutting the number along the line so none
  shows beyond it.
- The built-in broadcast look uses Pretendard Variable and a rounded glass box
  with a 6 px #E8E8E8 frame at 45%, #FEFDF9 panel at 90%, and 16 px black shadow
  at 35%. Bible and plain text use a box from x=58 to 1862, bottom at y=1026,
  growing upward. Dark #1F1F1F bold 55 px text starts at x=90 with 1.35 line
  height; after three lines it shrinks to 48 px and the box grows to show text,
  shrinking further if necessary to stay within the 900 px body height. Bible
  source breaks are rejoined and wrapped to the full text width without
  balancing. A Bible item's box uses the tallest measured slide for every part
  of the item, with text top-aligned and the box anchored at the same bottom
  edge. Bible alone has a 48 px brown-to-transparent header strip with white
  bold 30 px reference; plain text has no strip. Empty text has no box.
- Each broadcast screen chooses its song caption. The default band is flat black
  at 91% opacity across the full 1920 px width; its bottom is y=1040 and it has
  26 px vertical padding. Text-only has no band and its last line ends at
  y=1004. Both use centered white bold 56 px text, 1.25 line height and at most
  two lines, shrinking to fit. The band text has a 0 2px 6px black shadow at
  80%; text-only uses a 4 px shadow at 80% and 2 px offset plus a 24 px glow at
  55%. All song lines use the same style. An empty song slide uses its title,
  not its label. The capture fallback uses an unblurred hard shadow.
- Broadcast section cards use a 102 px horizontal black fade from y=888 to
  y=990: transparent at x=160 and x=1760, 88% black from x=480 to x=1440. The
  Korean item name alone is centered in white Pretendard Variable bold 64 px
  with a 0 2px 6px black 80% shadow, in the frame (230, 900, 1460, 90). NDI
  remains transparent outside the fade. Section cards never show an English line
  on broadcast.
- The built-in advertisement theme has an empty broadcast layout; NDI sends a
  transparent frame. Untouched saved built-in audience links resolve empty,
  while explicitly edited themes retain their layouts. On broadcast, Bible
  reference headers show the item's complete passage range instead of the
  current verse.
- The 광고 stage layout shows a left-aligned title above its body. The default
  advertisement item advances manually with looping off (05).
- Item settings warn when a screen's resolved theme lacks 현재 가사 for text,
  슬라이드 이름 for an 광고 name, or 미디어 for a picture. Linked screens use
  the source screen's elements when checking.
- The other built-in defaults are 찬양 for 곡, 말씀 for 성경, and 영상 for
  미디어.
- A new library's 대기 화면 shows the church's service times on 청중 화면. Its
  bundled 1920 x 1080 picture defaults to 예배 안내 배경 (밝게), matching the
  PowerPoint export (angle 135, 36% #7A9F5A, 67% #30A26A). 예배 안내 배경
  (어둡게) keeps the existing picture and ID (0% #567A40, 100% #1F7D4E). Both
  remain pictures containing only the gradient, title rule and verse box
  outline; no text is baked into either picture. Five editable 글 elements
  contain LOVELIGHT, the seven days, times, service names, and Ephesians
  3:20-21. Days are one right-aligned Noto Sans CJK KR Thin list; times are one
  Regular list; service names are one KoPubWorldDotum Medium list. Each list has
  seven lines at 52 px with 72.3 px line spacing. The title uses Noto Sans CJK
  KR Black 80 px with 12 px tracking; the verse uses KoPubWorldDotum Medium 36
  px. All text is white without shadow or outline. 무대 화면 keeps its clock and
  timer, and 방송 화면 stays empty.
- 예배 준비 is an additional normal theme for a 빈 슬라이드 item with one empty
  slide, not a kind default or the 대기 화면. Its audience picture has the
  bracket frame over a teal gradient (angle 135, 0% #002E38, 100% #00768C). Two
  editable 글 elements say "잠시후에 예배가 시작됩니다" and "지금은 기도로
  예배를 준비하는 시간입니다", centered in white KoPubWorldDotum Bold at 120 px
  and 74 px, without shadow or outline. Other screens use their normal
  blank-item layouts. Both pictures are bundled theme assets.

### Bundled pictures

The nine theme pictures are immutable app assets. Existing pictures keep their
IDs; the bright service-times alternative has its own ID. Output, previews,
thumbnails and analysis resolve those IDs without a media catalog entry. They
are never copied into `Media`, included in media search or counts, or offered
for renaming or deletion. No old-data migration is provided before the first
release.

The theme editor's image picker lists a 기본 배경 group before user 미디어: 광고
배경, 말씀 배경, 예배 안내 배경 (밝게), 예배 안내 배경 (어둡게), and 예배 준비
배경. Search and keyboard selection reach both groups. Adding or replacing an
image uses the selected asset ID without importing it. 광고 사선 and 구역 이름
선 remain embedded decorations in their themes and never appear as choices.
Their existing elements still show the correct picture name.

## Where the rest of the spec uses 테마

- 03: the layers of an output and the stacking order follow "Drawing a screen".
- 02: `themes.json` holds the 테마. `messageStyles` live in `messages.json` with
  the 메시지.
- 06 and the 화면 설정 workspace: the workspace is 테마 and holds the 테마
  editor. Screens and monitors are in the 화면 설정 window.
- 07: the 매크로 action 테마 바꾸기 ("테마 바꾸기" above).
- 11: the toolbar 테마 button and the 출력 menu's 테마 바꾸기 row; 출력 › 화면
  설정… opens the 화면 설정 window; the 지우기 row has 대기 화면.
- 04: the 진행 지우기 row starts with 대기 화면 (the 항목 끄기 command).

### Song title layout

New 찬양 audience layouts carry optional `songTitle: "sunday"`. For a song title
slide, the shared output and thumbnail composition replaces 현재 가사 with the
editable title and subtitle lines over the same song background. Both lines
inherit the replaced 현재 가사 element's text color. The title uses NanumSquare
ExtraBold at 120 px, centered without shadow or outline, in frame (339, 181,
1242, 160). The optional subtitle uses NanumSquare Regular at 64 px with default
24 px tracking in frame (252, 345, 1416, 90). Lyric slides and the other screen
roles retain their normal layouts. The built-in 찬양 also resolves this title
variant in saved catalogs without rewriting their lyric layouts. Other layouts
without the selector retain ordinary text rendering. The 밝은 배경 variant uses
`songTitle: "sunday-light"` for the same title and subtitle composition, with
black text inherited from its lyrics, including when copied or saved. A title
slide's `titleLayout` overrides title and subtitle tracking (defaults 0 and 24
px) independently. The opening title may use 12/12 px while another song retains
0/24 px; repeated titles use the same composition at every position.

The optional titleTop and subtitleTop in `titleLayout` set each line's frame y
coordinate explicitly. For example, the opening subtitle uses 338 px and the
closing song title uses 158 px; unconfigured titles retain 181/345 px.

An opening section card uses its own section theme and Korean name while the
remaining slides retain the item theme.

If a section card theme is missing, output reports the missing theme and uses
the blank-item default theme, as for any missing item theme.

New-library stage layouts omit the item name, position and dark top band. The
slide label stays centered and is omitted when it repeats the item name, even
though the item name is not shown. Bible slides instead show the same full
passage reference and reference display setting as the audience, centered in a
1612 px frame at 48 px #E6E6E6, on one line and shrunk to fit. A stage message
moves the label up to make room; the timer sits to the left of the clock. A 60
px #E6E6E6 clock showing hours, minutes, and seconds sits at the top right in
frame (1460, 20, 400, 80), clear of the next preview in frame (154, 706, 1612,
272). Current and next lyrics have approximately eight percent side margins and
1.2 line height. White centered current text occupies the large area above a
bottom-aligned yellow centered next preview. A section-card next preview shows
only its Korean name; its English subtitle appears on the audience and broadcast
card itself. An advertisement next slide shows only its text-slide number and
title; other titled next slides show their title and body; an untitled slide
shows its body alone. The next preview shows at most two source lines and
targets two thirds of the fitted current size, with enough height for two lines
at that size. Section cards center their Korean name above the same next preview
without the English subtitle. The stage notice retains its church news card.
These defaults apply to new libraries; existing layouts are unchanged. Built-in
audience background and media elements start at 채우기 (cover); their editable
theme-element 맞춤 wins over the media property's 맞춤 when rendered through
that element. The media properties panel explains this precedence in a tooltip.
Existing libraries are unchanged.

The section gradient layout retains 늘리기 for its background element.

Bible item cards use their section theme; the passage slides retain their Bible
theme and their overlay ranges follow their content positions.

On a stage section card the next text follows the fitted Korean item name, not
its subtitle.

On audience output, imported PowerPoint lyric runs use their source font, size,
tracking and paragraph spacing; imported lyrics fit across the full 1920 px
slide width and use the source box's top plus its top inset when available.
Imported title slides retain each title line's original position and formatting.
Edited text without matching imported formatting uses the theme.

On the stage, song source lines stay whole at the largest fitting size down to
72 px at 1920 x 1080, two thirds of the church deck's 108 px lyric size; longer
lines wrap at spaces at that minimum. Next text stays at least 48 px, two thirds
of 72 px, matching the existing next-text size ratio. Bible parts on stage and
broadcast join the audience rows with spaces and wrap within their own text
frames; the stage next-verse preview does the same, left-aligned like the
current verse. Song lines retain their author-entered breaks. Other prose
continues to wrap. When continuous next-item navigation is enabled, the stage
next preview follows the same next-item selection and skips the same rows as the
next-slide command. A title counts as one of the two next-preview lines.

In the built-in stage layout, an empty song slide shows its label as a centered
muted cue, or (없음) when the label is empty. Stage previews show the same cue;
audience output remains background only. On the built-in broadcast layout, an
empty song slide shows only the song title; it shows nothing if the title is
absent, and never falls back to the label.

Built-in stage current text uses the matching audience size: 108 px for songs,
104 px for Bible and 86 px for ad bodies. Longer text shrinks to fit; Bible text
is left-aligned beneath a smaller reference. Saved user edits remain unchanged.

On the last slide of a Bible item, stage next-slide elements show nothing for
the next item.

### 이미지 슬라이드

The built-in 이미지 슬라이드 theme displays a slide picture fitted within a
black canvas on 청중 and 무대 screens; the stage also shows its clock. 방송
screens are transparent and have no elements. PowerPoint picture imports use
this theme with their privately owned slide pictures.

A theme may set a slide transition in the theme editor. The built-in scripture
theme uses a 0.7 second wipe, the creed and prayer theme uses a 0.5 second wipe,
and the sermon title theme and seven section title themes use a 1 second wipe.

On stage, an empty current or next slide without a label shows (없음); a labeled
empty slide shows its label.

On stage, a next title slide omits its English subtitle.

On stage, the labels 전주, 간주 and 후주 follow the text in parentheses; other
labels precede it. Empty slides show only the label. Bible verse labels are
omitted.

Stage title slides and section cards show only their Korean title, without the
English subtitle. The creed and prayer theme uses 104 px left-aligned current
text with the next line and clock clear.

Stage current and next text use the matching audience theme font family; current
text also uses its audience weight.

On stage title slides, only the prelude, interlude and outro labels are shown
after the title; other labels are omitted. The stage advertisement title is bold
yellow at the audience title size, with its white left-aligned body below at the
audience body size. The stage clock is at the top right in all built-in stage
layouts.

TEMPORARY for the 2026-11-15 service: on the last slide of a service Bible item
directly following a sermon-title theme item, the stage next line shows the
sermon title; other Bible items retain the empty next line. Replace this rule by
grouping the sermon passage with the sermon title item.
