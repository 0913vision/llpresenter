import {useEffect, useState} from 'react';
import type {OutputStatuses} from '@core/schema/outputStatus';

const noStatuses: OutputStatuses = {};

/**
 * Follows every screen's output status. The map stays empty until the first
 * read answers; a failed read is logged and a later push still arrives.
 */
export function useOutputStatuses(): OutputStatuses {
  const [statuses, setStatuses] = useState<OutputStatuses>(noStatuses);
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let active = true;
    let pushed = false;
    const stop = api.output.subscribeStatus(next => {
      if (!active) return;
      pushed = true;
      setStatuses(next);
    });
    api.output.getStatus().then(
      next => {
        if (active && !pushed) setStatuses(next);
      },
      (cause: unknown) => {
        api.log.write({
          level: 'error',
          message: 'Could not read the output statuses',
          detail: cause instanceof Error ? cause.message : String(cause),
        });
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, []);
  return statuses;
}
