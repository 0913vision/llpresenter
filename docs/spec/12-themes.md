# 테마 and 오버레이

Status: rewritten on November 22 and 23 with the user's model. This file is the
single source for what a 슬라이드 shows on a screen. 메시지 styles and 그래픽
keep their own files and behavior.

## Why

The user's needs (October 30 and November 22):

1. Every 슬라이드 can lay out the screens differently, and some show completely
   different things on each screen.
2. A theme is the whole frame, as a slide master is in PowerPoint. The 슬라이드
   only fills it, whatever kind of item it belongs to.
3. The operator edits a theme freely and sees every value of it in one place.

## The model

- **A 슬라이드 has a 테마.** An item has no 테마 and no background. One item can
  hold 슬라이드 of different 테마: a 설교 has 설교 제목, 말씀 본문, and 설교
  제목 슬라이드, and a song has 찬양 제목 and 찬양 가사 슬라이드. A 슬라이드 may
  also have its own background; otherwise it shows the background of its 테마.
- **A 테마 has named text boxes.** A named box is a placeholder: the 슬라이드
  holds its text, and 준비 edits every named box and nothing else of the 테마.
  Text without a name is fixed and changes only in the 테마 editor. A box can
  have a default, such as the address of a passage; it shows while the 슬라이드
  has no text of its own for that box.
- **Columns.** The list view of the editor has a column for each named box. The
  operator switches columns on and off there. The 테마 sets only which columns
  are on at first: 말씀 본문 starts with 본문 on and 주소 off. The property
  panel always shows every box. The grid edits nothing.
- **Next text.** What the 슬라이드 before one shows as its next text on 무대 is
  a box that the 테마 makes: a phrase with box names, such as `{본문}` for 말씀
  본문, `다음 곡: {제목}[ ({이름표})]` for 찬양 제목, `다음 순서: 설교 ({제목})`
  for 설교 제목, `다음 순서: {제목}` for 타이틀, and `다음 광고: {제목}` for
  광고. A part in brackets is left out when a value in it is missing. A 슬라이드
  can have its own text instead; clearing that text brings the phrase back. The
  property panel always shows it and its column starts off. A 테마 can hide the
  next text on the last 슬라이드 of an item, as 말씀 본문 and 설교 제목 do.
- **Separate 테마.** 찬양 제목, 찬양 가사, 설교 제목, and 말씀 본문 are four
  테마. A 테마 has a purpose and is offered only for 슬라이드 of that purpose.
- **Not in a 테마.** The clock, timers, and the stage message show at fixed
  places on 무대, whatever the 슬라이드.
- **Files.** A 테마 is one JSON file with the layouts of the 청중, 무대, and
  방송 screens. Every size, place, and font is in that file. The drawing code
  reads the file and has no rule for a kind of item. Built-in 테마 are such
  files too.
- **Filling.** Importing a song, inserting a passage, or adding a notice only
  says which box of which 테마 gets which text. Sizes and places of an imported
  file are never taken over.

## Concepts

- A 테마 sets all three screens at once: 청중 화면, 무대 화면, and 방송 화면.
  Each screen of it has one mode: 직접 배치 (its own elements), `<화면>과 동일`
  (a live link to another screen of the 테마), or 비움 (nothing; the screen
  shows its 빈 화면 색). Screens of one kind show the same layout; a screen that
  must differ has its own in `others`.
- A 테마 has a purpose (쓰임): 찬양 제목, 찬양 가사, 설교 제목, 말씀 본문, 광고,
  타이틀, 사도신경과 주기도문, 예배 준비, 대기 화면, 빈 슬라이드, 이미지, 영상.
  A 슬라이드 offers the 테마 of its purpose. The operator picks which 테마 a new
  슬라이드 of a purpose gets.
- A canvas is 1920 x 1080 reference pixels. Every size and position is in
  reference pixels and scales to the screen.
- The editor fits that canvas to a measurement area independent of its
  scrollbars. Selecting an element, dragging, typing, or editing a property
  keeps the canvas size and position.

## Elements

| Element | What it shows                                                                                                  | Per screen |
| ------- | -------------------------------------------------------------------------------------------------------------- | ---------- |
| 글      | A text made of named boxes, values, and fixed words. The first of its templates that has all its values shows. | Several    |
| 다음 글 | What the next 슬라이드 lets this one show                                                                      | One        |
| 그림    | A fixed picture: a user image or one of the app's                                                              | Several    |
| 도형    | A rectangle with a fill, a border, a radius, and a shadow                                                      | Several    |
| 배경    | The background of the 슬라이드, or of the 테마                                                                 | One        |

- A template names boxes and values in braces: `{제목}`, `{본문}`. A part in
  square brackets is left out when a value in it is missing:
  `{제목}[ ({이름표})]`. The values the app fills in are 번호, 항목 이름, 구절,
  곡 제목, 찬송가 제목, 이름표, and 새 이름표 (only where the label changes).
- A 글 can have other templates and a color for when none of the first has its
  values, such as the (없음) of an empty 슬라이드 on 무대.
- A 글 can take the size, or the size and the rows, that 청중 gives the same
  content. The sung lyrics on 무대 do, so they break where the congregation's
  do.
- **Fit.** A text is drawn at its size, or at the first of its listed sizes that
  fits, and shrinks to its smallest size. It can keep its typed rows while it
  shrinks, take at most some rows, and be sized together with every 슬라이드 of
  the item that has the same 테마.
- **Stacks.** Texts of a stack stand one under another around a place, so a
  title without a subtitle stays centered.
- **Splits.** A split puts 다음 글 under the 슬라이드's own text. Each takes the
  room the other does not need, and neither is ever drawn over the other.
- A 도형 can reach around texts, or stand a distance above or below them.
- 메시지 and 그래픽 are not elements. They draw above the 테마 on the screens
  they were sent to, in the order 그래픽, 메시지.

### Limits

- At most 12 boxes in a 테마, 40 elements on a screen, 6 templates of 4,000
  characters in a text, 4 stacks, 4 splits, and 6 stops in a gradient.
- No rotation, masks, or blend modes.

## Which 테마 applies

- A 슬라이드 is drawn with the 테마 it names.
- When that 테마 is gone, the first built-in 테마 that has a box for each text
  of the 슬라이드 draws it; a 슬라이드 without texts is drawn as a 빈 슬라이드.
- **테마 바꾸기.** The toolbar button shows the live 테마's name under its icon.
  Its menu lists the 테마 of the live purpose as radio rows, a separator, and
  테마 편집. A 테마 picked there or by a 매크로 (07) draws the 슬라이드 of the
  live item until another item starts.
- Edits to the live 테마 reach the output when the editor saves them.

## Drawing a screen

1. Resolve the mode of the screen in the 테마.
2. In 직접 배치, draw the elements from the bottom of the list to the top.
3. Draw the 오버레이, 그래픽, and 메시지 above them.
4. On 무대, draw the clock and the timer, and the stage message in front of
   everything.

지우기 가사 empties every text of the 슬라이드, 지우기 미디어 its background,
and 지우기 모두 both. Fixed words, pictures, and shapes of the 테마 stay.

A thumbnail and a preview are the 슬라이드 drawn by the same code as the output.

### Stage

- The clock is at the top left, in hours, minutes, and seconds. The timer chosen
  in the 무대 panel is under it.
- The stage message is one row on a red band along the bottom. A message longer
  than the band flows to the left and comes in again. A line break becomes a
  space.
- `output.stageLyricLabelPosition` chooses where a label shows: `line` (the
  default, on a row of its own above the lyrics), `inline` (in front of the
  first row when it fits there), or `off`.

### Empty screens

- Each screen has one 빈 화면 색, set in the 화면 설정 window: black by default,
  and `chroma` green on 방송 화면 when its method is the capture window.
- A screen in 비움, or a screen with nothing live, shows its 빈 화면 색.
- The background of a 슬라이드 or a 테마 is 없음, 단색, 그라데이션, or a media
  file. A picture or video can be fitted (채우기, 맞추기, 늘리기) and has a size
  from 10 to 400 percent and a place from -100 to 100 percent of the screen.
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

- A 슬라이드 has its own transition; one without cuts. 환경설정 > 준비 sets the
  transition of a new 슬라이드 per purpose (10).
- A transition is of two whole pictures: the screen as it is and the screen as
  it will be. The next picture is drawn out of sight and shown when it is ready.
- Leaving a 슬라이드 ends a transition that still runs: the one it was going to
  shows whole, and the next transition starts from it. Showing the same 슬라이드
  again ends its transition too.
- Previews in 준비, the song editor, and the 테마 workspace change without one.

### What is missing

- A missing font draws in Pretendard. A missing picture draws nothing in its
  element and is reported once (08).
- Built-in 테마 are part of the app, so a broken or missing file never blanks a
  screen.

## The 테마 editor

- **Left column:** the 테마 list, and below it 요소, the elements of the current
  screen, front first. Drag a row to reorder it. `+` adds an element.
- **Center:** the canvas of the current screen. Drag to move, drag a handle to
  size. Dragging one text of a stack or a split moves the stack or that part of
  the split. A bar holds 격자에 맞추기, 비율 고정, and the zoom.
- **Right column:** the three screens small on top, then the properties of what
  is selected: an element, or the 테마 itself (쓰임, 다음 테마, the boxes, 다음
  글, 배경) and the current screen (mode, 바탕).
- Named boxes are made, renamed, ordered, and removed there. A new name is put
  into every template that shows the box. The names of the boxes the app fills
  can't change, because code puts texts into them by name.
- Ctrl C and Ctrl V copy elements between screens and 테마. Ctrl Z and Ctrl Y
  step through the unsaved edits.
- **Saving.** Edits change a working copy. 저장 (Ctrl S) asks before it
  overwrites the 테마 and says how many 예배 순서 항목 use it; 다른 이름으로
  저장… (Ctrl Shift S) makes a new one. Leaving with unsaved edits asks 저장,
  저장 안 함, or 취소.
- **The list.** 새 테마 asks for the purpose and copies the 테마 new 슬라이드 of
  that purpose get. 복제, 이름 바꾸기, 기본으로 지정, and dragging write at
  once. A 테마 of the app can't be deleted; after a change it offers 처음으로
  되돌리기.

## 오버레이

- An item can have several 오버레이. Each has content (a video, an image, or
  text), a range (from one 슬라이드 to another), the screens it shows on, and
  for a video 반복 or 정지 and 소리.
- A range is stored with the ids of its two 슬라이드, so it moves with them.
  Ranges never overlap.
- It draws over the whole screen, above the 테마 and under 그래픽.
- 오버레이 추가… is in the menu of a 슬라이드 in 준비. The grid of the editor
  shows each 오버레이 as a bar under its 슬라이드; drag an end to change the
  range.
- Example (user, October 30): a 특송 item with an MR video on 무대 화면 only,
  across every lyric 슬라이드.

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
- With nothing live, every screen shows its 빈 화면 색. The 청중 화면 keeps the
  background of the 대기 화면 테마 behind it, so a service can start from it.
  The same shows at launch when outputs turn on and nothing is live.

## Data

### `Settings\themes\<id>.lltheme`

One 테마. The app's own 테마 have a file only after the operator changes them.

| Field           | Type                                             | Meaning                                                             |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| `format`        | `"lltheme"`                                      | File type.                                                          |
| `schemaVersion` | Integer                                          | 1.                                                                  |
| `id`, `name`    | UUID, string up to 80 characters                 | Identity and name.                                                  |
| `purpose`       | One of the purposes                              | What 슬라이드 can have it.                                          |
| `boxes[]`       | `{name, default?, column, rows}`                 | Named boxes. `rows` is `one` or `many`; `column` shows it in 준비.  |
| `next`          | `{content, atStart?, column}`                    | What the 슬라이드 before shows; `atStart` for the first of an item. |
| `hideNextAtEnd` | Boolean, optional                                | The last 슬라이드 of an item shows no next text.                    |
| `then`          | 테마 ID, optional                                | The 테마 of a 슬라이드 added after one with this 테마.              |
| `background`    | Background                                       | Shown unless the 슬라이드 has its own.                              |
| `screens`       | `audience`, `broadcast`, `stage`: screen layouts | `own` with elements, stacks, and splits; `same`; or `empty`.        |
| `others`        | Screen ID to layout, optional                    | Screens that differ from the others of their kind.                  |

### `Settings\themes.json`

| Field      | Type                                    | Meaning                                                |
| ---------- | --------------------------------------- | ------------------------------------------------------ |
| `order`    | Array of 테마 IDs                       | The order of the list.                                 |
| `defaults` | Object: purpose to 테마 ID              | The 테마 of a new 슬라이드; the app's own when absent. |
| `titles`   | `{id, name, english, background?}`, 200 | The 타이틀 the operator keeps in 예배 요소.            |

At most 200 테마 of the operator. The exact values of the app's 테마 are in
`src/core/theme/builtIn/*.json`.

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
image uses the selected asset ID without importing it. 광고 사선 and 타이틀 선
remain embedded decorations in their themes and never appear as choices. Their
existing elements still show the correct picture name.

## Where the rest of the spec uses 테마

- 02: the 슬라이드 of songs and services.
- 05: the editor of an item.
- 07: the 매크로 action 테마 바꾸기.
- 11: the toolbar 테마 button and the 출력 menu.
