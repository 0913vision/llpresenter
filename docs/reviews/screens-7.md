# Review request: `screens-7`

- Team member: `screens`
- Branch: `feat/screens/look-list-model`
- Base commit (`main`): `eb61e600`
- Last commit, review range and CI: see the request line.
- Related brief: `docs/briefs/screens.md`, M3-O2, first implementation unit.

## What changed and why

Adds the Look lifecycle model and its queued settings session. The following UI
unit will connect these operations to the existing Look list and its menus.
Separating that UI keeps the lifecycle and shutdown rules reviewable together.

- Add copies the live current Look as 새 Look; duplicate copies the selected
  Look as `<name> 복사본`. Generated names use a numbered suffix when taken.
  Both preserve the original Look, styles and file fields and leave `current`
  unchanged.
- Rename trims the name, rejecting blank or taken names. Missing targets and
  duplicate ids return explicit problems.
- Delete protects both the saved and live current Look. A macro reference
  requires confirmation and reports the referencing macro names. Checks run
  against the current live context when a queued edit executes.
- Creation stops at 1,000 Looks. Existing larger imported lists can still be
  renamed or reduced; this does not change a shared file schema.

`SettingsDocumentEditor` extracts the screen editor's revision tracking,
serialized writes, read-only guard, PendingWrites registration and failure
handling for reuse by the Look session. Its typed update factory is restricted
to the matching settings file. `ScreenEditor` keeps its public methods and
monitor publication snapshots and delegates persistence to this shared writer.
An accepted change that fails only on disk still advances the local revision and
reports the failure, leaving main's save/close handling to retry it.

`ScreenEditor` keeps its constructor, `adopt`, `observeMonitors`, `change` and
`assign` signatures. Selection is unchanged. The lead was notified because
output now owns M3-O3 and shares these 화면 설정 patterns.

## Changed files

- `src/renderer/src/screens/looks/lookListEdits.ts` and tests: pure lifecycle
  operations, references, validation and creation cap.
- `looks/lookListEditor.ts` and tests: fresh context, serialized persistence,
  close flushing and read-only access.
- `settingsDocumentEditor.ts`, `screenEditor.ts`: shared persistence and the
  existing screen adapter. Existing screen regressions cover the extraction.
- `screenEdits.ts`: reuse name validation for named items, with the same screen
  behavior.
- `assignScreenMonitor.ts`: clarify the snapshot field's documentation.
- `docs/reviews/screens-7.md`: this request.
- Changes outside my paths: none. Shared IPC and file schemas are unchanged.

## Checks run

After rebasing onto `eb61e600`, typecheck and targeted ESLint pass. All 143
screens tests pass, including the Look lifecycle/session tests and existing
screen, publication race and focused-close regressions. The final request
reports checks after rebase, formatting and exact-head GitHub CI.

## Quality checklist

- [x] Lifecycle and persistence behavior has tests.
- [x] The shared writer registers work before waiting for its queue.
- [x] Saved values, untouched styles and unknown file fields are preserved.
- [x] Context is read when a queued change executes, preventing stale deletes.
- [x] No new dependencies, subscriptions, timers or output commands.
- [x] Existing screen persistence uses the same shared writer.
- [ ] Exact-head CI passes; see request line and the lead's API-403 protocol.

## Decisions and open points

1. The 1,000-item cap limits creation only, without changing the shared file
   contract or making existing imported data unusable.
2. Protecting both saved and live current ids also covers the short interval
   before a live selection is reflected in the settings document.
3. This unit provides the lifecycle and save path. List menus, per-screen cards
   and lyric-style controls follow in separate M3-O2 requests.

## Verdicts (recorded by the lead at merge)

- Round 1 (974c849b): reviewer (Codex) Approve. Lead Approve (see "What changed
  and why"); the exact-head CI run passed, checked by the lead at merge. Rebased
  by the lead onto local `main` without conflicts; typecheck passes.

## Team member's reply

1.
