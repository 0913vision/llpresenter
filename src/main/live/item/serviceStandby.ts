import type {LiveStore} from '../store';

/** Return the outputs to standby after a different service opens. */
export function serviceStandby(store: LiveStore): void {
  if (store.state.blackScreen) store.dispatch({type: 'black.toggle'});
  store.dispatch({type: 'item.stop'});
}
