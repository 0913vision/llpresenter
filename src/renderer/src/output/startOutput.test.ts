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
import {MAIN, overlaySettings} from '../../../main/live/testing/overlays';
import {LiveStore} from '../../../main/live/store';
import type {SettingsDocument} from '@shared/schema/settingsDocuments';
import {settingsDocument} from '../../../main/live/testing/overlays';

const SHOWING: LiveState = {
  ...emptyLiveState(),
  version: 3,
  layers: {
    ...emptyLiveState().layers,
    media: {mediaId: 'warm-light', loop: true, startedAt: 0},
    slide: {itemId: 'hymn-1', position: 0, label: null, lines: ['만복의 근원']},
  },
};

const FRAME_MS = 1000 / 60;
const SECOND_AND_A_BIT_MS = 1100;

let frame: FrameRequestCallback | null = null;
let frameTime = 0;

function runFramesFor(durationMs: number): void {
  const end = frameTime + durationMs;
  for (; frameTime <= end; frameTime += FRAME_MS) frame?.(frameTime);
}

beforeEach(() => {
  frame = null;
  frameTime = 0;
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
    settings: {
      get: () => Promise.resolve(overlaySettings().reader.get('screens')),
    },
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
  it('follows capture method changes in place without replacing the live content', async () => {
    const settings = overlaySettings();
    const screenDocument = settings.reader.get('screens');
    if (screenDocument.name !== 'screens') throw new Error('Missing screens');
    const screens = screenDocument.value.screens;
    const capture = settingsDocument(
      'screens',
      {
        screens: screens.map(screen =>
          screen.id === MAIN ? {...screen, method: 'capture'} : screen,
        ),
      },
      2,
    );
    const listeners = new Set<(document: SettingsDocument) => void>();
    const receive = (document: SettingsDocument): void => {
      for (const listener of listeners) listener(document);
    };
    const unsubscribe = vi.fn();
    const root = document.createElement('div');
    const api = fakeLlpApi({
      settings: {
        get: () => Promise.resolve(capture),
        subscribe: listener => {
          listeners.add(listener);
          return unsubscribe;
        },
      },
      live: {
        get: () =>
          Promise.resolve({
            ...SHOWING,
            layers: {...SHOWING.layers, media: null},
          }),
      },
    });
    const stop = startOutput({root, api, screenId: MAIN});
    await Promise.resolve();
    const output = root.firstElementChild;
    const text = root.querySelector(`.${classes.shown}`);
    expect(
      output instanceof HTMLElement &&
        output.style.getPropertyValue('--output-background'),
    ).toBe('var(--chroma)');
    receive(settingsDocument('screens', {screens}, 3));
    expect(root.firstElementChild).toBe(output);
    expect(root.querySelector(`.${classes.shown}`)).toBe(text);
    expect(
      output instanceof HTMLElement &&
        output.style.getPropertyValue('--output-background'),
    ).toBe('');
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(listeners.size);
  });

  it('routes an overlay after screen settings resolve and releases every feed on stop', async () => {
    const settings = overlaySettings();
    const store = new LiveStore();
    store.connectSettings(settings.reader);
    store.dispatch({
      type: 'message.send',
      text: 'Targeted output',
      targets: [MAIN],
      duration: 30,
    });
    const root = document.createElement('div');
    const stopLive = vi.fn();
    const stopSettings = vi.fn();
    const pending = new Map<string, (document: SettingsDocument) => void>();
    const api = fakeLlpApi({
      live: {
        get: () => Promise.resolve(store.state),
        subscribe: () => stopLive,
      },
      settings: {
        get: ({name}) =>
          new Promise(done => {
            pending.set(name, done);
          }),
        subscribe: () => stopSettings,
      },
    });
    const stop = startOutput({root, api, screenId: 'main'});
    await Promise.resolve();
    const message = () =>
      root
        .querySelector('[data-layer="message"]')
        ?.querySelector(`.${classes.shown}`)?.textContent ?? null;
    expect(message()).toBeNull();
    pending.get('screens')?.(settings.reader.get('screens'));
    await Promise.resolve();
    expect(message()).toBe('Targeted output');
    stop();
    expect(stopLive).toHaveBeenCalledTimes(1);
    expect(stopSettings).toHaveBeenCalledTimes(3);
    expect(root.children).toHaveLength(0);
  });

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

  it('reports its frame rate with its screen id once it draws the live state', async () => {
    const {rates} = setUp();
    await vi.waitFor(() => expect(frame).not.toBeNull());
    runFramesFor(SECOND_AND_A_BIT_MS);
    expect(rates).toEqual([{screenId: 'main', fps: 60}]);
  });

  it('reports no frame rate while the live state is on its way', async () => {
    let answer: (state: LiveState) => void = () => undefined;
    const {root, rates} = setUp({
      get: () =>
        new Promise<LiveState>(resolve => {
          answer = resolve;
        }),
    });
    runFramesFor(SECOND_AND_A_BIT_MS * 3);
    expect(rates).toEqual([]);
    answer(SHOWING);
    await vi.waitFor(() => {
      expect(root.querySelector(`.${classes.shown}`)?.textContent).toBe(
        '만복의 근원',
      );
    });
    runFramesFor(SECOND_AND_A_BIT_MS);
    expect(rates).toEqual([{screenId: 'main', fps: 60}]);
  });

  it('reports no frame rate when the live state never arrives', async () => {
    const {logs, rates} = setUp({
      get: () => Promise.reject(new Error('main process busy')),
    });
    await vi.waitFor(() => expect(logs).toHaveLength(1));
    runFramesFor(SECOND_AND_A_BIT_MS * 3);
    expect(rates).toEqual([]);
  });

  it('stops listening and removes its picture when stopped', () => {
    const {root, logs, stop} = setUp();
    stop();
    window.dispatchEvent(new ErrorEvent('error', {message: 'after stop'}));
    expect(logs).toEqual([]);
    expect(root.childElementCount).toBe(0);
  });
});
