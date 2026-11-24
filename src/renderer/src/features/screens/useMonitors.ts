import {followLatest} from '@core/common/followLatest';
import {logFailure} from '@renderer/platform/logFailure';
import {useContext, useEffect, useState} from 'react';
import {LoadReadinessContext} from '@renderer/ui/loadReadiness';
import type {MonitorList} from '@core/schema/screens/monitors';
import {adoptScreenMonitors} from './useScreenEditor';

const noMonitors: MonitorList = [];

/**
 * Follows the connected monitors. The list stays empty until the first read
 * answers; a failed read is logged and a later push still arrives.
 */
export function useMonitors(): MonitorList {
  const readiness = useContext(LoadReadinessContext);
  const [monitors, setMonitors] = useState<MonitorList>(noMonitors);
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    const ready = readiness?.begin();
    const stop = followLatest(
      {read: api.monitors.get, subscribe: api.monitors.subscribe},
      {
        apply: next => {
          adoptScreenMonitors(api, next);
          setMonitors(next);
          ready?.();
        },
        failed: cause => {
          ready?.();
          logFailure(api, 'Could not read the monitors', cause);
        },
      },
    );
    return () => {
      ready?.();
      stop();
    };
  }, [readiness]);
  return monitors;
}
