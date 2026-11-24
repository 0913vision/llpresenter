import {useContext, useEffect, useState} from 'react';
import {LoadReadinessContext} from '@renderer/ui/loadReadiness';
import type {OutputStatuses} from '@core/schema/live/outputStatus';

const noStatuses: OutputStatuses = {};

/**
 * Follows every screen's output status. The map stays empty until the first
 * read answers; a failed read is logged and a later push still arrives.
 */
export function useOutputStatuses(): OutputStatuses {
  const [statuses, setStatuses] = useState<OutputStatuses>(noStatuses);
  const readiness = useContext(LoadReadinessContext);
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    const ready = readiness?.begin();
    let active = true;
    let pushed = false;
    const stop = api.output.subscribeStatus(next => {
      if (!active) return;
      pushed = true;
      setStatuses(next);
      ready?.();
    });
    api.output.getStatus().then(
      next => {
        if (active && !pushed) setStatuses(next);
        ready?.();
      },
      (cause: unknown) => {
        ready?.();
        api.log.write({
          level: 'error',
          message: 'Could not read the output statuses',
          detail: cause instanceof Error ? cause.message : String(cause),
        });
      },
    );
    return () => {
      active = false;
      ready?.();
      stop();
    };
  }, [readiness]);
  return statuses;
}
