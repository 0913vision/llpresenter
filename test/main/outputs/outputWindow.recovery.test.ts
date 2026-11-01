import {describe, expect, it, vi} from 'vitest';
import {installMockClock} from '@fixtures/mockClock';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {mockWindows, fullScreenScreen} from '@fixtures/main/outputs/testing';
import {
  OutputWindow,
  OUTPUT_REVEAL_DEADLINE_MS,
} from '@main/outputs/outputWindow';
import type {ShownPlacement} from '@main/outputs/placement';

const mocks = vi.hoisted(() => {
  class Recovery {
    state: 'running' | 'restarting' | 'limited' = 'running';
    readonly crashed = vi.fn();
    readonly pageDrawn = vi.fn();
    readonly resume = vi.fn();
    readonly retry = vi.fn();
    readonly dispose = vi.fn();
    constructor(readonly options: {readonly reload: () => Promise<void>}) {
      recoveries.push(this);
    }
  }
  class Watch {
    readonly beat = vi.fn();
    readonly stop = vi.fn();
    readonly pageReplaced = vi.fn();
    constructor(
      readonly options: {
        readonly ping: () => Promise<void>;
        readonly onHung: () => void;
        readonly onSilentButAnswering: () => void;
      },
    ) {
      watches.push(this);
    }
  }
  const recoveries: Recovery[] = [];
  const watches: Watch[] = [];
  return {Recovery, Watch, recoveries, watches};
});

vi.mock('@main/outputs/rendererRecovery', async importOriginal => ({
  ...(await importOriginal<typeof import('@main/outputs/rendererRecovery')>()),
  RendererRecovery: mocks.Recovery,
}));
vi.mock('@main/outputs/hangWatch', async importOriginal => ({
  ...(await importOriginal<typeof import('@main/outputs/hangWatch')>()),
  HangWatch: mocks.Watch,
}));

const FULL_SCREEN: ShownPlacement = {
  kind: 'fullscreen',
  bounds: {x: 1920, y: 0, width: 1920, height: 1080},
  alwaysOnTop: true,
};

function setUp() {
  const windows = mockWindows();
  const log = recordingLogger();
  const output = new OutputWindow({
    screen: fullScreenScreen(),
    createHandle: windows.create,
    onCloseRequested: vi.fn(),
    log,
    liveVersion: () => 0,
  });
  const recovery = mocks.recoveries.at(-1);
  const watch = mocks.watches.at(-1);
  if (recovery === undefined || watch === undefined) {
    throw new Error('Missing recovery or hang watch');
  }
  const reveal = () => {
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    output.frameReady(0, {...handle.contentSize(), ready: true});
    return handle;
  };
  return {output, windows, log, recovery, watch, reveal};
}

describe('OutputWindow recovery', () => {
  it('resumes its recovery as soon as a hidden output is requested, before a ready frame', () => {
    const {output, windows, recovery} = setUp();

    output.update(FULL_SCREEN);

    expect(recovery.resume).toHaveBeenCalledOnce();
    expect(windows.only('main').mode.kind).toBe('hidden');
    output.dispose();
  });

  it('hands a crash to its recovery, reloads through its window, and stays on screen', async () => {
    const {output, recovery, watch, reveal} = setUp();
    const handle = reveal();

    handle.crash('oom', 3);
    expect(recovery.crashed).toHaveBeenCalledExactlyOnceWith({
      reason: 'oom',
      exitCode: 3,
    });
    expect(watch.pageReplaced).toHaveBeenCalledOnce();
    await recovery.options.reload();
    expect(handle.reloads).toBe(1);
    handle.failNextReload = true;
    await expect(recovery.options.reload()).rejects.toThrow('ERR_FAILED');
    recovery.state = 'limited';
    expect(output.rendererState).toBe('limited');
    expect(handle.mode.kind).toBe('fullscreen');
    output.dispose();
  });

  it('stops watching when hidden and keeps its recovery, so a page reloaded meanwhile shows at once', async () => {
    const {output, recovery, watch, reveal} = setUp();
    const handle = reveal();

    output.update(null);
    expect(watch.stop).toHaveBeenCalledOnce();
    expect(recovery.dispose).not.toHaveBeenCalled();
    await recovery.options.reload();
    output.update(FULL_SCREEN);

    expect(handle.reloads).toBe(1);
    expect(handle.mode.kind).toBe('fullscreen');
    output.dispose();
  });

  it('releases its recovery, hang watch and window on dispose, and ignores a later crash', () => {
    const {output, windows, recovery, watch, reveal} = setUp();
    const handle = reveal();

    output.dispose();
    handle.crash();
    output.update(FULL_SCREEN);

    expect(recovery.dispose).toHaveBeenCalledOnce();
    expect(watch.stop).toHaveBeenCalledOnce();
    expect(handle.destroyed).toBe(true);
    expect(recovery.crashed).not.toHaveBeenCalled();
    expect(windows.created).toHaveLength(1);
  });
});

describe('OutputWindow hang handling', () => {
  it('pings through its window, and on a hang crashes the renderer, logs, and watches again', async () => {
    const {output, log, watch, reveal} = setUp();
    const handle = reveal();
    watch.beat.mockClear();

    await watch.options.ping();
    watch.options.onHung();

    expect(handle.pings).toBe(1);
    expect(handle.forcedCrashes).toBe(1);
    expect(watch.beat).toHaveBeenCalledOnce();
    expect(log.messages('error')).toEqual([
      'output window stopped drawing and answering; restarting its renderer',
    ]);
    output.dispose();
  });

  it('logs a page that answers but reports no frames instead of crashing it', () => {
    const {output, log, watch, reveal} = setUp();
    const handle = reveal();

    watch.options.onSilentButAnswering();

    expect(handle.forcedCrashes).toBe(0);
    expect(log.messages('warn')).toEqual([
      'output window answers but reports no frames',
    ]);
    output.dispose();
  });

  it('watches only a shown page that drew since it loaded, while its renderer runs', async () => {
    const clock = installMockClock();
    const {output, windows, recovery, watch} = setUp();
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    output.frameReported();
    expect(watch.beat).not.toHaveBeenCalled();
    output.frameReady(0, {...handle.contentSize(), ready: true});
    expect(watch.beat).toHaveBeenCalledOnce();

    output.update(null);
    output.frameReported();
    output.update(FULL_SCREEN);
    expect(watch.beat).toHaveBeenCalledTimes(2);

    recovery.state = 'restarting';
    output.frameReported();
    expect(watch.beat).toHaveBeenCalledTimes(2);
    recovery.state = 'running';

    handle.crash();
    output.update(null);
    output.update(FULL_SCREEN);
    await clock.advance(OUTPUT_REVEAL_DEADLINE_MS);
    expect(handle.mode.kind).toBe('fullscreen');
    expect(watch.beat).toHaveBeenCalledTimes(2);
    output.dispose();
  });
});
