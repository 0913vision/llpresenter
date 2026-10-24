# Review request: `shell-6`

- Team member: `shell`
- Branch: `feat/shell/show-header` (stacked on `feat/shell/show-keys`, shell-5)
- Base commit: the last commit of shell-5 round 2 (`7ae5576`). It merges after
  shell-5.
- Last commit: see the commit that adds this file
- Related brief: the lead's queue (the 썸네일 크기 slider and the 장 panel
  header)

## What changed and why

Two pieces of the 장 panel (`docs/spec/04-show.md`, "장 panel"), built with
placeholders until the `ui` components merge.

1. **Header.** After the tab name, the panel header shows the name of the open
   item and a position: "2 / 9" when the open item is the live one, and the 장
   count ("9장") otherwise. It shows nothing when no item is open.
2. **썸네일 크기 slider.** A range input in a new footer row of the panel, from
   2 to 8 columns. It moves right for larger thumbnails, so a right position is
   fewer columns (the design system `SlideThumbnail` README: column count is 10
   minus the slider value). The columns are kept per size class in the show
   store, start at the design system default (narrow 3, normal 4, wide 6), and
   stay between 2 and 8. The grid follows the slider.

`Workspace` now describes a panel with `PanelParts` (body, meta, footer) instead
of only a body.

## Changed files

- `src/renderer/src/show/SlidePanel.tsx`, `SlidePanel.module.css`,
  `SlidePanel.test.tsx` (new)
- `src/renderer/src/state/show.ts` (the columns, `setThumbnailColumns`,
  `useThumbnailColumns`)
- `src/renderer/src/shell/Workspace.tsx`, `Workspace.module.css`

## Checks run

`npm run verify` on commit `3b4379e` (stacked on shell-5, `5e61f69`) passed all
five steps in 162.0 s: `typecheck`, `lint`, `format:check`, `test:coverage`, and
`build`.

Tests in `SlidePanel.test.tsx` (10): the header with no item, a non-live item,
the live position, another live item, and following the open item; the default
columns per size class; the 2 to 8 limits and the per size class memory; the
slider direction; and the grid following the slider.

### Running app (port 5187)

At 1920x1080 with real mouse events: with no item open the header shows only
"장"; after opening an item it shows the name and "4장"; after clicking a tile
it shows "2 / 4"; a click on the right end of the slider made 2 columns, and on
the left end 8 columns.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Checks run")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (none)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (nothing new is registered)
- [x] Caches and lists have size caps (the columns map has at most 3 entries)
- [x] An exception in the output path doesn't stop the output (not touched)
- [x] Only what's needed re-renders (selectors return primitives)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- The slider is a native `input[type=range]` and the footer is a plain row. Both
  are placeholders for the `ui` `Slider` and `Panel`.
- The chosen columns live in memory only. Saving them needs a `columns` field in
  the `ui:layout:set` change, which `shell-3` does not carry (`LayoutChange` has
  only `left` and `right`). I will ask data when `shell-3` is sent.

## Shared contract change requests

- None now. See the last decision about `columns` in `LayoutChange`.

## Where to look

- `SlidePanel.tsx` (the direction of the slider) and `state/show.ts` (the
  limits).

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (8f0dc14): reviewer (Codex, codex4) Request changes: the slider took
  keyboard focus and stopped the live keys, TSDoc on unexported code, and the
  footer used the header size.
- Round 2 (d27678d): reviewer (Codex, codex4) Approve, no findings. Lead
  Approve. Rebased by the lead onto local `main` with `--onto` (shell-5 had
  moved) without conflicts.

## Team member's reply

Round 1 (codex4), answered once:

1. Finding 1 (the slider takes the keyboard focus): fixed. The slider notes the
   focused element on pointer down and puts the focus back on pointer up (it
   blurs itself when nothing had focus), so the live keys, which stay off in a
   text field, keep working after a mouse use. Tab still reaches the slider, and
   keyboard use of it is unchanged. Tests in `Workspace.test.tsx`: "keeps the
   live keys working after the thumbnail slider is used with the mouse" (the
   workspace test of the finding: a tile has focus, the slider is used, and
   Space still outputs the next 장) and "blurs the slider after the mouse when
   nothing had focus, and Tab can still reach it". In the running app, after
   clicking a tile and then the slider, the focus stayed on the tile and Space
   moved the live 장.
2. Finding 2 (TSDoc on unexported names): removed from `PanelParts` and from
   `ShowView.thumbnailColumns`. The names carry the meaning, and the one fact
   that a name cannot carry (why the slider gives its focus back) is a
   `NOTE(0913vision)` in `SlidePanel.tsx`.
3. Finding 3 (nit, footer height): the footer uses `--size-panel-footer` (32
   px).
4. Restack: rebased onto the new shell-5 (round 2, `7ae5576`) with
   `git rebase --onto`, without conflicts.
5. Round 2: `npm run verify` on commit `431db21` (stacked on shell-5 round 2,
   `7ae5576`) passed all five steps in 179.8 s: `typecheck`, `lint`,
   `format:check`, `test:coverage`, and `build`.
