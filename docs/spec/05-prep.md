# 05. The 준비 workspace

준비 (Prep) is the workspace for preparing songs and services. This document
covers the 라이브러리 and search, the song editor, 예배 순서 item settings,
adding items, creating and importing services, saving a 템플릿, text import, and
the shared bottom 미디어 bin.

Terms: 슬라이드 (slide), 예배 순서 (service order), 템플릿 (template), 구성
(arrangement), 이름표 (label), 라이브러리 (library), 매크로 (macro), 청중 화면
(main screen), 무대 화면 (stage screen), 방송 화면 (broadcast captions), 진행
(Show workspace), 퀵 실행 (quick launch). See 01.

## Layout

| Column | Panels                                                                   | Source                  |
| ------ | ------------------------------------------------------------------------ | ----------------------- |
| Left   | 라이브러리                                                               | `Reflow`, `PrepService` |
| Center | The 예배 순서 table ("The 예배 순서 table and the editor windows (B20)") | `Reflow`, `PrepService` |
| Right  | The selected item's 미리보기, 슬라이드, and 항목 설정                    | `Reflow`, `PrepService` |

- The same bottom 미디어 bin as 진행 sits below these columns. Opening it keeps
  the editor, selected service item and unsaved drafts in place. Its visibility
  and media selection follow 04.
- The previews in 준비 never affect the output. Clicking a 슬라이드 in 준비 only
  selects it.
- The same 라이브러리 song can be open in the song editor while it's on output
  in 진행.
- At a fixed window and bin size, selecting another item keeps the right
  column's preview, slides and settings panel boundaries in place. Different
  item controls scroll inside those panels instead of redistributing their
  heights. Song and slide previews reserve the same caption height; extra
  Bible-part controls scroll without shrinking the picture.
- Lists, editor bodies, property panels, dialogs and pickers reserve vertical
  scrollbar space. Crossing the overflow threshold must not change their content
  width or move neighboring controls.

Source: `Reflow`, `PrepService`, `Main` decision "작업 공간 세 개", design
system README (window sizes and layout).

## The 예배 순서 table and the editor windows (B20)

The user decided this on November 2 (drafts o1 to o6 and g5, outside the
repository). The table, the 순서 편집 window, the 곡 편집 window, and the
오버레이 bar on the 슬라이드 have landed.

### 준비

- The center of 준비 is the 예배 순서 table, one row per item. Clicking a row
  shows that item's preview, 슬라이드, and settings on the right. The 라이브러리
  stays on the left. The song editor is no longer a column of 준비: choosing a
  라이브러리 song opens the 곡 편집 window.
- The columns are 이름, 구성, 슬라이드, 테마, 배경, 시작할 때, and 메모.
  슬라이드 counts the slides of the order the item plays (the duration for
  media). A song with its own order (`customOrder`, made in 순서 편집) shows the
  구성 the order started from, followed by the small changed dot with the
  tooltip "이 예배에서 바꾼 순서"; the right column's 구성 select and the 순서
  편집 window's 구성 picker show the same name and dot. Anything that lists the
  order itself (chips, tiles, the 슬라이드 count) shows the order that plays.
  Picking a 구성 clears the order and the dot goes. 테마 shows the name of the
  item's own 테마, or, dimmed, the default of its kind, with the reason in the
  tooltip. 배경 shows the picture and name, dimmed when the item follows the
  song's. 테마 and 시작할 때 change in the cell, which opens its list of
  choices; the other columns are changed on the right or in the windows. A 구역
  row shows only its name.
- 항목 and 구역 at the end of the table add a row after the last one. 항목 opens
  the list of "Quick add" (below).
- The right column's 슬라이드 panel has 순서 편집…, which opens the 순서 편집
  window on the song item.
- A song row's right-click has 순서 편집… and 곡 편집… after 구성 › (11). A
  double-click or Enter on a song row opens 순서 편집.

### Slides items and 슬라이드 편집

- 항목 추가 offers 빈 슬라이드 and 광고 before 미디어. Each inserts after the
  selected row, selects the item, and opens 슬라이드 편집. Without a selection
  it appends. 빈 슬라이드 starts with one empty text slide and manual advance.
  광고 starts with one empty named text slide, 8-second advance, and 반복
  enabled.
- Both forms use the same slides icon. The table shows the editable item name,
  slide count, item theme or form default, background, start macro, and memo.
  The right column shows the item name, 슬라이드 편집…, themed thumbnails, and
  항목 설정. It has no 순서 편집… action. Thumbnail bands show the number and ad
  name, picture filename, or first line of blank text.
- 슬라이드 편집 is one reusable window. The header edits 이름, 테마, 넘기기
  (손으로 or every 3, 5, 8, 10, 15, 20, or 30 seconds), and 반복. Each row has a
  thumbnail in the item's theme. Ad text rows have 이름 and 내용; blank text
  rows have 글. A picture row has its filename and 바꾸기…. 글 추가 adds a text
  row; 그림 추가… and 바꾸기… choose pictures from the media list. A structured
  verse slide shows its read-only Bible reference and stays intact when other
  item fields are saved.
- Rows use the song editor's 14px padding, 18px number column, and 16px gaps:
  number, a fixed 112px 16:9 thumbnail, then top-aligned body content. There is
  no kind column. Ad field labels stay on one line. Text uses a two-line
  TextArea that grows with its content; picture filename and 바꾸기… share one
  line. Verse rows show the full reference (`요한복음 3:34`) in strong body
  text, then at most two lines of read-only verse text with an ellipsis. A split
  verse shows the thumbnail's first piece and its part (`1/2`). Add actions
  start at the content column; the slide count stays in the footer.
- In a blank item, 성경 구절 추가 opens the shared passage dialog. It inserts
  one reference-only row per verse after the selected row. The entire range is
  one local undo step, and a range exceeding the remaining 200-row capacity is
  refused before insertion. Ad items do not offer this action.
- Verses needing review open 절 나누기 in order, with `1 / 2`, `2 / 2`, before
  the rows are inserted. The window follows 04, using this item's current text
  element and saved cuts. Esc cancels the pending insertion, including a lookup
  still loading; cuts already confirmed remain saved. Ctrl E on a verse row
  reopens its current cuts without changing the draft's references.
  - Rules and confirmed cuts are available first. The optional local AI refines
    unconfirmed split verses sequentially as in 04. The first ready verse opens
    review while later pages can still show a spinner; only a page that
    displayed the spinner has the 400ms confirmation guard. Cancelling or
    closing drops late results and stops remaining requests.
  - When 절 나누기 창 저절로 열기 is off, refinement still completes before
    insertion but no review window opens. Ctrl E remains available afterward.
- Verse thumbnails and previews resolve the installed translation and use the
  same measured parts as 진행. The preview offers previous and next parts of the
  selected verse; editing a reference never creates copied verse text in the
  service file. Missing source text or a failed measurement refuses the
  insertion with a reason, retaining the draft.
- Drag rows to reorder. Delete outside a text field or 삭제 on a row's context
  menu removes it. Ctrl Z and Ctrl Y undo and redo local changes. The preview
  has 청중 화면, 무대 화면, and 방송 화면 tabs and a position caption. Removing
  a focused row focuses the next remaining row, or 글 추가 when empty, so
  keyboard undo remains available. Undo or redo that removes the focused row
  restores focus the same way, including focus inside its input. Keyboard 저장
  preserves the focused control and its selection while editing is disabled,
  restoring both when the same draft is editable again. Saving ends the current
  typing group, so continued typing can be undone to the saved text.
- 저장 writes the draft into its service item through the service edit path. All
  changes make one undo step in the main window. Closing or opening a different
  item with unsaved edits asks 저장, 저장 안 함, or 취소, as in the song editor.
  A refused save keeps the draft open. Saving merges fields changed in the
  editor into the fresh item, preserving concurrent changes to other fields.
  Conflicting changes to the same field refuse the save. 취소 invalidates a
  pending item switch or close even while its save is still running; completing
  that save does not resume the canceled action or replace a newer confirmation.

### 순서 편집

- A window for this service's order of the song and its 오버레이. The order
  belongs to this item only; 구성으로 저장… saves it as a 구성 of the song. It
  shows the order as group tokens, as ProPresenter's arrangements do (02), with
  the 구성 picker.
- It opens beside the 라이브러리, its left edge at the library's right edge, and
  is not modal, so media can be dragged in from the library.
- 슬라이드 fill rows to the window's width, and the window scrolls. A size
  slider at the bottom right sets their size, remembered with the window's
  bounds.
- An order change (moving, adding, or removing a token) moves the 오버레이
  ranges in the same write: a range stays on its start and end 슬라이드, and
  removing the end 슬라이드 makes the 슬라이드 before it the end. A range whose
  슬라이드 are all removed is kept and clamped when read.

### 오버레이 on 슬라이드

The same bar and menus work in 순서 편집 and in the 슬라이드 list on 준비's
right.

- Add: drag media from the 라이브러리 미디어 list or the 미디어 bin onto a
  슬라이드, or choose 오버레이 추가… on the 슬라이드's right-click. The range
  runs from that 슬라이드 to the song's end, or to the 슬라이드 before the next
  오버레이.
- A 슬라이드 has at most one 오버레이 (12). Dropping media on a 슬라이드 that
  has one replaces its media.
- A bar under the 슬라이드 shows each range. It is drawn per row, with › where
  it runs on to the next row and a handle at each real end. Dragging an end
  changes the range.
- Clicking a bar opens its settings, with the labels and controls of the
  existing 오버레이 settings: 바꾸기…, 슬라이드 (부터, 까지), 화면 (a checkbox
  per screen), 끝나면 (반복, 정지), 소리 (the label with a lone checkbox), and
  오버레이 삭제.
- Remove: 오버레이 삭제 in those settings or on the 슬라이드's right-click,
  beside 오버레이 바꾸기…; or choose a bar and press Delete.

### 곡 편집

- A window for the 라이브러리 song itself (lyrics, 이름표, 구성), like the 화면
  설정 window. 곡 편집 from 진행 opens it at the clicked 슬라이드.
- Edits stay in the window until 저장 (Ctrl S). 저장 always asks "<제목> 곡을
  덮어쓸까요?" with 취소 and 덮어쓰기, with the usage line when other services
  use the song. This replaces saving 라이브러리 songs on every edit.
- 다른 이름으로 저장… (Ctrl Shift S) opens a name dialog filled with "<제목>
  복사본" (and 복사본 2, 3, … when taken: the one copy-name rule, 11), makes a
  new 라이브러리 song from the edits, and leaves the original unchanged. When
  the window was opened from an item (순서 편집… or a 준비 row), that item
  switches to the new song.
- Unsaved edits show a dot before the title. Closing the window with unsaved
  edits asks 저장, 저장 안 함, 취소, as the 테마 editor does (12).

Source: drafts o1 to o6 and g5, user decision, November 2.

## 예배 순서 panel in 준비

- The header, service switcher, and 항목 추가 (add item) work as in 진행 (see
  04).
- Each row shows a detail at the right: the 슬라이드 count for songs, Bible
  passages ("슬라이드 9개"; for a song, the length of the chosen 구성), and the
  duration for media ("5:00").
- Selecting a song item opens its item settings (see "예배 순서 item settings").
- No board shows the center panel for other item kinds. Version 1 shows these
  (proposal):
  - Bible passage: the Bible panel of 04 without the output buttons, so the
    operator can change the translation and split.
  - Media: the media properties of that media.
  - Section (구역): an empty center panel.
- The operator drags rows to reorder them. Dragging a 구역 moves it with its
  items, up to the next 구역, as one section (user decision, October 26). Delete
  removes the selected item without confirmation, and Ctrl Z restores it
  (proposal). Ctrl Z and 편집 > 실행 취소 undo every edit of an item the same
  way, one step each: a change in its cells or the right column (메모, 테마,
  구성, 배경, 시작할 때, 오버레이) as well as the order edits (10, "Focus
  precedence"). The right-click menu has 삭제 (delete) (proposal).
- The list accepts 라이브러리 songs dropped on it (see "Adding items to the 예배
  순서").

Source: `Reflow`, `PrepService`, `AddSongs`, `ListRow` README.

## 라이브러리

### List

- Header: "라이브러리", the song count ("128"), and 새 곡 (new song, plus icon).
- Tool row: a search field with the placeholder "제목, 가사, 초성" (title,
  lyrics, initial consonants).
- Rows: a song icon, the title, and the number of 슬라이드 in the file
  ("슬라이드 4개"). Rows sort by title in Korean alphabetical order (as in the
  board), compared with the Korean collation of the platform
  (`Intl.Collator('ko', {numeric: true})`), so "찬송 2" comes before "찬송 10"
  (proposal).
- Clicking a row selects the song and opens the song editor.
- Dragging a row to the 예배 순서 adds the song (see "Adding items to the 예배
  순서").

### Search

- Each keystroke filters the list. Esc clears the field, and Esc on an empty
  field leaves it (`TextField` README).
- A song matches if the query is part of its title or of any line.
- If the query has only Hangul initial consonants (ㄱ to ㅎ), match it against
  the initial consonants of the title and of each line, ignoring spaces
  (proposal). For example, "ㅁㅂㅇ" matches "만복의 근원 하나님".
- All matching songs appear together in alphabetical title order, regardless of
  whether the title or lyrics matched. Keep the match indicator and first
  matching lyric line. This follows the October 27 user decision for qa-12 P03
  and
  [ProPresenter's Quick Search ordering](https://support.renewedvision.com/hc/en-us/articles/9808905773715-How-to-Use-Quick-Search-within-ProPresenter).
- Before matching, the query and the song text are both normalized (proposal):
  Unicode NFC, Latin letters in lowercase, and spaces removed, so "만복의근원"
  matches "만복의 근원". A query with only spaces matches nothing.
- The initial consonants are the 19 Hangul initials, including the double ones
  (ㄲ, ㄸ, ㅃ, ㅆ, ㅉ). ㄱ doesn't match ㄲ. A query that mixes syllables and
  initials, such as "만ㅂ", matches as plain text only (proposal).
- An empty query shows every song in title order (the 라이브러리) or closes the
  result list (the toolbar and quick add).
- A result gives the song ID, whether the title or the lyrics matched, and for a
  lyrics match the first matching line (proposal).
- Keep a title, lyrics, and initial consonant index in memory so that search
  stays fast with thousands of songs (`docs/TECH.md`).

### New song (proposal)

- 새 곡 creates a song with the title "새 곡" (or "새 곡 2" and so on if that
  title exists) and one blank 슬라이드. It saves at once, selects the song, and
  puts the focus in the title field.

### Deleting a song (proposal)

- The right-click menu of a 라이브러리 row has 삭제. It opens a confirmation
  dialog, for example "‘만복의 근원 하나님’ 곡을 삭제할까요?" (Delete this
  song?), with the detail "쓰는 곳: 예배 2곳" (used in 2 services), and the
  buttons 취소 (cancel) and 삭제.
- After the delete, 예배 순서 items that point to the song show the problem
  state, with the tooltip "곡을 찾을 수 없습니다" (song not found), and can't
  output.
- No board shows song deletion (open question).

Source: `Reflow`, `PrepService`, `TextField` README, `AlertDialog` README.

## Song editor

The song editor edits the 라이브러리 song, which is the source for every 예배
순서 that uses it. Saved edits show at once in every 예배 순서. Edits stay in
the editor until 저장 ("곡 편집" under B20 above).

### Header

- The title and the 슬라이드 count ("슬라이드 4개"), a 라이브러리 tag (folder
  icon), and "예배 2곳" (used in 2 services, link icon). The second tag counts
  the 예배 순서 files that point to the song. Its tooltip lists their names
  (proposal).
- 기본 배경 (default background): a select with a small image and the media
  name. It opens the shared searchable media list: 없음 (none), then image and
  video media. Choosing a media saves it as the song's `background`.
- The title is a title field (proposal; the board shows it as text, and the
  imported song editor shows the same field).
  - An empty title can't be saved. The field shows the error ring with the
    tooltip "곡 제목을 적어야 저장할 수 있습니다" (enter a song title to save).
  - A title that another song has can't be saved. The field shows the error ring
    with the tooltip "라이브러리에 같은 제목의 곡이 있습니다" (a song with the
    same title is in the 라이브러리).
  - An invalid title isn't saved and reverts when the field loses focus
    (proposal).

### 구성 row

- The label "구성" and the same dropdown as the item view, at every number of
  choices: 기본, a separator, the named 구성, a separator, 새 구성…, 이름
  바꾸기…, 삭제, a separator, 구성 편집…. 기본 has rename and delete disabled
  with the reason "기본 구성은 바꿀 수 없습니다" (October 31 B22).
- A 구성 is an ordered list of named groups, with repeats (October 27 user
  decision). Choosing it shows the expanded slides on the right. The source
  editor keeps master group order; repeated group occurrences share the same
  lyrics. 구성 편집… opens the editable group chip strip in the song editor.
- 새 구성… asks for a name and copies the chosen order. 이름 바꾸기… opens the
  naming dialog; 삭제 removes the selected named 구성.
  - Because 예배 순서 items pick a 구성 by name, a rename also updates the
    `arrangement` value of every 예배 순서 item that points to this song and the
    old name (proposal).
  - After a delete, items that picked that 구성 use 기본 (proposal).

### Blocks

- Source blocks are organized into named groups, such as 1절 and 후렴. A group
  contains one or more slides. Show its 이름표 chip at the group start; unnamed
  groups show 이름표. The name comes from the group, not an independent label on
  each slide. Names may repeat, and different groups with the same name remain
  distinct. Show their source position to distinguish them in menus.
- Each block is one 슬라이드. Show its source number on the left and edit its
  lines on the right without field chrome. Editing a repeated group's source
  updates every occurrence.
- The block that holds the cursor is active. It has a lighter background and a
  blue bar at its left edge.
- Editing rules (proposal, our design: ProPresenter's Reflow editor shows the
  text on the left and the slides on the right and breaks a slide with Ctrl
  Enter, S4 p. 74, but no ProPresenter source says that an empty line separates
  slides):
  - Enter starts a new line in the same block.
  - Enter on an empty line splits the block there. The empty line goes away, and
    the lines after it become a new block.
  - Backspace at the start of a block merges it into the previous block only
    within the same group. At a group's first slide it does nothing, with the
    tooltip 그룹 경계에서는 슬라이드를 합칠 수 없습니다 (02). Lyrics and all
    arrangements remain unchanged, including separate, reversed and repeated
    uses of the two adjacent groups.
  - Pasting text with blank lines splits it into blocks at the blank lines.
  - The up and down arrow keys move between lines and across blocks.
- Inserting or splitting a block keeps the new slide in its group. Group IDs
  keep arrangement references stable when slides move. Splitting a group
  replaces each occurrence with its parts in order. Cross-group Backspace is
  refused as defined in 02, even when the two groups share a name or every
  current occurrence happens to use them together.
- Ctrl Z undoes edits for the current session, and Ctrl Y or Ctrl Shift Z redoes
  them (decided; Ctrl Y follows ProPresenter, S1). Each song has its own history
  while the app runs, up to 100 steps; the oldest step drops off past that.
  Typing in one block counts as one step until the cursor leaves the block or 1
  second passes without typing. The history is gone when the app quits
  (proposal).
- Ctrl Enter splits the block at the cursor, and Ctrl Shift N inserts an empty
  block after the current one (decided, 10).

### 이름표 menu

- Clicking a block's 이름표 chip opens the menu:
  - "이름표 없음" (no 이름표), then the 이름표 list (defaults in 02), each with
    its color swatch. The current one has a check mark.
  - A separator, then 이름표 관리….
- Choosing a name sets the group's `name`. Starting a new group at a slide
  splits the current group there, retaining every arrangement's slide order
  (02). Renaming one group does not merge it with another same-named group.
- The picker only assigns a name to this group. Creation and shared changes
  belong to 이름표 관리; picker rows have no management context menu.

### Managing the 이름표 list

이름표 관리… opens one dialog for the shared catalog (October 31 B22 user
decision). The same editor is also available at 환경설정 > 이름표, after
라이브러리 in the page list (November 5 user decision). Both surfaces share
their controls, validation, rename contract and immediate catalog updates; edits
appear in open dialogs and song editors at once. Each row contains an editable
name, a small color button with a 16px sample and chevron, and 삭제. A 16px grip
at the left is the only drag source. Its focusable handle accepts Alt Up and Alt
Down to move one row, retaining focus; a drop line marks insertion. Every label
menu, including import matching, follows this saved catalog order. Name changes
use the shared rename contract: Enter or blur accepts a valid draft, Esc cancels
it, and a failed save keeps its applied identity for retry or correction. Color
and rename tooltips explain their library-wide scope.

새 이름표 at the bottom left appends a uniquely named row with no color and
focuses and selects its name. Creation does not assign it to the current group.
Changes save immediately, so 닫기 is the dialog's only footer completion action.
The preferences page has the same 새 이름표 action without a completion footer.
Leaving the page, through either navigation or a requested preferences page,
settles name drafts first. A refused save keeps the page and typed name open for
correction; an in-flight save must finish before navigation proceeds. Hot keys
belong to particular source slides, not this shared name/color registry (October
27 S26 user decision).

The color is `#RRGGBB` or `none`; palette names are not stored. Click, Enter,
Space or Alt Down opens the menu-surface popover below the color button, left
aligned and flipping above near the viewport bottom. Its only text is values:
none and eight preset swatches, a separator, a saturation/brightness area (about
216 by 120px), a 12px hue bar and a small hex field with a 20px sample. Preset
tooltips keep their shared label scope and roving arrows. Picking a preset
applies and closes. Pointer movement previews across open catalog views; release
saves once. Arrows move by 1%, Shift by 10%; key release saves once. The hex
field accepts Enter or blur and reports "#RRGGBB 형식으로 입력" for an invalid
value. Esc or an outside click closes and retains applied changes. Chips, bands,
swatches and captions paint the stored hex; band text uses WCAG relative
luminance to choose dark or white ink. Macros keep their eight colors.

On open, focus the dialog surface with no name selected or rename tooltip. Tab
enters the first name field. 새 이름표 still focuses and selects the new row's
name.

| Item                 | Behavior                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 이름 바꾸기 (rename) | Renames the 이름표 in the list and rewrites the name in every 라이브러리 song that uses it. Recovery copies apply (see 02). |
| 색 (color)           | Applies the color to every group with that name in every song.                                                              |
| 삭제 (delete)        | Removes the name from the list only. Songs keep the name, and it draws with no color.                                       |

### Slide hot keys

- The shared thumbnail 슬라이드 menu's 단축키… row opens 슬라이드 단축키 in the
  song editor. The item view opens that editor at the clicked source slide
  first. There is no separate hot-key bar. Store an optional physical `KeyA`
  through `KeyZ` or `Digit0` through `Digit9` in `groups[].slides[].hotKey`
  (02). No assignment is the default.
- Assign a key to that source slide once, regardless of how many times its group
  occurs in a 구성. Another source slide in the same song cannot use that code.
  The conflict identifies the source slide number in master group order; another
  song may use the same code.
- Enter or numeric keypad Enter saves a changed, valid assignment. Esc cancels
  the draft. Backspace, Delete or 지우기 removes the assignment. Tab and Shift
  Tab navigate without changing it, and standalone modifier keys leave the draft
  intact. Modified assignments and reserved keys are refused (10).
- IME composition and held keys do not record an assignment. Physical letter
  codes work in Korean mode; numpad digits count only with Num Lock on.
- Read-only and close-preflight locks refuse edits. A song/source change while
  the dialog is open makes the draft stale; do not write it onto another slide.
  A removed source closes the dialog. A refused commit keeps it open.
- Assignment/removal uses the song's existing undo and save path as one step,
  separate from typing, without moving the lyric cursor. In 진행 the key goes to
  the first projected occurrence of that exact source, never the next match by
  이름표 (04).

### Preview

- A segmented control switches between 청중 화면, 무대, and 방송 화면. The
  preview shows the selected 슬라이드 drawn with the 테마 of the item for that
  screen.
- Caption: the 이름표 color swatch and name, and the position ("3 / 4").

### 슬라이드 list

- Header: "슬라이드" and the count. Thumbnails of the 슬라이드 in file order, or
  in the chosen 구성's order (proposal).
- Clicking a thumbnail selects that block in the editor and shows it in the
  preview. It never outputs.
- A thumbnail size slider sits in the footer.

Source: `Reflow`, `ImportEdit`, `LabelChip` README, `LabelColorPicker` README,
`Menu` README, `TextField` README, `SlideThumbnail` README, product log (version
61 구성 presets, user-managed 이름표 colors; October 27 S26 user decision).

## 예배 순서 item settings

When the operator selects a song item in the 예배 순서, the center panel shows
the item and the right column shows the preview and the 항목 설정 (item
settings) panel.

### Item panel (center)

- Header: the song title, the sequence length ("슬라이드 9개"), and the same
  edit label as the slide menu (곡 편집). That button opens the song editor at
  the selected occurrence's source slide.
- 구성 row: the label "구성" and a select that shows the chosen 구성 ("주일용").
  Its menu is the song editor's menu above. Choosing a 구성 changes only this
  item. Every source-management action first opens the song editor at the
  selected source slide; creating a 구성 does not assign it to this item.
- Chip strip: one chip per group occurrence, showing its name in the 이름표
  color, without grips or an add button. Unnamed groups show 이름표 없음 and
  their source position. Repeated group IDs produce repeated chips, not
  duplicated source slides.
  - The strip is read-only for every 구성: dragging, Alt+←/→ and Delete do
    nothing. Source order changes belong only in the song editor.
  - Selecting a chip selects the first thumbnail of that occurrence. The chip
    containing the live slide has the on-output ring. Repeated occurrences have
    distinct sequence positions even though they reference one group.
- 슬라이드 list (draft g5): the sequence positions as compact thumbnails with
  the 오버레이 bar under each row (see "오버레이 on 슬라이드"). Clicking selects
  locally and double clicking a song's slide opens 곡 편집. Item thumbnails use
  the same 슬라이드 menu model as 진행, with supported source actions enabled,
  and add 오버레이 추가…, 오버레이 바꾸기…, and 오버레이 삭제. 진행 keeps its
  thumbnail grid.

### Preview and 항목 설정 (right)

- Preview: the same segmented control as in the song editor. The caption shows
  the 이름표, the position in the sequence, and the style name ("프리코러스 5 /
  9 기본").
- The 항목 설정 panel has these groups:

| Group                    | Row                  | Control                                                             | Behavior                                                                                                                                                                     |
| ------------------------ | -------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 원본 (source)            | 곡 (song)            | Song title, link icon, 라이브러리 detail and the shared edit action | Opens the song editor at the selected source slide.                                                                                                                          |
| 원본                     | 쓰는 곳              | "예배 n곳", with service names in the tooltip                       | Uses the same live library usage as the song header.                                                                                                                         |
| 이번 예배 (this service) | 배경 (background)    | Select with a small image                                           | Shows the item's background. Without an override, the detail reads "곡 기본값" (song default). Choosing a media saves the override. Choosing 곡 기본값 removes the override. |
| 이번 예배                | 시작할 때 (on start) | Select with the 매크로's color tile and the detail "매크로"         | The 매크로 to run when the item starts (see 07). The menu has 없음 (none) and the 매크로 list.                                                                               |
| 메모 (memo)              |                      | Multiline text field                                                | Free text for this item.                                                                                                                                                     |

The item background and the 진행 slide-panel background control open the same
searchable list as the song's 기본 배경. Their first row is 곡 기본값, with the
song default's name on the right, then a separator and the image/video media.
The item format has no independent clear-to-none override, so these two lists
omit 없음. Selecting in 진행 retains its existing rule: the live background also
changes when the selected item is live.

### What belongs to the service and what belongs to the song

| Belongs to the 예배 순서 item (this service only) | Belongs to the 라이브러리 song (every service) |
| ------------------------------------------------- | ---------------------------------------------- |
| Which 구성 to use                                 | Lyrics, 슬라이드, and 이름표                   |
| Background override                               | Default background                             |
| Start 매크로                                      | 구성 names and their 슬라이드 orders           |
| Memo                                              | Title                                          |

Source: `PrepService`, `NewService` and `AddSongs` (same panels), `Main`
decisions "라이브러리와 예배 순서는 따로" and "곡 구성은 프리셋", `LabelChip`
README, `Select` README, product log versions 52, 53, and 61.

## Adding items to the 예배 순서

### Dragging from the 라이브러리

- Dragging a 라이브러리 row more than 4 px starts a drag. A ghost row follows
  the pointer.
- An insertion line snaps to the row boundary nearest the pointer in the 예배
  순서. The spot right below a section (구역) is valid, including an empty
  section. Over a valid spot, the ghost row shows a plus.
- Esc cancels the drag.
- A drop inserts a song item with the default 구성, no background override, and
  no start 매크로 (proposal).
- A drop into an empty section inserts a song after its section row. The section
  stays in the list.

Source: `AddSongs`, `ListRow` README.

### Quick add

- 항목 추가 in the 예배 순서 header opens a popover with a search field ("곡,
  가사, 초성").
- The 라이브러리 group lists matching songs, with the matching part highlighted
  and the 슬라이드 count. The first result is highlighted.
- The 다른 항목 (other items) group lists 구역 추가 (add section), 성경 구절
  (Bible passage), 미디어 (media).
- Enter or a click inserts the song. A selected section is the insertion target,
  including when it is empty. If an item is selected, use its section. Insert at
  that section's end, before the next section, or at the service's end when
  nothing is selected. The popover then closes. Adding content keeps the section
  row.
- Other items (proposal):
  - 구역 추가: inserts an empty section named "새 구역" in rename mode.
  - 성경 구절: shows a reference field in the popover. Enter inserts a Bible
    passage item with the default settings.
  - 미디어: a submenu with the media list.

Source: `AddSongsQuick`, `Main` board guide (예배 순서에 곡 넣기).

### Sections

- The row is called 구역; its stored kind key is `header` (02).
- The operator can add, rename, and remove sections freely. A section may be
  empty, stays visible and selectable, and can be the target of 항목 추가.
  Consecutive or final empty sections are retained.
- Slots have been removed. The 다른 항목 menu has no 빈 자리 entry or slot
  submenus, and no item replaces a slot when added. Reading an existing file
  converts its legacy slots into section rows with their titles and unknown
  fields preserved, as 02 defines.

Source: the user's decision from the m3-check3 check, October 26.

## New service

- Opens from 파일 > 새 예배 (New service), from the service list, or with the
  shortcut the operator sets.
- The dialog is "새 예배" (new service).
  - Left: 빈 예배 (empty service), the 템플릿 group (two-line rows: name and
    "항목 9개", 9 items), and the 지난 예배 (past services) group (name, date
    such as "10월 25일 일요일", and item count). Below the list: 지금 예배를
    템플릿으로 저장 (save the current service as a 템플릿).
  - Right: the "예배 순서" box with a check-all box and the count ("항목 9개"),
    and a tree of sections and items with check boxes. Empty sections stay
    visible and can be checked on their own.
  - Bottom bar: 이름 (name), 날짜 (date), and 시간 (time).
  - Footer: 취소 (cancel) and 만들기 (create).
- Behavior:
  - 지난 예배 lists every service, including the open service and future-dated
    services, newest first.
  - The first 템플릿 is selected initially, or 빈 예배 when there is no 템플릿.
  - Choosing a 템플릿 checks every item.
  - Choosing a past service also checks every item. Returning to a source checks
    every item again.
  - 빈 예배 leaves the right box empty.
  - Checking a section checks its children. A section with some children checked
    shows the mixed state. An empty section is checked on its own and is copied
    when checked, so a template's empty sections survive creation.
  - The name defaults to the name of the chosen 템플릿 or service, or "새 예배"
    for 빈 예배. The date defaults to today. The time defaults to the 템플릿's
    `time` or the past service's time, or the current hour for 빈 예배. In M3,
    날짜 selects today or one of the next 13 days, retaining a chosen date
    outside that range. 시간 offers 30-minute steps and retains a chosen time
    between steps. The calendar popover is a UI follow-up.
  - 만들기 is unavailable while the name is empty, with the reason in a tooltip.
  - 만들기 creates a new service file with the checked items, in order, with new
    item IDs. Song references, 구성 names, background overrides, start 매크로,
    and memos copy as they are. A section comes along if it or any of its
    children is checked. The new service becomes the current service. The output
    doesn't change. The flow creates an empty service, copies only the checked
    items, and then opens it.
  - A `write-failed` result from creation or copying means the edit is already
    applied in main, with a pending disk save. Continue with the applied service
    id after creation and continue to opening after copying. Keep the copied
    items; main retains the pending save and reports its save problem (08).
    Retrying the disk save must not create the service again, copy the items
    again, or roll back the applied copy.
  - A refused create or rejected create call keeps the dialog and reports the
    failure. Only a refused copy or rejected copy call starts rollback: try
    deleting the new empty service. If that deletion is applied in main, keep
    the dialog so the operator can retry. A `write-failed` deletion counts as
    applied cleanup; main retains its pending disk operation. If deletion is
    refused or its call rejects, try opening the created service, report the
    copy failure, and close the dialog.
  - If opening a created service fails, report the failure and close the dialog,
    leaving the created service in main.
  - Two services can share a name and date.
  - Source lists update while the dialog is open. Keep the selected source id,
    including an automatic choice, when a rename changes its sort order. Keep
    its checks and read its updated contents. If it is deleted, select the first
    remaining 템플릿, or 빈 예배 if none remain.
  - List reads are independent: a failed list doesn't hide successful ones, and
    다시 시도 retries failed reads. Late document reads never replace the
    current source choice.
  - Tab enters the checkable tree once; Up, Down, Home, and End move between
    rows, Left moves to a row's section, and Space toggles a check. Enter stays
    in the tree without creating the service. Each row exposes its level,
    position, group size, and checked or mixed state to assistive technology.
  - While creating, 취소, Escape, and the close button wait for the result.
    Successful operator actions don't add a notification; failures use the
    shared notification list (08).
- Starting from a 템플릿 follows ProPresenter's New Playlist from Template
  (S19). Starting from a past service is this project's addition.

Source: `NewService`, `Main` decision "새 예배", `Dialog` README, `Checkbox`
README, product log version 63. Implementation decisions: accepted P4 requests
`docs/reviews/spec-48.md` through `docs/reviews/spec-53.md`, including the
lead's date/time choice and source-menu decision recorded in those requests.

## Importing from another service

- Opens from 파일 > 다른 예배에서 가져오기 (import from another service) or from
  the service list.
- The dialog "다른 예배에서 가져오기" has the 템플릿 and 지난 예배 lists on the
  left (no 빈 예배), and a tree with check boxes on the right. Song rows show
  the chosen 구성 name as a detail ("주일용").
- The first 템플릿 is selected initially, or the first other service if there is
  no 템플릿. The open service isn't offered as a source. When the operator picks
  a source, nothing is checked, including when returning to a source.
- 가져오기 (import) appends the checked items to the end of the current service,
  in source order. A section comes along if it or any of its children is
  checked, so the items keep their group. Items get new IDs.
- 가져오기 is unavailable while nothing is checked, with the reason in a
  tooltip. The action is also unavailable without an open service or when the
  open service is read-only.
- The source lists, tree keyboard behavior, and late-read handling follow "New
  service" above. Renaming the automatically selected source never changes its
  id or drops checked items when the list reorders. If a selected source is
  deleted, use the first remaining 템플릿 or other service, with nothing
  checked. With no source left, show that there is nothing to import from.
- While importing, the dialog waits for the result before closing. A plain
  success or `write-failed` result means the items are already applied in main,
  so the dialog closes. With `write-failed`, main retains the applied items and
  pending disk save and reports its save problem (08). Retrying that save must
  not import the items again.
- A refused import or rejected import call keeps the dialog and reports the
  failure through the shared notification list. An applied import adds no
  separate action-result notification. Importing doesn't change output.
- No ProPresenter source describes copying items from another playlist. It's
  this project's addition.

Source: `ServiceImport`, `Main` decision "다른 예배에서 골라 가져오기", product
log versions 61 and 63. Implementation decisions: accepted P4 requests
`docs/reviews/spec-51.md` and `docs/reviews/spec-53.md`.

## Switching services

The service list opens from the service name in the 예배 순서 header in both
진행 and 준비. See 04.

## Saving the current service as a 템플릿

- Opens from 파일 > 지금 예배를 템플릿으로 저장, from the service list, or from
  the bottom of the left list in the new service dialog.
- Save a copy of the current service as a new 템플릿 named after the service.
  Keep content items and empty sections. The section rows remain even when they
  contain no content. A template has no slot items.
- If a 템플릿 with the same name exists, show the confirmation dialog "‘주일
  예배’ 템플릿이 이미 있습니다. 덮어쓸까요?" (This 템플릿 already exists.
  Overwrite it?) with 취소, 새 템플릿으로 저장 (save as new 템플릿), and
  덮어쓰기 (overwrite).
- 새 템플릿으로 저장 uses the first unused numbered name, such as 주일 예배 2,
  then 주일 예배 3. 덮어쓰기 saves the new copy before deleting the previous
  템플릿. Only a successful disk save allows that deletion. If the new copy
  exists only in memory after a write failure, keep the previous 템플릿; the
  app's save failure notification explains the pending save (08).
- The action is unavailable without an open service or while a save is in
  progress. The conflict prompt waits for the write result before closing.
  Success adds no notification; failures use the shared notification list.

### Renaming and deleting sources

- The 템플릿 and 지난 예배 rows in both service source dialogs have a
  right-click menu with 이름 바꾸기 and 삭제. The context-menu key opens the
  same menu for a focused row. The 새 예배 dialog's 지난 예배 group covers every
  service; the service picker's rows don't need a second source menu.
- 이름 바꾸기 opens a small dialog with the current name. 바꾸기 is unavailable
  while the trimmed name is empty or unchanged. Rename preserves the whole
  document and uses its current revision, so a concurrent change refuses the
  rename and keeps the newer document intact. A refusal keeps the rename dialog
  and reports 이름을 바꿀 수 없음.
- 삭제 asks for confirmation. The open service can't be deleted: the menu item
  is unavailable with the tooltip 열린 예배는 삭제할 수 없습니다, and main also
  refuses the delete. A refused delete reports 삭제할 수 없음.
- Both prompts wait for their operation's result before dismissal. A rename's
  document read and write both take part in the window's close flush, so the
  window can't close before an already-started rename reaches main; closing also
  prevents new rename operations from starting.
- After rename or delete, both source dialogs follow the updated lists and
  preserve or replace the selected source as described above. Success adds no
  notification.

Source: `ServiceSwitch`, `NewService`, `ImportMenu`, `Main` board guide (예배
순서 바꾸기). Implementation decisions: accepted P4 requests
`docs/reviews/spec-52.md` and `docs/reviews/spec-53.md`, including the lead's
row-menu decision.

## Text import

### Starting an import

- Every enabled 파일 > 가져오기 entry and the media panel's 가져오기 starts over
  the current workspace. A native file picker opens before any workspace change.
  Canceling preserves the workspace, selection, and unsaved drafts. The app's
  import dialogs stay over that workspace while choosing options or matching
  이름표. Only the final successful action opens 준비 and selects the imported
  item. A refused action keeps its dialog and the current workspace. For text,
  the final action is 편집, after 이름표 맞추기의 적용. For media, completion
  means the file has joined the library after analysis; canceling or failing an
  import never opens 준비. Disabled import formats stay disabled.
- 파일 > 가져오기 > 텍스트 파일 (text file) opens a file dialog for one `.txt`
  file. The operator imports one file at a time. (Product log version 59
  replaced the "1 / 3" multi-file flow of version 57.)
- 파일 > 가져오기 > 클립보드 텍스트 (clipboard text) reads the text on the
  clipboard. The item is unavailable when the clipboard has no text (proposal).
- 파일 > 가져오기 > PowerPoint 파일 comes later (see 09).

### Reading the text

- Encoding follows the 환경설정 option 글자 인코딩 (encoding). 자동 (auto)
  detects a UTF-8 or UTF-16 byte order mark, then tries UTF-8, then falls back
  to CP949 (proposal).
- Title (proposal, open question):
  - For a text file, the title is the file name without the extension. The
    board's example takes the title from the file name and keeps the first line
    as lyrics.
  - For clipboard text, if 첫 줄 (first line) is 제목 (title), the first line
    that isn't an 이름표 line becomes the title and leaves the lyrics. If 첫 줄
    is 가사 (lyrics), the title starts empty.
- 슬라이드 나누기 (split) options, set in the dialog's option bar:

| Option               | Unit                                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 빈 줄 (blank line)   | A paragraph separated by blank lines                                                                                                                            |
| 줄 바꿈 (line break) | Each non-empty line                                                                                                                                             |
| 기호 (symbol)        | Text between delimiter symbols. No board shows where to enter the symbol. Version 1 adds a short field after the option, default "/" (proposal, open question). |

- 한 슬라이드에 (per 슬라이드) N: the number of units in each 슬라이드. The
  default is 1 for 빈 줄 and 2 for 줄 바꿈 (proposal).
- 이름표 인식 (detect 이름표): with the 환경설정 option 이름표: 대괄호 줄
  (bracket lines), a line that holds only a bracketed name, such as "[후렴]", is
  an 이름표 line. Its slides share that 이름표 until the next 이름표 line; the
  preview band appears on the group's first slide. An 이름표 line never becomes
  a lyric line.
  - Compare names after trimming, without case sensitivity. An exact match in
    the list suggests that 이름표, before any English-name rule.
  - Suggest `Verse N` and `V N` as `N절`; `Intro` as 전주; `Chorus` and
    `Refrain` as 후렴; `Pre-Chorus`, `PreChorus`, and `Pre Chorus` as
    프리코러스; `Bridge` as 브리지; `Post-Chorus` and `PostChorus` as
    포스트코러스; `Interlude` and `Instrumental` as 간주; and `Ending`, `Outro`,
    and `End` as 후주. Ignore spaces, hyphens, and case in these English names.
    Also suggest 엔딩 as 후주 and 브릿지 as 브리지, after checking for an exact
    user-list match.
  - A typo suggests an English name only when exactly one name is within one
    edit, or two edits for names of seven letters or more. Insertion, deletion,
    substitution, and adjacent transposition count as edits (`Chrous` suggests
    후렴). Keep the header text if no unique suggestion exists.
  - Suggest a mapped 이름표 only if it exists in the user's list; otherwise keep
    the original header. Suggest `N절` even when the list lacks it (`Verse 4`
    suggests `4절`). A chosen or typed name outside the list is added with no
    color only when the song is saved.
- Trim blank lines at the start and end, and trailing spaces on each line
  (proposal).
- Before splitting (proposal): CRLF and CR line endings become LF, and tabs
  become spaces. With 자동 encoding, a UTF-8 or UTF-16 byte order mark decides
  first; without one, the bytes are read as UTF-8 only if they are valid UTF-8,
  and otherwise as CP949.
- 줄 바꿈 respects stanza breaks: a blank line always ends a 슬라이드, so 한
  슬라이드에 2 never joins the last line of one stanza with the first line of
  the next. This follows ProPresenter's import ("with respect for stanza
  breaks", S4 p. 90 in 10).
- 기호 splits wherever the symbol appears, inside a line or on its own line. The
  text between two symbols, trimmed, is one unit, and its line breaks stay.
  Empty units are dropped (proposal).
- An 이름표 line is a line that holds only a name in square brackets, with
  optional spaces: `[ 후렴 ]` gives 후렴. Other brackets, such as "(후렴)", are
  lyrics. An 이름표 line also ends the current 슬라이드, so its 이름표 starts a
  new 슬라이드 (proposal).
- The imported song has one group for each 이름표 line, named by it. The text
  before the first 이름표 line is one group with no name. The import writes this
  song as it is; it never converts an older format.
- The preview updates at once when an option changes.

### Import dialog

- The dialog is "텍스트 가져오기" (text import). Its subtitle is the file name,
  or "클립보드 텍스트" for clipboard text (proposal).
- Option bar at the top: 슬라이드 나누기, 한 슬라이드에, 이름표 인식.
- Body: the 제목 (title) field, the 슬라이드 count ("슬라이드 4"), and a
  슬라이드 preview grid with 이름표 bands.
- With 이름표 인식 on, open 이름표 맞추기 above the import dialog if any
  distinct header lacks an exact match in the 이름표 list. Don't open it if all
  headers match or there are no headers. Turning recognition off and on opens it
  again with the last choices.
- 이름표 맞추기 uses Dialog size m. Its scrolling list has one row per distinct
  header in file order, including exact matches. Columns are 머리줄 (the name in
  brackets), 이름표, and 첫 줄 (the first lyric line under that header's first
  use, truncated to one line).
- Each 이름표 field starts with its suggestion and color swatch. Click the field
  or its chevron for the song editor's 이름표 menu: 이름표 없음, then the list
  with swatches and a check on the current choice, without 이름표 관리…. Picking
  fills the field; typing replaces its text. An unknown name shows "새 이름표"
  inside the field. 이름표 없음 clears the group's name.
- Footer: 머리줄 그대로 쓰기 and 적용 (primary). Esc and the close button keep
  the original header names, as 머리줄 그대로 쓰기 does. 적용 assigns each
  header's chosen name to all its slides, preview bands, and saved groups,
  preserving section boundaries. Neither action saves anything.
- If the mapped groups exceed the song import limits, 적용 is unavailable and
  its tooltip gives the reason. The previous draft stays unchanged; shortening a
  name or choosing another 이름표 can make 적용 available again.
- If the 라이브러리 already has the title, the title field shows the error ring,
  with the tooltip "라이브러리에 같은 제목의 곡이 있습니다". Don't add labels,
  chips, or status text.
- Footer: 저장 안 함 (discard) and 편집 (edit, the primary button). The dialog
  has no save button.
- 저장 안 함 closes the dialog. Nothing is saved.
- 편집 closes the dialog, switches to 준비, and opens the unsaved song in the
  song editor.

### Editing an imported song

- The editor is the song editor, with these differences:
  - The header has an editable title field (the duplicate outline stays), the
    기본 배경 select, and the buttons 저장 안 함 and 저장 (save, the primary
    button).
  - The song isn't in the 라이브러리 and isn't saved until 저장. It isn't
    autosaved, and a crash loses it (proposal).
- While the draft is open, if the operator selects another song or item or
  starts another import, ask in a confirmation dialog: "가져온 곡을 저장하지
  않았습니다. 버릴까요?" (The imported song isn't saved. Discard it?) with 취소
  and 저장 안 함 (proposal).
- 저장 is unavailable while the title is empty, with the tooltip "곡 제목을
  적어야 저장할 수 있습니다".
- 저장 with a new title saves the song to the 라이브러리 with a new ID. The
  editor turns into the normal song editor (autosave from then on), and the song
  is selected in the 라이브러리.
- 저장 with a title that exists opens the confirmation dialog:

| Part    | Content                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------ |
| Title   | "‘만복의 근원 하나님’ 곡이 이미 있습니다. 덮어쓸까요?" (This song already exists. Overwrite it?) |
| Detail  | "라이브러리 곡 슬라이드 4개, 10월 20일 수정" (라이브러리 song, 4 슬라이드, edited October 20)    |
| Buttons | 취소 (left), 새 곡으로 저장 (save as new song), 덮어쓰기 (overwrite, primary)                    |
| Keys    | Enter is 덮어쓰기. Esc is 취소.                                                                  |

- The answers:
  - 덮어쓰기 replaces the existing song's title, 슬라이드, background, and 구성
    with the imported song's, and keeps the existing song ID so that 예배 순서
    references stay valid (proposal). 예배 순서 items whose 구성 name no longer
    exists use 기본. The old version stays as a recovery copy (see 02).
  - 새 곡으로 저장 saves a new song with a new ID. Because titles are unique
    (proposal), append " (2)", or the next free number, to the title (proposal).
  - 취소 returns to the editor. Nothing is saved.

Source: `ImportMenu`, `ImportText`, `ImportEdit`, `ImportSave`, `Prefs`
(가져오기), `AlertDialog` README, `TextField` README, product log versions 57
and 59.

## Shared bottom 미디어 bin

- This is the same bottom bin in 진행 and 준비, not a separate 준비 workspace
  mode. 04 defines the shared visibility toggle, saved choice and workspace
  activation rules. Use the same
  [Layout height allocation](../../design/system/project/components/Layout/README.md#shared-media-bin-height)
  as 진행: reserve a 440px upper workspace, a 168px minimum bin and one panel
  gap, cap the bin at 300px and 40% of the available work-area height, and
  reduce it first to preserve the upper workspace. At 1280x720 and 100% app UI
  zoom, a saved-open bin has 178px below a 440px workspace. If both minima
  cannot fit, the work area scrolls vertically while the bars stay fixed;
  visibility remains open. Editor, list, grid, preview and properties bodies
  scroll within their allocated panels, preserving headers and footers.
- Left column inside the bin:
  - 미디어 panel (header "미디어" with 새 재생목록, new playlist): the 보관함
    (library) group with 모든 미디어 (all media, count 42), and the 재생목록
    (playlists) group with each playlist and its count.
  - 오디오 panel (header "오디오" with 새 오디오 재생목록, new audio playlist):
    the audio playlists with their counts.
- Center inside the bin: a header with the playlist name and count ("배경 영상
  7"), a grid and list view toggle, and 가져오기 (import). A grid of media tiles
  (picture, duration chip with a loop icon when the media loops, name). Footer:
  count and total size ("7개 2.1GB") and a thumbnail size slider (2 to 8
  columns).
- Right inside the bin: the 미디어 속성 panel with the tabs 미디어 속성 (media
  properties), 정보 (info), 전환 (transition), and 소리 (sound). Above the
  groups: a preview player with a play button, the position ("0:12"), the time
  left ("0:18 남음"), the media name, the file path, and 파일 위치 열기 (open
  file location).

### Properties

| Group           | Row                  | Control                                       |
| --------------- | -------------------- | --------------------------------------------- |
| 재생 (playback) | 끝나면 (at the end)  | 반복 (loop) or 정지 (stop)                    |
| 재생            | 구간 (range)         | 시작 (start) and 끝 (end) time fields         |
| 재생            | 속도 (speed)         | Number field, for example 1.0×                |
| 화면 (screen)   | 맞춤 (fit)           | 맞추기 (fit), 채우기 (fill), 늘리기 (stretch) |
| 소리 (sound)    | 소리 켜기 (sound on) | Checkbox                                      |
| 소리            | 음량 (volume)        | Slider, unavailable while the sound is off    |

- Changes apply at once and save. If the media is on output, the change applies
  live (proposal).
- No board shows the content of the 정보, 전환, and 소리 tabs. The app shows
  read-only file information (kind, resolution, duration, size) in 정보, and
  leaves out the 전환 and 소리 tabs until they're defined (open question).

### Behavior

- In 준비, clicking a tile selects it and shows exactly one item's properties
  inside the bin. Double-clicking outputs it as the background (03). In 진행,
  clicking a playable tile or pressing Enter on a focused tile outputs it
  without changing selection or properties (04). LIVE marks what is on output.
  In both workspaces, right-click 속성… selects the tile and shows its
  properties without output. These actions follow the October 31 user decision
  and ProPresenter's click-to-fire and right-click Inspector actions (S4 in 10,
  pp. 21 and 104). Playing the local preview does not affect output. Changing
  playlists clears an excluded selection.
- The same 가져오기 action in both workspaces opens a file dialog immediately
  for one or more video, image, or audio files, starting in the last import
  folder (02). Cancellation keeps that folder. Supported formats come from the
  technical test in `docs/TECH.md`.
  - Every imported file is copied into the configured media folder (November 7
    user decision, so a moved file or a pulled USB stick can't break a service);
    there is no option. A file already inside the media folder is not copied
    again. Explorer drops do the same.
  - A copying tile shows progress (dimmed picture, percent, progress bar). It
    can't be clicked, and its right-click menu has only 복사 멈추기. A file
    already in the media folder shows analysis progress only. Cancellation or
    failure never deletes an original source file.
  - After placement, a helper process reads the thumbnail and duration. The
    media joins 모든 미디어 and the selected playlist.
  - A file that can't play shows a warning icon on its tile, with the reason in
    a tooltip (proposal).
- Dropping files from Windows Explorer on the grid imports them (proposal).
- Dragging tiles onto a playlist in the left column adds them to that playlist
  (proposal).
- The right-click menu of a tile has 재생목록에서 빼기 (remove from playlist)
  and 삭제 (delete from the media list). Deleting media that songs or items use
  asks in a confirmation dialog (proposal).
- 새 재생목록 adds a playlist named "새 재생목록" in rename mode (proposal).
- Selecting an audio playlist shows its tracks in the center as a list
  (proposal).
- The 효과음 (sound effects) playlist has a different icon in the board. Whether
  it behaves differently is an open question.
- A tile whose file is missing opens a file dialog to relink it when clicked.
  Its right-click menu has 다시 연결. See 08.

Source: the user's October 26 shared-bin decision (04), `Media`, `MediaTile`
README, `StatusMarks` README (progress bar), `Slider` README, `docs/TECH.md`
media. Existing media features move into the bin; the layout move does not
expand the feature-freeze scope.
