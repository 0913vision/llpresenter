import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import type {LiveCommand} from '@core/schema/live/liveCommand';
import {emptyLiveState} from '@core/schema/live/live';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {clearLayer, toggleItem, undoClear} from '@renderer/session/show/clear';
import {useLive} from '@renderer/session/live';

const sent: LiveCommand[] = [];

beforeEach(() => {
  sent.length = 0;
  window.llp = mockLlpApi({
    live: {
      get: () => Promise.resolve(emptyLiveState()),
      send: command => void sent.push(command),
      subscribe: () => () => undefined,
    },
  });
  useLive.setState({state: null});
});

afterEach(() => {
  delete window.llp;
});

describe('undoClear', () => {
  it('sends every 되돌리기 press to main, which has the only say on what can be undone', () => {
    useLive.setState({state: {...emptyLiveState(), canUndo: false}});
    undoClear();
    undoClear();
    expect(sent).toEqual([{type: 'clear.undo'}, {type: 'clear.undo'}]);
  });
});

describe('clearLayer', () => {
  it('sends every clear key press to main, even when this window has not heard of the content yet', () => {
    useLive.setState({state: null});
    clearLayer('slide');
    useLive.setState({state: emptyLiveState()});
    clearLayer('media');
    expect(sent).toEqual([
      {type: 'layer.clear.toggle', target: 'slide'},
      {type: 'layer.clear.toggle', target: 'media'},
    ]);
  });
});

describe('toggleItem', () => {
  it('sends each 대기 화면 press to main, which decides, even before this window hears the one before', () => {
    useLive.setState({
      state: {
        ...emptyLiveState(),
        item: {id: 'item', kind: 'song', source: 'service'},
      },
    });
    toggleItem();
    toggleItem();
    expect(sent).toEqual([{type: 'item.toggle'}, {type: 'item.toggle'}]);
  });
});
