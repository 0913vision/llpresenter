import {expect, it} from 'vitest';
import {
  macroActionKinds,
  parseKnownMacroAction,
} from '@core/schema/tools/macros';
import {
  draftMacroAction,
  messageShows,
  prepareMacroAction,
  type MacroActionDraft,
} from '@core/macros/macroActionDraft';

const id = '00000000-0000-4000-8000-000000000001';
const drafts: readonly MacroActionDraft[] = [
  {kind: 'clearAll'},
  {kind: 'clearLayer', target: 'slide'},
  {kind: 'media', target: id},
  {kind: 'prop', target: id, operation: 'toggle'},
  {
    kind: 'message',
    target: id,
    values: {name: '안내'},
    targets: [id],
    duration: 30,
  },
  {kind: 'audio', target: id, operation: 'play'},
  {kind: 'audioPlaylist', target: id},
  {kind: 'timer', target: id, operation: 'pause'},
  {kind: 'macro', target: id},
];

it('prepares all supported action kinds through the shared schema', () => {
  expect(drafts.map(draft => draft.kind)).toEqual(macroActionKinds);
  for (const draft of drafts) {
    const action = prepareMacroAction(draft);
    expect(action?.kind).toBe(draft.kind);
    expect(parseKnownMacroAction(action).ok).toBe(true);
  }
  expect(
    prepareMacroAction({kind: 'clearLayer', clearTarget: 'prop', target: id}),
  ).toEqual({kind: 'clearLayer', prop: id});
  expect(prepareMacroAction({kind: 'audio', operation: 'fadeOut'})).toEqual({
    kind: 'audio',
    operation: 'fadeOut',
  });
  expect(prepareMacroAction({kind: 'audio', operation: 'stop'})).toEqual({
    kind: 'audio',
    operation: 'stop',
  });
});

it('rejects unsupported actions, bad IDs, operations and message settings', () => {
  expect(parseKnownMacroAction({kind: 'future'}).ok).toBe(false);
  expect(
    prepareMacroAction({kind: 'macro', target: 'missing'}),
  ).toBeUndefined();
  // NOTE(0913vision): 테마 바꾸기 is gone (USER Nov 27); a saved one is kept
  // as an action this version doesn't run.
  expect(parseKnownMacroAction({kind: 'theme', theme: id}).ok).toBe(false);
  expect(
    prepareMacroAction({kind: 'timer', target: id, operation: 'invalid'}),
  ).toBeUndefined();
  expect(
    prepareMacroAction({kind: 'clearLayer', target: 'invalid'}),
  ).toBeUndefined();
  expect(
    prepareMacroAction({kind: 'audio', operation: 'play'}),
  ).toBeUndefined();
  expect(
    prepareMacroAction({kind: 'message', target: id, duration: -1}),
  ).toBeUndefined();
  expect(
    prepareMacroAction({kind: 'message', target: id, targets: []}),
  ).toBeUndefined();
});

it('round-trips every editable action and its variants', () => {
  const variants: readonly MacroActionDraft[] = [
    ...drafts,
    {
      kind: 'clearLayer',
      clearTarget: 'prop',
      target: id,
      transition: {fade: true, durationMs: 500},
    },
    {kind: 'clearAll', transition: {fade: true, durationMs: 500}},
    {kind: 'audio', operation: 'stop'},
    {kind: 'audio', operation: 'fadeOut'},
    {kind: 'message', target: id, targets: 'all', duration: null},
  ];
  for (const draft of variants) {
    const action = prepareMacroAction(draft);
    expect(action).toBeDefined();
    if (action) {
      expect(prepareMacroAction(draftMacroAction(action))).toEqual(action);
    }
  }
});

it('counts a message action ready only when it would show some text on a screen', () => {
  const draft: MacroActionDraft = {
    kind: 'message',
    target: id,
    values: {name: '안내'},
    targets: 'all',
  };
  const context = {text: '{name} 시간입니다', screens: 2};
  expect(messageShows(draft, context)).toBe(true);
  expect(messageShows(draft, {...context, text: undefined})).toBe(false);
  expect(messageShows(draft, {...context, screens: 0})).toBe(false);
  expect(
    messageShows({...draft, targets: [id]}, {...context, screens: 0}),
  ).toBe(true);
  expect(messageShows({...draft, values: {name: ' '}}, context)).toBe(false);
  expect(messageShows({...draft, values: {}}, context)).toBe(false);
  expect(messageShows(draft, {...context, text: '{name}'})).toBe(true);
  expect(
    messageShows({...draft, values: {name: '   '}}, {...context, text: '  '}),
  ).toBe(false);
  expect(
    messageShows(
      {...draft, values: {name: '가'.repeat(5000)}},
      {...context, text: '{name}'},
    ),
  ).toBe(false);
});
