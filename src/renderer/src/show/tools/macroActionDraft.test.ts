import {expect, it} from 'vitest';
import {macroActionKinds, parseKnownMacroAction} from '@shared/schema/macros';
import {
  draftMacroAction,
  prepareMacroAction,
  type MacroActionDraft,
} from './macroActionDraft';

const id = '00000000-0000-4000-8000-000000000001';
const drafts: readonly MacroActionDraft[] = [
  {kind: 'look', target: id},
  {kind: 'stageLayout', target: id, screen: id},
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
  {kind: 'notice', target: id},
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
  expect(prepareMacroAction({kind: 'look', target: 'missing'})).toBeUndefined();
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
    {kind: 'stageLayout', target: id},
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
