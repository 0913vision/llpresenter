import type {Result} from '@core/common/result';
import type {PayloadError} from '@core/schema/payload';
import {message, type IpcPort} from './endpoint';

export type WindowAction = 'minimize' | 'toggle-maximize' | 'close';

export const windowActions: readonly WindowAction[] = [
  'minimize',
  'toggle-maximize',
  'close',
];

/** Checks a title bar action. */
export function parseWindowAction(
  value: unknown,
): Result<WindowAction, PayloadError> {
  const action = windowActions.find(known => known === value);
  return action === undefined
    ? {ok: false, error: {field: '', message: 'Unknown window action'}}
    : {ok: true, value: action};
}

/** The title bar calls. */
export const windowEndpoints = {
  control: message<WindowAction>('window:control', parseWindowAction),
};

/** The title bar part of `window.llp`. */
export function windowApi(port: IpcPort) {
  return {
    /** Minimizes, maximizes or restores, or closes the calling window. */
    control: port.message(windowEndpoints.control),
  };
}

export type WindowApi = ReturnType<typeof windowApi>;
