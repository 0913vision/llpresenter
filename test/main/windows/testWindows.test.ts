import {EventEmitter} from 'node:events';
import {describe, expect, it, vi} from 'vitest';
import type {WindowAction} from '@contracts/ipc/api';
import {
  allowsWindowAction,
  discardTestFrames,
  windowModeFrom,
  windowTestOptions,
} from '@main/windows/testWindows';

describe('windowModeFrom', () => {
  it('opens windows offscreen in development when asked', () => {
    expect(windowModeFrom({LLP_TEST_WINDOWS: 'offscreen'}, false)).toBe(
      'offscreen',
    );
  });

  it.each([undefined, '', 'yes', 'Offscreen', '1'])(
    'opens windows normally for %j',
    value => {
      const env = value === undefined ? {} : {LLP_TEST_WINDOWS: value};
      expect(windowModeFrom(env, false)).toBe('normal');
    },
  );

  it('ignores the variable in a packaged app', () => {
    expect(windowModeFrom({LLP_TEST_WINDOWS: 'offscreen'}, true)).toBe(
      'normal',
    );
  });
});

describe('windowTestOptions', () => {
  it('keeps an offscreen window hidden, out of the taskbar, and drawn in memory', () => {
    expect(windowTestOptions('offscreen')).toEqual({
      show: false,
      skipTaskbar: true,
      webPreferences: {offscreen: {useSharedTexture: true}},
    });
  });

  it('adds nothing in normal mode', () => {
    expect(windowTestOptions('normal')).toEqual({});
  });
});

describe('allowsWindowAction', () => {
  it.each<WindowAction>(['minimize', 'toggle-maximize', 'close'])(
    'runs %s in normal mode',
    action => {
      expect(allowsWindowAction('normal', action)).toBe(true);
    },
  );

  it.each<WindowAction>(['minimize', 'toggle-maximize'])(
    'never runs %s on an offscreen window, which it would show',
    action => {
      expect(allowsWindowAction('offscreen', action)).toBe(false);
    },
  );

  it('still closes an offscreen window', () => {
    expect(allowsWindowAction('offscreen', 'close')).toBe(true);
  });
});

describe('discardTestFrames', () => {
  it('releases every offscreen frame at once and stops at destruction', () => {
    const contents = new EventEmitter();
    discardTestFrames(contents, 'offscreen');
    const release = vi.fn();

    contents.emit('paint', {texture: {release}});
    contents.emit('paint', {texture: {release}});
    expect(release).toHaveBeenCalledTimes(2);
    expect(() => contents.emit('paint', {})).not.toThrow();
    contents.emit('destroyed');
    expect(contents.listenerCount('paint')).toBe(0);
  });

  it('listens to no frames in normal mode', () => {
    const contents = new EventEmitter();
    discardTestFrames(contents, 'normal');

    expect(contents.listenerCount('paint')).toBe(0);
  });
});
