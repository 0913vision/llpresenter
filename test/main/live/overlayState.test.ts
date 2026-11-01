import {describe, expect, it} from 'vitest';
import {LiveStore} from '@main/live/store';
import {emptyLiveState} from '@core/live/state';
import {parseLiveState} from '@core/schema/liveState';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const NOW = 1_700_000_000_000;
const message = (index = 1) => ({
  messageId: uuid(index),
  text: 'Invented announcement',
  targets: 'all',
  excludedTargets: [],
  startedAt: NOW,
  expiresAt: NOW + 30_000,
});
const prop = (index = 1) => ({
  propId: uuid(index),
  content: {kind: 'image', media: uuid(3)},
  targets: [uuid(4)],
});
const playback = () => ({
  media: [uuid(3), uuid(4)],
  position: 1,
  interval: 5,
  loop: true,
  targets: [uuid(5)],
  startedAt: NOW,
  pausedAt: null,
});
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
            notice: {noticeId: 'summary', playback: playback()},
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
    expect(store.state.layers.notice).toBeNull();
    store.dispatch({type: 'clear.undo'});
    expect(store.state.stageMessage).toBe(initial.stageMessage);
    expect(store.state.layers).toEqual(initial.layers);
  });
});
