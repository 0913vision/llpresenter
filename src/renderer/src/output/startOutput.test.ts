import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {LlpApi} from '@shared/ipc';
import {emptyLiveState, type LiveState} from '@shared/live';
import type {
  FrameRateReport,
  RendererLogEntry,
} from '@shared/schema/ipcPayloads';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {classes} from '../render/classes';
import {SlideLayerView} from '../render/slideLayer';
import {startOutput} from './startOutput';

const SHOWING: LiveState = {
  ...emptyLiveState(),
  version: 3,
  layers: {
    ...emptyLiveState().layers,
    media: {mediaId: 'warm-light', loop: true, startedAt: 0},
    slide: {itemId: 'hymn-1', position: 0, label: null, lines: ['만복의 근원']},
  },
};

let frame: FrameRequestCallback | null = null;

beforeEach(() => {
  frame = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
});

function setUp(live: Partial<LlpApi['live']> = {}) {
  const root = document.createElement('div');
  const logs: RendererLogEntry[] = [];
  const rates: FrameRateReport[] = [];
  const api = fakeLlpApi({
    live: {
      get: () => Promise.resolve(SHOWING),
      send: () => undefined,
      subscribe: () => () => undefined,
      ...live,
    },
    log: {write: entry => logs.push(entry)},
    output: {reportFrameRate: report => rates.push(report)},
  });
  const stop = startOutput({root, api, screenId: 'main'});
  return {root, logs, rates, stop};
}

describe('startOutput', () => {
  it('draws the current live state', async () => {
    const {root} = setUp();
    await vi.waitFor(() => {
      expect(root.querySelector(`.${classes.shown}`)?.textContent).toBe(
        '만복의 근원',
      );
    });
    expect(root.querySelector('video[src]')?.getAttribute('src')).toBe(
      'llp-media://media/warm-light',
    );
  });

  it('sends a drawing error to the main log instead of showing it', async () => {
    vi.spyOn(SlideLayerView.prototype, 'show').mockImplementation(() => {
      throw new Error('layout failed');
    });
    const {logs} = setUp();
    await vi.waitFor(() => expect(logs).toHaveLength(1));
    expect(logs[0]).toMatchObject({
      level: 'error',
      message: 'could not draw the lyrics layer',
    });
    expect(logs[0]?.detail).toContain('Error: layout failed');
  });

  it('sends uncaught errors in the window to the main log', () => {
    const {logs} = setUp();
    window.dispatchEvent(
      new ErrorEvent('error', {error: new Error('late failure')}),
    );
    expect(logs.at(-1)).toMatchObject({
      message: 'uncaught error in an output window',
    });
    expect(logs.at(-1)?.detail).toContain('late failure');
  });

  it('reports its frame rate with its screen id', () => {
    const {rates} = setUp();
    for (let time = 0; time <= 1100; time += 1000 / 60) frame?.(time);
    expect(rates).toEqual([{screenId: 'main', fps: 60}]);
  });

  it('stops listening and removes its picture when stopped', () => {
    const {root, logs, stop} = setUp();
    stop();
    window.dispatchEvent(new ErrorEvent('error', {message: 'after stop'}));
    expect(logs).toEqual([]);
    expect(root.childElementCount).toBe(0);
  });
});
