# Review request: `shell-3`

- Team member: `shell`
- Branch: `feat/shell/ui-state-ipc`
- Base commit (`main`): `b9392d0` (it has data-5)
- Last commit: see the commit that adds this file
- Related brief: the lead's queue (the UI state IPC and the `app.json` store for
  the column widths)

## What changed and why

The column widths now survive a restart. The renderer asks the main process for
the saved UI state once before the first render, and sends the widths of a size
class when a drag ends. The channels, the schemas, and the preload come from
data-5 (`ui:get`, `ui:layout:set`, `UiState`, `LayoutChange`, `COLUMN_LIMITS`);
this change uses them.

### Main process (`src/main/uiState/`)

1. `UiStateStore` keeps the `app.json` config in memory. `load()` reads the
   file; `setLayout(value)` validates the value with `parseLayoutChange`, merges
   it into `layout.<size class>` (keeping `columns`, other classes, other
   fields, and unknown fields), and schedules one write 500 ms after the last
   change; `flush()` writes at once; `dispose()` stops the timer. Writes go
   through a promise chain, so two writes never overlap, and a failed write is
   logged and never thrown.
2. **It never replaces a file it could not read** (the lead's rule). A file that
   is not JSON, is of another kind, breaks the schema, comes from a newer schema
   version, or cannot be read is left untouched: one warning is logged, the
   widths changed in that session stay in memory, and nothing is ever written.
3. `writeFileAtomic` writes a temporary file, flushes it to disk, and renames it
   over the file, and removes the temporary file if anything fails.
4. `registerUiState(file, log)` loads the file, registers `ui:get` and
   `ui:layout:set`, and flushes pending changes in `before-quit`. Its
   `dispose()` removes the channels, flushes, and only then removes the
   `before-quit` listener: removing it earlier let `window-all-closed` quit the
   app in the middle of the write (found in the running app, see below).

### Renderer

5. `createIpcColumnWidthStore(initial, send)` is the `ColumnWidthStore` over the
   saved state. `load` returns the saved pair of widths of a size class (a class
   without both widths gives the defaults), and `save` sends whole pixels and
   remembers them. The main process rejects fractions, and a drag can end on a
   fraction at 125% display scaling.
6. `loadColumnWidthStore(window.llp)` reads the state, falls back to an
   in-memory store outside Electron, and logs a failed read and starts from the
   defaults. `control/main.tsx` waits for it before the first render, and `App`
   takes the store as a prop.
7. `shell/sizeClass.ts` re-exports the shared `SizeClass` type, and
   `shell/columns.ts` takes its ranges from `COLUMN_LIMITS`, so there is one
   copy of each.

## Changed files

- `src/main/uiState/` (new): `UiStateStore`, `atomicWrite`, `fileIo`,
  `register`, and the tests
- `src/renderer/src/shell/`: `columnWidthStore.ts`, `loadColumnWidthStore.ts`,
  `columns.ts`, `sizeClass.ts`, and `columnWidthStore.test.ts`
- `src/renderer/src/control/App.tsx`, `main.tsx`

## Needed from output (not in this change)

`src/main/index.ts` is output's file. It must call `registerUiState` before the
control window opens, and its `closed` handler must dispose it before the log
flush:

```ts
const ui = await registerUiState(join(app.getPath('userData'), 'app.json'), log);
// ... in the `closed` handler:
ui.dispose().then(() => log.flush()).then(() => app.quit(), ...);
```

I tested it with that exact wiring applied locally and then reverted it. The
patch is in the lead's hands (message of the first request). Until output wires
it, `ui:get` has no handler and the renderer starts from the defaults (the
failure is logged).

## Checks run

`npm run verify` on commit `613b599` (base `main` b9392d0, which has data-5)
passed all five steps in 274.5 s: `typecheck`, `lint`, `format:check`,
`test:coverage`, and `build`.

Tests: `uiStateStore.test.ts` (14: merging, unknown fields, other classes, the
burst of changes, flush, malformed changes, a failed write, dispose, and the
files it must not replace), `atomicWrite.test.ts` (4), `register.test.ts` (7,
with a mocked `electron`), and `columnWidthStore.test.ts` (9).

### Running app (port 5187, app data `D:\llp-dev\shell`)

With the wiring applied locally: dragging the left gap and closing the window at
once wrote `app.json` (`layout.normal.left` and `right`) before the app quit,
and starting the app again showed the same widths. The first try lost the write:
the app quit while the temporary file was still empty. That is why `dispose()`
keeps the `before-quit` listener until the flush is done. After the fix, a
change made just before closing was saved every time I tried.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Checks run")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (`app.json`
      with `parseAppConfig`, and each layout change with `parseLayoutChange`)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (`dispose()` removes the channels, the
      timer, and the `before-quit` listener)
- [x] Caches and lists have size caps (the store holds at most three size
      classes)
- [x] An exception in the output path doesn't stop the output (a failed write or
      read is logged and never thrown)
- [x] Only what's needed re-renders (not touched)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md` (TSDoc on exports only)
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- The write waits 500 ms after the last change, and a quit flushes at once.
- `atomicWrite.ts` is in `src/main/uiState/` because `src/main/store/` does not
  exist yet. It can move there, with `fileIo.ts`, when data adds a shared file
  store.
- A readable file from a newer schema version counts as one that must not be
  replaced, even when it fits the schema (`access: 'readOnly'`).
- `columns` is not saved yet. It needs the `columns` field in `LayoutChange`
  (the lead asked data for it in data-6).

## Shared contract change requests

- None for this change (see the `columns` decision above).

## Where to look

- `uiStateStore.ts`: `load` and the rule that keeps the file untouched.
- `register.ts`: the order in `dispose()`.
- `columnWidthStore.ts`: the rounding.

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
