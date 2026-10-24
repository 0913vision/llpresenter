# Review request: `data-5` (data-ipc)

- Team member: `data`
- Branch: `feat/data/ipc`, stacked on `data-1` (`feat/data/schemas`)
- Base commit (`main`): `5cfd4f4`
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
- `src/renderer/src/shell/Toolbar.test.tsx` (shell's file, changed with shell's
  permission): `installApi` uses `fakeLlpApi`, with the same behavior.

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

`npm run verify` on the commit before this document, on `main` 5cfd4f4 with
`data-1` below it: every step passed.

| Command or test                    | Result                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| `npm run typecheck`                | Passed                                                                |
| `npm test`                         | Passed: 32 files, 338 tests                                           |
| `npm run format:check`             | Passed                                                                |
| `npm run build`                    | Passed                                                                |
| `npm run verify` (from phase 1 on) | Passed: typecheck, lint, format:check, test:coverage, build (102.0 s) |

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

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1.
