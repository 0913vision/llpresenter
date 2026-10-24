# Handoff

Last updated: October 24, 2026, by the phase 0 (handoff) session.

## What we're building

LoveLight Presenter is a lyrics app for church services. The operator follows
the service from a dark room and, with one click, changes what several screens
show: the 본 화면 (main screen), the 무대 화면 (stage screen), and the 방송 자막
(broadcast captions). The app shows lyrics one 장 (slide) at a time over a
looping background video, uses different content and text layout on each screen,
and shows messages and notices on one screen or on all screens. Stability and
smooth operation matter more than the number of features. It's non-profit, used
only inside one church, and there's no plan to distribute it.

## Current state

| Item                             | State                                                                                                          | Location                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| UI drafts                        | Final (version 65)                                                                                             | [Drafts artifact](https://claude.ai/artifact/4Z4M7wLUjyxs5iqLzkeXct), source in `design/drafts/`        |
| Design system                    | Final (version 3): principles, tokens, window size rules, 30 components                                        | [Design system artifact](https://claude.ai/artifact/LDSJg1gwuFymJBuTbVEBQP), source in `design/system/` |
| Feature spec                     | Written                                                                                                        | `docs/spec/`                                                                                            |
| Technical decisions              | Written                                                                                                        | `docs/TECH.md`, `docs/decisions.md`                                                                     |
| Implementation plan and workflow | Written                                                                                                        | `docs/PLAN.md`, `docs/WORKFLOW.md`, `docs/STATUS.md`                                                    |
| App code                         | Initial frame on `rewrite`: shared live state and commands, main-process store, IPC, logging, and the shell UI | `src/`, progress in `docs/STATUS.md`                                                                    |

Both artifacts open only in the user's account. Sessions read the copies in the
repository (`design/`).

## Decisions

### Structure

- There are three workspaces: 진행 (Show), 준비 (Prep), and 화면 설정 (Screen
  settings). The library exists only in 준비. The left column of 진행 holds the
  예배 순서 (service order) and 퀵 실행 (quick launch).
- There are three screens: 본 화면, 무대 화면, and 방송 자막. The lobby screen
  isn't used for now.
- The 진행 workspace is a compromise: the ProPresenter-style layout (icon
  toolbar, large preview, 지우기 (clear) row, and 진행 도구 (show tools) split
  into tabs) plus small previews of the other screens and a 표시 중 (Showing)
  tab.
- As in ProPresenter, clicking a 장 outputs it immediately. There's no step that
  cues content before output.
- The main process owns the live output state, and each screen has a Look (which
  layers to show and the lyric style). The 지우기 keys are F1 for everything, F2
  for lyrics, F3 for media, F4 for props, F5 for audio, F6 for messages, and F7
  for notices.
- Multi-layer clearing (ProPresenter's Clear Groups) isn't in v1. To clear
  several layers at once, use a macro's clear action. If needed, attach that
  macro to a 예배 순서 item as its start macro.

### Data

- A song is one file in our own format, `.llsong` (JSON). It holds the title,
  the 장 (each with a list of lines and an 이름표 (label), which may be empty),
  the ID of the default background media, and named 구성 (arrangements). The
  default 구성 is the 장 order in the file.
- 이름표 colors are stored in the app's 이름표 list, not in song files. You
  choose from eight muted colors that the user picked, or none.
- A 예배 순서 is one `.llservice` file and holds only items (name, date, items).
  A song item holds a song ID, a 구성 name, the background for this service, a
  start macro, and a memo.
- Screens, Looks, stage layouts, macros, 퀵 실행, messages, notices, props, and
  timers exist once for the whole app (the ProPresenter way). To change how the
  screens look for each service, keep several Looks and switch between them with
  an item's start macro.
- Saving is automatic (on every change). There's no 저장 (Save) button. The only
  exception is an imported song: it enters the library only after you edit it
  and click 저장.
- After a crash, the last 예배 순서 opens as it was, and a recovery dialog asks
  only about the live output state (the screens that were on, the last 장, and
  the items that were showing).
- Unknown fields are preserved, so that items added later, such as sheet music,
  don't conflict with existing files.

### 준비 features

- You create a new service from a blank service, a 틀 (template; ProPresenter's
  Playlist Template), or a past service, and choose the items to bring in.
- You can pick 예배 순서 items from another service and add them to the end of
  the current 예배 순서 (our own addition).
- You switch 예배 순서 from the list that opens when you click the name in the
  예배 순서 header.
- Import has separate entries under 가져오기 (Import) in the 파일 (File) menu:
  텍스트 파일 (Text file), 클립보드 텍스트 (Clipboard text), and PowerPoint 파일
  (PowerPoint file, later). Files are imported one at a time, and for each
  result you choose 버리기 (Discard) or 편집 (Edit). If a song with the same
  title exists, the title field gets a red border, and saving asks you to choose
  덮어쓰기 (Overwrite), 새 곡으로 저장 (Save as new song), or 취소 (Cancel).

### Output and external connections

- The goal for 방송 자막 is to send it to OBS over NDI with the alpha channel
  on. A capture window with a green background is the fallback. The preview
  background inside the app is green by default (black or a checkerboard can be
  chosen). The app doesn't broadcast. OBS does the broadcasting.
- The NDI SDK is free to use on these conditions: non-profit, used only inside
  one church, and not distributed. If we ever distribute the app, recheck the
  SDK redistribution terms and the NDI trademark notice.
- Bible verses are looked up directly in the 퀵 실행 input field. The text is
  built in (offline), and we reuse the logic in the user's repository
  github.com/0913vision/copible (local `D:\programming\copible`). Translations
  start with 개역한글 (Korean Revised Version) and the KJV. For 개역개정 (New
  Korean Revised Version), we must confirm permission from 대한성서공회 (the
  Korean Bible Society).

### Design

- The design system is the reference. There are two blues: `accent` (#3d8bf0)
  for lines and focus, and `accent-fill` (#2a70dc) for surfaces such as primary
  buttons. Buttons and input fields are 26 high inside panels and 30 high in
  dialogs and settings.
- There are three window size ranges (after Windows scaling): narrow from 1280,
  normal from 1600, and wide from 2400. The minimum window size is 1280×720.
- Use red only for what is being output right now.

### Deferred (the v1 structure stays open for them)

- Sheet music display (for the congregation screen, method undecided),
  PowerPoint import, NDI output, camera input (as in ProPresenter, input devices
  registered app-wide and used as media, actions, and 장 elements), and an
  installer.

## User preferences

- Reply in polite Korean (합니다체). Don't use a playful tone. Never use middle
  dots (·) or em dashes (—) anywhere.
- The user dislikes common, AI-looking UI. Don't add explanatory text or
  needless chips and badges.
- Say that something follows ProPresenter only when you actually checked it.
- Settle the drafts and the design before code, and check them at real screen
  sizes before you move on.
- Every session runs with permission prompts turned off. Work sessions each work
  in their own worktree and rebase their own branch, and the lead merges their
  work fast-forward only.
- The rules for code, comments, formatting, documents, and commit messages are
  in `CLAUDE.md`. The user set them and expects every session to follow them.

## Open questions

- Whether we have permission to use 개역개정.
- How to show sheet music (images, MusicXML, and so on).
- Git for Windows is old (2.35.2). We recommend upgrading to the latest version
  (the user decides).
- Whether to add Codex as a read-only outside reviewer from phase 3 on (not
  urgent).

## History

- The conversation and draft work through phase 0 are in the Claude app session
  "프로프리젠터 프로젝트 찾기" (Find the ProPresenter project), and that session
  continues as the lead. The draft and design system sources are in `design/`,
  so work can continue even without that session.
- The product decisions from the drafts phase are in `docs/product-log.md`.
