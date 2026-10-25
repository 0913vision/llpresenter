Review range: `79313c8...feat/spec/show-service-panel`

# Review request: `spec-24`

- Team member: `spec`
- Branch: `feat/spec/show-service-panel`, from `main`
- Base commit: `79313c8`
- Review round: 1
- Task: `.llp/task.md`, M3-S1a service panel, first slice
- Ownership exception: renderer state and the requested spec-23 copy nit

## What changed and why

Added the service-order editing engine for the upcoming panel integration. It
uses the existing main-owned document reads and `service.update` contract to
reorder any item, remove an item, or insert a library song reference before an
item or at the end. New song references have independent generated ids and
inherit the song's defaults. Headers and unknown item kinds remain editable.

The engine has no output API. Reordering or deleting a live item cannot send an
output command or clear command. No local optimistic document copy replaces the
main-owned projection.

## Undo, races, and failures

- Every write reads the latest document, checks its identity and access, and
  submits its revision. Main still rejects changes made between read and write.
- Whole-document updates preserve current service metadata and unknown fields.
  Moves retain each complete item. Undo restores complete removed items.
- Undo and redo retain at most 100 edits in total. A new edit clears redo; no-op
  moves do not. Only the newest edit's service can be undone, preventing an
  accidental edit of a different open service. `clear()` releases history.
- Undo and redo require the current order to match their expected snapshot. They
  refuse an independently changed order while keeping newer non-order metadata.
  They never silently overwrite another editor's order changes.
- A pending operation excludes another edit. Missing documents, rows, drop
  targets, and songs, read-only documents, IPC rejection, and main refusals
  return explicit results. Pending locks are released after failures.
- An applied `write-failed` result records undo history, because the merged
  contract says that the in-memory edit succeeded. The error is still returned
  for the panel host to report.

## Integration boundary and next slices

This request supplies editing behavior and tests; the existing panel is not
wired to it yet. The next slice mounts list editing in both workspaces and adds
row states and drop handling. Later slices cover the slide header and
`item.start`. These are still required parts of the assigned S1a task.

The lead assigned `service:open` and `LlpApi.service.open({serviceId})` to
data-33: save and push the newly current service, preserve outputs, and return
null without changing anything for an unknown id. The service-picker wiring
waits for the lead's merge announcement. This branch changes no shared contract.

Also changed `useLibrary.ts`'s missing-song title to 곡을 찾을 수 없음, as
requested after spec-23.

## Checks run

| Check                                          | Result                                                  |
| ---------------------------------------------- | ------------------------------------------------------- |
| Editing tests and existing library panel tests | Pass: 30 tests                                          |
| Renderer TypeScript check                      | Pass                                                    |
| Changed-file ESLint and Prettier               | Pass                                                    |
| `git diff --check`                             | Pass                                                    |
| Local full verify                              | Not run, per the lead's rule                            |
| GitHub branch CI                               | Exact submitted HEAD's URL and result are in the report |

The tests cover editing and history bounds, no-op behavior, preservation of
unknown fields and fresh metadata, stale undo and redo, missing and read-only
data, refusal, partial disk failure, concurrent requests, and output isolation.
No Electron process, visible window, soak, or memory measurement was started.

## Where to look

- `src/renderer/src/state/serviceOrderEdits.ts`: revision and undo guards.
- `src/renderer/src/state/serviceOrderEdits.test.ts`: failure and race cases.
- `src/renderer/src/prep/library/useLibrary.ts`: the authorized copy nit only.

The submitted branch was rebased once onto `main`. The exact submitted HEAD
requires green GitHub CI; its run URL and result are recorded in the report
without adding a new unverified commit for CI metadata.

## Verdicts (recorded by the lead at merge)

- Round 1 (afa4efb): reviewer (Claude, trial-97) Approve. Two nits for the next
  S1a part: `src/renderer/src/state/serviceOrderEdits.ts:183` `catch {` drops
  the cause; pass its message into the result or log it through
  `window.llp.log`. `:38` compares orders with `JSON.stringify`, which depends
  on key order; compare structurally or record `after` from the document main
  holds after the save, and note in the TSDoc that a later change to an item's
  own fields makes undo refuse with `stale`. Lead Approve. Written by the Codex
  session that took over spec's work, under the lead's exception for shell's
  paths. Rebased by the lead onto local `main` without conflicts.
