# Review request: `output-56`

- Team member: `output`
- Branch: `feat/output/clear-fade-options`
- Base, head, range and CI: in the request message.
- Scope: the m3-check3 user decision for clear fades, following output-55.

## What changed and why

F1 to F7 read independent fade choices from `preferences.clearKeys`. Macro
`clearAll` and `clearLayer` actions carry their own optional `transition`,
including an individual prop target. Missing options, disabled fades and zero
milliseconds clear at once. Macro options do not inherit key settings. Timing
uses integer milliseconds up to 30,000; a newly enabled option defaults to 500.

The logical state clears immediately. Main sends only bounded target/timing
metadata, with no duplicate cleared payload in IPC. Each renderer retains at
most six outgoing layers and 64 outgoing props, uses its synchronized monotonic
clock and one animation frame callback, then releases the outgoing content.
Restore and replacement cancel the corresponding fade. Prop fades preserve
neighbor opacity and order; a stage lyrics fade affects current/next lyrics and
labels, leaving clocks, timers and stage messages alone. Cleared notice rotation
and video hold their frame. Restoring the same background reloads and rejoins
its captured playback position. Audio defaults to instant stop and uses the
configured remaining duration when fading, without reviving a cleared fallback.
Manual three-second audio fade behavior remains separate.

## Changes outside my paths

- `src/shared/commands.ts`, `live.ts` and clear/payload/settings schemas:
  additive optional transition fields and bounded live timing metadata, with
  valid, invalid, default and round-trip tests. Unknown stored option fields
  survive.
- `src/main/macros/actions.ts`, `compiler.ts` and compiler tests: carry explicit
  macro timing and project an individual prop clear before a later toggle.
- `src/shared/schema/preferences.ts`: additive per-key options in the existing
  preferences document, with old files defaulting to instant.
- Spec 03 and 10: per-key and per-action options, defaults and fade lifecycle.

## Checks run

- Focused schema, main clear/toggle/undo, macro compiler, audio, background,
  overlay, stage and output renderer tests: see the request message.
- Typecheck, build and changed-file lint after formatting: see the request. Full
  verify runs in GitHub Actions.
- Regressions cover malformed timing and effect caps, preserved stored fields,
  monotonic timing, instant defaults, F1 and prop targeting, restore, new
  content, recovery, decoder reuse, held notice rotation, delayed audio delivery
  and callback disposal.

## Checked in the app

- Built the app and ran `node --check` before launching the CDP script. Two
  launches use `LLP_TEST_WINDOWS=offscreen`, port 5182 and isolated
  output-member data. No sound or desktop window appeared.
- Each launch repeats 25 cycles of an 800 ms F2 fade, restoring before it ends,
  clearing then sending new content, and F1's unchanged instant default. The
  same cycle clears one prop through a saved macro, verifies its neighbor stays
  fully visible and undo restores gain, then fades the background while its
  video is paused and verifies undo resumes playback. Notice pause/resume still
  preserves the F2 capture. Both launches quit normally.
- Five renderer targets, 472 elements, 1,700 CDP DOM nodes and 416 listeners
  remain constant. Collected heaps at iterations 5 and 25 are 5,722,052 to
  6,023,480 bytes and 5,849,444 to 6,150,716 bytes. This short repeated flow is
  not an hours-long soak. The native audible fade remains on a later user sheet;
  development and test playback stays muted.
- Screenshots: [key fade](evidence/output-56/key-fade-run1.png),
  [one prop fading](evidence/output-56/prop-fade-run1.png),
  [held background](evidence/output-56/background-fade-run1.png),
  [second launch](evidence/output-56/prop-fade-run2.png).

## Follow-up controls

The user allows the editing controls as a follow-up request. Per-key controls
belong to the planned 환경설정 진행 page; the macro choice belongs to the clear
action fields of the planned macro editor. Neither editing screen exists in the
current renderer. This request stores and renders their choices through the
existing settings documents; it does not introduce either editor.

## Review: lead

- Verdict: pending

## Review: reviewer

- Verdict: pending

## Team member's reply

1.
