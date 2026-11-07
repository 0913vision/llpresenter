import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {emptyLiveState, type LiveState} from '@core/live/state';
import type {
  FrameRateReport,
  FrameReadyReport,
  RendererLogEntry,
} from '@core/schema/ipcPayloads';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {classes} from '@renderer/rendering/classes';
import {SlideLayerView} from '@renderer/rendering/slideLayer';
import {startOutput} from '@renderer/output/startOutput';
import {ScreenFrames} from '@renderer/rendering/screenFrames';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';
import {MAIN, overlaySettings} from '@fixtures/core/overlays';
import {parseLiveState} from '@core/schema/liveState';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import type {SettingsDocument} from '@core/schema/settingsDocuments';

import {resolveThemeOutput} from '@core/themes/output';
import {screensDocument} from '@fixtures/core/screenDocuments';
import {MAIN_SCREEN} from '@fixtures/core/screenIds';
const screenDocument = screensDocument();
if (screenDocument.name !== 'screens') throw new Error('Missing screens');
const themeItem = {id: 'hymn-1', kind: 'song', source: 'external'} as const;
const themeOutput = resolveThemeOutput({
  file: null,
  screens: screenDocument.value.screens,
  item: themeItem,
  revision: 1,
});

const SHOWING: LiveState = {
  ...emptyLiveState(),
  version: 3,
  outputs: {[MAIN_SCREEN]: true},
  themeItem,
  themeOutput,
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

async function pumpReadiness(): Promise<void> {
  runFramesFor(120);
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
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
  const api = mockLlpApi({
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
  const stop = startOutput({root, api, screenId: MAIN_SCREEN});
  onTestFinished(stop);
  return {root, logs, rates, stop};
}

describe('startOutput', () => {
  it('rechecks the same live version without requiring a resize event until main acknowledges visibility', async () => {
    const settings = overlaySettings();
    const defaults = mockLlpApi();
    const reportReady = vi.fn<(report: FrameReadyReport) => Promise<boolean>>(
      () => Promise.resolve(false),
    );
    const root = document.createElement('div');
    const api = mockLlpApi({
      settings: {
        get: ({name}) =>
          name === 'screens'
            ? Promise.resolve(settings.reader.get(name))
            : defaults.settings.get({name}),
      },
      live: {
        get: () =>
          Promise.resolve({
            ...SHOWING,
            outputs: {[MAIN]: true},
            layers: {...SHOWING.layers, media: null},
          }),
      },
      output: {reportReady},
    });
    const stop = startOutput({root, api, screenId: MAIN});
    await Promise.resolve();
    await pumpReadiness();
    await pumpReadiness();
    expect(reportReady.mock.calls.length).toBeGreaterThan(1);
    expect(
      reportReady.mock.calls.every(
        ([report]) =>
          report.version === SHOWING.version &&
          report.width === window.innerWidth &&
          report.height === window.innerHeight,
      ),
    ).toBe(true);
    reportReady.mockImplementation(() => Promise.resolve(true));
    await pumpReadiness();
    const calls = reportReady.mock.calls.length;
    await pumpReadiness();
    expect(reportReady).toHaveBeenCalledTimes(calls);
    stop();
  });

  it('accepts a shown acknowledgment after a newer version and restores the pending background dissolve', async () => {
    const settings = overlaySettings();
    const defaults = mockLlpApi();
    let current: LiveState = {
      ...SHOWING,
      outputs: {[MAIN]: true},
      layers: {...SHOWING.layers, media: null},
    };
    let receive: (state: LiveState) => void = () => {};
    let acknowledge: (shown: boolean) => void = () => {};
    const reportReady = vi.fn((report: FrameReadyReport) =>
      report.ready
        ? new Promise<boolean>(resolve => {
            acknowledge = resolve;
          })
        : Promise.resolve(false),
    );
    const root = document.createElement('div');
    const api = mockLlpApi({
      settings: {
        get: ({name}) =>
          name === 'screens'
            ? Promise.resolve(settings.reader.get(name))
            : defaults.settings.get({name}),
      },
      live: {
        get: () => Promise.resolve(current),
        subscribe: listener => {
          receive = listener;
          return () => {};
        },
      },
      output: {reportReady},
    });
    const stop = startOutput({root, api, screenId: MAIN});
    await Promise.resolve();
    await pumpReadiness();
    current = {
      ...current,
      version: SHOWING.version + 1,
      layers: {...current.layers, media: SHOWING.layers.media},
    };
    receive(current);
    acknowledge(true);
    for (let index = 0; index < 4; index += 1) await Promise.resolve();
    const incoming = root.querySelector('video[src]');
    if (incoming === null) throw new Error('Missing replacement background');
    incoming.dispatchEvent(new Event('playing'));
    expect(incoming.classList.contains(classes.dissolving)).toBe(true);
    stop();
  });

  it('keeps off outputs empty and loads the latest live background before revealing without a dissolve', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    let current = {...SHOWING, outputs: {[MAIN]: false}};
    let receive: (state: LiveState) => void = () => undefined;
    const reportReady = vi.fn((report: FrameReadyReport) =>
      Promise.resolve(current.outputs[MAIN] === true && report.ready),
    );
    const settings = overlaySettings();
    const defaults = mockLlpApi();
    const raise = vi.fn();
    const api = mockLlpApi({
      settings: {
        get: ({name}) =>
          name === 'screens'
            ? Promise.resolve(settings.reader.get(name))
            : defaults.settings.get({name}),
      },
      live: {
        get: () => Promise.resolve(current),
        subscribe: listener => {
          receive = listener;
          return () => {};
        },
      },
      output: {reportReady, showWindow: raise},
    });
    const root = document.createElement('div');
    const stop = startOutput({root, api, screenId: MAIN});
    await Promise.resolve();
    current = {
      ...current,
      version: 4,
      layers: {
        ...current.layers,
        media: {mediaId: 'still-water', loop: true, startedAt: 3000},
        slide: {
          itemId: 'fixture',
          position: 0,
          label: null,
          lines: ['Hidden content'],
        },
      },
    };
    receive(current);
    runFramesFor(80);
    expect(root.children).toHaveLength(0);
    expect(reportReady).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    current = {...current, version: 5, outputs: {[MAIN]: true}};
    receive(current);
    expect(root.textContent).toContain('Hidden content');
    runFramesFor(80);
    expect(reportReady.mock.calls.some(([report]) => report.ready)).toBe(false);
    const video = [...root.querySelectorAll('video')].find(video =>
      video.src.includes('still-water'),
    );
    if (video === undefined) {
      throw new Error('Missing newly enabled background');
    }
    Object.defineProperty(video, 'duration', {value: 12, configurable: true});
    video.dispatchEvent(new Event('loadedmetadata'));
    expect(video.currentTime).toBe(7);
    video.dispatchEvent(new Event('playing'));
    await pumpReadiness();
    await pumpReadiness();
    expect(reportReady).toHaveBeenLastCalledWith(
      expect.objectContaining({screenId: MAIN, version: 5, ready: true}),
    );
    root.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}));
    expect(raise).toHaveBeenCalledExactlyOnceWith(MAIN);
    expect(video.classList.contains(classes.dissolving)).toBe(false);
    current = {
      ...current,
      version: 6,
      layers: {
        ...current.layers,
        media: {mediaId: 'warm-light', loop: true, startedAt: 0},
      },
    };
    receive(current);
    const incoming = [...root.querySelectorAll('video')].find(video =>
      video.src.includes('warm-light'),
    );
    if (incoming === undefined) throw new Error('Missing new background');
    incoming.dispatchEvent(new Event('playing'));
    expect(incoming.classList.contains(classes.dissolving)).toBe(true);
    current = {...current, version: 7, outputs: {[MAIN]: false}};
    receive(current);
    expect(root.children).toHaveLength(0);
    expect(video.hasAttribute('src')).toBe(false);
    expect(incoming.hasAttribute('src')).toBe(false);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
    stop();
    root.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}));
    expect(raise).toHaveBeenCalledOnce();
  });
  it('keeps the last good picture after a frame failure or unavailable snapshot and resumes later', async () => {
    let receive: (state: LiveState) => void = () => undefined;
    const {root, logs, stop} = setUp({
      subscribe: listener => {
        receive = listener;
        return () => undefined;
      },
    });
    await vi.waitFor(() =>
      expect(root.textContent).toContain(SHOWING.layers.slide?.lines[0]),
    );
    const text = root.textContent;
    vi.spyOn(ScreenFrames.prototype, 'frame').mockImplementationOnce(() => {
      throw new Error('Invented frame failure');
    });
    receive({...SHOWING, version: 4, stageMessage: 'Rejected message'});
    expect(root.textContent).toBe(text);
    expect(
      logs.some(entry => entry.message === 'could not update the output frame'),
    ).toBe(true);
    receive({...emptyLiveState(), outputs: {[MAIN_SCREEN]: true}, version: 5});
    expect(root.textContent).toBe(text);
    receive({
      ...SHOWING,
      version: 6,
      layers: {
        ...SHOWING.layers,
        slide: {
          ...SHOWING.layers.slide,
          itemId: 'hymn-1',
          position: 1,
          label: null,
          lines: ['Recovered frame'],
        },
      },
    });
    expect(root.textContent).toContain('Recovered frame');
    stop();
  });

  it('routes an overlay after screen settings resolve and releases every feed on stop', async () => {
    const settings = overlaySettings();
    const startedAt = Date.now();
    const messageId = '50000000-0000-4000-8000-000000000001';
    const live = expectSuccess(
      parseLiveState({
        ...emptyLiveState(),
        layers: {
          ...emptyLiveState().layers,
          message: {
            messageId,
            text: 'Targeted output',
            items: [
              {
                messageId,
                text: 'Targeted output',
                targets: [MAIN],
                excludedTargets: [],
                startedAt,
                expiresAt: startedAt + 30_000,
              },
            ],
          },
        },
      }),
    );
    const root = document.createElement('div');
    const stopLive = vi.fn();
    const stopSettings = vi.fn();
    const pending = new Map<string, (document: SettingsDocument) => void>();
    const api = mockLlpApi({
      live: {
        get: () =>
          Promise.resolve({
            ...live,
            themeOutput,
            outputs: {[MAIN_SCREEN]: true},
          }),
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
    const stop = startOutput({root, api, screenId: MAIN_SCREEN});
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
    expect(stopSettings).toHaveBeenCalledTimes(4);
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
    await vi.waitFor(() =>
      expect(
        logs.some(entry =>
          entry.message.startsWith('could not draw theme element'),
        ),
      ).toBe(true),
    );
    const error = logs.find(entry =>
      entry.message.startsWith('could not draw theme element'),
    );
    expect(error?.level).toBe('error');
    expect(error?.detail).toBeDefined();
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
    expect(rates).toEqual([{screenId: MAIN_SCREEN, fps: 60}]);
  });

  it('reports no frame rate when the live state never arrives', async () => {
    const {logs, rates} = setUp({
      get: () => Promise.reject(new Error('main process busy')),
    });
    await vi.waitFor(() => expect(logs.length).toBeGreaterThan(0));
    runFramesFor(SECOND_AND_A_BIT_MS * 3);
    expect(rates).toEqual([]);
  });

  it('stops readiness and frame construction after acknowledgment while keeping an on output alive', async () => {
    const settings = overlaySettings();
    const defaults = mockLlpApi();
    const ready = vi.fn(() => Promise.resolve(true));
    const build = vi.spyOn(ScreenFrames.prototype, 'frame');
    const checkReady = vi.spyOn(OutputRenderer.prototype, 'ready');
    const root = document.createElement('div');
    const api = mockLlpApi({
      settings: {
        get: ({name}) =>
          name === 'screens'
            ? Promise.resolve(settings.reader.get(name))
            : defaults.settings.get({name}),
      },
      live: {
        get: () =>
          Promise.resolve({
            ...SHOWING,
            layers: {...SHOWING.layers, media: null},
          }),
      },
      output: {reportReady: ready},
    });
    const stop = startOutput({root, api, screenId: MAIN_SCREEN});
    await Promise.resolve();
    await pumpReadiness();
    await pumpReadiness();
    expect(ready).toHaveBeenCalled();
    const built = build.mock.calls.length;
    const reports = ready.mock.calls.length;
    const checks = checkReady.mock.calls.length;
    runFramesFor(3000);
    expect(build).toHaveBeenCalledTimes(built);
    expect(ready).toHaveBeenCalledTimes(reports);
    expect(checkReady).toHaveBeenCalledTimes(checks);
    expect(root.textContent).toContain('만복의 근원');
    stop();
  });

  it('stops listening and removes its picture when stopped', () => {
    const {root, logs, stop} = setUp();
    stop();
    window.dispatchEvent(new ErrorEvent('error', {message: 'after stop'}));
    expect(logs).toEqual([]);
    expect(root.childElementCount).toBe(0);
  });
});
