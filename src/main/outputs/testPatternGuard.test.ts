import {EventEmitter} from 'node:events';
import {describe, expect, it, onTestFinished} from 'vitest';
import {parseLiveCommand} from '@shared/schema/liveCommand';
import {recordingLogger} from '../displays/testing';
import {LiveStore} from '../live/store';
import {MAIN, overlaySettings, STAGE} from '../live/testing/overlays';
import {guardTestPatterns} from './testPatternGuard';

class FakeContents extends EventEmitter {
  destroyed = false;
  isDestroyed(): boolean {
    return this.destroyed;
  }

  // NOTE(0913vision): Electron throws on any call to destroyed web contents.
  override removeListener(
    event: string | symbol,
    listener: (...args: unknown[]) => void,
  ): this {
    if (this.destroyed) throw new Error('Object has been destroyed');
    return super.removeListener(event, listener);
  }
}

class FakeControl extends EventEmitter {
  readonly webContents = new FakeContents();
  isDestroyed(): boolean {
    return false;
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
  const control = new FakeControl();
  const log = recordingLogger();
  const stop = guardTestPatterns({control, store, log});
  onTestFinished(stop);
  return {store, control, log, stop};
}

describe('guardTestPatterns', () => {
  it.each([
    ['closes', (control: FakeControl) => control.emit('closed')],
    [
      'crashes',
      (control: FakeControl) => control.webContents.emit('render-process-gone'),
    ],
    [
      'loads its page again',
      (control: FakeControl) =>
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
    expect(() => destroyed.stop()).not.toThrow();
    expect(destroyed.control.listenerCount('closed')).toBe(0);
  });
});
