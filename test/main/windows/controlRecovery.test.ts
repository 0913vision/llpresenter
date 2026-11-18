import {expect, it, vi} from 'vitest';
import {controlRecoveryPlacement} from '@main/windows/controlRecovery';

it.each([false, true])(
  'preserves the previous maximized state: %s',
  maximized => {
    const bounds = {x: 12, y: 34, width: 1400, height: 800};
    const previous = {
      isDestroyed: () => false,
      isMaximized: () => maximized,
      getBounds: vi.fn(() => bounds),
    };
    expect(controlRecoveryPlacement(previous)).toEqual(
      maximized ? {startMaximized: true} : {startMaximized: false, bounds},
    );
    expect(previous.getBounds).toHaveBeenCalledTimes(maximized ? 0 : 1);
  },
);
