import {describe, expect, it} from 'vitest';
import {windowModeFrom, windowTestOptions} from './testWindows';

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
      webPreferences: {offscreen: true},
    });
  });

  it('adds nothing in normal mode', () => {
    expect(windowTestOptions('normal')).toEqual({});
  });
});
