# 05. The 준비 workspace

준비 (Prep) is the workspace for preparing songs and services. This document
covers the 라이브러리 and search, the song editor, 예배 순서 item settings,
adding items, creating and importing services, saving a 템플릿, text import, and
the shared bottom 미디어 bin.

Terms: 슬라이드 (slide), 예배 순서 (service order), 템플릿 (template), 이름표
(label), 라이브러리 (library), 매크로 (macro), 청중 화면 (main screen), 무대
화면 (stage screen), 방송 화면 (broadcast captions), 진행 (Show workspace), 퀵
실행 (quick launch). See 01.

## Layout

| Column | Panels                                                              | Source                  |
| ------ | ------------------------------------------------------------------- | ----------------------- |
| Left   | 라이브러리                                                          | `Reflow`, `PrepService` |
| Center | The 예배 순서 table ("The 예배 순서 table and inline song editing") | `Reflow`, `PrepService` |
| Right  | The selected item's 미리보기 and 슬라이드                           | `Reflow`, `PrepService` |

- The same bottom 미디어 bin as 진행 sits below these columns. Opening it keeps
  the editor, selected service item and unsaved drafts in place. Its visibility
  and media selection follow 04.
- The previews in 준비 never affect the output. Clicking a 슬라이드 in 준비 only
  selects it.
- The same 라이브러리 song can be open in the song editor while it's on output
  in 진행.
- At a fixed window and bin size, selecting another item keeps the right
  column's preview and slides panel boundaries in place. Different item controls
  scroll inside those panels instead of redistributing their heights. Song and
  slide previews reserve the same caption height; extra Bible-part controls
  scroll without shrinking the picture.
- Lists, editor bodies, property panels, dialogs and pickers reserve vertical
  scrollbar space. Crossing the overflow threshold must not change their content
  width or move neighboring controls.

Source: `Reflow`, `PrepService`, `Main` decision "작업 공간 세 개", design
system README (window sizes and layout).

## The 예배 순서 table and inline song editing

The user decided this on November 2 (drafts o1 to o6 and g5, outside the
repository). The table, inline song editor, and 오버레이 bar on the 슬라이드
have landed.

### 준비

- The center table shows 이름, 슬라이드, 테마, 배경, 시작할 때, and 메모. Counts
  and thumbnails use the selected item's own slides. The library stays on the
  left; preview and the slides grid stay on the right.
- Column headings stay pinned while table rows scroll. This applies to every
  table, including shortcut settings and import label mapping. Scrolling a row
  into view leaves it below the headings.
- 미리보기 uses the same panel as 진행 (04): a plain title, ordered screen
  choices, identical picture and caption geometry, and the same default height
  budget. Its caption may show the selected slide's label, position and theme.
  There is no extra bar below the picture.
- The song name band sits above the thumbnail viewport without overlapping it.
  When a selected thumbnail row is taller than the viewport, automatic scrolling
  keeps its top visible instead of clipping it to align its bottom. This holds
  after a width, zoom or panel-height change.
- The preview keeps one full-width 16:9 picture for every item kind: songs,
  Bible passages, blank slides, announcements, sermons, videos, and images.
  Media previews show the file and name. With no item or a section selected, the
  stage and caption stay blank at the same size so the panels below do not move.
- Double-click or Enter on a song row, or 곡 편집, opens the existing song
  editor inside 준비 on that item's deck. A library row opens its library song
  instead.
- Song item menus offer 라이브러리에 저장… and 라이브러리에서 다시 불러오기.
  Both ask before replacing slides; saving to the library includes its usage
  line. Nothing synchronizes automatically. 구성 controls, their changed dot,
  the order strip, and the 순서 편집 window are removed.
- 항목 and 구역 at the end of the table add after the selected row, or at the
  end when nothing is selected. Themes, backgrounds, macros, memo, and section
  behavior retain their existing rules.
- Editable background cells with no background show 없음 and open the same
  picker on the first click. Cells without a start macro or memo stay empty
  while retaining their menu or field on click and a frame on hover. Item rows
  are 44px and section rows 32px; section names have a thin line above except
  the first.
- The table shares 진행's item selection and clipboard (04, "Editing the 예배
  순서 in 진행"): Shift selects a range, Ctrl toggles rows, and Ctrl C/V, 편집
  and the row menu copy/paste complete items within or across services. Pasting
  is one undo step and never changes output or the source item.

### Slides items and 슬라이드 편집

Song and slides item editors mark selection with a `selection` plate around the
thumbnail and number band, with 6px padding and 9px outer radius. Hover uses
`bg-raised`; live keeps its red ring and keyboard focus its own outline. The
list puts the normal Checkbox before the number, visible on selection, hover or
keyboard focus with its space reserved. Checkbox click or Space on a focused
slide toggles that slide without Ctrl; plain click selects only it, and Shift
and Ctrl keep their range and toggle behavior. Text fields retain normal Space
entry. The grid has no Checkbox, including hover and focus. Selection does not
dim when focus leaves. 진행 retains its existing thumbnail style.

- 항목 추가 offers 구역 이름 with the ordered section names from the shared
  Sunday section list (12), without inserted spaces. Choosing a name inserts an
  editable 빈 슬라이드 after the selection, or appends without a selection,
  selects it and opens 슬라이드 편집. The item uses its Korean name, the 구역
  이름 theme, the section's ordinary background picture, one text slide with the
  English name (empty for 묵상기도), and manual advance. Item name, slide text
  and background remain editable through the normal controls. A missing theme
  definition is added for the configured screens; an existing theme is
  preserved. Preparation also copies absent section backgrounds and the rules
  picture into an existing media catalog. Existing media IDs and operator
  replacements are preserved, and existing disk files are never overwritten. If
  preparation fails, no section item is inserted.
- 항목 추가 also offers 사도신경 and 주기도문 submenus, each with 새 번역
  (Protestant 2004) and 옛 번역. All four insert after the selected row, or
  append without a selection, using an editable 빈 슬라이드 item named for the
  prayer, the 사도신경, 주기도문 theme, and manual advance. The editor opens
  with the first slide selected. Bundled slides contain one paragraph each,
  wrapping at spaces like 말씀 at 104 px; premeasured sentence boundaries (or
  comma splits for sentences over four lines) are fixed in the content, with
  아멘. attached to the final sentence and no runtime slide splitting.

- 항목 추가 offers 빈 슬라이드 and 광고 before 미디어. Each inserts after the
  selected row, selects the item, and opens 슬라이드 편집. Without a selection
  it appends. 빈 슬라이드 starts with one empty text slide and manual advance.
  Its editor puts the caret in slide 1's text field, ready to type. 광고 starts
  with one empty named text slide, 8-second advance, and 반복 enabled. Its
  default audience theme has the blue-purple notice picture with a fixed slash,
  an automatic text-slide number, the slide name, and a bulleted body (12).
  Operators enter plain body lines; the theme adds hanging bullets. Picture
  slides cover the frame and do not consume a notice number.
- Both forms use the same slides icon. The table shows the editable item name,
  slide count, item theme or form default, background, start macro, and memo.
  The right column shows the preview, item name, 슬라이드 편집… and themed
  thumbnails. Item properties stay in table cells. It has no 순서 편집… action.
  Thumbnail bands show the number and ad name, picture filename, or first line
  of blank text.
- Double-click or Enter on a blank, ad, or sermon slides item opens its editor
  in 준비's center. Existing 슬라이드 편집 requests use the same editor, with no
  separate window. The back button shows the service name. Esc in a slide text
  field selects its row; subsequent presses clear selection and go back. The
  right column keeps the selected draft's preview and slide grid. Its edit
  button is hidden while that item's editor is open, including song items.
- Opening an item or library song by double-click, Enter, or its edit action
  focuses the editor's list command surface with the first slide or the source
  slide selected. Editing keys work without another click. A new song opened by
  Ctrl N keeps focus in its title. Returning from the editor focuses the
  originating service or library row.
- Song title fields keep a 160px minimum and a 280px maximum (`size-field-key`
  and `size-field-title`). Secondary header controls wrap when necessary,
  instead of squeezing the title; ultrawide headers keep the same maximum.
- The header edits 이름, 테마, 넘기기 (손으로 or every 3, 5, 8, 10, 15, 20, or
  30 seconds), and 반복. Its first row uses the song editor's height, padding,
  and alignment: back, name field, then actions. Theme, advance, and loop sit
  together on the second row. Each row has a thumbnail in the item's theme. Ad
  text rows have 이름 and 내용; blank text rows have 글. A picture row has its
  filename and 바꾸기…. 글 추가 adds a text row; 그림 추가 and 바꾸기 choose
  pictures from the media list. A structured verse slide shows its read-only
  Bible reference and stays intact when other item fields are saved.
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
- Click a row to select it, Shift to extend a range, or Ctrl to toggle one. Ctrl
  A selects all and Esc clears. Clicking a gap clears selection and sets a 2px
  insertion caret; arrows move it and Shift arrows extend selection. Ctrl C/X/V
  copy, cut, and paste; Ctrl D duplicates after the selection. Paste inserts at
  the caret or after the last selected row. Copies get new IDs and retain
  picture IDs, ad names, and verse references. Structured rows paste between
  items of the same form; outside plain text (including copied song lines) makes
  text rows split at blank lines.
- Drag moves the whole selection in document order with a count badge. Delete
  outside a text field is immediate for one item; more than one asks once with
  the count. It removes the selection as one undo step. The row and gap context
  menus expose clipboard, duplicate, delete, undo, and redo commands with
  shortcuts. Text fields keep native text selection and clipboard behavior. Ctrl
  Z and Ctrl Y undo and redo local item edits and row commands in one shared,
  100-step history, restoring row selection and the caret. Removing rows focuses
  the list command surface, including an empty list, so keyboard undo remains
  available. The preview has 청중 화면, 무대 화면, and 방송 화면 tabs and a
  position caption. Automatic saves keep typing focus and text selection.
  Acknowledging a write does not break the current typing undo group.
- Service item edits save automatically through the service edit path, the same
  as song items. There is no 저장 button or save/discard question on leaving;
  only a library song retains explicit 저장. Both local item history and the
  service's history cover saved changes. Leaving the editor keeps queued writes
  and the item's undo history alive. Edits made during a write follow it in
  order, including edits to another item of the same service.
- Automatic writes merge edited fields into the fresh item, preserving
  concurrent changes to other fields. Conflicting changes to the same field
  refuse the write and keep the edits for 다시 시도. The shared retry action
  retries every item whose automatic save failed. Application close flushes
  pending writes and refuses to close when they fail, without a draft question.
- Rows and both right-column grids share the song editor's selection, caret,
  clipboard, drag, and undo implementation. Table-grid edits save through the
  same item writer; opening and returning from the editor retains its history.
- Enter or forward Tab in a song title or slides item name commits the name and
  puts the caret in the first slide's text field. Empty song text fields have a
  visible field fill and border, without instructional text.

### 오버레이 on 슬라이드

The bar and menus work in the selected item's slide list. Song-item ranges store
endpoint slide IDs (02), so moves keep the endpoints attached.

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

- 곡 편집 replaces 준비's center table with an inline editor. Its back button
  names the service for an item, or 라이브러리 for a library song. Returning
  keeps the service item selected. No 곡 편집 window opens.
- An item edits its independent slide deck and saves through its service's
  revision check. Its title is read-only; 라이브러리에 저장… asks before
  explicitly copying its saved slides to the source song, including usage.
- A library song has 저장 and 다른 이름으로 저장…. Its changes stay local until
  저장, with the overwrite question. Leaving a dirty song asks 저장, 저장 안 함,
  취소. Cancel retains the draft and previous selection.
- The right column keeps its preview and one scrolling slide grid. There is no
  항목 설정 panel. Theme, background, start macro and memo stay in table cells;
  메모… in the row menu also works when the memo column is hidden.

## 예배 순서 panel in 준비

- The header, service switcher, and 항목 추가 (add item) work as in 진행 (see
  04).
- Each row shows a detail at the right: the 슬라이드 count for songs, Bible
  passages ("슬라이드 9개"; for a song, the length of the item deck), and the
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
  is immediate for one row and asks once with the selected count for more than
  one. It removes all selected rows, and Ctrl Z restores them in one step. The
  selection, counted drag image, duplicate and context-menu rules are shared
  with 진행 (04, 11). Ctrl Z and 편집 > 실행 취소 undo every edit of an item the
  same way, one step each: a change in its cells or the right column (메모,
  테마, 배경, 시작할 때, 오버레이) as well as the order edits (10, "Focus
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

### New song

- 파일 > 새 곡 and the library's plus open one blank slide titled 새 곡 in the
  inline editor, with the title focused. No library file or row exists until
  저장 succeeds.
- Leaving an untouched new song discards it silently. After an edit, leaving
  asks 저장, 저장 안 함, 취소. A refused save keeps the draft open.

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

For scripture slides, a new library's 말씀 theme uses a replaceable teal picture
with editable NanumSquare Bold verse text and the whole passage range on the
audience screen (12). To author a sermon title with the same look, add a blank
슬라이드 item, name it with the passage range, enter the title as the slide
text, and choose 설교 제목 or 설교 제목 (두 줄). The second theme accepts a
title with a line break. These themes use the existing item fields; they do not
change the Bible passage or the stored verses.

To show the preparation screen, add a 빈 슬라이드 item with one empty slide and
choose 예배 준비. Its two audience messages are editable 글 elements in the
theme, so the slide needs no text. This is separate from the 대기 화면, which
initially shows the church's service times when no item is live (12).

## Song editor

The inline editor uses the same slide selection, clipboard and undo model as the
right-column grid. A library song and every service item own independent decks.
Library changes wait for 저장; item changes save only to that item.

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
  - An invalid title isn't saved. Manual drafts retain it with the field's
    reason so the operator can correct it.

### Slide rows

- Each row has an 18px number column, a 112px themed thumbnail, lyrics and an
  이름표 chip, with 14px padding and 16px gaps. Each row is one slide, including
  adjacent slides with the same name. Unnamed chips show 이름표; free names use
  neutral colors. There are no group boundaries or shared chorus occurrences.
- Enter adds a line. Ctrl Enter splits at the cursor with a fresh slide ID.
  Backspace at the beginning merges into the preceding slide even when names
  differ. Pasting text with blank lines creates separate slides. Ctrl Shift N
  adds a blank slide; an empty item has 슬라이드 추가.
- Ctrl Z and Ctrl Y undo and redo up to 100 steps. Typing groups until the
  cursor leaves the row or one second passes. Split, merge, and label edits each
  form a step.

### 이름표 menu

Every row chip opens 이름표 없음, catalog names with swatches, a separator, 이름
적기…, and 이름표 관리…. 이름 적기… accepts a trimmed free name of 1–64
characters in an inline field. Clicking a selected slide's chip keeps a multiple
selection; the name applies to all selected slides as one undo step. It does not
add the name to the shared catalog.

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
focuses and selects its name. Creation does not assign it to the current slide.
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

| Item                 | Behavior                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 이름 바꾸기 (rename) | Renames the 이름표 in the list and rewrites the name in every library song, service item and template that uses it. Recovery copies apply (see 02). |
| 색 (color)           | Applies the color to every slide with that name in songs and service items.                                                                         |
| 삭제 (delete)        | Removes the name from the list only. Songs keep the name, and it draws with no color.                                                               |

### Slide hot keys

- The shared thumbnail 슬라이드 menu's 단축키… row opens 슬라이드 단축키 in the
  song editor. The item view opens that editor at the clicked source slide
  first. There is no separate hot-key bar. Store an optional physical `KeyA`
  through `KeyZ` or `Digit0` through `Digit9` in `slides[].hotKey` (02). No
  assignment is the default.
- Assign a key to one slide; it must be unique within its library or item deck.
  Other decks may use the same key. Conflicts name the current slide number.
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
  that exact slide, independently of 이름표 (04).

### Preview

- A segmented control switches between 청중 화면, 무대, and 방송 화면. The
  preview shows the selected 슬라이드 drawn with the 테마 of the item for that
  screen.
- Caption: the 이름표 color swatch and name, and the position ("3 / 4").

### 슬라이드 list

- Header: "슬라이드" and the count. Thumbnails of the 슬라이드 in deck order.
- Rows and thumbnails share click, Shift range, Ctrl toggle, Shift arrows, Ctrl
  A, and Esc selection. A clicked gap clears selection and shows a 2px insertion
  caret; arrows move it. With no selection or caret, paste appends.
- Ctrl C/X/V and their menu rows copy, cut and paste full slides with labels.
  Copies receive fresh IDs and no conflicting slide keys. Plain text from
  outside splits at blank lines. Repeated fast paste waits for copy and stays
  one undo step per paste; moving focus or selection cancels a delayed paste.
- Ctrl D duplicates after the selection; Delete is immediate for one slide, asks
  once with the count for more than one, and removes the whole selection as one
  undo step. Selected right-click targets preserve the set; unselected targets
  first become the only selection. Menus hide commands that apply to only one
  member and count set-wide commands. Drag moves it together. These operations
  use the same 100-step history as typing, labels, split and merge. A library
  retains at least one slide; an item may be empty. Read-only decks allow
  selection and copy.
- The preview follows selection without output. Esc in a slide's lyrics, 글,
  이름, or 내용 field leaves text editing and selects that row, focusing the
  list command surface without changing its text. The next Esc clears selection
  or the insertion caret; with neither, Esc returns to the table from anywhere
  in the editor, including when focus has fallen to the body. Leaving a dirty
  library song still asks 저장, 저장 안 함, or 취소. IME composition keeps its
  own Escape behavior.
- A thumbnail size slider sits in the footer.

Source: `Reflow`, `ImportEdit`, `LabelChip` README, `LabelColorPicker` README,
`Menu` README, `TextField` README, `SlideThumbnail` README, product log (version
61 구성 presets, user-managed 이름표 colors; October 27 S26 user decision).

## 예배 순서 item settings

The center table holds the selected item's 테마, 배경, 시작할 때 and 메모. The
right column has two parts: 미리보기, then the item's slide grid filling the
remaining height with one scroll. A source-song link appears below the grid
header and opens that library song. The item keeps its own slide count, theme
and slides even when its library source changes.

### What belongs to the service and what belongs to the song

An item owns its slides, labels, keys, overlays, background override, theme,
start macro and memo. The library song owns its title, default background and
separate slide deck. Explicit save/reload actions copy slides between them;
changes never propagate to other items.

## Adding items to the 예배 순서

### Dragging from the 라이브러리

- Dragging a 라이브러리 row more than 4 px starts a drag. A ghost row follows
  the pointer.
- An insertion line snaps to the row boundary nearest the pointer in the 예배
  순서. The spot right below a section (구역) is valid, including an empty
  section. Over a valid spot, the ghost row shows a plus.
- Esc cancels the drag.
- A drop inserts a song item with a copy of its slides and background, and no
  start 매크로 (proposal).
- A drop into an empty section inserts a song after its section row. The section
  stays in the list.

Source: `AddSongs`, `ListRow` README.

### Quick add

- 항목 추가 offers 곡… first, opening a searchable library picker. Choosing a
  song and 추가 inserts a separate item deck. Library row 예배 순서에 추가,
  toolbar search Ctrl Enter, quick add, the table footer, Bible insertion,
  untargeted song drops, media tile menus and paste insert immediately after the
  selected service row, or at the end when none is selected. Explicit row drops
  retain their drop position. A successful insertion selects and scrolls to the
  new row when the operator has not moved the selection while it was saving.
- Other items (proposal):
  - 구역 추가: inserts an empty section named "새 구역" in rename mode.
  - 성경 구절: opens the shared four-field passage dialog (04). 책 accepts
    Korean full/short names, English names/codes, partial jamo and IME-off keys.
    Tab or Enter completes the book name and moves through 장, 시작절, 끝절;
    matching partial names are not marked red. `ckd` completes to 창세기, while
    `chd` has no match. Enter in 끝절 or 추가 inserts the validated passage with
    the default settings; earlier Enter presses never insert it. Escape closes
    an open suggestion list first, then closes the dialog without clearing the
    unfinished reference.
  - 미디어: a submenu with the media list.

Source: `AddSongsQuick`, `Main` board guide (예배 순서에 곡 넣기).

The default 주일 2부 예배 template is seeded when the Templates folder is
absent, including an existing data root. Existing template folders and their
contents are left alone. Its 광고 deck contains one placeholder notice with a
title and two content lines.

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
    item IDs. Song references, independent slide decks, background overrides,
    start 매크로, and memos copy as they are. A section comes along if it or any
    of its children is checked. The new service becomes the current service. The
    output doesn't change. The flow creates an empty service, copies only the
    checked items, and then opens it.
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
  the item’s slide count as a detail.
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
  preview band appears on every slide. An 이름표 line never becomes a lyric
  line.
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
    suggests `4절`). A chosen or typed name outside the list stays a free name
    with neutral colors. Saving does not add it to the shared list.
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
- Every imported slide keeps the mapped 이름표 of its section. Slides before the
  first 이름표 line have no label. The import writes this slide list directly;
  it never converts an older format.
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
  inside the field. 이름표 없음 clears the slide’s label.
- Footer: 머리줄 그대로 쓰기 and 적용 (primary). Esc and the close button keep
  the original header names, as 머리줄 그대로 쓰기 does. 적용 assigns each
  header's chosen name to all its slides, preview bands, and saved slides,
  preserving section boundaries. Neither action saves anything.
- If the mapped slides exceed the song import limits, 적용 is unavailable and
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
  - 덮어쓰기 replaces the library song at its checked revision, preserving its
    identity. Existing service items and templates keep their independent decks.
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
  columns). Before an operator adjusts it, the shared 진행/준비 bin starts from
  five columns and adds columns as needed to fit one complete 16:9 picture, its
  name and panel insets in the viewport height. This automatic fit follows
  window and bin resizing. The slider describes that initial state as 자동 크기;
  changing it selects an explicit column count, retained across subsequent
  resizes while the view remains open.
- Right inside the bin: the 미디어 속성 panel with the tabs 미디어 속성 (media
  properties), 정보 (info), 전환 (transition), and 소리 (sound). Above the
  groups: a preview player with a play button, the position ("0:12"), the time
  left ("-0:18"), the media name, the file path, and 파일 위치 열기 (open file
  location).

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
  inside the bin. Double-clicking clears slide text and shows the media alone
  (03). In 진행, clicking a playable tile or pressing Enter on a focused tile
  outputs it without changing selection or properties (04). LIVE marks what is
  on output. In both workspaces, right-click 속성 selects the tile and shows its
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

### Slide transition metadata

The service song editor ribbon has 편집 and 디자인 tabs. 디자인 places 테마
before 배경 and uses the same choices, names and writes as the service order's
table cells (not its right-click menu). 테마 offers 기본 and the stored themes;
배경 offers 곡 기본값 and image/video media. Media dragged onto slides creates
or replaces an overlay, rather than changing this background. Changes apply to
the captured service item, never the library song or another service's deck.
Pending lyric edits finish before appearance writes. A saved background change
updates the editor's baseline without replacing lyric undo history or slide
selection when the slide deck is unchanged. The separate editor window's preview
uses the captured service item's theme and follows its changes, including a
return to 기본. Read-only, blocked and saving states prevent changes. Returning
to 편집 keeps the slide selection and history. Library song editing omits 디자인
because themes belong to service items; its existing 기본 배경 control remains
in the header for the library song's default background.

The grouping follows PowerPoint's Design tab (Themes followed by Format
Background) and Google Slides' separate Theme and Background commands. Their
themes coordinate presentation appearance; their background commands change
slide fills. This app keeps its existing item-level scope and media choices.
Sources:
[PowerPoint themes](https://support.microsoft.com/en-us/powerpoint/training/add-color-and-design-to-your-slides-with-themes),
[PowerPoint backgrounds](https://powerpoint.cloud.microsoft/create/en/slide-backgrounds/),
and
[Google Slides theme and background](https://support.google.com/docs/answer/1705254?hl=en-GB).

Song and shared item editors preserve each slide's optional transition during
ordinary text, label, order, save, and clipboard edits (02).

- Above the slide list, the 효과 gallery offers 기본값, 없음, 디졸브, 밀어내기,
  and 닦아내기. 방향 is enabled only for the two directional effects. 시간 is
  always visible, from 0.1 to 10 seconds in 0.1-second steps, and disabled for
  기본값 and 없음.
- Changes affect the Shift/Ctrl selection in one undo step. 이 곡 전체에 적용
  copies the selected effect to every song slide in one step; shared slide items
  use 전체 슬라이드에 적용. Selection and unrelated slide fields stay intact.
  The apply button occupies its own row below 시간, aligned to that group's left
  edge, with the standard 30px control height. No preview instruction sentence
  appears below the effects; mixed-selection and multiple-selection status
  remain.
- 기본값 removes the override. Explicit effects, including 없음, show a small
  blue triangle at the thumbnail's bottom-right corner. Mixed selections have no
  pressed effect tile; direction, time and apply-all are disabled until a common
  effect is chosen. Read-only or blocked sessions cannot edit effects.
- The local preview redraws immediately without animation when typing, selecting
  slides, editing a theme or changing effects. Effect settings remain editable
  metadata; they play only on output and its live preview in 진행 (03).

### Song title slides

The song editor slide menu offers 제목 슬라이드 추가. It inserts the current
song title at the insertion caret, after the targeted slide, or at the start
when nothing is selected. Titles may repeat anywhere, including the last slide.
The existing text field edits the title on its first line and an optional
subtitle on its second line, each at most 512 characters. A single selected
title exposes 제목 자간 and 부제 자간 in px, saved per slide. Defaults are 0 and
24; each accepts -20 to 200. Ordinary move, duplicate, copy, paste, delete and
undo apply, retaining text and spacing. Splitting a title or merging across
either side of a title is refused. Title slides have no special transition
default; use the existing 슬라이드 전환 control to choose a slow transition when
desired. Library and service-local decks preserve every title.

### Theme element selection commands

The element list supports Ctrl toggles, Shift ranges and Ctrl A. Right-click on
a selected element preserves the set; another element selects only itself.
Z-order commands and list drags move the whole set in its existing stacking
order. Canvas drags translate all selected elements by the same delta, clamping
the group at the canvas boundary without changing gaps. Both drag surfaces show
the count. Delete from a key or menu is immediate for one element; more than one
asks once with the count. Each deletion records one undo step. A pending
confirmation cannot delete a changed document or layout.
