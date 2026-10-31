# 05. The 준비 workspace

준비 (Prep) is the workspace for preparing songs and services. This document
covers the 라이브러리 and search, the song editor, 예배 순서 item settings,
adding items, creating and importing services, saving a 템플릿, text import, and
the shared bottom 미디어 bin.

Terms: 슬라이드 (slide), 예배 순서 (service order), 템플릿 (template), 구성
(arrangement), 이름표 (label), 라이브러리 (library), 매크로 (macro), 공지
(notice), 본 화면 (main screen), 무대 화면 (stage screen), 방송 자막 (broadcast
captions), 진행 (Show workspace), 퀵 실행 (quick launch). See 01.

## Layout

| Column | Panels                                                                                             | Source                           |
| ------ | -------------------------------------------------------------------------------------------------- | -------------------------------- |
| Left   | 예배 순서 (remaining height), 라이브러리                                                           | `Reflow`, `PrepService`          |
| Center | Song editor (when a 라이브러리 song is selected) or 예배 순서 item (when a song item is selected). | `Reflow`, `PrepService`, `Media` |
| Right  | Preview and 슬라이드 list (song editor), or preview and 항목 설정 (item settings)                  | `Reflow`, `PrepService`          |

- The same bottom 미디어 bin as 진행 sits below these columns. Opening it keeps
  the editor, selected service item and unsaved drafts in place. Its visibility
  and media selection follow 04.
- The previews in 준비 never affect the output. Clicking a 슬라이드 in 준비 only
  selects it.
- The same 라이브러리 song can be open in the song editor while it's on output
  in 진행.

Source: `Reflow`, `PrepService`, `Main` decision "작업 공간 세 개", design
system README (window sizes and layout).

## 예배 순서 panel in 준비

- The header, service switcher, and 항목 추가 (add item) work as in 진행 (see
  04).
- Each row shows a detail at the right: the 슬라이드 count for songs, Bible
  passages, and 공지 ("슬라이드 9개"; for a song, the length of the chosen
  구성), and the duration for media ("5:00").
- Selecting a song item opens its item settings (see "예배 순서 item settings").
- No board shows the center panel for other item kinds. Version 1 shows these
  (proposal):
  - Bible passage: the Bible panel of 04 without the output buttons, so the
    operator can change the translation and split.
  - Media: the media properties of that media.
  - 공지: the images of the 공지 set.
  - Section (구역): an empty center panel.
- The operator drags rows to reorder them. Delete removes the selected item
  without confirmation, and Ctrl Z restores it (proposal). The right-click menu
  has 삭제 (delete) (proposal).
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
  song?), with the detail "예배 순서 2곳에서 씀" (used in 2 services), and the
  buttons 취소 (cancel) and 삭제.
- After the delete, 예배 순서 items that point to the song show the problem
  state, with the tooltip "곡을 찾을 수 없습니다" (song not found), and can't
  output.
- No board shows song deletion (open question).

Source: `Reflow`, `PrepService`, `TextField` README, `AlertDialog` README.

## Song editor

The song editor edits the 라이브러리 song, which is the source for every 예배
순서 that uses it. Edits save automatically and show at once in every 예배 순서.

### Header

- The title and the 슬라이드 count ("슬라이드 4개"), a 라이브러리 tag (folder
  icon), and "예배 순서 2곳" (used in 2 services, link icon). The second tag
  counts the 예배 순서 files that point to the song. Its tooltip lists their
  names (proposal).
- 기본 배경 (default background): a select with a small image and the media
  name. Choosing a media saves it as the song's `background`. The menu also has
  없음 (none).
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

- The label "구성" and a segmented control: 기본 (default), then the song's 구성
  names (주일용, 짧게), then 구성 추가 (add 구성, plus icon).
- A 구성 is an ordered list of named groups, with repeats (October 27 user
  decision). Choosing it shows the expanded slides on the right. The source
  editor keeps master group order; repeated group occurrences share the same
  lyrics. The order is edited in the item's group chip strip (see below).
- 구성 추가 creates a 구성 that copies the order of the chosen 구성, adds it as
  a new segment, and puts its name into rename mode with the name "구성 1"
  (proposal).
- The right-click menu of a segment has 이름 바꾸기 (rename) and 삭제
  (proposal). 기본 can't be renamed or deleted.
  - Because 예배 순서 items pick a 구성 by name, a rename also updates the
    `arrangement` value of every 예배 순서 item that points to this song and the
    old name (proposal).
  - After a delete, items that picked that 구성 use 기본 (proposal).
- If the song has more than five 구성, show a select instead of the segmented
  control (design system `SegmentedControl` rule).

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
  - "이름표 없음" (no 이름표), then the 이름표 list (1절, 2절, 3절, 프리코러스,
    후렴, 브리지, 간주, 엔딩), each with its color swatch. The current one has a
    check mark.
  - A separator, then the color row of the current 이름표 (for example "후렴
    색", chorus color): 없음 (none) and the eight colors.
  - A separator, then 새 이름표 (new 이름표).
- Choosing a name sets the group's `name`. Starting a new group at a slide
  splits the current group there, retaining every arrangement's slide order
  (02). Renaming one group does not merge it with another same-named group.
- Choosing a color in the color row changes that 이름표's color in the app-wide
  list at once, and the menu stays open. Every group with that name, in every
  song, changes color.
- 새 이름표 opens a name field in the menu. Enter adds the name to the end of
  the list with no color and sets it on the group (proposal).

### Managing the 이름표 list (proposal)

Version 1 adds a right-click menu to each name in the 이름표 menu. Hot keys
belong to particular source slides, not this app-wide name/color registry
(October 27 S26 user decision).

| Item                 | Behavior                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 이름 바꾸기 (rename) | Renames the 이름표 in the list and rewrites the name in every 라이브러리 song that uses it. Recovery copies apply (see 02). |
| 삭제 (delete)        | Removes the name from the list only. Songs keep the name, and it draws with no color.                                       |

### Slide hot keys

- The source slide's editor control opens 슬라이드 바로 가기 키. Store an
  optional physical `KeyA` through `KeyZ` or `Digit0` through `Digit9` in
  `groups[].slides[].hotKey` (02). No assignment is the default.
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

- A segmented control switches between 본 화면, 무대, and 방송 자막. The preview
  shows the selected 슬라이드 drawn with the current Look for that screen.
- Caption: the 이름표 color swatch and name, the position ("3 / 4"), and the
  style name ("기본").

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

- Header: the song title and the length of the sequence ("슬라이드 9개"), the
  name of the service the item belongs to ("주일 예배"), and 라이브러리 곡 편집
  (edit 라이브러리 song). That button opens the source song in the song editor.
- 구성 row: the label "구성" and a select that shows the chosen 구성 ("주일용").
  The menu lists 기본 and the song's 구성. It also has 새 구성 (new 구성), which
  creates a 구성 in the song as a copy of the current order and chooses it
  (proposal).
- Chip strip: one chip per group occurrence, showing its name in the 이름표
  color and a grip. Unnamed groups show 이름표 없음 and their source position.
  Repeated group IDs produce repeated chips, not duplicated source slides.
  - Dragging a chip reorders the sequence. Alt+← and Alt+→ move the selected
    chip one place.
  - Delete removes that group occurrence from the 구성. It never deletes the
    source group or its slides.
  - 그룹 넣기 (insert group, plus box) opens the song's groups in master order,
    with name, source position and first line, and appends the chosen group. The
    same group may be inserted more than once.
  - Selecting a chip selects the first thumbnail of that occurrence. The chip
    containing the live slide has the on-output ring. Repeated occurrences have
    distinct sequence positions even though they reference one group.
  - Chip edits change the chosen 구성 in the song file. So they show in every
    예배 순서 that uses that 구성 (product log version 61, open question).
  - With 기본 chosen, the chips are read-only, with the reason in a tooltip
    (proposal).
- Thumbnail grid: the 슬라이드 in sequence order. Clicking only selects. A
  thumbnail size slider sits in the footer.

### Preview and 항목 설정 (right)

- Preview: the same segmented control as in the song editor. The caption shows
  the 이름표, the position in the sequence, and the style name ("프리코러스 5 /
  9 기본").
- The 항목 설정 panel has these groups:

| Group                    | Row                  | Control                                                                                                 | Behavior                                                                                                                                                                                     |
| ------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 원본 (source)            | 곡 (song)            | Song title with a link icon and the detail "라이브러리", plus 라이브러리 곡 열기 (open 라이브러리 song) | The button opens the song editor.                                                                                                                                                            |
| 이번 예배 (this service) | 배경 (background)    | Select with a small image                                                                               | Shows the item's background. Without an override, the detail reads "곡 기본값" (song default). Choosing a media saves the override. The menu item 곡 기본값 removes the override (proposal). |
| 이번 예배                | 시작할 때 (on start) | Select with the 매크로's color tile and the detail "매크로"                                             | The 매크로 to run when the item starts (see 07). The menu has 없음 (none) and the 매크로 list.                                                                                               |
| 메모 (memo)              |                      | Multiline text field                                                                                    | Free text for this item.                                                                                                                                                                     |

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
  (Bible passage), 미디어 (media), and 공지.
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
  - 공지: a submenu with the 공지 sets.

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

Source: the user's October 26 check decision, recorded under
[Decisions from the m3-check3 user check](../decisions.md#2026-10-26-decisions-from-the-m3-check3-user-check).

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
  is unavailable with the tooltip 열린 예배 순서는 삭제할 수 없습니다, and main
  also refuses the delete. A refused delete reports 삭제할 수 없음.
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
  an 이름표 line. The first 슬라이드 after it gets that 이름표, and the
  following 슬라이드 get none until the next 이름표 line (proposal). An 이름표
  line never becomes a lyric line.
  - If the bracketed name matches an 이름표 in the list, use it. Otherwise, use
    the bracketed text as the name, and add it to the 이름표 list with no color
    when the song is saved (proposal). Whether to map English names such as
    "[Chorus]" to Korean ones is an open question.
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
- The preview updates at once when an option changes.

### Import dialog

- The dialog is "텍스트 가져오기" (text import). Its subtitle is the file name,
  or "클립보드 텍스트" for clipboard text (proposal).
- Option bar at the top: 슬라이드 나누기, 한 슬라이드에, 이름표 인식.
- Body: the 제목 (title) field, the 슬라이드 count ("슬라이드 4"), and a
  슬라이드 preview grid with 이름표 bands.
- If the 라이브러리 already has the title, the title field shows the error ring,
  with the tooltip "라이브러리에 같은 제목의 곡이 있습니다". Don't add labels,
  chips, or status text.
- Footer: 버리기 (discard) and 편집 (edit, the primary button). The dialog has
  no save button.
- 버리기 closes the dialog. Nothing is saved.
- 편집 closes the dialog, switches to 준비, and opens the unsaved song in the
  song editor.

### Editing an imported song

- The editor is the song editor, with these differences:
  - The header has an editable title field (the duplicate outline stays), the
    기본 배경 select, and the buttons 버리기 and 저장 (save, the primary
    button).
  - The song isn't in the 라이브러리 and isn't saved until 저장. It isn't
    autosaved, and a crash loses it (proposal).
- While the draft is open, if the operator selects another song or item or
  starts another import, ask in a confirmation dialog: "가져온 곡을 저장하지
  않았습니다. 버릴까요?" (The imported song isn't saved. Discard it?) with 취소
  and 버리기 (proposal).
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
- Right inside the bin: the media properties panel with the tabs 속성
  (properties), 정보 (info), 전환 (transition), and 소리 (sound). Above the
  groups: a preview player with a play button, the position ("0:12"), the time
  left ("0:18 남음"), the media name, the file path, and 파일 위치 열기 (open
  file location).

### Properties

| Group           | Row                  | Control                                       |
| --------------- | -------------------- | --------------------------------------------- |
| 재생 (playback) | 끝나면 (at the end)  | 반복 (loop) or 멈춤 (stop)                    |
| 재생            | 구간 (range)         | 시작 (start) and 끝 (end) time fields         |
| 재생            | 속도 (speed)         | Number field, for example 1.0×                |
| 화면 (screen)   | 맞춤 (fit)           | 맞추기 (fit), 채우기 (fill), 늘리기 (stretch) |
| 소리 (sound)    | 소리 켜기 (sound on) | Switch                                        |
| 소리            | 음량 (volume)        | Slider, unavailable while the sound is off    |

- Changes apply at once and save. If the media is on output, the change applies
  live (proposal).
- No board shows the content of the 정보, 전환, and 소리 tabs (open question).
  Version 1 shows read-only file information (kind, resolution, duration, size)
  in 정보, and leaves out the 전환 and 소리 tabs until they're defined
  (proposal).

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
  - 미디어 폴더로 복사 is an option, off by default (October 27 user decision).
    It uses `preferences.json` `media.copyOnImport`, shared by the file dialog
    and Explorer drops. Off references the original file; on copies into the
    configured media folder. Existing files and queued jobs do not move when the
    option changes. A request snapshots its choice before admitting jobs.
  - A copying tile shows progress (dimmed picture, percent, progress bar). It
    can't be clicked, and its right-click menu has only 복사 멈추기. Imports
    that reference a file still show analysis progress without pretending to
    copy it. Cancellation or failure never deletes an original source file.
  - After placement, a helper process reads the thumbnail and duration. The
    media joins 모든 미디어 and the selected playlist.
  - A file that can't play shows a warning icon on its tile, with the reason in
    a tooltip (proposal).
  - 가져오기 설정 beside 가져오기 opens a checked menu item 미디어 폴더로 복사.
    It edits the same preference as 환경설정 > 미디어. This local placement
    keeps the option reachable before the full Preferences window lands; it does
    not add a separate import mode or delay opening the file dialog.
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
  Its right-click menu has 다시 연결 (relink). See 08.

Source: the user's October 26 shared-bin decision (04), `Media`, `MediaTile`
README, `StatusMarks` README (progress bar), `Slider` README, `docs/TECH.md`
media. Existing media features move into the bin; the layout move does not
expand the feature-freeze scope.
