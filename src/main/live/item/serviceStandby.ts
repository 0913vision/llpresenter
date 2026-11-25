import type {Logger} from '../../base/log';
import {dispatchLogged, type LiveStore} from '../store';

/** Return the outputs to standby after a different service opens. */
export function serviceStandby(
  store: Pick<LiveStore, 'state' | 'handles' | 'dispatch'>,
  log: Logger,
): void {
  if (store.state.blackScreen) {
    dispatchLogged(store, {type: 'black.toggle'}, log);
  }
  dispatchLogged(store, {type: 'item.stop'}, log);
}
