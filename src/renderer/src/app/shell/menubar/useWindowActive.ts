import {useSyncExternalStore} from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('focus', onChange);
  window.addEventListener('blur', onChange);
  return () => {
    window.removeEventListener('focus', onChange);
    window.removeEventListener('blur', onChange);
  };
}

/**
 * Whether this window is the active one, as Windows shows on a title bar: it
 * turns off while another window or a dialog of the system has the focus.
 */
export function useWindowActive(): boolean {
  return useSyncExternalStore(subscribe, () => document.hasFocus());
}
