import {EventEmitter} from 'node:events';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {recordingLogger} from '../displays/testing';
import {LiveStore} from '../live/store';
import {MAIN, overlaySettings, STAGE} from '@core/testing/overlays';
import {guardTestPatterns} from './testPatternGuard';

class MockContents extends EventEmitter {
  destroyed = false;
  isDestroyed(): boolean {
    return this.destroyed;
  }
}

class MockControl extends EventEmitter {
  readonly contents = new MockContents();
  destroyed = false;
  contentsReads = 0;
  get webContents(): MockContents {
    this.contentsReads += 1;
    if (this.destroyed) throw new Error('Object has been destroyed');
    return this.contents;
  }
  isDestroyed(): boolean {
    return this.destroyed;
  }
}

function setup() {
  const store = new LiveStore();
  onTestFinished(store.connectSettings(overlaySettings().reader));
  for (const screenId of [MAIN, STAGE]) {
    const command = parseLiveCommand({
      type: 'screen.testPattern.set',
      screenId,
      on: true,
    });
    if (!command.ok) throw new Error(JSON.stringify(command.error));
    store.dispatch(command.value);
  }
  const control = new MockControl();
  const log = recordingLogger();
  const stop = guardTestPatterns({control, store, log});
  onTestFinished(stop);
  return {store, control, log, stop};
}

describe('guardTestPatterns', () => {
  it('releases after the control BrowserWindow is destroyed without reading webContents again', () => {
    const {control, stop} = setup();
    control.destroyed = true;
    const readDestroyed = vi
      .spyOn(control.contents, 'isDestroyed')
      .mockImplementation(() => {
        throw new Error('Destroyed owner');
      });
    expect(stop).not.toThrow();
    expect(control.contentsReads).toBe(1);
    expect(control.listenerCount('closed')).toBe(0);
    expect(readDestroyed).not.toHaveBeenCalled();
  });

  it('does not read webContents when setup receives an already destroyed control', () => {
    const control = new MockControl();
    control.destroyed = true;
    const stop = guardTestPatterns({
      control,
      store: new LiveStore(),
      log: recordingLogger(),
    });
    expect(stop).not.toThrow();
    expect(control.contentsReads).toBe(0);
    expect(control.listenerCount('closed')).toBe(0);
  });
  it.each([
    ['closes', (control: MockControl) => control.emit('closed')],
    [
      'crashes',
      (control: MockControl) => control.webContents.emit('render-process-gone'),
    ],
    [
      'loads its page again',
      (control: MockControl) =>
        control.webContents.emit('did-start-navigation', {
          isMainFrame: true,
          isSameDocument: false,
        }),
    ],
  ])('hides every pattern when the control window %s', (_name, leave) => {
    const {store, control, log} = setup();
    expect(store.state.testPatterns).toEqual([MAIN, STAGE]);
    leave(control);
    expect(store.state).not.toHaveProperty('testPatterns');
    expect(log.messages('warn')).toEqual([
      'hid the 테스트 패턴 because the control window went away',
    ]);
    leave(control);
    expect(log.messages('warn')).toHaveLength(1);
  });

  it('keeps the patterns through in-page and frame navigations', () => {
    const {store, control} = setup();
    control.webContents.emit('did-start-navigation', {
      isMainFrame: true,
      isSameDocument: true,
    });
    control.webContents.emit('did-start-navigation', {
      isMainFrame: false,
      isSameDocument: false,
    });
    expect(store.state.testPatterns).toEqual([MAIN, STAGE]);
  });

  it('stops watching, also after the control window is destroyed', () => {
    const {control, stop} = setup();
    stop();
    expect(control.listenerCount('closed')).toBe(0);
    expect(control.webContents.listenerCount('render-process-gone')).toBe(0);
    expect(control.webContents.listenerCount('did-start-navigation')).toBe(0);
    const destroyed = setup();
    destroyed.control.webContents.destroyed = true;
    // NOTE(0913vision): Electron throws on any call to destroyed web contents.
    vi.spyOn(
      destroyed.control.webContents,
      'removeListener',
    ).mockImplementation(() => {
      throw new Error('Object has been destroyed');
    });
    expect(() => destroyed.stop()).not.toThrow();
    expect(destroyed.control.listenerCount('closed')).toBe(0);
  });
});
