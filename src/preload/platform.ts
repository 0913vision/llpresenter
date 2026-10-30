import type {WindowPlatform} from '@contracts/ipc/endpoint';
import type {Result} from '@core/common/result';
import type {PayloadError} from '@core/schema/payload';
import {parseUiZoomFactor, UI_ZOOM_FACTOR} from '@core/schema/uiZoom';
import type {BadValueLog} from './port';

/** The parts of Electron's renderer modules that the platform reads. */
export interface PlatformModules {
  readonly webFrame: {getZoomFactor(): number};
  readonly webUtils: {getPathForFile(file: File): string};
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * What the preload script reads without IPC. A read that fails is logged and
 * answered with a safe value: no path, or the default zoom.
 */
export function windowPlatform(
  {webFrame, webUtils}: PlatformModules,
  log: BadValueLog,
): WindowPlatform {
  return {
    pathForFile: file => {
      try {
        return webUtils.getPathForFile(file);
      } catch (error: unknown) {
        log('request', 'media.pathForFile', {
          field: 'file',
          message: errorText(error),
        });
        return '';
      }
    },
    zoomFactor: () => {
      let parsed: Result<number, PayloadError>;
      try {
        parsed = parseUiZoomFactor(webFrame.getZoomFactor());
      } catch (error: unknown) {
        parsed = {ok: false, error: {field: '', message: errorText(error)}};
      }
      if (parsed.ok) return parsed.value;
      log('reply', 'webFrame.getZoomFactor', parsed.error);
      return UI_ZOOM_FACTOR.default;
    },
  };
}
