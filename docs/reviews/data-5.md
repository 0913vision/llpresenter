# Review request: `data-5` (data-ipc)

- Team member: `data`
- Branch: `feat/data/ipc`
- Base commit (`main`): `4aa7901`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/data.md`; merge queue #10 in `docs/STATUS.md`

Shared changes:

- `src/shared/ipc.ts`: four channels and three `LlpApi` groups.
- `src/shared/live.ts`: `MediaChoice`, and `MediaLayer.startedAt`.
- `src/shared/commands.ts`: `media.show` carries a `MediaChoice`.
- `src/shared/media.ts` (new): media URLs.
- `src/shared/schema/`: `uiState.ts`, `ipcPayloads.ts`, `payload.ts` (new), and
  `sizeClasses` in `appConfig.ts`.
- `src/shared/testing/fakeLlpApi.ts` (new): a complete fake `window.llp`.
- `src/preload/index.ts`: the new API groups.
- `src/renderer/src/shell/Toolbar.test.tsx`,
  `src/renderer/src/show/ShowPanels.test.tsx`, and
  `src/renderer/src/state/show.test.ts` (shell's files, changed with shell's
  permission): `installApi` uses `fakeLlpApi`, with the same behavior.
- `src/shared/schema/liveState.ts` (new, round 2): checks live states that
  arrive from the main process.
- `electron.vite.config.ts` (output's file, changed with output's permission,
  round 3): `build: {externalizeDeps: false}` in the preload block, so the
  preload bundles valibot and runs sandboxed.

## What changed and why

This lands the shared contracts that shell-2 and output-2 build on. Both owners
sent the exact shapes, and this request follows them.

For shell-2 (saving the column widths):

- `ui:get` (invoke) returns `UiState`, the UI part of `app.json`:
  `Pick<AppConfig, 'layout'>`. It can grow to `mediaStrip` and `previewBig`
  without a new channel.
- `ui:layout:set` (send) carries a `LayoutChange`: a size class and integer
  widths in the `Layout` ranges.
- `COLUMN_LIMITS` holds those ranges (left 200 to 400, right 320 to 720). Shell
  imports it in `shell/columns.ts` instead of keeping a copy.
- `parseLayoutChange` and `isLayoutChange` let the main process reject anything
  else and log why.
- `LlpApi.ui` has `get()` and `setLayout(change)`.

For output-2 (output windows):

- `MediaChoice {mediaId, loop}` is what `media.show` carries. `MediaLayer` adds
  `startedAt`, the main process time when the background started. It is optional
  for now (decision 1).
- `log:write` (send) carries a `RendererLogEntry`, so windows log errors instead
  of showing them. `output:frame-rate` (send) carries a `FrameRateReport` once a
  second. Both have `parse` and `is` validators.
- `LlpApi.log.write` and `LlpApi.output.reportFrameRate`.
- `src/shared/media.ts`: `MEDIA_SCHEME` (`llp-media`), `mediaUrl(id)`, and
  `mediaIdFromUrl(url)`, so `<video>` plays library media by id.

## Changed files

- See "Shared changes". Tests: `uiState.test.ts`, `ipcPayloads.test.ts`,
  `media.test.ts`, `fakeLlpApi.test.ts`, and `src/preload/index.test.ts`, which
  checks each API member against its channel with a mocked Electron.
- `docs/reviews/data-5.md` (new).

## Checks run

`npm run verify` on the commit before this document, on `main` 4aa7901: every
step passed. The one skipped test belongs to another member's suite.

| Command or test                    | Result                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| `npm run typecheck`                | Passed                                                                |
| `npm test`                         | Passed: 64 files, 634 tests and 1 skipped                             |
| `npm run format:check`             | Passed                                                                |
| `npm run build`                    | Passed                                                                |
| `npm run verify` (from phase 1 on) | Passed: typecheck, lint, format:check, test:coverage, build (392.6 s) |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: the preload adds no listeners.
- [x] Caches and lists have size caps: none are kept.
- [x] An exception in the output path doesn't stop the output: the validators
      and `mediaIdFromUrl` return results and never throw.
- [x] Only what's needed re-renders (control window): no UI.
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not relevant.

## Decisions I made (for the lead to confirm)

1. `MediaLayer.startedAt` is optional, because a required field would stop
   output's reducer from compiling until output-2. Output chose this. Absent
   means the window starts the background from the beginning. `data-4` makes it
   required once output's stamping is merged.
2. Only `src/shared/schema/` imports valibot, so the main process validates with
   `parseLayoutChange`, `parseRendererLogEntry`, and `parseFrameRateReport`.
   They return `Result<T, PayloadError>` with the failing field. The `is...`
   guards wrap them.
3. IPC payloads keep only their known fields; unknown ones are dropped. Unlike
   files, nothing is written back, and main shouldn't pass along fields it
   doesn't know.
4. `mediaIdFromUrl` accepts only `llp-media://media/<one encoded segment>`, with
   no query or fragment. It returns `null` for anything else, including a
   malformed escape.
5. `fakeLlpApi(overrides)` returns a complete `LlpApi` with no-op members, so a
   new channel never breaks another member's tests again. Shell will switch its
   unmerged `state/show.test.ts` to it after this merges.

## Shared contract change requests

- None beyond this request.

## Where to look

- `src/shared/ipc.ts` and `src/preload/index.ts`: the names and the
  invoke-or-send choice for each channel.
- Decision 1, which leaves `startedAt` optional for now.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (6101a4f): reviewer (Codex, codex3) Request changes: the preload
  passed the `ui.get` reply through without a schema.
- Round 2 (3391430): reviewer Request changes: the sandboxed preload couldn't
  load valibot as an external package, so `window.llp` was never exposed; a root
  `[]` reply became `{}`; TSDoc on an unexported helper.
- Round 3 (fbc27da): reviewer (Codex, codex3) Approve, no findings. qa checked
  the branch in the built app (`window.llp` under the sandbox, bad replies
  logged and defaulted): pass. Lead Approve. The member rebased it onto `main`
  c402184 (c31fa56; one conflict in `primitives.ts`, both sides kept). The
  main-process `log:write` handler comes with output-2, validated, capped, and
  rate-limited.

## Team member's reply

1.

Round 2, reply to the reviewer's finding:

1. Replies are now checked on the receiving side, and I checked every reply the
   preload gets from the main process:
   - `ui.get` checks its reply with `parseUiState`.
   - `live.get` checks its reply with `parseLiveState`, a new schema of
     `LiveState`. `parseLiveState` returns `LiveState`, so the type checker
     confirms the schema never lets through anything the type doesn't allow.
   - States pushed on `live:changed` are checked too.
   - A malformed reply, or a failed invoke, is logged through `log:write` and
     gives the defaults: `{}` for the UI state and the empty live state for
     `live.get`.
   - A malformed pushed state is logged and skipped, so the window keeps the
     last good state.
   - New tests cover malformed replies (a width that is text, an array, no
     reply), a rejected invoke, a malformed live state, and a malformed pushed
     state.
   - The schema tests cover `parseUiState` and `parseLiveState` directly.

Also in this round: shell's show workspace landed on `main` with two more tests
that build a full `LlpApi` by hand. With shell's permission, they now use
`fakeLlpApi` too.

Round 3, replies to the reviewer's findings:

1. Sandboxed preload: fixed. electron-vite 6 externalized valibot, so the built
   preload did `require("valibot")`. With output's permission,
   `electron.vite.config.ts` now sets `build: {externalizeDeps: false}` for the
   preload, as electron-vite's docs say for sandbox support. The built preload
   requires only `electron`.
   - The new test `src/preload/sandbox.test.ts` builds the real preload with the
     real config into a temporary folder. It runs the bundle in a VM that allows
     only the modules a sandboxed preload may require (`electron`, `events`,
     `timers`, `url`) and checks that `window.llp` is exposed.
   - It failed before the fix ("can't require valibot") and passes now.
2. Array replies: every IPC payload's root is now `payloadObject`, which rejects
   arrays and drops unknown fields. A root `[]` for the UI state is logged and
   gives `{}`, with a test.
3. The unexported `invokeChecked` has a NOTE instead of TSDoc.
