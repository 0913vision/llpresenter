# Review request: `output-33`

- Team member: `output`
- Branch: `feat/output/look-render`
- Base and range: in the review request message.
- Scope: M3-O4 rest. Each output window and each 진행 screen preview draws with
  its screen's card of the current Look; the five fallback rules (lead decision,
  October 26) in code and in spec 03; output-28's nits; output-31's nit.
- GitHub CI of the head commit: the URL and result are in the review request
  message.

## What changed and why

output-27 and output-28 put the current Look into the live state
(`LiveState.lookId`) and saved the selection. The renderer still drew every
screen with every layer and the 기본 style. Spec 03 "Looks" asks each screen to
show only the layers its card turns on, with the card's lyric style, and a solid
color in place of the media where the card says so (the 방송 자막 green).

### Resolving a screen's Look (`screenLook.ts`)

`resolveScreenLook(looks, lookId, screenId)` is pure. It returns the card's
layer switches, its lyric style, and its background color, or null to draw as
before Looks, and names any gap it drew around. The rules, now in spec 03 "When
a Look can't be resolved":

1. A live Look that no longer exists falls back to `looks.current`; if that is
   gone too, there is no Look.
2. No Look, or `looks.json` unread or unreadable: every layer, 기본 style, media
   background, chroma for a capture window (the drawing before this request).
3. A Look without a card for the screen: as rule 2, and a `no-card` gap.
4. A card whose lyric style is gone: the 기본 style, and a `missing-style` gap.
5. The 무대 화면 draws lyrics in 기본 until stage layouts arrive, whatever lyric
   style its card names, and rule 4 doesn't log for it.

`showsLayer` reads an absent switch as hidden (the `ScreenLook` contract) and
hides the media layer behind a color background.

### Following the settings (`settingsFeed.ts`, `screenFrames.ts`)

`followSettingsDocument` is the revision-safe follower that `followRenderScreen`
had inline (subscribe first, read, drop an older revision or another document,
drop everything after stop); `followRenderScreen` now uses it, and so does the
Looks feed. `ScreenFrames` follows `screens.json` and `looks.json` for one
screen and turns a live state into its `RenderFrame`. It resolves the Look again
only when the Looks, the live Look, or the screen change, so a live change costs
one comparison. Gaps go to `onGap` once per screen, kind, and id, at most 32
until `looks.json` changes, which clears the set so a fixed file can warn again
(lead's addition b).

### Drawing (`outputRenderer.ts`, layers)

Each layer module names the Look switch that shows it (`look: 'slide'`, and so
on). The renderer toggles one class on the layer's box when its visibility
changes: `opacity: 0`, so the layer keeps drawing, keeps its layout and video
playback, and comes back at once on the next Look; a descendant's own visibility
can't override it (a NOTE). A Look color sets the root background and hides the
media box. The lyrics layer applies the frame's style before it shows the
슬라이드 (`setStyle` changes the pages in place, without a dissolve). A Look
change therefore changes every screen in the same broadcast, without a
transition, and content hidden by a Look stays in the live state, so it still
counts as something to clear.

### Wiring

`startOutput` and the 진행 `ScreenPreview` both draw with `ScreenFrames`, so the
previews match the outputs. Gaps are logged at warn level from each.

### Nits

- output-28: `look.set` before the settings connect, alone and in a batch, is
  skipped and logged while the rest of the batch applies; a live Look deleted in
  화면 설정 is replaced by the next choice, and choosing the deleted one is a
  missing target; `lookSelection.ts` warns only for a refused save, since the
  settings persistence logs a failed write itself (a NOTE).
- output-31: `slices.test.ts` imports each module by a file URL built at run
  time, which Vite can't rewrite into a cached glob. Reproduced again with the
  cache forced on and a temporary probe slice: the check now fails on the
  unhandled `timer.start` itself, not on a failed import. A second assertion
  makes sure every module yields commands, so the check can't pass empty.

## Changed files

- `src/renderer/src/render/screenLook.ts`, `screenFrames.ts`, `settingsFeed.ts`
  and their tests (new).
- `src/renderer/src/render/screenIdentity.ts`: the screen feed through the
  shared follower.
- `src/renderer/src/render/layer.ts`, `outputRenderer.ts`, `classes.ts`,
  `layers.module.css`, `layers/*.ts`, and the renderer and preview overlay
  tests.
- `src/renderer/src/output/startOutput.ts` and its test.
- `src/main/live/lookSelection.ts` and its test.
- `src/main/live/slices.test.ts`.

## Changes outside my paths

- `src/renderer/src/show/ScreenPreview.tsx` (shell): draw the preview with
  `ScreenFrames` instead of the screen feed alone, so a preview shows the same
  Look as its output; the TODO now covers only the stage layout.
- `docs/spec/03-output.md` (spec): the five rules and the log rule, each marked
  "(lead decision, October 26)", at the lead's request.

## Checks run

| Command or test                                                  | Result                                   |
| ---------------------------------------------------------------- | ---------------------------------------- |
| `npm run typecheck`                                              | Pass                                     |
| `npx vitest run src/renderer src/main/live`                      | Pass, 1,666 tests in 152 files           |
| `npx eslint` and `npx prettier --check` on the changed files     | Pass                                     |
| Mutation checks (`.llp/output-33/mutations.log` in the worktree) | 16 mutations, all fail a test            |
| `npm run verify`                                                 | GitHub CI only (see the request message) |

No local Electron, visible window, soak, or memory run.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (GitHub CI, see the request message)
- [x] `npm run format:check` passes (changed files)
- [x] Every new behavior has unit tests
- [x] Values from outside the process are validated with a schema (settings
      documents come through the preload's parsers)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every subscription is released (`ScreenFrames.dispose` stops both feeds;
      tests count the releases)
- [x] Caches and lists have size caps (the gap set holds at most 32 keys; the
      appearance cache holds one entry)
- [x] An exception in the output path doesn't stop the output (a settings gap
      draws as before Looks; layer errors stay isolated)
- [x] Only what's needed re-renders (one class toggle per visibility change; no
      new DOM, no dissolve for a Look change)
- [x] The clean code rules and comment rules in `CLAUDE.md` hold
- [x] The change is small and focused

## Decisions I made (for the lead to confirm)

1. Hidden layers use `opacity: 0` on the layer box rather than `visibility` or
   `display`, so measurement and video playback continue and no descendant can
   show through.
2. An absent lyric style on a card isn't a gap (the 무대 화면 card has none);
   only an id that points nowhere is.
3. The preview logs gaps too, with the same bound; an output and its preview can
   each log the same gap once.

## Shared contract change requests

None.

## Where to look

- `screenLook.ts`: the fallback order.
- `screenFrames.ts`: the cache key and the gap set.
- `outputRenderer.ts`: `setHidden` and `setBackground`.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex, codex4): Request changes: a 무대 화면 could draw with an
  audience Look card's lyric style.
- Round 2 (d4688074): reviewer (Codex, codex4) Approve, no findings; the stage
  style rule has regression tests, including an audience screen that turns
  stage. Lead Approve; the five fallback rules in spec 03 are the lead decisions
  of October 26. Changes outside output's paths (`show/ScreenPreview.tsx`,
  spec 03) checked against their owners' rules. Rebased by the lead onto local
  `main` without conflicts; typecheck passes. M3-O4 is complete.

## Team member's reply

Round 1 (codex4, Request changes):

1. [P2] `screenLook.ts`: fixed in `205d13b9`. `resolveScreenLook` takes the
   screen's id and kind; a 무대 화면 always draws with the 기본 style and logs
   no missing-style gap, with a `TODO(0913vision)` for M3-O5's stage layouts.
   `ScreenFrames` passes the resolved screen, whose identity changes on a
   `screens.json` change, so a kind change re-resolves at once. Regression
   tests: a stage screen whose card names the lower-third style, and your
   sequence through `ScreenFrames` (an audience screen with a lower-third card
   becomes stage while the card stays). Both fail against the previous code.
