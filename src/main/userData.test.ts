import {describe, expect, it, vi} from 'vitest';
import {applyUserDataOverride} from './userData';

const ABSOLUTE = process.platform === 'win32' ? 'C:\\data\\qa' : '/data/qa';

describe('applyUserDataOverride', () => {
  it('keeps the default folder when the value is unset or empty', () => {
    const setPath = vi.fn();
    expect(applyUserDataOverride(undefined, setPath)).toBeNull();
    expect(applyUserDataOverride('', setPath)).toBeNull();
    expect(setPath).not.toHaveBeenCalled();
  });

  it('moves the folder to an absolute path', () => {
    const setPath = vi.fn();
    expect(applyUserDataOverride(ABSOLUTE, setPath)).toBeNull();
    expect(setPath).toHaveBeenCalledWith(ABSOLUTE);
  });

  it.each(['relative', 'C:dataqa', String.raw`data\qa`])(
    'reports %s as not absolute without moving the folder',
    value => {
      const setPath = vi.fn();
      expect(applyUserDataOverride(value, setPath)).toEqual({
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
    expect(applyUserDataOverride(ABSOLUTE, setPath)).toEqual({
      value: ABSOLUTE,
      reason: 'Failed to set path',
    });
  });
});
