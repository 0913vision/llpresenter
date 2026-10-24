# M3 test plan

This plan describes how QA tests milestone M3 (`docs/MILESTONES.md`) as its
requests merge, and later on the tag `m3`. The requests, their owners, and their
acceptance criteria come from `docs/plans/m3-breakdown.md`. This first part
covers wave A; later waves are added to this file as their contracts settle.

It builds on the M1 and M2 plans (`docs/qa/m1-plan.md`, `docs/qa/m2-plan.md`):
the safety rules, the procedures, the severity guide, and the way results are
recorded are the same unless this plan says otherwise. The results go into
`docs/qa/m3-report.md`.

## Scope

Wave A, from "Requests" in the breakdown:

| Request | Owner  | What QA tests                                                                         |
| ------- | ------ | ------------------------------------------------------------------------------------- |
| O0      | output | The live slice registry and the render layer registry, with no behavior change        |
| D1a     | data   | Contracts for 준비 and content: song, service, 틀, search, import, media, settings    |
| D1b     | data   | Live command contracts: content layers, Look, stage, audio, 타이머, batch, item start |
| D1c     | data   | Screen and recovery contracts: test pattern, monitor numbers, settings, recovery      |
| D2      | data   | The app-wide settings stores                                                          |
| D4      | data   | The search index                                                                      |
| U1      | ui     | Design system follow-ups from spec-1, spec-2, and spec-5                              |

Not tested here: W1 (spec documents) and Q1 (this plan). A request of wave A
that reaches the app only through a later request (for example, a contract that
no slice handles yet) is tested at the level it ships, and the case says so.

## How QA tests a request

1. **Before merge, when the lead asks.** QA builds the branch in a scratch clone
   and runs the cases below that the branch can pass on its own. Results go to
   the owner with a copy to the lead.
2. **The unit tests against the acceptance criteria.** QA reads the request's
   tests and lists each acceptance criterion of the breakdown that no test
   covers. A missing test is a finding, like a failing case.
3. **After merge, on local `main`.** QA reruns the cases, then the regression
   set (R below), and records both in the report.
4. **Wave checks.** When every request of an integration check is merged, QA
   runs it (IA below for wave A).

### Changes to the environment

- **Windows off the screen.** Builds that have output-10 start with
  `LLP_TEST_WINDOWS=offscreen`, which opens every window offscreen and never
  shows it. QA first confirms that on each new build (E1). Builds before
  output-10 keep using QA's invisible launcher.
- **No inspector on main for memory.** Memory numbers come only from runs
  without an inspector on the main process (the M2 plan's soak rule).
- **Samples.** Lyrics in samples are public-domain hymns (만복의 근원 하나님) or
  invented lines, as in the M1 and M2 plans.

## Test cases

### E. Environment

- **E1 Offscreen windows stay off the screen**
  - Steps: Start the build with `LLP_TEST_WINDOWS=offscreen`. From the main
    process, list every window with its visibility and bounds; use the title
    bar's minimize, maximize, and close; turn an output on; start a second
    instance.
  - Expected: No window is ever visible on a monitor. Offscreen mode ignores
    minimize and maximize on purpose, so those two change nothing and show
    nothing; close quits the app as usual. The output toggle works on the
    offscreen windows; the second instance quits and focuses nothing on screen.
  - Limit: an offscreen window draws at about 6 frames per second (measured on
    local `main` at `1d46613`), so no frame rate, dissolve, or loop seam is
    judged offscreen. Those cases keep QA's invisible launcher, whose windows
    draw at 60.
  - Source: output-10; `CLAUDE.md` (no window on the user's screen).

### RG. Live registry (O0)

- **RG1 Existing behavior unchanged**
  - Steps: Run the reducer and store tests of `main` before O0 against O0's code
    (unchanged test files). Rerun the M2 cases that use the live state: the 진행
    keys (M2-1, M2-2), F1 to F7 and Ctrl Z, the output toggles, a 장 over a
    looping background (R cases of the M2 plan), clear and undo.
  - Expected: Every test and case gives the same result as before O0.
  - Source: breakdown M3-O0 acceptance.
- **RG2 A new slice is one new file**
  - Steps: Run O0's fake-slice fixture test. Then, in a scratch clone, add a
    second slice module for a test command type to that fixture folder and
    dispatch the command to the registry directly from a test, not through IPC
    (the IPC schema rejects a type outside `LiveCommand`, and widening it needs
    data's file). Remove the file and dispatch again.
  - Expected: With the file in place, the command changes the state and no other
    file was edited. Without it, the registry rejects the command as in RG3 (b).
  - Source: breakdown M3-O0 ("How registration works", acceptance).
- **RG3 Two kinds of rejection**
  - Steps: (a) From the control window, send a command whose type is outside
    `LiveCommand`. (b) Dispatch, directly to the registry, a command of a type
    that the schema accepts but no slice handles (after D1b, any new type
    without its slice; before it, a fixture type). After each, send a valid
    `output.set`.
  - Expected: (a) is dropped by the IPC validation ("dropped a malformed
    command" with the field `type`) and never reaches the registry. (b) is
    rejected by the registry with its own log line that names the type. In both,
    the state and its `version` don't change, the valid command after it
    applies, and no dialog opens. The two log lines tell the cases apart.
  - Source: breakdown M3-O0 acceptance; data-4 (IPC validation).
- **RG4 One slice per command**
  - Steps: Read the registry's map from command type to slice; send each command
    type of `LiveCommand` once and record which slice handled it.
  - Expected: Each type maps to exactly one slice; two slices that claim one
    type fail the build or the start with a clear message.
  - Source: breakdown M3-O0.
- **RG5 Layer order**
  - Steps: Read the layer registry's order and the DOM order of an output page
    with every layer that M2 draws.
  - Expected: Bottom first: media, lyrics, 공지, 소품, the stage layout clock
    and 타이머 and stage message, 메시지, as spec 03 "Layers and stacking order"
    lists.
  - Source: spec 03; breakdown M3-O0.
- **RG6 A new layer is one new file**
  - Steps: In a scratch clone, add a layer module to
    `src/renderer/src/render/layers/` with a test kind and a stacking order
    between two existing layers, and build.
  - Expected: The output page draws it in that position with no other file
    edited.
  - Source: breakdown M3-O0.
- **RG7 Dispatch stays cheap**
  - Steps: Send 10,000 valid `slide.show` commands before and after O0, without
    an inspector on main, and measure the main process's time per command and
    its heap after a forced GC.
  - Expected: No more than 10% slower per command, and the heap after GC is flat
    (recorded as an observation; the breakdown sets no number).
  - Source: `docs/TECH.md` "Performance".

### CA. Contracts for 준비 and content (D1a)

Each contract gets the D-case treatment of the M1 plan: valid samples, each
field broken in turn, unknown fields, prototype keys (`__proto__`,
`constructor`), very long strings, deep nesting, and a fuzz run that must never
throw.

- **CA1 Song edits**
  - Steps: For title, background, blocks, 이름표, and 구성 edits, send a valid
    edit and each malformed variant (wrong types, a block index out of range, a
    구성 with a 장 number past the end, an 이름표 outside the 이름표 list
    format).
  - Expected: Valid edits pass the schema; each malformed one is dropped and
    logged with its field, never applied.
  - Source: breakdown M3-D1a; spec 02 "Song file".
- **CA2 Service and 틀 edits**
  - Steps: Items, order, item settings, create, import items, save as 틀,
    rename, and delete, each valid and malformed (an unknown item kind, a
    duplicate item ID, a 틀 with a `date`, an order that drops or repeats an
    item).
  - Expected: As CA1. Unknown item kinds stay as they are, as spec 02 asks.
  - Source: breakdown M3-D1a; spec 02 "Service file", "Templates".
- **CA3 Library search request and result**
  - Steps: Valid queries (Korean, initial consonants, Latin, empty, only spaces,
    1,000 characters) and malformed ones (a number, an object).
  - Expected: The request schema takes text only; the result schema carries the
    song ID, whether the title or the lyrics matched, and the first matching
    line, as spec 05 "Search" says.
  - Source: breakdown M3-D1a; spec 05.
- **CA4 Text import result**
  - Steps: A valid draft (title, 장, 이름표) and broken ones.
  - Expected: As CA1; a draft is never written by the schema layer.
  - Source: breakdown M3-D1a, M3-D3; spec 05 "Text import".
- **CA5 Media list edits**
  - Steps: Import, playlists, properties (the M1 D36 ranges), relink, and
    delete, valid and malformed.
  - Expected: As CA1, with the same ranges as `media.json` (volume 0 to 100, a
    positive speed, `in` before `out`).
  - Source: breakdown M3-D1a; spec 02 "Media list".
- **CA6 The drag payload for songs**
  - Steps: Build the payload a song drag carries, then drop a forged payload
    (another type, a song ID that isn't a UUID, extra fields, a 1 MB string) on
    the 예배 순서 handler in a test page.
  - Expected: Only a valid payload with a song ID is accepted; anything else is
    ignored and logged. Nothing from outside the app (a text drag from another
    program) is taken as a song.
  - Source: breakdown M3-D1a; `CLAUDE.md` (validate values from outside the
    process).
- **CA7 Settings read, edit, and subscribe**
  - Steps: For each settings file of D2, read it, send a valid edit and a
    malformed one, and subscribe from two windows.
  - Expected: The preload exposes typed functions only (no raw channel names to
    the page); a malformed edit is dropped and logged; both subscribers get the
    new value.
  - Source: breakdown M3-D1a, M3-D2.
- **CA8 The preload surface**
  - Steps: List `window.llp` in the control window and in an output window, and
    send each new message with a wrong shape from both.
  - Expected: Typed functions only, grouped by area, with no raw channel names
    and no Node globals; every message is validated, and a wrong shape is
    dropped and logged, never applied. Both windows share one preload API in
    wave A (the lead's decision); QA records what each window gets.
  - Source: breakdown M3-D1a; M1 S8.

### CB. Live command contracts (D1b)

- **CB1 Each new command**
  - Steps: For Look change, stage layout override, stage message, 소품 on and
    off, 공지 start, pause, and stop, 메시지 send (targets, display time),
    타이머 start, pause, and reset, audio play, pause, next, previous, fade out,
    and volume, 매크로 run, `item.start`, and `live.batch`: a valid command and
    each malformed variant (targets that aren't screen IDs or `"all"`, a
    negative display time, a volume outside 0 to 100, an empty batch, a batch
    inside a batch, a batch of 10,000 commands).
  - Expected: Valid commands pass the schema; malformed ones are dropped and
    logged with their field. The limits for a batch (empty, nested, size) are
    recorded as the contract states them.
  - Source: breakdown M3-D1b; specs 03, 04, 07.
- **CB2 New commands before their slices**
  - Steps: On `main` with D1b but without the slice of a command, send it.
  - Expected: Rejected and logged as RG3; the state and its `version` don't
    change. The type check passes with the widened union (O0's registry).
  - Source: breakdown "Registries before contracts".
- **CB3 The 매크로 action payloads**
  - Steps: Check each 매크로 action kind of `macros.json` (M1 D26) against the
    command it becomes.
  - Expected: Each action maps to one D1b command with the same fields and
    defaults (a missing mode reads as 켜기, a missing timer operation as 시작).
  - Source: spec 07 "Action kinds"; the lead's D26 decision.

### CC. Screen and recovery contracts (D1c)

- **CC1 Screen commands**
  - Steps: Test pattern on and off per screen, show monitor numbers, and each
    screen setting change of `screens.json`, valid and malformed (a screen ID
    that isn't a UUID, an edge margin of 101, a resolution of 0).
  - Expected: As CB1.
  - Source: breakdown M3-D1c; spec 03; M1 D23.
- **CC2 The recovery interface (contracts only)**
  - Steps: Check the schemas of `recovery.summary`, `recovery.apply`, and
    `recovery.startFresh` with valid and malformed values. In the built app,
    replace the main handlers with fakes (as the data-5 checks did) that return
    a valid summary, a malformed one, a reply of the wrong type, and an error.
  - Expected: The preload exposes typed functions only; a valid fake reply comes
    through unchanged; a malformed or failed reply gives the empty fallback and
    one "Ignored a bad reply" log line; `apply` sends only the row IDs in its
    schema's shape. What the backend restores, filters, and starts fresh with is
    O8's behavior (wave C) and is tested in O8's cases, not here.
  - Source: breakdown M3-D1c, M3-O8; spec 08.

### SS. App-wide settings stores (D2)

- **SS1 First launch creates every file**
  - Steps: Start with an empty `LLP_USER_DATA`.
  - Expected: `설정\` holds `screens.json`, `looks.json`, `stage-layouts.json`,
    `macros.json`, `quick.json`, `messages.json`, `notices.json`, `props.json`,
    `timers.json`, `labels.json`, `bible.json`, and `media.json`, each parsing
    with its M1 schema. The 02 defaults: screens 본 화면 (audience, full
    screen), 방송 자막 (audience, capture window, 1920 x 1080, green preview),
    무대 화면 (stage, full screen), with full screen monitors unassigned; one
    Look, 평상시, as 02 describes it per screen; one stage layout, 현재와 다음,
    with its seven elements; the 이름표 1절, 2절, 3절 (teal), 프리코러스
    (green), 후렴 (yellow), 브리지 (violet), 간주 (gray), 엔딩 (none), with no
    jump keys. Files without 02 defaults are empty lists (record their exact
    content).
  - Source: breakdown M3-D2; spec 02 "App-wide settings"; M1 D23 to D25, D32.
- **SS2 An edit survives a restart**
  - Steps: Edit one value in each file through the D1a functions, quit, start.
  - Expected: Each edit is there after the restart; each write was atomic
    (temporary file, flush, rename) and took at most one recovery copy per file
    every 5 minutes.
  - Source: breakdown M3-D2; spec 02 "Save rules".
- **SS3 A broken settings file falls back**
  - Steps: Break each file in turn (not JSON, empty, a wrong `format`, a field
    that fails the schema), twice: (a) with a readable recovery copy in
    `.복구 사본\`, and (b) with none. After each start, edit that area once.
  - Expected: One log entry and one warning notification whose detail names the
    area and whether a recovery copy or the defaults were used. (a) runs the
    area from the newest recovery copy that reads; (b) runs it from its
    first-launch defaults (SS1). Every other file loads. The broken file stays
    untouched until the area's next write; that write first copies it to
    `(name).broken-(YYYYMMDD-HHmmss).json` in the same folder, byte for byte,
    and then writes a valid file.
  - Source: breakdown M3-D2; spec 02 "Schema versions and migration" (the lead's
    decision of October 25, 2026).
- **SS3b A settings file from a newer version**
  - Steps: Give each file a higher `schemaVersion` that still fits the schema,
    then one that doesn't; try to edit the area.
  - Expected: A fitting file opens read-only: its values show, an edit isn't
    written, and the file never changes. A file that doesn't fit falls back as
    in SS3 (spec 02 treats it as broken content).
  - Source: spec 02 "Schema versions and migration"; M1 D7.
- **SS4 Unknown fields survive a save**
  - Steps: Add unknown fields at every level of each file (as M1 D9), start,
    edit one known value, quit.
  - Expected: The unknown fields are unchanged after the save.
  - Source: breakdown M3-D2; `CLAUDE.md`.
- **SS5 A change reaches subscribers within a second**
  - Steps: Subscribe from the control window and an output window, then edit a
    value; measure the time to each callback.
  - Expected: Under 1 s for both.
  - Source: breakdown M3-D2.
- **SS6 Dropped parts fall back**
  - Steps: In `labels.json` and `shortcuts.json`, put one bad jump key and one
    reserved shortcut among good entries.
  - Expected: Only the bad entries fall back to their defaults; each is logged;
    the rest load (M1 D32, D34).
  - Source: spec 10 "Storage"; M1 D32, D34.
- **SS7 Saving never stalls the output**
  - Steps: While a 장 changes every second on an output, write 100 edits in a
    burst to `looks.json`.
  - Expected: One write within 0.5 s after the last edit; the output keeps its
    frame rate (no frame gap over 100 ms).
  - Source: spec 02 "Autosave"; M2 F13.

### SE. Search index (D4)

- **SE1 Initial consonants**
  - Steps: Search "ㅁㅂㅇ", "ㅁㅂㅇㄱㅇ", "ㄲ", and "ㄱ" in a library with
    만복의 근원 하나님 and a song whose title starts with 까.
  - Expected: "ㅁㅂㅇ" and "ㅁㅂㅇㄱㅇ" find 만복의 근원 하나님; "ㄲ" finds the
    까 song; "ㄱ" doesn't match ㄲ.
  - Source: spec 05 "Search"; breakdown M3-D4.
- **SE2 Normalization**
  - Steps: Search "만복의근원", "만복의 근원", a Latin title in another case, an
    NFD-encoded query, and a query of spaces only.
  - Expected: The first four find their songs; spaces only match nothing.
  - Source: spec 05 "Search".
- **SE3 Mixed queries**
  - Steps: Search "만ㅂ".
  - Expected: Matched as plain text only.
  - Source: spec 05 "Search".
- **SE4 Order and result fields**
  - Steps: A query that matches one song's title and other songs' lyrics.
  - Expected: Title matches first, then lyrics matches, each in title order;
    each result has the song ID, the match kind, and for lyrics the first
    matching line.
  - Source: spec 05 "Search".
- **SE5 Budget over 3,000 songs**
  - Steps: Generate 3,000 songs of invented lines (8 to 40 장 each), build the
    index, and time 100 queries of each kind (syllables, initials, Latin, no
    match), with no inspector on main.
  - Expected: Each query answers within 50 ms (lead decision 6); building the
    index doesn't block the main process for more than 50 ms at a time.
  - Source: breakdown M3-D4; `docs/TECH.md`.
- **SE6 Edits show at once**
  - Steps: Rename a song, change one of its lines, delete another song, and add
    one; search each at once.
  - Expected: The new words find the song and the old words don't; the deleted
    song is gone; the new song is found.
  - Source: breakdown M3-D4.
- **SE7 Memory**
  - Steps: Build the index for 3,000 songs, then edit 1,000 songs one at a time.
  - Expected: The main heap after GC is the same within 5% before and after the
    edits (an observation; no number is set).
  - Source: `CLAUDE.md` (cap every cache).

### US. Design system follow-ups (U1)

- **US1 Number field steps**
  - Steps: In the gallery, use ↑, ↓, Shift ↑, and typing on number fields with
    steps 0.1, 0.05, 0.5, and 1.
  - Expected: Step 0.1 turns 0.2 into 0.3 (never 0.30000000000000004); Shift
    adds the large step; the field shows the step's decimals ("0.2", "1.40",
    "10"); a typed value rounds to the nearest step and snaps into the range
    when focus leaves.
  - Source: spec 10 "Design system note: number field steps".
- **US2 A click doesn't move keyboard focus in 진행**
  - Steps: In a 진행 test frame, click a button, then press Space; press Tab.
  - Expected: The click runs the button and leaves focus where it was; Tab moves
    focus to it.
  - Source: spec 10 "Focus precedence"; breakdown M3-U1.
- **US3 The 장 grid keys**
  - Steps: Focus a `SlideThumbnail` grid and press ←, →, Space, Page Up, Page
    Down, ↑, ↓, and Enter.
  - Expected: As the M2 K cases: the grid keeps ↑, ↓, and Enter, and passes the
    others to 다음 장 and 이전 장.
  - Source: spec 10; M2-2.
- **US4 Clear shortcut scope and tile keys**
  - Steps: Press F1 to F7 in a text field and outside; press Enter and Space on
    a focused `MacroTile` and `MediaTile`, and click them.
  - Expected: The clear keys work as spec 10 scopes them; the tiles run on keys
    only when they have keyboard focus.
  - Source: spec 10; the ui list in `docs/reviews/spec-5.md`.
- **US5 KeyCap names and the key field**
  - Steps: Show each key of spec 10's command list in `KeyCap`. In a recording
    key field, press Esc, Backspace alone, Tab, and Shift Tab, then each key of
    the table that keeps recording: Enter alone, Alt alone, F10 alone, Shift
    F10, the Menu key, Ctrl X, C, V, and A, a key with an empty `code`, and a
    bare letter and a bare digit.
  - Expected: English key names as spec 10 writes them. Esc cancels the
    recording and the shortcut stays as it was; Backspace alone removes the
    shortcut; Tab and Shift Tab end the recording and move keyboard focus; none
    of these four shows a tooltip. Each of the other keys isn't recorded: the
    field keeps recording, shows the error ring, and gives the table's tooltip
    ("확인과 실행에 쓰는 키", "메뉴 막대에 쓰는 키", "오른쪽 클릭 메뉴에 쓰는
    키", "글자 편집에 쓰는 키", "입력기에 쓰는 키", "이름표 바로 가기에 쓰는
    키"). Alt F4, Alt Tab, Ctrl Esc, Ctrl Alt Delete, the Windows key, and Print
    Screen can't be sent as synthetic keys and are checked in the field's unit
    tests ("Windows가 쓰는 키").
  - Source: spec 10 "Reserved keys".
- **US6 The gallery and the cards**
  - Steps: P-compare the new states against the cards.
  - Expected: Every new state is in the gallery and matches its card.
  - Source: breakdown M3-U1 acceptance.

### IA. Wave A integration checks

The breakdown lists no integration check for wave A; these test the wave A
requests together once all of them are merged.

- **IA1 A widened contract on the registry**
  - Steps: With O0, D1b, and D1c merged, send one command of each new type from
    the control window.
  - Expected: Commands whose slices exist apply; the others are rejected and
    logged without a version change; nothing throws in the main process.
  - Requests: O0, D1b, D1c.
- **IA2 Settings edits reach the windows**
  - Steps: Edit `labels.json` through the D1a functions while the control window
    and an output window are subscribed; also replace the file on disk.
  - Expected: Both windows get the edit within 1 s; a change made on disk while
    the app runs is recorded (picked up, or kept until the next start).
  - Requests: D1a, D2.
- **IA3 Search over IPC**
  - Steps: Send search requests from the control window over the D1a channel to
    the D4 index of a 3,000-song library.
  - Expected: Results arrive within 50 ms plus the IPC round trip (recorded);
    malformed requests are dropped and logged.
  - Requests: D1a, D4.
- **IA4 One owner of app.json**
  - Steps: After data's and shell's M1-12 changes, rerun M1 C19 (a) to (e) and
    C10, C14, and C16 to C21.
  - Expected: One warning per broken `app.json`, and every other C case as in
    the M1 run.
  - Requests: the M1-12 fix (data and shell).

### R. Regression after each wave A merge

- `npm run verify` on `main`.
- The M1 D cases (895 checks) and the M1-4, M1-5, and M1-11 close cases.
- The M2 cases that the merged request touches (F for D2, O and R for O0, K for
  U1).
- The soak judge on a 20-minute run without an inspector on main (RG7, SE7).
