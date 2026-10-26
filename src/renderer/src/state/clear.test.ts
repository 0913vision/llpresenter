import {renderHook, act} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {emptyLayers, emptyLiveState} from '@shared/live';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {clearLayer, undoClear, useCanUndo} from './clear';
import {useLive} from './live';

const sent: LiveCommand[] = [];

beforeEach(() => {
  sent.length = 0;
  window.llp = fakeLlpApi({
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
  it('sends clear.undo while the live state says there is something to undo', () => {
    useLive.setState({state: {...emptyLiveState(), canUndo: true}});
    undoClear();
    expect(sent).toEqual([{type: 'clear.undo'}]);
  });

  it('sends nothing when there is nothing to undo', () => {
    useLive.setState({state: {...emptyLiveState(), canUndo: false}});
    undoClear();
    expect(sent).toHaveLength(0);
  });

  it('sends nothing before the first live state arrives', () => {
    undoClear();
    expect(sent).toHaveLength(0);
  });
});

describe('useCanUndo', () => {
  it('follows canUndo of the live state', () => {
    const {result} = renderHook(() => useCanUndo());
    expect(result.current).toBe(false);
    act(() => useLive.setState({state: {...emptyLiveState(), canUndo: true}}));
    expect(result.current).toBe(true);
    act(() => useLive.setState({state: {...emptyLiveState(), canUndo: false}}));
    expect(result.current).toBe(false);
  });
});

describe('clearLayer', () => {
  it('still clears only a layer that has something', () => {
    const base = emptyLiveState();
    useLive.setState({
      state: {
        ...base,
        layers: {
          ...emptyLayers(),
          media: {mediaId: 'm', loop: true, startedAt: 0},
        },
      },
    });
    clearLayer('slide');
    expect(sent).toHaveLength(0);
    clearLayer('media');
    expect(sent).toEqual([{type: 'layer.clear.toggle', target: 'media'}]);
  });

  it('sends the toggle even when the layer is empty but has a captured clear', () => {
    useLive.setState({state: {...emptyLiveState(), clearToggles: ['slide']}});
    clearLayer('slide');
    expect(sent).toEqual([{type: 'layer.clear.toggle', target: 'slide'}]);
  });
});
