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
- [The first round-2 candidate CI run](https://github.com/0913vision/llpresenter/actions/runs/40368955865)
  failed two tests. Startup unnecessarily cloned an unchanged explicit state; it
  now preserves that identity while clearing nonempty temporary metadata. The
  overlapping-fade test depended on the platform's animation-frame cadence; it
  now uses an explicit 16 ms scheduler without weakening its gain assertions.
  Both failures pass in the focused regression run. No failed job was rerun.
- CI pending for the updated head; the dispatcher checks its exact-head run.
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

### Round 2 app check

- Rebuilt and syntax-checked the launcher before two offscreen launches. Both
  repeat the original flows 25 times, plus consecutive prop clears with
  different durations, a full 64-item prop pool followed by a new activation,
  and a saved macro that activates and clears 85 distinct props in one run.
  Earlier fades keep their order and duration, the new live prop remains visible
  at capacity, and the macro finishes with exactly 70 retained effects.
- Both launches quit normally. Measurements and screenshots below are from this
  final check; collected heaps are sampled in both control and output.
- At iterations 5 and 25, control stays at 1,154 elements, 2,505 CDP nodes and
  416 listeners. Collected heaps are 5,939,020 to 6,370,380 bytes and 6,095,932
  to 6,537,612 bytes. Output stays at 774 elements, 1,214 CDP nodes and 10
  listeners; its heaps are 2,758,468 to 2,838,464 bytes and 2,764,272 to
  2,851,432 bytes. Five targets remain throughout. This is a short repeated
  flow, not an hours-long soak.
- An earlier instrumentation run failed a fixed 300 ms overlap probe while the
  preceding frame phase was still drawn. The final check observes the actual
  ordered overlap and completion phases; deterministic clock regressions check
  the individual deadlines independently.
- Screenshots: [overlapping fades](evidence/output-56-round2/overlap-run1.png),
  [new live prop at capacity](evidence/output-56-round2/capacity-run1.png),
  [second launch](evidence/output-56-round2/overlap-run2.png).

### Round 3 app check

- Rebuilt and syntax-checked the launcher, then completed two offscreen launches
  with 25 cycles each and normal quits. Alternating cycles clear A/B over
  200/1200 ms and 1200/200 ms; after the short fade ends, the surviving outgoing
  prop remains below C in both cases. The capacity and 85-prop macro checks also
  pass.
- Control stays at 1,154 elements, 2,505 CDP nodes and 416 listeners; output
  stays at 774 elements, 1,214 nodes and 10 listeners. Collected control heaps
  at iterations 5/25 are 5,940,460/6,381,652 and 5,942,184/6,369,544 bytes;
  output heaps are 2,772,712/2,854,188 and 2,780,788/2,857,900 bytes. Five
  targets remain. The focused regression run passes 21 tests; typecheck, build,
  formatting and changed-file lint pass. CI pending for this head.
- Screenshots: [B survives A](evidence/output-56-round3/overlap-run1.png),
  [live props at capacity](evidence/output-56-round3/capacity-run1.png),
  [second launch](evidence/output-56-round3/overlap-run2.png).

### Round 4 restack and app check

- Restacked on output-55 round 3, above output-54 round 4. The round 2 and round
  3 finding replies below remain unchanged. All 156 focused tests in eight
  files, typecheck and build pass. CI pending for this head.
- Two offscreen launches completed 25 cycles each and quit normally. Both
  duration orders preserve prop stacking after the shorter fade expires. The
  64-live-item and 85-distinct-clear macro checks pass. Five renderer targets
  keep the same identities from start to finish.
- Control stays at 1,237 elements, 2,485 CDP nodes and 417 listeners; output
  stays at 774 elements, 1,214 nodes and 10 listeners. Collected control heaps
  at iterations 5/25 are 6,397,856/6,820,736 and 6,346,212/6,781,744 bytes;
  output heaps are 2,788,676/2,865,296 and 2,782,912/2,872,548 bytes. Formatting
  and changed-file lint also pass.
- Screenshots: [surviving fade](evidence/output-56-round4/overlap-run1.png),
  [64 live props](evidence/output-56-round4/capacity-run1.png),
  [second launch](evidence/output-56-round4/overlap-run2.png).
- The launcher waits for all five initial renderer targets, including hidden
  audio, before recording its window-count baseline. An earlier run recorded
  that baseline as soon as the three screen pages loaded and failed its final
  count assertion despite stable DOM and heap samples. No application retry or
  window-count assertion was removed.

### Round 5 validation and app check

- Rebased the request onto local main `097bf425`. The schema correction adds
  array rejection before object defaults. All 112 focused schema, preferences,
  macro, IPC and main clear tests pass, as do typecheck, build, formatting and
  changed-file lint. CI pending for this head.
- Rebuilt and syntax-checked the launcher before two offscreen launches. Each
  completed 20 cycles: malformed clear IPC keeps the current lyrics, malformed
  per-key preferences and macro timing leave their documents and revisions
  unchanged, and valid F2/F1 clear/restore flows still work. Both quit normally.
- Control stays at 532 elements and 1,653 CDP nodes. Listeners are 422 to 420
  and 417 throughout. Collected heaps at iterations 5/20 are 6,015,796/6,328,324
  and 6,180,312/6,493,456 bytes. The original five app renderer identities are
  retained. A preliminary raw target-count check also counted main's transient
  hidden `analysis.html` media worker. The final check permits only that bounded
  analysis target and still rejects replacement of an original app window or any
  other extra window.
- Screenshots:
  [restored after rejected input](evidence/output-56-round5/restored-run1.png),
  [second launch](evidence/output-56-round5/restored-run2.png).

## Follow-up controls

The user allows the editing controls as a follow-up request. Per-key controls
belong to the planned 환경설정 진행 page; the macro choice belongs to the clear
action fields of the planned macro editor. Neither editing screen exists in the
current renderer. This request stores and renders their choices through the
existing settings documents; it does not introduce either editor.

## Verdicts (recorded by the lead at merge)

- Final round (8645413f): reviewer (Codex) and second reviewer (Gemini Argon)
  Approve. Lead Approve; the second reviewer (Gemini Argon) checked the clear
  fades in the live state, output windows and macros for the lead and found no
  output-path risk. The exact-head CI run passed, checked by the lead at merge.
  Rebased by the lead onto local `main` without conflicts; typecheck passes.
  Earlier rounds' findings and replies are above.

## Team member's reply

### Round 5

1. Clear fade options now use the existing `jsonObject` wrapper instead of
   `v.looseObject` alone. Arrays are rejected before defaults can turn them into
   objects. Regressions reject empty arrays, nonempty arrays and arrays with
   object-like properties through layer/prop clear IPC, per-key preferences, and
   all three macro clear-action forms. Partial object defaults and unknown
   stored fields remain covered by the existing round-trip tests.

### Round 3

1. Each frame reconciles retained prop positions against the preceding drawn
   order and inserts outgoing props before surviving successors. An expired
   predecessor no longer leaves a stale absolute insertion offset. The same
   regression now runs both 1200/200 ms and 200/1200 ms clears of `[A, B, C]`,
   checks the survivor remains below C, and verifies independent gains and
   completion. The app check also exercises both duration orders.

### Round 2

1. Main retains only the newest `MAX_CLEAR_EFFECTS` entries, shared with the
   70-entry schema cap. An 85-prop transaction regression verifies that the
   whole command is admitted, old entries are discarded, and the newest clear
   survives. Individual clears keep a prop target even when they remove the last
   live prop; a whole-layer clear removes superseded individual effects.
2. Outgoing props use only the slots left after live props, so all 64 current
   items remain visible. The regression fills the pool, clears one with a long
   fade and activates a new prop: the new item appears without growing the pool
   or scheduling another fade frame for discarded content.
3. New outgoing captures take their index from the last rendered order rather
   than the shrinking logical list. The regression clears A then B from
   `[A, B, C]`, checks stable order and separate gains, and verifies each clear
   finishes at its own deadline while C remains visible.

## Verdicts (recorded by the lead at merge)

- Final round (69a8ae99): reviewer (Codex) and second reviewer (Gemini Argon)
  Approve. Lead Approve; the second reviewer (Gemini Argon) checked the clear
  fades in the live state, output windows and macros for the lead and found no
  output-path risk. The exact-head CI run passed, checked by the lead at merge.
  Rebased by the lead onto local `main` without conflicts; typecheck passes.
  Earlier rounds' findings and replies are above.
