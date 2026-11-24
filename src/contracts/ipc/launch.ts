import {parsePreparation, type Preparation} from '@core/schema/app/launch';
import {message, signal, type IpcPort} from './endpoint';

/** The calls that tell main how far the control window has prepared. */
export const launchEndpoints = {
  preparing: message<Preparation>('launch:preparing', parsePreparation),
  ready: signal('launch:ready'),
};

/** The launch part of `window.llp`. */
export function launchApi(port: IpcPort) {
  return {
    /** Tells how much of the control window is prepared, during the launch. */
    preparing: port.message(launchEndpoints.preparing),
    /** The control window is prepared, so it can show. */
    ready: port.signal(launchEndpoints.ready),
  };
}

/** The launch part of `window.llp` as the renderer sees it. */
export type LaunchApi = ReturnType<typeof launchApi>;
