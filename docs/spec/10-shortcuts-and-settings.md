# 10. Shortcuts and settings (proposal)

This document proposes the complete shortcut system and the 환경설정
(Preferences) window of LoveLight Presenter, for the user to decide before any
design or code. "What this proposal would replace" near the end lists the rows
of 06, 02, and the README that change once it's accepted.

Decision status:

- **Shortcuts: decided** (user, 2026-10-25, `docs/decisions.md`): "단축키는
  프로프리젠터를 따르면될듯. 나중에고칠수있으니.. 당연히 영어로 단축키를
  표시해야함 키 이름은." Where ProPresenter has a default key or a behavior, the
  app follows it. Where no ProPresenter source was found, the app uses this
  proposal. Keys are matched by physical key, and key names are written in
  English. The 단축키 settings can change any key later.
- **Settings: proposal.** The settings use this proposal's defaults until the
  user decides otherwise (open questions 10 to 18). Until then, 06 stays the
  spec for settings.

The proposal comes from two directions:

- **Research.** What ProPresenter does, with EasyWorship and OBS as extra
  evidence of what operators expect. Every research row cites a source.
- **Design.** Every behavior in 01 to 09 and `docs/TECH.md`, checked one at a
  time: should an operator be able to change it, what is a safe default, what
  range, where it's stored, when a change applies, and whether it must stay
  fixed because a fixed behavior is safer during a service.

Terms: 출력 (output), 지우기 (clear), 장 (slide), 예배 순서 (service order), 틀
(template), 구성 (arrangement), 이름표 (label), 본 화면 (main screen), 무대 화면
(stage screen), 방송 자막 (broadcast captions), Look, 진행 도구 (show tools), 퀵
실행 (quick launch), 소품 (prop), 공지 (notice), 메시지 (message), 타이머
(timer), 라이브러리 (library), 매크로 (macro), 진행 (Show), 준비 (Prep), 화면
설정 (Screen settings). See 01.

## Conventions

- Every row in the settings tables is a proposal, unless its basis says "Kept".
  "Kept" means an existing decision in 01 to 09 that this proposal keeps as it
  is. Prose marks proposals with "(proposal)".
- Every row in the shortcut tables is decided (see "Decision status"). Its basis
  says where the decision comes from.
- Basis values:
  - **Decided, follows ProPresenter**: a shortcut decision where ProPresenter
    has the key or the behavior, with the source.
  - **Decided, no ProPresenter source found**: a shortcut decision where no
    ProPresenter source was found, so this proposal's choice applies.
  - **PP**: follows ProPresenter, with the source (settings).
  - **PP differs**: ProPresenter does it another way, and the reason column says
    why this app differs.
  - **EW**, **OBS**: follows EasyWorship or OBS Studio, with the source.
  - **Ours**: no reference product does it, or no source was found. The reason
    column says why.
- Version: "1" for version 1, "Later" for after version 1.
- Sources are cited by ID, for example S1. The list follows.
- Key names follow the `KeyCap` README: Ctrl, Alt, Shift, Space, Enter, Esc, F1,
  and → ← ↑ ↓. This document adds Page Up, Page Down, Home, End, and Delete, in
  English as Windows writes them (decided, open question 9).

## Sources

| ID  | Source                                                                                                                                                                                                     | What it supports                                                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Renewed Vision, "Keyboard Shortcuts in ProPresenter", https://support.renewedvision.com/hc/en-us/articles/360042123293-Keyboard-Shortcuts-in-ProPresenter                                                  | The current default shortcut table, Mac and Windows, by menu.                                                                                                                                         |
| S2  | Renewed Vision, "Custom Key Mapping", https://support.renewedvision.com/hc/en-us/articles/4412282390547-Custom-Key-Mapping                                                                                 | Key Mappings (7.7 and later): Edit > Key Mappings on Windows, double-click to record, a modifier plus a key, Customized and Conflicts filters, the default shown at the bottom.                       |
| S3  | Renewed Vision blog, "ProPresenter 7.7", https://renewedvision.com/blog/propresenter-7-7                                                                                                                   | Key Mappings cover Props, Macros, menu items, and more. Custom Clear Groups.                                                                                                                          |
| S4  | Renewed Vision, "ProPresenter 7 User Guide", updated for version 7.5, April 27, 2021, https://files.renewedvision.com/propresenter/support/Pro7UserGuide.pdf (read from the Internet Archive)              | Every Preferences tab (pages 169 to 192), clear keys (p. 25), Looks (p. 37), slide hot keys (p. 58), text properties (pp. 63 to 65), Bible options (pp. 141 to 142), MIDI (pp. 148 to 150), and more. |
| S5  | Renewed Vision blog, "How to use Macros in ProPresenter 7", https://renewedvision.com/blog/how-to-use-macros-in-propresenter-7                                                                             | Macro triggers: Show Controls, slides, startup, calendar, MIDI. Macro actions.                                                                                                                        |
| S6  | Renewed Vision, "Feature updates" (release notes), https://renewedvision.com/propresenter/download                                                                                                         | Current versions 21 and 22 (beta, October 22, 2026): Missing Font dialog, Key Mappings for settings pages, slide views, and macros, workspaces, Windowed Output (18), Auto-clear Props (17).          |
| S7  | Renewed Vision, "Using Clear Groups in ProPresenter", https://support.renewedvision.com/hc/en-us/articles/4408681880211-Using-Clear-Groups-in-ProPresenter                                                 | Clear Groups appear as icons in the clear area. No keyboard shortcut is documented.                                                                                                                   |
| S8  | Renewed Vision, "All ProPresenter features", https://renewedvision.com/propresenter/all-features                                                                                                           | Ctrl F quick search, MIDI and DMX cues, Stream Deck.                                                                                                                                                  |
| S9  | EasyWorship, "Shortcut Keys For EasyWorship 7", https://support.easyworship.com/support/solutions/articles/24000020383-shortcut-keys                                                                       | Page Down goes live, Ctrl B black, Ctrl L logo, Ctrl C toggles text, Home and End, V and C plus Enter, Ctrl Enter splits a slide, Ctrl Y redo.                                                        |
| S10 | EasyWorship blog, "Unlocking Scripture Options in EasyWorship", https://easyworship.com/blog/easyworship-scripture-options-explained                                                                       | Scripture and song text settings live under Edit > Options > Live, with Font, Outline, Shadow, Margins, and Format tabs.                                                                              |
| S11 | OBS Studio English UI strings, https://github.com/obsproject/obs-studio/blob/master/frontend/data/locale/en-US.ini                                                                                         | OBS settings names: Hide cursor over projectors, Make projectors always on top, Hotkey Focus Behavior, Show active outputs warning on exit, update channel, Monitoring Device, appearance font size.  |
| S12 | MDN, "KeyboardEvent: code property", https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code                                                                                                   | `code` names the physical key and doesn't change with the keyboard layout or modifier state.                                                                                                          |
| S13 | MDN, "Keyboard event code values", https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values                                                                                   | On Windows with the Korean layout, Chrome reports an empty `code` for the 한/영 and 한자 keys.                                                                                                        |
| S14 | Microsoft, "Korean IME", https://learn.microsoft.com/globalization/input/korean-ime                                                                                                                        | The right Ctrl key converts to 한자.                                                                                                                                                                  |
| S15 | Wikipedia, "Language input keys", https://en.wikipedia.org/wiki/Language_input_keys                                                                                                                        | Most Korean portable computers have no 한/영 or 한자 key and use the right Alt and right Ctrl keys instead.                                                                                           |
| S16 | Logitech, "HID and keyboard codes for Logitech R400, R700, and R800 presenters", https://support.logi.com/hc/en-gb/articles/360023345333-HID-and-keyboard-codes-for-Logitech-R400-R700-and-R800-presenters | Presentation remotes send Page Up and Page Down, a key that alternates F5 and Esc, and a period for a blank screen.                                                                                   |
| S17 | Electron docs, "Menu", https://github.com/electron/electron/blob/main/docs/api/menu.md                                                                                                                     | Electron creates a default menu (File, Edit, View, Window) if the app sets none. Passing `null` suppresses it.                                                                                        |
| S19 | Renewed Vision, "Creating and Using Playlist Templates in ProPresenter", https://support.renewedvision.com/hc/en-us/articles/40377194830995-Creating-and-Using-Playlist-Templates-in-ProPresenter          | Save as Playlist Template from a playlist's right-click menu; New Playlist from Template; templates hold headers and placeholders (7.10 and later).                                                   |
| S20 | Renewed Vision, "ProPresenter Asks To Save Presentations When Closing", https://support.renewedvision.com/hc/en-us/articles/1500007020902-ProPresenter-Asks-To-Save-Presentations-When-Closing             | "ProPresenter automatically saves all of your changes as you work through presentations."                                                                                                             |
| S18 | MDN, "KeyboardEvent: isComposing property", https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing                                                                                     | `isComposing` is true for key events inside an IME composition.                                                                                                                                       |

## ProPresenter research

### Versions

- After the 7.x releases, the release notes continue with versions 17 to 21 and
  a version 22 beta dated October 22, 2026 (S6). The newest complete manual is
  the 7.5 user guide (S4). The current support article lists the shortcuts
  without a version (S1). Where the two differ, this document names both.
- Newer versions call the window "Settings" (S1 "Open Settings", S6 "Screens
  Settings", "Network Settings"). The 7.5 guide calls it "Preferences" (S4 p.
  169).

### Default shortcuts

The Windows keys of every row in S1, and what this app does with each.

| ProPresenter command (S1)                                                      | Windows key                                                                             | In this app                                                                   |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Open Settings                                                                  | Ctrl ,                                                                                  | 환경설정, Ctrl , (same)                                                       |
| Quit ProPresenter                                                              | Ctrl Q                                                                                  | 종료, Ctrl Q (same, with a confirmation while an output is on)                |
| New Presentation                                                               | Ctrl N                                                                                  | 새 곡, Ctrl N (a presentation is a song here)                                 |
| Print                                                                          | Ctrl P                                                                                  | None. The app doesn't print.                                                  |
| Import > File                                                                  | Ctrl Shift I                                                                            | 텍스트 파일 가져오기, Ctrl Shift I (same)                                     |
| Undo, Redo                                                                     | Ctrl Z, Ctrl Y                                                                          | Same. Ctrl Z in 진행 undoes the last clear (03).                              |
| Cut, Copy, Paste, Delete, Select All                                           | Ctrl X, Ctrl C, Ctrl V, Delete, Ctrl A                                                  | Same (Windows text editing)                                                   |
| Copy Text Style, Paste Text Style                                              | Ctrl Alt C, Alt Shift V                                                                 | None. Lyrics are plain lines, and the lyric style holds the formatting.       |
| Paste and Match Style                                                          | Alt V                                                                                   | None. Pasting into the song editor always pastes plain text.                  |
| Duplicate                                                                      | Ctrl D                                                                                  | 복제, Ctrl D, where the selected object has 복제 (Look, stage layout, 매크로) |
| Deselect                                                                       | Ctrl Shift D                                                                            | None. Esc clears a selection.                                                 |
| Search                                                                         | Ctrl F                                                                                  | 찾기, Ctrl F, focuses the toolbar search (same)                               |
| New Slide                                                                      | Ctrl Shift N                                                                            | 새 장, Ctrl Shift N, in the song editor (same)                                |
| Next Slide, Previous Slide                                                     | →, ←                                                                                    | Same                                                                          |
| Next Background, Previous Background                                           | Alt →, Alt ←                                                                            | 다음 배경, 이전 배경 (same)                                                   |
| Clear All, Slide, Media, Props, Audio                                          | F1 to F5                                                                                | Same (Kept, 03)                                                               |
| Clear Message, Clear Announcements                                             | F6, F7                                                                                  | 메시지 지우기 F6, 공지 지우기 F7 (same, Kept)                                 |
| Show Triggered Presentation                                                    | Ctrl L                                                                                  | 출력 중인 항목 열기, Ctrl L (same idea)                                       |
| Show Triggered Announcements                                                   | Ctrl Shift L                                                                            | None. 공지 runs from the 공지 tab, not from presentations.                    |
| Reveal in Library                                                              | Ctrl Alt L                                                                              | 라이브러리에서 열기, Ctrl Alt L (same idea)                                   |
| Show Slide on Stage Display Only                                               | Ctrl 0                                                                                  | None. The app has no stage-only 장 output. Later if needed.                   |
| Toggle Output Screens On/Off                                                   | Ctrl 1                                                                                  | 청중 화면 출력, Ctrl 1 (same, Kept)                                           |
| Open the Edit Looks Screen                                                     | Ctrl Shift 1                                                                            | Look 편집, Ctrl Shift 1 (same)                                                |
| Toggle Stage Display Screens On/Off                                            | Ctrl 2                                                                                  | 무대 화면 출력, Ctrl 2 (same, Kept)                                           |
| Open Edit Layouts Screen                                                       | Ctrl 4                                                                                  | 무대 배치 편집, Ctrl 4 (same)                                                 |
| Open Configure Screens Window                                                  | Ctrl Alt 1                                                                              | 화면 설정, Ctrl Alt 1 (same idea: the 화면 설정 workspace)                    |
| Open Show Mode                                                                 | Ctrl S                                                                                  | 진행, Ctrl S (same; open question 1)                                          |
| Open Edit Mode, Open Reflow Mode                                               | Ctrl E, Ctrl R                                                                          | 준비, Ctrl E and Ctrl R (the song editor follows the Reflow editor, 05)       |
| Open Bibles Mode                                                               | Ctrl Alt B                                                                              | 성경 구절 찾기, Ctrl Alt B, focuses the Bible field in 퀵 실행                |
| Open Timers, Messages, Props                                                   | Ctrl Shift C, Ctrl M, Ctrl Shift P                                                      | The 타이머, 메시지, and 소품 tabs of 진행 도구 (same keys)                    |
| Open Stage                                                                     | Alt S                                                                                   | The 무대 tab, with focus in the stage message field (same)                    |
| Open Media Bin                                                                 | Ctrl Shift V                                                                            | 미디어 (the media strip in 진행, the media view in 준비) (same)               |
| Open Action Palette                                                            | Alt C                                                                                   | 동작 팔레트 (same)                                                            |
| Open Planning Center, ProContent, Calendar                                     | Ctrl Alt P, Ctrl Shift R, Ctrl Alt C                                                    | None. The app has no such features.                                           |
| Open Download Manager                                                          | Ctrl J                                                                                  | None.                                                                         |
| Find My Mouse                                                                  | Alt M                                                                                   | None.                                                                         |
| Editor menu: fonts, bold, italic, underline, size, spacing, alignment, arrange | Ctrl T, B, I, U, Ctrl + and -, Ctrl Shift [ and ], Ctrl Alt F and B, Ctrl Shift F and B | None. The app has no slide editor. Text formatting lives in lyric styles.     |
| Fit Slide into Edit Window                                                     | Ctrl 0                                                                                  | 화면에 맞춤, Ctrl 0, in the stage layout editor only                          |

- The 7.5 guide lists F3 as Clear Background and F6 as Clear Logo (S4 p. 25). S1
  lists F3 as Clear Media and F6 as Clear Message. This app follows S1, which
  matches the layer names in 03.
- Next and previous slide also work with Space: "either by clicking on it or by
  using the space bar or right arrow key" (S4 p. 70).
- No source documents a default key for the next or previous playlist item.

### How ProPresenter customizes shortcuts

- Key Mappings arrived in 7.7. On Windows it opens from Edit > Key Mappings. It
  lists the commands and the current key of each (S2).
- To change a key, double-click the key column of a command, press a modifier
  and a key (Command, Control, Option, Shift, in any combination), and press
  Enter to save. The default key of the selected command shows at the bottom of
  the window (S2).
- Filters: Customized shows the changed keys. Conflicts shows keys assigned to
  more than one command (S2).
- Key Mappings cover "any menu bar command", Props, Macros, "and more" (S2, S3).
  Later versions added keys for opening specific Settings pages (21.1), for the
  slide views (21.3), and fixed keys assigned to macros not being kept after a
  relaunch (22) (S6).
- Clear Groups have no documented keyboard shortcut. They show as icons in the
  clear area (S7).

### Per-item hot keys in ProPresenter

- A slide can have a hot key: "Change the Hot Key for the slide by clicking in
  the textbox and typing a letter" (S4 p. 58, Slide tab of the Inspector).
- Group labels can carry hot keys: "Group Labels can also be used to add Hot
  Keys automatically to your presentations. Hot Keys can be used to jump to a
  certain slide just by using your keyboard" (S4 p. 176, Groups tab).
- Hot keys show in the upper left corner of the slide thumbnail (S4 p. 12).
- Slide hot keys are single letters without a modifier. Key Mappings commands
  need a modifier (S2). This app uses the same split (see "Principles" under
  "Shortcut system").

### Other triggers in ProPresenter

| Trigger                | What it does                                                                                                                                                                     | Source            | In this app                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| MIDI                   | Windows offers MIDI only. A MIDI map assigns notes (0 to 127) to commands, with auto fill from a starting note. Two commands can't share a note. Slides can also send MIDI cues. | S4 pp. 148 to 150 | Later. Commands keep stable IDs so that a MIDI map can point to them (see "Later commands"). |
| MIDI to macros         | One MIDI note selects a macro by its intensity.                                                                                                                                  | S5                | Later, same hook.                                                                            |
| Stream Deck            | Triggers previous or next slides, messages, macros, and more.                                                                                                                    | S8                | Later, same hook.                                                                            |
| Remote apps, Stage app | Network tab: Enable Network, ProPresenter Remote (Controller and Observer, each with a password), Stage Display app.                                                             | S4 p. 181         | Later (the 연결 page).                                                                       |
| TCP/IP                 | Enabled from Network Settings (version 17).                                                                                                                                      | S6                | Later.                                                                                       |
| Startup and calendar   | A macro can run when ProPresenter starts, or from a calendar event.                                                                                                              | S5                | Startup 매크로 is in 07. Scheduling waits (07, 09).                                          |

### Preferences pages in ProPresenter

The 7.5 guide lists 13 tabs (S4 pp. 169 to 192). Preferences open with Ctrl ,,
and since 7.3 the menu can open a specific tab (S4 p. 169).

| Tab      | Settings (S4)                                                                                                                                                                                                                                              | In this app                                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| General  | Show House of Worship Integrations, Share Crash Reports, Share ProPresenter Analytics, Logo (adds Clear to Logo), Copyright display and license number, Render Mode (Mac, Metal), Preferred Language (Windows, needs a restart) (pp. 170 to 171, 152, 154) | Reports, analytics, logo, copyright, and House of Worship are rejected. Language waits. Render mode maps to 하드웨어 가속. |
| Screens  | Automatically Enable Screens at Launch, Show Performance Statistics on Screen, Ignore Background Colors, Show Keynote and PowerPoint screens (Mac), Open Screen Configuration (pp. 172 to 173)                                                             | 켤 때 화면 출력 (Kept). The rest are rejected. Screen configuration is the 화면 설정 workspace.                            |
| Import   | Default scaling (foreground and background), image action duration and next behavior, video playback behavior (loop or stop) with end and next behavior, audio playback behavior (stop, loop, next) (p. 174)                                               | 미디어 page: new media defaults (end, fit, sound).                                                                         |
| Groups   | Group labels and slide labels, add with plus, delete, color, group labels add hot keys (p. 176)                                                                                                                                                            | The 이름표 list with colors and jump keys (05). The 단축키 page also lists the jump keys.                                  |
| Input    | Video inputs (USB, Thunderbolt, SDI, NDI, Syphon) with device, mode, thumbnail, linked audio; audio inputs with mode (Off, On, Auto Off, Auto On), source, delay, volume, routing, transition duration (pp. 177 to 180)                                    | Later (camera input, 09).                                                                                                  |
| Network  | Enable Network, network name and port, ProPresenter Remote, Stage Display app (p. 181)                                                                                                                                                                     | Later (연결 page).                                                                                                         |
| Sync     | Repository folder, what to sync, sync up or down, replace my files (pp. 182 to 183)                                                                                                                                                                        | Rejected. One computer; automatic backup covers copies.                                                                    |
| Resi     | Streaming service account (p. 184)                                                                                                                                                                                                                         | Rejected. OBS streams.                                                                                                     |
| Services | Planning Center login and options, SongSelect login (pp. 185 to 186)                                                                                                                                                                                       | Rejected. No outside services.                                                                                             |
| Audio    | Channel count, Inspector output device with routing and volume, Main output device with volume, delay up to 1500 ms, and routing, SDI and NDI audio output (pp. 187 to 188)                                                                                | 미디어 page: output device and preview device. Channels, routing, delay, and master volume are rejected.                   |
| Advanced | Alt-click to suppress auto start video, foreground media behavior toward the audio layer (5 options), Support Files folder, Manage Media Automatically (copy into the media folder, off by default), Search Paths to relink missing media (pp. 189 to 190) | 라이브러리 page: data folder. 미디어 page: copy on import. Foreground media behavior and search paths wait.                |
| Devices  | Communication devices; Windows offers MIDI (p. 191)                                                                                                                                                                                                        | Later (연결 page).                                                                                                         |
| Updates  | Check Now, release notes, installed version and build, notification at launch when an update exists, Release or Beta channel (p. 192)                                                                                                                      | 정보 page shows the version. The updater waits (`docs/TECH.md`).                                                           |

Notes from the current versions (S6):

- Slide labels are edited in Settings (21.3 fix: "slide labels edited in
  Settings").
- Screens Settings still has "Show Keynote Screens" (21.4 fix).
- The Key Mappings window has entries for opening specific Settings pages (21.1
  fix).
- The release notes mention ProPresenter workspaces ("switching workspaces",
  21.2 to 22 fixes). They don't describe them, so this proposal doesn't compare
  them with this app's 진행, 준비, and 화면 설정 workspaces.

### Fonts and typography in ProPresenter

- None of the 13 Preferences tabs has a font setting (S4 pp. 169 to 192). No
  source mentions a default font, a fallback font, or a UI font setting.
- Fonts live on text objects. Slides, themes, props, and stage layouts each have
  an editor built like the slide editor (S4 pp. 17, 48). The text tab has font,
  font style, size, bold, italic, underline, strikethrough, underline color,
  text background, baseline, line height, line spacing, paragraph spacing,
  margins, capitalization (none, all caps, title case, start case), color or
  gradient, text scaling (fit container to text, scale up, scale down, scale up
  or down), horizontal and vertical alignment, stroke (width, color), and shadow
  (blur, opacity, color, angle, offset) (S4 pp. 63 to 65).
- Copy Style and Paste Style move formatting between slides, and "Apply Text
  Style to All Slides" applies it to the whole presentation (S4 p. 63).
- Themes hold the styles that slides and Bible verses use (S4 p. 76; the Bible
  options select a theme, p. 142).
- Current versions have a Missing Font dialog (S6: 21.1 "the same font family
  could appear multiple times in the Missing Font dialogue", 21.2 "fonts
  included in a PowerPoint were not showing up in the Missing Font dialog").
- The 7.5 Bible options include "Preserve Font Color" for red-letter Bibles (S4
  p. 142).

### EasyWorship and OBS

| Product     | Setting or key                                                                               | Source | Used in this proposal as                                       |
| ----------- | -------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| EasyWorship | Page Down goes live                                                                          | S9     | Evidence that operators expect Page Down to advance            |
| EasyWorship | Ctrl B black screen, Ctrl L logo, Ctrl C toggles live text                                   | S9     | Later 퀵 실행 keys (open question 3 in the README)             |
| EasyWorship | Home and End select the first and last slide; Up and Down move between slides                | S9     | 첫 장 and 마지막 장 commands (no default key here)             |
| EasyWorship | V plus Enter, C plus Enter, number plus Enter jump to a verse, chorus, or slide number       | S9     | Rejected (conflicts with jump keys)                            |
| EasyWorship | Ctrl Enter creates a new slide or splits a slide into two                                    | S9     | 장 나누기, Ctrl Enter                                          |
| EasyWorship | Song and scripture text: Font, Outline, Shadow, Margins, Format, under Edit > Options > Live | S10    | Fonts belong to text styles, not to a general preferences page |
| OBS         | Hide cursor over projectors; Make projectors always on top                                   | S11    | Fixed: hidden cursor. Per screen: 항상 위                      |
| OBS         | Hotkey Focus Behavior: never disable, disable when the main window is or isn't in focus      | S11    | Version 1 shortcuts work only while the main window has focus  |
| OBS         | Show active outputs warning on exit                                                          | S11    | Fixed: quitting while an output is on asks first               |
| OBS         | Automatically check for updates on startup; update channel                                   | S11    | Later, with "never during a service"                           |
| OBS         | Advanced > Audio > Monitoring Device                                                         | S11    | 미리 듣기 장치 (preview device)                                |
| OBS         | Appearance: theme, style, font size, density                                                 | S11    | Rejected: one dark theme, fixed sizes (design system)          |

## Shortcut system

This section is decided (see "Decision status"). "(decided)" marks a choice that
has no ProPresenter source, so this proposal's choice applies.

### Principles

- **One command registry.** Every action that the operator can take from the
  keyboard, a menu, a toolbar, or a 매크로 has one command ID, a Korean name, a
  group, its default keys, and where it works. Shortcuts, menu shortcut text,
  tooltips ("가사 지우기 F2"), and later MIDI and Stream Deck read the same
  registry. A changed key shows at once in every menu and tooltip (decided).
- **Same path as clicks.** A shortcut sends the same command to the main process
  as the button it stands for (01). The result is the same wherever the command
  comes from.
- **Bare letters and digits belong to 이름표 jump keys.** Commands use a
  modifier (Ctrl, Alt, Shift) or a non-character key (F1 to F12, arrows, Space,
  Page Up, Page Down, Home, End, Delete). This follows ProPresenter, where slide
  hot keys are single letters and Key Mappings need a modifier (S2, S4 p. 58).
  It also means jump keys and commands can never collide, and typing in the
  wrong place never outputs anything by a letter.
- **Live keys stay where ProPresenter has them.** F1 to F7, →, ←, Space, Ctrl 1,
  and Ctrl 2 keep the ProPresenter keys (S1). Operators who move between the two
  apps keep their habits.
- **Defaults only where a key earns it.** A command gets a default key when it's
  used during a service or very often, and the key is safe to press by mistake.
  Every other command exists in the list with no default, so the operator can
  assign one.
- **Ignore key repeat for live commands.** Holding → must not run through the
  song. Live commands run once per press and ignore repeated `keydown` events
  (`event.repeat`) (decided). Editing keys, such as arrows in a text field, keep
  their repeat.

### Matching keys with the Korean IME on

- Match shortcuts by physical key: `KeyboardEvent.code` plus the Ctrl, Alt, and
  Shift flags. `code` names the physical key and doesn't change with the layout
  or modifiers (S12). With the Korean IME on, the C key still reports `KeyC`, so
  a jump key set to C works whether the IME is in Korean or English mode.
- Never match on `KeyboardEvent.key`. It holds the character, which depends on
  the layout and the IME state (S12).
- When `isComposing` is true, the key belongs to an IME composition (S18). Pass
  it to the text field, except F1 to F7, which still clear (03). The composition
  commits as usual.
- Show keys by their Windows names, made from `code` with one fixed table:
  `KeyC` shows as C, `Digit1` as 1, `ArrowRight` as →, `PageDown` as Page Down.
  The key field and the 단축키 page never show a Hangul letter such as ㅊ for
  the C key.
- The 한/영 and 한자 keys can't be assigned. On Windows with the Korean layout,
  Chrome reports an empty `code` for them (S13). The key field doesn't record a
  key with an empty `code` (see "Reserved keys").
- On many Korean keyboards the right Alt key works as 한/영 and the right Ctrl
  key as 한자 (S14, S15). They then don't count as Alt or Ctrl. Every default in
  this proposal works with the left Alt and Ctrl keys (decided).
- Numpad digits count as the same digit as the top row while Num Lock is on, so
  a jump key set to 1 also works from the numpad (decided).

### Where shortcuts work

#### Focus precedence

A key press goes to the first rule below that claims it. Later rules see only
the keys that earlier rules pass on.

1. **The key field on the 단축키 page, while it records**, takes every key, F1
   to F7 included, because the operator opened it on purpose. It closes after
   one combination.
2. **지우기 F1 to F7** clear in every other case: with a text field, a menu, or
   a dialog in focus, and during a drag (03).
3. **A text field**, including an IME composition, takes every key except F1 to
   F7 and the commands with Ctrl or Alt that aren't text editing keys.
4. **An open menu, a dialog, or a drag** takes its own keys (arrows, Enter, Esc,
   Space). Only F1 to F7 and 되돌림 (Ctrl Z) pass through.
5. **In 진행, the 장 grid and the 예배 순서 list** take ↑, ↓, and Enter (the
   list also Home and End), and pass ←, →, Space, Page Up, and Page Down to 다음
   장 and 이전 장. This is ProPresenter's behavior: after the operator clicks a
   slide, Space and → fire the next one (S4 p. 70). Decided, follows
   ProPresenter.
6. **Any other control with keyboard focus** takes the keys its design system
   README gives it, for example a 매크로 tile (arrows move, Enter and Space run,
   07), a button (Enter and Space press), a switch, a segmented control, a
   slider, or a tab row. Keys the control doesn't use pass on, so F-keys, Page
   Up, Page Down, jump keys, and modifier commands still work.
7. **Everything else** goes to the global commands in "Command list".

So that rule 6 never catches a key by surprise, **a mouse click in 진행 doesn't
move keyboard focus** to the clicked button or tile (decided). Only text fields,
the 장 grid, and the 예배 순서 list take focus on a click. A control gets
keyboard focus only through Tab, where the operator expects Space to press it.
Without this rule, an operator who clicks the 찬양 매크로 and then presses Space
to go to the next 장 would run the 매크로 again. The focus ring already shows
only on keyboard focus (design system README, `:focus-visible`).

Rules this precedence replaces or narrows:

| Existing rule                                                                              | Change                                                                                                 |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `SlideThumbnail` README: arrows move between thumbnails, Enter and Space act as a click    | In 진행, ← → and Space go to 다음 장 and 이전 장; the grid keeps ↑ ↓ and Enter. 준비 keeps the README. |
| 04 "Keyboard": arrow keys move the selected tile; Enter and Space output the selected tile | Same change as above.                                                                                  |
| 07 "Keyboard": arrows move between 매크로 tiles, Enter or Space runs the 매크로            | Kept, but it applies only when a tile has keyboard focus, which a mouse click no longer gives.         |
| Component READMEs for buttons, switches, segmented controls, sliders, and tab rows         | Kept for keyboard focus. A mouse click in 진행 doesn't give them focus.                                |

#### Summary by focus

| Where the focus is                                 | 지우기 F1 to F7 | 되돌림 (clear undo)                                                      | Other live commands                                                                      | Workspace, tab, and window commands | Editing commands                  |
| -------------------------------------------------- | --------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------- |
| 진행, no text field                                | Yes             | Yes (Ctrl Z)                                                             | Yes                                                                                      | Yes                                 | Not applicable                    |
| 진행, the 장 grid or the 예배 순서 list            | Yes             | Yes                                                                      | Yes. The grid keeps ↑, ↓, and Enter; the list keeps ↑, ↓, Home, End, and Enter (rule 5). | Yes                                 | Not applicable                    |
| 진행, another control with keyboard focus          | Yes             | Yes                                                                      | Only keys the control doesn't use (rule 6)                                               | Yes                                 | Not applicable                    |
| 준비, no text field                                | Yes             | No. Ctrl Z is the edit undo in 준비; the 되돌림 button still works (03). | Only commands with a modifier (Ctrl 1, Ctrl 2, Look keys, item keys)                     | Yes                                 | Yes, in their context             |
| 화면 설정, no text field                           | Yes             | Yes (Ctrl Z)                                                             | Only commands with a modifier                                                            | Yes                                 | Yes, in their context             |
| Any text field                                     | Yes             | No (text undo)                                                           | Only commands with Ctrl or Alt that aren't text editing keys                             | Yes (Ctrl and Alt commands)         | Text editing keys go to the field |
| An open menu                                       | Yes             | Yes                                                                      | No                                                                                       | No                                  | No                                |
| A dialog or confirmation dialog                    | Yes             | Yes                                                                      | No                                                                                       | No                                  | No                                |
| During a drag                                      | Yes             | Yes                                                                      | No (Esc cancels the drag)                                                                | No                                  | No                                |
| The 환경설정 window                                | Yes             | No                                                                       | No                                                                                       | Esc or Ctrl W closes the window     | Not applicable                    |
| The key field on the 단축키 page, while it records | Recorded        | Recorded                                                                 | Recorded                                                                                 | Recorded                            | Recorded                          |
| An output window (it shouldn't get focus)          | Yes             | Yes                                                                      | Same as the main window                                                                  | No                                  | No                                |
| Another app has focus                              | No              | No                                                                       | No                                                                                       | No                                  | No                                |

- Bare live keys (→, ←, Space, Page Up, Page Down, jump keys) work only in 진행.
  준비 uses those keys for editing and never affects the output (05).
- Text editing keys are Ctrl X, C, V, A, Z, Y, Ctrl Shift V, Ctrl Shift Z,
  arrows with Shift or Ctrl, Home, End, Backspace, and Delete. Inside a text
  field they always edit text.
- Output windows never take focus (03). If one gets focus anyway, for example a
  window-method output that the operator clicked, it forwards key presses to the
  main window's handler, so clears and live keys still work (decided).
- Version 1 has no global shortcuts. Keys work only while the app has focus. OBS
  often runs on the same computer, and system-wide keys would take keys from it.
  OBS itself offers this choice as Hotkey Focus Behavior (S11). Global keys can
  come later as an option on the 연결 page.

### Reserved keys

While the key field records, it checks a key press in this order:

1. Esc cancels the recording, and the shortcut stays as it was.
2. Backspace alone removes the shortcut (`TextField` README).
3. Tab and Shift Tab end the recording and move keyboard focus, so the field
   never traps the keyboard.
4. Any other reserved key below isn't recorded. The field keeps recording, shows
   the error ring, and gives the reason in a tooltip (decided).
5. Any other combination becomes the shortcut.

The tooltip is one short phrase in the form "(용도)에 쓰는 키" (the key for a
purpose), like the conflict tooltip "(명령)과 겹침" of the `KeyCap` README
(approved by the lead, 2026-10-25).

| Keys                                                                               | Reason                                                        | Tooltip                    |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------- |
| Tab, Shift Tab                                                                     | Keyboard focus moves                                          | None (step 3)              |
| Esc                                                                                | Cancels (dialogs, menus, drags, the key field itself)         | None (step 1)              |
| Enter alone                                                                        | Primary button in dialogs, activation in lists                | 확인과 실행에 쓰는 키      |
| Backspace alone                                                                    | Removes the shortcut in the key field (`TextField` README)    | None (step 2)              |
| Alt alone, F10 alone                                                               | Focus the menu bar (`MenuBar` README)                         | 메뉴 막대에 쓰는 키        |
| Shift F10, the Menu key                                                            | Open the right-click menu (`Menu` README, 07)                 | 오른쪽 클릭 메뉴에 쓰는 키 |
| Ctrl X, C, V, A                                                                    | Text editing                                                  | 글자 편집에 쓰는 키        |
| Alt F4, Alt Tab, Ctrl Esc, Ctrl Alt Delete, Windows key combinations, Print Screen | Windows owns them                                             | Windows가 쓰는 키          |
| 한/영, 한자, and any key with an empty `code`                                      | Input method keys (S13)                                       | 입력기에 쓰는 키           |
| Bare letters and digits                                                            | 이름표 jump keys (set in the 이름표 list or the 이름표 group) | 이름표 바로 가기에 쓰는 키 |

### Conflicts

- Two commands with the same combination, or a command and an 이름표 jump key
  with the same key, are a conflict. Both rows show the amber outline and the
  warning icon, with "(명령)과 겹침" in the tooltip (Kept, 06 and the `KeyCap`
  README).
- While a conflict exists, the binding that existed first keeps the key. The
  newer one doesn't run until the operator resolves it (Kept, 06).
- When the operator deletes a Look, 소품, 매크로, or 타이머, its per-object
  command and binding go with it. IDs are never reused (02), so a stale binding
  can't point at a new object.
- Presentation remotes send Page Up, Page Down, a key that alternates F5 and
  Esc, and a period (S16). With these defaults, the remote's arrows go to the
  previous and next 장. Its F5 button clears audio, as F5 does in ProPresenter
  (S1). See open question 7.

### The 단축키 page

The page in 06 stays. This proposal changes these points:

- The table lists every command in "Command list" below, grouped as there, with
  a group for 이름표 jump keys. Editing a jump key here edits the 이름표 list
  (05), like ProPresenter's Groups tab, which keeps hot keys with the labels (S4
  p. 176).
- 모두 기본값으로 (reset all) asks in a confirmation dialog, because it can't be
  undone: "단축키를 모두 기본값으로 되돌릴까요?" with 취소 and 되돌리기
  (decided; design system principle 6).
- The bottom bar shows the default key of the selected command, as
  ProPresenter's Key Mappings window does (S2). This is already in 06.
- Per-object commands (each Look, 소품, 매크로, 타이머) appear under their group
  with the object's name, and disappear when the object is deleted.
- No import or export of shortcuts in version 1. The automatic backup copies
  `shortcuts.json` with the other settings (02).

### Storage

- `shortcuts.json` stores only the commands whose keys differ from the defaults
  (Kept, 02). This proposal changes the stored key form from display names to
  physical keys, so that a stored key never depends on the layout:

  ```json
  {
    "format": "llsettings.shortcuts",
    "schemaVersion": 1,
    "bindings": {
      "output.audience": [{"code": "Digit1", "mods": ["ctrl"]}],
      "look.5d2f...": [{"code": "Digit2", "mods": ["alt"]}],
      "show.next": []
    }
  }
  ```

  - `mods` holds `"ctrl"`, `"alt"`, and `"shift"`, in that order.
  - An empty array means "no key" (Kept, 02).
  - Keep bindings for command IDs this version doesn't know, so a newer
    version's keys survive (unknown fields, 02).

- `labels.json` stores a jump key as a `code` string, for example `"KeyC"` or
  `"Digit1"`, instead of a character (decided).
- Validate both files with a schema when reading. A binding that fails
  validation is dropped and logged, and the command falls back to its default
  (`docs/TECH.md`).

### Command list

Columns: the name as the 단축키 page shows it, the command ID, the default key,
the ProPresenter key (S1 unless noted), the basis and reason, where it works,
and the version. "진행" in the "Works in" column means only in the 진행
workspace. "All" means every workspace of the main window, within the rules of
"Where shortcuts work".

#### 장 (slide navigation)

| Command   | ID              | Default             | ProPresenter        | Basis and reason                                                                                                                                                                          | Works in | Ver. |
| --------- | --------------- | ------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- |
| 다음 장   | `show.next`     | →, Space, Page Down | →, Space (S4 p. 70) | Decided, follows ProPresenter for → and Space (S4 p. 70; Kept, 06). Page Down: no ProPresenter source found; presentation remotes send it (S16), and EasyWorship uses it to go live (S9). | 진행     | 1    |
| 이전 장   | `show.previous` | ←, Page Up          | ←                   | Decided, follows ProPresenter for ← (Kept, 06). Page Up: no ProPresenter source found; remotes send it (S16).                                                                             | 진행     | 1    |
| 첫 장     | `show.first`    | None                | None found          | Decided, no ProPresenter source found. EasyWorship uses Home (S9), but Home and End go to the first and last row of a focused list (`ListRow` README), so no default keeps the two apart. | 진행     | 1    |
| 마지막 장 | `show.last`     | None                | None found          | Decided, no ProPresenter source found, as above (EasyWorship End, S9).                                                                                                                    | 진행     | 1    |

- When the item open in the 장 panel isn't the current item, 다음 장 outputs the
  first tile of the item in the 장 panel (decided, no ProPresenter source found;
  refines 04). This makes "pick the next item, then press →" work. Otherwise
  04's rules stay.

#### 예배 순서 (service order navigation)

| Command             | ID                      | Default    | ProPresenter                        | Basis and reason                                                                                                                                                                                    | Works in | Ver. |
| ------------------- | ----------------------- | ---------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- |
| 다음 항목           | `service.nextItem`      | Ctrl ↓     | None found                          | Decided, no ProPresenter source found (open question 5). Selects the next item that can output (skips headers and slots) and opens it in the 장 panel. It doesn't output, like clicking a row (04). | 진행     | 1    |
| 이전 항목           | `service.previousItem`  | Ctrl ↑     | None found                          | Decided, no ProPresenter source found, as above.                                                                                                                                                    | 진행     | 1    |
| 출력 중인 항목 열기 | `service.revealLive`    | Ctrl L     | Show Triggered Presentation, Ctrl L | Decided, follows ProPresenter. Opens the item of the live 장 in the 장 panel after the operator looked at another item (S4 p. 15).                                                                  | 진행     | 1    |
| 라이브러리에서 열기 | `service.revealLibrary` | Ctrl Alt L | Reveal in Library, Ctrl Alt L       | Decided, follows ProPresenter. Opens the selected song item's 라이브러리 song in the 준비 song editor.                                                                                              | All      | 1    |
| 예배 순서 바꾸기    | `service.switcher`      | None       | None                                | Decided, no ProPresenter source found. Opens the service list (04). Rarely needed during a service.                                                                                                 | All      | 1    |
| 항목 추가           | `service.quickAdd`      | None       | None                                | Decided, no ProPresenter source found. Opens the quick add popover (05).                                                                                                                            | All      | 1    |

#### 이름표 jump keys

| Command                          | ID                             | Default          | ProPresenter                                           | Basis and reason                                                                                                                                                                                                                                                                                               | Works in | Ver. |
| -------------------------------- | ------------------------------ | ---------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- |
| One per 이름표, for example 후렴 | Stored in `labels.json` `.key` | Empty (Kept, 02) | Group label hot keys, a single letter (S4 pp. 58, 176) | Decided, follows ProPresenter: one bare letter or digit per group label (S4 pp. 58, 176). No source gives default keys for ProPresenter's group labels, so they start empty (open question 4). Pressing it outputs the first tile with that 이름표 after the live 장, or the first in the sequence (Kept, 04). | 진행     | 1    |

#### 지우기 (clear)

| Command            | ID                  | Default | ProPresenter                         | Basis and reason                                                                                                                        | Works in                                     | Ver. |
| ------------------ | ------------------- | ------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---- |
| 모두 지우기        | `clear.all`         | F1      | Clear All, F1                        | Decided, follows ProPresenter (Kept, 03)                                                                                                | All, and the 환경설정 window                 | 1    |
| 가사 지우기        | `clear.slide`       | F2      | Clear Slide, F2                      | Decided, follows ProPresenter (Kept)                                                                                                    | Same                                         | 1    |
| 미디어 지우기      | `clear.media`       | F3      | Clear Media, F3                      | Decided, follows ProPresenter (Kept). The 7.5 guide calls it Clear Background (S4 p. 25).                                               | Same                                         | 1    |
| 소품 지우기        | `clear.prop`        | F4      | Clear Props, F4                      | Decided, follows ProPresenter (Kept)                                                                                                    | Same                                         | 1    |
| 오디오 지우기      | `clear.audio`       | F5      | Clear Audio, F5                      | Decided, follows ProPresenter (Kept)                                                                                                    | Same                                         | 1    |
| 메시지 지우기      | `clear.message`     | F6      | Clear Message, F6                    | Decided, follows ProPresenter (Kept). The 7.5 guide had Clear Logo on F6 (S4 p. 25).                                                    | Same                                         | 1    |
| 공지 지우기        | `clear.notice`      | F7      | Clear Announcements, F7              | Decided, follows ProPresenter (Kept)                                                                                                    | Same                                         | 1    |
| 되돌림             | `clear.undo`        | Ctrl Z  | Undo, Ctrl Z                         | Decided, follows ProPresenter (Undo, Ctrl Z, S1; Kept, 03). Undoes the last clear. In text fields and in 준비, Ctrl Z is the edit undo. | 진행, 화면 설정, dialogs; not in text fields | 1    |
| 무대 메시지 내리기 | `stage.hideMessage` | None    | Stage message Hide button (S4 p. 42) | Decided, no ProPresenter source found (S4 p. 42 shows only a Hide button). Takes the stage message down (04).                           | All                                          | 1    |

- F2 never renames anything, although F2 renames in Windows Explorer. F2 clears
  lyrics here, as in ProPresenter (S1). Renaming uses the right-click menu or a
  double-click (decided).

#### 화면 (screen outputs)

| Command                            | ID                           | Default | ProPresenter                                | Basis and reason                                                                                                         | Works in | Ver. |
| ---------------------------------- | ---------------------------- | ------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------- | ---- |
| 청중 화면 출력                     | `output.audience`            | Ctrl 1  | Toggle Output Screens On/Off, Ctrl 1        | Decided, follows ProPresenter (Kept, 03 and 06). Turns the 본 화면 and 방송 자막 outputs on or off together (S4 p. 172). | All      | 1    |
| 무대 화면 출력                     | `output.stage`               | Ctrl 2  | Toggle Stage Display Screens On/Off, Ctrl 2 | Decided, follows ProPresenter (Kept)                                                                                     | All      | 1    |
| (screen name) 출력, one per screen | `output.screen.<screen ID>`  | None    | None                                        | Decided, no ProPresenter source found. The toolbar has one button per screen. Turns one screen's output on or off.       | All      | 1    |
| 모니터 다시 찾기                   | `screens.redetect`           | None    | None                                        | Decided, no ProPresenter source found. The same action as the notification button (08).                                  | All      | 1    |
| 크게 보기, one per screen          | `preview.focus.<screen ID>`  | None    | None                                        | Decided, no ProPresenter source found. Makes that screen the large preview (04).                                         | 진행     | 1    |
| 창 보기 (show the fallback window) | `screens.showFallbackWindow` | None    | None                                        | Decided, no ProPresenter source found. The same action as the notification button (03, 08).                              | All      | 1    |

#### Look

| Command                   | ID               | Default | ProPresenter              | Basis and reason                                                                                                                   | Works in | Ver. |
| ------------------------- | ---------------- | ------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- |
| (Look name), one per Look | `look.<Look ID>` | None    | None documented for Looks | Decided, no ProPresenter source found (Kept, 06). The board's examples (평상시 Ctrl 1, 설교 Alt 2) are the operator's own changes. | All      | 1    |
| Look 메뉴                 | `look.menu`      | None    | None                      | Decided, no ProPresenter source found. Opens the toolbar Look menu.                                                                | All      | 1    |

#### 진행 도구 and live content

| Command                                           | ID                             | Default                                       | ProPresenter                                 | Basis and reason                                                                                                                                                                                           | Works in | Ver.  |
| ------------------------------------------------- | ------------------------------ | --------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----- |
| 다음 배경                                         | `media.nextBackground`         | Alt →                                         | Next Background, Alt →                       | Decided, follows ProPresenter. Outputs the media after the current background in the media strip's playlist.                                                                                               | 진행     | 1     |
| 이전 배경                                         | `media.previousBackground`     | Alt ←                                         | Previous Background, Alt ←                   | Decided, follows ProPresenter, as above.                                                                                                                                                                   | 진행     | 1     |
| 표시 중 탭                                        | `tools.showing`                | None                                          | None                                         | Decided, no ProPresenter source found. No ProPresenter tab matches.                                                                                                                                        | 진행     | 1     |
| 오디오 탭                                         | `tools.audio`                  | None                                          | None in S1                                   | Decided, no ProPresenter source found.                                                                                                                                                                     | 진행     | 1     |
| 무대 탭                                           | `tools.stage`                  | Alt S                                         | Open Stage, Alt S                            | Decided, follows ProPresenter. Opens the tab and focuses the stage message field (S4 p. 42).                                                                                                               | 진행     | 1     |
| 타이머 탭                                         | `tools.timers`                 | Ctrl Shift C                                  | Open Timers, Ctrl Shift C                    | Decided, follows ProPresenter                                                                                                                                                                              | 진행     | 1     |
| 메시지 탭                                         | `tools.messages`               | Ctrl M                                        | Open Messages, Ctrl M                        | Decided, follows ProPresenter                                                                                                                                                                              | 진행     | 1     |
| 공지 탭                                           | `tools.notices`                | None                                          | None                                         | Decided, no ProPresenter source found.                                                                                                                                                                     | 진행     | 1     |
| 소품 탭                                           | `tools.props`                  | Ctrl Shift P                                  | Open Props, Ctrl Shift P                     | Decided, follows ProPresenter                                                                                                                                                                              | 진행     | 1     |
| 매크로 탭                                         | `tools.macros`                 | None                                          | None                                         | Decided, no ProPresenter source found.                                                                                                                                                                     | 진행     | 1     |
| 동작 팔레트                                       | `tools.actionPalette`          | Alt C                                         | Open Action Palette, Alt C                   | Decided, follows ProPresenter                                                                                                                                                                              | 진행     | 1     |
| 성경 구절 찾기                                    | `bible.focus`                  | Ctrl Alt B                                    | Open Bibles Mode, Ctrl Alt B                 | Decided, follows ProPresenter. Focuses the Bible field in 퀵 실행 (04).                                                                                                                                    | 진행     | 1     |
| 오디오 재생 또는 일시 정지                        | `audio.playPause`              | None                                          | None in S1                                   | Decided, no ProPresenter source found. Space is taken by 다음 장.                                                                                                                                          | All      | 1     |
| 다음 곡, 이전 곡 (audio track)                    | `audio.next`, `audio.previous` | None                                          | None                                         | Decided, no ProPresenter source found.                                                                                                                                                                     | All      | 1     |
| 오디오 페이드 아웃                                | `audio.fadeOut`                | None                                          | None                                         | Decided, no ProPresenter source found. Same as the 페이드 아웃 button (04).                                                                                                                                | All      | 1     |
| 공지 일시 정지 또는 재생                          | `notice.pauseResume`           | None                                          | None                                         | Decided, no ProPresenter source found (04).                                                                                                                                                                | All      | 1     |
| 무대 메시지 보내기                                | `stage.sendMessage`            | Enter in the stage message field              | Stage message Show button (S4 p. 42), no key | Decided, no ProPresenter source found. Same as 보내기 in the 무대 tab (04). Enter is local to the field (04). The command itself has no default, because a global key would send whatever the field holds. | 진행     | 1     |
| 메시지 보내기                                     | `message.send`                 | Enter in the last blank field of the template | None                                         | Decided, no ProPresenter source found. Same as 보내기 in the 메시지 tab (04), and only while 보내기 is available. Enter is local to the field, like the stage message.                                     | 진행     | 1     |
| 오디오 반복                                       | `audio.toggleRepeat`           | None                                          | None                                         | Decided, no ProPresenter source found. The 반복 toggle of the 오디오 tab (04).                                                                                                                             | All      | 1     |
| 새 매크로                                         | `macro.new`                    | None                                          | None                                         | Decided, no ProPresenter source found. The 새 매크로 tile (07).                                                                                                                                            | 진행     | 1     |
| (소품 name), one per 소품                         | `prop.<소품 ID>`               | None                                          | Key Mappings for Props (S3)                  | Decided, follows ProPresenter. Key Mappings cover Props (S3). Turns the 소품 on or off (04). No default key (open question 6).                                                                             | All      | 1     |
| (매크로 name), one per 매크로                     | `macro.<매크로 ID>`            | None                                          | Key Mappings for Macros (S3, S6)             | Decided, follows ProPresenter. Key Mappings cover Macros (S3). Runs the 매크로 (07). No default key (open question 6).                                                                                     | All      | 1     |
| (타이머 name) 시작 또는 일시 정지, one per 타이머 | `timer.<타이머 ID>.toggle`     | None                                          | None documented                              | Decided, no ProPresenter source found (04). No default key (open question 6).                                                                                                                              | All      | 1     |
| (타이머 name) 처음으로                            | `timer.<타이머 ID>.reset`      | None                                          | None documented                              | Decided, no ProPresenter source found (04).                                                                                                                                                                | All      | 1     |
| (퀵 실행 item), one per item                      | `quick.<item ID>`              | None                                          | None                                         | The user deferred 퀵 실행 keys (09). The ID pattern is reserved.                                                                                                                                           | All      | Later |

#### 작업 공간 (workspaces)

| Command        | ID                  | Default        | ProPresenter                                     | Basis and reason                                                                                                                                                              | Works in | Ver. |
| -------------- | ------------------- | -------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- |
| 진행           | `workspace.show`    | Ctrl S         | Open Show Mode, Ctrl S                           | Decided, follows ProPresenter. The app has no save command (01), so Ctrl S is free. Open question 1.                                                                          | All      | 1    |
| 준비           | `workspace.prep`    | Ctrl E, Ctrl R | Open Edit Mode, Ctrl E; Open Reflow Mode, Ctrl R | Decided, follows ProPresenter. 준비 holds the song editor modeled on the Reflow editor (05). Electron's default reload key is gone (see "Fixed behaviors").                   | All      | 1    |
| 화면 설정      | `workspace.screens` | Ctrl Alt 1     | Open Configure Screens Window, Ctrl Alt 1        | Decided, follows ProPresenter                                                                                                                                                 | All      | 1    |
| Look 편집      | `workspace.looks`   | Ctrl Shift 1   | Open the Edit Looks Screen, Ctrl Shift 1         | Decided, follows ProPresenter (S4 p. 37). Opens 화면 설정 with the Look editor.                                                                                               | All      | 1    |
| 무대 배치 편집 | `workspace.stage`   | Ctrl 4         | Open Edit Layouts Screen, Ctrl 4                 | Decided, follows ProPresenter. Opens 화면 설정 with the stage layout editor.                                                                                                  | All      | 1    |
| 미디어         | `workspace.media`   | Ctrl Shift V   | Open Media Bin, Ctrl Shift V                     | Decided, follows ProPresenter. Opens or closes the media strip in 진행 and the media view in 준비 (01). Inside a text field, Ctrl Shift V stays the plain paste of the field. | All      | 1    |

- Switching workspaces never changes the output (01), so these keys are safe to
  press by mistake during a service.

#### 찾기 (search)

| Command | ID             | Default | ProPresenter   | Basis and reason                                                                               | Works in | Ver. |
| ------- | -------------- | ------- | -------------- | ---------------------------------------------------------------------------------------------- | -------- | ---- |
| 찾기    | `search.focus` | Ctrl F  | Search, Ctrl F | Decided, follows ProPresenter (S1, S8). Focuses the toolbar search field and selects its text. | All      | 1    |

- Esc clears the field, and Esc on an empty field leaves it (Kept, `TextField`
  README).

#### 준비 editing

| Command                             | ID                                              | Default                                   | ProPresenter                | Basis and reason                                                                                                                                                                                                                                                                                       | Works in                     | Ver.  |
| ----------------------------------- | ----------------------------------------------- | ----------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ----- |
| 새 곡                               | `library.newSong`                               | Ctrl N                                    | New Presentation, Ctrl N    | Decided, follows ProPresenter. Same as 새 곡 in the 라이브러리 header (05). Switches to 준비.                                                                                                                                                                                                          | All                          | 1     |
| 텍스트 파일 가져오기                | `import.textFile`                               | Ctrl Shift I                              | Import > File, Ctrl Shift I | Decided, follows ProPresenter (05)                                                                                                                                                                                                                                                                     | All                          | 1     |
| 클립보드 텍스트 가져오기            | `import.clipboard`                              | None                                      | None in S1                  | Decided, no ProPresenter source found (05)                                                                                                                                                                                                                                                             | All                          | 1     |
| 새 예배                             | `service.new`                                   | None                                      | None                        | Decided, no ProPresenter source found (Kept, 05 says "with the shortcut the operator sets").                                                                                                                                                                                                           | All                          | 1     |
| 다른 예배에서 가져오기              | `service.importItems`                           | None                                      | None                        | Decided, no ProPresenter source found (05)                                                                                                                                                                                                                                                             | All                          | 1     |
| 지금 예배를 틀로 저장               | `service.saveAsTemplate`                        | None                                      | None                        | Decided, no ProPresenter source found (05)                                                                                                                                                                                                                                                             | All                          | 1     |
| 실행 취소 (edit undo)               | `edit.undo`                                     | Ctrl Z                                    | Undo, Ctrl Z                | Decided, follows ProPresenter. In 준비 and in text fields (03).                                                                                                                                                                                                                                        | 준비, text fields            | 1     |
| 다시 실행                           | `edit.redo`                                     | Ctrl Y, Ctrl Shift Z                      | Redo, Ctrl Y                | Decided, follows ProPresenter for Ctrl Y. Ctrl Shift Z added because many Windows editors accept it.                                                                                                                                                                                                   | 준비, text fields            | 1     |
| 장 나누기                           | `editor.splitSlide`                             | Ctrl Enter                                | None                        | Decided, no ProPresenter source found; follows EasyWorship (S9). Splits the block at the cursor. Enter on an empty line still splits (05).                                                                                                                                                             | Song editor                  | 1     |
| 새 장                               | `editor.newSlide`                               | Ctrl Shift N                              | New Slide, Ctrl Shift N     | Decided, follows ProPresenter. Inserts an empty block after the current block.                                                                                                                                                                                                                         | Song editor                  | 1     |
| 이름표 메뉴                         | `editor.labelMenu`                              | None                                      | None                        | Decided, no ProPresenter source found. Opens the 이름표 menu of the current block.                                                                                                                                                                                                                     | Song editor                  | 1     |
| 칩 왼쪽으로, 칩 오른쪽으로          | `arrangement.moveLeft`, `arrangement.moveRight` | Alt ←, Alt →                              | None                        | Decided, no ProPresenter source found (Kept, 05). The chip strip has focus, so these don't reach 다음 배경 (진행 only).                                                                                                                                                                                | Chip strip                   | 1     |
| 복제                                | `edit.duplicate`                                | Ctrl D                                    | Duplicate, Ctrl D           | Decided, follows ProPresenter. Only where the right-click menu has 복제 (Look, stage layout, 매크로).                                                                                                                                                                                                  | 화면 설정, 매크로 tab        | 1     |
| 삭제                                | `edit.delete`                                   | Delete                                    | Delete                      | Decided, follows ProPresenter. Deletes the selection where the spec allows it without confirmation (예배 순서 items, chips). Elsewhere it opens the confirmation.                                                                                                                                      | Lists, chip strip            | 1     |
| 가져온 곡 저장                      | `import.save`                                   | Ctrl S (in the imported song editor only) | None                        | Decided, no ProPresenter source found. The only place with a 저장 button. Open question 1.                                                                                                                                                                                                             | Imported song editor         | 1     |
| 미디어 가져오기                     | `media.import`                                  | None                                      | None                        | Decided, no ProPresenter source found. 가져오기 in the media strip and the media view (04, 05). ProPresenter's Import > File (Ctrl Shift I) covers text and presentation files, not media (S4 p. 90), and this app gives Ctrl Shift I to text import. Media import is preparation work, so no default. | All                          | 1     |
| 새 재생목록, 새 오디오 재생목록     | `media.newPlaylist`, `media.newAudioPlaylist`   | None                                      | None                        | Decided, no ProPresenter source found (05).                                                                                                                                                                                                                                                            | 준비 media view              | 1     |
| 다시 연결 (relink)                  | `media.relink`                                  | None                                      | None                        | Decided, no ProPresenter source found. Relinks the selected missing media (08).                                                                                                                                                                                                                        | 준비 media view, media strip | 1     |
| 구성 추가                           | `arrangement.add`                               | None                                      | None                        | Decided, no ProPresenter source found (05).                                                                                                                                                                                                                                                            | Song editor                  | 1     |
| 장 넣기                             | `arrangement.insertSlide`                       | None                                      | None                        | Decided, no ProPresenter source found. Opens the 장 menu at the end of the chip strip (05).                                                                                                                                                                                                            | Chip strip                   | 1     |
| 잘라내기, 복사, 붙여넣기, 모두 선택 | (fixed)                                         | Ctrl X, Ctrl C, Ctrl V, Ctrl A            | Same (S1)                   | Decided, follows ProPresenter. Windows text keys; reserved, so they can't be reassigned.                                                                                                                                                                                                               | Text fields, lists           | 1     |
| PowerPoint 파일 가져오기            | `import.pptx`                                   | None                                      | None                        | Decided, no ProPresenter source found. Unavailable until PowerPoint import (09).                                                                                                                                                                                                                       | All                          | Later |

#### 화면 설정 editing

| Command            | ID                       | Default                         | ProPresenter                       | Basis and reason                                                                   | Works in            | Ver. |
| ------------------ | ------------------------ | ------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------- | ------------------- | ---- |
| 요소 이동          | (editor keys)            | Arrows 1 px, Shift arrows 10 px | None in S1                         | Decided, no ProPresenter source found (Kept, 06)                                   | Stage layout editor | 1    |
| 요소 삭제          | (editor keys)            | Delete                          | Delete                             | Decided, no ProPresenter source found (Kept, 06)                                   | Stage layout editor | 1    |
| 화면에 맞춤 (zoom) | `stageEditor.fit`        | Ctrl 0                          | Fit Slide into Edit Window, Ctrl 0 | Decided, follows ProPresenter (Editor menu). Fits the canvas to the center column. | Stage layout editor | 1    |
| 모니터 번호 표시   | `screens.identify`       | None                            | None                               | Decided, no ProPresenter source found (06).                                        | 화면 설정           | 1    |
| Look 추가          | `look.new`               | None                            | None                               | Decided, no ProPresenter source found (06).                                        | 화면 설정           | 1    |
| 새 배치            | `stageLayout.new`        | None                            | None                               | Decided, no ProPresenter source found (06).                                        | 화면 설정           | 1    |
| 요소 추가          | `stageEditor.addElement` | None                            | None                               | Decided, no ProPresenter source found. Opens the element kind menu (06).           | Stage layout editor | 1    |

#### 창 and 메뉴 (windows and menus)

| Command                     | ID                                   | Default             | ProPresenter                             | Basis and reason                                                                                                                       | Works in            | Ver. |
| --------------------------- | ------------------------------------ | ------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---- |
| 환경설정                    | `app.preferences`                    | Ctrl ,              | Open Settings, Ctrl ,                    | Decided, follows ProPresenter                                                                                                          | All                 | 1    |
| 환경설정 page, one per page | `app.preferences.<page>`             | None                | Settings pages in Key Mappings (S6 21.1) | Decided, follows ProPresenter. Opens 환경설정 at that page, for example 단축키.                                                        | All                 | 1    |
| 환경설정 닫기               | (window keys)                        | Esc, Ctrl W         | None                                     | Decided, no ProPresenter source found (Windows convention for a secondary window). Esc first cancels a recording key field.            | 환경설정 window     | 1    |
| 종료                        | `app.quit`                           | Ctrl Q              | Quit, Ctrl Q                             | Decided, follows ProPresenter. Alt F4 on the main window does the same. While any output is on, it asks first (see "Fixed behaviors"). | All                 | 1    |
| 메뉴 막대                   | (fixed)                              | Alt, F10            | None                                     | Decided, no ProPresenter source found (Kept, `MenuBar` README). No Alt plus letter access keys.                                        | Main window         | 1    |
| 오른쪽 클릭 메뉴            | (fixed)                              | Shift F10, Menu key | None                                     | Decided, no ProPresenter source found (Kept, `Menu` README, 07)                                                                        | Where a menu exists | 1    |
| 로그 폴더 열기              | `app.openLogs`                       | None                | None                                     | Decided, no ProPresenter source found (01 도움말 menu)                                                                                 | All                 | 1    |
| 버전 정보                   | `app.about`                          | None                | None                                     | Decided, no ProPresenter source found (01 도움말 menu). Opens the 정보 page.                                                           | All                 | 1    |
| 최소화, 최대화              | `window.minimize`, `window.maximize` | None                | None                                     | Decided, no ProPresenter source found. The 창 menu items (01). Windows keys (Windows ↓, Windows ↑) already work on the main window.    | Main window         | 1    |

- Dialog keys stay fixed: Enter is the primary button and Esc is 취소 (Kept,
  `Dialog` and `AlertDialog` READMEs).
- F1 has no help role. It clears everything, as in ProPresenter (S1).

#### Later commands

- MIDI, Stream Deck, and network control (S4 pp. 148 to 150, S8) send the same
  command IDs, so a MIDI map or a Stream Deck profile is a table from an input
  to a command ID (decided). Keep IDs stable across versions.
- 퀵 실행 item keys use `quick.<item ID>` (09).
- A ProPresenter-style "Show Slide on Stage Display Only" (S1 Ctrl 0) waits
  until the 무대 화면 can show a 장 that the audience screens don't.

#### Actions without a command

These actions have no command ID and no shortcut, for the reason given:

| Action                                                                                               | Reason                                                                                                                                              | How the keyboard reaches it                                                    |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Outputting one specific 장, media tile, or 공지 image                                                | The target is one item on screen. 다음 장, 이전 장, jump keys, and 다음 배경 cover live navigation.                                                 | The 장 grid with focus, ↑ ↓ and Enter (rule 5); other tiles with Tab and Enter |
| Selecting a 예배 순서 row                                                                            | Selection isn't output (04).                                                                                                                        | ↑ ↓ in the focused list, or 다음 항목 and 이전 항목                            |
| Changing a value in a property panel, a Look card, the media properties, or the 메시지 and 공지 tabs | The control holds the value and has its own keys.                                                                                                   | Tab to the control, then its keys                                              |
| Drag and drop (reordering items, chips, and tiles, files from Explorer)                              | A gesture. The spec gives keyboard moves only to the chip strip (Alt ← and Alt →, 05).                                                              | Chip strip only                                                                |
| Right-click menu items (이름 바꾸기, 삭제, 아이콘 바꾸기, 색, 모음, 시작할 때 실행, and so on)       | They act on the item under the menu.                                                                                                                | Shift F10 or the Menu key on the focused item (07)                             |
| Dialog buttons (만들기, 가져오기, 덮어쓰기, 복구, 새로 시작)                                         | They belong to one dialog.                                                                                                                          | Enter for the primary button, Esc for 취소 (fixed)                             |
| The 다시 시도 button of a save failure notification                                                  | Bound to one notification. Notifications never take focus (08).                                                                                     | None; the app keeps the content in memory until a retry (02)                   |
| The 테스트 패턴 choice in 화면 설정                                                                  | It changes a real output, and only in 화면 설정 by the operator's choice (08). A global key could put color bars on the projector during a service. | The segmented control in 화면 설정                                             |
| Bible panel buttons (앞 절 추가, 뒤 절 추가, 예배 순서에 넣기)                                       | They act on the passage in the open Bible panel. 바로 띄우기 is Enter in the Bible field (04).                                                      | Tab and Enter                                                                  |
| Choosing a search result, a service in the service list, or a suggestion                             | They belong to an open list.                                                                                                                        | ↑ ↓ and Enter (04, `Menu` README)                                              |

### Default key map

Every default key in one list, to show that no two commands share a key in the
same place.

| Key                           | Command                                                      | Where                                     |
| ----------------------------- | ------------------------------------------------------------ | ----------------------------------------- |
| F1 to F7                      | 지우기 (모두, 가사, 미디어, 소품, 오디오, 메시지, 공지)      | Everywhere                                |
| →, Space, Page Down           | 다음 장                                                      | 진행                                      |
| ←, Page Up                    | 이전 장                                                      | 진행                                      |
| Ctrl ↓, Ctrl ↑                | 다음 항목, 이전 항목                                         | 진행                                      |
| Alt →, Alt ←                  | 다음 배경, 이전 배경                                         | 진행                                      |
| Alt →, Alt ←                  | 칩 오른쪽으로, 칩 왼쪽으로                                   | Chip strip in 준비 (no overlap with 진행) |
| Ctrl Z                        | 되돌림 (진행, 화면 설정), 실행 취소 (준비 and text fields)   | Split by workspace and focus (03)         |
| Ctrl Y, Ctrl Shift Z          | 다시 실행                                                    | 준비, text fields                         |
| Ctrl 1, Ctrl 2                | 청중 화면 출력, 무대 화면 출력                               | All                                       |
| Ctrl Shift 1                  | Look 편집                                                    | All                                       |
| Ctrl Alt 1                    | 화면 설정                                                    | All                                       |
| Ctrl 4                        | 무대 배치 편집                                               | All                                       |
| Ctrl 0                        | 화면에 맞춤                                                  | Stage layout editor                       |
| Ctrl S                        | 진행 (가져온 곡 저장 in the imported song editor)            | All (open question 1)                     |
| Ctrl E, Ctrl R                | 준비                                                         | All                                       |
| Ctrl Shift V                  | 미디어 (plain paste inside text fields)                      | All                                       |
| Ctrl F                        | 찾기                                                         | All                                       |
| Ctrl L                        | 출력 중인 항목 열기                                          | 진행                                      |
| Ctrl Alt L                    | 라이브러리에서 열기                                          | All                                       |
| Ctrl M                        | 메시지 탭                                                    | 진행                                      |
| Ctrl Shift C                  | 타이머 탭                                                    | 진행                                      |
| Ctrl Shift P                  | 소품 탭                                                      | 진행                                      |
| Alt S                         | 무대 탭                                                      | 진행                                      |
| Alt C                         | 동작 팔레트                                                  | 진행                                      |
| Ctrl Alt B                    | 성경 구절 찾기                                               | 진행                                      |
| Ctrl N                        | 새 곡                                                        | All                                       |
| Ctrl Shift N                  | 새 장                                                        | Song editor                               |
| Ctrl Enter                    | 장 나누기                                                    | Song editor                               |
| Ctrl Shift I                  | 텍스트 파일 가져오기                                         | All                                       |
| Ctrl D                        | 복제                                                         | Where 복제 exists                         |
| Delete                        | 삭제                                                         | Lists, chip strip, stage layout editor    |
| Ctrl ,                        | 환경설정                                                     | All                                       |
| Ctrl Q, Alt F4                | 종료                                                         | All                                       |
| Esc, Ctrl W                   | 환경설정 닫기                                                | 환경설정 window                           |
| Bare letters and digits       | 이름표 jump keys                                             | 진행                                      |
| Enter (inside the field only) | 무대 메시지 보내기, 메시지 보내기, 바로 띄우기 (Bible field) | Their text fields in 진행                 |

- Ctrl B stays free. EasyWorship uses it for a black screen and Ctrl L for the
  logo (S9). Here Ctrl L is ProPresenter's Show Triggered Presentation (S1).
  Ctrl B is a natural candidate for 검은 화면 when the user decides on 퀵 실행
  keys (README open question 3).

## Settings

### Principles

- **A setting exists only when operators really differ.** Hardware, room, church
  practice, or taste differ, and the app can't decide for them. Otherwise the
  app picks one safe behavior and has no row.
- **Safety isn't a setting.** Anything that keeps a service safe stays fixed: no
  confirmation before output actions, F1 to F7 always work, no sleep during
  output, no network, no update prompts during output. "Fixed behaviors" lists
  them with reasons.
- **One place for each value.** A value lives in exactly one of these places:
  1. 환경설정: how the app behaves on this computer.
  2. 화면 설정: each screen (monitor, method, stability, correction).
  3. Looks and lyric styles: how content looks on each screen. Lyric fonts live
     here.
  4. Object properties: each media file, 매크로, 타이머, 메시지 template, 공지
     set, 소품, 이름표, and Bible passage.
  5. Remembered state: column widths, the last tab, and other things the app
     remembers without a settings row (`app.json`).
- **No single-option controls.** A select with one option is noise (design
  principle 3). Such rows wait until there is a second option.
- **Every value has a range.** Number fields snap out-of-range values to the
  nearest valid value (`TextField` README). Reading a file clamps or drops
  invalid values, logs them, and uses the default (`docs/TECH.md`).
- **Say when a change applies.** "At once" applies to the output and the UI at
  once. "Next launch" needs a restart, which the row's tooltip says ("다시
  시작하면 적용됩니다"). No restart happens by itself (08).
- **Settings never change the output by themselves**, except where the row says
  "At once" for a value that only changes how content looks or sounds
  (transitions, audio device). Opening, browsing, or closing 환경설정 never
  changes the output (08).
- **Reset per page.** Each page has 기본값으로 at the bottom, which asks in a
  confirmation dialog (proposal).

### 환경설정 window

- The window and its frame stay as in 06: a separate window titled "환경설정",
  opened from 파일 > 환경설정 or Ctrl ,.
- Pages, in this order (proposal):

| Page       | Content                                                            | Ver.  | Compared with ProPresenter (S4)            |
| ---------- | ------------------------------------------------------------------ | ----- | ------------------------------------------ |
| 일반       | Launch with Windows                                                | 1     | General                                    |
| 출력       | Output on launch, transitions, preview rate, hardware acceleration | 1     | Screens, General (render mode)             |
| 진행       | What → does on the last 장, audio fades                            | 1     | Audio bin transition slider (p. 118)       |
| 라이브러리 | Data and media folders, automatic backup, recovery copies          | 1     | Advanced (Support Files, media repository) |
| 성경       | Installed translations, defaults for new passages                  | 1     | Bible options (pp. 141 to 142)             |
| 가져오기   | Text import defaults                                               | 1     | Import window options (p. 90)              |
| 미디어     | Copy on import, new media defaults, audio devices                  | 1     | Import, Audio, Advanced                    |
| 단축키     | Shortcuts and 이름표 jump keys                                     | 1     | Key Mappings (S2), Groups                  |
| 정보       | Version, troubleshooting                                           | 1     | Updates                                    |
| 입력       | Camera inputs                                                      | Later | Input                                      |
| 연결       | MIDI, network control, remote apps, global shortcuts               | Later | Network, Devices                           |
| 업데이트   | Check for updates, channel                                         | Later | Updates                                    |

Each page table has these columns: the group and row as the window shows them,
the control and its range, the default, where it's stored (the file in the data
folder's `설정\` unless it says `app.json`), when a change applies, the version,
the basis, and the reason.

#### 일반 (General)

| Group         | Row                                          | Control and range | Default | Stored in                                                                | Applies     | Ver.  | Basis                                       | Reason                                                                                                                                    |
| ------------- | -------------------------------------------- | ----------------- | ------- | ------------------------------------------------------------------------ | ----------- | ----- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 시작 (launch) | Windows 시작할 때 실행 (launch with Windows) | Switch            | Off     | `preferences.json` `general.launchAtLogin`, and the Windows sign-in item | At once     | 1     | Ours                                        | A church computer that only runs the service can boot straight into the app. Off by default because a shared computer shouldn't start it. |
| 앱            | 언어 (language)                              | Select            | 한국어  | `preferences.json` `language` (Kept, 02)                                 | Next launch | Later | PP (Preferred Language, restart, S4 p. 154) | Hidden in version 1: only Korean exists, and a one-option select is noise.                                                                |

- The `Prefs` board's 시작할 때: 마지막 예배 열기 row has one option, so it
  becomes a fixed behavior: the app opens the last service (Kept, 04).
- The 저장 (saving) and 보고 (reports) groups go away: saving happens on every
  change (02), and reports are rejected (see "Rejected candidates"). 복구 사본
  moves to 라이브러리.

#### 출력 (Output)

| Group              | Row                                   | Control and range                        | Default | Stored in                                                              | Applies         | Ver. | Basis                                                             | Reason                                                                                                                                                |
| ------------------ | ------------------------------------- | ---------------------------------------- | ------- | ---------------------------------------------------------------------- | --------------- | ---- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 시작               | 켤 때 화면 출력 (output on launch)    | Switch                                   | Off     | `preferences.json` `output.showOnLaunch` (renamed from `showOnLaunch`) | Next launch     | 1    | PP (Automatically Enable Screens at Launch, S4 p. 172), Kept (03) | For a computer that starts the app before every service, with the projectors already assigned. After a crash, the recovery dialog decides first (08). |
| 전환 (transitions) | 장 전환 (slide transition)            | Segmented: 없음 (cut), 디졸브 (dissolve) | 디졸브  | `preferences.json` `output.transition.slide.kind`                      | Next 장         | 1    | PP (Master Slide Transition, S4 pp. 15, 166)                      | Taste and room differ. ProPresenter keeps a global default transition. 03 had fixed values and an open question.                                      |
| 전환               | 장 전환 시간                          | Number, s, 0.1 to 2.0, step 0.1          | 0.2     | `output.transition.slide.seconds`                                      | Next 장         | 1    | Ours (the default is 03's value)                                  | Hidden while 장 전환 is 없음.                                                                                                                         |
| 전환               | 배경 전환 (background transition)     | Segmented: 없음, 디졸브                  | 디졸브  | `output.transition.media.kind`                                         | Next background | 1    | PP (Master Media Transition, S4 p. 166)                           | Same reason.                                                                                                                                          |
| 전환               | 배경 전환 시간                        | Number, s, 0.1 to 3.0, step 0.1          | 0.5     | `output.transition.media.seconds`                                      | Next background | 1    | Ours (03's value)                                                 | Hidden while 배경 전환 is 없음.                                                                                                                       |
| 미리보기 (preview) | 미리보기 프레임 수                    | Select: 15, 30, 60 fps                   | 30 fps  | `output.previewFps` (renamed from `previewFps`)                        | At once         | 1    | Kept (`Prefs`, 03)                                                | Lightens the control window on a weak computer. Output windows always aim for 60 fps.                                                                 |
| 성능 (performance) | 하드웨어 가속 (hardware acceleration) | Switch                                   | On      | `output.hardwareAcceleration` (renamed)                                | Next launch     | 1    | Kept (`Prefs`), PP (Render Mode, Mac only, S4 p. 171)             | A way around a faulty graphics driver. Electron can change it only at launch. Turning it off makes video less smooth.                                 |

- Rows removed from this page (proposal):
  - 출력 중 절전 막기 (prevent sleep during output): fixed on (see "Fixed
    behaviors").
  - 출력 창 항상 위 and 화면 연결이 끊기면: each screen already has its own
    value in 화면 설정. 02 made these "defaults for new screens", but version 1
    can't add screens, so the rows would do nothing (resolves README open
    question 14).
- Look changes and clears stay instant, as 03 says. Whether clears should fade
  with the layer's transition is open question 12.

#### 진행 (Show)

| Group          | Row                                         | Control and range                             | Default | Stored in                             | Applies    | Ver. | Basis                                                                                                                         | Reason                                                                                                                                                                                                                             |
| -------------- | ------------------------------------------- | --------------------------------------------- | ------- | ------------------------------------- | ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 장 넘기기      | 마지막 장에서 다음 장 (next on the last 장) | Segmented: 멈춤 (stop), 다음 항목 (next item) | 멈춤    | `preferences.json` `show.atLastSlide` | At once    | 1    | Decided (shortcut decision), no ProPresenter source found: 04 proposed 다음 항목 as a guess, so this proposal's 멈춤 applies. | Moving into the next item starts it, which can run its start 매크로 and change the Look. A stray → at the end of a song must not do that, so 멈춤 is the safe default. 다음 항목 (Ctrl ↓) then → still moves on (open question 3). |
| 오디오 (audio) | 오디오 전환 (audio transition)              | Number, s, 0 to 5, step 0.1                   | 0.5     | `show.audio.transitionSeconds`        | Next track | 1    | PP (the audio bin slider sets the transition between audio files, including start and clear, S4 p. 118)                       | Used when a track starts, when the next track follows, and by 오디오 지우기 (F5). 03's fixed 0.5 s becomes the default.                                                                                                            |
| 오디오         | 페이드 아웃 시간 (fade out time)            | Number, s, 0.5 to 10, step 0.5                | 3       | `show.audio.fadeOutSeconds`           | At once    | 1    | Ours (04's value)                                                                                                             | The 페이드 아웃 button and the 매크로 action use it. Rooms and music differ.                                                                                                                                                       |

- Behaviors considered for this page and kept fixed: the 이름표 jump key rule
  (04), ignoring key repeat, dim done items, clicking the live 장 again doesn't
  redraw (03), and the start 매크로 rule (07). See "Fixed behaviors" and
  "Rejected candidates".

#### 라이브러리 (Library and data)

| Group                       | Row                                           | Control and range                              | Default                    | Stored in                               | Applies                 | Ver. | Basis                                                             | Reason                                                                                                                                                                                      |
| --------------------------- | --------------------------------------------- | ---------------------------------------------- | -------------------------- | --------------------------------------- | ----------------------- | ---- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 위치 (locations)            | 데이터 폴더 (data folder: 곡, 예배, 틀, 설정) | Read-only path, folder icon, 바꾸기, 폴더 열기 | `Documents\LoveLight`      | `app.json` `dataRoot` (Kept, 02)        | Next launch             | 1    | PP (Support Files folder, S4 p. 190); replaces the board's 곡 row | Songs, services, 틀, and settings refer to each other by ID, so they move together. Changing only the song folder would split them. A restart avoids reloading everything during a service. |
| 위치                        | 미디어 폴더 (media folder)                    | Read-only path, 바꾸기, 폴더 열기              | `<data folder>\미디어`     | `app.json` `mediaPath` (Kept, 02)       | At once for new imports | 1    | Kept (`Prefs`), PP (media repository, S4 p. 190)                  | Media are large, and churches keep them on another drive. Existing media keep their stored paths (02).                                                                                      |
| 백업 (backup)               | 자동 백업 (automatic backup)                  | Switch                                         | On                         | `preferences.json` `backup.auto` (Kept) | Next launch             | 1    | Kept (`Prefs`)                                                    | Backup runs once a day at launch, never during a service (02).                                                                                                                              |
| 백업                        | 백업 위치 (backup location)                   | Read-only path, 바꾸기, 폴더 열기              | `Documents\LoveLight 백업` | `app.json` `backupPath` (Kept)          | Next backup             | 1    | Kept (`Prefs`); the default is a proposal                         | A second drive or a synced folder protects more than the same disk. 02 left the default open.                                                                                               |
| 백업                        | 보관 (keep)                                   | Number, 개, 1 to 365                           | 30                         | `backup.keep` (Kept)                    | Next backup             | 1    | Kept (`Prefs`)                                                    | Disk space differs.                                                                                                                                                                         |
| 백업                        | 마지막 백업 (last backup)                     | Read-only time, 지금 백업 button               |                            | `app.json` `lastBackupAt` (Kept)        | At once                 | 1    | Kept (`Prefs`)                                                    | 지금 백업 is unavailable while any output is on, with the reason in a tooltip, because backups don't run during a service (08) (proposal, open question 18).                                |
| 복구 사본 (recovery copies) | 파일마다 (per file)                           | Number, 개, 3 to 50                            | 10                         | `backupCopies` (Kept, 02)               | Next save               | 1    | Kept (`Prefs`); moved from 일반                                   | Recovery copies and backups are both about getting data back, so they sit together. A minimum of 3 keeps a safety net.                                                                      |

- When the operator picks a new, empty data folder, the app asks whether to copy
  the current data there: "새 폴더가 비어 있습니다. 지금 데이터를 복사할까요?"
  with 취소, 복사하지 않음, and 복사 (proposal). 02 says the app doesn't move
  existing files; copying keeps the original as it is.
- Deleted songs, services, and 틀 go to the Windows Recycle Bin (see "Fixed
  behaviors").

#### 성경 (Bible)

| Group                   | Row                                 | Control and range                                          | Default       | Stored in                                                         | Applies                      | Ver. | Basis                                                                     | Reason                                                                                         |
| ----------------------- | ----------------------------------- | ---------------------------------------------------------- | ------------- | ----------------------------------------------------------------- | ---------------------------- | ---- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 설치된 역본 (installed) | One row per translation, 역본 추가  | Name, language, size, 기본 tag, more menu (기본으로, 삭제) | 개역한글 기본 | `bible.json` `translations[]` (Kept, 02)                          | At once                      | 1    | Kept (`Prefs`), PP (install and remove Bibles, S4 p. 143)                 | Translations differ by church.                                                                 |
| 새 구절 (new passages)  | 나누기 (split)                      | Select: 한 장에 한 절, 두 절씩, 길이에 맞춤                | 한 장에 한 절 | `preferences.json` `bible.defaults.split`                         | New passages                 | 1    | PP (Break on New Verse, S4 p. 142)                                        | The Bible panel keeps the value per passage (02). This row only sets where new passages start. |
| 새 구절                 | 참조 (reference)                    | Select: 장마다, 첫 장만, 마지막 장만, 없음                 | 장마다        | `bible.defaults.reference`                                        | New passages                 | 1    | PP (Passage Each, Passage Last, No Reference, S4 p. 142); 첫 장만 from 02 | Adds ProPresenter's "last 장 only" to 02's values (open question 17).                          |
| 새 구절                 | 절 번호 (verse numbers)             | Switch                                                     | On            | `bible.defaults.verseNumbers` (renamed from `bible.verseNumbers`) | New passages                 | 1    | Kept (`Prefs`), PP (Show Verse Numbers, S4 p. 142)                        |                                                                                                |
| 새 구절                 | 역본 이름 (translation name)        | Switch                                                     | Off           | `bible.defaults.translationName`                                  | New passages                 | 1    | PP (Display Translation, S4 p. 142)                                       | 04's panel has the toggle. A default saves a click for churches that always show it.           |
| 새 구절                 | 한 장 최대 줄 수 (max lines per 장) | Number, 줄, 1 to 12                                        | 4             | `bible.maxLines` (Kept)                                           | New passages and 길이에 맞춤 | 1    | Kept (`Prefs`)                                                            | Screen size and font size differ.                                                              |

- 출처 위치 (reference position) moves to the lyric style (see "Lyric styles and
  fonts"), because the 본 화면 and the 방송 자막 need different positions.

#### 가져오기 (Import)

| Group         | Row                                   | Control and range                        | Default                    | Stored in                                                | Applies     | Ver.  | Basis                                                       | Reason                                                                                                     |
| ------------- | ------------------------------------- | ---------------------------------------- | -------------------------- | -------------------------------------------------------- | ----------- | ----- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 텍스트 (text) | 장 나누기 (split)                     | Select: 빈 줄, 줄 바꿈, 기호             | 빈 줄                      | `preferences.json` `import.txt.split` (Kept)             | Next import | 1     | Kept (`Prefs`), PP (Slides delimited by, S4 p. 90)          | Lyric files differ by source.                                                                              |
| 텍스트        | 한 장에 (per 장)                      | Number, 1 to 8, one value per split kind | 빈 줄 1, 줄 바꿈 2, 기호 1 | `import.txt.perSlide.blankLine`, `.lineBreak`, `.symbol` | Next import | 1     | PP (Delimiters per slide, S4 p. 90); defaults from 05       |                                                                                                            |
| 텍스트        | 기호 (symbol)                         | Text field, 1 to 4 characters            | /                          | `import.txt.symbol`                                      | Next import | 1     | PP (custom delimiter such as "//", S4 p. 90); 05's proposal | No board shows where to enter it (README open question 25).                                                |
| 텍스트        | 이름표 인식 (detect 이름표)           | Select: 대괄호 줄, 끔                    | 대괄호 줄                  | `import.txt.labels` (Kept)                               | Next import | 1     | Kept (`Prefs`)                                              |                                                                                                            |
| 텍스트        | 클립보드 첫 줄 (clipboard first line) | Select: 제목, 가사                       | 제목                       | `import.txt.firstLine` (Kept)                            | Next import | 1     | Kept (`Prefs`), renamed                                     | 05 uses the file name as the title for files, so the row applies to clipboard text only. The name says so. |
| 텍스트        | 글자 인코딩 (encoding)                | Select: 자동, UTF-8, CP949               | 자동                       | `import.txt.encoding` (Kept)                             | Next import | 1     | Kept (`Prefs`)                                              | Old Korean lyric files are often CP949.                                                                    |
| PowerPoint    | 슬라이드 하나, 배경 이미지 가져오기   | As in 06                                 |                            | `import.pptx.*` (Kept)                                   |             | Later | Kept (09)                                                   |                                                                                                            |

- The import dialog's option bar starts from these values and saves the values
  the operator last used back into the same fields (proposal). The page and the
  dialog then never disagree.

#### 미디어 (Media)

| Group                          | Row                                             | Control and range                                 | Default           | Stored in                               | Applies     | Ver. | Basis                                                                    | Reason                                                                                                                                                                                                                              |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------- | ----------------- | --------------------------------------- | ----------- | ---- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 가져오기                       | 미디어 폴더로 복사 (copy into the media folder) | Switch                                            | On                | `preferences.json` `media.copyOnImport` | Next import | 1    | PP differs (Manage Media Automatically, off by default, S4 p. 190)       | Files from a USB drive or a download folder go missing; a copy can't. ProPresenter says the option prevents "accidental broken links" (S4 p. 190). Default on for that reason. Resolves README open question 12 (open question 15). |
| 새 미디어 (new media defaults) | 동영상 끝나면 (video at the end)                | Segmented: 반복, 멈춤                             | 반복              | `media.defaults.end`                    | New imports | 1    | PP (Import tab video playback behavior, loop or stop, S4 p. 174)         | Most imported videos are looping backgrounds. Each media item keeps its own value (05).                                                                                                                                             |
| 새 미디어                      | 맞춤 (fit)                                      | Segmented: 맞추기, 채우기, 늘리기                 | 채우기            | `media.defaults.fit`                    | New imports | 1    | PP (Import tab scaling behavior, S4 p. 174)                              | A background should cover the screen.                                                                                                                                                                                               |
| 새 미디어                      | 동영상 소리 (video sound)                       | Switch                                            | Off               | `media.defaults.audio`                  | New imports | 1    | Ours                                                                     | A background loop with music that starts playing during worship is worse than a silent announcement video, which the operator notices while preparing. Open question 14.                                                            |
| 소리 (sound)                   | 출력 장치 (output device)                       | Select: Windows 기본 장치, then each audio device | Windows 기본 장치 | `media.audioOutput` (`{ id, label }`)   | At once     | 1    | PP (Audio tab Main Output, S4 p. 187)                                    | The audio interface to the mixer often isn't the Windows default device. Audio playback and video sound both use it. 04 used the Windows default only.                                                                              |
| 소리                           | 미리 듣기 장치 (preview device)                 | Select: Windows 기본 장치, then each audio device | Windows 기본 장치 | `media.previewOutput` (`{ id, label }`) | At once     | 1    | PP (Audio tab Inspector Output, S4 p. 187), OBS (Monitoring Device, S11) | The preview player in the media view can go to headphones instead of the hall.                                                                                                                                                      |

- If the saved audio device is missing (unplugged), use the Windows default
  device, show the warning icon on the row with the reason in a tooltip, and go
  back to the saved device when it returns (proposal). Audio never stops because
  a device is missing.

#### 단축키 (Shortcuts)

See "Shortcut system". The page lists commands and 이름표 jump keys.

#### 정보 (About)

| Group                       | Row                           | Control and range                                                                                                                      | Default | Stored in  | Applies                               | Ver.  | Basis                                                           | Reason                                                                                                                        |
| --------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- | ------------------------------------- | ----- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 버전 (version)              | 현재 버전 (current version)   | Read-only: version and build date                                                                                                      |         |            |                                       | 1     | Kept (`Prefs` 업데이트 page), PP (installed version, S4 p. 192) |                                                                                                                               |
| 문제 해결 (troubleshooting) | 기록 폴더 (log folder)        | 폴더 열기 button                                                                                                                       |         |            |                                       | 1     | Ours (01 도움말 menu)                                           | Logs are where problems after a service are found (`docs/TECH.md`).                                                           |
| 문제 해결                   | 진단 정보 (diagnostics)       | 복사 button: copies the version, Windows version, graphics adapter, monitors, screen assignments, and the last errors to the clipboard |         |            |                                       | 1     | Ours                                                            | One step to collect what a fix needs. Nothing leaves the computer unless the operator pastes it somewhere.                    |
| 문제 해결                   | 자세한 기록 (verbose logging) | Switch                                                                                                                                 | Off     | Not stored | At once; off again at the next launch | 1     | Ours                                                            | Records more detail to catch a rare fault without a debug build. Turning off at the next launch keeps the log small.          |
| 업데이트                    | 지금 확인, 자동 확인, 채널    |                                                                                                                                        |         |            |                                       | Later | PP (Updates tab, S4 p. 192), OBS (S11)                          | Version 1 has no updater (`docs/TECH.md`). When it comes, it never checks, downloads, or asks while any output is on (fixed). |

#### Later pages

| Page     | Content                                                                                                                                                  | Basis                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 입력     | Camera inputs registered app-wide: device, mode, thumbnail, linked audio (09)                                                                            | PP (Input tab, S4 pp. 177 to 180)                                                                               |
| 연결     | MIDI input map to command IDs, network control (TCP/IP), remote apps with passwords, Stream Deck, and a choice for shortcuts while the app isn't focused | PP (Network and Devices tabs, S4 pp. 148 to 150, 181, 191; S6 version 17; S8), OBS (Hotkey Focus Behavior, S11) |
| 업데이트 | Check now, release notes, check at launch, channel, and a fixed rule that nothing happens while an output is on                                          | PP (S4 p. 192), OBS (S11), `docs/TECH.md`                                                                       |

### Settings on screens, Looks, and objects

These settings live outside 환경설정. This section is their complete inventory:
every row with its control, range, default, storage field (02), and when it
applies. "Changed" marks what this proposal changes. The other rows keep 06, 05,
and 02; where those leave a default or a range open, the value here comes from
the board named in the basis, or is marked as a proposal.

#### Screens (화면 설정)

Stored per screen in `screens.json` `screens[]`.

| Row                                                             | Control and range                                                                                   | Default                                              | Stored in                  | Applies         | Ver.                         | Basis                                                                                                                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------- | --------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 이름 (name)                                                     | Text field; required, unique among screens                                                          | 본 화면, 무대 화면, 방송 자막                        | `.name`                    | At once         | 1                            | Kept (06, `Screens`)                                                                                                                                             |
| 종류 (kind)                                                     | Segmented: 청중, 무대                                                                               | 본 화면 and 방송 자막 청중, 무대 화면 무대           | `.kind`                    | At once         | 1                            | Kept (06, 02)                                                                                                                                                    |
| 방식 (method)                                                   | Segmented: 전체 화면, 창, 캡처용 창, NDI (unavailable in version 1, with the reason in a tooltip)   | 본 화면 and 무대 화면 전체 화면, 방송 자막 캡처용 창 | `.method`                  | At once         | 1 (NDI later)                | Kept (06, 02)                                                                                                                                                    |
| 장치 (device)                                                   | Select of the connected monitors, with the monitor name as the detail; only for 전체 화면           | Unassigned                                           | `.display`                 | At once         | 1                            | Kept (06, 02)                                                                                                                                                    |
| 해상도 (resolution)                                             | 전체 화면: read-only, the monitor's resolution. 캡처용 창: select of 1920×1080, 1280×720, 3840×2160 | 1920×1080                                            | `.resolution`              | At once         | 1                            | Kept (06, `Screens`)                                                                                                                                             |
| 주사율 (refresh rate)                                           | Read-only                                                                                           | The monitor's rate                                   | Not stored                 |                 | 1                            | Kept (06, `Screens`)                                                                                                                                             |
| 연결이 끊기면 (when disconnected)                               | Select: 창으로 바꾸기, 출력 끄기                                                                    | 창으로 바꾸기                                        | `.onDisconnect`            | Next disconnect | 1                            | Kept (06, `Screens`, 03)                                                                                                                                         |
| 항상 위 (always on top)                                         | Switch                                                                                              | 전체 화면 on; 창 and 캡처용 창 off                   | `.alwaysOnTop`             | At once         | 1                            | Changed: defaults by method. A window or capture window sits on the control monitor, where it would cover the controls (03). OBS (projectors always on top, S11) |
| 절전 막기 (prevent sleep)                                       | Removed                                                                                             |                                                      | `.preventSleep` is removed |                 |                              | Changed: fixed on while any output is on. Windows sleep is system-wide, so a per-screen value can't work, and turning it off never helps a service.              |
| 가장자리 여백 (edge margin)                                     | Number field, %, 0 to 20, step 1                                                                    | 0                                                    | `.edgeMargin`              | At once         | 1                            | Kept (06); the default from `Screens` (0%); the range is a proposal                                                                                              |
| 위치 미세 조정 (position fine-tuning)                           | Two number fields (x, y), px, -200 to 200, step 1                                                   | 0, 0                                                 | `.offset`                  | At once         | 1                            | Kept (06); the default from `Screens` (0, 0); the range is a proposal                                                                                            |
| 미리보기 배경 (방송 자막 preview background)                    | Segmented: 초록, 검정, 체크 무늬                                                                    | 초록                                                 | `.previewBackground`       | At once         | Later; version 1 stays green | Kept (06, `ScreensNDI`)                                                                                                                                          |
| NDI: 소스 이름, 해상도, 프레임 수, 알파 채널, 보낼 곳, NDI 그룹 | Text, select, select, switch, select, text                                                          | The `ScreensNDI` values (30fps, alpha on, "public")  | `.ndi`                     | At once         | Later                        | Kept (06, 09)                                                                                                                                                    |

#### Looks

Stored in `looks.json`. Changes to the current Look apply to the output at once
(06).

| Row                                                                                                                                                          | Control and range          | Default                           | Stored in                       | Ver. | Basis              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | --------------------------------- | ------------------------------- | ---- | ------------------ |
| Look 이름 (name)                                                                                                                                             | Text; required, unique     | 평상시                            | `looks[].name`                  | 1    | Kept (06, `Looks`) |
| Layer rows per screen: 본 화면 and 방송 자막 배경 미디어 (방송 자막: 배경), 가사, 공지, 소품, 메시지; 무대 화면 배경 미디어, 가사, 시계, 무대 메시지, 메시지 | A check box each           | The 평상시 values in 02           | `.screens.<screen ID>.layers.*` | 1    | Kept (02, `Looks`) |
| 가사 스타일 (audience screens)                                                                                                                               | Select of lyric styles     | 본 화면 기본, 방송 자막 하단 자막 | `.lyricStyle`                   | 1    | Kept (`Looks`)     |
| 무대 배치 (무대 화면)                                                                                                                                        | Select of stage layouts    | 현재와 다음                       | `.stageLayout`                  | 1    | Kept (`Looks`, 03) |
| 배경 (방송 자막)                                                                                                                                             | Select: 초록, 검정, 미디어 | 초록                              | `.background`                   | 1    | Kept (06)          |
| 현재 Look (current Look)                                                                                                                                     | The toolbar Look menu      | 평상시                            | `current`                       | 1    | Kept (03)          |

#### Lyric styles and fonts

Where each font setting lives:

| Text                                        | Font set where                                                     | Basis                                                   |
| ------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| The app's UI                                | Nowhere. Pretendard Variable, bundled, fixed by the design system. | Design system README (typography)                       |
| Lyrics and Bible verses on audience screens | The lyric style that the Look picks for each screen (06)           | PP (themes and text objects, S4 pp. 63 to 65), EW (S10) |
| 무대 화면 elements                          | Each element's 글자 tab in the stage layout editor (06)            | PP (the Stage Layout Editor, S4 p. 17)                  |
| 소품 text                                   | The 소품's text style (02)                                         | PP (the Props Editor, S4 p. 48)                         |
| 메시지                                      | Not defined anywhere yet (open question 13)                        |                                                         |
| 타이머 values                               | Wherever they show: a stage element or a 소품 text                 |                                                         |

Lyric style rows, stored per style in `looks.json` `lyricStyles[]`. The defaults
are those of the style 기본 on the `Looks` board. Changes apply to the output at
once (06).

| Row                                  | Control and range                                                                                        | Default                      | Stored in                                                 | Ver.  | Basis                                                                                                               | Reason for a change                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 이름 (name)                          | Text; required, unique                                                                                   | 기본, 현재와 다음, 하단 자막 | `name`                                                    | 1     | Kept (06)                                                                                                           |                                                                                                        |
| 글꼴 (font)                          | Select: the bundled Pretendard first, then the installed families                                        | Pretendard                   | `font`                                                    | 1     | Kept (06, `Looks`)                                                                                                  |                                                                                                        |
| 굵기 (weight)                        | Select of the weights the chosen family has                                                              | 700                          | `weight`                                                  | 1     | Changed: new row (`Looks` shows "Pretendard Bold"); PP (font style, S4 p. 63)                                       | 02 stores it; the editor needs a row.                                                                  |
| 글자색 (text color)                  | Swatch, hex value, color picker                                                                          | #FFFFFF                      | `color`                                                   | 1     | Kept (06, `Looks`)                                                                                                  |                                                                                                        |
| 크기 (size)                          | Number field, px at 1080p, 12 to 300, step 1                                                             | 84                           | `size`                                                    | 1     | Kept (`Looks`); the range is a proposal                                                                             |                                                                                                        |
| 줄 간격 (line spacing)               | Number field, 0.8 to 3.0, step 0.05                                                                      | 1.4                          | `lineHeight`                                              | 1     | Kept (`Looks`); the range is a proposal                                                                             |                                                                                                        |
| 글자 간격 (letter spacing)           | Number field, %, -10 to 20, step 1                                                                       | 0                            | `letterSpacing`                                           | 1     | Changed: new row; PP (Tighten and Loosen Character Spacing, S1 Editor menu)                                         | Korean lyrics in large type often read better slightly tighter.                                        |
| 가로 정렬 (horizontal alignment)     | Segmented: 왼쪽, 가운데                                                                                  | 가운데                       | `align`                                                   | 1     | Kept (06, `Looks`)                                                                                                  |                                                                                                        |
| 세로 위치 (vertical position)        | Segmented: 위, 가운데, 아래                                                                              | 가운데                       | `vAlign`                                                  | 1     | Kept (06, `Looks`)                                                                                                  |                                                                                                        |
| 최대 줄 수 (maximum lines)           | Number field, 1 to 10                                                                                    | 2                            | `maxLines`                                                | 1     | Kept (`Looks`); the range is a proposal                                                                             |                                                                                                        |
| 여백 (margin)                        | Number field, %, 0 to 30, step 1                                                                         | 6                            | `margin`                                                  | 1     | Kept (`Looks`); the range is a proposal                                                                             |                                                                                                        |
| 외곽선 (outline)                     | Switch, then 두께 (width, px at 1080p, 1 to 10) and 색 (color)                                           | Off; 3 px, black             | `outline` becomes `{ on, width, color }`                  | 1     | Changed; `Looks` shows off; PP (Stroke width and color, S4 p. 65), EW (Outline tab, S10)                            | A fixed outline can't fit both a dark room and a camera picture. Open question 16.                     |
| 그림자 (shadow)                      | Switch, then 흐림 (blur, px, 0 to 40), 거리 (distance, px, 0 to 20), 불투명도 (opacity, %, 0 to 100), 색 | On; 8 px, 4 px, 60 %, black  | `shadow` becomes `{ on, blur, distance, opacity, color }` | 1     | Changed; `Looks` shows on; PP (Shadow blur, opacity, color, angle, offset, S4 p. 65), EW (Shadow tab, S10)          | Same reason. The angle stays fixed (down and right) to keep the controls few.                          |
| 출처 위치 (Bible reference position) | Select: 오른쪽 아래, 왼쪽 아래, 마지막 줄 다음, 숨김                                                     | 오른쪽 아래                  | `referencePosition`                                       | 1     | Changed: moved from 환경설정 > 성경; PP (a reference text box, or a line at the bottom of the verse box, S4 p. 142) | The lower third on the 방송 자막 and the full 본 화면 need different places.                           |
| 글자 뒤 상자 (box behind text)       | Switch, color, opacity, padding                                                                          | Off                          | `box`                                                     | Later | Changed: new; PP (Text Background, S4 p. 63)                                                                        | Helps a 하단 자막 over a busy camera picture. Waits until the 방송 자막 style is tried on real output. |

- The board shows only 기본. 현재와 다음 and 하단 자막 start as copies of 기본;
  하단 자막 uses 세로 위치 아래 and 크기 56 (proposal).

Font rules (proposal):

- The font select lists the bundled Pretendard first, then the fonts installed
  on this computer, by family.
- Every output font stack ends with the bundled Pretendard. A Latin-only font
  then draws Hangul with Pretendard, not with a random system font. Line breaks
  stay predictable.
- If a style's font isn't installed (for example, after restoring settings on
  another computer), the output draws with Pretendard. The style's font select
  and the Look row show the warning icon, with "글꼴이 없어 Pretendard로 표시
  중: (font name)" in the tooltip. This shows in place, like other problems of
  one item (08), instead of ProPresenter's Missing Font dialog (S6).
- There is no setting for the fallback font. Pretendard is always bundled, so a
  fixed fallback is always there.
- Capitalization options and right alignment aren't offered. ProPresenter has
  them (S4 pp. 64 to 65), but Korean lyrics don't use case, and lyrics aren't
  right-aligned.

#### Stage layouts

Stored in `stage-layouts.json`. The element defaults are those of 현재 가사 on
the `StageEditor` board. Changes apply to the output at once when the layout is
on the 무대 화면 (06).

| Row                                     | Control and range                                                              | Default                                                   | Stored in                       | Ver. | Basis                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------- | ---- | ---------------------------------------------------------------------------- |
| 배치 이름 (layout name)                 | Text; required, unique                                                         | 현재와 다음                                               | `layouts[].name`                | 1    | Kept (06)                                                                    |
| 캔버스 크기 (canvas size)               | Read-only                                                                      | 1920 × 1080                                               | `.width`, `.height`             | 1    | Kept (02, `StageEditor`); fixed in version 1 (proposal)                      |
| 요소 이름 (element name)                | Text                                                                           | The kind's name, for example 현재 가사                    | `..name`                        | 1    | Kept (06)                                                                    |
| 내용 종류 (content kind)                | Select of the seven kinds                                                      | Set by 요소 추가                                          | `..kind`                        | 1    | Kept (06)                                                                    |
| 보여 줄 것 (what to show, 장 elements)  | Segmented: 글자, 그림, 메모                                                    | 글자                                                      | `..show`                        | 1    | Kept (06, `StageEditor`)                                                     |
| X, Y, W, H                              | Number fields, px; X and Y 0 to the canvas size, W and H 20 to the canvas size | Per the default layout (02); 현재 가사 45, 100, 1194, 260 | `..frame`                       | 1    | Kept (06, `StageEditor`); the ranges are a proposal                          |
| 비율 고정, 격자에 맞추기                | Toggle buttons; the grid is 20 px                                              | Off, off                                                  | Not stored (editor state)       | 1    | Kept (06)                                                                    |
| Zoom                                    | Read-only percent; 화면에 맞춤 (Ctrl 0)                                        | Fit                                                       | Not stored                      | 1    | Kept (06)                                                                    |
| 글꼴, 굵기 (font, weight)               | Selects, as in the lyric style                                                 | Pretendard, 700                                           | `..text.font`, `..text.weight`  | 1    | Kept (06, `StageEditor`)                                                     |
| 크기 (size)                             | Number field, px, 12 to 300, step 1                                            | 72                                                        | `..text.size`                   | 1    | Kept (`StageEditor`); the range is a proposal                                |
| 글자색 (text color)                     | Swatch, hex value, color picker                                                | #FFFFFF                                                   | `..text.color`                  | 1    | Kept (`StageEditor`)                                                         |
| 가로 정렬, 세로 정렬                    | Segmented: 왼쪽, 가운데; 위, 가운데, 아래                                      | 왼쪽; 위                                                  | `..text.align`, `..text.vAlign` | 1    | Kept (`StageEditor`)                                                         |
| 줄 간격 (line spacing)                  | Number field, 0.8 to 3.0, step 0.05                                            | 1.3                                                       | `..text.lineHeight`             | 1    | Kept (`StageEditor`); the range is a proposal                                |
| 크기 자동 맞춤 (auto-fit size)          | Switch                                                                         | On                                                        | `..text.autoFit`                | 1    | Kept (`StageEditor`)                                                         |
| 모양 (appearance): 배경색, 불투명도     | Swatch with 없음; number field, %, 0 to 100                                    | 없음; 100                                                 | `..box`                         | 1    | Kept (06 proposal)                                                           |
| 시계 형식 (clock format, 시계 elements) | Segmented: 24시간, 12시간                                                      | 24시간 (03)                                               | `..clockFormat`                 | 1    | Changed: new row; PP (24 Hour checkbox on clocks and timers, S4 pp. 69, 126) |

#### Media properties

Stored per media item in `media.json` `items[].props`. Changes apply at once,
and live if the media is on output (05).

| Row                  | Control and range                                                       | Default                         | Stored in                 | Ver. | Basis                                            |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------- | ------------------------- | ---- | ------------------------------------------------ |
| 끝나면 (at the end)  | Segmented: 반복, 멈춤                                                   | From 환경설정 > 미디어 (반복)   | `.props.end`              | 1    | Kept (05, `Media`)                               |
| 구간 (range)         | Two time fields, m:ss.s; the start before the end, both within the file | The whole file                  | `.props.in`, `.props.out` | 1    | Kept (05, `Media`); the default is a proposal    |
| 속도 (speed)         | Number field, ×, 0.25 to 4.0, step 0.05                                 | 1.0                             | `.props.speed`            | 1    | Kept (05, `Media` 1.0×); the range is a proposal |
| 맞춤 (fit)           | Segmented: 맞추기, 채우기, 늘리기                                       | From 환경설정 > 미디어 (채우기) | `.props.fit`              | 1    | Kept (05, `Media`)                               |
| 소리 켜기 (sound on) | Switch                                                                  | From 환경설정 > 미디어 (off)    | `.props.audio`            | 1    | Kept (05); `Media` shows it off                  |
| 음량 (volume)        | Slider, 0 to 100; unavailable while the sound is off                    | 100                             | `.props.volume`           | 1    | Kept (05, `Media`); the default is a proposal    |

#### Other objects

Changes apply at once. The defaults apply when the operator creates the object.

| Object              | Row                                    | Control and range                                                                             | Default                      | Stored in               | Ver.  | Basis                                                                                                                             |
| ------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| 메시지 template     | 이름 (name)                            | Text; required                                                                                |                              | `templates[].name`      | 1     | Kept (02)                                                                                                                         |
| 메시지 template     | 아이콘 (icon)                          | Two icons: msg, user                                                                          | msg                          | `.icon`                 | 1     | Kept (02, `Overlays`)                                                                                                             |
| 메시지 template     | 문장 (sentence)                        | Text with `{blank}` marks; required                                                           |                              | `.text`                 | 1     | Kept (02)                                                                                                                         |
| 메시지 template     | 기본 보낼 화면 (default targets)       | Chips: 모든 화면, 본 화면, 무대, 방송 자막                                                    | 모든 화면                    | `.targets`              | 1     | Kept (02); the default is a proposal                                                                                              |
| 메시지 template     | 기본 표시 시간 (default display time)  | Segmented: 계속, 30초, 1분, 2분                                                               | 계속                         | `.duration`             | 1     | Kept (02, `Overlays`); the default is a proposal                                                                                  |
| 무대 메시지 presets | One line of text each                  | Text list                                                                                     | The seven `Overlays` presets | `stagePresets[]`        | 1     | Kept (02, `Overlays`)                                                                                                             |
| 공지 set            | 이름 (name)                            | Text; required                                                                                |                              | `sets[].name`           | 1     | Kept (02)                                                                                                                         |
| 공지 set            | 이미지 (images)                        | Ordered list of images; at least one                                                          |                              | `.media`                | 1     | Kept (02)                                                                                                                         |
| 공지 set            | 간격 (interval)                        | Number field, 초, 2 to 60, step 1                                                             | 8                            | `.interval`             | 1     | Kept (02); the default from `Overlays` ("8초"); the range is a proposal                                                           |
| 공지 set            | 반복 (loop)                            | Toggle                                                                                        | On                           | `.loop`                 | 1     | Kept (02); the default is a proposal                                                                                              |
| 공지 set            | 보낼 화면 (targets)                    | Chips: 본 화면, 무대, 방송 자막                                                               | 본 화면                      | `.targets`              | 1     | Kept (02); the default is a proposal                                                                                              |
| 소품                | 이름 (name)                            | Text; required                                                                                |                              | `props[].name`          | 1     | Kept (02)                                                                                                                         |
| 소품                | 내용 (content)                         | 그림 (an image from the media list) or 글자 (text with the lyric style rows)                  | 그림                         | `.content`              | 1     | Kept (02); the default is a proposal                                                                                              |
| 소품                | 보낼 화면 (targets)                    | Chips: 본 화면, 무대, 방송 자막                                                               | 본 화면                      | `.targets`              | 1     | Kept (02); the default is a proposal                                                                                              |
| 소품                | 자동 끄기, 한 번에 하나                | Seconds field; a switch per collection                                                        | Off                          | Not yet in 02           | Later | PP (Auto-clear Props, Single Prop Mode, version 17, S6)                                                                           |
| 타이머              | 이름 (name)                            | Text; required                                                                                |                              | `timers[].name`         | 1     | Kept (02)                                                                                                                         |
| 타이머              | 종류 (kind)                            | Select: 시각까지 (countdownTo), 정해진 시간 (countdown), 시각부터 (elapsedFrom), 시계 (clock) | 정해진 시간                  | `.kind`                 | 1     | Kept (02, 04); the names and the default are a proposal                                                                           |
| 타이머              | 시각 (time)                            | Time field, HH:mm, 24-hour                                                                    | The next full hour           | `.time`                 | 1     | Kept (02); the default is a proposal                                                                                              |
| 타이머              | 시간 (duration)                        | Duration field, 0:01 to 9:59:59                                                               | 5:00                         | `.duration`             | 1     | Kept (02); the default is a proposal                                                                                              |
| 타이머              | 0 지나면 (past zero)                   | Segmented: 계속 (keep counting), 멈춤 (stop)                                                  | 계속                         | `.overrun`              | 1     | Changed: new row; PP (Allows Overrun, S4 p. 122). 04 always counts past 0 with "-"; a countdown to the service start should stop. |
| 매크로              | 이름 (name)                            | Text; up to two lines on a tile                                                               | 새 매크로                    | `.name`                 | 1     | Kept (07)                                                                                                                         |
| 매크로              | 아이콘 (icon)                          | Grid of design system icons                                                                   | The first icon of the grid   | `.icon`                 | 1     | Kept (07); the default is a proposal                                                                                              |
| 매크로              | 색 (color)                             | Eight colors, no 없음                                                                         | teal                         | `.color`                | 1     | Kept (07, `MacroTile` README); the default is a proposal                                                                          |
| 매크로              | 동작 (actions)                         | Ordered list of actions (07)                                                                  | Empty                        | `.actions[]`            | 1     | Kept (07)                                                                                                                         |
| 매크로              | 시작할 때 실행 (run at startup)        | Checkable menu item                                                                           | Off                          | `.runOnStartup`         | 1     | Kept (07)                                                                                                                         |
| 매크로              | 예약 (schedule)                        |                                                                                               |                              | `.schedule`             | Later | Kept (07, 09)                                                                                                                     |
| 매크로 collection   | 이름, 매크로 list                      | Text; membership from the 모음 submenu                                                        |                              | `collections[]`         | 1     | Kept (07)                                                                                                                         |
| 이름표              | 이름 (name)                            | Text; required, unique                                                                        | The eight defaults (02)      | `labels[].name`         | 1     | Kept (02, 05)                                                                                                                     |
| 이름표              | 색 (color)                             | Eight colors or 없음                                                                          | Per the defaults (02)        | `.color`                | 1     | Kept (02, 05)                                                                                                                     |
| 이름표              | 바로 가기 키 (jump key)                | One bare letter or digit, stored as a `code`                                                  | Empty                        | `.key`                  | 1     | Decided (shortcuts); see "이름표 jump keys"                                                                                       |
| 퀵 실행 item        | 이름 (name)                            | Text; required                                                                                | The target's name            | `items[].name`          | 1     | Kept (02, 04)                                                                                                                     |
| 퀵 실행 item        | 대상 (target)                          | Set when the item is added: song, Bible passage, 소품, 타이머, 매크로, 검은 화면              |                              | `.kind`, `.ref`         | 1     | Kept (02, 04)                                                                                                                     |
| Bible passage       | 역본, 나누기, 참조, 절 번호, 역본 이름 | The Bible panel controls (04)                                                                 | From 환경설정 > 성경         | The `bible` object (02) | 1     | Kept (02, 04)                                                                                                                     |

- Not in this inventory: 예배 순서 item fields (구성, background override, start
  매크로, memo) and song fields. They are service and song content (05, 02), not
  settings.

### Remembered state (not settings)

The app remembers these without a settings row. They live in `app.json`
(proposal, extends 02):

- Main window position, size, and maximized state.
- The position and size of each window-method output window.
- The 환경설정 window size and its last page.
- Column widths and thumbnail columns per size class (Kept, 02).
- The large preview screen, the media strip state, the 매크로 view and
  collection (Kept, 02).
- The last 진행 도구 tab, and the collapsed left column in narrow windows (04).
- The last service (Kept, 02), recent Bible passages (Kept, `bible.json`).
- The last text import options (see 가져오기).

### Fixed behaviors

These stay fixed, with no setting, because a fixed behavior is safer during a
service or because no operator needs another behavior.

| Behavior                                                                                                                                                               | Reason                                                                                                                                                                     | Source                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| A click outputs at once, with no confirmation and no cue mode.                                                                                                         | Decided.                                                                                                                                                                   | 01, product log version 61 |
| F1 to F7 clear wherever the focus is, even with a dialog open or in a text field.                                                                                      | The way out of any mistake must always work.                                                                                                                               | 03, `ClearButton` README   |
| While any output is on, Windows doesn't put the display or the system to sleep, and the screen saver doesn't start.                                                    | Replaces the 절전 막기 switches in `Prefs` and `Screens`. No service is better with sleep allowed.                                                                         | 08                         |
| The mouse cursor is hidden over full screen output windows.                                                                                                            | OBS makes it a setting (S11). No operator needs a cursor on the projector.                                                                                                 | 03                         |
| Output windows never show dialogs, menus, tooltips, or notifications.                                                                                                  | Decided.                                                                                                                                                                   | 03, 08                     |
| Songs, services, 틀, and settings save on every change. No interval.                                                                                                   | Replaces the `Prefs` autosave interval (README open question 2).                                                                                                           | 02                         |
| The output state recovery dialog opens after every crash.                                                                                                              | Decided.                                                                                                                                                                   | 08                         |
| The app never needs the network, sends nothing out, and has no telemetry.                                                                                              | Decided.                                                                                                                                                                   | `docs/TECH.md`             |
| No automatic updates. When an updater comes, it never checks, downloads, or asks while any output is on.                                                               | Decided.                                                                                                                                                                   | `docs/TECH.md`, 08         |
| Automatic backup runs once a day at launch, never while an output is on.                                                                                               | Decided.                                                                                                                                                                   | 02, 08                     |
| Quitting (Ctrl Q, Alt F4, the close button) while any output is on asks: "화면 출력이 켜져 있습니다. 종료할까요?" with 취소 and 종료.                                  | Quitting can't be undone (design principle 6). OBS warns about active outputs on exit as a setting (S11); here it's always on.                                             | Proposal                   |
| Live commands ignore key repeat.                                                                                                                                       | Holding a key must not run through a song.                                                                                                                                 | Proposal                   |
| The app opens in the 진행 workspace with the last service.                                                                                                             | Decided.                                                                                                                                                                   | 01, 04                     |
| Text that overflows shrinks to fit. A 장 never splits.                                                                                                                 | ProPresenter offers four scaling modes (S4 p. 65); one predictable rule is enough for lyrics.                                                                              | 03                         |
| A missing font falls back to the bundled Pretendard.                                                                                                                   | See "Lyric styles and fonts".                                                                                                                                              | Proposal                   |
| Deleting a song, service, or 틀 moves its file to the Windows Recycle Bin.                                                                                             | Recovery copies cover overwrites (02), not deletes. The Recycle Bin gives a way back without a new feature.                                                                | Proposal                   |
| After the operator relinks one missing media file, the app looks for the other missing files from the same old folder in the new folder and relinks the ones it finds. | A moved media drive breaks many files at once. ProPresenter has a Search Paths setting for this (S4 p. 190); doing it automatically needs no row.                          | Proposal (refines 08)      |
| F2 never renames.                                                                                                                                                      | F2 clears lyrics (S1).                                                                                                                                                     | Proposal                   |
| The app sets no Electron application menu, so Electron's default reload, developer tools, zoom, and full screen keys never respond.                                    | Electron creates a default menu when an app sets none (S17). A reload of the control window during a service must never happen by a key. The design system fixes the zoom. | Proposal                   |
| One instance of the app runs at a time.                                                                                                                                | Decided (proposal in 01).                                                                                                                                                  | 01                         |
| Output windows aim for 60 fps.                                                                                                                                         | Decided.                                                                                                                                                                   | `docs/TECH.md`             |
| Notifications follow 08 (where, how long, how many).                                                                                                                   | Decided.                                                                                                                                                                   | 08                         |

### Rejected candidates

Settings considered and left out, with the reason.

| Candidate                                                     | Seen in                                      | Reason                                                                                                                                                       |
| ------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 자동 저장 간격 (autosave interval)                            | `Prefs`                                      | The app saves on every change (02).                                                                                                                          |
| 오류 보고, 사용 통계 보내기 (crash reports, analytics)        | `Prefs`, PP General (S4 p. 170)              | No server. Crash records stay on this computer (`docs/TECH.md`).                                                                                             |
| 출력 중 절전 막기 (switch)                                    | `Prefs`, `Screens`                           | Fixed on.                                                                                                                                                    |
| 시작할 때 (on launch select)                                  | `Prefs`                                      | One option. Fixed: open the last service.                                                                                                                    |
| 출력 창 항상 위, 화면 연결이 끊기면 in 환경설정               | `Prefs`                                      | Per screen in 화면 설정. Version 1 can't add screens, so defaults for new screens do nothing.                                                                |
| 출력 창 커서 숨기기                                           | OBS (S11)                                    | Fixed on.                                                                                                                                                    |
| 성능 통계 출력 화면에 표시 (performance statistics on screen) | PP Screens (S4 p. 172)                       | The status bar shows the frame rate. Output windows never show UI.                                                                                           |
| 배경색 무시 (ignore background colors)                        | PP Screens (S4 p. 172)                       | 장 have no background colors here.                                                                                                                           |
| Keynote and PowerPoint screens                                | PP Screens (S4 p. 172)                       | Not applicable.                                                                                                                                              |
| House of Worship integrations                                 | PP General (S4 p. 170)                       | One church; every feature is for worship.                                                                                                                    |
| 로고 and Clear to Logo                                        | PP General (S4 pp. 170 to 171)               | A 소품 with the logo image does this, from 퀵 실행 or a 매크로 (04, 07).                                                                                     |
| 저작권 표시 (copyright display)                               | PP General and Copyright Display (S4 p. 152) | Song files have no copyright fields. A later decision with the song format.                                                                                  |
| 동기화 (sync)                                                 | PP Sync (S4 p. 182)                          | One computer. Backups cover copies.                                                                                                                          |
| Resi, Planning Center, SongSelect                             | PP Resi and Services (S4 pp. 184 to 186)     | No outside services. OBS streams.                                                                                                                            |
| 오디오 채널 수, 라우팅, 지연, 마스터 음량                     | PP Audio (S4 pp. 187 to 188)                 | The mixer does this. Lip sync doesn't apply without cameras.                                                                                                 |
| Alt-click to cue video                                        | PP Advanced (S4 p. 189)                      | No cue mode (01).                                                                                                                                            |
| Foreground media behavior toward the audio layer              | PP Advanced (S4 p. 189)                      | Later. In version 1 a 매크로 does it (오디오 페이드 아웃 plus 배경 미디어). It adds pause and resume rules across clears and undo that need their own tests. |
| 미디어 검색 경로 (search paths)                               | PP Advanced (S4 p. 190)                      | Later. Version 1 relinks by folder automatically (see "Fixed behaviors").                                                                                    |
| 테마 (light or dark)                                          | OBS Appearance (S11)                         | One dark theme for a dark room (design system).                                                                                                              |
| UI 글꼴 크기, 확대 (UI font size, zoom)                       | OBS Appearance font size (S11)               | The design system fixes sizes. Windows display scaling covers larger text.                                                                                   |
| 프로세스 우선순위 (process priority)                          | OBS Advanced (S11)                           | Outputs run in their own processes (`docs/TECH.md`). A higher priority would hide performance problems instead of fixing them.                               |
| 전역 단축키 (shortcuts while the app isn't focused)           | OBS Hotkey Focus Behavior (S11)              | Later (연결 page). In version 1 it would take keys from OBS on the same computer.                                                                            |
| 장 번호로 가기 (number plus Enter)                            | EW (S9)                                      | Digits are jump keys. Positions change with each 구성.                                                                                                       |
| 다중 레이어 지우기 (Clear Groups)                             | PP (S3, S7)                                  | Decided out of version 1 (07).                                                                                                                               |
| Look 순환 key (next Look)                                     | None                                         | Cycling outputs a Look the operator didn't pick. Each Look has its own command.                                                                              |
| 장 축소판 배경색 (thumbnail background color)                 | PP Grid view settings (S4 p. 12)             | Thumbnails show only the lines (04).                                                                                                                         |
| 끝난 항목 흐리게 끄기 (turn off dimming of done items)        | None                                         | A shape-only state that never hides anything.                                                                                                                |
| 시작 매크로 실행 끄기 (turn off start 매크로)                 | None                                         | Another way for a service to go wrong. Remove the 매크로 from the item instead.                                                                              |
| 대체 글꼴 선택 (fallback font choice)                         | None                                         | Pretendard is always bundled.                                                                                                                                |
| 대소문자, 오른쪽 정렬 (capitalization, right alignment)       | PP text tab (S4 p. 64)                       | Korean lyrics don't use case, and lyrics aren't right-aligned.                                                                                               |
| Copy and paste text style                                     | PP (S1)                                      | Lyric styles hold the formatting; there is nothing to copy between 장.                                                                                       |
| Import and export of shortcuts                                | None                                         | The automatic backup copies the settings folder.                                                                                                             |

## Storage changes for 02

If the user accepts this proposal, 02 changes like this:

| File                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preferences.json`   | Add `general.launchAtLogin`, `output.transition.slide.{kind, seconds}`, `output.transition.media.{kind, seconds}`, `show.atLastSlide`, `show.audio.transitionSeconds`, `show.audio.fadeOutSeconds`, `bible.defaults.{split, reference, translationName}`, `import.txt.perSlide.*`, `import.txt.symbol`, `media.copyOnImport`, `media.defaults.{end, fit, audio}`, `media.audioOutput`, `media.previewOutput`. Rename `showOnLaunch`, `previewFps`, and `hardwareAcceleration` under `output.`, and `bible.verseNumbers` to `bible.defaults.verseNumbers`. Remove `output` `preventSleep`, `alwaysOnTop`, `onDisconnect`, and `bible.sourcePosition`. |
| `shortcuts.json`     | Bindings store `{ code, mods }` instead of display names.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `labels.json`        | `.key` stores a `code` string.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `looks.json`         | Lyric style adds `letterSpacing` and `referencePosition`; `outline` becomes `{ on, width, color }`; `shadow` becomes `{ on, blur, distance, opacity, color }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `stage-layouts.json` | The clock element adds `clockFormat` (`"24h"` or `"12h"`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `timers.json`        | Add `.overrun` (Boolean, default true).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `screens.json`       | Remove `.preventSleep`. Defaults of `.alwaysOnTop` depend on the method.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `app.json`           | Add the window bounds and states listed in "Remembered state". `backupPath` gets a default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Bible passage object | `reference` adds `"last"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Because version 1 hasn't shipped, these are changes to the version 1 schema, not
migrations.

## What this proposal would replace

| Place                                                                  | What changes                                                                                                                                                                                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 06 "환경설정 window": the page list                                    | Pages become 일반, 출력, 진행, 라이브러리, 성경, 가져오기, 미디어, 단축키, 정보 (업데이트 waits).                                                                                                                          |
| 06 "환경설정 window": 일반 언어, 시작할 때, 자동 저장, 복구 사본, 보고 | Language waits, 시작할 때 becomes fixed, 자동 저장 and 보고 are rejected, 복구 사본 moves to 라이브러리.                                                                                                                   |
| 06 "환경설정 window": 출력 안정성 row                                  | Removed (fixed prevent sleep; per-screen values in 화면 설정).                                                                                                                                                             |
| 06 "환경설정 window": 라이브러리 위치 곡                               | Becomes 데이터 폴더.                                                                                                                                                                                                       |
| 06 "환경설정 window": 성경 표시 rows                                   | Become defaults for new passages; 출처 위치 moves to the lyric style.                                                                                                                                                      |
| 06 "환경설정 window": 업데이트 page                                    | Becomes the 정보 page.                                                                                                                                                                                                     |
| 06 "Screen properties": 절전 막기                                      | Removed.                                                                                                                                                                                                                   |
| 06 "Look editor": lyric style properties                               | Adds 굵기, 글자 간격, outline and shadow details, 출처 위치.                                                                                                                                                               |
| 06 "Shortcuts": "Where shortcuts work" and "Default shortcuts"         | Replaced by "Shortcut system" in this file (decided 2026-10-25).                                                                                                                                                           |
| 04 "Keyboard" and "Keyboard summary for 진행"                          | Decided: add Page Down and Page Up, 다음 항목, and the rule for → when another item is open; ← → and Space in the 장 grid go to the live commands (focus precedence rule 5); next on the last 장 becomes the 진행 setting. |
| 07 "Keyboard" (매크로 tiles)                                           | Decided: kept, but it applies only to keyboard focus, which a mouse click in 진행 no longer gives (focus precedence).                                                                                                      |
| `SlideThumbnail` README (design system)                                | Decided: in 진행, ← → and Space go to 다음 장 and 이전 장; the grid keeps ↑ ↓ and Enter.                                                                                                                                   |
| Design system component behavior in 진행                               | Decided: a mouse click on a button or tile doesn't move keyboard focus; text fields, the 장 grid, and the 예배 순서 list still take it.                                                                                    |
| 02 `shortcuts.json` and `labels.json`                                  | Decided: keys are stored as `code` values (see "Storage changes for 02").                                                                                                                                                  |
| 03 "Transitions"                                                       | Fixed defaults become 환경설정 > 출력 > 전환.                                                                                                                                                                              |
| 02 "App-wide settings"                                                 | See "Storage changes for 02".                                                                                                                                                                                              |
| README open questions 2, 12, 14, 19, 24                                | Answered by this proposal (autosave, media copy, output stability defaults, reports and updates, transitions).                                                                                                             |

## Follow-up work

For the shortcut part now, and for the settings part once the user decides:

- Boards: see "Boards this proposal needs".
- Design system (ui): add Page Up, Page Down, Home, End, and Delete to the
  `KeyCap` key names; change the 진행 grid keys in the `SlideThumbnail` README
  (focus precedence rule 5); make buttons and tiles in 진행 not take keyboard
  focus on a mouse click; and give number fields a step (see "Design system
  note: number field steps").
- Spec: update 02, 03, 04, and 06 as "What this proposal would replace" says,
  and move the answered README open questions.
- Code: the command registry types and the key matcher go in `src/shared/`,
  which data owns (`docs/MILESTONES.md`, "File ownership"). The member who
  builds shortcuts sends data the shapes first.

### Design system note: number field steps

For the ui member. The `TextField` README says the arrow keys change a number
field by 1, or by 10 with Shift. That breaks every field with a fractional
value: the transition and audio seconds in this proposal (0.2 s), and two fields
that already exist, 줄 간격 in the lyric style (1.4, 06) and 속도 in the media
properties (1.0×, 05). Proposed addition to the number variant:

- **Step.** A field has a `step` (default 1) and a `largeStep` (default 10 times
  the step). ↑ and ↓ add or subtract one step, Shift with ↑ or ↓ one large step.
- **Decimals.** The field shows as many decimals as the step has: step 0.1 shows
  "0.2", step 0.05 shows "1.40", step 1 shows "10". Tabular numbers and right
  alignment stay.
- **Typing.** The field accepts digits, one ".", and a leading "-" when the
  range allows negatives. When focus leaves, it rounds to the nearest step and
  then snaps into the range, as the README already says for the range.
- **No float drift.** Count in whole steps (value divided by step, rounded), so
  that 0.1 plus 0.2 shows "0.3", never "0.30000000000000004".
- **Unit.** One short unit outside the field, as today: "초" for seconds. A unit
  that is part of the value stays attached, such as "%" or "×".

| Field                 | Step | Large step | Range       | Unit |
| --------------------- | ---- | ---------- | ----------- | ---- |
| 장 전환 시간 (10)     | 0.1  | 1          | 0.1 to 2.0  | 초   |
| 배경 전환 시간 (10)   | 0.1  | 1          | 0.1 to 3.0  | 초   |
| 오디오 전환 (10)      | 0.1  | 1          | 0 to 5      | 초   |
| 페이드 아웃 시간 (10) | 0.5  | 5          | 0.5 to 10   | 초   |
| 줄 간격 (06)          | 0.05 | 0.5        | 0.8 to 3.0  | none |
| 속도 (05)             | 0.05 | 0.5        | 0.25 to 4.0 | ×    |
| 글자 간격 (10)        | 1    | 10         | -10 to 20   | %    |

- API sketch:
  `<TextField variant="number" value={0.2} step={0.1} largeStep={1} min={0.1} max={2} unit="초" />`.
- The ranges for 줄 간격 and 속도 are proposals; 05 and 06 don't give them.

### Boards this proposal needs

The boards that change or are added: the shortcut rows now, the settings rows
once the user decides. Each row names the design system components it uses, so
the board uses only what the system has. Rows that depend on an open question
say which one.

| Board                        | New or changed | What it must show                                                                                                                                                                                                                                                                                        | Components                                                                                  | Depends on                |
| ---------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------- |
| `Prefs`: page list           | Changed        | The left list with 일반, 출력, 진행, 라이브러리, 성경, 가져오기, 미디어, 단축키, 정보. 업데이트 goes away.                                                                                                                                                                                               | `ListRow`, `MenuBar` (secondary title bar)                                                  | Open question 11          |
| `Prefs` 일반                 | Changed        | One 시작 group with the Windows 시작할 때 실행 switch. No 앱, 저장, or 보고 group.                                                                                                                                                                                                                       | `PropertyRow`, `Switch`                                                                     | Open question 11          |
| `Prefs` 출력                 | Changed        | 시작 (switch), 전환 (two segmented controls with their seconds fields, once with 디졸브 and once with 없음 so the hidden field shows), 미리보기 (select), 성능 (switch). No 안정성 group.                                                                                                                | `PropertyRow`, `Switch`, `SegmentedControl`, `TextField` (number), `Select`                 | Open questions 12, 10     |
| `Prefs` 진행                 | New            | 장 넘기기 (segmented 멈춤, 다음 항목) and 오디오 (two seconds fields).                                                                                                                                                                                                                                   | `PropertyRow`, `SegmentedControl`, `TextField` (number)                                     | Open question 3 (decided) |
| `Prefs` 라이브러리           | Changed        | 위치: 데이터 폴더 and 미디어 폴더 as path rows with 바꾸기 and 폴더 열기. 백업: switch, path, 보관, 마지막 백업 with 지금 백업, also in its unavailable state with the tooltip. 복구 사본: number field.                                                                                                 | `PropertyRow`, `TextField` (path, number), `Button`, `Switch`, `Tooltip`                    | Open question 18          |
| `Prefs` 성경                 | Changed        | 설치된 역본 list as today. 새 구절: 나누기 and 참조 selects, 절 번호 and 역본 이름 switches, 한 장 최대 줄 수. No 출처 위치 row.                                                                                                                                                                         | `ListRow`, `PropertyRow`, `Select`, `Switch`, `TextField` (number)                          | Open question 17          |
| `Prefs` 가져오기             | Changed        | 텍스트: 장 나누기, 한 장에, 기호 (short text field), 이름표 인식, 클립보드 첫 줄, 글자 인코딩. No pptx group in version 1.                                                                                                                                                                               | `PropertyRow`, `Select`, `TextField`                                                        |                           |
| `ImportText`: option bar     | Changed        | When 장 나누기 is 기호, a short text field for the symbol follows the option (05), with the value from 환경설정 > 가져오기 (default "/"); the dialog saves the options it last used back to the same fields, so the page and the dialog share them. Two states: 빈 줄 (no field) and 기호 (field shown). | `Dialog` (option bar), `SegmentedControl` or `Select`, `TextField` (sm)                     | README open question 25   |
| `Prefs` 미디어               | New            | 가져오기 (switch), 새 미디어 (two segmented controls and a switch), 소리 (two device selects). One state shows a missing device: the warning icon on the row, the reason in a tooltip.                                                                                                                   | `PropertyRow`, `Switch`, `SegmentedControl`, `Select`, the `warning` icon, `Tooltip`        | Open questions 14, 15     |
| `Prefs` 정보                 | New            | 현재 버전 (read-only), 기록 폴더 (폴더 열기), 진단 정보 (복사), 자세한 기록 (switch).                                                                                                                                                                                                                    | `PropertyRow`, `Button`, `Switch`                                                           |                           |
| `Prefs`: page reset          | New            | 기본값으로 at the bottom of a page, and its confirmation dialog.                                                                                                                                                                                                                                         | `Button`, `AlertDialog`                                                                     |                           |
| `Shortcuts`                  | Changed        | Every group of "Command list" plus the 이름표 group, scrolled; per-object rows under Look, 진행 도구 (소품, 매크로, 타이머); the states default, changed, conflict, none, and recording; the key field refusing a reserved key, with the reason in its tooltip; the bottom bar with the default key.     | `KeyCap`, `TextField` (key input), `SegmentedControl` (filter counts), `ListRow`, `Tooltip` | None (decided)            |
| `Shortcuts`: reset all       | New            | The confirmation dialog of 모두 기본값으로 ("단축키를 모두 기본값으로 되돌릴까요?", 취소, 되돌리기).                                                                                                                                                                                                     | `AlertDialog`                                                                               |                           |
| `Looks`: lyric style         | Changed        | The property grid adds 굵기 (select), 글자 간격 (number), 외곽선 (switch, width, color), 그림자 (switch, blur, distance, opacity, color), 출처 위치 (select). One state shows a missing font: the warning icon on the font select, the reason in a tooltip.                                              | `PropertyRow`, `Select`, `TextField` (number), `Switch`, the `warning` icon, `Tooltip`      | Open question 16          |
| `Looks`: 메시지 style        | New            | Where the 메시지 style is chosen per screen and edited.                                                                                                                                                                                                                                                  | To decide                                                                                   | Open question 13          |
| `StageEditor`: clock element | Changed        | The 시계 element's properties add 시계 형식 (segmented 24시간, 12시간).                                                                                                                                                                                                                                  | `PropertyRow`, `SegmentedControl`                                                           |                           |
| `Screens`: screen properties | Changed        | The 안정성 group without 절전 막기. The 방송 자막 capture window example shows 항상 위 off.                                                                                                                                                                                                              | `PropertyRow`, `Switch`, `Select`                                                           | Open question 10          |
| Quit while an output is on   | New            | The confirmation dialog "화면 출력이 켜져 있습니다. 종료할까요?" with 취소 and 종료, over the main window.                                                                                                                                                                                               | `AlertDialog`                                                                               |                           |
| Empty data folder            | New            | The confirmation dialog "새 폴더가 비어 있습니다. 지금 데이터를 복사할까요?" with 취소, 복사하지 않음, and 복사.                                                                                                                                                                                         | `AlertDialog`                                                                               |                           |
| 타이머 editor                | Changed later  | The 0 지나면 choice (계속, 멈춤) joins the 타이머 editor once a board draws that editor (README open question 16).                                                                                                                                                                                       | `SegmentedControl`                                                                          | README open question 16   |

- No board changes for keys that only live in tooltips and menus (for example
  "다음 배경 Alt →"). The `Tooltip` and `Menu` components already show the
  shortcut text, and they read it from the command registry.

## Open questions

Questions 1 to 9 were decided on 2026-10-25 by the shortcut decision (see
"Decision status"). Questions 10 to 18 stay open; until the user decides, the
proposal's choice applies.

| #   | Topic                                  | Question                                                                                                                      | State and what applies                                                                                                                                                                        |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Ctrl S                                 | ProPresenter uses Ctrl S for Show Mode on Windows (S1). Windows users press Ctrl S to save by habit, and the app has no save. | Decided, follows ProPresenter: Ctrl S opens 진행. In the imported song editor, the only place with 저장, Ctrl S runs 저장 (no ProPresenter source found for that case).                       |
| 2   | 진행 grid and list keys                | The `SlideThumbnail` README says the arrow keys move between thumbnails, and Enter and Space act as a click.                  | Decided, follows ProPresenter (S4 p. 70): in 진행, → ← Space Page Up Page Down go to the live commands, and focus precedence rule 5 applies. The `SlideThumbnail` README changes (follow-up). |
| 3   | Next on the last 장                    | 04 proposed moving into the next item, as a guess about ProPresenter.                                                         | Decided, no ProPresenter source found: a 진행 setting, default 멈춤.                                                                                                                          |
| 4   | 이름표 jump key defaults               | 02 starts with no jump keys.                                                                                                  | Decided, no ProPresenter source found for default group hot keys: they start empty.                                                                                                           |
| 5   | → after picking another item           | 04's next and previous follow the current item.                                                                               | Decided, no ProPresenter source found: when the 장 panel shows another item, → outputs its first tile.                                                                                        |
| 6   | Keys for each 소품, 매크로, and 타이머 | ProPresenter maps keys to Props and Macros (S3).                                                                              | Decided, follows ProPresenter for 소품 and 매크로; 타이머 follow the same pattern (no ProPresenter source found). Version 1, no default keys.                                                 |
| 7   | Presentation remote F5 button          | Remotes alternate F5 and Esc on one button (S16).                                                                             | Decided, follows ProPresenter: F5 stays 오디오 지우기 (S1). The 단축키 page can move it.                                                                                                      |
| 8   | Stored key format                      | 02 stores display names such as `["Ctrl", "1"]`.                                                                              | Decided: keys are matched and stored by physical key (`code`).                                                                                                                                |
| 9   | Key names                              | The `KeyCap` README doesn't name Page Up, Page Down, Home, End, or Delete.                                                    | Decided: English, as Windows writes them.                                                                                                                                                     |
| 10  | Prevent sleep                          | The `Prefs` and `Screens` boards show switches.                                                                               | Open. Proposal: remove both switches; always on while any output is on.                                                                                                                       |
| 11  | The 일반 page                          | Language and on launch have one option each.                                                                                  | Open. Proposal: hide them; add launch with Windows.                                                                                                                                           |
| 12  | Transitions                            | Global like ProPresenter's master transitions (S4 p. 166), or per Look? Should clears fade with the layer's transition?       | Open. Proposal: global in 환경설정 > 출력; clears and Look changes stay instant (03).                                                                                                         |
| 13  | 메시지 appearance                      | No document says which font, size, position, or background a 메시지 uses.                                                     | Open. Proposal: a 메시지 style chosen per screen in the Look, like the lyric style, specified after the user decides.                                                                         |
| 14  | Sound of new videos                    | Background loops often have music; announcement videos need sound. The `Media` board shows 소리 켜기 off.                     | Open. Proposal: new videos import with sound off.                                                                                                                                             |
| 15  | Copy media on import                   | ProPresenter's default is off (S4 p. 190). The `Media` board implies copying.                                                 | Open. Proposal: a switch, default on.                                                                                                                                                         |
| 16  | Outline and shadow detail              | The board shows two switches.                                                                                                 | Open. Proposal: add width and color, and blur, distance, opacity, and color.                                                                                                                  |
| 17  | Bible reference options                | 02 has every, first, and none. ProPresenter has each, last, and none (S4 p. 142).                                             | Open. Proposal: offer all four.                                                                                                                                                               |
| 18  | 지금 백업 during a service             | 08 forbids automatic backups during a service, but says nothing about a manual one.                                           | Open. Proposal: 지금 백업 is unavailable while any output is on.                                                                                                                              |
