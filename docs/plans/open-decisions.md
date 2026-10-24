# Open decisions

Status: for the user's decision. Snapshot of `main` 4aa7901 and the spec
branches under review (spec-2 to spec-5), October 25, 2026.

This sheet collects every question in `docs/spec/` that still needs the user's
answer: the README open questions (1 to 26), the settings questions of 10 (10 to
18), the Bible questions of spec-4, and the settings proposal as a whole. Each
entry gives the question, the options, the proposal and why, what it blocks, and
what ProPresenter does. Until the user answers, the proposal applies
(`docs/decisions.md`, 2026-10-25).

Conventions:

- Entries are sorted by when the answer is needed: M2, then M3 by wave (A to D,
  then the requests that wait for an answer), M4, and later.
- Task IDs are the requests of the M3 plan (`docs/plans/m3-breakdown.md`,
  spec-3, under review).
- "S4 p. N" is a page of the ProPresenter 7.5 user guide. S1 to S18 are the
  sources listed in `docs/spec/10-shortcuts-and-settings.md`.
- "README N" and "question N" point to the open question tables of
  `docs/spec/README.md` and 10.
- **Batch** marks entries whose proposal is low risk and easy to change later.
  The user can accept them together.

## Summary

| #   | Topic                                | Needed by | Blocks               | Proposal                                             | Batch |
| --- | ------------------------------------ | --------- | -------------------- | ---------------------------------------------------- | ----- |
| 1   | Small inconsistencies                | M2        | ui, data             | 2 to 8 columns, 브리지, 10 recovery copies           | Yes   |
| 2   | Preview caption                      | M2        | ui, shell            | The style that each screen uses                      | Yes   |
| 3   | The settings proposal as a whole     | M3 wave A | D2, O1, O2, X2a      | Accept 10 as the settings spec                       |       |
| 4   | Prevent sleep, stability settings    | M3 wave B | O9a, O1              | Always on during output, no switch                   |       |
| 5   | Number of screens                    | M3 wave B | O1                   | Three fixed screens                                  |       |
| 6   | Navigating 화면 설정                 | M3 wave B | O1, O2, O3           | Three stacked lists                                  | Yes   |
| 7   | Transitions, media tabs              | M3 wave B | O4, P6b              | Global transitions, instant clears                   |       |
| 8   | Bible text source                    | M3 wave B | T4a                  | KJV from eBible.org, 개역한글 from CrossWire         |       |
| 9   | Bible files in the public repository | M3 wave B | T4a                  | Built at build time, not committed                   |       |
| 10  | A style for Bible passages           | M3 wave B | O4, O2, T4b          | A 말씀 style per screen in the Look                  |       |
| 11  | Text import details                  | M3 wave B | D3, P5               | File name or first line, a delimiter field           | Yes   |
| 12  | Editing a 구성 from a 예배 순서 item | M3 wave C | P3a, P2b             | The change applies everywhere                        |       |
| 13  | Which stage layout applies           | M3 wave C | O5, O3, T1a, T3a     | The Look sets it; tools override until the next Look |       |
| 14  | Startup 매크로                       | M3 wave C | T3a                  | Run when the app starts                              | Yes   |
| 15  | Slide deck items                     | M3 wave C | P3a, P4              | Short songs now, decks with PowerPoint import        | Yes   |
| 16  | Editors that no board shows          | M3 wave C | T1a to T4b, P1 to P4 | Right-click menus and plus buttons                   | Yes   |
| 17  | Toolbar search results               | M3 wave C | S1b                  | A dropdown list                                      | Yes   |
| 18  | Stage element memo                   | M3 wave C | O5, O3               | The item's memo                                      | Yes   |
| 19  | Sound of new videos                  | M3 wave D | P6a, P6b             | Off                                                  |       |
| 20  | Copy media on import                 | M3 wave D | P6a, P6b             | A switch, on by default                              |       |
| 21  | Opening the media view               | M3 wave D | P6b                  | 미디어 switches 준비 to the media view               | Yes   |
| 22  | Sound effects playlist               | M3 wave D | T2, P6b              | Like any audio playlist                              | Yes   |
| 23  | Bible reference frequency            | M3 wave D | T4b, data            | ProPresenter's four options                          |       |
| 24  | Enter in the Bible field             | M3 wave D | T4b                  | Enter outputs, like 바로 띄우기                      |       |
| 25  | 메시지 appearance                    | M3, waits | X1a, X1b, X1c        | A 메시지 style per screen in the Look                |       |
| 26  | Outline and shadow detail            | M3, waits | X2a, X2b, X2c        | Width and color; blur, distance, opacity, color      |       |
| 27  | The 일반 page                        | M4        | Settings window      | Hide one-option rows, add launch with Windows        |       |
| 28  | 지금 백업 during a service           | M4        | Settings window      | Unavailable while any output is on                   | Yes   |
| 29  | Menus                                | M4        | Menu bar             | The minimal menus of 01, no 내보내기                 | Yes   |
| 30  | Scheduled 매크로                     | Later     | Nothing in M3        | Later; the `schedule` field stays reserved           | Yes   |

## Needed in M2

### 1. Small inconsistencies (Batch)

- **Question:** Which value wins in three small conflicts between documents?
- **Options:** thumbnail size in 1 to 5 steps (`Slider` README) or 2 to 8
  columns (`SlideThumbnail` README); 브릿지 (`Reflow` board) or 브리지 (design
  system); 5 recovery copies (`docs/TECH.md`) or 10 (`Prefs` board).
- **Proposal:** 2 to 8 columns, 브리지, and 10 copies. A column count says what
  the operator sees; the design system wins over a board (`CLAUDE.md`); 10 is
  what the board shows, and 10's settings make it 3 to 50.
- **Blocks:** M2 ui (`SlideThumbnail`, `Slider`) and M2 data (recovery copies).
- **ProPresenter:** no equivalent checked.
- **From:** README 26.

### 2. Preview caption (Batch)

- **Question:** What does the right side of each preview's caption show?
- **Options:** (a) the Look name, as the `PreviewFrame` README says; (b) the
  lyric style or stage layout that the screen uses, as the boards show.
- **Proposal:** (b). One Look covers all three screens, so (a) repeats one name
  three times while the toolbar already shows it; the style name tells the
  screens apart. With (b), the `PreviewFrame` README changes, because otherwise
  the design system wins.
- **Blocks:** M2 ui (`PreviewFrame`) and M2 shell (the 진행 previews).
- **ProPresenter:** no source found.
- **From:** README 11.

## Needed in M3

### Wave A

#### 3. The settings proposal as a whole

- **Question:** Does the settings part of 10 replace 06 as the spec for
  settings?
- **Options:** (a) accept it, and decide questions 10 to 18 one by one (entries
  4, 7, 19, 20, 23, 25 to 28); (b) keep 06 and take rows from 10 one at a time.
- **Proposal:** (a). 10 checks every behavior in 01 to 09 for a setting, with
  ranges, defaults, and storage. It also answers README 12, 14, and 24, and
  moves 출처 위치 (reference position) into the lyric style, which X2a waits
  for.
- **Blocks:** D2 (the stored settings shape), then O1, O2, and X2a; the M4
  settings window.
- **ProPresenter:** 10 maps all 13 Preferences tabs (S4 pp. 169 to 192).
- **From:** 10, "Decision status".

### Wave B

#### 4. Prevent sleep, and stability settings in two places

- **Question:** Does prevent sleep stay a switch, and where do 항상 위 and 화면
  연결이 끊기면 live?
- **Options:** (a) sleep is always prevented while any output is on, with no
  switch, and the other two exist only per screen in 화면 설정; (b) switches in
  환경설정 > 출력 and in each screen, with 환경설정 giving the defaults for new
  screens (06 now).
- **Proposal:** (a). No service is better with sleep allowed, and defaults for
  new screens do nothing while version 1 has three fixed screens (entry 5).
- **Blocks:** O9a (sleep prevention) and O1 (screen properties).
- **ProPresenter:** none of the 13 Preferences tabs has a sleep setting (S4 pp.
  169 to 192).
- **From:** question 10, README 14.

#### 5. Number of screens

- **Question:** Can the operator add screens beyond 본 화면, 무대 화면, and 방송
  자막?
- **Options:** (a) three fixed screens, with the data kept as a list for more
  later; (b) 화면 추가 (add screen) in version 1.
- **Proposal:** (a). The decisions name three screens, and the toolbar, the
  status bar, and the previews are drawn for three.
- **Blocks:** O1 (the screen list). The M2 output windows already work from a
  list.
- **ProPresenter:** any number; the + button adds an audience or stage screen
  (S4 p. 32).
- **From:** README 13.

#### 6. Navigating 화면 설정, and the item in use (Batch)

- **Question:** How does the operator move between screens, Looks, and stage
  layouts in 화면 설정, and how is the one in use marked?
- **Options:** (a) three panels stacked in the left column (화면, Look, 무대
  배치), where a row switches the center and right columns; the item in use is
  marked in a way the design system allows, not with the boards' "사용 중" chip;
  (b) a separate page for each kind.
- **Proposal:** (a). Everything stays in one workspace without a mode switch.
- **Blocks:** O1 (the frame), O2, and O3.
- **ProPresenter:** three separate places: the Screens configuration (S4 p. 32),
  the Looks pane (p. 37), and the Stage Layout Editor (p. 40).
- **From:** README 23.

#### 7. Transitions, and the media 전환 and 소리 tabs

- **Question:** Where are transitions set, do clears and Look changes fade, and
  what do the media 전환 and 소리 tabs hold?
- **Options:** transitions (a) global in 환경설정 > 출력, kind and time for 장
  and backgrounds, or (b) per Look; clears and Look changes instant or fading;
  the two tabs left out (sound is the 소리 켜기 and 음량 rows of the properties)
  or filled.
- **Proposal:** (a) global; clears and Look changes stay instant; the two tabs
  are left out and 정보 shows read-only file information. An instant clear is
  what F1 to F7 promise in an emergency.
- **Blocks:** O4 (one constant until the answer) and P6b (media properties).
- **ProPresenter:** a master slide transition and a master media transition that
  per-item transitions override (S4 p. 166); all 메시지 share one transition (p.
  124). No source on clears.
- **From:** question 12, README 24.

#### 8. Bible text source

- **Question:** Where do the bundled 개역한글 and KJV texts come from?
- **Options:** for 개역한글, CrossWire `KorRV`, Korean Wikisource,
  crizin/bible-db, or scrollmapper; for KJV, eBible.org `eng-kjv`, scrollmapper,
  or crizin (02, "Candidate text sources", spec-4).
- **Proposal:** KJV from eBible.org, a standard format with a clear public
  domain statement; 개역한글 from CrossWire `KorRV`, checked verse by verse
  against crizin/bible-db by the conversion script. The economic rights to
  개역한글 ended on December 31, 2011 (Korean Bible Society); the app respects
  the moral rights by never changing a verse and by naming the publisher.
  개역개정 stays out, because it needs the society's permission.
- **Blocks:** T4a (M3 lead decision 4), then T4b.
- **ProPresenter:** installs Bibles from its own catalog (S4 p. 143), which
  doesn't help this choice.
- **From:** README 4, spec-4.

#### 9. Bible files in the public repository

- **Question:** May the converted translation files be committed to the public
  repository?
- **Options:** (a) no: the conversion script builds them from a pinned source
  file at build time; (b) yes: commit the converted files.
- **Proposal:** (a). No Bible text lands in the public repository, the app still
  works offline (`docs/TECH.md`, principle 5), and nothing is fetched at run
  time.
- **Blocks:** T4a and the build step that runs the conversion (no owner named
  yet).
- **ProPresenter:** not applicable.
- **From:** spec-4.

#### 10. A style for Bible passages

- **Question:** Do Bible passages draw with the current lyric style or with a
  style of their own?
- **Options:** (a) the current Look's lyric style (04 now); (b) a 말씀 style
  chosen per screen in the Look, next to the lyric style; (c) a style chosen per
  passage.
- **Proposal:** (b). Passages need smaller text and more lines than lyrics, the
  `Bible` board names the 본 화면 style "말씀", and ProPresenter also gives
  Bible slides their own theme. It adds one field per screen to the Look.
- **Blocks:** O4 (rendering), O2 (Look editor), and T4b; the field joins data's
  Look contract.
- **ProPresenter:** the Bible options choose the theme that formats the
  generated slides (S4 pp. 142 to 144).
- **From:** README 6.

#### 11. Text import details (Batch)

- **Question:** Where does an imported song's title come from, where is the 기호
  (symbol) delimiter typed, and do English bracket labels map to Korean 이름표?
- **Options:** title from the file name or the first line; a delimiter field
  after the 기호 option or a fixed symbol; "[Chorus]" kept as it is or mapped to
  후렴.
- **Proposal:** the file name for files and the first line for clipboard text,
  as in the `ImportText` example; a delimiter field, default "/"; bracket text
  kept as it is, because a mapping can guess the wrong 이름표.
- **Blocks:** D3 (wave B) and P5 (wave D).
- **ProPresenter:** "Slides delimited by" takes a custom marker such as "//" or
  "\*" (S4 p. 90), and clipboard import uses the same options (p. 91). No source
  on titles or labels.
- **From:** README 25.

### Wave C

#### 12. Editing a 구성 from a 예배 순서 item

- **Question:** When the operator edits an item's chip strip, does the change
  apply to that 구성 in every service that uses it?
- **Options:** (a) yes, because 구성 belong to the song (product log version
  61); (b) no, the item keeps its own copy once edited (version 52).
- **Proposal:** (a). It matches ProPresenter and leaves one place to fix a 구성.
- **Blocks:** P3a (the chip strip) and P2b (the 구성 row).
- **ProPresenter:** arrangements are stored in the song file, and the playlist
  stores only which arrangement each item uses (S4 p. 81).
- **From:** README 7.

#### 13. Which stage layout applies

- **Question:** Which of the three places that choose a stage layout wins?
- **Options:** (a) the current Look's 무대 화면 card sets it, the layout
  editor's 배치 select edits that card, and the 진행 도구 무대 tab or a 매크로
  overrides it until the next Look change (03 now); (b) each stage screen keeps
  its own layout outside the Looks.
- **Proposal:** (a). The `Main` board decision lets Looks also switch the stage
  layers, which is one of its listed differences from ProPresenter.
- **Blocks:** O5, O3, T1a, and T3a.
- **ProPresenter:** Looks cover only audience screens (S4 p. 37); each stage
  screen gets its layout from the Screens menu (p. 40), and a Stage Layout
  action on a slide changes it (p. 87).
- **From:** README 10.

#### 14. Startup 매크로 (Batch)

- **Question:** Does 시작할 때 실행 mean "run when the app starts"?
- **Options:** (a) after a normal launch or 새로 시작, but not after 복구 (07,
  08); (b) when the first output turns on.
- **Proposal:** (a), like ProPresenter's startup trigger.
- **Blocks:** T3a.
- **ProPresenter:** macros can run at startup and from a calendar (S5).
- **From:** README 9 (first half; entry 30 is the second).

#### 15. Slide deck items (Batch)

- **Question:** How do the boards' 축도, 헌금 기도, and 설교 items with a slides
  icon exist in version 1?
- **Options:** (a) 축도-like texts are short 라이브러리 songs, and the "slides"
  slot stays unfillable until PowerPoint import (M5); (b) a simple slide deck
  kind in version 1.
- **Proposal:** (a). No board shows how to make a deck.
- **Blocks:** P3a and P4 (slot kinds).
- **ProPresenter:** on Windows, PowerPoint files import only as images (S4 p.
  91).
- **From:** README 15.

#### 16. Editors that no board shows (Batch)

- **Question:** How are 메시지 templates, 공지 sets, 소품, 타이머, 퀵 실행
  items, stage message presets, and lyric styles created and edited, and how are
  이름표, 구성, songs, services, and 틀 renamed or deleted?
- **Options:** (a) minimal right-click menus and plus buttons where each list
  lives (spec now); (b) wait for boards.
- **Proposal:** (a), so that version 1 has every create, rename, and delete
  path. Boards can refine them in M4.
- **Blocks:** T1a, T1b, T2, T3b, T4b, P1, P2a, P2b, P4, and O2.
- **ProPresenter:** each list adds with a + button: Looks (S4 p. 37), stage
  layouts (p. 40), and 메시지 (p. 124).
- **From:** README 16.

#### 17. Toolbar search results (Batch)

- **Question:** Where do toolbar search results appear?
- **Options:** (a) a dropdown list under the field, where a song opens in the 장
  panel (진행) or the song editor (준비) without joining the 예배 순서; (b) a
  results panel.
- **Proposal:** (a).
- **Blocks:** S1b.
- **ProPresenter:** has a quick search on Ctrl F (S1, S8); no source on where
  the results show.
- **From:** README 18.

#### 18. Stage element memo (Batch)

- **Question:** What does a stage layout's 메모 element show, since songs have
  no memo per 장?
- **Options:** (a) the current 예배 순서 item's memo; (b) add a memo per 장 to
  songs.
- **Proposal:** (a). It uses data that already exists.
- **Blocks:** O5 and O3.
- **ProPresenter:** stage layouts can show the notes of the current slide (S4 p.
  41).
- **From:** README 21.

### Wave D

#### 19. Sound of new videos

- **Question:** Do newly imported videos play their sound?
- **Options:** (a) off; (b) on.
- **Proposal:** (a). Background loops often carry music that would play over the
  band, and an announcement video needs one switch (소리 켜기). The `Media`
  board shows it off.
- **Blocks:** P6a and P6b (one constant until the answer).
- **ProPresenter:** the Import tab sets the scaling and playback of new media
  but has no sound default (S4 p. 174).
- **From:** question 14.

#### 20. Copy media on import

- **Question:** Does importing media copy the file into the media folder, or
  refer to it where it is?
- **Options:** (a) a switch, on by default; (b) a switch, off by default, as in
  ProPresenter; (c) always copy.
- **Proposal:** (a). The `Media` board shows copy progress, files brought on a
  USB stick break when it's removed, and ProPresenter's guide itself says that
  copying prevents broken links. This is the one settings default that departs
  from ProPresenter.
- **Blocks:** P6a and P6b.
- **ProPresenter:** Manage Media Automatically copies media into its folder, and
  it's off by default (S4 p. 190).
- **From:** question 15, README 12.

#### 21. Opening the media view (Batch)

- **Question:** In 준비, does the 미디어 button switch to the media view?
- **Options:** (a) yes, the center of 준비 becomes the media view; (b) it opens
  a panel next to the song editor.
- **Proposal:** (a). The `Media` board shows 준비 and 미디어 both on, which
  reads as the media view of 준비.
- **Blocks:** P6b.
- **ProPresenter:** no source checked.
- **From:** README 20.

#### 22. Sound effects playlist (Batch)

- **Question:** Does the 효과음 (sound effects) playlist behave differently from
  other audio playlists?
- **Options:** (a) no; (b) its sounds play once and can overlap.
- **Proposal:** (a). No board shows a different behavior.
- **Blocks:** T2 and P6b.
- **ProPresenter:** no source checked.
- **From:** README 22.

#### 23. Bible reference frequency

- **Question:** On which 장 of a passage does the reference show?
- **Options:** each 장 shows the verses it holds (the board's 장마다); every 장
  shows the whole passage; first 장 only (02); last 장 only; none.
- **Proposal:** ProPresenter's four: the verses each 장 holds (default, as on
  the board), the whole passage on every 장, last 장 only, and none. First 장
  only is dropped because no source has it. 10 counted three ProPresenter
  options; the guide has four.
- **Blocks:** T4b (the 참조 select) and the passage schema value `reference`
  (data).
- **ProPresenter:** Verse References (one verse per slide only), Passage Each,
  Passage Last, and No Reference (S4 p. 142).
- **From:** question 17.

#### 24. Enter in the Bible field

- **Question:** Does Enter in the 퀵 실행 Bible field output the passage at
  once?
- **Options:** (a) yes, like 바로 띄우기, after the preview has built while
  typing (`TextField` README); (b) no, Enter only builds the preview, and the
  operator clicks a 장 or 바로 띄우기 (`Bible` board flow).
- **Proposal:** (a). The design system is the source of truth for UI behavior,
  and the preview shows what Enter will send. The shortcut decision doesn't
  settle it, because ProPresenter documents no behavior for Enter here.
- **Blocks:** T4b.
- **ProPresenter:** typing a reference returns the verses as slides (S4 p. 140);
  the guide doesn't say whether Enter shows them.
- **From:** README 5.

### Requests that wait for an answer

#### 25. 메시지 appearance

- **Question:** Which font, size, position, and background does a 메시지 use?
- **Options:** (a) a 메시지 style chosen per screen in the Look, like the lyric
  style; (b) a style per 메시지 template, as in ProPresenter; (c) one fixed
  style.
- **Proposal:** (a). The user's must-have is a different text layout per
  monitor; (a) gives it in one place, and the Look already decides which screens
  show 메시지.
- **Blocks:** X1a, X1b, and X1c. O6a draws a default style until then.
- **ProPresenter:** a 메시지's text fills a text box in a template chosen for
  that 메시지 (S4 p. 123), and Looks turn the 메시지 layer on or off per
  audience screen (p. 38).
- **From:** question 13.

#### 26. Outline and shadow detail

- **Question:** How much control do the lyric style's outline and shadow get?
- **Options:** (a) on and off only (the `Looks` board); (b) outline width and
  color, and shadow blur, distance, opacity, and color; (c) (b) plus a shadow
  angle, as in ProPresenter.
- **Proposal:** (b). Width and blur decide legibility over a busy video, and an
  angle adds a control that projected lyrics rarely need.
- **Blocks:** X2a, X2b, and X2c.
- **ProPresenter:** stroke width and color; shadow blur, opacity, color, angle,
  and offset (S4 pp. 63 to 65).
- **From:** question 16.

## Needed in M4

### 27. The 일반 page

- **Question:** Does the 일반 page show language and the startup workspace, and
  does it add launch with Windows?
- **Options:** (a) hide language (only 한국어 exists) and the startup workspace
  (only 진행), and add Windows 시작할 때 실행, off by default; (b) show them as
  the `Prefs` board does.
- **Proposal:** (a). A select with one option is noise, and a church computer
  that only runs the service can boot straight into the app.
- **Blocks:** the M4 settings window.
- **ProPresenter:** the language follows the operating system, with Preferred
  Language on Windows (S4 pp. 154, 170 to 171); no launch setting among the 13
  tabs (pp. 169 to 192).
- **From:** question 11.

### 28. 지금 백업 during a service (Batch)

- **Question:** Can the operator run 지금 백업 (back up now) while any output is
  on?
- **Options:** (a) no, it's unavailable, with the reason in a tooltip; (b) yes.
- **Proposal:** (a). A backup reads every file while video plays, and automatic
  backups already never run while an output is on (08).
- **Blocks:** the M4 settings window. The M2 backup module needs no change.
- **ProPresenter:** the 7.5 guide has no backup command; Sync copies files to a
  shared folder (S4 pp. 182 to 183).
- **From:** question 18.

### 29. Menus (Batch)

- **Question:** Which items do the 편집, 보기, 출력, 창, and 도움말 menus and
  the 내보내기 submenu hold?
- **Options:** (a) the minimal items in 01, with no 내보내기 in version 1; (b) a
  full menu set drawn first.
- **Proposal:** (a). No source lists more items.
- **Blocks:** shell's menu bar, at the latest in M4.
- **ProPresenter:** its menus are listed with their shortcuts in S1.
- **From:** README 17.

## Later

### 30. Scheduled 매크로 (Batch)

- **Question:** Should a 매크로 run at a set time (the clock badge "10:30"), and
  where is the time set?
- **Options:** (a) later, with the `schedule` field reserved; (b) in version 1,
  with a time field in the 매크로 menu.
- **Proposal:** (a). No board shows where to set the time.
- **Blocks:** nothing in M3; T3a keeps the field.
- **ProPresenter:** macros can run from a calendar (S5).
- **From:** README 9 (second half).

## Already decided

These questions from the same tables need no answer.

| Question                     | Decision                                                                              | Where                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| README 1, NDI in version 1   | After version 1 (M5); version 1 sends 방송 자막 through the capture window.           | `docs/HANDOFF.md` "Deferred"; `docs/MILESTONES.md` M5                                                           |
| README 2, autosave interval  | Save on every change, with no interval.                                               | Product log, design system entry of 2026-10-24 ("Saving is automatic as in ProPresenter"); 10 "Fixed behaviors" |
| README 3, 퀵 실행 shortcuts  | Later; version 1 has none, and stored commands leave room for them.                   | Product log, 진행 screen direction of 2026-10-24; 09                                                            |
| README 4, Bible in version 1 | In version 1, with 개역한글 and KJV. The data questions are entries 8 and 9.          | `docs/HANDOFF.md` "Output and external connections"; M3 lead decision 4                                         |
| README 8, start 매크로       | Stored as the 매크로 ID.                                                              | `src/shared/schema/service.ts` (data-1, merged)                                                                 |
| README 19, reports, updates  | No reports leave the computer, and there are no automatic updates.                    | `docs/TECH.md`, "Operating rules"                                                                               |
| README 12, 14, 24            | Folded into entries 20, 4, and 7.                                                     | This sheet                                                                                                      |
| Questions 1 to 9 of 10       | Shortcuts follow ProPresenter, keys match by physical key, and key names are English. | `docs/decisions.md`, 2026-10-25                                                                                 |

## Not for the user

- **Smaller proposals.** 01 to 08 mark about 350 smaller choices "(proposal)",
  such as the fade out time or the 매크로 depth limit. They apply as written,
  block no task, and can change later. None is listed here.
- **Lead decisions.** The es-hangul dependency (spec-4) needs an entry in
  `docs/decisions.md` and the lead's approval, not the user's.
