import {useEffect, useState} from 'react';
import type {FontCatalog, FontCatalogSnapshot} from '@core/schema/fontCatalog';

export type FontCatalogState =
  | {readonly status: 'loading' | 'failed'}
  | {
      readonly status: 'ready';
      readonly families: FontCatalog;
      readonly verified: boolean;
    };

// NOTE(0913vision): The last catalog read stays for the next editor that
// opens, so its font names show in their first frame; the editor still reads
// and follows the catalog.
let latest: FontCatalogSnapshot | null = null;

/** Reads the catalog ahead, so the first editor that opens has its names. */
export function readFontCatalogAhead(): void {
  const api = window.llp;
  if (api === undefined || latest !== null) return;
  api.fonts.snapshot().then(
    value => {
      latest ??= value;
    },
    () => undefined,
  );
}

/** Reads installed metadata without retaining an unmounted editor. */
export function useFontCatalog(): FontCatalogState {
  const [state, setState] = useState<FontCatalogState>(() =>
    latest !== null
      ? {status: 'ready', ...latest}
      : {status: window.llp === undefined ? 'failed' : 'loading'},
  );
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let active = true;
    let pushed = false;
    const receive = (value: FontCatalogSnapshot): void => {
      latest = value;
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
