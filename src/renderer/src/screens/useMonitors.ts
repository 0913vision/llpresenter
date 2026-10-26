import {useEffect, useState} from 'react';
import type {MonitorList} from '@shared/schema/monitors';

const noMonitors: MonitorList = [];

/**
 * Follows the connected monitors. The list stays empty until the first read
 * answers; a failed read is logged and a later push still arrives.
 */
export function useMonitors(): MonitorList {
  const [monitors, setMonitors] = useState<MonitorList>(noMonitors);
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let active = true;
    let pushed = false;
    const stop = api.monitors.subscribe(next => {
      if (!active) return;
      pushed = true;
      setMonitors(next);
    });
    api.monitors.get().then(
      next => {
        if (active && !pushed) setMonitors(next);
      },
      (cause: unknown) => {
        api.log.write({
          level: 'error',
          message: 'Could not read the monitors',
          detail: cause instanceof Error ? cause.message : String(cause),
        });
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, []);
  return monitors;
}
