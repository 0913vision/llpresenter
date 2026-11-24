import {BrowserWindow} from 'electron';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {outputEndpoints} from '@contracts/ipc/output';
import {emptyLiveState} from '@core/schema/live/live';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {CAPTIONS, MAIN} from '@fixtures/core/overlays';
import {PreviewHub} from '@main/outputs/previewHub';
import type {OutputScreen} from '@main/outputs/screens';

const APP = 'file:///app/index.html';

const electron = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  let next = 1;
  class MockContents extends EventEmitter {
    readonly id = next++;
    readonly sent: Array<readonly [string, unknown]> = [];
    gone = false;
    constructor(private readonly url: string) {
      super();
    }
    send(channel: string, value: unknown): void {
      this.sent.push([channel, value]);
    }
    isDestroyed(): boolean {
      return this.gone;
    }
    isOffscreen(): boolean {
      return false;
    }
    getURL(): string {
      return this.url;
    }
    getMediaSourceId(): string {
      return 'source';
    }
  }
  class MockWindow {
    static readonly all: MockWindow[] = [];
    static getAllWindows(): readonly MockWindow[] {
      return MockWindow.all;
    }
    readonly webContents: MockContents;
    private readonly parent: unknown;
    constructor({title, parent}: {title: string; parent?: unknown}) {
      this.webContents = new MockContents(title);
      this.parent = parent;
      MockWindow.all.push(this);
    }
    isDestroyed(): boolean {
      return false;
    }
    getParentWindow(): unknown {
      return this.parent;
    }
  }
  return {MockWindow};
});
vi.mock('electron', () => ({BrowserWindow: electron.MockWindow}));
const alpha = vi.hoisted(() => ({
  ack: vi.fn(),
  stop: vi.fn(),
  create: vi.fn<(options: {send: (frame: Uint8Array) => void}) => void>(),
}));
vi.mock('@main/outputs/alphaMirror', () => ({
  createAlphaMirror: (options: {send: (frame: Uint8Array) => void}) => {
    alpha.create(options);
    return {ack: alpha.ack, stop: alpha.stop};
  },
}));

function screenOf(id: string, more: Partial<OutputScreen> = {}): OutputScreen {
  return {
    id,
    name: id,
    method: 'fullscreen',
    display: null,
    onDisconnect: 'off',
    ...more,
  };
}

function setup() {
  const control = new BrowserWindow({title: APP});
  const settings = new BrowserWindow({
    title: `${APP}?window=settings`,
    parent: control,
  });
  const output = new BrowserWindow({
    title: `file:///app/output.html?screen=${MAIN}`,
  });
  const hub = new PreviewHub({
    control,
    store: {
      state: {...emptyLiveState(), outputs: {[MAIN]: true, [CAPTIONS]: true}},
    },
    screens: () => [screenOf(MAIN), screenOf(CAPTIONS, {target: 'ndi'})],
    contentsOf: id => (id === MAIN ? output.webContents : null),
    log: recordingLogger(),
  });
  return {
    hub,
    control: control.webContents,
    settings: settings.webContents,
    output,
  };
}

/** What a mock window was sent on a channel. */
function sentTo(id: number, channel: string): unknown[] {
  const win = electron.MockWindow.all.find(
    ({webContents}) => webContents.id === id,
  );
  return (win?.webContents.sent ?? [])
    .filter(([name]) => name === channel)
    .map(([, value]) => value);
}

const RELAY = outputEndpoints.previewRelay.channel;
const FRAME = outputEndpoints.previewFrame.channel;
const frame = new Uint8Array([1]);

beforeEach(() => {
  electron.MockWindow.all.length = 0;
  vi.clearAllMocks();
  vi.spyOn(performance, 'now').mockReturnValue(0);
});

describe('PreviewHub', () => {
  it('gives a source only to the windows of the operator, of outputs that are on', () => {
    const {hub, control, settings, output} = setup();
    expect(hub.sourceOf(MAIN, control)).toBe('source');
    expect(hub.sourceOf('unknown', control)).toBeNull();
    expect(hub.sourceOf(MAIN, output.webContents)).toBeNull();
    expect(hub.sourceOf(MAIN, settings)).toBe('relay');
  });

  it('has the window that captures an output pass its frames on to the others', () => {
    const {hub, control, settings} = setup();
    hub.control({screenId: MAIN, action: 'start'}, control);
    hub.sourceOf(MAIN, control);
    expect(sentTo(control.id, RELAY)).toEqual([]);
    hub.control({screenId: MAIN, action: 'start'}, settings);
    expect(sentTo(control.id, RELAY)).toEqual([
      {screenId: MAIN, enabled: true},
    ]);

    hub.publish({screenId: MAIN, frame}, control);
    hub.publish({screenId: MAIN, frame}, control);
    expect(sentTo(settings.id, FRAME)).toEqual([{screenId: MAIN, frame}]);
    expect(sentTo(control.id, FRAME)).toEqual([]);

    hub.control({screenId: MAIN, action: 'stop'}, settings);
    expect(sentTo(control.id, RELAY).at(-1)).toEqual({
      screenId: MAIN,
      enabled: false,
    });
  });

  it('takes no frames from a window that does not capture the output', () => {
    const {hub, control, settings} = setup();
    hub.control({screenId: MAIN, action: 'start'}, control);
    hub.sourceOf(MAIN, control);
    hub.publish({screenId: MAIN, frame}, settings);
    expect(sentTo(control.id, FRAME)).toEqual([]);
  });

  it('shows the own frames of an output that no window can capture', () => {
    const {hub, control} = setup();
    expect(hub.sourceOf(CAPTIONS, control)).toBe('alpha');
    expect(alpha.create).not.toHaveBeenCalled();
    hub.control({screenId: CAPTIONS, action: 'start'}, control);
    expect(alpha.create).toHaveBeenCalledOnce();

    alpha.create.mock.calls[0]?.[0].send(frame);
    expect(sentTo(control.id, FRAME)).toEqual([{screenId: CAPTIONS, frame}]);
    expect(alpha.ack).not.toHaveBeenCalled();
    hub.control({screenId: CAPTIONS, action: 'ack'}, control);
    expect(alpha.ack).toHaveBeenCalledOnce();

    hub.control({screenId: CAPTIONS, action: 'stop'}, control);
    expect(alpha.stop).toHaveBeenCalledOnce();
  });

  it('forgets a window that closes', () => {
    const {hub, control} = setup();
    hub.control({screenId: CAPTIONS, action: 'start'}, control);
    control.emit('destroyed');
    expect(alpha.stop).toHaveBeenCalledOnce();
    expect(control.listenerCount('destroyed')).toBe(0);
  });

  it('stops everything at once', () => {
    const {hub, control, settings} = setup();
    hub.control({screenId: CAPTIONS, action: 'start'}, control);
    hub.control({screenId: CAPTIONS, action: 'start'}, settings);
    hub.stop();
    expect(alpha.stop).toHaveBeenCalledOnce();
    expect(control.listenerCount('destroyed')).toBe(0);
    expect(settings.listenerCount('destroyed')).toBe(0);
  });
});
