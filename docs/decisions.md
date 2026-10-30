# Decision log

Record each new decision made during implementation as one entry with its date.
The full product decisions are in `docs/HANDOFF.md` and `docs/spec/`.

- 2026-10-24: Team workflow. A lead and team members (work sessions). Team
  members work in their own worktrees and send review requests. They're
  responsible for rebasing their own branches, resolving conflicts, and
  addressing reviews. Both the lead and the reviewer must approve, and merges
  into `rewrite` are fast-forward only.
- 2026-10-24: Until Codex joins, the reviewer is a read-only review agent that
  the lead starts fresh for each review. After that, it's Codex (read-only).
- 2026-10-24: Every session runs with permission prompts turned off. That's why
  `CLAUDE.md` has safety rules.
- 2026-10-24: The repository's git configuration turns on long paths and turns
  off automatic line ending conversion. `.gitattributes` fixes line endings to
  LF. The global git configuration wasn't touched.
- 2026-10-24: Pin Electron to 44.9.x. 45.0.0 is a first release, out for three
  days. Change it in phase 1.
- 2026-10-24: `rewrite` starts empty (only the documents and the design
  sources). The early skeleton built before the drafts stays in the local
  archive branch `archive/prototype-2026-10`, and the lead takes only what's
  useful from it when building the initial scaffold. Team members start from the
  commit that contains the initial scaffold.
- 2026-10-24: The session that handled phase 0 continues as the lead (user
  request).
- 2026-10-24: No GitHub PRs for now (no `gh`, and team members don't push).
  devops reconsiders this in phase 1.
- 2026-10-24: The devops team member builds CI. The local `npm run verify` comes
  first, and GitHub Actions runs it once more on Windows for every push to
  `rewrite`.
- 2026-10-24: GitHub is used for backup and CI (the user's permission). Only the
  lead pushes `rewrite`, and reviews happen in review documents in the
  repository. The repository is public, so confirm with the user before the
  first push.
- 2026-10-24: `rewrite` starts from `origin/main` (9b23462), so that `main` can
  fast-forward to `rewrite` after v1.
- 2026-10-24: Multi-layer clearing (Clear Groups) isn't in v1. Macros replace
  it.
- 2026-10-24: Commit messages are one line,
  `tag(scope): <one English sentence starting with a base-form verb>`, with no
  trailer (`Co-Authored-By` or others) (user rule). The tags and examples are in
  `CLAUDE.md`. The messages of the first commits, which weren't pushed yet, were
  rewritten in this format.
- 2026-10-24: Documents, code comments, test names, log messages, and commit
  messages are in English and follow the Google style guides, or another large
  company's guide where Google has none (user rule). Product UI strings stay in
  Korean.
- 2026-10-24: Comments are minimal: TSDoc, `NOTE(0913vision): ...` for context
  the code can't show, and `TODO(0913vision): ...` for later work, and nothing
  else (user rule). The lead picked TSDoc over JSDoc when the user asked for one
  fixed choice, because the code is TypeScript.
- 2026-10-24: Prettier 3.9.10 with the `gts` settings formats code, CSS, JSON,
  and Markdown, and wraps Markdown prose at 80 columns. `design/` is excluded
  because its scripts generate it. Where Prettier and a style guide disagree on
  whitespace, Prettier wins.
- 2026-10-24: Commit tags are the user's break, feat, refactor, style, docs, and
  chore, plus fix, which the lead added for bug fixes (they are neither features
  nor refactors).
- 2026-10-24: Sample lyrics in the repository come from hymn 1 (만복의 근원
  하나님, public domain), because the repository is public.
- 2026-10-24: Members rebase only their own branch onto `rewrite`. Nobody
  rebases `rewrite` itself. `CLAUDE.md` now says the same as `docs/WORKFLOW.md`.
- 2026-10-24: Every session keeps working notes in `.llp/notes.md` (ignored by
  git), and a SessionStart hook prints them with the git state after every start
  and compaction, so a compacted session can carry on (user request).
- 2026-10-24: The product decisions from the drafts phase moved from the lead's
  private notes into `docs/product-log.md`, so every session can read the
  sources that `docs/spec/` cites.
- 2026-10-24: Renderer tests run in jsdom with Testing Library (`jsdom`,
  `@testing-library/react`, `@testing-library/dom`, and
  `@testing-library/user-event`, all MIT, development only, each release at
  least two weeks old). Vitest runs two projects: `node` for the main process,
  preload, shared code, and scripts, and `renderer` for the renderer. The lead
  set this up before the UI work starts, so UI members can test components from
  their first commit.
- 2026-10-24: trial, devops, and ui start at the same time instead of trial
  first, because the purpose of member sessions is parallel development with
  each session keeping its own context (user). The shared UI components moved
  from the lead's share to the ui member. The lead keeps the shell, the data
  schemas, reviews, and merges.
- 2026-10-24: Member branches are `team/<name>` instead of `rewrite/<name>`. Git
  can't hold the `rewrite` branch and a `rewrite/<name>` branch at the same
  time, so the earlier name could never be created. Found when the first member
  worktree failed to create.
- 2026-10-24: Branch names follow `<tag>/<name>/<feature>` (user rule), for
  example `feat/ui/form-controls`, with exactly three parts. This replaces
  `team/<name>`, and each review request gets its own branch.
- 2026-10-24: `npm ci` runs `install-electron` as `postinstall`. Electron 44 no
  longer downloads its binary on install, and electron-vite looks for the binary
  directly, so a fresh worktree failed with `Electron uninstall` (found by
  trial-1). The script skips the download when the binary is already there.
- 2026-10-24: Each type style has a `font` shorthand variable, `--type-<style>`
  (for example `--type-label: 400 12px/16px var(--font-ui)`), generated from
  `tokens.json`. Components use `font: var(--type-label)` instead of the global
  classes, which CSS modules can't compose safely (asked by ui). Named
  `--type-*` so it doesn't collide with the family variables `--font-*`.
- 2026-10-24: The three UI motion values from the design system README are
  tokens: `--motion-hover` (100ms ease-out), `--motion-popover` (120ms
  ease-out), and `--motion-dialog` (160ms ease-out), generated from a new
  `motion` family in `tokens.json` (asked by ui).
- 2026-10-24: Lint with TypeScript 7 (asked by devops). typescript-eslint 8.72.0
  supports only `typescript >=4.8.4 <6.1.0`, and TypeScript 7 has no JS API
  until 7.1, so `typescript` is aliased to `@typescript/typescript6@6.0.2`
  (binary `tsc6`) for typescript-eslint and the editor, and TypeScript 7 stays
  as `@typescript/native` (`npm:typescript@7.0.2`), which provides `tsc` for
  `npm run typecheck`. `@eslint/js` is added (exact pin) for ESLint's core
  recommended rules. gts isn't used: it brings ESLint 9, runs Prettier inside
  ESLint, and turns off `no-non-null-assertion`. Revisit when typescript-eslint
  supports TypeScript 7.
- 2026-10-24: `tsconfig.node.json` includes `test/**/*` (shared test helpers)
  and sets `rewriteRelativeImportExtensions`, so scripts that Node runs directly
  can import siblings as `./x.ts`.
- 2026-10-24: Members that finish a brief get the next one instead of being
  closed (user). The trial session continues as shell (column resizing) and the
  first reviewer session continues as data (schemas). Both tasks moved from the
  lead's share. Codex is the reviewer.
- 2026-10-24: `main` is the integration branch (user). The lead manages it, and
  members' branches are merged into it by fast-forward. `main` was
  fast-forwarded from the 2024 code (9b23462) to the rewrite (3c3efb7) without a
  force push, and the 2024 code is kept as the tag `legacy-2024`. The branch
  `rewrite` is retired and stays on GitHub only as history.
- 2026-10-24: The schema library is valibot 1.5.0 (proposed by data, approved by
  the lead). For the song schema it was the smallest of zod, zod/mini, valibot,
  and arktype (2.7 KB gzip against 8.4, 24.6, and 45.9 KB), passed TypeScript 7
  with the repository's options, keeps unknown fields at every level with
  `looseObject`, supports brands and exact optional fields, and puts the field
  path and the received value in its messages. It has no dependencies (MIT).
  Only `src/shared/schema/` imports it, behind `parse<Format>` and
  `serialize<Format>`, so replacing it later touches only that folder. zod
  remains the fallback if valibot stops being maintained.
- 2026-10-24: The shortcut system and a settings window that covers what
  ProPresenter's settings offer (fonts included) are planned for implementation
  later (user). The spec member researches ProPresenter now and writes a
  proposal (`docs/spec/10-shortcuts-and-settings.md`) for the user to decide
  before design and code.
- 2026-10-24: CI stays as it is (user): `npm run verify` locally is the gate
  before a merge, and GitHub Actions checks `main` after each push. No GitHub
  PRs for now.
- 2026-10-24: Version rules (user): the major version goes up only with the
  user's permission. `break`, `feat`, and `refactor` raise the minor version;
  `fix`, `style`, `chore`, and `docs` raise the patch version. The version lives
  only in `package.json`.
- 2026-10-24: Flow for `main` (user): before a push to `main`, a pre-push hook
  runs `npm run verify` and blocks the push on failure. After a push to `main`,
  GitHub Actions runs verify and then a bot commits `Bump version: x.y.z` and
  tags `vx.y.z`. That commit is the only exception to the commit message format.
  The lead pulls the bot's commit before the next merge. No scheduled tests for
  now. devops-2 builds this; the earlier local bump plan is dropped.
- 2026-10-24: The team works in milestones with a QA member (user): each
  milestone is split among members, frozen with a tag `m<number>`, and tested by
  qa while the others start the next milestone (`docs/MILESTONES.md`). M1 is the
  foundation, M2 the vertical slice, taken over from the lead's phase 2 share
  and split among data, shell, ui, devops, and a new output member.
- 2026-10-24: The lead manages only (user): plans, briefs, reviews, merges, and
  coordination. Members write all code, shared contracts included when their
  brief allows it.
- 2026-10-24: Speed changes after the user saw the team stall: members run fast
  checks while working and the full `npm run verify` once per request (known
  flaky tests recorded, not rerun); the lead rebases conflict-free branches at
  merge time and batches its own document commits; reviewers approve when only
  nits remain, which the author fixes in the next branch; the lead records the
  verdicts in the review document at merge time.
- 2026-10-25: Shortcuts follow ProPresenter (user), since they can be changed
  later in the 단축키 settings. Where ProPresenter has a default or a behavior,
  use it; where it has none, use the spec proposal. Shortcuts are matched by
  physical key, and key names are written in English (Page Up, Home, Ctrl S).
  The settings questions in the proposal (10 to 18) use the proposal's defaults
  until the user decides otherwise.
- 2026-10-25: Reset after the team stalled on conflicts (user). The lead fixed
  the rules in one place (`CLAUDE.md`, "Team member rules"), made them fixed
  until the milestone freeze, gave every path one owner (`docs/MILESTONES.md`,
  "File ownership"; data owns the shared contracts and output owns the
  main-process wiring), and set a single merge queue with one Codex window per
  request (`docs/STATUS.md`). The move to GitHub pull requests with rebase
  merges waits for the M1 freeze.

## 2026-10-25: Fewer pushes, one-line Codex requests

- The lead pushes `main` to GitHub only at a milestone freeze or when a feature
  bundle is complete, not after every merge (user decision). Local `main` stays
  the integration branch for the team.
- A Codex window gets one line that points at the review document and
  `docs/reviews/CODEX.md`; the review document carries the review range and what
  to check (user decision).
- A documents-only review request runs `npm run format:check` instead of the
  full `npm run verify`, to cut machine load.

## 2026-10-25: `test` is a commit tag

- `test(scope): ...` is allowed for commits that add or change tests only (user
  decision). The version bot treats it as a patch change, like `chore` and
  `docs`.

## 2026-10-25: One owner of `app.json`

- The data store (`src/main/store/`) is the only module that reads, validates,
  and writes `app.json` (lead decision, from qa's bug M1-12). It parses the file
  once, logs one warning that names the file and the field when the file is
  broken, keeps unknown fields, and runs writes in order.
- The UI state store (`src/main/uiState/`) stops parsing `app.json`. It reads
  and changes its fields (`layout`, `previewBig`, `macroView`,
  `macroCollection`, `mediaStrip`) through the data store's interface, and the
  data store writes `dataRoot`, the locations, and `lastServiceId` the same way.
  Two whole-file writers would overwrite each other's fields.
- Data lands the interface and the single warning first; shell then moves
  `uiState` onto it.

## 2026-10-25: Verification before the push, only the bump after it

- A push to `main` on GitHub runs only the version bump, never `verify` (user
  decision). Verification ends on our side before the push, as pull request
  checks end before a merge.
- The pre-push hook keeps that guarantee: it runs `npm run verify` unless the
  pushed commit's tree already passed `verify` on a clean tree, which a stamp
  records. The commit message check always runs.
- A pull request, when we use them, runs `verify` on GitHub; the merge then only
  bumps.

## 2026-10-25: A user check build inside every milestone

- Every milestone has at least one point where the user launches the app and
  tries it (user request). The lead cuts `main` as a tag `mN-checkK` after
  `verify`, pushes it, and qa smoke-tests the tag and writes the Korean steps
  with sample data (invented or public-domain lyrics only).
- The first one is `m2-check1`, cut at 13:17 on October 25 for the user's check
  between 15:00 and 16:00. From M3 on, the milestone plan names its check
  points.

## 2026-10-25: A hung output is restarted only when it stops answering

- An output that is on and has drawn sends frame-rate reports. After 5 s without
  one (`FRAME_SILENCE_MS`), the main process pings the page's main thread; only
  a page that doesn't answer within 10 s (`ANSWER_LIMIT_MS`) is crashed on
  purpose, so the restart rules of output-11 reload it and count it toward the
  restart limit (lead decision, output-14). A page that answers but draws
  nothing is logged, never restarted, because a wrong restart blanks a live
  output during a service. Spec 08 takes this rule when spec next changes.

## 2026-10-25: Bible text from a one-time crawl, kept out of the repository

- The Bible texts come from a one-time crawl (copible or a similar site) that
  builds a local database in the format of spec-4 (`docs/spec/02-data.md`,
  "Bible translations"), for the user's own use only, never redistributed (user
  decision). This answers questions 8 and 9 of `docs/plans/open-decisions.md`.
- No crawled text and no database built from it is ever committed to the public
  repository. The database lives in the user's data folder; the app only reads
  it and works offline.
- The crawl runs once on the user's computer, slowly, within what the site
  allows. It is M3 T4a work (tools, wave B).
- For the implementation, copible is the reference for two behaviors (user): (1)
  splitting a passage that doesn't fit on one screen into several slides marked
  [계속]; (2) the Bible reference field: typing 창 completes to 창세기, a prefix
  that matches several books (베) lets the operator pick one with the keyboard,
  so a reference is entered in a few keys. T4a and T4b study copible's flow
  before they build these.

## 2026-10-25: Branch verification on GitHub runners

- Team members push their own branches to GitHub, and GitHub's Windows runners
  run `npm run verify` on every pushed branch (user decision; the repository
  stays public, where these runners are free and unlimited, up to 20 at once).
  Members run only fast checks on this computer. A review request needs a green
  run of its head commit (`node scripts/ci/status.mts <branch>`).
- Members push only their own branches, with `--force-with-lease` after a
  rebase. Only the lead pushes `main`; nobody pushes tags or force-pushes
  `main`. A push to `main` only bumps the version (devops-18).
- The external Windows computer stays a quiet test machine (long soak runs), not
  a self-hosted runner, because the repository is public.

## 2026-10-25: A fallback output window goes behind the control window

- When a full screen output's monitor disconnects and the output switches to a
  window on the control monitor (spec 03, "When a monitor disconnects during
  output"), the window goes behind the control window, without focus and without
  always on top, so it never covers the controls during a service, even with one
  monitor left (user decision after the real-monitor unplug check). The
  notification's 창 보기 action brings it to the front.
- Electron 44 has no way to send a window to the bottom of every window. The
  lead chose the Electron-only way: move the control window directly above the
  output window (`moveAbove` with the output window's media source id), without
  activating it. Rejected: hiding the window until 창 보기 (a hidden output
  stops painting, which trips the hang watch, and its video may pause), and a
  native `SetWindowPos(HWND_BOTTOM)` call (a native dependency for one call).
  The user confirms this in the morning of October 26.
- The window keeps the size and the centered position of `placement.ts` on the
  control monitor's work area. The unplug check found it at the right edge
  instead (Windows restored the pre-full-screen bounds on the lost monitor after
  the app's bounds), a bug for output.
- Windows moves the full screen window onto the control monitor before the app
  hears of the change, so the window would cover the controls until the app's
  300 ms settle wait (`DISPLAY_SETTLE_MS`) ends and it becomes a window. To
  avoid that, on the disconnect event itself, before the settle wait, the output
  window drops always on top and goes to the back (user decision). The settle
  wait then only decides the window's placement.
- ProPresenter has no equivalent to follow: Renewed Vision's support article
  says a display disconnected while ProPresenter is open leaves the output on
  the main monitor, and the operator turns it off with Ctrl+1 or reassigns it
  ([How do I get my output to show on my screens](https://support.renewedvision.com/hc/en-us/articles/360011694234-How-do-I-get-my-output-to-show-on-my-screens)).

## 2026-10-25: M2 closes with the GPU memory growth carried into M3

- The real-monitor 60-minute run (qa-9) reproduced bug M2-8 with a visible
  window: the GPU process grows about +10 MiB/h (+8.7 MiB/h in the last 30
  minutes) while the main, control, and output processes stay flat. Code review
  found no allocation in the app that grows per loop or per slide.
- The user decided to close M2 without it: M2 freezes once the fallback window
  fix (output-21) and the run results (qa-9) merge, and M2-8 moves to M3. About
  40 MiB over a four-hour service doesn't threaten the output; the M2 criterion
  "no memory growth" is met for every app process except Chromium's GPU process.
- In M3, the workload is split into offscreen runs (static content, video loop
  only, slide changes only, the combination) with a three-hour run, to find what
  grows and whether it levels off. A cause in the app gets a fix; a Chromium or
  driver cache that levels off gets a recorded ceiling instead.

## 2026-10-25: `iconv-lite` decodes CP949 text imports

- Text import (spec 05, "Reading the text") falls back to CP949 for files
  without a BOM that aren't valid UTF-8. Node's built-in `TextDecoder` accepts
  the `windows-949` label but decodes it as EUC-KR, so CP949 extended Hangul
  (for example `94 EE`, 뷁) throws or comes out corrupted (data-28, measured on
  Node 24.20.0 with ICU 78.3; Node issue
  [61041](https://github.com/nodejs/node/issues/61041) lists EUC-KR among the
  incorrect legacy decoders).
- The lead approves `iconv-lite` at exactly `0.7.3` (released 2026-07-03, MIT,
  pure JavaScript, one dependency `safer-buffer`) against "Criteria for adding a
  dependency" in `docs/TECH.md`: maintained, licensed, outside the output path,
  and a CP949 table is far more than a few dozen lines.
- It is used only by the main-process import decoder, behind one wrapper in
  `src/main/import/`. UTF-8 and UTF-16 stay on the strict built-in decoder.
  Output that would contain replacement characters is rejected, never returned
  as lyrics.

## 2026-10-26: A 구성 never loses lyrics through a split or merge

- Spec 02 defines how 구성 (arrangement) references follow an inserted, deleted,
  or moved 슬라이드, but not a split or a merge in the song editor. The lead
  decides, after ui-21's review: a split or a merge never drops lyrics from a
  구성.
- Every split (Enter on an empty line, Ctrl Enter at the cursor, or a paste with
  blank lines): every reference to the split 슬라이드 expands to all its parts
  in order (a 구성 `[1, 3, 3]` whose 슬라이드 3 splits into 3 and 4 becomes
  `[1, 3, 4, 3, 4]`).
- Merge (Backspace at the start of a block): references to the removed block map
  to the merged block, and an adjacent duplicate that the merge creates
  collapses into one (`[2, 3]` becomes `[2]` when 3 merges into 2; a 구성 `[3]`
  becomes `[2]`).
- Only deleting a 슬라이드 removes its references, as spec 02 says.

## 2026-10-26: Dragging a 예배 순서 header moves its whole section

- Dragging a header in the 예배 순서 moves the header together with its items up
  to the next header, as one section (user decision, confirming the lead's
  default in spec-28; spec 04 and 05 didn't say).

## 2026-10-26: Ownership works like code owners, and additive contracts go in the request

- File ownership no longer gates edits. Any member may change any path their
  request needs, lists the changes outside their own paths with the reason in
  the review document, and the review checks them against that path owner's
  rules, as code owners do in a pull request (user decision; members had to stop
  and ask the lead more than twenty times in one night for one-line wiring
  changes).
- Additive shared contracts (a new type, an optional field, a new IPC channel or
  command) go in the member's own request with schemas, valid and invalid tests,
  and caps in data's conventions. A change that alters or removes an existing
  contract is tagged `break` and goes to data first (user decision; about ten
  contract-only data requests blocked other members overnight).
- Changes in someone else's area stay limited to what the request needs; a
  larger change there is that owner's request. `CLAUDE.md`, "Your files" and
  "Shared contracts", and `docs/MILESTONES.md`, "File ownership", say this.

## 2026-10-26: Closing the app while edits are still being saved

- When the app closes while the song editor still has edits to write, the
  control window shows a modal "저장 중" with a 강제로 닫기 button, the way an
  editor such as VS Code holds its window while it saves (user decision; it
  replaces the lead's proposal of a "편집 내용 저장 실패" card with 그래도
  닫기).
- The modal appears only when the flush takes longer than a short delay, so a
  normal close never flashes it. It closes the app by itself once the flush
  succeeds (lead default).
- When the flush fails, the modal stays and offers 다시 시도 beside 강제로 닫기;
  edits are never dropped without the operator choosing 강제로 닫기 (lead
  default).
- When the control window doesn't answer within the flush limit (5 seconds), the
  app closes without the modal, because a frozen window can't draw it and must
  never keep the app from closing (lead default, data-44).

## 2026-10-26: Media analysis runs in a hidden renderer, not the utility process

- Video and audio analysis (duration, whether the file can play, and video
  thumbnails) runs in a hidden, sandboxed renderer window that main opens on
  demand. It decodes with Chromium's own media stack, the one the output windows
  play with, so "can't play" means the output really can't play it, and a
  thumbnail is a real frame. It never shows, analyzes one file at a time from a
  capped queue, and closes after a short idle time (lead decision, M3-P6a).
- Rejected: parsing container headers in TypeScript in the utility process (a
  dozen parsers to keep right, and a codec name only guesses at playability;
  Windows shell thumbnails miss formats such as VP9 WebM), and ffprobe or ffmpeg
  binaries (a large dependency for size and licensing).
- Images are measured and scaled in main with Electron's `nativeImage`, at the
  tile size, into the capped thumbnail cache in `cache\`. The utility process
  keeps import conversion and, later, NDI. `docs/TECH.md` says this.

## 2026-10-26: A cap never drops the operator's unsaved work

- Every list and cache has a cap (`CLAUDE.md`), but a cap on unsaved work (memo
  drafts, files waiting to be saved) must never drop an entry. Coalesce entries
  for the same document so only the latest intent waits, set one named hard cap,
  and at the cap refuse new edits before anything is accepted, with the problem
  visible and the reason in a tooltip or the edit result (lead decision; it came
  up in ui-37 and data-47).

## 2026-10-26: Smart guides in the stage layout editor

- Dragging or resizing an element in the stage layout editor (M3-O3) snaps to
  the edges and centers of the other elements and of the canvas when it comes
  within a few pixels, and shows a guide line while it does (user decision).
  Holding Alt while dragging turns snapping off for that drag. 격자에 맞추기
  stays as the separate grid option; when both apply, the guide wins (lead
  default).
- The snap distance and the guide line's look are design system values: ui adds
  them to the design system first, and O3 reads them as tokens.
- ProPresenter's slide editor shows alignment tools and X/Y position fields, but
  no source we found says whether its stage layout editor snaps to other
  elements, so this is the user's decision, not a ProPresenter rule.

## 2026-10-26: Bible reference autocomplete first, chunked Bible files

- The Bible reference field follows copible's input flow before any passage
  splitting work starts (user decision): Tab completes the book part to its full
  name and a space ("창" becomes "창세기 "); a single candidate is taken at
  once, and among several the highlighted one is taken; a chapter or verse out
  of range shows its reason in place and blocks output. The single field ("요
  3:16-18") stays. Splitting a long verse into slides marked [계속] (copible's
  slide module) comes after, discussed with the user first.
- Translations are prepared in advance as database files, and a new translation
  arrives as an app update, not through the app (user decision). So 환경설정 has
  no 역본 추가 and no 삭제; the installed list keeps 기본으로.
- A translation file is read in chunks, not whole (user decision): a header with
  the metadata and a chapter offset table, then one block of UTF-8 text per
  chapter. Launch reads only the header; a lookup reads the chapters it needs
  with positioned reads and keeps recent chapters in a capped cache. The October
  25 rule still holds: no Bible text and no file built from a crawl is committed
  to the public repository; the files live in the app data folder.

## 2026-10-26: Decisions from the m3-check3 user check

- No 빈 자리 (slot) items (user decision): "빈 자리라는 걸 왜 두는지 모르겠어,
  그냥 곡 같잖아; 구역을 만들어서 비운 채로 두는 게 합리적". A section (머리글)
  may be empty, the operator adds and removes sections freely, and templates
  hold empty sections. A file that has slot items reads each one as an empty
  section with the slot's title, keeping unknown fields; new writes have no
  slots.
- The section row is called 구역, not 머리글 (user decision: "머리글이라는 표현
  자체가 매우 이상해"): the menu entry is 구역 추가 and a new one is named 새
  구역 in rename mode. ProPresenter calls these playlist Headers; the Korean
  name is the user's choice.
- The Bible reference input has separate fields, 책, 장, 시작절, and 끝절
  (optional), like copible's form, instead of one text field (user decision:
  "사람이 -나 :를 치는 건 번거로워"). Tab moves to the next field and is blocked
  while the value is invalid; Tab in 책 completes the name; changing 시작절
  clears 끝절; an empty 끝절 means one verse; an 끝절 past the chapter's last
  verse becomes the last verse. This replaces the single field of the
  autocomplete decision above.
- Tab in 책 follows copible exactly (`src/data/bible-search.js`): nothing is
  highlighted at first, Tab completes an exact match or a single candidate, and
  with several candidates Tab is blocked until the operator picks one with the
  arrow keys. tools-9 highlighted the first candidate and let Tab take it ("베"
  chose 에베소서); that was a deviation, now corrected. copible lists every
  containment match in canonical order, and so does this app (user decision:
  "카피블하고 동일하게 하면 돼").
- Each clear can fade or not (user decision): the clear keys F1 to F7 and a
  매크로's clear actions (such as 가사만 지우기) each have a fade choice and
  duration; the default stays at once (spec 03 version 1 defaults).
- Dragging rows in every list (예배 순서, 퀵 실행, and the others) places the
  row by the target row's midpoint: over the upper half it goes above that row,
  over the lower half below, so the top of a list is easy to reach. Once the
  pointer passes the drag threshold, releasing never counts as a click, so a
  drag can't select a row or run a 퀵 실행 action (user decision from the
  check).
- Timers are friendly to run from 퀵 실행 (user decision from the check): every
  timer is its own, so adding a timer row creates a new timer and starting one
  never starts another; adding one asks for its time and names it 타이머 1,
  타이머 2, and so on, renamed with 이름 바꾸기; clicking a timer row starts it
  and shows the running time in the row; clicking it again stops it and resets
  it. ProPresenter's Start button toggles Start and Stop with a separate Reset;
  the press-again reset is the user's rule.
- The mouse pointer stays visible over output windows, also with 항상 위 on, and
  항상 위 is a screen option that is off by default (user decisions from the
  check). An output window comes to the front once when its output turns on;
  after that other windows may cover it, and clicking it brings it back.
- Media lives in one bottom 미디어 bin, shown and hidden with a 미디어 toggle,
  in 진행 and in 준비 alike; 준비 no longer switches to a separate media view
  (user decision, replacing open decision 21). ProPresenter 7 reserves the
  bottom of its window for the Media Bin and shows or hides it with the toolbar
  Media button, with playlists in the bin's left column (Renewed Vision,
  "Understanding The ProPresenter User Interface"); no source says whether its
  Edit view shows the bin, so the 준비 part is ours. Importing, playlists, and
  the properties of the selected item work inside the bin. The 미디어 toggle
  must not look like the 진행 and 준비 workspace switch.
- The app is designed for a 1920x1080 window in full screen, and its text is
  sized for that (user decision: "지금 너무 작아, 안 보여"): no UI text under
  14px, body and list rows 16px, titles 18px, headings 22px. The earlier scale
  had 12px labels and captions in about 66 places, the size of the Windows tray
  clock (Segoe UI 9pt at 100%).
- Turning a screen output off hides its window, so that monitor shows the
  Windows desktop (user decision; Renewed Vision's documents and the 7.5 guide
  don't say what ProPresenter shows, so this is not a ProPresenter rule).
- The clear keys are toggles (user decision): pressing F1 to F7 again restores
  what that key cleared. Anything new sent to the output after the clear resets
  the toggle, so the next press clears again. ProPresenter documents F2 as Clear
  Slide with a separate Undo; no source says it toggles, so this is the user's
  rule.
- Turning an output on shows a complete frame at once (spec 03): the output
  window is loaded ahead of time with its background ready, and no dissolve
  plays on reveal (bug M3-C3-1 from the check).

## 2026-10-27: Follow ProPresenter where qa-12 found a difference

- The user approved following ProPresenter for the differences in
  `docs/qa/proposals-vs-pp.md` ("Differences to review first"), and the
  common-sense defaults suggested there for rows with no ProPresenter source.
- 구성 (arrangements) become ProPresenter-style groups: a song's slides belong
  to named groups (1절, 후렴), and an arrangement is an ordered list of groups
  with repeats; the 예배 순서 구성 chips use groups too. Existing songs convert:
  runs of slides with the same label become a group, and an arrangement that
  cuts through a group splits that group so no slide order changes (data defines
  the exact rule).
- Library search results sort alphabetically like ProPresenter. Identify shows
  each screen's name and output details on its monitor. Each countdown has
  ProPresenter's overrun choice; countdown-to can target a date and time; the
  elapsed timer counts up from a start value like a stopwatch. A label hot key
  goes to that particular slide. Copying media into the app on import is an
  option, off by default (ProPresenter's Manage Media Automatically).
- Later, not in this freeze: audio output device selection, NDI outputs, and
  PowerPoint import.

## 2026-10-28: Outline and shadow controls follow ProPresenter

- The lyric style's outline has a width and a color, and its shadow has a blur,
  a distance, an angle, an opacity, and a color, as in ProPresenter (open
  decision 26, option (c)). This unblocks M3-X2.

## 2026-10-28: Each screen draws 메시지 in its own style

- The Look picks a 메시지 style for each screen, as it does the lyric style, and
  a 메시지 sent to several screens draws in each screen's style (open decision
  25, option (a)). The user chose it over ProPresenter's style per 메시지
  template after seeing drafts of both, because it is the most intuitive.
- This unblocks M3-X1.

## 2026-10-28: No migrations before the first release

- The app is in development and no user files exist yet (user decision). A
  change to a file format replaces the format in place: no migration from the
  earlier version, no backup of old files, and no parallel schema for the next
  version. First applied to the Looks format for M3-X1 and M3-X2.

## 2026-10-28: Run a service from the keyboard

- The operator should be able to run a service without the mouse, the way a
  PowerPoint slide show runs from the keyboard (for example G for the slide
  grid). Every frequent 진행 action gets a short, easy shortcut, including the
  Bible panel's 앞 절 추가 and 뒤 절 추가 (user decision).
- Not now: it goes into the M4 shortcut system
  (`docs/spec/10-shortcuts-and-settings.md`), and the user reviews the Bible
  verse flow with the lead before then.
- Bible verse keys, reviewed on 2026-10-30 (user decision): on the last verse of
  the open passage, Shift+→ adds the next verse and outputs it at once, and
  Shift+← does the same on the first verse for the previous verse. In the middle
  of the passage both keys move like the plain arrows, so no verse is skipped
  (user decision during the m3-check6 review, option C over "add the next
  endpoint and jump to it" and "add without output"). A plain → on the passage's
  last verse does nothing, as in copible, so a stray press never outputs an
  unplanned verse. Built with the M4 shortcut system.

## 2026-10-29: The status bar stays empty when nothing needs attention

- The status bar no longer lists the screen names in the normal state; the
  toolbar's output buttons already show which screens are on (user decision
  after a screenshot review, where three dim names read as unexplained text).
- It shows text only for a problem (for example "무대 화면 창으로 표시 중" or
  "방송 자막 41fps") or while the app waits in standby ("대기"), so anything in
  it means something to check. Its text keeps at least 4.5:1 contrast.
- Each message says plainly what is happening, as a short Korean phrase such as
  "저장을 시도하는 중...", not a code or a bare number (user decision).

## 2026-10-29: `playwright-core` drives the UI tests

- The UI tests (M3-V1) use Playwright's Electron support, as `docs/TECH.md`
  plans. Only `playwright-core` is added, as a dev dependency: it drives the
  app's own Electron and downloads no browsers.

## 2026-10-29: M2-8 is not a leak, and the soak test judges held memory

- M2-8 (GPU process memory growing in soak runs) is closed as not a leak in the
  app (user decision). Fast 장 changes with real windows, small and full screen,
  and the unmodified app with the control window, three outputs, and audio kept
  the GPU process, GPU memory, the control window, and the outputs flat. A heap
  snapshot diff of the audio window showed no growing object that the app holds.
- Two things made the soak test fail without a leak. Offscreen drawing grows the
  GPU process (about 8 MB in 10 minutes of fast changes) while none of
  Chromium's own GPU allocations grow. The hidden audio window collects garbage
  rarely, so its memory rose for minutes until one collection brought it back.
- So the recorder collects garbage in every window before each sample, and an
  offscreen run reports the GPU process without judging it (user decision: "이런
  거 실패로 안잡히게 고치자"). A real leak survives the collection and still
  fails the test.

## 2026-10-30: Menus follow ProPresenter, row for row

- Every menu and popover is rebuilt from ProPresenter's own menus, checked in
  Renewed Vision's support articles and tutorial videos (user decision, after
  comparing our 매크로 menu with ProPresenter's: "이게 더 낫잖아 깔끔하고").
  [spec/11-menus.md](spec/11-menus.md) sets the rows; the `Menu` README sets the
  look, measured from ProPresenter.
- A menu has one purpose: it acts on the one thing that was clicked, or adds one
  kind of thing. No palettes, search fields, or setting rows inside a menu. The
  매크로 color row becomes 색 바꾸기, which opens a color popover.
- A ProPresenter row that we don't have yet stays in the menu as a disabled row
  with the tooltip "아직 없는 기능", so the menu keeps its final shape and the
  feature has a place later (user decision: "없는 기능도 일단 disable한 채로
  놔둬야 나중에 기능 개발을 하지").
- A check mark sits in the left padding, so no row keeps an empty leading slot
  and text never moves. This replaces the leading slot that the design system
  added on 2026-10-24.
- Where no ProPresenter screen was found, the menu uses the shape ProPresenter
  gives other named things in a list: its own command | 복제, 이름 바꾸기 |
  삭제.
