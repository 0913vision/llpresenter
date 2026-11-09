import {useEffect, useState} from 'react';
import type {FontCatalog, FontCatalogSnapshot} from '@core/schema/fontCatalog';

export type FontCatalogState =
  | {readonly status: 'loading' | 'failed'}
  | {
      readonly status: 'ready';
      readonly families: FontCatalog;
      readonly verified: boolean;
    };

/** Reads installed metadata without retaining an unmounted editor. */
export function useFontCatalog(): FontCatalogState {
  const [state, setState] = useState<FontCatalogState>(() => ({
    status: window.llp === undefined ? 'failed' : 'loading',
  }));
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let active = true;
    let pushed = false;
    const receive = (value: FontCatalogSnapshot): void => {
      if (active) setState({status: 'ready', ...value});
    };
    const stop = api.fonts.subscribe(value => {
      pushed = true;
      receive(value);
    });
    api.fonts.snapshot().then(
      value => {
        if (!pushed) receive(value);
      },
      (cause: unknown) => {
        api.log.write({
          level: 'error',
          message: 'Could not load the font choices',
          detail: cause instanceof Error ? cause.message : String(cause),
        });
        if (active && !pushed) setState({status: 'failed'});
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, []);
  return state;
}
