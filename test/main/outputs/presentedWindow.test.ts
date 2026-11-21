import type {EventEmitter} from 'node:events';
import {afterEach, describe, expect, it, vi, type Mock} from 'vitest';
import type {OutputWindowHandle} from '@main/outputs/outputWindow';
import type {OutputScreen} from '@main/outputs/screens';

type PageContents = EventEmitter & {
  readonly setFrameRate: Mock;
  readonly stopPainting: Mock;
  readonly startPainting: Mock;
  readonly reload: Mock;
  readonly forcefullyCrashRenderer: Mock;
  readonly executeJavaScript: Mock;
};

interface PageRecord {
  readonly options: Record<string, unknown>;
  readonly contents: PageContents;
  destroyed: boolean;
}

interface ChildRecord {
  readonly emitter: EventEmitter;
  readonly posted: Array<Record<string, unknown>>;
  killed: boolean;
}

const mocks = vi.hoisted(() => {
  const windows: PageRecord[] = [];
  const children: ChildRecord[] = [];
  return {windows, children};
});

vi.mock('electron', async () => {
  const {EventEmitter: Emitter} = await import('node:events');
  class MockBrowserWindow extends Emitter {
    readonly webContents: PageContents;
    private destroyedFlag = false;
    private size = {width: 0, height: 0};
    constructor(options: Record<string, unknown>) {
      super();
      const contents = Object.assign(new Emitter(), {
        setFrameRate: vi.fn(),
        stopPainting: vi.fn(),
        startPainting: vi.fn(),
        reload: vi.fn(),
        forcefullyCrashRenderer: vi.fn(),
        executeJavaScript: vi.fn().mockResolvedValue(0),
      });
      this.webContents = contents;
      const record = {options, contents, destroyed: false};
      mocks.windows.push(record);
      this.on('destroy-record', () => {
        record.destroyed = true;
      });
    }
    setContentSize(width: number, height: number): void {
      this.size = {width, height};
    }
    getContentBounds() {
      return {x: 0, y: 0, ...this.size};
    }
    setTitle(): void {}
    isDestroyed(): boolean {
      return this.destroyedFlag;
    }
    destroy(): void {
      this.destroyedFlag = true;
      this.emit('destroy-record');
    }
  }
  return {
    BrowserWindow: MockBrowserWindow,
    screen: {
      getDisplayMatching: () => ({displayFrequency: 60}),
      dipToScreenRect: (_window: unknown, rect: unknown) => rect,
    },
    utilityProcess: {
      fork: () => {
        const emitter = new Emitter();
        const posted: Array<Record<string, unknown>> = [];
        const child: ChildRecord = {emitter, posted, killed: false};
        mocks.children.push(child);
        return Object.assign(emitter, {
          postMessage: (message: Record<string, unknown>) => {
            child.posted.push(message);
          },
          kill: () => {
            child.killed = true;
          },
        });
      },
    },
  };
});
vi.mock('@main/windows/page', () => ({
  blockNavigation: () => undefined,
  preloadPath: 'preload.js',
  startLoading: async () => undefined,
}));
vi.mock('@main/outputs/electronWindow', () => ({
  OUTPUT_BACKGROUND: '#000000',
}));

const {createPresentedOutputWindow, presentTransition} =
  await import('@main/outputs/presentedWindow');
const {outputTransitionActive} =
  await import('@main/outputs/transitionActivity');

const screen: OutputScreen = {
  id: 'main',
  name: '청중 화면',
  kind: 'audience',
  method: 'fullscreen',
  display: null,
  onDisconnect: 'window',
};
const monitor = {x: 1920, y: 0, width: 1920, height: 1080};

function fallbackWindow(): OutputWindowHandle & {
  calls: string[];
} {
  const calls: string[] = [];
  const record = (name: string) => (): void => {
    calls.push(name);
  };
  return {
    calls,
    configure: record('configure'),
    prepare: record('prepare'),
    requestFrame: record('requestFrame'),
    contentSize: () => ({width: 1920, height: 1080}),
    setAlwaysOnTop: record('setAlwaysOnTop'),
    showFullScreen: record('showFullScreen'),
    showWindowed: record('showWindowed'),
    showCapture: record('showCapture'),
    prepareForMonitorRemoval: record('prepareForMonitorRemoval'),
    bringToFront: record('bringToFront'),
    bounds: () => null,
    hide: record('hide'),
    reload: async () => undefined,
    crashRenderer: record('crashRenderer'),
    ping: async () => undefined,
    destroy: record('destroy'),
  };
}

function setup() {
  const fallbacks: Array<ReturnType<typeof fallbackWindow>> = [];
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: async () => undefined,
  };
  const handle = createPresentedOutputWindow(
    screen,
    {onRendererGone: vi.fn(), onCloseRequested: vi.fn()},
    {
      log,
      window: () => {
        const made = fallbackWindow();
        fallbacks.push(made);
        return made;
      },
    },
  );
  return {handle, fallbacks, log};
}

function texture() {
  const handle = Buffer.alloc(8);
  handle.writeBigUInt64LE(0x1234n);
  return {
    textureInfo: {handle: {ntHandle: handle}},
    release: vi.fn(),
  };
}

function spawned() {
  const child = mocks.children.at(-1);
  if (child === undefined) throw new Error('No presenter process');
  child.emitter.emit('spawn');
  return child;
}

afterEach(() => {
  mocks.windows.length = 0;
  mocks.children.length = 0;
  vi.useRealTimers();
});

describe('a full screen output drawn by a presenter', () => {
  it('draws its page offscreen and opens the presenter on the monitor at its refresh', () => {
    const {handle, fallbacks} = setup();
    handle.prepare(monitor, 'fullscreen');
    expect(fallbacks).toHaveLength(0);
    const page = mocks.windows[0];
    expect(page?.options).toMatchObject({
      show: false,
      webPreferences: {offscreen: {useSharedTexture: true}},
    });
    expect(page?.contents.setFrameRate).toHaveBeenCalledWith(60);
    const child = spawned();
    expect(child.posted[0]).toEqual({
      type: 'open',
      bounds: monitor,
      hz: 60,
      topmost: true,
    });
    handle.destroy();
  });

  it('keeps the frame painted before the presenter is ready and releases it once copied', () => {
    const {handle} = setup();
    handle.showFullScreen(monitor, true);
    const child = spawned();
    const first = texture();
    mocks.windows[0]?.contents.emit('paint', {texture: first}, {});
    expect(child.posted.some(message => message['type'] === 'frame')).toBe(
      false,
    );
    child.emitter.emit('message', {type: 'ready'});
    expect(child.posted.at(-1)).toEqual({
      type: 'frame',
      pid: process.pid,
      handle: '1234',
    });
    expect(first.release).not.toHaveBeenCalled();
    child.emitter.emit('message', {type: 'copied'});
    expect(first.release).toHaveBeenCalledOnce();
    handle.destroy();
  });

  it('hands slide transitions of its screen to the presenter', () => {
    const {handle} = setup();
    handle.showFullScreen(monitor, true);
    const child = spawned();
    presentTransition('main', {kind: 'wipe', dir: 'right', sec: 2});
    presentTransition('other', {kind: 'wipe', sec: 2});
    expect(
      child.posted.filter(message => message['type'] === 'transition'),
    ).toEqual([
      {type: 'transition', kind: 'wipe', dir: 'right', sec: 2, sequence: 1},
    ]);
    handle.destroy();
  });

  it('keeps picture pacing active until the current transition ends or hides', () => {
    const {handle} = setup();
    handle.showFullScreen(monitor, true);
    const child = spawned();
    expect(outputTransitionActive()).toBe(false);
    presentTransition('main', {kind: 'wipe', sec: 4});
    expect(outputTransitionActive()).toBe(true);
    presentTransition('main', {kind: 'wipe', sec: 4});
    child.emitter.emit('message', {type: 'transitioned', sequence: 1});
    expect(outputTransitionActive()).toBe(true);
    child.emitter.emit('message', {type: 'transitioned', sequence: 2});
    expect(outputTransitionActive()).toBe(false);
    presentTransition('main', {kind: 'wipe', sec: 4});
    expect(outputTransitionActive()).toBe(true);
    handle.hide();
    expect(outputTransitionActive()).toBe(false);
    handle.destroy();
  });

  it('uses the output window for window placements', () => {
    const {handle, fallbacks} = setup();
    handle.showFullScreen(monitor, true);
    handle.showWindowed(null, false);
    expect(mocks.windows[0]?.destroyed).toBe(true);
    expect(fallbacks[0]?.calls).toContain('showWindowed');
    handle.destroy();
  });

  it('falls back to the output window in full screen when the presenter fails', () => {
    const {handle, fallbacks, log} = setup();
    handle.showFullScreen(monitor, false);
    const child = spawned();
    child.emitter.emit('message', {type: 'error', message: 'no device'});
    expect(log.warn).toHaveBeenCalled();
    expect(fallbacks[0]?.calls).toEqual([
      'configure',
      'prepare',
      'showFullScreen',
    ]);
    handle.showFullScreen(monitor, false);
    expect(mocks.children).toHaveLength(1);
    handle.destroy();
  });
});
