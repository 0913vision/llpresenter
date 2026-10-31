import {describe, expect, it, vi} from 'vitest';
import {UI_ZOOM_FACTOR} from '@core/schema/uiZoom';
import {windowPlatform, type PlatformModules} from './platform';

function platformWith(modules: {
  readonly zoom?: () => unknown;
  readonly path?: (file: File) => string;
}) {
  const log = vi.fn();
  const mocks: PlatformModules = {
    webFrame: {getZoomFactor: () => Number(modules.zoom?.() ?? 1)},
    webUtils: {getPathForFile: modules.path ?? (() => '')},
  };
  return {log, platform: windowPlatform(mocks, log)};
}

describe('the window zoom factor', () => {
  it.each([UI_ZOOM_FACTOR.min, 1.2, UI_ZOOM_FACTOR.max])(
    'reads the bounded native factor %s',
    factor => {
      const {platform, log} = platformWith({zoom: () => factor});
      expect(platform.zoomFactor()).toBe(factor);
      expect(log).not.toHaveBeenCalled();
    },
  );

  it.each([NaN, Infinity, 0.9, 2.1])(
    'logs the invalid native factor %j and answers the default',
    factor => {
      const {platform, log} = platformWith({zoom: () => factor});
      expect(platform.zoomFactor()).toBe(UI_ZOOM_FACTOR.default);
      expect(log).toHaveBeenCalledWith(
        'reply',
        'webFrame.getZoomFactor',
        expect.anything(),
      );
    },
  );

  it('logs a native read failure and answers the default', () => {
    const {platform, log} = platformWith({
      zoom: () => {
        throw new Error('Invented native zoom failure');
      },
    });
    expect(platform.zoomFactor()).toBe(UI_ZOOM_FACTOR.default);
    expect(log).toHaveBeenCalledWith('reply', 'webFrame.getZoomFactor', {
      field: '',
      message: 'Invented native zoom failure',
    });
  });
});

describe('dropped file paths', () => {
  it('answers the native path, or an empty one for a file without it', () => {
    const file = new File(['Invented bytes'], 'clip.mp4');
    const path = vi
      .fn<(file: File) => string>()
      .mockReturnValueOnce('C:\\media\\clip.mp4')
      .mockReturnValueOnce('');
    const {platform} = platformWith({path});
    expect(platform.pathForFile(file)).toBe('C:\\media\\clip.mp4');
    expect(platform.pathForFile(file)).toBe('');
    expect(path).toHaveBeenCalledWith(file);
  });

  it('logs a value that is not a native file and answers an empty path', () => {
    const {platform, log} = platformWith({
      path: () => {
        throw new TypeError('Expected a native File');
      },
    });
    expect(platform.pathForFile(new File([], 'x'))).toBe('');
    expect(log).toHaveBeenCalledWith('request', 'media.pathForFile', {
      field: 'file',
      message: 'Expected a native File',
    });
  });
});
