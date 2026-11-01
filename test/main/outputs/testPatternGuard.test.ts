import {EventEmitter} from 'node:events';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {createScreenId} from '@core/schema/ids';
import {recordingLogger} from '@fixtures/main/displays/testing';
import type {LiveStore} from '@main/live/store';
import {guardTestPatterns} from '@main/outputs/testPatternGuard';

const MAIN = createScreenId('00000000-0000-4000-8000-000000000001');
const STAGE = createScreenId('00000000-0000-4000-8000-000000000003');

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

/** A store that takes a pattern off when the guard asks. */
function mockStore() {
  let state: LiveState = {...emptyLiveState(), testPatterns: [MAIN, STAGE]};
  return {
    get state() {
      return state;
    },
    handles: vi.fn<LiveStore['handles']>(() => true),
    dispatch: vi.fn<LiveStore['dispatch']>(command => {
      if (command.type !== 'screen.testPattern.set' || command.on) return false;
      state = {
        ...state,
        testPatterns: (state.testPatterns ?? []).filter(
          id => id !== command.screenId,
        ),
      };
      return true;
    }),
  };
}

function setup() {
  const store = mockStore();
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
      store: mockStore(),
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
    leave(control);
    expect(store.dispatch.mock.calls.map(([command]) => command)).toEqual([
      {type: 'screen.testPattern.set', screenId: MAIN, on: false},
      {type: 'screen.testPattern.set', screenId: STAGE, on: false},
    ]);
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
    expect(store.dispatch).not.toHaveBeenCalled();
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
