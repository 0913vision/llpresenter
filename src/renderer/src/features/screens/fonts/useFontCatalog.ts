import {followLatest} from '@core/common/followLatest';
import {logFailure} from '@renderer/platform/logFailure';
import {useEffect, useState} from 'react';
import type {
  FontCatalog,
  FontCatalogSnapshot,
} from '@core/schema/screens/fontCatalog';

/**
 * How reading the installed fonts went: still loading, failed, or ready with
 * the families and whether the metadata was verified.
 */
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
    return followLatest<FontCatalogSnapshot>(
      {read: api.fonts.snapshot, subscribe: api.fonts.subscribe},
      {
        apply: value => setState({status: 'ready', ...value}),
        failed: (cause, pushed) => {
          logFailure(api, 'Could not load the font choices', cause);
          if (!pushed) setState({status: 'failed'});
        },
      },
    );
  }, []);
  return state;
}
