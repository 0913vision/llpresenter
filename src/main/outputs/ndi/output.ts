import {NDI_DEFAULT_HARDWARE_ACCELERATION} from '@core/schema/screens/screens';
import type {OutputScreen} from '../screens';
import type {OutputWindowEvents, OutputWindowHandle} from '../outputWindow';
import type {Logger} from '../../base/log';
import {createBitmapOutput} from './bitmapOutput';
import {createGpuOutput} from './gpuOutput';
import {forwardingHandle} from './forwardingHandle';
import {NDI_FRAME_WIDTH, NDI_FRAME_HEIGHT} from './textureQueue';
import type {OutputScreenStatus} from '@core/schema/live/outputStatus';

/** Creates an offscreen output whose sender is isolated in a utility process. */
export function createNdiOutput(
  screen: OutputScreen,
  events: OutputWindowEvents,
  options: {
    log: Logger;
    onFailure: (id: string, missing: boolean) => void;
    onGpuFallback?: () => void;
    onAcceleration?: (
      status: Pick<
        OutputScreenStatus,
        'ndiAcceleration' | 'ndiAccelerationReason'
      >,
    ) => void;
  },
): OutputWindowHandle {
  let current = screen;
  let active = false;
  let capture = {x: 0, y: 0, width: NDI_FRAME_WIDTH, height: NDI_FRAME_HEIGHT};
  const create = (): OutputWindowHandle => {
    const enabled =
      current.ndi?.hardwareAcceleration ?? NDI_DEFAULT_HARDWARE_ACCELERATION;
    options.onAcceleration?.(
      enabled
        ? {ndiAcceleration: 'pending'}
        : {ndiAcceleration: 'bitmap', ndiAccelerationReason: 'disabled'},
    );
    return enabled
      ? createGpuOutput(current, events, {
          options,
          bitmap: () => createBitmapOutput(current, events, options),
        })
      : createBitmapOutput(current, events, options);
  };
  let delegate = create();
  return {
    ...forwardingHandle(() => delegate),
    configure: next => {
      const changed =
        (current.ndi?.hardwareAcceleration ??
          NDI_DEFAULT_HARDWARE_ACCELERATION) !==
        (next.ndi?.hardwareAcceleration ?? NDI_DEFAULT_HARDWARE_ACCELERATION);
      current = next;
      if (changed) {
        delegate.destroy();
        delegate = create();
        if (active) delegate.showCapture(capture);
      } else delegate.configure(next);
    },
    showCapture: (bounds, top) => {
      active = true;
      capture = bounds;
      delegate.showCapture(bounds, top);
    },
    hide: () => {
      active = false;
      delegate.hide();
    },
    destroy: () => {
      active = false;
      delegate.destroy();
    },
  };
}
