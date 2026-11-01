import {useEffect, useState} from 'react';
import type {FontCatalog} from '@core/schema/fontCatalog';

export type FontCatalogState =
  | {readonly status: 'loading' | 'failed'}
  | {readonly status: 'ready'; readonly families: FontCatalog};

/** Reads installed metadata without retaining an unmounted editor. */
export function useFontCatalog(): FontCatalogState {
  const [state, setState] = useState<FontCatalogState>(() => ({
    status: window.llp === undefined ? 'failed' : 'loading',
  }));
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let active = true;
    api.fonts.get().then(
      families => {
        if (active) setState({status: 'ready', families});
      },
      (cause: unknown) => {
        api.log.write({
          level: 'error',
          message: 'Could not load the font choices',
          detail: cause instanceof Error ? cause.message : String(cause),
        });
        if (active) setState({status: 'failed'});
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return state;
}
