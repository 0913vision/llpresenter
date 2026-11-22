# 05. The 준비 workspace

준비 (Prep) is the workspace for preparing songs and services. This document
covers the 라이브러리 and search, the song editor, 예배 순서 item settings,
adding items, creating and importing services, saving a 템플릿, text import, and
the shared bottom 미디어 bin.

Terms: 슬라이드 (slide), 예배 순서 (service order), 템플릿 (template), 이름표
(label), 라이브러리 (library), 매크로 (macro), 청중 화면 (main screen), 무대
화면 (stage screen), 방송 화면 (broadcast captions), 진행 (Show workspace), 빠른
실행 (quick launch). See 01.

## Layout

On entering 준비, its service-order list is already positioned at 준비's own
remembered selection before the first paint. A selection already visible stays
in place; returning does not animate the list or change output.

| Column | Panels                                                              | Source                  |
| ------ | ------------------------------------------------------------------- | ----------------------- |
| Left   | 예배 요소 / 곡                                                      | `Reflow`, `PrepService` |
| Center | The 예배 순서 table ("The 예배 순서 table and inline song editing") | `Reflow`, `PrepService` |
| Right  | The selected source's 세부정보                                      | `Reflow`, `PrepService` |

- In an editor, the left column is a compact numbered 예배 순서 navigator, or
  the library when editing a library song. Its rows use compact spacing for the
  number, icon and name, with no count; a truncated name shows its full text in
  a tooltip. The editor occupies the center and the slide inspector occupies the
  right column for song and slide items; Bible and media items retain their
  existing preview there.
- A single click selects a library song or service item. Double-click or Enter
  opens its editor. In the navigator, clicking a row or pressing Enter switches
  items after the leave guard and queued item edits have settled; arrow keys
  move focus.
- Back and Esc outside text fields return to the list, restoring the selected
  row, keyboard focus and scroll position. Tab moves through the navigator,
  center and right panels in that order.
- The same bottom 미디어 bin as 진행 sits below these columns. Opening it keeps
  the editor, selected service item and unsaved drafts in place. Its visibility
  and media selection follow 04.
- The previews in 준비 never affect the output. Clicking a 슬라이드 in 준비 only
  selects it.
- The same 라이브러리 song can be open in the song editor while it's on output
  in 진행.
- The right column has one scroll containing the first-slide picture, the source
  heading and the selected information or slide grid tab.
- Lists, editor bodies, property panels, dialogs and pickers reserve vertical
  scrollbar space. Crossing the overflow threshold must not change their content
  width or move neighboring controls.

Source: `Reflow`, `PrepService`, `Main` decision "작업 공간 세 개", design
system README (window sizes and layout).

## The 예배 순서 table and inline song editing

The table and inline song editor share the service selection.

### 준비

- The center table shows 이름, 슬라이드, 시작할 때, and 메모. Counts and
  thumbnails use the item's own slides. The library stays on the left; 세부정보
  stays on the right.
- Column headings stay pinned while table rows scroll. This applies to every
  table, including shortcut settings and import label mapping. Scrolling a row
  into view leaves it below the headings.
- The first slide, including a section-name card when present, is a full-width
  16:9 picture for every item kind. Its label strip matches the slide grid.
  Selecting a grid picture does not change the first picture or output.
- Double-click or Enter opens the editor of any item, or of a library song ("The
  editor of an item").
- Song item menus offer 라이브러리에 저장… and 라이브러리에서 다시 불러오기.
  Both ask before replacing slides; saving to the library includes its usage
  line. Nothing synchronizes automatically. 구성 controls, their changed dot,
  the order strip, and the 순서 편집 window are removed.
- 항목 and 구역 at the end of the table add after the selected item, at the end
  of a selected section, or at the end when nothing is selected. The song picker
  starts with no highlight for an empty search; typing a character or pressing ↑
  or ↓ highlights the first result. It adds the single highlighted song with
  Enter, double-click, or 추가. The search field keeps focus as ↑ and ↓ move the
  highlight; with no result, 추가 is disabled with a reason. Cell edits target
  the row containing the cell, including when its background file is missing.
- Cells without a start macro or memo stay empty while retaining their menu or
  field on click and a frame on hover. Item rows are 44px and section rows 32px;
  section names have a thin line above except the first.
- The table shares 진행's item selection and clipboard (04, "Editing the 예배
  순서 in 진행"): Shift selects a range, Ctrl toggles rows, and Ctrl C/V, 편집
  and the row menu copy/paste complete items within or across services. Pasting
  is one undo step and never changes output or the source item.

## The editor of an item

One editor opens every item, of any kind, and a library song. Its left column is
the compact 예배 순서, or the library; its right column shows the selected
슬라이드.

- **목록** has a row for each 슬라이드 with its picture and a column for each
  named box of its 테마. The 열 menu switches the columns, 다음 글 included, on
  and off; the choice is kept for each 테마. **격자** shows the pictures alone
  and edits nothing.
- **Typing.** Enter adds a row. Ctrl Enter cuts the 슬라이드 at the caret.
  Backspace at the beginning joins it to the one before when both have one 테마;
  parts of one verse join in one row. Pasted text starts a 슬라이드 at each
  blank row. Leaving the last row or the first with an arrow goes on in the next
  슬라이드.
- **The right column** shows the 슬라이드 on the screen chosen above it, the
  texts of all its boxes and 다음 글, then 테마, 배경 (with its 맞춤, size, and
  place for a picture), 전체 슬라이드에 적용, 이름표, and 전환. A setting
  changes every selected 슬라이드; differing values are shown as mixed.
- 다음 글 is what the 슬라이드 before shows on 무대. Its field shows the phrase
  of the 테마 until the operator types a text of its own; clearing it brings the
  phrase back.
- 슬라이드 추가 makes one in the 테마 that follows the one before it, with the
  same background. 타이틀 adds a title of the list.
- A media tile dropped on a 슬라이드, or on the picture at the right, becomes
  its background; on a selected one it becomes the background of the whole
  selection. Audio and missing files are refused with a reason.
- The menu of a 슬라이드 has 슬라이드 추가, 오버레이 추가…, 단축키…, 이름표, and
  the edit commands. See "오버레이" in 12, "이름표 menu", and "Slide hot keys".
- Every change is saved to the item at once. Ctrl Z and Ctrl Y step through the
  changes of the service. A live 슬라이드 follows its changes on the outputs
  without a transition.
- **성경 구절 and 설교** also have 절 나누기, which cuts a verse as the app
  would and lets the operator move the cuts, and 본문 변경…. A verse whose text
  was changed by hand can't be cut by the app: "직접 고친 절은 여기서 나눌 수
  없습니다". Verses that stay keep their 슬라이드 and settings.
- **사도신경 and 주기도문** have 새 번역 and 옛 번역, which put the text of that
  version in and keep an opening 타이틀.
- **곡** has 라이브러리에 저장… and 라이브러리에서 다시 불러오기. Both ask
  first.

### Selection

- Rows and pictures share click, Shift range, Ctrl toggle, Shift arrows, Ctrl A,
  and Esc. A clicked gap clears the selection and shows an insertion caret;
  arrows move it. With no selection or caret, paste appends.
- Ctrl C, X, and V copy, cut, and paste whole 슬라이드. Copies get new IDs and
  no hot key. Plain text from outside splits at blank rows.
- Ctrl D duplicates after the selection; Delete removes the whole selection as
  one step. Dragging moves it together. A library song keeps at least one
  슬라이드; an item may be empty.
- Esc in a text field leaves it and selects its 슬라이드. The next Esc clears
  the selection; with none, Esc returns to the table or the library.

## 예배 순서 panel in 준비

- The header, service switcher, and 항목 추가 (add item) work as in 진행 (see
  04).
- Each row shows a detail at the right: the 슬라이드 count for songs, Bible
  passages ("슬라이드 9개"; for a song, the length of the item deck), and the
  duration for media ("5:00").
- Selecting a song item opens its item settings (see "예배 순서 item settings").
- In the editor, Bible and media items show their current item panels in the
  center. Slide and section-card items use the slide editor.
- The operator drags rows to reorder them. Dragging a 구역 moves it with its
  items, up to the next 구역, as one section (user decision, October 26). Delete
  immediately removes all selected rows without a confirmation or notice, and
  Ctrl Z restores them in one step. The selection, counted drag image, duplicate
  and context-menu rules are shared with 진행 (04, 11). Ctrl Z and 편집 > 실행
  취소 undo every edit of an item the same way, one step each: a change in its
  cells or the right column (메모, 테마, 배경, 시작할 때, 오버레이) as well as
  the order edits (10, "Focus precedence"). The right-click menu has 삭제
  (delete) (proposal).
- The list accepts 라이브러리 songs dropped on it (see "Adding items to the 예배
  순서").

Source: `Reflow`, `PrepService`, `AddSongs`, `ListRow` README.

## 준비 element palette

- In the list view, the left panel starts with 예배 요소 and 곡 tabs. 곡 keeps
  the library; the foldable media bin remains available in the list and editor.
- 순서 offers 예배 준비, 사도신경, 주기도문, 설교, 성경 구절, 광고, 빈 슬라이드,
  구역, and 대기 화면. Creeds and prayers use the new translation by default;
  their context menu also offers the old one. 사도신경 and 광고 start with their
  타이틀.
- 타이틀 offers the titles of a service and the operator's own as chips. Double
  click or Enter inserts an element after the current item or at the end of the
  selected section; dragging inserts at the order drop line. 성경 구절 opens the
  passage dialog.
- A media tile dropped on the table inserts a media item at the drop line.
  Missing files are refused with a reason.

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
- Clicking a row selects the song; double-click or Enter opens the song editor.
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

- The right-click menu of a 라이브러리 row has 삭제. It deletes immediately
  without a confirmation or notice; undo restores the song.
- After the delete, 예배 순서 items that point to the song show the problem
  state, with the tooltip "곡을 찾을 수 없습니다" (song not found), and can't
  output.
- No board shows song deletion (open question).

Source: `Reflow`, `PrepService`, `TextField` README, `AlertDialog` README.

For scripture slides, a new library's 말씀 theme uses a replaceable teal picture
with editable NanumSquare Bold verse text and the whole passage range on the
audience screen (12). To author a sermon title with the same look, add a blank
슬라이드 item, name it with the passage range, enter the title as the slide
text, and choose the sermon title theme. The title wraps automatically to two
lines. This theme uses the existing item fields; it does not change the Bible
passage or the stored verses.

To show the preparation screen, add a 빈 슬라이드 item with one empty slide and
choose 예배 준비. Its two audience messages are editable 글 elements in the
theme, so the slide needs no text. This is separate from the 대기 화면, which
initially shows the church's service times when no item is live (12).

## Song editor

A library song opens in the same editor ("The editor of an item"). What differs:

### Header

- The title field, 저장 (Ctrl S), 다른 이름으로 저장… for a saved song, and how
  many services use the song. A dot marks unsaved changes.
- An empty title, or one another song has, can't be saved; the field shows the
  reason.
- Changes wait for 저장, which asks before it overwrites the song. Leaving with
  unsaved changes asks 저장, 저장 안 함, or 취소. An imported song is unsaved
  until 저장 adds it to the library.
- A new song begins with a 찬양 제목 슬라이드 and one of 찬양 가사. Renaming the
  song renames the title on the 슬라이드 that shows it. The menu of a 슬라이드
  has 제목 슬라이드 추가.

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

## 예배 순서 item settings

The right column of the table shows the selected item: one 슬라이드 on the
screen chosen above it, 편집, and the 정보 and 슬라이드 tabs. 정보 has 시작할 때
and 메모 under 이번 예배, and what the item was made from under 원본. 슬라이드
shows the pictures of the item in a grid with a remembered size; a double click
opens the editor at that 슬라이드.

### What belongs to the service and what belongs to the song

An item owns its 슬라이드, overlays, start macro, and memo. The library song
owns its title and its own 슬라이드. Explicit save and reload copy between them.

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
  toolbar search Ctrl Enter, quick add, the table footer, untargeted song drops,
  and media tile menus insert after the selected item or at the end of a
  selected section, or at the end when none is selected. Bible insertion follows
  the same section rule. Paste deliberately inserts immediately after the
  selected row, including a section header. Explicit row drops retain their drop
  position. A successful insertion selects and scrolls to the new row when the
  operator has not moved the selection while it was saving.
- Other items (proposal):
  - 구역 추가: inserts an empty section named "새 구역" in rename mode.
  - Bible and sermon passage entry use the shared passage dialog (04), including
    recent passages, reference matching and validation. Sermon entry also has
    its title field in the dialog; changing an existing sermon keeps its title
    and reference unless edited. Enter submits a valid passage; Tab moves
    between fields. Escape clears the reference first, then closes.
  - 미디어: a submenu with the media list. Missing files cannot be added and
    show the reason in a tooltip.

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
  - Bottom bar: 이름 (name) and 날짜 (date).
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
    for 빈 예배. The date defaults to today and is chosen with a calendar. New
    files store `T00:00` to satisfy the existing date-time format; a source
    template's time and a past service's time do not affect the new service.
  - 만들기 is unavailable while the name is empty, with the reason in a tooltip.
  - 만들기 creates a new service file with the checked items, in order, with new
    item IDs. Song references, independent slide decks, background overrides,
    start 매크로, and memos copy as they are. A section comes along if it or any
    of its children is checked. The new service becomes the current service. The
    live item stops and all outputs return to standby. Before creating anything,
    the service-change guard asks for confirmation when an output shows live
    content (04); cancel leaves the service and output unchanged. The flow
    creates an empty service, copies only the checked items, and then opens it.
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
lead's date and source-menu decisions recorded in those requests. QA-110
supersedes the earlier time choice.

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
- 삭제 acts immediately without a confirmation or notice. The open service can't
  be deleted: the menu item is unavailable with the tooltip 열린 예배는 삭제할
  수 없습니다, and main also refuses the delete. A refused delete reports 삭제할
  수 없음.
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
- 파일 > 가져오기 > PowerPoint를 슬라이드로 opens the PowerPoint import below.

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

## PowerPoint

파일 > 가져오기 has PowerPoint에서 곡 가져오기… and PowerPoint를 이미지로
가져오기…, also while an item is open. Both take `.ppt`, `.pptx`, and `.pptm`. A
`.ppt` is converted from a private copy by PowerPoint with macros disabled.
Hidden slides are skipped. A 4:3 file is refused: "4:3 파일은 가져올 수
없습니다. PowerPoint에서 16:9로 바꿔 주세요".

### 곡 가져오기

There is no dialog. A notice with 취소 shows while the file is read, and then
the song editor opens every slide as one unsaved song, asking first about
another song with unsaved changes. Which slides are titles is in 02,
"PowerPoint". Slides that are not wanted are deleted in the editor.

The whole background of each slide, as PowerPoint draws it without the text,
comes in while the song can be edited already; slides that look the same share
one picture. Until then the slide is plain, black, or white under dark texts. A
small bar in the header shows that pictures still come in, and 저장 waits for
them. Leaving the song stops the export.

Saving puts the backgrounds that the slides still use into the media library. A
picture that is there already is used again; others are named after the song. A
song that is left unsaved leaves nothing behind.

If PowerPoint is missing or can't export a slide, its background stays empty and
a notice says so. Another file can't be read while pictures come in.

### 이미지로 가져오기

Each visible slide is exported as a 1920 × 1080 picture into one 빈 슬라이드
item after the selected row. The pictures belong to the item and its copies and
never appear in media lists. A notice shows the progress with 취소.

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
  and 삭제 (delete from the media list). Deletion is immediate and undoable.
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

### Theme element selection commands

The element list supports Ctrl toggles, Shift ranges and Ctrl A. Right-click on
a selected element preserves the set; another element selects only itself.
Z-order commands and list drags move the whole set in its existing stacking
order. Canvas drags translate all selected elements by the same delta, clamping
the group at the canvas boundary without changing gaps. Both drag surfaces show
the count. Delete from a key or menu immediately removes the selected elements
without a confirmation or notice. Each deletion records one undo step.

Each open-file picker remembers the folder of its last selected file across
restarts. When that folder is unavailable or unset, the picker opens Documents;
canceling leaves its remembered folder unchanged.
