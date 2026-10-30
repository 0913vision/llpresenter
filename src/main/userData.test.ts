import {describe, expect, it, vi} from 'vitest';
import {applyUserDataOverride, defaultUserDataPath} from './userData';

const ABSOLUTE = process.platform === 'win32' ? 'C:\\data\\qa' : '/data/qa';
const DEFAULT = defaultUserDataPath(ABSOLUTE);

describe('defaultUserDataPath', () => {
  it('names the app data folder without spaces or non-ASCII letters', () => {
    const folder = defaultUserDataPath(ABSOLUTE);
    expect(folder.startsWith(ABSOLUTE)).toBe(true);
    expect(folder.slice(ABSOLUTE.length + 1)).toMatch(/^[A-Za-z]+$/);
  });
});

describe('applyUserDataOverride', () => {
  it('uses the default folder when the value is unset or empty', () => {
    const setPath = vi.fn();
    expect(applyUserDataOverride(undefined, setPath, DEFAULT)).toBeNull();
    expect(applyUserDataOverride('', setPath, DEFAULT)).toBeNull();
    expect(setPath.mock.calls).toEqual([[DEFAULT], [DEFAULT]]);
  });

  it('moves the folder to an absolute path', () => {
    const setPath = vi.fn();
    expect(applyUserDataOverride(ABSOLUTE, setPath, DEFAULT)).toBeNull();
    expect(setPath).toHaveBeenCalledWith(ABSOLUTE);
  });

  it.each(['relative', 'C:dataqa', String.raw`data\qa`])(
    'reports %s as not absolute without moving the folder',
    value => {
      const setPath = vi.fn();
      expect(applyUserDataOverride(value, setPath, DEFAULT)).toEqual({
        value,
        reason: 'the path is not absolute',
      });
      expect(setPath).not.toHaveBeenCalled();
    },
  );

  it('reports a path that Electron refuses instead of throwing', () => {
    const setPath = vi.fn(() => {
      throw new Error('Failed to set path');
    });
    expect(applyUserDataOverride(ABSOLUTE, setPath, DEFAULT)).toEqual({
      value: ABSOLUTE,
      reason: 'Failed to set path',
    });
  });
});
