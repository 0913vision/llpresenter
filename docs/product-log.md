# Product log

This is the running record of product decisions from the drafts phase
(2026-10-23 to 2026-10-24), moved here from the lead's notes so that every
session can read it. "Version N" means version N of the drafts artifact. A later
entry overrides an earlier one, even when it appears higher in the file. New
decisions go into `docs/decisions.md`.

Since 2026-10-23 the user is rebuilding their old 2024 Electron/React lyrics
presenter (`<main checkout>`, GitHub 0913vision/llpresenter) from scratch on
branch `rewrite`; the old code stays on `main` as reference only. Stack:
Electron + electron-vite + React + TypeScript, Zustand, Pretendard. App code is
paused until the drafts settle.

Must-haves they named: different content per monitor, lyrics stepped over a
looping background video, a different text layout per monitor,
messages/announcements to specific screens or all screens. Stability and UI/UX
fluency matter more than feature count.

Update 2026-10-24: the user prefers sending 방송 자막 over NDI (with alpha, no
chroma green) because it matches their virtual-display idea; keep the green
capture window only as a fallback. OBS needs the DistroAV plugin and NDI
Runtime; the NDI SDK license must be checked before bundling.

Product philosophy (2026-10-23): the app does NOT do broadcast streaming or
replace OBS. For broadcast it only offers a capture window (no physical monitor)
with a solid chroma-key green background and lower-third lyrics, which OBS
window-captures and keys over camera. Avoid "송출" wording that implies
broadcasting; the master toggle is "출력".

Drafts: https://claude.ai/artifact/4Z4M7wLUjyxs5iqLzkeXct. Page "시안" holds the
confirmed E layout (진행 화면) plus overlays, screen settings and Looks, real
outputs, and lyrics reflow boards; cue-then-take is a toggle inside E. Page
"백업" holds F and old A–D. The user said functionally some parts differ from
their idea (not yet specified); still open: default output mode, colors.

Decisions on 2026-10-24: workspaces are 진행 / 준비 / 화면 설정 (the separate
편집 tab was dropped). Songs use our own `.llsong` JSON: title, slides (optional
label + lines, shown in file order, no stored arrangement), one background media
id; repeats happen live by clicking slides. txt/pptx import comes later as
converters into this format. Score display is for the congregation screen, not
for musicians, and should show only as much as the lyrics on that slide. The
score method (image, MusicXML or other data) is still undecided; the user calls
it a separate axis to keep thinking about. Musician-facing chords, transposition
and arrangement versions are out of scope. Score support is deferred past v1,
but v1 must be built so it can be added without restructuring (renderer per
content kind, optional song fields preserved on save, extensible media kinds and
importers).

진행 screen direction (2026-10-24): hybrid of ProPresenter-style layout (icon
toolbar, big preview, clear icon row, tabbed 진행 도구 panel) plus our
multi-screen needs (small previews of the other screens, a "표시 중" tab). 로비
is not used for now (three screens: 본 화면, 무대, 방송 자막). The library lives
only in 준비; 진행's left column is 예배 순서 plus 퀵 실행, which is a list
(Bible verse input placeholder on top, then frequent items such as verses,
songs, 검은 화면). The user deferred shortcut keys for 퀵 실행 to later. Bible
behavior is deferred; it will reuse logic from the user's own repo
github.com/0913vision/copible (local <copible clone>), preferably with offline
data instead of live crawling. Avoid the term "쇼 컨트롤"; call it 진행 도구.

Drafts state (2026-10-24, version 50): the user picked the hybrid (ShowH, now
titled 진행 화면) and said drafts are nearly done apart from alignment; they
asked that the other screens follow ProPresenter where possible. Page 시안 now
holds 진행 화면, 준비 화면 (ProPresenter Reflow-style block editor with label
popover), 화면 설정 (Configure Screens style: 청중/무대 list, display
arrangement, test pattern, inspector), Look 편집 (per-screen layer toggles plus
lyric style), 진행 도구 (all eight tool tabs at real 480x391 size) and 세 화면의
실제 출력. ShowE, ShowP, LabelPicker and the first versions of the reworked
boards moved to 백업. Shared chrome: 4px panel gaps, 34px panel headers, 14px
inner inset.

Library vs service (2026-10-24): the user said editing the library song and
editing the service's "구성" must be different. Drafted (version 52): a library
song is the source (lyrics, labels, default background); a 예배 순서 item links
to it and holds its own 구성 (slide order with repeats), background override, a
macro to run on start, and a memo. The user confirmed "구성" means this
service's slide order with repeats; since version 53 the 진행 화면 shows slides
in 구성 order (9 for the sample song), and any slide can still be clicked live.
The song file itself still stores no order. Macros were redrawn after
ProPresenter (colored icon tiles in grid view, list view with actions,
collections, last-run ring) after the user called the first version odd.

Drafts version 55 (2026-10-24) added 15 boards from the user's todo: problem
states (display lost, missing media), crash recovery, 1366x768 show screen,
Bible lookup via 퀵 실행, new service, adding songs (drag and quick add), lyrics
import, media bin, stage layout editor, preferences and shortcuts, 방송 자막
NDI, and comparison boards for cue-then-take, loading a past 구성, and clear
groups. Open decisions are listed in the report's 남은 것. Other boards still
show 방송 자막 as the green capture window.

Version 56 (2026-10-24): the in-app preview of 방송 자막 stays green by default
even with NDI (choice of 초록/검정/체크 무늬 in 화면 설정), and other boards
label its target "NDI". Clear Groups are called 맞춤 지우기 (the user found
"지우기 묶음" awkward). In cue-then-take the 출력 button sits in the toolbar
like EasyWorship's Go Live; the user called a full-width red bar ugly. Open
question: reuse 구성 the ProPresenter way (named arrangements saved with the
library song, picked per service item) or by loading from past services (our own
idea, not in ProPresenter). The user disliked AI-looking details in the import
board: status chips on every row, example chips beside toggles, sentence-like
labels; show status only for exceptions. They also called a small red "같은
제목" label beside the title field slop: mark a field state with its outline
alone (details only in a hover tooltip), and avoid extra state chips such as
"가져온 곡".

Version 57: import follows ProPresenter (File > 가져오기 > 텍스트 파일 /
클립보드 텍스트 / PowerPoint 파일 as separate entries; one file at a time with
"1 / 3", split by 빈 줄 / 줄 바꿈 / 기호 and count per slide, 편집 opens the
준비 editor before importing). The cue-mode take button now sits as a small
button in the 대기 preview caption row (the user disliked both a full-width bar
and a toolbar button). The user did not understand 맞춤 지우기; after the
explanation they named it "다중 레이어 지우기" (I kept 지우기 rather than 삭제
to match the other clear buttons). Version 58: the cue-mode 출력 button uses the
standard secondary button style (#2a2a2a, 24px, red play icon); Version 59
import flow (the user's own design): pick one file, the modal shows the loaded
result with only 버리기 or 편집; a duplicate title shows as a red-outlined title
field there and in the editor; the library is written only on 저장, which asks
덮어쓰기 / 새 곡으로 저장 / 취소 when the title exists. Cue mode marks 대기 and
출력 only by frame outline color, like ProPresenter's orange live outline; my
colored dots and 대기 badge were not from any reference and were removed.

Version 61 (2026-10-24), superseding the "no stored arrangement" and cue-mode
notes above: output follows ProPresenter (clicking a slide outputs at once;
cue-then-take moved to 백업). Song order uses named arrangements saved in the
`.llsong` (`arrangements: [{ name, slides }]`, 기본 = file order), independent
of any service; a service item picks one (the "load 구성 from past services"
idea moved to 백업). NDI SDK is fine because the app is non-commercial, used in
one church and not distributed; recheck the SDK redistribution terms and NDI
trademark rules if that changes. Explanatory text and redundant chips were
removed from all boards. Open: 다중 레이어 지우기 (my advice: leave it out of v1
and use macros). The user asked what the recovery dialog's "save" unit is.
Proposed answer: songs, services and settings save automatically on every
change, as in ProPresenter, so a crash loses only the live state (which outputs
were on, the live slide, messages and props showing); the recovery dialog should
offer only that. The user also asked about bringing only some items from another
service ("scene"); ProPresenter documents playlist templates (already drawn as
틀 in the new-service board) and adding from the library, but no copying of
items between playlists.

Design system (2026-10-24): the user asked for a finished, documented design
spec, written as a designer would hand it over, before any coding. It lives at
https://claude.ai/artifact/LDSJg1gwuFymJBuTbVEBQP (Design System type). It holds
a README (principles, color, type, spacing, icons, states and motion, window
sizes, writing rules and glossary), tokens.json, and 30 components with README
and preview. Local source is the scratchpad `ds/` folder: `gen-tokens-css.js`,
`build-css.js` (css/*.css parts → bundle.css), `card-server.js` on port 5299 and
`shoot-card.js`. Fixed decisions:

- Two blues: `accent` #3d8bf0 for lines, focus and selected rings; `accent-fill`
  #2a70dc for filled primary buttons, checkboxes and switches (white text
  4.7:1).
- Buttons and fields come in two heights: sm 26 inside panels, md 30 in dialogs,
  settings and the toolbar search.
- Window classes: narrow 1280–1599 (columns 220/360, 40px toolbar), regular
  1600–2399 (280/480), wide 2400 and up (320/560). Minimum window 1280×720, with
  Windows scaling applied. Columns can be resized by dragging.
- Red is only for what is on output. Delete menu items are not colored.
- Output toggle: on shows a red dot, off shows no dot and text-off, a lost
  display shows an amber dot.
- Pretendard Variable and Phosphor Regular icons. Drafts version 64 has all 27
  boards aligned to the system (change list in `ds/BOARD-CHANGES.md`). The
  system is the reference when it and a board differ. assemble.js has a
  `@@TOOLBAR:showOff@@` variant for boards where outputs are off. On 2026-10-24
  the user decided to leave 다중 레이어 지우기 (Clear Groups) out of v1.
  Clearing several layers at once is done with a macro's clear actions, which
  can also run as a service item's start macro. Drafts version 65 moved the
  comparison board to 백업, and the ClearButton guide says so.

Version 63 (2026-10-24), superseding version 62 below: the user chose the
ProPresenter way. Screens, Looks, stage layouts, macros, quick items, messages,
notices, props and timers are app-wide; a `.llservice` holds only the 예배 순서
(name, date, items). Per-service looks come from multiple Looks switched by an
item's start macro. 다른 예배에서 가져오기 picks only order items, appended at
the end (our addition, not in ProPresenter docs). 새 예배 starts from 빈 예배, a
틀 or a past service. The service list opens from the 예배 순서 header name
(ProPresenter keeps it in the top-left playlist list). The File menu has no
저장, 열기 or 최근 예배. The version 62 scene boards sit in 백업. The user plans
to add camera input later, so code must stay extensible for it. ProPresenter
registers video inputs (USB capture, SDI, NDI) app-wide under Settings > Inputs,
and uses them as media-bin items, slide or macro actions, and slide elements.
Keep the input registry, media kinds, action kinds and slide element kinds open
for this.

Version 62 (2026-10-24, replaced by 63): the user's "신" (scene) idea became the
예배 file. One `.llservice` holds the 예배 순서 plus 화면, Look, 무대 배치,
매크로, 퀵 실행, 메시지, 공지, 소품, 타이머, so opening it restores that whole
setup (our own design, after vMix Presets; ProPresenter keeps these app-wide).
Songs and media are referenced by id. Preferences, shortcuts, the label list and
Bible translations stay app-wide. 다른 예배에서 가져오기 picks specific order
items and settings, with expandable categories, after Bitfocus Companion's
import; anything not picked stays as it is. 새 예배 uses the same window (빈
예배, 틀, 지난 예배), and settings left unchecked carry over from the current
예배. Saving is automatic as in ProPresenter, so the File menu has no 저장. The
crash dialog is now 출력 상태 복구 (outputs on, last slide, items showing). Open
questions: whether to confirm when opening another 예배 while output is on, and
whether "예배" is the right unit name ("신" can read as God in a church app, and
"장면" clashes with 장 for slides).

Slide labels come from a user-managed label list where each label has a
user-chosen color (from a fixed muted palette, or none) and a jump key; the user
found the earlier fixed group colors visually noisy.
