import {describe, expect, it} from 'vitest';
import {LiveStore} from '@main/live/store';
import {emptyLiveState} from '@core/schema/live/live';
import {parseLiveState} from '@core/schema/live/liveState';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

function uuid(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}
const NOW = 1_700_000_000_000;
function message(index = 1) {
  return {
    messageId: uuid(index),
    text: 'Invented announcement',
    targets: 'all',
    excludedTargets: [],
    startedAt: NOW,
    expiresAt: NOW + 30_000,
  };
}
function prop(index = 1) {
  return {
    propId: uuid(index),
    content: {kind: 'image', media: uuid(3)},
    targets: [uuid(4)],
  };
}
function state(layers: object = {}, addition: object = {}) {
  const empty = emptyLiveState();
  return {...empty, layers: {...empty.layers, ...layers}, ...addition};
}

describe('clearing overlays', () => {
  it('keeps a stage message outside all-clears and retains additive metadata in clear undo', () => {
    const initial = expectSuccess(
      parseLiveState(
        state(
          {
            message: {messageId: 'summary', text: '', items: [message()]},
            prop: {propId: 'summary', items: [prop()]},
          },
          {stageMessage: 'Invented stage cue'},
        ),
      ),
    );
    const store = new LiveStore(initial, () => NOW);
    store.dispatch({type: 'layer.clear', target: 'all'});
    expect(store.state.stageMessage).toBe(initial.stageMessage);
    expect(store.state.layers.message).toBeNull();
    expect(store.state.layers.prop).toBeNull();
    store.dispatch({type: 'clear.undo'});
    expect(store.state.stageMessage).toBe(initial.stageMessage);
    expect(store.state.layers).toEqual(initial.layers);
  });
});
