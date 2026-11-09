import {expect, it, vi} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/live/state';
import type {FrameReadyReport} from '@core/schema/ipcPayloads';
import {resolveThemeOutput} from '@core/themes/output';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {screensDocument} from '@fixtures/core/screenDocuments';
import {MAIN_SCREEN} from '@fixtures/core/screenIds';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {fullScreenScreen, mockWindows} from '@fixtures/main/outputs/testing';
import {
  OutputWindow,
  OUTPUT_REVEAL_DEADLINE_MS,
} from '@main/outputs/outputWindow';
import {LaunchIdle} from '@main/store/launchIdle';
import {startOutput} from '@renderer/output/startOutput';

const rendering = vi.hoisted(() => ({complete: false}));
vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render(): void {}
    ready(): boolean {
      return rendering.complete;
    }
    moving(): boolean {
      return false;
    }
    dispose(): void {}
  },
}));

it('keeps the real readiness handshake alive after deadline reveal until a complete frame releases launch idle', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', (handle: number) =>
    window.clearTimeout(handle),
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
  rendering.complete = false;
  const screens = screensDocument();
  if (screens.name !== 'screens') throw Error('Missing screens');
  const themeItem = {id: 'song', kind: 'song', source: 'external'} as const;
  const state: LiveState = {
    ...emptyLiveState(),
    version: 1,
    outputs: {[MAIN_SCREEN]: true},
    themeItem,
    themeOutput: resolveThemeOutput({
      file: null,
      screens: screens.value.screens,
      item: themeItem,
      revision: 1,
    }),
  };
  const windows = mockWindows();
  const output = new OutputWindow({
    screen: fullScreenScreen({id: MAIN_SCREEN}),
    createHandle: windows.create,
    liveVersion: () => state.version,
    onCloseRequested: () => undefined,
    log: recordingLogger(),
  });
  const idle = new LaunchIdle();
  const released = vi.fn();
  const release = idle.ready.then(released);
  idle.serviceReady();
  const reportReady = vi.fn(async (report: FrameReadyReport) => {
    const acknowledged = output.frameReady(report.version, report);
    if (output.framePrepared) idle.outputsReady();
    return acknowledged;
  });
  const defaults = mockLlpApi();
  const api = mockLlpApi({
    settings: {
      get: request =>
        request.name === 'screens'
          ? Promise.resolve(screens)
          : defaults.settings.get(request),
    },
    live: {get: async () => state},
    output: {reportReady},
  });
  output.update({
    kind: 'window',
    reason: 'method',
    bounds: {x: 0, y: 0, width: window.innerWidth, height: window.innerHeight},
  });
  const stop = startOutput({
    root: document.createElement('div'),
    api,
    screenId: MAIN_SCREEN,
  });
  try {
    await vi.advanceTimersByTimeAsync(OUTPUT_REVEAL_DEADLINE_MS);
    expect(windows.only(MAIN_SCREEN).mode.kind).toBe('window');
    expect(output.framePrepared).toBe(false);
    const countAtReveal = reportReady.mock.calls.length;
    await vi.advanceTimersByTimeAsync(400);
    const countAfterReveal = reportReady.mock.calls.length;
    expect(countAfterReveal).toBeGreaterThan(countAtReveal);
    expect(reportReady.mock.calls.every(([report]) => !report.ready)).toBe(
      true,
    );
    await expect(reportReady.mock.results.at(-1)?.value).resolves.toBe(false);
    expect(released).not.toHaveBeenCalled();
    rendering.complete = true;
    await vi.advanceTimersByTimeAsync(200);
    expect(reportReady.mock.calls.length).toBeGreaterThan(countAfterReveal);
    expect(reportReady).toHaveBeenLastCalledWith(
      expect.objectContaining({version: 1, ready: true}),
    );
    await expect(reportReady.mock.results.at(-1)?.value).resolves.toBe(true);
    expect(output.framePrepared).toBe(true);
    const countWhenReady = reportReady.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1500);
    expect(reportReady).toHaveBeenCalledTimes(countWhenReady);
    expect(released).toHaveBeenCalledExactlyOnceWith(true);
  } finally {
    stop();
    output.dispose();
    idle.dispose();
    await release;
    vi.useRealTimers();
  }
});
