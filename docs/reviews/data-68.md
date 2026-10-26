# Review request: `data-68`

- Team member: data
- Branch: `feat/data/media-ui-state`
- Base commit: `eb61e600` on local `main`; final range and head are in the
  member report.
- Related brief: P6b restart list, saved media columns and 준비 media choice.

## What changed and why

This request adds the bounded persistence contract for the next media view
change. Optional app-local `prepMedia` stores the 준비 toolbar's media mode
separately from 진행's `mediaStrip`. Optional `mediaBrowser` stores columns
(integer 2 to 8) and view (`grid` or `list`). Shared defaults are false for prep
media, five columns and grid view; reading an older file adds no fields.

`ui:prep-media:set` and `ui:media-browser:set` are additive one-way channels.
Preload and main validate their payloads, discard unrelated keys, and reject
empty browser changes. `ui:get` carries the new optional state and validates it
on receipt. The fake API supplies the new setters.

The existing UI state store merges only the supplied browser fields into the
latest state. A view-only update retains columns and unknown file metadata;
other visibility, layout, location, service and zoom fields stay with their
existing owners. AppConfigFile remains the only writer, using its existing
autosave, atomic writes, close flush and failed-write retry. Registration
disposal removes both new listeners.

The following renderer request seeds these fields before rendering and wires the
toolbar, media grid/list toggle and audio track list. This request only adds the
schemas, transport and persistence path. It adds no renderer controls,
dependencies or second state file.

## Changes outside my paths

- `src/main/uiState/uiStateStore.ts`, `register.ts` and their tests are
  shell-owned. They expose the validated state through the existing registration
  and shared app.json writer. The restart task explicitly assigns media UI state
  persistence to data.
- `docs/spec/02-data.md` is spec-owned. It documents the two optional UI fields,
  their bounds/defaults and their separation from lyric thumbnail scaling.

Shared contracts, preload, appConfigFile and their tests are data-owned.

## Checks

- Related schema, UI store/registration, app.json, preload and fake tests: 230
  pass.
- Node and web TypeScript check: pass.
- Changed-file ESLint, formatting and diff checks: final results in report.
- Full verify: CI pending (API 403), under the lead's updated protocol. The lead
  confirms the exact request head before merging.

Tests cover numeric/enum/boolean bounds, invalid and empty messages,
sender/receiver checks, independent strip/prep choices, interleaved partial
updates, listener cleanup, unknown metadata retention, unchanged legacy files,
and save/reopen alongside service, layout, zoom and other app fields.

## Team member's reply

1.

## Verdicts (recorded by the lead at merge)

- Round 1 (b0588726): reviewer (Codex, codex2) Approve. Lead Approve (see "What
  changed and why"); the exact-head CI run passed, checked by the lead at merge.
  Rebased by the lead onto local `main` without conflicts; typecheck passes.
