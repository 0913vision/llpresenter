import {followLatest} from '@core/common/followLatest';
import {logFailure} from '@renderer/platform/logFailure';
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
    const stop = followLatest(
      {read: api.output.getStatus, subscribe: api.output.subscribeStatus},
      {
        apply: next => {
          setStatuses(next);
          ready?.();
        },
        failed: cause => {
          ready?.();
          logFailure(api, 'Could not read the output statuses', cause);
        },
      },
    );
    return () => {
      ready?.();
      stop();
    };
  }, [readiness]);
  return statuses;
}
