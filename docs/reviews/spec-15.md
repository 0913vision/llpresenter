Review range: `b7c61e3...style/spec/type-scale`

# Review request: `spec-15`

- Team member: `spec`
- Branch: `style/spec/type-scale`, from `main` (not stacked)
- Base commit (`main`): `b7c61e3`
- Shared files changed: the approved design/app token sources, token contract
  tests, and the three font-only CSS changes listed below
- Last commit: the commit that completes this request
- Task: `.llp/task.md`, chosen M2 check 1 Windows type scale

## What changed and why

The user found text too small at 1920 x 1080 with Windows scaling at 100% and
chose the type proposal in `design/drafts/m2-check1/`. UI text now starts at
12px, with body 14/20 and caption 12/16. Pretendard and the existing token names
stay in place, so their consumers receive the selected scale together.

The JSON source, generated design CSS, and mirrored app CSS agree. Only the
Typography section of the design system README changes. Thumbnail/output picture
text retains its relative scale; `thumb-lyrics` stays 4.4cqw/1.45/700. The
service-order name from spec-14 stays at its chosen 16/22/600.

| Token            | Before: size/line height/weight | After     | Components affected                                                                                       |
| ---------------- | ------------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| `heading`        | 16/22/600                       | 18/24/600 | Confirmation headings and Preferences headings                                                            |
| `title`          | 13/18/600                       | 14/20/600 | Dialog and notification titles, title fields, panel song titles                                           |
| `body`           | 13/18/400                       | 14/20/400 | Default text, list rows, menus, md buttons, text fields, selects, checkbox labels                         |
| `body-strong`    | 13/18/600                       | 14/20/600 | Primary md buttons and emphasized macro/list text                                                         |
| `label`          | 12/16/400                       | 12/16/400 | Unchanged sm control labels and property names                                                            |
| `label-strong`   | 12/16/600                       | 14/20/600 | Panel tabs, sm primary buttons, preview names, dialog tabs, macro names                                   |
| `band`           | 12/16/700                       | 14/20/600 | Slide bands, arrangement chips, menu-bar wordmark                                                         |
| `caption`        | 11/14/400                       | 12/16/400 | Status bar, dates, durations, footers, small preview captions, secondary row text                         |
| `caption-strong` | 11/14/600                       | 14/20/600 | List group headings, clear-button names, keycaps, count badges, property group headings, media tile names |
| `toolbar-label`  | 11/14/500                       | 12/16/400 | Regular toolbar button labels                                                                             |
| `micro`          | 10/12/700                       | 12/16/400 | LIVE badge                                                                                                |

These are font and line-height changes. Existing control and panel height tokens
remain unchanged; group headings can grow naturally with their line height. No
component token names were renamed, and the slider/text-field implementation
being handled by ui is untouched.

## Font-only CSS exceptions

The lead explicitly approved these three remaining literal-font declarations so
the actual app follows the selected draft:

- `src/renderer/src/styles/base.css`: body font family, size, and line height
  become `font: var(--type-body)`.
- `src/renderer/src/shell/Workspace.module.css`: the generic panel tab's size,
  line height, and weight become `font: var(--type-label-strong)`.
- `src/renderer/src/shell/StatusBar.module.css`: status text size and line
  height become `font: var(--type-caption)`.

No other declarations in those three files change.

## Offscreen checks

Rendered the actual current `App`, with its real CSS, shared components, and
output-preview renderer, using an invented in-memory sample service and a fake
API. The fixture has 16 slides, several service groups, and all three outputs
marked on in memory. It never connects to production data or creates real output
windows. Every Electron window uses `show: false`, `skipTaskbar: true`, and
`webPreferences.offscreen: true`; the helper refuses to start without
`LLP_TEST_WINDOWS=offscreen` and passed `node --check` before launch.

The local ignored harness, screenshots, and JSON checks are under
`.llp/type-scale/` in this worktree. Existing draft screenshots were not
overwritten. It binds Vite only to loopback on an automatically assigned port
and closes its window and server when done.

| Viewport             | Fixture             | Visible UI text samples | Minimum UI font | Result                               |
| -------------------- | ------------------- | ----------------------- | --------------- | ------------------------------------ |
| 1920 x 1080, scale 1 | Normal service name | 68                      | 12px            | Pass                                 |
| 1920 x 1080, scale 1 | Long service name   | 68                      | 12px            | Pass, intended service-name ellipsis |
| 1280 x 720, scale 1  | Normal service name | 48                      | 12px            | Pass                                 |
| 1280 x 720, scale 1  | Long service name   | 48                      | 12px            | Pass, intended service-name ellipsis |

Checked:

- The document width and height equal the viewport; panel rectangles stay within
  it. The toolbar, panel headers, and status bar fit at both sizes.
- Visible UI text has no font below 12px and no unexpected horizontal clipping
  or text outside its containing control's height. Text inside slide/output
  pictures is excluded from the UI minimum, as the chosen draft requires.
- Body text computes to 14/20; the service header remains 34px high with
  16/22/600 text. Long names use `text-overflow: ellipsis`.
- The existing vertical scrolling stays inside service/slide bodies. Intentional
  scroll overflow and ellipsis are allowed; the surrounding controls fit.
- The lower 진행 도구 panel is 240px high in the 1280 x 720 capture, retaining
  its minimum. The preview names, slide bands, LIVE badge, and clear controls
  fit their existing heights.
- No renderer console errors. The PNGs for both normal-size captures were
  inspected visually as well as checked by script.

Artifacts: `.llp/type-scale/renders/1920x1080.png`, `1920x1080-long.png`,
`1280x720.png`, `1280x720-long.png`, `checks.json`, and `errors.json`. These
validate the 진행 workspace in the specified fixtures; they do not claim a
screenshot audit of every dialog and future settings page.

## Changed files

- `design/system/project/tokens.json`, generated `tokens.css`, and the
  Typography section of `README.md`.
- `src/renderer/src/styles/tokens.css` and `base.css`.
- `src/renderer/src/styles/designSystemAssets.node.test.ts`.
- `src/renderer/src/shell/Workspace.module.css` and `StatusBar.module.css`.
- `docs/reviews/spec-15.md`.

## Checks run

| Check                                   | Result                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused token/asset contract tests      | Pass: 1 file, 17 tests; source scale, all 12 shorthand/preview classes in both CSS copies, 12px UI minimum, existing font files and license |
| Offscreen renders                       | Pass: four captures, two viewports, normal/long names, zero audit issues or renderer console errors                                         |
| `git diff --check`                      | Pass                                                                                                                                        |
| `npm run verify`                        | Ran once: build, typecheck, format, and full coverage passed; lint failed on the new test callback having four parameters (maximum three)   |
| `npm run lint` after the fix            | Pass after changing the callback to one object argument in `9fbc4ff`                                                                        |
| `npm run typecheck` after the fix       | Pass                                                                                                                                        |
| Focused token/asset tests after the fix | Pass: 17 tests                                                                                                                              |

No dependencies, persistence, IPC, or output behavior change. The only
exceptions to the UI minimum are the deliberately scaled output pictures; their
existing typography token is pinned unchanged by the contract test.

The single full run's passing steps were build (6.2 s), typecheck (9.5 s),
format (101.8 s), and full coverage (299.8 s). The only failure was lint's
parameter-count rule in the new contract test. Commit `9fbc4ff` changes the
test-case argument shape; tokens and CSS remain exactly as rendered and tested
by the full coverage run. Lint, typecheck, and the affected tests pass after
that fix. Full verify was not run a second time, following the task's one-run
instruction.
